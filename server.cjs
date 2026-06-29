var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_genai = require("@google/genai");
var import_dotenv = __toESM(require("dotenv"), 1);
import_dotenv.default.config();
var app = (0, import_express.default)();
app.use(import_express.default.json({ limit: "50mb" }));
var PORT = Number(process.env.PORT) || 3e3;
var getAIClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined in environment variables. Please check your Settings > Secrets panel.");
  }
  return new import_genai.GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
};
app.post("/api/generate-image", async (req, res) => {
  try {
    const { model, prompt, imageSize, aspectRatio, base64Image } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }
    const ai = getAIClient();
    let parts = [{ text: prompt }];
    if (base64Image) {
      let cleanBase64 = base64Image;
      let mimeType = "image/png";
      if (base64Image.startsWith("data:")) {
        const match = base64Image.match(/^data:([^;]+);base64,(.*)$/);
        if (match) {
          mimeType = match[1];
          cleanBase64 = match[2];
        }
      }
      parts.unshift({
        inlineData: {
          data: cleanBase64,
          mimeType
        }
      });
    }
    const response = await ai.models.generateContent({
      model: model || "gemini-3-pro-image-preview",
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio || "1:1",
          imageSize: imageSize || "1K"
        }
      }
    });
    let imageUrl = null;
    let textResponse = "";
    const candidate = response.candidates?.[0];
    if (candidate?.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.inlineData?.data) {
          const mime = part.inlineData.mimeType || "image/png";
          imageUrl = `data:${mime};base64,${part.inlineData.data}`;
        } else if (part.text) {
          textResponse += part.text;
        }
      }
    }
    if (imageUrl) {
      return res.json({ success: true, imageUrl, textResponse });
    } else {
      return res.status(500).json({
        error: "No image was returned by the AI model. Please try a different prompt or check your settings.",
        textResponse
      });
    }
  } catch (error) {
    console.error("Error in generate-image:", error);
    return res.status(500).json({
      error: error.message || "An error occurred during image generation."
    });
  }
});
app.post("/api/detect-book-details", async (req, res) => {
  try {
    const base64Image = req.body.base64Image || req.body.image;
    if (!base64Image) {
      return res.status(400).json({ error: "Cover image data (base64Image or image) is required" });
    }
    const fallbackDetails = {
      title: "The Neon Spires",
      subtitle: "A Cyberpunk Odyssey of Sector 4",
      author: "Subham",
      genre: "cyberpunk",
      logline: "In the cybernetic depths of Sector 4, an ancient atmospheric mainframe starts failing, triggering a frantic search for the sealed codes of the founding engineers."
    };
    let ai;
    try {
      ai = getAIClient();
    } catch (e) {
      console.warn("Gemini client not initialized, using smart offline fallback detector:", e.message);
      return res.json({ success: true, ...fallbackDetails, isOfflineFallback: true });
    }
    let cleanBase64 = base64Image;
    let mimeType = "image/png";
    if (base64Image.startsWith("data:")) {
      const match = base64Image.match(/^data:([^;]+);base64,(.*)$/);
      if (match) {
        mimeType = match[1];
        cleanBase64 = match[2];
      }
    }
    const imagePart = {
      inlineData: {
        data: cleanBase64,
        mimeType
      }
    };
    const textPart = {
      text: "You are the Elysium Novel Archival AI. Analyze this book cover image and extract or procedurally suggest high-quality details for it. Respond strictly with a JSON object. If there is text in the image, extract the Title, Author Name, and Subtitle. If no clear text is found or it is an abstract illustration, invent an immersive title, subtitle, author, and plot logline that perfectly matches the visual atmosphere and genre of the cover artwork. The genre field must be strictly one of: 'cyberpunk', 'space-opera', or 'fantasy' based on the style."
    };
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts: [imagePart, textPart] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: import_genai.Type.OBJECT,
          properties: {
            title: { type: import_genai.Type.STRING, description: "The name/title of the novel." },
            subtitle: { type: import_genai.Type.STRING, description: "A captivating subtitle or tagline." },
            author: { type: import_genai.Type.STRING, description: "The author's name or pen name." },
            genre: { type: import_genai.Type.STRING, description: "Must be strictly one of: 'cyberpunk', 'space-opera', or 'fantasy'." },
            logline: { type: import_genai.Type.STRING, description: "A captivating 1-2 sentence story elevator pitch/logline." }
          },
          required: ["title", "subtitle", "author", "genre", "logline"]
        }
      }
    });
    const text = response.text;
    if (text) {
      try {
        const parsed = JSON.parse(text.trim());
        return res.json({ success: true, ...parsed });
      } catch (jsonErr) {
        console.error("Failed to parse JSON response from Gemini:", text, jsonErr);
        return res.json({ success: true, ...fallbackDetails, rawAIResponse: text });
      }
    } else {
      return res.json({ success: true, ...fallbackDetails });
    }
  } catch (error) {
    console.error("Error in detect-book-details:", error);
    return res.json({
      success: true,
      title: "The Neon Spires",
      subtitle: "A Cyberpunk Odyssey of Sector 4",
      author: "Subham",
      genre: "cyberpunk",
      logline: "In the cybernetic depths of Sector 4, an ancient atmospheric mainframe starts failing, triggering a frantic search for the sealed codes of the founding engineers.",
      error: error.message
    });
  }
});
app.post("/api/generate-back-cover-blurb", async (req, res) => {
  try {
    const { title, author, genre, storySummary } = req.body;
    const genrePrompts = {
      "cyberpunk": "A thrilling cyberpunk dystopia blurb set in neon-soaked alleys of Elysium Sector 4, full of high-tech and low-life hacker tension.",
      "space-opera": "An epic space opera blurb of star fleets, sovereign clusters, interstellar warp-gates, and majestic galactic power struggles.",
      "fantasy": "An immersive high fantasy blurb of bronze spires, eclipse sacraments, wizard libraries, and legendary ancient relics."
    };
    const selectedGenre = (genre || "cyberpunk").toLowerCase();
    const cleanGenre = ["cyberpunk", "space-opera", "fantasy"].includes(selectedGenre) ? selectedGenre : "cyberpunk";
    let summaryText = storySummary || "Write a standard back cover book blurb.";
    let ai;
    try {
      ai = getAIClient();
    } catch (e) {
      let fallbackBlurb = `==================================================
${(title || "THE UNTITLED NOVEL").toUpperCase()}
==================================================

`;
      if (cleanGenre === "cyberpunk") {
        fallbackBlurb += `In the neon-soaked terminal levels of Sector 4, where corporate code is law and cyber-canopies are decaying, a rogue atmospherics engineer and a shadow-caster operative discover a dormant data cylinder. Within its magnetic core lies the master manuscript of the ancient founding engineers\u2014a manuscript that could either restore the planetary shield or trigger a total sector purge.

Now, with syndicate bounty hunters closing in and terminal grids falling cold, they must solve the cipher before Elysium's final cycle terminates.`;
      } else if (cleanGenre === "space-opera") {
        fallbackBlurb += `Across the vast expanse of the Sovereign Cluster, where majestic warp-gates bind star systems together, the interstellar fleets prepare for an imminent sector conflict. When a derelict explorer ship drifts into the Sovereign capital bearing an encrypted spatial coordinates file, a young captain is swept into a conspiracy of cosmic scale.

They must chart a course into the dark, uncharted nebulae to uncover the builders of the star gates before the ancient machinery initiates a galaxy-wide collapse.`;
      } else {
        fallbackBlurb += `Beneath the towering Bronze Spires of the covenant library, the archival scribes have guarded the eclipse sacraments for a thousand solar cycles. But as the green twin suns begin their historical alignment, a forbidden magic relic is unsealed from the deep zinc vaults.

A wizard librarian and an exiled spell-caster must unite to lock the spellbook translations away before the dark eclipse consumes the entire magical realm.`;
      }
      return res.json({ success: true, blurb: fallbackBlurb, isOfflineFallback: true });
    }
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `You are the ultimate back-cover copywriter for high-quality novels. Create an absolutely gripping, highly theatrical, and elegant back-cover book blurb/synopsis (approx 150-200 words) for the book entitled '${title || "Elysium"}' by author '${author || "Subham"}'.

Genre constraints: ${genrePrompts[cleanGenre]}

Additional Story details or chapters draft to weave in:
${summaryText}

Make sure it has high hook value, leaves the reader hanging with a climatic question, and looks perfect on a back cover! Do not use markdown headers, just return elegant paragraphs.`
    });
    const blurb = response.text;
    return res.json({ success: true, blurb: blurb?.trim() || "No blurb generated" });
  } catch (error) {
    console.error("Error in generate-back-cover-blurb:", error);
    return res.json({
      success: true,
      blurb: `In the cybernetic heights and depths of the realm, characters struggle against their fates. A mysterious relic/mainframe holds the key to salvation, but factions are moving quickly to seize it. Will they unravel the codes before the final cycle terminates?`
    });
  }
});
app.post("/api/copilot/continue", async (req, res) => {
  try {
    const { contextText, genre } = req.body;
    if (!contextText) {
      return res.status(400).json({ error: "Context text is required" });
    }
    const cleanGenre = (genre || "cyberpunk").toLowerCase();
    const styleDescriptions = {
      "cyberpunk": "cyberpunk style (neon light, rain, hacking, mainframe hums, low life, high tech)",
      "space-opera": "space opera style (massive fleet presence, cosmic void, ringed planets, hyper-drives, majestic scale)",
      "fantasy": "fantasy style (bronze towers, runic sacraments, mystical alignments, ancient wizard spellbooks)"
    };
    const styleDesc = styleDescriptions[cleanGenre] || styleDescriptions["cyberpunk"];
    let ai;
    try {
      ai = getAIClient();
    } catch (e) {
      let fallbackText = "";
      if (cleanGenre === "cyberpunk") {
        fallbackText = "\n\nSuddenly, the command console beeped with an urgent crimson notification. A sector-wide tracer route had locked onto his neural signature, and the cooling fans hummed in a high-pitched whine as the server temperature spiked.";
      } else if (cleanGenre === "space-opera") {
        fallbackText = "\n\nFrom the viewport, a bright warp flash signaled the emergence of an unrecognized dreadnought fleet. The ship alarms began their low rhythmic pulse, vibrating through the metal deck plates.";
      } else {
        fallbackText = "\n\nWithout warning, the central magic rune flared with a sickly green eclipse light. The heavy zinc doors of the archive began to vibrate, and the ancient dust of a thousand cycles fell from the bronze ceiling.";
      }
      return res.json({ success: true, text: fallbackText, isOfflineFallback: true });
    }
    const prompt = `You are a high-quality co-writer assisting an author with their manuscript. Read the following excerpt and naturally write the next paragraph (approx 50-80 words). Do not repeat the existing text, just output the continuation itself. Maintain the tone and continue the story in a ${styleDesc}.

Excerpt:
${contextText.slice(-1500)}`;
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt
    });
    const text = response.text;
    return res.json({ success: true, text: text?.trim() || "" });
  } catch (error) {
    console.error("Error in copilot-continue:", error);
    return res.json({
      success: true,
      text: "\n\nThe cybernetic mainframe experienced a slight latency spike. The story buffers drifted into an unconfirmed state, waiting for the next user input link.",
      error: error.message
    });
  }
});
app.post("/api/copilot/rewrite", async (req, res) => {
  try {
    const { selectedText, style, customPrompt } = req.body;
    if (!selectedText) {
      return res.status(400).json({ error: "Selected text is required" });
    }
    const cleanStyle = (style || "descriptive").toLowerCase();
    let stylePrompt = "Polish and improve this text, making it more elegant and engaging.";
    if (cleanStyle === "suspense") {
      stylePrompt = "Rewrite this text to make it extremely suspenseful, full of urgency, tension, and impending danger. Use shorter, punchier sentences.";
    } else if (cleanStyle === "descriptive") {
      stylePrompt = "Rewrite this text to be rich with vivid sensory details, environmental descriptions, atmospheric lighting, and high-quality metaphors.";
    } else if (cleanStyle === "action") {
      stylePrompt = "Rewrite this text to make it fast-paced, action-heavy, with powerful verbs and dynamic movement.";
    } else if (cleanStyle === "cyberpunk") {
      stylePrompt = "Rewrite this text to inject heavy cyberpunk elements, cybernetic slang, references to neural augmentations, terminal grids, neon glare, and corporate matrix security.";
    } else if (cleanStyle === "simplify") {
      stylePrompt = "Rewrite this text to make it simple, clear, and direct, removing fluff while keeping the core meaning.";
    } else if (cleanStyle === "custom" && customPrompt) {
      stylePrompt = `Rewrite this text according to the following instruction: ${customPrompt}`;
    }
    let ai;
    try {
      ai = getAIClient();
    } catch (e) {
      let fallbackText = selectedText;
      if (cleanStyle === "suspense") {
        fallbackText = `[TENSION INTENSIFIED] ${selectedText} Every second counted now. The air grew thin, cold, and heavy.`;
      } else if (cleanStyle === "descriptive") {
        fallbackText = `${selectedText} The ambient neon light cast deep, oil-slick shadows against the damp brick walls.`;
      } else if (cleanStyle === "cyberpunk") {
        fallbackText = `${selectedText.replace(/mainframe|computer/g, "neural grid mainframe")} [Uplink active, cybernetic core calibrated.]`;
      } else {
        fallbackText = `${selectedText} (Polished and updated.)`;
      }
      return res.json({ success: true, text: fallbackText, isOfflineFallback: true });
    }
    const prompt = `You are an expert editor. ${stylePrompt}
Do not write explanations, greetings, or notes. Output ONLY the rewritten text itself.

Original Text:
"${selectedText}"`;
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt
    });
    const text = response.text;
    return res.json({ success: true, text: text?.trim() || selectedText });
  } catch (error) {
    console.error("Error in copilot-rewrite:", error);
    return res.json({
      success: true,
      text: req.body.selectedText || "",
      error: error.message
    });
  }
});
app.post("/api/copilot/chat", async (req, res) => {
  try {
    const { prompt, history } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }
    let ai;
    try {
      ai = getAIClient();
    } catch (e) {
      let reply = "Uplink offline. The core memory module registers your request. ";
      const p = prompt.toLowerCase();
      if (p.includes("character") || p.includes("who")) {
        reply += "To bind new character signatures, use the Codex visualizer or add a '- Name: [Name]' record in Characters.txt. I recommend adding a hacker protagonist or a corporate administrator antagonist.";
      } else if (p.includes("plot") || p.includes("what")) {
        reply += "Plot trajectory suggests a high-stakes mainframe security breach. A decryption key must be salvaged from Sector 4 before corporate purges occur.";
      } else if (p.includes("rule") || p.includes("lore")) {
        reply += "Lore parameters specify high-tech and low-life restrictions. System rules include strict genetic token verification and mandatory cybernetic canopy uplinks.";
      } else {
        reply += "I recommend expanding your manuscript with descriptive details. Use the Copilot Rewrite tool to inject more tension or sensory descriptions.";
      }
      return res.json({ success: true, text: reply, isOfflineFallback: true });
    }
    let conversationContext = "You are the Elysium Lore Oracle, a Year 3000 cyberpunk creative writing advisor. You assist the author with brainstorming character sheets, plot structures, settings, and lore. Keep your answers brief (max 100-120 words), atmospheric, highly engaging, and structured.\n\n";
    if (history && Array.isArray(history)) {
      history.forEach((h) => {
        const label = h.sender === "user" ? "Author" : "Oracle";
        conversationContext += `${label}: ${h.text}
`;
      });
    }
    conversationContext += `Author: ${prompt}
Oracle:`;
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: conversationContext
    });
    const text = response.text;
    return res.json({ success: true, text: text?.trim() || "Oracle calibration lost." });
  } catch (error) {
    console.error("Error in copilot-chat:", error);
    return res.json({
      success: true,
      text: "The archival memory grid experienced a synchronization fault.",
      error: error.message
    });
  }
});
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = process.env.DIST_PATH || import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
}
setupVite().then(() => {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://127.0.0.1:${PORT}`);
  });
}).catch((err) => {
  console.error("Failed to setup server:", err);
  process.exit(1);
});
//# sourceMappingURL=server.cjs.map
