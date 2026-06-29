import React, { useState, useEffect, useRef } from 'react';
import { jsPDF } from 'jspdf';
import { 
  Folder, 
  FileText, 
  Download, 
  Copy, 
  Check, 
  Code2, 
  Laptop, 
  BookOpen, 
  ChevronRight, 
  ChevronDown, 
  Image as ImageIcon, 
  HelpCircle,
  FileCode,
  Sparkles,
  Info,
  Maximize2,
  Minimize2,
  RefreshCw,
  Search,
  PenTool,
  Award,
  AlertTriangle,
  X,
  Terminal,
  Shield,
  Cpu,
  Radio,
  Zap,
  Activity,
  Eye,
  Trash2,
  Edit,
  Plus,
  FolderPlus,
  Upload,
  Settings as SettingsIcon,
  KeyRound
} from 'lucide-react';
import { pythonSourceCode } from './pyside_code';

// Bridge exposed by the Electron desktop shell (electron/preload.ts).
// When undefined, the app is running as a plain web app.
declare global {
  interface Window {
    elysium?: {
      isDesktop: boolean;
      hasApiKey: () => Promise<boolean>;
      openSettings: () => void;
      onPromptApiKey: (cb: () => void) => () => void;
    };
  }
}

// Interfaces for our simulated environment
interface SimulatedFile {
  name: string;
  path: string;
  content: string;
  image?: string; // Data URL for chapter-specific AI reference art
  type: 'file' | 'folder';
  children?: string[]; // paths of children if folder
}

interface CodexCharacter {
  id: string;
  name: string;
  role: string; // 'PROTAGONIST' | 'ANTAGONIST' | 'SUPPORTING'
  traits: string;
  motivation: string;
  avatar?: string; // base64 representation or url
}

interface CodexRule {
  id: string;
  index: number;
  title: string;
  description: string;
}

const parseCharacters = (content: string): CodexCharacter[] => {
  if (!content) return [];
  const list: CodexCharacter[] = [];
  const lines = content.split('\n');
  let currentRole = 'SUPPORTING';
  let currentChar: Partial<CodexCharacter> | null = null;

  for (let line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('===') || !trimmed) continue;

    if (trimmed.toUpperCase().includes('PROTAGONIST:')) {
      currentRole = 'PROTAGONIST';
      continue;
    } else if (trimmed.toUpperCase().includes('ANTAGONIST:')) {
      currentRole = 'ANTAGONIST';
      continue;
    } else if (trimmed.toUpperCase().includes('SUPPORTING NODES:') || trimmed.toUpperCase().includes('SUPPORTING ENTITIES:')) {
      currentRole = 'SUPPORTING';
      continue;
    }

    if (trimmed.startsWith('- Name:')) {
      if (currentChar && currentChar.name) {
        list.push(currentChar as CodexCharacter);
      }
      currentChar = {
        id: Math.random().toString(36).substr(2, 9),
        name: trimmed.replace('- Name:', '').trim(),
        role: currentRole,
        traits: '',
        motivation: '',
      };
    } else if (currentChar) {
      if (trimmed.startsWith('- Cybernetic Enhancements:') || trimmed.startsWith('- Enhancements:') || trimmed.startsWith('- Traits:')) {
        currentChar.traits = trimmed.replace(/^- (?:Cybernetic Enhancements|Enhancements|Traits):/, '').trim();
      } else if (trimmed.startsWith('- Motivation:') || trimmed.startsWith('- Objective:') || trimmed.startsWith('- Neural Motivation:')) {
        currentChar.motivation = trimmed.replace(/^- (?:Motivation|Objective|Neural Motivation):/, '').trim();
      } else if (trimmed.startsWith('- Profile 1:') || trimmed.startsWith('- Profile 2:')) {
        if (currentChar.name) {
          list.push(currentChar as CodexCharacter);
        }
        currentChar = {
          id: Math.random().toString(36).substr(2, 9),
          name: trimmed.replace(/^- Profile \d+:/, '').trim() || 'Supporting Character',
          role: 'SUPPORTING',
          traits: '',
          motivation: '',
        };
      }
    }
  }
  if (currentChar && currentChar.name) {
    list.push(currentChar as CodexCharacter);
  }
  return list;
};

const serializeCharacters = (characters: CodexCharacter[], genre: string): string => {
  const header = genre === 'cyberpunk' 
    ? '=== CYBERNETIC ENTITY SIGNATURES ==='
    : genre === 'space-opera'
    ? '=== INTERSTELLAR FLEET PROFILES ==='
    : '=== CAST AND FATE RECORDINGS ===';

  const protagonists = characters.filter(c => c.role === 'PROTAGONIST');
  const antagonists = characters.filter(c => c.role === 'ANTAGONIST');
  const supporting = characters.filter(c => c.role === 'SUPPORTING');

  let content = `${header}\n\n`;

  if (protagonists.length > 0) {
    content += `PROTAGONIST:\n`;
    protagonists.forEach(p => {
      content += `- Name: ${p.name}\n`;
      content += `- Traits: ${p.traits || 'None'}\n`;
      content += `- Motivation: ${p.motivation || 'None'}\n\n`;
    });
  }

  if (antagonists.length > 0) {
    content += `ANTAGONIST:\n`;
    antagonists.forEach(a => {
      content += `- Name: ${a.name}\n`;
      content += `- Traits: ${a.traits || 'None'}\n`;
      content += `- Motivation: ${a.motivation || 'None'}\n\n`;
    });
  }

  if (supporting.length > 0) {
    content += `SUPPORTING NODES:\n`;
    supporting.forEach(s => {
      content += `- Name: ${s.name}\n`;
      content += `- Traits: ${s.traits || 'None'}\n`;
      content += `- Motivation: ${s.motivation || 'None'}\n\n`;
    });
  }

  return content.trim();
};

const parseRules = (content: string): CodexRule[] => {
  if (!content) return [];
  const list: CodexRule[] = [];
  const lines = content.split('\n');
  for (let line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('===') || !trimmed) continue;
    const match = trimmed.match(/^(\d+)\.\s*(.*?)$/);
    if (match) {
      const index = parseInt(match[1]);
      const fullText = match[2];
      const colonIndex = fullText.indexOf(':');
      let title = '';
      let description = '';
      if (colonIndex !== -1) {
        title = fullText.substring(0, colonIndex).trim();
        description = fullText.substring(colonIndex + 1).trim();
      } else {
        title = `Protocol ${index}`;
        description = fullText;
      }
      list.push({
        id: Math.random().toString(36).substr(2, 9),
        index,
        title,
        description
      });
    }
  }
  return list;
};

const serializeRules = (rules: CodexRule[], genre: string): string => {
  const header = genre === 'cyberpunk'
    ? '=== DIGITAL CITY DIRECTIVES ==='
    : genre === 'space-opera'
    ? '=== GALACTIC TREATY PROTOCOLS ==='
    : '=== COVENANT ARCHIVAL LAW ===';

  let content = `${header}\n\n`;
  rules.forEach(r => {
    content += `${r.index}. ${r.title ? r.title + ': ' : ''}${r.description}\n`;
  });
  return content.trim();
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'simulator' | 'code' | 'docs'>('simulator');
  const [copied, setCopied] = useState(false);

  // --- Collapsible Sidebars State & Responsiveness ---
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
  const [isRightCollapsed, setIsRightCollapsed] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleResize = () => {
        if (window.innerWidth < 1024) {
          setIsLeftCollapsed(true);
          setIsRightCollapsed(true);
        } else {
          setIsLeftCollapsed(false);
          setIsRightCollapsed(false);
        }
      };
      handleResize();
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  // --- Desktop (Electron) integration ---
  // Detect the Electron bridge and track whether an API key is configured so
  // the Settings button can reflect status. The window is re-checked whenever
  // the app regains focus (e.g. after closing the Settings window).
  const isDesktop = typeof window !== 'undefined' && !!window.elysium?.isDesktop;
  const [hasApiKey, setHasApiKeyState] = useState<boolean>(false);

  useEffect(() => {
    if (!isDesktop) return;
    let active = true;
    const sync = async () => {
      try {
        const ok = await window.elysium!.hasApiKey();
        if (active) setHasApiKeyState(ok);
      } catch { /* ignore */ }
    };
    sync();
    // Open Settings automatically when the desktop shell asks for a key.
    const off = window.elysium!.onPromptApiKey(() => window.elysium!.openSettings());
    const onFocus = () => sync();
    window.addEventListener('focus', onFocus);
    return () => {
      active = false;
      off?.();
      window.removeEventListener('focus', onFocus);
    };
  }, [isDesktop]);

  // --- Live Simulator States ---
  const [files, setFiles] = useState<Record<string, SimulatedFile>>({});
  const [currentPath, setCurrentPath] = useState<string>('');
  const [editorText, setEditorText] = useState<string>('');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [projectRoot, setProjectRoot] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // --- AI Image Generator Modal States ---
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<'space' | 'cyber' | 'noir' | 'forest' | 'rune'>('cyber');
  const [artPrompt, setArtPrompt] = useState('');
  const [isGeneratingArt, setIsGeneratingArt] = useState(false);

  // Real Gemini AI Image States
  const [selectedModel, setSelectedModel] = useState<'gemini-3-pro-image-preview' | 'gemini-3.1-flash-image-preview' | 'imagen-3.0-generate-002'>('gemini-3-pro-image-preview');
  const [selectedSize, setSelectedSize] = useState<'512px' | '1K' | '2K' | '4K'>('1K');
  const [artMode, setArtMode] = useState<'create' | 'edit'>('create');
  const [artError, setArtError] = useState<string | null>(null);
  const [useRealAI, setUseRealAI] = useState<boolean>(true);

  // --- Rename File States ---
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameInput, setRenameInput] = useState('');

  // --- New Project Wizard States ---
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(true);
  const [newProjectName, setNewProjectName] = useState('Elysium_Volume_II');
  const [newProjectChapters, setNewProjectChapters] = useState(15);
  const [newProjectGenre, setNewProjectGenre] = useState<'cyberpunk' | 'space-opera' | 'fantasy'>('cyberpunk');
  const [includeCoverPage, setIncludeCoverPage] = useState(true);
  const [coverTitle, setCoverTitle] = useState('Elysium Volume II');
  const [coverSubtitle, setCoverSubtitle] = useState('A Cyberpunk Saga of Sector 4');
  const [coverAuthor, setCoverAuthor] = useState('Subham');

  // Keep project name in sync with cover title
  useEffect(() => {
    const sanitized = coverTitle.trim().replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_');
    setNewProjectName(sanitized || 'My_Novel_Project');
  }, [coverTitle]);

  // Multi-step cover designer/uploader states
  const [wizardStep, setWizardStep] = useState<'config' | 'cover' | 'review'>('cover');
  const [coverType, setCoverType] = useState<'design' | 'upload' | 'ai'>('design');
  const [uploadedCover, setUploadedCover] = useState<string>(''); // Base64 data url
  const [isAnalyzingCover, setIsAnalyzingCover] = useState(false);
  const [aiDetectedLogline, setAiDetectedLogline] = useState('An intriguing story set in a detailed and fascinating world, waiting to unfold adhyay by adhyay.');

  // AI Cover Generation States
  const [aiCoverPrompt, setAiCoverPrompt] = useState('A premium book cover artwork featuring a cyberpunk metropolis, glowing holographic spires, dark alleys with neon signs, intricate digital painting style, cinematic lighting');
  const [aiCoverStyle, setAiCoverStyle] = useState('Cinematic Digital Painting');
  const [isGeneratingAiCover, setIsGeneratingAiCover] = useState(false);
  const [aiCoverError, setAiCoverError] = useState<string | null>(null);

  // Sync default prompt when genre changes
  useEffect(() => {
    if (newProjectGenre === 'cyberpunk') {
      setAiCoverPrompt('A premium book cover artwork featuring a cyberpunk metropolis, glowing holographic spires, dark alleys with neon signs, intricate digital painting style, cinematic lighting');
    } else if (newProjectGenre === 'space-opera') {
      setAiCoverPrompt('A magnificent space opera book cover, massive starships orbiting a dual-ringed gas giant, galactic fleet maneuvers, cosmic nebulae, majestic sci-fi digital art');
    } else if (newProjectGenre === 'fantasy') {
      setAiCoverPrompt('An epic fantasy book cover of a mysterious tower of bronze spires, magic runes floating in the air under a green eclipse moon, mystical cinematic digital art');
    }
  }, [newProjectGenre]);

  // Procedural custom designer options
  const [customBgType, setCustomBgType] = useState<'gradient' | 'grid' | 'stars' | 'runes'>('grid');
  const [customPrimaryColor, setCustomPrimaryColor] = useState('#00f0ff');
  const [customSecondaryColor, setCustomSecondaryColor] = useState('#1b092a');
  const [customFont, setCustomFont] = useState('Space Grotesk');
  const [customTitleSize, setCustomTitleSize] = useState(36);
  const [customTitleY, setCustomTitleY] = useState(220);
  const [customSubtitleY, setCustomSubtitleY] = useState(280);
  const [customAuthorY, setCustomAuthorY] = useState(640);

  // --- End Novel Feature States ---
  const [isEndNovelModalOpen, setIsEndNovelModalOpen] = useState(false);
  const [endNovelStep, setEndNovelStep] = useState<'input' | 'processing' | 'published'>('input');
  const [backBlurb, setBackBlurb] = useState('');
  const [isGeneratingBlurb, setIsGeneratingBlurb] = useState(false);
  const [backAuthorBio, setBackAuthorBio] = useState('An imaginative writer navigating the realms of digital creation, crafting futures and legends piece by piece.');
  const [backPriceCode, setBackPriceCode] = useState('$15.99 US / £12.99 UK');
  const [backCoverImg, setBackCoverImg] = useState('');

  // --- Simulated Dialog State ---
  const [simulatedDialog, setSimulatedDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'info' | 'success' | 'warn' | 'close' | 'confirm-delete-project' | 'confirm-delete-active';
  } | null>(null);

  // --- Advanced Subsystem States ---
  const [rightTab, setRightTab] = useState<'illustration' | 'codex' | 'copilot' | 'telemetry'>('illustration');
  const [codexCharacters, setCodexCharacters] = useState<CodexCharacter[]>([]);
  const [codexRules, setCodexRules] = useState<CodexRule[]>([]);
  const [characterAvatars, setCharacterAvatars] = useState<Record<string, string>>(() => {
    try {
      const stored = localStorage.getItem('elysium_character_avatars');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const [copilotContinuation, setCopilotContinuation] = useState('');
  const [isGeneratingContinuation, setIsGeneratingContinuation] = useState(false);
  const [copilotChatHistory, setCopilotChatHistory] = useState<{ sender: 'user' | 'ai'; text: string }[]>([
    { sender: 'ai', text: "Systems online. Ask me anything about character development, setting protocols, or story trajectory to bind new concepts to the database." }
  ]);
  const [copilotChatInput, setCopilotChatInput] = useState('');
  const [isGeneratingChat, setIsGeneratingChat] = useState(false);
  const [selectedRewriteStyle, setSelectedRewriteStyle] = useState<'suspense' | 'descriptive' | 'action' | 'cyberpunk' | 'simplify' | 'custom'>('descriptive');
  const [customRewritePrompt, setCustomRewritePrompt] = useState('');
  const [isGeneratingRewrite, setIsGeneratingRewrite] = useState(false);

  const [isGeneratingCodexAvatar, setIsGeneratingCodexAvatar] = useState<Record<string, boolean>>({});
  const [isEditingCharacter, setIsEditingCharacter] = useState<CodexCharacter | null>(null);
  const [isAddingCharacter, setIsAddingCharacter] = useState(false);
  const [newCharacterName, setNewCharacterName] = useState('');
  const [newCharacterRole, setNewCharacterRole] = useState<'PROTAGONIST' | 'ANTAGONIST' | 'SUPPORTING'>('PROTAGONIST');
  const [newCharacterTraits, setNewCharacterTraits] = useState('');
  const [newCharacterMotivation, setNewCharacterMotivation] = useState('');
  const [codexTabSub, setCodexTabSub] = useState<'characters' | 'rules'>('characters');

  const [selectedRuleToEdit, setSelectedRuleToEdit] = useState<CodexRule | null>(null);
  const [isAddingRule, setIsAddingRule] = useState(false);
  const [newRuleTitle, setNewRuleTitle] = useState('');
  const [newRuleDescription, setNewRuleDescription] = useState('');

  // Persist character avatars
  useEffect(() => {
    localStorage.setItem('elysium_character_avatars', JSON.stringify(characterAvatars));
  }, [characterAvatars]);

  // Sync Codex from Files dynamically
  useEffect(() => {
    if (!projectRoot) return;
    const charPath = `${projectRoot}/2. Character & World Notes/Characters.txt`;
    const rulesPath = `${projectRoot}/2. Character & World Notes/World_Rules.txt`;

    if (files[charPath]) {
      const content = files[charPath].content;
      const parsed = parseCharacters(content);
      // Only set if content changed or first parse to prevent endless loops
      setCodexCharacters(prev => {
        if (JSON.stringify(prev.map(c => ({ name: c.name, role: c.role, traits: c.traits, motivation: c.motivation }))) !== 
            JSON.stringify(parsed.map(c => ({ name: c.name, role: c.role, traits: c.traits, motivation: c.motivation })))) {
          return parsed;
        }
        return prev;
      });
    }

    if (files[rulesPath]) {
      const content = files[rulesPath].content;
      const parsed = parseRules(content);
      setCodexRules(prev => {
        if (JSON.stringify(prev.map(r => ({ index: r.index, title: r.title, description: r.description }))) !== 
            JSON.stringify(parsed.map(r => ({ index: r.index, title: r.title, description: r.description })))) {
          return parsed;
        }
        return prev;
      });
    }
  }, [files, projectRoot]);

  // Synchronizers back to files state
  const updateCodexCharactersInFiles = (newCharacters: CodexCharacter[]) => {
    if (!projectRoot) return;
    const charPath = `${projectRoot}/2. Character & World Notes/Characters.txt`;
    const serialized = serializeCharacters(newCharacters, newProjectGenre);
    
    setFiles(prev => ({
      ...prev,
      [charPath]: {
        ...prev[charPath],
        content: serialized
      }
    }));

    if (currentPath === charPath) {
      setEditorText(serialized);
    }
  };

  const updateCodexRulesInFiles = (newRules: CodexRule[]) => {
    if (!projectRoot) return;
    const rulesPath = `${projectRoot}/2. Character & World Notes/World_Rules.txt`;
    const serialized = serializeRules(newRules, newProjectGenre);

    setFiles(prev => ({
      ...prev,
      [rulesPath]: {
        ...prev[rulesPath],
        content: serialized
      }
    }));

    if (currentPath === rulesPath) {
      setEditorText(serialized);
    }
  };

  // --- AI Copilot operations & helpers ---
  const getSelectedEditorText = () => {
    const textarea = document.getElementById('editor-textarea') as HTMLTextAreaElement;
    if (!textarea) return '';
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    return textarea.value.substring(start, end);
  };

  const insertTextAtCursor = (textToInsert: string) => {
    const textarea = document.getElementById('editor-textarea') as HTMLTextAreaElement;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const newText = text.substring(0, start) + textToInsert + text.substring(end);
    setEditorText(newText);
    
    if (currentPath) {
      setFiles(prev => ({
        ...prev,
        [currentPath]: {
          ...prev[currentPath],
          content: newText
        }
      }));
    }
  };

  const replaceSelectedEditorText = (replacement: string) => {
    const textarea = document.getElementById('editor-textarea') as HTMLTextAreaElement;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    if (start === end) {
      // Nothing selected, just insert or append
      insertTextAtCursor(replacement);
      return;
    }
    const text = textarea.value;
    const newText = text.substring(0, start) + replacement + text.substring(end);
    setEditorText(newText);
    
    if (currentPath) {
      setFiles(prev => ({
        ...prev,
        [currentPath]: {
          ...prev[currentPath],
          content: newText
        }
      }));
    }
  };

  const handleCopilotContinue = async () => {
    if (!editorText.trim()) {
      setSimulatedDialog({
        isOpen: true,
        title: "DRAFT EXCEPTION",
        message: "Please write some starter text in the active chapter before triggering AI continuation.",
        type: 'warn'
      });
      return;
    }

    setIsGeneratingContinuation(true);
    setCopilotContinuation('');

    try {
      const response = await fetch('/api/copilot/continue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contextText: editorText, genre: newProjectGenre })
      });
      if (!response.ok) throw new Error('API server failed to process continuation request');
      const data = await response.json();
      if (data.success && data.text) {
        setCopilotContinuation(data.text);
      }
    } catch (err: any) {
      console.error(err);
      setCopilotContinuation(`\n\n[OFFLINE RESILIENCE LINK] Suddenly, an encrypted signal pulsed on the mainframe screen. The tracer was moving fast. He had to decide his next move before Sector 4 systems locked down.`);
    } finally {
      setIsGeneratingContinuation(false);
    }
  };

  const handleCopilotRewrite = async () => {
    const selected = getSelectedEditorText();
    if (!selected) {
      setSimulatedDialog({
        isOpen: true,
        title: "NO TEXT SELECTION",
        message: "Please highlight a paragraph or sentence in the editor textarea first, then trigger the rewrite polish engine.",
        type: 'warn'
      });
      return;
    }

    setIsGeneratingRewrite(true);
    setCopilotContinuation('');

    try {
      const response = await fetch('/api/copilot/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedText: selected,
          style: selectedRewriteStyle,
          customPrompt: customRewritePrompt
        })
      });
      if (!response.ok) throw new Error('API server failed to rewrite selected segment');
      const data = await response.json();
      if (data.success && data.text) {
        setCopilotContinuation(data.text);
      }
    } catch (err: any) {
      console.error(err);
      setCopilotContinuation(`${selected} [COMM LINK INTERRUPTED: Stylized fallback applied.]`);
    } finally {
      setIsGeneratingRewrite(false);
    }
  };

  const handleCopilotChat = async () => {
    if (!copilotChatInput.trim()) return;
    const input = copilotChatInput;
    setCopilotChatInput('');
    setCopilotChatHistory(prev => [...prev, { sender: 'user', text: input }]);
    setIsGeneratingChat(true);

    try {
      const response = await fetch('/api/copilot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: input,
          history: copilotChatHistory
        })
      });
      if (!response.ok) throw new Error('API server chat error');
      const data = await response.json();
      if (data.success && data.text) {
        setCopilotChatHistory(prev => [...prev, { sender: 'ai', text: data.text }]);
      }
    } catch (err: any) {
      console.error(err);
      setCopilotChatHistory(prev => [...prev, { sender: 'ai', text: "Archive offline. Failsafe diagnostics suggest adding character nodes or outlining key mainframe breaches." }]);
    } finally {
      setIsGeneratingChat(false);
    }
  };

  const handleSaveChatToNotes = (text: string) => {
    if (!projectRoot) return;
    const notesPath = `${projectRoot}/2. Character & World Notes`;
    const randId = Math.random().toString(36).substring(2, 6).toUpperCase();
    const newNotePath = `${notesPath}/Lore_Insight_${randId}.txt`;

    setFiles(prev => {
      const updated = { ...prev };
      updated[newNotePath] = {
        name: `Lore_Insight_${randId}.txt`,
        path: newNotePath,
        content: `=== LORE ARCHIVE SIGNATURE ${randId} ===\n\n${text}\n\nWoven into project lore: ${new Date().toLocaleDateString()}`,
        type: 'file'
      };

      if (updated[notesPath]) {
        const children = updated[notesPath].children || [];
        if (!children.includes(newNotePath)) {
          updated[notesPath] = {
            ...updated[notesPath],
            children: [...children, newNotePath]
          };
        }
      }
      return updated;
    });

    setSimulatedDialog({
      isOpen: true,
      title: "LORE CONCORDANCE BOUND",
      message: `The Lore Oracle's response has been written to the disk filesystem:\n2. Character & World Notes/Lore_Insight_${randId}.txt\n\nIt is now fully indexed.`,
      type: 'success'
    });
  };

  const handleGenerateCodexAvatar = async (char: CodexCharacter) => {
    setIsGeneratingCodexAvatar(prev => ({ ...prev, [char.id]: true }));
    try {
      const roleName = char.role === 'PROTAGONIST' ? 'Protagonist' : char.role === 'ANTAGONIST' ? 'Antagonist' : 'Supporting character';
      const prompt = `Futuristic cyberpunk sci-fi portrait of ${char.name}, a ${roleName} with traits: ${char.traits || 'none'}. Motivation: ${char.motivation || 'none'}. Highly artistic digital painting style, clean details, neon backlights, dark background, 1:1 square ratio`;

      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gemini-3.1-flash-image-preview',
          prompt: prompt,
          imageSize: '512px',
          aspectRatio: '1:1'
        })
      });

      if (!response.ok) throw new Error('API server failed to render character avatar');
      const data = await response.json();
      if (data.success && data.imageUrl) {
        setCharacterAvatars(prev => ({
          ...prev,
          [char.name]: data.imageUrl
        }));

        setSimulatedDialog({
          isOpen: true,
          title: "NEURAL AVATAR MATERIALIZED",
          message: `Generated custom visual neural avatar for "${char.name}" using Gemini 3.1 Flash. Avatar has been mapped to Codex card.`,
          type: 'success'
        });
      }
    } catch (error: any) {
      console.error("Avatar generation failed:", error);
      // Fallback procedural avatar: create a simple canvas-based avatar
      const canvas = document.createElement('canvas');
      canvas.width = 150;
      canvas.height = 150;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Draw cyber circle
        const grad = ctx.createRadialGradient(75, 75, 5, 75, 75, 70);
        grad.addColorStop(0, '#00f0ff');
        grad.addColorStop(1, '#02040a');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 150, 150);
        
        ctx.strokeStyle = '#39ff14';
        ctx.lineWidth = 2;
        ctx.strokeRect(5, 5, 140, 140);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(char.name.substring(0, 2).toUpperCase(), 75, 85);
        
        const dataUrl = canvas.toDataURL();
        setCharacterAvatars(prev => ({
          ...prev,
          [char.name]: dataUrl
        }));
      }

      setSimulatedDialog({
        isOpen: true,
        title: "PROCEDURAL AVATAR APPLIED",
        message: "AI Avatar offline. Materialized a procedural terminal signature graphic for your character card.",
        type: 'info'
      });
    } finally {
      setIsGeneratingCodexAvatar(prev => ({ ...prev, [char.id]: false }));
    }
  };

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Initialize simulated files in storage/state on first load
  useEffect(() => {
    // Fresh start: project wizard is open by default on boot, waiting for the user to initialize a workspace.
  }, []);

  // Sync state back to files whenever active file shifts
  const selectFile = (path: string) => {
    if (files[path]?.type === 'folder') {
      // Toggle folder expansion
      setExpandedFolders(prev => ({
        ...prev,
        [path]: !prev[path]
      }));
      return;
    }

    // 1. Force simulated Auto-Save of currently active file
    if (currentPath && files[currentPath]) {
      setFiles(prev => ({
        ...prev,
        [currentPath]: {
          ...prev[currentPath],
          content: editorText
        }
      }));
    }

    // 2. Load newly clicked file
    setCurrentPath(path);
    setEditorText(files[path]?.content || '');
  };

  // Handle simulated editor text changes
  const handleEditorChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setEditorText(text);
    // Keep internal file content state updated
    if (currentPath) {
      setFiles(prev => ({
        ...prev,
        [currentPath]: {
          ...prev[currentPath],
          content: text
        }
      }));
    }
  };

  // Word Counter helper
  const countWords = (text: string): number => {
    if (!text.trim()) return 0;
    const cleanText = text.trim().replace(/\s+/g, ' ');
    const matches = cleanText.match(/\b\w+\b/g);
    return matches ? matches.length : 0;
  };

  const wordCount = countWords(editorText);
  const targetCount = 1500;
  const wordPercentage = Math.min(Math.round((wordCount / targetCount) * 100), 1000);
  const reachedTarget = wordCount >= targetCount;

  // Function to simulate clicking close on the PyQt window
  const triggerCloseEvent = () => {
    // Force auto-save of current active file
    if (currentPath && files[currentPath]) {
      setFiles(prev => ({
        ...prev,
        [currentPath]: {
          ...prev[currentPath],
          content: editorText
        }
      }));
    }

    setSimulatedDialog({
      isOpen: true,
      title: "Save & Close Simulated App",
      message: `The native closeEvent() has been safely intercepted by the manuscript engine.\n\nAll draft edits for "${files[currentPath]?.name || 'Untitled'}" have been safely saved to the simulated project folder:\n~/Elysium_Novel_Project.\n\nAll chapter records are fully synchronized and stored.`,
      type: 'info'
    });
  };

  // Copy Code to Clipboard
  const handleCopyCode = () => {
    navigator.clipboard.writeText(pythonSourceCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Download Python file
  const handleDownloadFile = () => {
    const element = document.createElement("a");
    const file = new Blob([pythonSourceCode], {type: 'text/plain;charset=utf-8'});
    element.href = URL.createObjectURL(file);
    element.download = "elysium_writer.py";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Export chapter as formatted PDF
  const exportToPDF = () => {
    if (!currentPath || !files[currentPath]) return;

    const file = files[currentPath];
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth ? doc.internal.pageSize.getWidth() : doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.getHeight ? doc.internal.pageSize.getHeight() : doc.internal.pageSize.height;
    const margin = 24; // Generous elegant margin
    const maxLineWidth = pageWidth - (margin * 2);

    let pageNum = 1;

    // Helper to draw clean editorial page header & footer
    const drawPageDecoration = (pNum: number) => {
      // Top elegant running header
      doc.setDrawColor(226, 232, 240); // very soft cool gray border
      doc.setLineWidth(0.2);
      doc.line(margin, 16, pageWidth - margin, 16);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139); // Slate-500
      doc.text('ELYSIUM NOVEL CHRONICLE', margin, 12);
      doc.text('MANUSCRIPT DRAFT', pageWidth - margin, 12, { align: 'right' });

      // Bottom clean footer
      doc.line(margin, pageHeight - 16, pageWidth - margin, pageHeight - 16);
      doc.text(`Document Ref: ${file.name}`, margin, pageHeight - 11);
      doc.text(`Page ${pNum}`, pageWidth - margin, pageHeight - 11, { align: 'right' });
    };

    // Draw first page decoration
    drawPageDecoration(pageNum);

    // Document Header
    doc.setFont('times', 'bold');
    doc.setFontSize(24);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text('Elysium Chronicle Draft', margin, 32);

    // Metadata block
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(71, 85, 105); // slate-700
    doc.text(`Chapter File: ${file.name}`, margin, 40);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(`Exported: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, margin, 45);
    doc.text(`Word Count: ${wordCount.toLocaleString()} words`, margin, 50);

    // Fine divider line
    doc.setDrawColor(148, 163, 184); // Slate-400
    doc.setLineWidth(0.4);
    doc.line(margin, 54, pageWidth - margin, 54);

    let y = 66;

    // Add image if there is reference art
    if (file.image) {
      try {
        const imgWidth = 90;
        const imgHeight = 50.6; // 16:9 ratio
        const imgX = (pageWidth - imgWidth) / 2;
        doc.addImage(file.image, 'PNG', imgX, y, imgWidth, imgHeight);
        
        // Add an elegant minimal frame around the reference illustration
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.15);
        doc.rect(imgX, y, imgWidth, imgHeight);

        y += imgHeight + 14;
      } catch (e) {
        console.error("Failed to add image to PDF", e);
      }
    }

    // Paragraphs
    const paragraphs = file.content.split('\n');
    doc.setFont('times', 'normal'); // Classic serif for high-quality book manuscript reading
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59); // slate-800 for pristine reading contrast

    paragraphs.forEach((para) => {
      // If paragraph is empty, add spacing
      if (!para.trim()) {
        y += 5;
        return;
      }

      // Check if paragraph is heading
      const isHeader = para.trim().startsWith('---') || para.trim().startsWith('===');

      const splitLines = doc.splitTextToSize(para, maxLineWidth);
      
      splitLines.forEach((line: string) => {
        // Break page if near the bottom
        if (y > pageHeight - 24) {
          doc.addPage();
          pageNum++;
          drawPageDecoration(pageNum);
          y = 26; // Reset y for new page
        }

        if (isHeader) {
          doc.setFont('times', 'bold');
          doc.setFontSize(12);
          doc.setTextColor(15, 23, 42);
        } else {
          doc.setFont('times', 'normal');
          doc.setFontSize(11);
          doc.setTextColor(30, 41, 59);
        }

        doc.text(line, margin, y);
        y += 6.5; // spacing between lines
      });

      // Paragraph spacing
      y += 4;
    });

    // Save
    const cleanName = file.name.replace('.txt', '');
    doc.save(`${cleanName}_Draft.pdf`);

    // Show a success message dialog in the app
    setSimulatedDialog({
      isOpen: true,
      title: "PDF Manuscript Exported",
      message: `Your novel manuscript chapter has been successfully compiled and saved as a formatted PDF.\n\nFile Name: ${cleanName}_Draft.pdf\nTotal Pages: ${pageNum} page(s)\nStatus: Complete and saved to your Downloads directory.`,
      type: 'success'
    });
  };

  const generateAIArt = async () => {
    if (!currentPath) {
      setArtError("Please select a chapter first.");
      return;
    }
    if (!artPrompt.trim()) {
      setArtError("Please enter a visual description prompt.");
      return;
    }

    setIsGeneratingArt(true);
    setArtError(null);

    try {
      // If edit mode is active, fetch the base64 of the current chapter art (if it exists)
      let base64Image: string | null = null;
      if (artMode === 'edit') {
        const currentArt = files[currentPath]?.image;
        if (currentArt) {
          base64Image = currentArt;
        } else {
          setArtMode('create');
        }
      }

      // Add selected theme description if any to style the output
      const fullPrompt = `${artPrompt}${selectedTheme ? `, in a styled ${selectedTheme} theme` : ""}`;

      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: selectedModel,
          prompt: fullPrompt,
          imageSize: selectedSize,
          aspectRatio: "1:1",
          base64Image: base64Image,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to generate image from Gemini model.");
      }

      // Update file state
      setFiles(prev => ({
        ...prev,
        [currentPath]: {
          ...prev[currentPath],
          image: data.imageUrl
        }
      }));

      // Close modal on success
      setIsImageModalOpen(false);
      setArtPrompt('');
      
      setSimulatedDialog({
        isOpen: true,
        title: "NEURAL GRAPHIC BINDING SUCCESSFUL",
        message: `Your custom neural artwork has been synthesized successfully using ${selectedModel} (${selectedSize}) and bound to chapter manuscript node "${files[currentPath]?.name}".`,
        type: 'success'
      });

    } catch (err: any) {
      console.error(err);
      // Give details about the paid model flow in the error message if appropriate
      let errMsg = err.message || "An unexpected error occurred during rendering.";
      if (errMsg.toLowerCase().includes("key") || errMsg.toLowerCase().includes("permission") || errMsg.toLowerCase().includes("not found")) {
        errMsg += "\n\nTip: Image models require an active Gemini API key. Ensure yours is correctly set up in the Settings > Secrets panel.";
      }
      setArtError(errMsg);
    } finally {
      setIsGeneratingArt(false);
    }
  };

  const generateProceduralCover = (title: string, subtitle: string, author: string, genre: string): string => {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 800; // Book cover aspect ratio (3:4)
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // 1. Draw Background Gradient
    const grad = ctx.createLinearGradient(0, 0, 0, 800);
    if (genre === 'cyberpunk') {
      grad.addColorStop(0, '#02040a');
      grad.addColorStop(0.5, '#0c0f20');
      grad.addColorStop(1, '#1b092a');
    } else if (genre === 'space-opera') {
      grad.addColorStop(0, '#02010c');
      grad.addColorStop(0.6, '#06132b');
      grad.addColorStop(1, '#0c224a');
    } else {
      // fantasy
      grad.addColorStop(0, '#0a0a0f');
      grad.addColorStop(0.7, '#143c30');
      grad.addColorStop(1, '#02010c');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 600, 800);

    // 2. Draw Decorative Genre Graphics
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
    ctx.lineWidth = 1;
    if (genre === 'cyberpunk') {
      // Draw neon grid lines
      for (let i = 0; i <= 600; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 800);
        ctx.stroke();
      }
      for (let j = 0; j <= 800; j += 40) {
        ctx.beginPath();
        ctx.moveTo(0, j);
        ctx.lineTo(600, j);
        ctx.stroke();
      }
      // Add glowing neon circles
      ctx.strokeStyle = 'rgba(255, 0, 85, 0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(300, 400, 150, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
      ctx.beginPath();
      ctx.arc(300, 400, 155, 0, Math.PI * 2);
      ctx.stroke();
    } else if (genre === 'space-opera') {
      // Draw star particles
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 80; i++) {
        const x = Math.random() * 600;
        const y = Math.random() * 800;
        const size = Math.random() * 2 + 1;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
      // Draw warp lanes
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.25)';
      ctx.beginPath();
      for (let k = 0; k < 12; k++) {
        const angle = (k / 12) * Math.PI * 2;
        ctx.moveTo(300, 400);
        ctx.lineTo(300 + Math.cos(angle) * 400, 400 + Math.sin(angle) * 400);
      }
      ctx.stroke();
    } else {
      // Fantasy: Draw rune circles
      ctx.strokeStyle = 'rgba(234, 179, 8, 0.25)'; // Amber gold
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(300, 400, 160, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(300, 400, 130, 0, Math.PI * 2);
      ctx.stroke();
      // Draw star pentagram or octagram lines
      ctx.beginPath();
      for (let k = 0; k < 8; k++) {
        const angle1 = (k / 8) * Math.PI * 2;
        const angle2 = ((k + 3) / 8) * Math.PI * 2;
        ctx.moveTo(300 + Math.cos(angle1) * 130, 400 + Math.sin(angle1) * 130);
        ctx.lineTo(300 + Math.cos(angle2) * 130, 400 + Math.sin(angle2) * 130);
      }
      ctx.stroke();
    }

    // 3. Draw Book Title Frame / Text Overlay
    ctx.textAlign = 'center';

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px "Space Grotesk", sans-serif';
    ctx.shadowColor = genre === 'cyberpunk' ? '#00f0ff' : genre === 'space-opera' ? '#3b82f6' : '#eab308';
    ctx.shadowBlur = 15;
    ctx.fillText(title.toUpperCase().replace(/_/g, ' '), 300, 220);

    // Reset shadow
    ctx.shadowBlur = 0;

    // Subtitle
    ctx.fillStyle = '#94a3b8'; // slate-400
    ctx.font = '14px "JetBrains Mono", monospace';
    // Draw wrapped subtitle
    const words = subtitle.split(' ');
    let line = '';
    let y = 280;
    for (let n = 0; n < words.length; n++) {
      let testLine = line + words[n] + ' ';
      let metrics = ctx.measureText(testLine);
      if (metrics.width > 450 && n > 0) {
        ctx.fillText(line, 300, y);
        line = words[n] + ' ';
        y += 24;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, 300, y);

    // Decorative line above author
    ctx.strokeStyle = genre === 'cyberpunk' ? '#00f0ff' : genre === 'space-opera' ? '#3b82f6' : '#eab308';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(200, 600);
    ctx.lineTo(400, 600);
    ctx.stroke();

    // Author
    ctx.fillStyle = '#ffffff';
    ctx.font = 'italic 18px "Times New Roman", serif';
    ctx.fillText(`By ${author}`, 300, 640);

    // Footer Tag
    ctx.fillStyle = '#475569';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillText(`ELYSION ORIGINAL PROTOCOL • ${genre.toUpperCase()} DRAFT`, 300, 750);

    return canvas.toDataURL('image/png');
  };

  const generateCustomCover = (
    title: string,
    subtitle: string,
    author: string,
    genre: string,
    bgType: 'gradient' | 'grid' | 'stars' | 'runes' | 'solid',
    primaryColor: string,
    secondaryColor: string,
    fontFamily: string,
    titleSize: number,
    titleY: number,
    subtitleY: number,
    authorY: number
  ): string => {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 800;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // Background linear gradient
    const grad = ctx.createLinearGradient(0, 0, 0, 800);
    grad.addColorStop(0, '#02040a');
    grad.addColorStop(0.5, secondaryColor || '#0c0f20');
    grad.addColorStop(1, primaryColor || '#1b092a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 600, 800);

    // Background features
    if (bgType === 'grid') {
      ctx.strokeStyle = `${primaryColor}22`;
      ctx.lineWidth = 1;
      for (let i = 0; i <= 600; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 800);
        ctx.stroke();
      }
      for (let j = 0; j <= 800; j += 40) {
        ctx.beginPath();
        ctx.moveTo(0, j);
        ctx.lineTo(600, j);
        ctx.stroke();
      }
      // Glowing accent circle
      ctx.strokeStyle = `${primaryColor}aa`;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = primaryColor;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(300, 430, 140, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else if (bgType === 'stars') {
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 120; i++) {
        const x = (i * 17) % 600;
        const y = (i * 31) % 800;
        const size = ((i * 3) % 3) + 0.5;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = `${primaryColor}44`;
      ctx.lineWidth = 1.5;
      for (let r = 50; r <= 250; r += 50) {
        ctx.beginPath();
        ctx.arc(300, 430, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (bgType === 'runes') {
      ctx.strokeStyle = primaryColor || '#eab308';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(300, 430, 160, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(300, 430, 130, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      for (let k = 0; k < 8; k++) {
        const angle1 = (k / 8) * Math.PI * 2;
        const angle2 = ((k + 3) / 8) * Math.PI * 2;
        ctx.moveTo(300 + Math.cos(angle1) * 130, 430 + Math.sin(angle1) * 130);
        ctx.lineTo(300 + Math.cos(angle2) * 130, 430 + Math.sin(angle2) * 130);
      }
      ctx.stroke();
    } else {
      ctx.fillStyle = `${primaryColor}15`;
      ctx.fillRect(50, 50, 500, 700);
      ctx.strokeStyle = `${primaryColor}44`;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(50, 50, 500, 700);
    }

    ctx.textAlign = 'center';
    ctx.shadowBlur = 0;

    const fontToUse = fontFamily === 'Times New Roman' ? '"Times New Roman", serif' : `"${fontFamily}", sans-serif`;

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${titleSize || 36}px ${fontToUse}`;
    ctx.shadowColor = primaryColor || '#00f0ff';
    ctx.shadowBlur = 15;
    ctx.fillText(title.toUpperCase().replace(/_/g, ' '), 300, titleY || 220);
    ctx.shadowBlur = 0;

    // Subtitle
    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px "JetBrains Mono", monospace';
    const words = subtitle.split(' ');
    let line = '';
    let currY = subtitleY || 280;
    for (let n = 0; n < words.length; n++) {
      let testLine = line + words[n] + ' ';
      let metrics = ctx.measureText(testLine);
      if (metrics.width > 440 && n > 0) {
        ctx.fillText(line, 300, currY);
        line = words[n] + ' ';
        currY += 22;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, 300, currY);

    // Decorative line
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(220, 600);
    ctx.lineTo(380, 600);
    ctx.stroke();

    // Author
    ctx.fillStyle = '#ffffff';
    ctx.font = `italic 18px ${fontToUse}`;
    ctx.fillText(`By ${author}`, 300, authorY || 640);

    ctx.fillStyle = '#475569';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillText(`ELYSION ORIGINAL PROCEDURAL PROTOCOL • ${genre.toUpperCase()} SPECIAL`, 300, 750);

    return canvas.toDataURL('image/png');
  };

  const drawProceduralQRCode = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = '#000000';
    
    const modules = 21; // 21x21 QR Grid
    const step = size / modules;

    // Draw 3 corner finder patterns
    const drawFinderPattern = (px: number, py: number) => {
      ctx.fillRect(px, py, step * 7, step * 7);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(px + step, py + step, step * 5, step * 5);
      ctx.fillStyle = '#000000';
      ctx.fillRect(px + step * 2, py + step * 2, step * 3, step * 3);
    };

    drawFinderPattern(x, y); // Top Left
    drawFinderPattern(x + size - step * 7, y); // Top Right
    drawFinderPattern(x, y + size - step * 7); // Bottom Left

    // Draw alignment module (small 5x5) in bottom right area
    ctx.fillRect(x + size - step * 9, y + size - step * 9, step * 5, step * 5);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + size - step * 8, y + size - step * 8, step * 3, step * 3);
    ctx.fillStyle = '#000000';
    ctx.fillRect(x + size - step * 7, y + size - step * 7, step, step);

    // Populate remaining QR modules with beautiful deterministic noise
    for (let row = 0; row < modules; row++) {
      for (let col = 0; col < modules; col++) {
        // Skip finder pattern zones
        if (row < 8 && col < 8) continue; // Top Left
        if (row < 8 && col >= modules - 8) continue; // Top Right
        if (row >= modules - 8 && col < 8) continue; // Bottom Left
        if (row >= modules - 10 && row <= modules - 5 && col >= modules - 10 && col <= modules - 5) continue; // Alignment pattern zone
        
        const seed = (row * 37 + col * 43) % 2;
        if (seed === 1) {
          ctx.fillStyle = '#000000';
          ctx.fillRect(x + col * step, y + row * step, step + 0.5, step + 0.5);
        }
      }
    }
  };

  const drawProceduralBarcode = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, width, height);
    ctx.fillStyle = '#000000';
    
    let currX = x + 10;
    const barcodeWidth = width - 20;
    while (currX < x + barcodeWidth) {
      const barWidth = ((currX * 13) % 3) + 1; // 1, 2, or 3px
      const gapWidth = ((currX * 7) % 4) + 1;  // 1 to 4px
      ctx.fillRect(currX, y, barWidth, height - 15);
      currX += barWidth + gapWidth;
    }
    
    ctx.fillStyle = '#000000';
    ctx.font = '8px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('9 780199 535569', x + width / 2, y + height - 3);
  };

  const generateBackCover = (
    title: string,
    author: string,
    genre: string,
    blurb: string,
    authorBio: string,
    priceCode: string
  ): string => {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 800;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // Draw Background Gradient matching genre
    const grad = ctx.createLinearGradient(0, 0, 0, 800);
    if (genre === 'cyberpunk') {
      grad.addColorStop(0, '#1b092a');
      grad.addColorStop(0.5, '#0c0f20');
      grad.addColorStop(1, '#02040a');
    } else if (genre === 'space-opera') {
      grad.addColorStop(0, '#0c224a');
      grad.addColorStop(0.6, '#06132b');
      grad.addColorStop(1, '#02010c');
    } else {
      grad.addColorStop(0, '#143c30');
      grad.addColorStop(0.7, '#0a0a0f');
      grad.addColorStop(1, '#02010c');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 600, 800);

    // Draw visual frame border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.strokeRect(30, 30, 540, 740);

    ctx.textAlign = 'center';
    
    // Title & Author on back cover header (discreet and elegant)
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 11px "JetBrains Mono", monospace';
    ctx.fillText(`${title.toUpperCase()} • BY ${author.toUpperCase()}`, 300, 65);

    // Small divider line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(250, 80);
    ctx.lineTo(350, 80);
    ctx.stroke();

    // MAIN BLURB / REVIEWS SYNOPSIS
    ctx.fillStyle = '#f1f5f9';
    ctx.font = '15px "Times New Roman", serif';
    ctx.textAlign = 'left';
    
    const wrapText = (text: string, x: number, y: number, maxWidth: number, lineHeight: number) => {
      const paragraphs = text.split('\n');
      let currY = y;
      
      paragraphs.forEach(para => {
        const words = para.split(' ');
        let line = '';
        
        for (let n = 0; n < words.length; n++) {
          let testLine = line + words[n] + ' ';
          let metrics = ctx.measureText(testLine);
          if (metrics.width > maxWidth && n > 0) {
            ctx.fillText(line, x, currY);
            line = words[n] + ' ';
            currY += lineHeight;
          } else {
            line = testLine;
          }
        }
        ctx.fillText(line, x, currY);
        currY += lineHeight + 12;
      });
      return currY;
    };

    const blurbStartY = 130;
    const endBlurbY = wrapText(blurb, 60, blurbStartY, 480, 24);

    // ABOUT THE AUTHOR section
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.fillText('ABOUT THE AUTHOR', 60, endBlurbY + 15);
    
    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'italic 12px "Times New Roman", serif';
    const endBioY = wrapText(authorBio, 60, endBlurbY + 35, 480, 18);

    // Draw divider before barcodes
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(60, 680);
    ctx.lineTo(540, 680);
    ctx.stroke();

    // Draw Barcode & QR Code side-by-side in footer
    const barcodeX = 60;
    const barcodeY = 695;
    drawProceduralBarcode(ctx, barcodeX, barcodeY, 150, 65);

    const qrX = 475;
    const qrY = 695;
    drawProceduralQRCode(ctx, qrX, qrY, 65);

    // Draw Price & Publisher Tag
    ctx.fillStyle = '#94a3b8';
    ctx.font = '8px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(priceCode, 230, 720);
    ctx.fillText('ELYSION PRESS • TRANSMISSION COMPLETE', 230, 735);

    return canvas.toDataURL('image/png');
  };

  const createNewProject = (
    name: string, 
    chaptersCount: number, 
    genre: string,
    addCoverPage: boolean,
    covTitle: string,
    covSubtitle: string,
    covAuthor: string,
    customCoverImg?: string,
    customLogline?: string
  ) => {
    const cleanName = name.trim().replace(/[^a-zA-Z0-9_]/g, '_');
    if (!cleanName) return;

    const newFiles: Record<string, SimulatedFile> = {};
    const rootPath = cleanName;
    const manuscriptPath = `${rootPath}/1. Manuscript`;
    const notesPath = `${rootPath}/2. Character & World Notes`;

    // Root folder
    newFiles[rootPath] = {
      name: cleanName,
      path: rootPath,
      content: '',
      type: 'folder',
      children: [manuscriptPath, notesPath]
    };

    // Manuscript folder children paths list
    const manuscriptChildren: string[] = [];
    
    // Add cover page node first if requested
    const coverPath = `${manuscriptPath}/000_Cover_Page.txt`;
    if (addCoverPage) {
      manuscriptChildren.push(coverPath);
    }

    for (let i = 1; i <= chaptersCount; i++) {
      const chapNum = String(i).padStart(3, '0');
      manuscriptChildren.push(`${manuscriptPath}/Adhyay_${chapNum}.txt`);
    }

    newFiles[manuscriptPath] = {
      name: '1. Manuscript',
      path: manuscriptPath,
      content: '',
      type: 'folder',
      children: manuscriptChildren
    };

    // Genre-specific templates
    let starterIntro = '';
    let characterTemplate = '';
    let rulesTemplate = '';

    if (genre === 'cyberpunk') {
      starterIntro = `The rain fell in sheets of dark grease, painting the tarmac of ${cleanName.replace(/_/g, ' ')} in iridescent ribbons of copper and magenta. Neon light refracted through atmospheric smoke, reflecting the cold, calculating glare of the central mainframe server tower.`;
      characterTemplate = `=== CYBERNETIC ENTITY SIGNATURES ===\n\nPROTAGONIST:\n- Name: Jaxen Drake\n- Cybernetic Enhancements: Neural jack, low-light ocular implants\n- Motivation: Decrypt the corporate black-box carrying his sister's ghost\n\nANTAGONIST:\n- Name: Director Vane\n- Corporate Sector: Obsidian Tech Conglomerate\n- Threat Vector: Remote neural wiping arrays`;
      rulesTemplate = `=== DIGITAL CITY DIRECTIVES ===\n\n1. ALL DATAFEEDS MUST BE SYNCHRONIZED: The Obsidian Security Council monitors local terminal ports.\n2. BIOMETRIC ACCESS TO UPPER SECTOR: Strict genetic tokens required for sky bridge elevation.\n3. OFFLINE COGNITION IS PROHIBITED: Brain-implanted neural nodes must maintain a constant heartbeat link.`;
    } else if (genre === 'space-opera') {
      starterIntro = `Beyond the observation glass of the fleet commander's flagship, the cluster of star systems in ${cleanName.replace(/_/g, ' ')} burned like stardust on black silk. The warp drives hummed with a low resonance, indicating the hyperspace gate was fully saturated.`;
      characterTemplate = `=== INTERSTELLAR FLEET PROFILES ===\n\nPROTAGONIST:\n- Name: Commander Lyra Vance\n- Starship Rank: Admiral, Vanguard Star Fleet\n- Primary Objective: Align the scattered star cluster factions before the stellar flare\n\nANTAGONIST:\n- Name: High Consul Kaelen\n- Faction: The Core Hegemony\n- War Fleet: Dreadnought Class Vanguard`;
      rulesTemplate = `=== GALACTIC TREATY PROTOCOLS ===\n\n1. FASTER-THAN-LIGHT TRANSIT LAWS: All jump drives must register navigation vectors with orbital beacons.\n2. ANCIENT ARTIFACT SECURITY: Xeno-archaeology remains are protected under strict alliance guard.\n3. SHIPBOARD SYNCHRONIZATION: Local mainframe backups must be routed to colony relay transponders weekly.`;
    } else {
      starterIntro = `The iron towers of ${cleanName.replace(/_/g, ' ')} cast long, angular shadows across the gray stone courtyard. Wisps of white ash drifted from the high hearths, settling on the ancient leather-bound manuscripts spread over the table.`;
      characterTemplate = `=== CAST AND FATE RECORDINGS ===\n\nPROTAGONIST:\n- Name: Elian Thorne\n- Affiliation: Keeper of the Bronze Archives\n- Motivation: Translate the dark stone runes before the eclipse\n\nANTAGONIST:\n- Name: Lord Malakor\n- Title: Warden of the Obsidian Spires\n- Magic Affinity: Necrotic energy siphon`;
      rulesTemplate = `=== COVENANT ARCHIVAL LAW ===\n\n1. BRONZE LIBRARY SECURITY: No magic relics may be unsealed without historical council permission.\n2. ECLIPSE SACRAMENT: Spell-casters must remain within protective circles during solar align.\n3. SECURE MANUSCRIPTS: All spellbook translations must be hand-locked in zinc containers.`;
    }

    // Populate Cover Page if requested
    if (addCoverPage) {
      const coverImg = customCoverImg || generateProceduralCover(covTitle, covSubtitle, covAuthor, genre);
      newFiles[coverPath] = {
        name: '000_Cover_Page.txt',
        path: coverPath,
        content: `==================================================\n                 M A N U S C R I P T              \n==================================================\n\nTITLE:    ${covTitle.toUpperCase()}\nSUBTITLE: ${covSubtitle}\nAUTHOR:   ${covAuthor}\nGENRE:    ${genre.toUpperCase()}\n\n==================================================\n               MASTER BOOK COVER ART              \n==================================================\n[ A gorgeous cover illustration has been automatically synthesized on canvas and bound to this node. Open the Sister PNG viewer on the right side of the deck to inspect. ]\n\nSTORY LOG LINE & PROLOGUE SYNOPSIS:\n${customLogline || 'Draft your book elevator pitch, character sheets, and chapter outlines in this master cover hub.'}\n\nCreated: ${new Date().toLocaleDateString()}`,
        type: 'file',
        image: coverImg
      };
    }

    // Populate Adhyays
    for (let i = 1; i <= chaptersCount; i++) {
      const chapNum = String(i).padStart(3, '0');
      const path = `${manuscriptPath}/Adhyay_${chapNum}.txt`;
      newFiles[path] = {
        name: `Adhyay_${chapNum}.txt`,
        path: path,
        content: `--- ADHYAY ${chapNum} (অধ্যায় ${i}) ---\n\n${starterIntro}\n\nDraft your new adhyay segment here...`,
        type: 'file'
      };
    }

    // Notes folder
    const charPath = `${notesPath}/Characters.txt`;
    const rulesPath = `${notesPath}/World_Rules.txt`;

    newFiles[notesPath] = {
      name: '2. Character & World Notes',
      path: notesPath,
      content: '',
      type: 'folder',
      children: [charPath, rulesPath]
    };

    newFiles[charPath] = {
      name: 'Characters.txt',
      path: charPath,
      content: characterTemplate,
      type: 'file'
    };

    newFiles[rulesPath] = {
      name: 'World_Rules.txt',
      path: rulesPath,
      content: rulesTemplate,
      type: 'file'
    };

    setFiles(newFiles);
    setProjectRoot(cleanName);
    
    // Set expanded folders
    setExpandedFolders({
      [rootPath]: true,
      [`${rootPath}/1. Manuscript`]: true,
      [`${rootPath}/2. Character & World Notes`]: true
    });

    // Select cover page first if it exists, otherwise select first adhyay
    const defaultSelectPath = addCoverPage ? coverPath : `${manuscriptPath}/Adhyay_001.txt`;
    setCurrentPath(defaultSelectPath);
    setEditorText(newFiles[defaultSelectPath].content);

    setSimulatedDialog({
      isOpen: true,
      title: "PROJECT INITIATED",
      message: addCoverPage 
        ? `Project folder "~/Elysium_Novel_Project/${cleanName}" has been successfully synthesized on disk with custom Cover Page first, ${chaptersCount} Adhyay manuscript nodes, and custom genre templates!`
        : `Project folder "~/Elysium_Novel_Project/${cleanName}" has been successfully synthesized on disk with ${chaptersCount} Adhyay manuscript nodes and custom theme templates!`,
      type: 'success'
    });
  };

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setUploadedCover(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateAiCover = async () => {
    if (!aiCoverPrompt.trim()) {
      setAiCoverError("Please enter an image description prompt.");
      return;
    }

    setIsGeneratingAiCover(true);
    setAiCoverError(null);

    try {
      const fullPrompt = `Professional book cover artwork, no text, highly artistic representation of: ${aiCoverPrompt}. Mood style is ${aiCoverStyle}. Elegant detailed digital art.`;

      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gemini-3-pro-image-preview",
          prompt: fullPrompt,
          imageSize: "1K",
          aspectRatio: "3:4"
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to generate cover art from Gemini model.");
      }

      setUploadedCover(data.imageUrl);

      setSimulatedDialog({
        isOpen: true,
        title: "NEURAL GRAPHIC ART SYNTHESIZED",
        message: "Elysium Neural Engine has successfully materialized your cover artwork. You can now customize title metadata or run the AI Profile Detector!",
        type: 'success'
      });

    } catch (err: any) {
      console.error(err);
      let errMsg = err.message || "An unexpected error occurred during cover generation.";
      if (errMsg.toLowerCase().includes("key") || errMsg.toLowerCase().includes("permission") || errMsg.toLowerCase().includes("not found")) {
        errMsg += "\n\nTip: Image generation requires an active Gemini API key. Ensure yours is correctly set up in the Settings > Secrets panel.";
      }
      setAiCoverError(errMsg);
    } finally {
      setIsGeneratingAiCover(false);
    }
  };

  const detectBookDetails = async (base64Image: string) => {
    setIsAnalyzingCover(true);
    try {
      const response = await fetch('/api/detect-book-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image })
      });
      if (!response.ok) throw new Error('API server returned error during cover analysis');
      const data = await response.json();
      if (data.success && data.details) {
        const { title, subtitle, author, genre, logline } = data.details;
        if (title) setCoverTitle(title);
        if (subtitle) setCoverSubtitle(subtitle);
        if (author) setCoverAuthor(author);
        if (genre) setNewProjectGenre(genre);
        if (logline) setAiDetectedLogline(logline);
        
        setSimulatedDialog({
          isOpen: true,
          title: "AI VISION DETECTOR ACTIVE",
          message: `Elysium AI Vision Siphon successfully analyzed your cover! Detected Title: "${title || 'Unknown'}", Author: "${author || 'Unknown'}", Genre: "${genre || 'Unknown'}".`,
          type: "success"
        });
      }
    } catch (error: any) {
      console.error("Cover analysis failed:", error);
      setSimulatedDialog({
        isOpen: true,
        title: "ANALYSIS TELEMETRY OFFLINE",
        message: "The AI Vision Siphon offline mode is active. Standard procedural defaults have been populated. Feel free to customize them in the review panel.",
        type: "info"
      });
    } finally {
      setIsAnalyzingCover(false);
    }
  };

  const generateBackCoverBlurb = async () => {
    setIsGeneratingBlurb(true);
    try {
      let sampleText = '';
      const manuscriptKeys = Object.keys(files).filter(k => k.includes('/1. Manuscript/Chapter_'));
      if (manuscriptKeys.length > 0) {
        sampleText = manuscriptKeys.slice(0, 3).map(k => files[k]?.content).join('\n').slice(0, 1500);
      }

      const response = await fetch('/api/generate-back-cover-blurb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: coverTitle,
          author: coverAuthor,
          genre: newProjectGenre,
          summary: sampleText || aiDetectedLogline
        })
      });
      if (!response.ok) throw new Error('API server failed to generate blurb');
      const data = await response.json();
      if (data.success && data.blurb) {
        setBackBlurb(data.blurb);
        setSimulatedDialog({
          isOpen: true,
          title: "AI BLURB SYNTHESIZED",
          message: "The theatrical book blurb has been woven using the Gemini model and successfully loaded.",
          type: "success"
        });
      }
    } catch (error: any) {
      console.error("Failed to generate blurb:", error);
      setBackBlurb(`In the high-altitude canopy of this realm, where corporate mainframes dictating environmental shield codes are failing, ${coverAuthor}'s gripping tale centers on ${coverTitle}.\n\nWhen a forbidden encrypted archive is recovered from Sector 4, a team of outcasts must decipher the terminal protocols before the final cycle collapses. Will they find the key, or will they be erased forever?`);
      setSimulatedDialog({
        isOpen: true,
        title: "OFFLINE BLURB WEAVING ENGINE ACTIVE",
        message: "We've pre-seeded an immersive, genre-aligned blurb format. Customize and review it on the canvas screen.",
        type: "info"
      });
    } finally {
      setIsGeneratingBlurb(false);
    }
  };

  const finalizeEndNovel = () => {
    if (!projectRoot) return;
    
    const manuscriptPath = `${projectRoot}/1. Manuscript`;
    const backCoverPath = `${manuscriptPath}/999_Back_Cover_Page.txt`;

    const imgDataUrl = generateBackCover(
      coverTitle,
      coverAuthor,
      newProjectGenre,
      backBlurb,
      backAuthorBio,
      backPriceCode
    );

    setBackCoverImg(imgDataUrl);

    const backCoverContent = `==================================================\n              B A C K   C O V E R                 \n==================================================\n\nTITLE:    ${coverTitle.toUpperCase()}\nAUTHOR:   ${coverAuthor}\nGENRE:    ${newProjectGenre.toUpperCase()}\n\n==================================================\n                 BACK COVER BLURB                 \n==================================================\n${backBlurb}\n\n==================================================\n               ABOUT THE AUTHOR                   \n==================================================\n${backAuthorBio}\n\n==================================================\n                 BARCODE & QR CODE                \n==================================================\n[ A high-fidelity back-cover artwork with procedural barcode and system QR code has been generated on canvas and bound to this node. Open the Sister PNG viewer on the right side of the deck to inspect. ]\n\nPublish Date: ${new Date().toLocaleDateString()}`;

    setFiles(prev => {
      const updated = { ...prev };
      
      updated[backCoverPath] = {
        name: '999_Back_Cover_Page.txt',
        path: backCoverPath,
        content: backCoverContent,
        type: 'file',
        image: imgDataUrl
      };

      if (updated[manuscriptPath]) {
        const children = updated[manuscriptPath].children || [];
        if (!children.includes(backCoverPath)) {
          updated[manuscriptPath] = {
            ...updated[manuscriptPath],
            children: [...children, backCoverPath]
          };
        }
      }

      return updated;
    });

    setCurrentPath(backCoverPath);
    setEditorText(backCoverContent);
    setEndNovelStep('published');

    setSimulatedDialog({
      isOpen: true,
      title: "NOVEL TRANSMISSION SEALED",
      message: "Congratulations! Your manuscript has been concluded. The high-fidelity back cover page with procedural QR code and bar code has been appended.",
      type: "success"
    });
  };

  const deleteActiveFile = () => {
    if (!currentPath || !files[currentPath]) return;
    const fileToDelete = files[currentPath];
    if (fileToDelete.type === 'folder') {
      setSimulatedDialog({
        isOpen: true,
        title: "OPERATION BLOCKED",
        message: "You cannot directly delete system folder nodes. Use direct terminal segments to purge folders.",
        type: 'warn'
      });
      return;
    }

    const pathParts = currentPath.split('/');
    const parentPath = pathParts.slice(0, pathParts.length - 1).join('/');

    setFiles(prev => {
      const updated = { ...prev };
      delete updated[currentPath];

      // Remove from parent's children array
      if (parentPath && updated[parentPath]) {
        updated[parentPath] = {
          ...updated[parentPath],
          children: updated[parentPath].children?.filter(childPath => childPath !== currentPath)
        };
      }
      return updated;
    });

    setSimulatedDialog({
      isOpen: true,
      title: "NODE SEGMENT PURGED",
      message: `The manuscript document "${fileToDelete.name}" has been successfully expunged from the local disk index. All bound memory vectors have been cleanly garbage collected.`,
      type: 'success'
    });

    // Clear current selection or select another file
    const parent = files[parentPath];
    const siblingPaths = parent?.children?.filter(childPath => childPath !== currentPath) || [];
    if (siblingPaths.length > 0) {
      const nextPath = siblingPaths[0];
      setCurrentPath(nextPath);
      setEditorText(files[nextPath]?.content || '');
    } else {
      setCurrentPath('');
      setEditorText('');
    }
  };

  const deleteEntireProject = () => {
    setFiles({});
    setCurrentPath('');
    setEditorText('');
    setProjectRoot('');
    setSimulatedDialog({
      isOpen: true,
      title: "SYSTEM COLD BOOT SUCCESSFUL",
      message: "The entire local project space has been purged. Elysium Writer is running on standby. Click [+] NEW PROJECT to initialize a clean slate.",
      type: 'info'
    });
  };

  const handleRenameFile = () => {
    if (!currentPath || !files[currentPath]) return;
    
    const cleanNewName = renameInput.trim();
    if (!cleanNewName) {
      setSimulatedDialog({
        isOpen: true,
        title: "INVALID NAME IDENTIFIER",
        message: "The node name identifier cannot be empty. Please specify a valid alphanumeric name.",
        type: 'warn'
      });
      return;
    }

    const pathParts = currentPath.split('/');
    const parentPath = pathParts.slice(0, pathParts.length - 1).join('/');
    const oldFileName = pathParts[pathParts.length - 1];
    
    // Detect extension of original file
    const dotIndex = oldFileName.lastIndexOf('.');
    const extension = dotIndex !== -1 ? oldFileName.substring(dotIndex + 1) : '';
    
    let targetFileName = cleanNewName;
    if (extension && !targetFileName.toLowerCase().endsWith(`.${extension.toLowerCase()}`)) {
      targetFileName += `.${extension}`;
    }

    const newPath = parentPath ? `${parentPath}/${targetFileName}` : targetFileName;

    if (newPath === currentPath) {
      setIsRenaming(false);
      return;
    }

    if (files[newPath]) {
      setSimulatedDialog({
        isOpen: true,
        title: "CONCORDANCE CONFLICT",
        message: `A node with identifier "${targetFileName}" already exists in the folder tree. Provide a unique node name.`,
        type: 'warn'
      });
      return;
    }

    setFiles(prev => {
      const updated = { ...prev };
      const originalFile = updated[currentPath];
      if (!originalFile) return prev;

      delete updated[currentPath];

      updated[newPath] = {
        ...originalFile,
        name: targetFileName,
        path: newPath
      };

      if (parentPath && updated[parentPath]) {
        updated[parentPath] = {
          ...updated[parentPath],
          children: updated[parentPath].children?.map(childPath => 
            childPath === currentPath ? newPath : childPath
          )
        };
      }

      return updated;
    });

    setCurrentPath(newPath);
    setIsRenaming(false);

    setSimulatedDialog({
      isOpen: true,
      title: "NODE REGISTERED SUCCESSFUL",
      message: `The node has been successfully renamed to "${targetFileName}". The text payload and associated sister PNG image bindings remain fully intact.`,
      type: 'success'
    });
  };

  // Render simulated procedural artwork on canvas
  const drawArtConcept = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsGeneratingArt(true);

    // Short simulated delay to make it feel like AI model processing
    setTimeout(() => {
      const w = canvas.width;
      const h = canvas.height;

      // Clear canvas
      ctx.clearRect(0, 0, w, h);

      // Create theme gradient
      let gradient = ctx.createLinearGradient(0, 0, 0, h);

      if (selectedTheme === 'cyber') {
        gradient.addColorStop(0, '#02040a');
        gradient.addColorStop(0.5, '#0c0f20');
        gradient.addColorStop(1, '#1b092a');
      } else if (selectedTheme === 'space') {
        gradient.addColorStop(0, '#02010c');
        gradient.addColorStop(0.6, '#06132b');
        gradient.addColorStop(1, '#0c224a');
      } else if (selectedTheme === 'noir') {
        gradient.addColorStop(0, '#0a0a0f');
        gradient.addColorStop(0.7, '#181b24');
        gradient.addColorStop(1, '#2c3140');
      } else if (selectedTheme === 'forest') {
        gradient.addColorStop(0, '#010c0a');
        gradient.addColorStop(0.5, '#05251d');
        gradient.addColorStop(1, '#143c30');
      } else { // rune
        gradient.addColorStop(0, '#0d0806');
        gradient.addColorStop(0.6, '#24120a');
        gradient.addColorStop(1, '#402113');
      }

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);

      // Draw horizontal neural line grids
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.1)';
      ctx.lineWidth = 1;
      for (let i = 0; i < h; i += 10) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(w, i);
        ctx.stroke();
      }

      // 1. Draw procedural stars/particles (high-tech light particles)
      ctx.fillStyle = 'rgba(0, 240, 255, 0.6)';
      for (let i = 0; i < 50; i++) {
        const x = Math.random() * w;
        const y = Math.random() * h;
        const size = Math.random() * 1.5 + 0.5;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2. Draw thematic elements
      if (selectedTheme === 'cyber') {
        // Neon grid lines
        ctx.strokeStyle = 'rgba(255, 0, 85, 0.2)';
        ctx.lineWidth = 1.5;
        const horizon = h * 0.6;
        
        // Horizontal lines
        for (let i = horizon; i < h; i += 15) {
          ctx.beginPath();
          ctx.moveTo(0, i);
          ctx.lineTo(w, i);
          ctx.stroke();
        }
        // Perspective lines
        for (let i = -w * 0.5; i < w * 1.5; i += 30) {
          ctx.beginPath();
          ctx.moveTo(w * 0.5, horizon);
          ctx.lineTo(i, h);
          ctx.stroke();
        }

        // Draw neon neon sphere
        const gradSphere = ctx.createRadialGradient(w*0.5, h*0.4, 5, w*0.5, h*0.4, 60);
        gradSphere.addColorStop(0, '#00f0ff');
        gradSphere.addColorStop(0.4, '#ff0055');
        gradSphere.addColorStop(1, 'transparent');
        ctx.fillStyle = gradSphere;
        ctx.beginPath();
        ctx.arc(w*0.5, h*0.4, 55, 0, Math.PI * 2);
        ctx.fill();

      } else if (selectedTheme === 'space') {
        // Glowing nebula clouds
        ctx.fillStyle = 'rgba(0, 240, 255, 0.15)';
        ctx.beginPath();
        ctx.arc(w * 0.3, h * 0.4, 80, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = 'rgba(255, 0, 150, 0.12)';
        ctx.beginPath();
        ctx.arc(w * 0.7, h * 0.5, 70, 0, Math.PI * 2);
        ctx.fill();

        // Planet
        const gradPlanet = ctx.createLinearGradient(w*0.4, h*0.3, w*0.7, h*0.6);
        gradPlanet.addColorStop(0, '#39ff14');
        gradPlanet.addColorStop(1, '#071b08');
        ctx.fillStyle = gradPlanet;
        ctx.beginPath();
        ctx.arc(w*0.5, h*0.45, 40, 0, Math.PI * 2);
        ctx.fill();

        // Planet ring
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
        ctx.lineWidth = 2;
        ctx.save();
        ctx.translate(w * 0.5, h * 0.45);
        ctx.rotate(-Math.PI / 10);
        ctx.scale(1.8, 0.15);
        ctx.beginPath();
        ctx.arc(0, 0, 45, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

      } else if (selectedTheme === 'noir') {
        // City skyline silhouette
        ctx.fillStyle = '#030508';
        ctx.fillRect(0, h * 0.55, w, h * 0.45);

        const buildingWidths = [35, 40, 30, 50, 45, 30, 55];
        let currentX = 0;
        ctx.fillStyle = '#060a12';
        for (const width of buildingWidths) {
          const height = 90 + Math.random() * 70;
          ctx.fillRect(currentX, h - height, width, height);
          
          // Draw tiny yellow/cyan windows
          ctx.fillStyle = Math.random() > 0.5 ? 'rgba(0, 240, 255, 0.5)' : 'rgba(255, 0, 85, 0.4)';
          for (let wx = currentX + 6; wx < currentX + width - 6; wx += 12) {
            for (let wy = h - height + 10; wy < h - 15; wy += 22) {
              if (Math.random() > 0.5) {
                ctx.fillRect(wx, wy, 3, 5);
              }
            }
          }
          ctx.fillStyle = '#060a12';
          currentX += width + 3;
        }

        // Searchlight beams
        ctx.fillStyle = 'rgba(0, 240, 255, 0.1)';
        ctx.beginPath();
        ctx.moveTo(w * 0.15, h);
        ctx.lineTo(w * 0.55, 0);
        ctx.lineTo(w * 0.7, 0);
        ctx.lineTo(w * 0.25, h);
        ctx.closePath();
        ctx.fill();

      } else if (selectedTheme === 'forest') {
        // Layered bio-glowing trees
        ctx.fillStyle = '#02120e';
        ctx.beginPath();
        ctx.moveTo(0, h);
        ctx.lineTo(0, h * 0.55);
        ctx.quadraticCurveTo(w * 0.3, h * 0.45, w * 0.6, h * 0.6);
        ctx.quadraticCurveTo(w * 0.8, h * 0.65, w, h * 0.5);
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fill();

        // Draw simple pine trees with glowing edges
        ctx.fillStyle = '#041d17';
        const drawTree = (tx: number, ty: number, scale: number) => {
          ctx.beginPath();
          ctx.moveTo(tx, ty);
          ctx.lineTo(tx - 12 * scale, ty + 35 * scale);
          ctx.lineTo(tx - 4 * scale, ty + 35 * scale);
          ctx.lineTo(tx - 18 * scale, ty + 70 * scale);
          ctx.lineTo(tx + 18 * scale, ty + 70 * scale);
          ctx.lineTo(tx + 4 * scale, ty + 35 * scale);
          ctx.lineTo(tx + 12 * scale, ty + 35 * scale);
          ctx.closePath();
          ctx.fill();

          // Glow core
          ctx.fillStyle = '#39ff14';
          ctx.beginPath();
          ctx.arc(tx, ty + 20, 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#041d17';
        };

        drawTree(w * 0.2, h * 0.52, 1.1);
        drawTree(w * 0.8, h * 0.56, 0.9);
        drawTree(w * 0.5, h * 0.6, 1.3);

      } else { // rune
        // Ancient circular stone pattern with neon laser lines
        ctx.strokeStyle = '#ff0055';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(w * 0.5, h * 0.45, 65, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
        ctx.beginPath();
        ctx.arc(w * 0.5, h * 0.45, 50, 0, Math.PI * 2);
        ctx.stroke();

        // Magic symbol inside
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        // Inner triangle
        ctx.moveTo(w * 0.5, h * 0.45 - 45);
        ctx.lineTo(w * 0.5 + 40, h * 0.45 + 20);
        ctx.lineTo(w * 0.5 - 40, h * 0.45 + 20);
        ctx.closePath();
        ctx.stroke();

        // Center glow core
        const gradCore = ctx.createRadialGradient(w*0.5, h*0.45, 2, w*0.5, h*0.45, 20);
        gradCore.addColorStop(0, '#00f0ff');
        gradCore.addColorStop(0.5, 'rgba(255, 0, 85, 0.3)');
        gradCore.addColorStop(1, 'transparent');
        ctx.fillStyle = gradCore;
        ctx.beginPath();
        ctx.arc(w*0.5, h*0.45, 20, 0, Math.PI * 2);
        ctx.fill();
      }

      // Add elegant geometric lines & title overlay on image
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(10, 10, w - 20, h - 20);

      // Label text on reference image
      ctx.fillStyle = '#00f0ff';
      ctx.font = '900 11px "Orbitron", "JetBrains Mono", sans-serif';
      ctx.textAlign = 'center';
      
      const cleanPrompt = artPrompt.trim() ? `"${artPrompt.substring(0, 18)}..."` : 'NEURAL ART COUPLING';
      ctx.fillText(cleanPrompt.toUpperCase(), w * 0.5, h - 25);

      ctx.fillStyle = 'rgba(0, 240, 255, 0.5)';
      ctx.font = 'bold 9px "Share Tech Mono", monospace';
      ctx.fillText(`STREAM_LINK: ${files[currentPath]?.name || 'UNKNOWN'}`, w * 0.5, h - 12);

      // Retrieve data URL and bind to current file
      const dataUrl = canvas.toDataURL();
      setFiles(prev => ({
        ...prev,
        [currentPath]: {
          ...prev[currentPath],
          image: dataUrl
        }
      }));

      setIsGeneratingArt(false);
      setIsImageModalOpen(false);
      setArtPrompt('');
    }, 1200);
  };

  // Trigger drawing of canvas when theme or prompt is chosen
  useEffect(() => {
    if (isImageModalOpen && canvasRef.current) {
      // Draw pre-selection or placeholder on modal opening
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#080d1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
        
        ctx.fillStyle = '#00f0ff';
        ctx.font = 'bold 11px "Share Tech Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('AWAITING RENDER SYSTEM ENGAGEMENT...', canvas.width * 0.5, canvas.height * 0.5);
      }
    }
  }, [isImageModalOpen]);

  // Upload an image file manually
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result && currentPath) {
          setFiles(prev => ({
            ...prev,
            [currentPath]: {
              ...prev[currentPath],
              image: event.target!.result as string
            }
          }));
          setIsImageModalOpen(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="min-h-screen bg-[#030611] text-slate-300 font-sans flex flex-col selection:bg-cyan-500/25 selection:text-cyan-300 cyber-grid relative overflow-hidden">
      
      {/* Ambient background glows for tech depth */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full bg-cyan-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-[500px] h-[500px] rounded-full bg-purple-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500/10 to-transparent pointer-events-none" />

      {/* HEADER SECTION */}
      <header className="border-b border-cyan-500/10 bg-[#040815]/75 backdrop-blur-lg px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 z-10 relative shadow-[0_4px_30px_rgba(0,240,255,0.02)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center relative shadow-[0_0_15px_rgba(0,240,255,0.2)]">
            <Cpu className="text-cyan-400 w-5 h-5 animate-pulse" />
            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#030611] shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display font-black text-lg tracking-wider text-white uppercase glow-cyan">Elysium Writer</h1>
              <span className="text-[9px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-mono px-2 py-0.5 rounded font-medium tracking-widest uppercase">COGNITIVE_TERMINAL_V1.2</span>
            </div>
            <p className="text-[10px] text-cyan-500 mt-0.5 font-mono tracking-tight uppercase">CRYPTO-SECURED STANDALONE NOVEL COGNITION ENGINE</p>
          </div>
        </div>

        {/* WORKBENCH NAV TABS */}
        <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 bg-[#070c1e]/85 backdrop-blur-md p-1.5 rounded-lg border border-cyan-950/60 shadow-inner">
          <button 
            id="nav-tab-simulator"
            onClick={() => setActiveTab('simulator')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-mono tracking-wider uppercase font-semibold transition-all cursor-pointer ${
              activeTab === 'simulator' 
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/50 shadow-[0_0_15px_rgba(0,240,255,0.25)]' 
                : 'text-slate-500 hover:text-cyan-400/80 hover:bg-cyan-500/5'
            }`}
          >
            <Terminal className="w-4 h-4" />
            SIMULATOR_CORE
          </button>

          <button
            id="nav-tab-code"
            onClick={() => setActiveTab('code')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-mono tracking-wider uppercase font-semibold transition-all cursor-pointer ${
              activeTab === 'code'
                ? 'bg-purple-500/10 text-purple-400 border border-purple-500/50 shadow-[0_0_15px_rgba(139,92,246,0.25)]'
                : 'text-slate-500 hover:text-purple-400/80 hover:bg-purple-500/5'
            }`}
          >
            <Code2 className="w-4 h-4" />
            PYSIDE2_SCRIPT
          </button>

          <button
            id="nav-tab-docs"
            onClick={() => setActiveTab('docs')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-mono tracking-wider uppercase font-semibold transition-all cursor-pointer ${
              activeTab === 'docs'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.25)]'
                : 'text-slate-500 hover:text-emerald-400/80 hover:bg-emerald-500/5'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            USER_GUIDE
          </button>
        </div>

        {/* Desktop-only Settings button (API key). Hidden in web mode. */}
        {isDesktop && (
          <button
            onClick={() => window.elysium?.openSettings()}
            title="Settings — configure Gemini API key"
            className="flex items-center gap-2 px-3 py-2 rounded-md text-xs font-mono tracking-wider uppercase font-semibold transition-all cursor-pointer text-slate-400 hover:text-cyan-400 bg-[#070c1e] hover:bg-cyan-500/10 border border-cyan-950/60 hover:border-cyan-500/40"
          >
            {hasApiKey ? (
              <SettingsIcon className="w-4 h-4" />
            ) : (
              <KeyRound className="w-4 h-4 text-amber-400 animate-pulse" />
            )}
            {hasApiKey ? 'SETTINGS' : 'SET KEY'}
          </button>
        )}
        </div>
      </header>

      {/* WORKSPACE AREA */}
      <main className="flex-1 flex flex-col p-4 md:p-6 max-w-7xl w-full mx-auto gap-4 z-10 relative">

        {/* TAB 1: DESKTOP SIMULATOR */}
        {activeTab === 'simulator' && (
          <div className="flex-1 flex flex-col gap-4 animate-fade-in">
            
            {/* Simulation Header Notice */}
            <div className="glass-panel glow-border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-[#60a5fa] shadow-lg shadow-cyan-500/5 gap-3 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-cyan-400 shadow-[0_0_8px_#00f0ff]" />
              <div className="flex items-start sm:items-center gap-2.5">
                <Info className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5 sm:mt-0" />
                <span className="font-mono text-cyan-300">
                  <strong className="font-semibold text-white tracking-wide uppercase">STANDALONE DECK CONNECTED:</strong> Replicating high-fidelity PySide2 on-disk novel system. Local safety sandbox active.
                </span>
              </div>
              <button 
                onClick={() => {
                  setSimulatedDialog({
                    isOpen: true,
                    title: "SYSTEM DIAGNOSTICS LOG",
                    message: `PROJECT DIRECTORY: ~/Elysium_Novel_Project\n\nActive Nodes & Records:\n- Draft Manuscript: 100 chapters allocated (Chapter_001 to Chapter_100)\n- Character Profiles: Characters.txt (3 records loaded)\n- World Rules: World_Rules.txt (3 core laws)\n\nEnvironment status: Clean. Memory buffers stable. Local auto-save daemon running on loop.`,
                    type: 'info'
                  });
                }}
                className="text-cyan-400 font-bold hover:underline text-xs whitespace-nowrap self-start sm:self-center bg-cyan-500/10 hover:bg-cyan-500/20 px-3 py-1.5 rounded-lg border border-cyan-500/30 transition-colors font-mono uppercase tracking-wider"
              >
                RUN_DIAGNOSTICS
              </button>
            </div>

            {/* Dynamic Visual Banner Feed - Cyberpunk Hologram HUD */}
            <div className="h-44 rounded-2xl overflow-hidden relative border border-cyan-950/60 group shadow-[0_4px_25px_rgba(0,0,0,0.4)]">
              <img 
                src="https://images.unsplash.com/photo-1563089145-599997674d42?auto=format&fit=crop&w=1200&q=80" 
                alt="Futuristic Neon Matrix Feed" 
                className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700 brightness-75"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#040813] via-[#040813]/40 to-transparent" />
              
              {/* Cyberpunk HUD overlay metrics */}
              <div className="absolute top-4 left-4 flex items-center gap-2 bg-[#030611]/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-cyan-500/30 text-[10px] font-mono text-cyan-400 uppercase tracking-wider shadow-sm">
                <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                <span>Elysium Mainframe Connection Live</span>
              </div>

              <div className="absolute top-4 right-4 flex items-center gap-3">
                <span className="text-[10px] font-mono bg-[#030611]/80 backdrop-blur-md px-2.5 py-1 rounded-md text-[#39ff14] border border-[#39ff14]/30 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#39ff14] animate-pulse"></span>
                  CPU_NODE: ACTIVE
                </span>
                <span className="text-[10px] font-mono bg-[#030611]/80 backdrop-blur-md px-2.5 py-1 rounded-md text-cyan-400 border border-cyan-500/30">
                  TEMP: 32.4°C
                </span>
              </div>

              <div className="absolute bottom-4 left-6">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-display font-black text-white uppercase tracking-widest glow-cyan">COGNITIVE HUB VISUAL FEED</h2>
                  <span className="text-[9px] text-cyan-400 font-mono border border-cyan-500/30 px-1.5 py-0.2 rounded bg-cyan-500/5">SYS_04_LINKED</span>
                </div>
                <p className="text-xs text-[#a5c6f2] mt-1 font-mono">Neural manuscript node rendering online. Cybernetic database auto-save sync active.</p>
              </div>
            </div>

            {/* MOCK OS WINDOW CONTAINER */}
            <div className="glass-panel-heavy glow-border rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[700px] relative transition-all duration-300">
              
              {/* Corner brackets for high tech styling */}
              <div className="corner-bracket-tl" />
              <div className="corner-bracket-tr" />
              <div className="corner-bracket-bl" />
              <div className="corner-bracket-br" />

              {/* OS Window Top Bar */}
              <div className="bg-[#080f22] px-4 py-3 flex items-center justify-between border-b border-cyan-950/60">
                {/* Simulated Window Actions */}
                <div className="flex items-center gap-2">
                  <button 
                    onClick={triggerCloseEvent}
                    className="w-3.5 h-3.5 rounded-full bg-[#ff5f56]/85 flex items-center justify-center hover:opacity-100 text-[8px] text-black font-bold font-sans group relative cursor-pointer border border-[#ff5f56]"
                    title="Close Application"
                  >
                    <span className="hidden group-hover:block absolute">×</span>
                  </button>
                  <button 
                    onClick={() => {
                      setSimulatedDialog({
                        isOpen: true,
                        title: "CONSOLE MINIMIZED",
                        message: "The Elysium Writer window has been minimized to your system dock.",
                        type: 'info'
                      });
                    }}
                    className="w-3.5 h-3.5 rounded-full bg-[#ffbd2e]/85 flex items-center justify-center hover:opacity-100 text-[8px] text-black font-bold font-sans group relative cursor-pointer border border-[#ffbd2e]"
                  >
                    <span className="hidden group-hover:block absolute">-</span>
                  </button>
                  <button 
                    onClick={() => {
                      setSimulatedDialog({
                        isOpen: true,
                        title: "CONSOLE VIEWPORT LOCKED",
                        message: "The window layout has been optimized at the default 1100x750 viewport size.",
                        type: 'info'
                      });
                    }}
                    className="w-3.5 h-3.5 rounded-full bg-[#27c93f]/85 flex items-center justify-center hover:opacity-100 text-[8px] text-black font-bold font-sans group relative cursor-pointer border border-[#27c93f]"
                  >
                    <span className="hidden group-hover:block absolute">+</span>
                  </button>
                </div>
                
                {/* Simulated Window Title */}
                <div className="text-xs text-cyan-100 font-mono select-none tracking-wider flex items-center gap-2 uppercase">
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  <span>ELYSIUM_WRITER_STATION - MANUSCRIPT_WELL</span>
                </div>
                
                {/* Window Metadata spacer */}
                <div className="text-[9px] font-mono text-cyan-400 bg-cyan-950/40 border border-cyan-500/30 px-2.5 py-0.5 rounded-md tracking-widest">
                  LOCAL_DRIVE_LINKED // 3000.E_NP
                </div>
              </div>

              {/* MOCK SPLITTER WINDOW BODY */}
              <div className="flex-1 flex overflow-hidden">
                
                {/* 1. LEFT PANEL: Tree Navigation (Manuscript & Notes Manager) */}
                <div className={`transition-all duration-300 ${isLeftCollapsed ? 'w-0 overflow-hidden opacity-0 border-r-0' : 'w-[280px]'} glass-panel border-r border-cyan-950/40 flex flex-col select-none relative shrink-0`}>
                  
                  {/* Panel Header */}
                  <div className="p-3 border-b border-cyan-950/60 bg-[#060c1d] flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold tracking-widest text-cyan-500 uppercase">PROJECT OUTLINE</span>
                    <span className="text-[9px] font-mono text-[#4f7cb8]">NODES</span>
                  </div>

                  {/* Cybernetic Project Controls */}
                  <div className="p-2 bg-[#050a16]/40 border-b border-cyan-950/60 grid grid-cols-3 gap-1">
                    <button
                      id="new-project-btn"
                      onClick={() => {
                        // Reset wizard states
                        setWizardStep('cover');
                        setIsNewProjectModalOpen(true);
                      }}
                      className="text-[8px] py-1.5 bg-cyan-950/30 hover:bg-cyan-500/20 text-cyan-400 hover:text-cyan-200 border border-cyan-950 hover:border-cyan-500/50 rounded-lg flex flex-col items-center justify-center gap-1 transition-all font-mono font-bold uppercase tracking-wider cursor-pointer"
                      title="Create a new long-form novel project structure"
                    >
                      <FolderPlus className="w-3.5 h-3.5 text-cyan-500" />
                      NEW
                    </button>

                    <button
                      id="end-novel-btn"
                      disabled={!projectRoot}
                      onClick={() => {
                        setIsEndNovelModalOpen(true);
                        setEndNovelStep('input');
                        // Prepopulate from current story cover details
                        setBackBlurb(`In the high-altitude canopy of this realm, where corporate mainframes dictating environmental shield codes are failing, ${coverAuthor}'s gripping tale centers on ${coverTitle}.\n\nWhen a forbidden encrypted archive is recovered from Sector 4, a team of outcasts must decipher the terminal protocols before the final cycle collapses. Will they find the key, or will they be erased forever?`);
                      }}
                      className={`text-[8px] py-1.5 rounded-lg flex flex-col items-center justify-center gap-1 transition-all font-mono font-bold uppercase tracking-wider cursor-pointer border ${
                        projectRoot 
                          ? 'bg-emerald-950/25 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-200 border-emerald-950/40 hover:border-emerald-500/50 shadow-[0_0_8px_rgba(16,185,129,0.1)]' 
                          : 'bg-slate-900/40 text-slate-600 border-slate-950 cursor-not-allowed opacity-50'
                      }`}
                      title="Finish your novel and synthesize a Back Cover with QR code!"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                      END NOVEL
                    </button>
                    
                    <button
                      id="delete-story-btn"
                      disabled={!projectRoot}
                      onClick={() => {
                        setSimulatedDialog({
                          isOpen: true,
                          title: "PURGE ACTIVE MANUSCRIPT?",
                          message: "CRITICAL ALERT: This action will completely erase your active draft manuscript and the entire project structure. Do you wish to enter cold boot standby mode?",
                          type: "confirm-delete-project"
                        });
                      }}
                      className={`text-[8px] py-1.5 rounded-lg flex flex-col items-center justify-center gap-1 transition-all font-mono font-bold uppercase tracking-wider cursor-pointer border ${
                        projectRoot 
                          ? 'bg-rose-950/20 hover:bg-rose-500/20 text-rose-400 hover:text-rose-200 border-rose-950/40 hover:border-rose-500/50' 
                          : 'bg-slate-900/40 text-slate-600 border-slate-950 cursor-not-allowed opacity-50'
                      }`}
                      title="Completely delete or wipe the active story project"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                      DELETE
                    </button>
                  </div>

                  {/* Search filter in tree */}
                  <div className="p-2.5 border-b border-cyan-950/60">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-cyan-600 absolute left-3 top-2.5" />
                      <input 
                        type="text" 
                        placeholder="Filter index..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-[#060b18] border border-cyan-950 text-xs font-mono text-cyan-100 placeholder-cyan-800 rounded-lg px-2.5 py-1.5 pl-8 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50"
                      />
                    </div>
                  </div>

                  {/* Root directory tree scrollable container */}
                  <div className="flex-1 overflow-y-auto p-2 font-mono text-xs space-y-1">
                    
                    {projectRoot ? (
                      <>
                        {/* ROOT: Dynamic projectRoot */}
                        <div className="flex items-center gap-1.5 py-1.5 text-white">
                          <ChevronDown className="w-3.5 h-3.5 text-cyan-500" />
                          <Folder className="w-4 h-4 text-cyan-400 fill-cyan-950/30" />
                          <span className="font-semibold text-xs tracking-wide text-white uppercase">{projectRoot.replace(/_/g, ' ')}</span>
                        </div>

                        {/* SUB-FOLDER: 1. Manuscript */}
                        <div className="pl-3">
                          <div 
                            onClick={() => selectFile(`${projectRoot}/1. Manuscript`)}
                            className="flex items-center gap-1.5 py-1 hover:bg-cyan-950/20 rounded cursor-pointer transition-colors"
                          >
                            {expandedFolders[`${projectRoot}/1. Manuscript`] ? (
                              <ChevronDown className="w-3.5 h-3.5 text-cyan-500" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-cyan-500" />
                            )}
                            <Folder className="w-4 h-4 text-cyan-500/80 fill-cyan-950/20" />
                            <span className="text-cyan-300 font-medium tracking-wide">Manuscript</span>
                          </div>

                          {/* CHAPTER FILES IN 1. MANUSCRIPT */}
                          {expandedFolders[`${projectRoot}/1. Manuscript`] && (
                            <div className="pl-4 border-l border-cyan-950 ml-2.5 mt-1 space-y-0.5 max-h-[300px] overflow-y-auto">
                              {files[`${projectRoot}/1. Manuscript`]?.children
                                ?.filter(path => {
                                  const name = files[path]?.name || '';
                                  return name.toLowerCase().includes(searchQuery.toLowerCase());
                                })
                                .map(path => {
                                  const file = files[path];
                                  const isActive = currentPath === path;
                                  const words = countWords(file?.content || '');
                                  const hasArt = !!file?.image;

                                  return (
                                    <div 
                                      key={path}
                                      onClick={() => selectFile(path)}
                                      className={`flex items-center justify-between group px-2 py-1.5 rounded cursor-pointer transition-all ${
                                        isActive 
                                          ? 'bg-cyan-500/10 text-cyan-300 font-semibold border-l-2 border-cyan-400 pl-2.5 shadow-[0_0_8px_rgba(0,240,255,0.05)]' 
                                          : 'text-slate-400 hover:bg-cyan-950/20 hover:text-cyan-300'
                                      }`}
                                    >
                                      <div className="flex items-center gap-1.5 truncate">
                                        <FileText className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                                        <span className="truncate text-[11px] tracking-wide">{file?.name}</span>
                                      </div>
                                      <div className="flex items-center gap-1.5 flex-shrink-0">
                                        {hasArt && (
                                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" title="Reference Image Bound"></span>
                                        )}
                                        <span className={`text-[10px] font-mono group-hover:hidden ${words >= 1500 ? 'text-emerald-400 font-bold' : 'text-cyan-600'}`}>
                                          {words}w
                                        </span>
                                        <button
                                          id={`delete-node-${file?.name}`}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setCurrentPath(path);
                                            setSimulatedDialog({
                                              isOpen: true,
                                              title: "DELETE MANUSCRIPT SEGMENT?",
                                              message: `Are you absolutely sure you want to permanently erase the manuscript file "${file?.name}" and its associated state bindings?`,
                                              type: "confirm-delete-active"
                                            });
                                          }}
                                          className="hidden group-hover:flex items-center justify-center p-0.5 text-rose-500 hover:text-rose-400 hover:bg-rose-950/30 rounded cursor-pointer transition-all"
                                          title={`Delete ${file?.name}`}
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })
                              }
                            </div>
                          )}
                        </div>

                        {/* SUB-FOLDER: 2. Character & World Notes */}
                        <div className="pl-3 mt-2">
                          <div 
                            onClick={() => selectFile(`${projectRoot}/2. Character & World Notes`)}
                            className="flex items-center gap-1.5 py-1 hover:bg-cyan-950/20 rounded cursor-pointer transition-colors"
                          >
                            {expandedFolders[`${projectRoot}/2. Character & World Notes`] ? (
                              <ChevronDown className="w-3.5 h-3.5 text-cyan-500" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-cyan-500" />
                            )}
                            <Folder className="w-4 h-4 text-cyan-500/80 fill-cyan-950/20" />
                            <span className="text-cyan-300 font-medium tracking-wide">Characters & Notes</span>
                          </div>

                          {/* NOTE FILES */}
                          {expandedFolders[`${projectRoot}/2. Character & World Notes`] && (
                            <div className="pl-4 border-l border-cyan-950 ml-2.5 mt-1 space-y-0.5">
                              {files[`${projectRoot}/2. Character & World Notes`]?.children?.map(path => {
                                const file = files[path];
                                const isActive = currentPath === path;
                                return (
                                  <div 
                                    key={path}
                                    onClick={() => selectFile(path)}
                                    className={`flex items-center justify-between group px-2 py-1.5 rounded cursor-pointer transition-all ${
                                      isActive 
                                        ? 'bg-cyan-500/10 text-cyan-300 font-semibold border-l-2 border-cyan-400 pl-2.5' 
                                        : 'text-slate-400 hover:bg-cyan-950/20 hover:text-cyan-300'
                                    }`}
                                  >
                                    <div className="flex items-center gap-1.5 truncate">
                                      <FileCode className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                                      <span className="truncate text-[11px] tracking-wide">{file?.name}</span>
                                    </div>
                                    <button
                                      id={`delete-note-${file?.name}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setCurrentPath(path);
                                        setSimulatedDialog({
                                          isOpen: true,
                                          title: "DELETE NOTE RECORD?",
                                          message: `Are you absolutely sure you want to permanently erase the note record "${file?.name}"?`,
                                          type: "confirm-delete-active"
                                        });
                                      }}
                                      className="hidden group-hover:flex items-center justify-center p-0.5 text-rose-500 hover:text-rose-400 hover:bg-rose-950/30 rounded cursor-pointer transition-all animate-fade-in"
                                      title={`Delete ${file?.name}`}
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="py-12 px-4 text-center text-slate-500 flex flex-col items-center justify-center h-full">
                        <FolderPlus className="w-8 h-8 text-cyan-950/60 mb-3 animate-pulse" />
                        <span className="text-[10px] uppercase tracking-widest text-cyan-500 font-bold block mb-1.5">No Active Project</span>
                        <p className="text-[9px] text-slate-500 leading-relaxed max-w-[200px]">
                          Initialize a new cyber-manuscript database by clicking the <span className="text-cyan-400 font-bold font-mono">NEW PROJECT</span> button above.
                        </p>
                      </div>
                    )}

                  </div>

                  {/* Left panel footer */}
                  <div className="p-3 bg-[#060c1d] border-t border-cyan-950/60 text-[9px] font-mono text-cyan-600 tracking-widest uppercase">
                    FILE_TREE_EXPLORER
                  </div>
                </div>

                {/* 2. CENTER PANEL: QTextEdit Text Editor & Live word tracker */}
                <div className="flex-1 bg-[#050a16]/35 backdrop-blur-sm flex flex-col relative border-r border-l border-cyan-950/20">
                  
                  {/* Editor File Bar */}
                  <div className="bg-[#080f22] px-6 py-2.5 border-b border-cyan-950/60 flex items-center justify-between z-10 relative">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setIsLeftCollapsed(!isLeftCollapsed)}
                        className="p-1.5 rounded bg-cyan-950/30 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 border border-cyan-950 hover:border-cyan-500/30 transition-all cursor-pointer flex items-center justify-center"
                        title={isLeftCollapsed ? "Expand Project Outline" : "Collapse Project Outline"}
                      >
                        {isLeftCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5 rotate-180 transition-transform" />}
                      </button>
                      <FileText className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs text-cyan-300 font-mono tracking-wider uppercase">{currentPath || 'NO_DOCUMENT_OPENED'}</span>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {currentPath && (
                        <button
                          id="export-pdf-btn"
                          onClick={exportToPDF}
                          className="bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-bold text-xs px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-[0_0_12px_rgba(0,240,255,0.25)]"
                          title="Export Current Chapter as Formatted PDF"
                        >
                          <Download className="w-3.5 h-3.5" />
                          EXPORT_PDF
                        </button>
                      )}
                      <div className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 px-2.5 py-1 rounded-md flex items-center gap-1.5 border border-emerald-500/30 tracking-wider">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        AUTO_SAVE: OK
                      </div>
                      <button 
                        onClick={() => setIsRightCollapsed(!isRightCollapsed)}
                        className="p-1.5 rounded bg-cyan-950/30 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 border border-cyan-950 hover:border-cyan-500/30 transition-all cursor-pointer flex items-center justify-center"
                        title={isRightCollapsed ? "Expand Interactive Deck" : "Collapse Interactive Deck"}
                      >
                        {isRightCollapsed ? <ChevronRight className="w-3.5 h-3.5 rotate-180 transition-transform" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Rich Text Editor Simulation */}
                  <div className="flex-1 flex flex-col p-6 overflow-y-auto bg-[#040813]/25 relative">
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(0,240,255,0.015)_1px,transparent_1px)] bg-[size:100%_24px] pointer-events-none" />
                    
                    {currentPath ? (
                      <div className="max-w-2xl w-full mx-auto p-8 bg-[#02040a]/65 backdrop-blur-md border border-cyan-500/10 hover:border-cyan-500/25 rounded-2xl shadow-2xl shadow-cyan-500/5 hover:shadow-cyan-500/10 flex-1 flex flex-col min-h-[400px] relative transition-all duration-500">
                        {/* Corner Brackets inside Editor card */}
                        <div className="corner-bracket-tl" />
                        <div className="corner-bracket-tr" />
                        <div className="corner-bracket-bl" />
                        <div className="corner-bracket-br" />

                        <textarea
                          id="editor-textarea"
                          value={editorText}
                          onChange={handleEditorChange}
                          style={{ lineHeight: '1.8' }}
                          className="flex-1 bg-transparent text-[#93c5fd] font-serif-editor text-sm resize-none focus:outline-none placeholder-cyan-950/70 w-full scrollbar-thin font-mono"
                          placeholder="Initialize writing draft node..."
                        />
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-center p-8">
                        <PenTool className="w-12 h-12 text-cyan-950 mb-3 animate-pulse" />
                        <p className="text-sm font-mono font-bold tracking-widest text-cyan-400 uppercase">SELECT NODE TO START MANUSCRIPT ENCODER</p>
                        <p className="text-xs text-slate-500 mt-2 font-mono">Select any file slot inside the outline navigation deck.</p>
                      </div>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="h-px bg-cyan-950/60" />

                  {/* Live Word Count Label tracker */}
                  <div className="px-6 py-3.5 bg-[#080f22] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold tracking-widest text-cyan-500 uppercase">CORE GOALS TRACKER:</span>
                      <span 
                        id="live-word-count"
                        className={`text-xs font-semibold font-mono tracking-wider transition-colors ${
                          reachedTarget ? 'text-emerald-400 glow-emerald' : 'text-cyan-400'
                        }`}
                      >
                        {wordCount.toLocaleString()} / 1,500 WORDS ({wordPercentage}%)
                      </span>
                    </div>

                    {/* Progress indicator */}
                    <div className="flex items-center gap-3 self-end sm:self-center">
                      <div className="w-36 bg-[#030611] border border-cyan-950/80 h-2.5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-300 ${
                            reachedTarget 
                              ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]' 
                              : 'bg-cyan-500 shadow-[0_0_8px_#00f0ff]'
                          }`}
                          style={{ width: `${Math.min(wordPercentage, 100)}%` }}
                        ></div>
                      </div>
                      <span className={`text-[9px] font-mono font-bold tracking-widest px-2 py-0.5 rounded-md border ${
                        reachedTarget 
                          ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30' 
                          : 'bg-cyan-950/40 text-cyan-400 border-cyan-500/30'
                      }`}>
                        {reachedTarget ? 'TARGET_REACHED' : 'IN_PROGRESS'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. RIGHT PANEL: Multi-subsystem Interactive Deck (Width: 340px) */}
                <div className={`transition-all duration-300 ${isRightCollapsed ? 'w-0 overflow-hidden opacity-0 border-l-0 p-0' : 'w-[340px] p-4'} glass-panel border-l border-cyan-950/40 flex flex-col select-none relative overflow-y-auto scrollbar-thin shrink-0`}>
                  
                  {/* Subsystem Navigation Tabs */}
                  <div className="grid grid-cols-4 gap-1 p-1 bg-[#02040a] border border-cyan-950/80 rounded-lg mb-3 shrink-0">
                    <button 
                      onClick={() => setRightTab('illustration')}
                      className={`py-1.5 rounded flex justify-center items-center transition-all cursor-pointer ${
                        rightTab === 'illustration' 
                          ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/35 shadow-sm' 
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                      title="Chapter Illustration"
                    >
                      <ImageIcon className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => setRightTab('codex')}
                      className={`py-1.5 rounded flex justify-center items-center transition-all cursor-pointer ${
                        rightTab === 'codex' 
                          ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/35 shadow-sm' 
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                      title="World Codex Wiki"
                    >
                      <Shield className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => setRightTab('copilot')}
                      className={`py-1.5 rounded flex justify-center items-center transition-all cursor-pointer ${
                        rightTab === 'copilot' 
                          ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/35 shadow-sm' 
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                      title="AI Copilot Assistant"
                    >
                      <Zap className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => setRightTab('telemetry')}
                      className={`py-1.5 rounded flex justify-center items-center transition-all cursor-pointer ${
                        rightTab === 'telemetry' 
                          ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/35 shadow-sm' 
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                      title="Analytics & Tension Telemetry"
                    >
                      <Activity className="w-4 h-4" />
                    </button>
                  </div>

                  {/* TAB 1: ILLUSTRATION VIEW (ORIGINAL CONTENT) */}
                  {rightTab === 'illustration' && (
                    <div className="flex-grow flex flex-col animate-fade-in">
                      <div className="pb-3 border-b border-cyan-950/60 mb-4 flex items-center justify-between">
                        <span className="text-[10px] font-mono font-bold tracking-widest text-cyan-500 uppercase">CHAPTER ILLUSTRATION</span>
                        <span className="text-[9px] font-mono text-cyan-600">INSPECT</span>
                      </div>

                      <p className="text-[11px] text-slate-400 mb-4 leading-relaxed font-mono">
                        Map a custom neural art or on-disk reference graphic cleanly into this chapter node.
                      </p>

                      <div 
                        id="ai-art-slot"
                        onClick={() => {
                          if (!currentPath) {
                            setSimulatedDialog({
                              isOpen: true,
                              title: "TERMINAL CONTEXT EXCEPTION",
                              message: "Identify an active chapter manuscript first before launching the neural visual synthesizer.",
                              type: 'warn'
                            });
                            return;
                          }
                          setIsImageModalOpen(true);
                        }}
                        className={`h-[200px] rounded-xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center p-4 text-center cursor-pointer relative overflow-hidden group ${
                          files[currentPath]?.image 
                            ? 'border-cyan-500/40 bg-[#061026] shadow-[0_0_15px_rgba(0,240,255,0.1)]' 
                            : 'border-[#142e5d] bg-[#050a16] hover:border-cyan-500/50 hover:bg-[#07112a]'
                        }`}
                      >
                        {files[currentPath]?.image ? (
                          <>
                            <img 
                              src={files[currentPath].image} 
                              alt="Inspiration reference"
                              className="w-full h-full object-contain rounded border border-cyan-500/20"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute inset-0 bg-[#030712]/90 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity p-4">
                              <Sparkles className="w-5 h-5 text-cyan-400 mb-1.5 animate-pulse" />
                              <span className="text-xs font-mono font-semibold text-white uppercase tracking-wider">CHANGE ART REF</span>
                              <p className="text-[10px] text-[#4f7cb8] mt-1 font-mono">{files[currentPath]?.name}</p>
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col items-center text-slate-400 group-hover:text-slate-300 transition-colors p-2 relative w-full h-full justify-center">
                            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,240,255,0.06),transparent_80%)] pointer-events-none" />
                            <ImageIcon className="w-8 h-8 mb-2.5 text-cyan-500/30 group-hover:text-cyan-500/60 transition-colors" />
                            <span className="text-xs font-mono font-bold text-cyan-400 tracking-widest uppercase glow-cyan">[ LINK_NEURAL_ART ]</span>
                            <span className="text-[9px] text-cyan-600 mt-2 leading-relaxed font-mono">Click to launch visual synthesizer interface</span>
                          </div>
                        )}
                      </div>

                      {currentPath && files[currentPath]?.image && (
                        <button
                          id="remove-art-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFiles(prev => ({
                              ...prev,
                              [currentPath]: {
                                ...prev[currentPath],
                                image: undefined
                              }
                            }));
                            setSimulatedDialog({
                              isOpen: true,
                              title: "NEURAL BINDING TERMINATED",
                              message: `The visual artwork bound to chapter node "${files[currentPath]?.name}" has been successfully removed.`,
                              type: "success"
                            });
                          }}
                          className="mt-3 w-full bg-rose-950/20 hover:bg-rose-900/30 text-rose-400 border border-rose-900/40 hover:border-rose-500/50 text-[10px] py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer font-mono tracking-wider uppercase"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                          REMOVE_ILLUSTRATION
                        </button>
                      )}

                      {currentPath && (
                        <div className="mt-4 bg-[#050a16] border border-cyan-950 p-3.5 rounded-xl shadow-inner relative">
                          <div className="flex items-center gap-2 text-[10px] font-mono font-bold text-cyan-500 uppercase tracking-widest">
                            <Info className="w-4 h-4 text-cyan-500/80" />
                            <span>BOUND NODE METRICS</span>
                          </div>

                          {!isRenaming ? (
                            <div className="mt-2.5 space-y-1.5 text-[11px] font-mono text-slate-400">
                              <div className="flex justify-between border-b border-cyan-950/60 pb-1">
                                  <span>Chapter:</span>
                                  <span className="text-cyan-300 truncate max-w-[150px] font-bold">{files[currentPath]?.name}</span>
                              </div>
                              <div className="flex justify-between">
                                  <span>Sister PNG:</span>
                                  <span className="text-emerald-400 truncate max-w-[150px]">
                                    {files[currentPath]?.name ? files[currentPath].name.replace('.txt', '.png') : 'None'}
                                  </span>
                              </div>
                              <button
                                id="rename-file-btn"
                                onClick={() => {
                                  setRenameInput(files[currentPath]?.name ? files[currentPath].name.replace(/\.[^/.]+$/, "") : '');
                                  setIsRenaming(true);
                                }}
                                className="w-full bg-cyan-950/30 hover:bg-cyan-950/60 border border-cyan-950 hover:border-cyan-500/40 text-[10px] py-1.5 px-2 mt-2 rounded flex items-center justify-center gap-1.5 text-cyan-400 hover:text-cyan-300 transition-all font-mono uppercase tracking-wider cursor-pointer"
                              >
                                <Edit className="w-3.5 h-3.5 text-cyan-500" />
                                RENAME NODE
                              </button>
                            </div>
                          ) : (
                            <div className="mt-2.5 space-y-2 text-[11px] font-mono text-slate-400">
                              <div className="space-y-1">
                                <label className="text-[9px] font-bold text-cyan-600 uppercase tracking-wider">New Identifier Name</label>
                                <input
                                  type="text"
                                  value={renameInput}
                                  onChange={(e) => setRenameInput(e.target.value)}
                                  placeholder="e.g., Chapter_New_Name"
                                  className="w-full bg-[#02040a] border border-cyan-500/30 text-[11px] text-cyan-200 rounded px-2 py-1 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500/30 font-mono"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleRenameFile();
                                    if (e.key === 'Escape') setIsRenaming(false);
                                  }}
                                />
                              </div>
                              <div className="flex gap-1.5">
                                <button
                                  onClick={handleRenameFile}
                                  className="flex-1 bg-cyan-500 hover:bg-cyan-400 text-black text-[10px] font-bold py-1 px-2 rounded flex items-center justify-center gap-1 transition-all cursor-pointer"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  SAVE
                                </button>
                                <button
                                  onClick={() => setIsRenaming(false)}
                                  className="flex-1 bg-cyan-950/40 hover:bg-cyan-950/70 text-cyan-500 text-[10px] font-bold py-1 px-2 rounded border border-cyan-950 flex items-center justify-center gap-1 transition-all cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                  CANCEL
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 2: WORLD CODEX WIKI VIEW */}
                  {rightTab === 'codex' && (
                    <div className="flex-grow flex flex-col animate-fade-in text-xs font-mono">
                      
                      {/* Codex Sub Navigation */}
                      <div className="flex gap-1 bg-[#02040a] p-1 border border-cyan-950 rounded-lg mb-3 shrink-0">
                        <button 
                          onClick={() => { setCodexTabSub('characters'); setIsAddingCharacter(false); setIsEditingCharacter(null); }}
                          className={`flex-1 py-1 text-[10px] font-bold rounded transition-colors cursor-pointer ${codexTabSub === 'characters' ? 'text-cyan-400 bg-cyan-950/40 border border-cyan-800/30' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                          CHARACTERS
                        </button>
                        <button 
                          onClick={() => { setCodexTabSub('rules'); setIsAddingRule(false); setSelectedRuleToEdit(null); }}
                          className={`flex-1 py-1 text-[10px] font-bold rounded transition-colors cursor-pointer ${codexTabSub === 'rules' ? 'text-cyan-400 bg-cyan-950/40 border border-cyan-800/30' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                          WORLD LAW
                        </button>
                      </div>

                      {/* CHARACTERS MODULE */}
                      {codexTabSub === 'characters' && (
                        <div className="flex-grow flex flex-col gap-3">
                          {isAddingCharacter || isEditingCharacter ? (
                            /* Add/Edit Character Form */
                            <div className="space-y-3 bg-[#050a16] border border-cyan-950/80 p-3.5 rounded-xl text-slate-300 animate-fade-in relative shrink-0">
                              <div className="corner-bracket-tl" />
                              <div className="font-bold text-[10px] text-cyan-400 border-b border-cyan-950 pb-1.5 uppercase tracking-wider">
                                {isAddingCharacter ? 'Add Codex Entity' : `Edit Entity: ${isEditingCharacter?.name}`}
                              </div>
                              
                              <div className="space-y-1">
                                <label className="text-[9px] text-cyan-600 font-bold block uppercase">Name</label>
                                <input 
                                  type="text" 
                                  value={newCharacterName} 
                                  onChange={(e) => setNewCharacterName(e.target.value)} 
                                  placeholder="e.g. Jaxen Drake"
                                  className="w-full bg-[#02040a] border border-cyan-950/80 p-2 text-cyan-300 rounded font-mono text-[11px] focus:outline-none focus:border-cyan-500"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-[9px] text-cyan-600 font-bold block uppercase">Alignment Role</label>
                                <select 
                                  value={newCharacterRole} 
                                  onChange={(e) => setNewCharacterRole(e.target.value as any)}
                                  className="w-full bg-[#02040a] border border-cyan-950/80 p-2 text-cyan-300 rounded font-mono text-[11px] focus:outline-none focus:border-cyan-500"
                                >
                                  <option value="PROTAGONIST">PROTAGONIST</option>
                                  <option value="ANTAGONIST">ANTAGONIST</option>
                                  <option value="SUPPORTING">SUPPORTING NODE</option>
                                </select>
                              </div>

                              <div className="space-y-1">
                                <label className="text-[9px] text-cyan-600 font-bold block uppercase">Traits & Augments</label>
                                <input 
                                  type="text" 
                                  value={newCharacterTraits} 
                                  onChange={(e) => setNewCharacterTraits(e.target.value)} 
                                  placeholder="e.g. Neural implants, low-light optics"
                                  className="w-full bg-[#02040a] border border-cyan-950/80 p-2 text-cyan-300 rounded font-mono text-[11px] focus:outline-none focus:border-cyan-500"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-[9px] text-cyan-600 font-bold block uppercase">Motivation</label>
                                <input 
                                  type="text" 
                                  value={newCharacterMotivation} 
                                  onChange={(e) => setNewCharacterMotivation(e.target.value)} 
                                  placeholder="e.g. Extract the decryption block"
                                  className="w-full bg-[#02040a] border border-cyan-950/80 p-2 text-cyan-300 rounded font-mono text-[11px] focus:outline-none focus:border-cyan-500"
                                />
                              </div>

                              <div className="flex gap-2 pt-1">
                                <button 
                                  onClick={() => {
                                    if (!newCharacterName.trim()) return;
                                    let updatedChars = [...codexCharacters];
                                    if (isAddingCharacter) {
                                      updatedChars.push({
                                        id: Math.random().toString(36).substr(2, 9),
                                        name: newCharacterName.trim(),
                                        role: newCharacterRole,
                                        traits: newCharacterTraits.trim(),
                                        motivation: newCharacterMotivation.trim()
                                      });
                                    } else if (isEditingCharacter) {
                                      updatedChars = updatedChars.map(c => c.id === isEditingCharacter.id ? {
                                        ...c,
                                        name: newCharacterName.trim(),
                                        role: newCharacterRole,
                                        traits: newCharacterTraits.trim(),
                                        motivation: newCharacterMotivation.trim()
                                      } : c);
                                    }
                                    updateCodexCharactersInFiles(updatedChars);
                                    setIsAddingCharacter(false);
                                    setIsEditingCharacter(null);
                                  }}
                                  className="flex-1 bg-cyan-500 hover:bg-cyan-400 text-black py-1.5 rounded font-bold cursor-pointer transition-colors text-center uppercase tracking-wider text-[10px]"
                                >
                                  SAVE
                                </button>
                                <button 
                                  onClick={() => {
                                    setIsAddingCharacter(false);
                                    setIsEditingCharacter(null);
                                  }}
                                  className="flex-1 bg-cyan-950/40 hover:bg-cyan-900/40 border border-cyan-950 text-cyan-500 py-1.5 rounded font-bold cursor-pointer transition-colors text-center uppercase tracking-wider text-[10px]"
                                >
                                  CANCEL
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* Characters List view */
                            <div className="flex-grow flex flex-col gap-3.5 overflow-y-auto max-h-[460px] pr-1">
                              <div className="flex justify-between items-center shrink-0">
                                <span className="text-[10px] text-cyan-600 font-bold uppercase tracking-wider">CODEX SIGNATURES ({codexCharacters.length})</span>
                                <button 
                                  onClick={() => {
                                    setNewCharacterName('');
                                    setNewCharacterRole('PROTAGONIST');
                                    setNewCharacterTraits('');
                                    setNewCharacterMotivation('');
                                    setIsAddingCharacter(true);
                                  }}
                                  className="bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[9px] px-2 py-1 rounded-md font-bold uppercase tracking-wider cursor-pointer"
                                >
                                  + ENTITY
                                </button>
                              </div>

                              {codexCharacters.length === 0 ? (
                                <div className="py-8 text-center text-slate-500 text-[10px] leading-relaxed">
                                  No character entities indexed. Initialize characters in Codex or Characters.txt.
                                </div>
                              ) : (
                                codexCharacters.map(c => {
                                  const avatar = characterAvatars[c.name];
                                  const isGenerating = isGeneratingCodexAvatar[c.id];
                                  const borderColors = c.role === 'PROTAGONIST' 
                                    ? 'border-cyan-500/30 shadow-[0_0_8px_rgba(6,182,212,0.05)]' 
                                    : c.role === 'ANTAGONIST' 
                                    ? 'border-rose-500/30 shadow-[0_0_8px_rgba(244,63,94,0.05)]' 
                                    : 'border-slate-700/40';

                                  return (
                                    <div key={c.id} className={`bg-[#02040a]/60 border rounded-xl p-3 flex gap-3 items-start relative hover:border-cyan-500/40 transition-colors group ${borderColors}`}>
                                      {/* Character Avatar */}
                                      <div className="w-16 h-16 rounded border border-cyan-950 bg-[#050a16] flex-shrink-0 overflow-hidden flex items-center justify-center relative">
                                        {avatar ? (
                                          <img src={avatar} alt={c.name} className="w-full h-full object-cover" />
                                        ) : (
                                          <ImageIcon className="w-5 h-5 text-slate-700" />
                                        )}
                                        {isGenerating && (
                                          <div className="absolute inset-0 bg-black/85 flex items-center justify-center">
                                            <div className="w-3.5 h-3.5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                                          </div>
                                        )}
                                      </div>

                                      {/* Character Info */}
                                      <div className="flex-1 min-w-0 space-y-1">
                                        <div className="flex items-center justify-between">
                                          <span className="font-bold text-white truncate pr-2 text-[11px]">{c.name}</span>
                                          <span className={`text-[8px] px-1 py-0.2 rounded font-bold uppercase ${
                                            c.role === 'PROTAGONIST' 
                                              ? 'bg-cyan-950/40 text-cyan-400 border border-cyan-500/20' 
                                              : c.role === 'ANTAGONIST' 
                                              ? 'bg-rose-950/40 text-rose-400 border border-rose-500/20' 
                                              : 'bg-slate-900/60 text-slate-400 border border-slate-700/20'
                                          }`}>{c.role.substring(0, 4)}</span>
                                        </div>

                                        <p className="text-[10px] text-slate-400 leading-tight">
                                          <span className="text-cyan-600 font-bold">Traits:</span> {c.traits || 'None'}
                                        </p>
                                        <p className="text-[10px] text-slate-400 leading-tight">
                                          <span className="text-cyan-600 font-bold">Motivation:</span> {c.motivation || 'None'}
                                        </p>

                                        {/* Avatar Action Trigger */}
                                        {!avatar && !isGenerating && (
                                          <button 
                                            onClick={() => handleGenerateCodexAvatar(c)}
                                            className="text-[9px] text-[#39ff14] hover:underline cursor-pointer flex items-center gap-1 pt-1"
                                          >
                                            <Sparkles className="w-3 h-3 text-[#39ff14] animate-pulse" />
                                            AI GENERATE AVATAR
                                          </button>
                                        )}
                                      </div>

                                      {/* Actions */}
                                      <div className="absolute bottom-2.5 right-2.5 hidden group-hover:flex items-center gap-1 text-[9px]">
                                        <button 
                                          onClick={() => {
                                            setIsEditingCharacter(c);
                                            setNewCharacterName(c.name);
                                            setNewCharacterRole(c.role as any);
                                            setNewCharacterTraits(c.traits);
                                            setNewCharacterMotivation(c.motivation);
                                          }}
                                          className="p-1 hover:bg-cyan-950/40 border border-cyan-950 hover:border-cyan-500/40 text-cyan-400 rounded cursor-pointer"
                                          title="Edit Character"
                                        >
                                          <Edit className="w-3 h-3" />
                                        </button>
                                        <button 
                                          onClick={() => {
                                            const updated = codexCharacters.filter(item => item.id !== c.id);
                                            updateCodexCharactersInFiles(updated);
                                          }}
                                          className="p-1 hover:bg-rose-950/40 border border-cyan-950 hover:border-rose-500/40 text-rose-400 rounded cursor-pointer"
                                          title="Delete Character"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* WORLD LAW MODULE */}
                      {codexTabSub === 'rules' && (
                        <div className="flex-grow flex flex-col gap-3">
                          {isAddingRule || selectedRuleToEdit ? (
                            /* Add/Edit Rule Form */
                            <div className="space-y-3 bg-[#050a16] border border-cyan-950/80 p-3.5 rounded-xl text-slate-300 animate-fade-in relative shrink-0">
                              <div className="corner-bracket-tl" />
                              <div className="font-bold text-[10px] text-cyan-400 border-b border-cyan-950 pb-1.5 uppercase tracking-wider">
                                {isAddingRule ? 'Add World Law Directive' : `Edit Directive ${selectedRuleToEdit?.index}`}
                              </div>

                              <div className="space-y-1">
                                <label className="text-[9px] text-cyan-600 font-bold block uppercase">Directive Title</label>
                                <input 
                                  type="text" 
                                  value={newRuleTitle} 
                                  onChange={(e) => setNewRuleTitle(e.target.value)} 
                                  placeholder="e.g. Genetic Security Protocols"
                                  className="w-full bg-[#02040a] border border-cyan-950/80 p-2 text-cyan-300 rounded font-mono text-[11px] focus:outline-none focus:border-cyan-500"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-[9px] text-cyan-600 font-bold block uppercase">Directive Description</label>
                                <textarea 
                                  value={newRuleDescription} 
                                  onChange={(e) => setNewRuleDescription(e.target.value)} 
                                  rows={4}
                                  placeholder="Enter the world logic details..."
                                  className="w-full bg-[#02040a] border border-cyan-950/80 p-2.5 text-cyan-300 rounded font-mono text-[11px] focus:outline-none focus:border-cyan-500 leading-relaxed resize-none"
                                />
                              </div>

                              <div className="flex gap-2 pt-1">
                                <button 
                                  onClick={() => {
                                    if (!newRuleDescription.trim()) return;
                                    let updatedRules = [...codexRules];
                                    if (isAddingRule) {
                                      const nextIdx = updatedRules.length > 0 ? Math.max(...updatedRules.map(r => r.index)) + 1 : 1;
                                      updatedRules.push({
                                        id: Math.random().toString(36).substr(2, 9),
                                        index: nextIdx,
                                        title: newRuleTitle.trim() || `Protocol ${nextIdx}`,
                                        description: newRuleDescription.trim()
                                      });
                                    } else if (selectedRuleToEdit) {
                                      updatedRules = updatedRules.map(r => r.id === selectedRuleToEdit.id ? {
                                        ...r,
                                        title: newRuleTitle.trim() || r.title,
                                        description: newRuleDescription.trim()
                                      } : r);
                                    }
                                    updateCodexRulesInFiles(updatedRules);
                                    setIsAddingRule(false);
                                    setSelectedRuleToEdit(null);
                                  }}
                                  className="flex-1 bg-cyan-500 hover:bg-cyan-400 text-black py-1.5 rounded font-bold cursor-pointer transition-colors text-center uppercase tracking-wider text-[10px]"
                                >
                                  SAVE
                                </button>
                                <button 
                                  onClick={() => {
                                    setIsAddingRule(false);
                                    setSelectedRuleToEdit(null);
                                  }}
                                  className="flex-1 bg-cyan-950/40 hover:bg-cyan-900/40 border border-cyan-950 text-cyan-500 py-1.5 rounded font-bold cursor-pointer transition-colors text-center uppercase tracking-wider text-[10px]"
                                >
                                  CANCEL
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* Rules List view */
                            <div className="flex-grow flex flex-col gap-3.5 overflow-y-auto max-h-[460px] pr-1">
                              <div className="flex justify-between items-center shrink-0">
                                <span className="text-[10px] text-cyan-600 font-bold uppercase tracking-wider">WORLD LAWS & DIRECTIVES ({codexRules.length})</span>
                                <button 
                                  onClick={() => {
                                    setNewRuleTitle('');
                                    setNewRuleDescription('');
                                    setIsAddingRule(true);
                                  }}
                                  className="bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[9px] px-2 py-1 rounded-md font-bold uppercase tracking-wider cursor-pointer"
                                >
                                  + DIRECTIVE
                                </button>
                              </div>

                              {codexRules.length === 0 ? (
                                <div className="py-8 text-center text-slate-500 text-[10px] leading-relaxed">
                                  No rules or protocols indexed. Define protocols in Codex or World_Rules.txt.
                                </div>
                              ) : (
                                codexRules.map(r => (
                                  <div key={r.id} className="bg-[#02040a]/60 border border-cyan-950/80 rounded-xl p-3 space-y-1 relative hover:border-cyan-500/40 transition-colors group">
                                    <div className="flex items-center justify-between border-b border-cyan-950/60 pb-1">
                                      <span className="text-cyan-400 font-bold text-[10px]">DIRECTIVE {r.index}: {r.title.toUpperCase()}</span>
                                      <span className="text-[9px] text-[#4f7cb8] font-bold">SECURED</span>
                                    </div>
                                    <p className="text-[10px] text-slate-300 leading-relaxed pt-1">
                                      {r.description}
                                    </p>

                                    {/* Actions */}
                                    <div className="absolute bottom-2.5 right-2.5 hidden group-hover:flex items-center gap-1 text-[9px]">
                                      <button 
                                        onClick={() => {
                                          setSelectedRuleToEdit(r);
                                          setNewRuleTitle(r.title);
                                          setNewRuleDescription(r.description);
                                        }}
                                        className="p-1 hover:bg-cyan-950/40 border border-cyan-950 hover:border-cyan-500/40 text-cyan-400 rounded cursor-pointer"
                                        title="Edit Rule"
                                      >
                                        <Edit className="w-3 h-3" />
                                      </button>
                                      <button 
                                        onClick={() => {
                                          const updated = codexRules.filter(item => item.id !== r.id).map((item, idx) => ({ ...item, index: idx + 1 }));
                                          updateCodexRulesInFiles(updated);
                                        }}
                                        className="p-1 hover:bg-rose-950/40 border border-cyan-950 hover:border-rose-500/40 text-rose-400 rounded cursor-pointer"
                                        title="Delete Rule"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 3: AI WRITING COPILOT DECK */}
                  {rightTab === 'copilot' && (
                    <div className="flex-grow flex flex-col gap-4 animate-fade-in text-xs font-mono">
                      
                      {/* Section A: Draft Generator */}
                      <div className="bg-[#02040a]/60 border border-cyan-950/80 rounded-xl p-3.5 space-y-2.5 relative shrink-0">
                        <div className="corner-bracket-tl" />
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-cyan-500 uppercase tracking-widest border-b border-cyan-950/60 pb-1.5">
                          <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
                          <span>AI Drafting Assistant</span>
                        </div>

                        <p className="text-[10px] text-slate-400 leading-tight">
                          Expand current manuscript context naturally.
                        </p>

                        <button 
                          onClick={handleCopilotContinue}
                          disabled={isGeneratingContinuation}
                          className={`w-full py-2 rounded-lg font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all ${
                            isGeneratingContinuation 
                              ? 'bg-cyan-950/40 text-cyan-600 border border-cyan-950' 
                              : 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-md'
                          }`}
                        >
                          {isGeneratingContinuation ? (
                            <>
                              <div className="w-3 h-3 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin" />
                              DRAFTING PARAGRAPH...
                            </>
                          ) : (
                            <>
                              <Zap className="w-3.5 h-3.5" />
                              DRAFT NEXT PARAGRAPH
                            </>
                          )}
                        </button>

                        {copilotContinuation && (
                          <div className="space-y-2 border-t border-cyan-950/60 pt-2.5 animate-fade-in">
                            <span className="text-[9px] text-[#39ff14] font-bold block uppercase tracking-wider">Generated Text:</span>
                            <div className="bg-[#050a16] border border-cyan-950 p-2.5 rounded text-[10px] leading-relaxed text-slate-300 max-h-[120px] overflow-y-auto font-serif">
                              {copilotContinuation}
                            </div>
                            <div className="flex gap-2">
                              <button 
                                onClick={() => {
                                  insertTextAtCursor(copilotContinuation);
                                  setCopilotContinuation('');
                                }}
                                className="flex-1 py-1.5 bg-[#07201b] hover:bg-[#0c352d] text-emerald-400 border border-emerald-900 rounded font-bold cursor-pointer transition-colors text-[9px] uppercase tracking-wider text-center"
                              >
                                INSERT
                              </button>
                              <button 
                                onClick={() => {
                                  const text = editorText + "\n\n" + copilotContinuation;
                                  setEditorText(text);
                                  if (currentPath) {
                                    setFiles(prev => ({
                                      ...prev,
                                      [currentPath]: { ...prev[currentPath], content: text }
                                    }));
                                  }
                                  setCopilotContinuation('');
                                }}
                                className="flex-1 py-1.5 bg-[#0c182c] hover:bg-[#12284c] text-cyan-400 border border-cyan-950 rounded font-bold cursor-pointer transition-colors text-[9px] uppercase tracking-wider text-center"
                              >
                                APPEND
                              </button>
                              <button 
                                onClick={() => setCopilotContinuation('')}
                                className="px-2 py-1.5 bg-[#02040a] hover:bg-slate-900 border border-cyan-950 text-slate-400 rounded font-bold cursor-pointer transition-colors text-[9px] text-center"
                              >
                                CLEAR
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Section B: Selection Re-writer */}
                      <div className="bg-[#02040a]/60 border border-cyan-950/80 rounded-xl p-3.5 space-y-2.5 relative shrink-0">
                        <div className="corner-bracket-tl" />
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-cyan-500 uppercase tracking-widest border-b border-cyan-950/60 pb-1.5">
                          <Edit className="w-4 h-4 text-cyan-400" />
                          <span>Selection Rewriter</span>
                        </div>

                        <p className="text-[10px] text-slate-400 leading-tight">
                          Highlight text in editor, select style, and rewrite.
                        </p>

                        <div className="grid grid-cols-3 gap-1 text-[8px] font-bold">
                          {(['suspense', 'descriptive', 'action', 'cyberpunk', 'simplify', 'custom'] as const).map(style => (
                            <button
                              key={style}
                              onClick={() => setSelectedRewriteStyle(style)}
                              className={`py-1 rounded border uppercase transition-colors cursor-pointer text-center ${
                                selectedRewriteStyle === style 
                                  ? 'bg-cyan-500/15 text-cyan-300 border-cyan-400/40' 
                                  : 'bg-[#050a16]/40 text-slate-500 border-cyan-950 hover:text-cyan-400'
                              }`}
                            >
                              {style}
                            </button>
                          ))}
                        </div>

                        {selectedRewriteStyle === 'custom' && (
                          <input 
                            type="text"
                            placeholder="e.g. Translate to old Victorian english..."
                            value={customRewritePrompt}
                            onChange={(e) => setCustomRewritePrompt(e.target.value)}
                            className="w-full bg-[#02040a] border border-cyan-950 text-[10px] p-2 text-cyan-300 rounded font-mono focus:outline-none"
                          />
                        )}

                        <button 
                          onClick={handleCopilotRewrite}
                          disabled={isGeneratingRewrite}
                          className={`w-full py-2 rounded-lg font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all ${
                            isGeneratingRewrite 
                              ? 'bg-cyan-950/40 text-cyan-600 border border-cyan-950' 
                              : 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-md'
                          }`}
                        >
                          {isGeneratingRewrite ? (
                            <>
                              <div className="w-3 h-3 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin" />
                              REWRITING SEGMENT...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5" />
                              REWRITE SELECTION
                            </>
                          )}
                        </button>
                      </div>

                      {/* Section C: Lore Oracle Chatbot */}
                      <div className="bg-[#02040a]/60 border border-cyan-950/80 rounded-xl p-3.5 flex flex-col gap-2.5 relative flex-grow max-h-[300px]">
                        <div className="corner-bracket-tl" />
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-cyan-500 uppercase tracking-widest border-b border-cyan-950/60 pb-1.5 shrink-0">
                          <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
                          <span>Lore Oracle Terminal</span>
                        </div>

                        {/* Chat Feed */}
                        <div className="flex-grow overflow-y-auto space-y-2 bg-[#02040a] p-2.5 rounded-lg border border-cyan-950/80 max-h-[140px]">
                          {copilotChatHistory.map((chat, idx) => (
                            <div key={idx} className={`space-y-1 ${chat.sender === 'user' ? 'text-right' : 'text-left'}`}>
                              <span className={`text-[8px] font-bold uppercase tracking-wider block ${
                                chat.sender === 'user' ? 'text-cyan-400' : 'text-[#39ff14]'
                              }`}>
                                {chat.sender === 'user' ? 'Author' : 'Oracle'}
                              </span>
                              <div className={`inline-block text-[9px] p-2 rounded-lg leading-relaxed text-left max-w-[85%] ${
                                chat.sender === 'user' ? 'bg-cyan-950/30 text-cyan-200 border border-cyan-950' : 'bg-slate-900/60 text-slate-300 border border-cyan-950/50'
                              }`}>
                                {chat.text}
                                {chat.sender === 'ai' && idx > 0 && (
                                  <button
                                    onClick={() => handleSaveChatToNotes(chat.text)}
                                    className="block mt-1.5 text-[8px] text-cyan-400 hover:underline font-bold uppercase tracking-wider cursor-pointer border border-cyan-500/20 bg-cyan-950/20 px-1.5 py-0.5 rounded"
                                  >
                                    Save to Notes File
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                          {isGeneratingChat && (
                            <div className="text-left text-slate-500 text-[9px] flex items-center gap-1.5 py-1">
                              <div className="w-2 h-2 border border-cyan-500 border-t-transparent rounded-full animate-spin" />
                              Consulting lore index...
                            </div>
                          )}
                        </div>

                        {/* Chat input */}
                        <div className="flex gap-1.5 shrink-0">
                          <input 
                            type="text"
                            placeholder="Ask the Lore Oracle..."
                            value={copilotChatInput}
                            onChange={(e) => setCopilotChatInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleCopilotChat(); }}
                            className="flex-grow bg-[#02040a] border border-cyan-950 text-[10px] p-2 text-cyan-200 rounded font-mono focus:outline-none focus:border-cyan-500"
                          />
                          <button 
                            onClick={handleCopilotChat}
                            className="bg-cyan-500 hover:bg-cyan-400 text-black px-3 rounded font-bold cursor-pointer text-[10px] uppercase font-mono tracking-wider flex items-center"
                          >
                            SEND
                          </button>
                        </div>
                      </div>

                    </div>
                  )}

                  {/* TAB 4: ADVANCED TELEMETRY METRICS */}
                  {rightTab === 'telemetry' && (() => {
                    // Compute metrics
                    const rawText = editorText;
                    const sentencesCount = rawText.split(/[.!?]+/).filter(Boolean).length || 1;
                    const wordCountTotal = wordCount || 1;
                    const charCountTotal = rawText.length;
                    const avgWordsPerSent = Math.round(wordCountTotal / sentencesCount);
                    const readTimeMin = Math.max(1, Math.round(wordCountTotal / 225)); // 225 wpm

                    const syllableMatches = rawText.match(/[aeiouy]+/ig);
                    const syllableCount = syllableMatches ? syllableMatches.length : 1;
                    
                    // Flesch Reading Ease
                    const scoreFlesch = Math.max(1, Math.min(100, Math.round(206.835 - 1.015 * (wordCountTotal / sentencesCount) - 84.6 * (syllableCount / wordCountTotal))));
                    let levelLabel = "Average Reading Grade";
                    if (scoreFlesch < 30) levelLabel = "Graduate / Cryptic";
                    else if (scoreFlesch < 50) levelLabel = "College Complex";
                    else if (scoreFlesch < 70) levelLabel = "Standard Novelist";
                    else if (scoreFlesch < 90) levelLabel = "Clear & Casual";
                    else levelLabel = "Simple / Direct";

                    // Compute Narrative tension paragraph values
                    const paras = rawText.split('\n').filter(p => p.trim().length > 12);
                    const tensionScores = paras.map(p => {
                      const pLower = p.toLowerCase();
                      let score = 30; // base tension
                      const triggers = [
                        { words: ['scream', 'alarm', 'warn', 'alert', 'laser', 'crimson', 'emergency', 'tracer', 'decryption', 'failed', 'hacked'], weight: 20 },
                        { words: ['run', 'chase', 'fled', 'dash', 'fast', 'sprint', 'velocity', 'rapid', 'quickly', 'breathless', 'hustle'], weight: 12 },
                        { words: ['kill', 'blood', 'gun', 'blade', 'weapon', 'fight', 'dead', 'shatter', 'blast', 'explod', 'fire'], weight: 25 },
                        { words: ['secret', 'dark', 'whisper', 'shadow', 'cipher', 'locked', 'vault', 'sealed', 'hologram'], weight: 10 },
                        { words: ['quiet', 'peace', 'sleep', 'soft', 'calm', 'rest', 'slow', 'dust', 'ancient', 'stone', 'library'], weight: -15 }
                      ];
                      triggers.forEach(t => {
                        t.words.forEach(w => {
                          if (pLower.includes(w)) score += t.weight;
                        });
                      });
                      return Math.max(10, Math.min(95, score));
                    });
                    if (tensionScores.length === 0) tensionScores.push(30);
                    while (tensionScores.length < 6) {
                      tensionScores.push(tensionScores[tensionScores.length - 1] || 30);
                    }
                    // Generate SVG polyline points path (Width 280, Height 60)
                    const svgW = 280;
                    const svgH = 60;
                    const stepW = svgW / (tensionScores.length - 1);
                    const pointsString = tensionScores.map((score, i) => {
                      const x = Math.round(i * stepW);
                      const y = Math.round(svgH - (score * svgH / 100));
                      return `${x},${y}`;
                    }).join(' ');

                    // Check Codex Character entity appearances
                    const characterMentions = codexCharacters.map(c => {
                      const regex = new RegExp(`\\b${c.name.split(' ')[0]}\\b`, 'gi'); // match first name
                      const matches = rawText.match(regex);
                      return {
                        name: c.name,
                        role: c.role,
                        count: matches ? matches.length : 0
                      };
                    }).filter(item => item.count > 0);

                    return (
                      <div className="flex-grow flex flex-col gap-4 animate-fade-in text-xs font-mono">
                        
                        {/* Section 1: Readability stats */}
                        <div className="bg-[#02040a]/60 border border-cyan-950/80 rounded-xl p-3.5 space-y-2 relative shrink-0">
                          <div className="corner-bracket-tl" />
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-cyan-500 uppercase tracking-widest border-b border-cyan-950/60 pb-1.5">
                            <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
                            <span>Manuscript Telemetry</span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400">
                            <div className="bg-[#050a16]/40 p-2 rounded border border-cyan-950/50">
                              <span className="block text-[8px] text-slate-500 uppercase font-bold">Characters:</span>
                              <strong className="text-white text-xs">{charCountTotal.toLocaleString()}</strong>
                            </div>
                            <div className="bg-[#050a16]/40 p-2 rounded border border-cyan-950/50">
                              <span className="block text-[8px] text-slate-500 uppercase font-bold">Sentences:</span>
                              <strong className="text-white text-xs">{sentencesCount.toLocaleString()}</strong>
                            </div>
                            <div className="bg-[#050a16]/40 p-2 rounded border border-cyan-950/50">
                              <span className="block text-[8px] text-slate-500 uppercase font-bold">WPS Average:</span>
                              <strong className="text-white text-xs">{avgWordsPerSent} words</strong>
                            </div>
                            <div className="bg-[#050a16]/40 p-2 rounded border border-cyan-950/50">
                              <span className="block text-[8px] text-slate-500 uppercase font-bold">Reading Speed:</span>
                              <strong className="text-white text-xs">~ {readTimeMin} min read</strong>
                            </div>
                          </div>
                        </div>

                        {/* Section 2: Complexity and Score */}
                        <div className="bg-[#02040a]/60 border border-cyan-950/80 rounded-xl p-3.5 space-y-2.5 relative shrink-0">
                          <div className="corner-bracket-tl" />
                          <div className="flex justify-between items-center text-[10px] font-bold text-cyan-500 uppercase tracking-widest border-b border-cyan-950/60 pb-1.5">
                            <span>Readability Complexity</span>
                            <span className="text-[#39ff14] glow-emerald">Score: {scoreFlesch}</span>
                          </div>
                          
                          <div className="flex justify-between items-center bg-[#050a16]/40 p-2 rounded border border-cyan-950/50">
                            <span className="text-[10px] text-slate-400">Archival Grade:</span>
                            <strong className="text-cyan-400 text-xs font-bold uppercase">{levelLabel}</strong>
                          </div>
                        </div>

                        {/* Section 3: Visual tension SVG graph */}
                        <div className="bg-[#02040a]/60 border border-cyan-950/80 rounded-xl p-3.5 space-y-2 relative shrink-0">
                          <div className="corner-bracket-tl" />
                          <div className="flex justify-between items-center text-[10px] font-bold text-cyan-500 uppercase tracking-widest border-b border-cyan-950/60 pb-1.5">
                            <span>Story Tension Waveform</span>
                            <span className="text-cyan-400 text-[8px] font-bold bg-cyan-950/40 px-1 rounded animate-pulse">BIOMETRICS</span>
                          </div>

                          <div className="bg-[#02040a] p-2.5 rounded-lg border border-cyan-950 shadow-inner flex flex-col items-center">
                            <svg width={280} height={60} className="overflow-visible">
                              <line x1="0" y1="15" x2="280" y2="15" stroke="rgba(0, 240, 255, 0.05)" strokeDasharray="3,3" />
                              <line x1="0" y1="30" x2="280" y2="30" stroke="rgba(0, 240, 255, 0.05)" strokeDasharray="3,3" />
                              <line x1="0" y1="45" x2="280" y2="45" stroke="rgba(0, 240, 255, 0.05)" strokeDasharray="3,3" />
                              
                              <polyline 
                                fill="none" 
                                stroke="#00f0ff" 
                                strokeWidth="2" 
                                points={pointsString} 
                                className="shadow-lg"
                                style={{ filter: 'drop-shadow(0px 0px 4px rgba(0, 240, 255, 0.6))' }}
                              />
                            </svg>
                            <span className="text-[8px] text-slate-500 uppercase tracking-widest pt-1 block text-center w-full">Narrative Tension Progression</span>
                          </div>
                        </div>

                        {/* Section 4: Entity references scanner */}
                        <div className="bg-[#02040a]/60 border border-cyan-950/80 rounded-xl p-3.5 space-y-2 relative flex-grow max-h-[160px] overflow-y-auto">
                          <div className="corner-bracket-tl" />
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-cyan-500 uppercase tracking-widest border-b border-cyan-950/60 pb-1.5">
                            <Shield className="w-4 h-4 text-cyan-500" />
                            <span>Entity References</span>
                          </div>

                          {characterMentions.length === 0 ? (
                            <div className="py-4 text-center text-slate-600 text-[10px]">
                              No Codex characters detected in this chapter.
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              {characterMentions.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center text-[10px] bg-[#050a16]/40 px-2 py-1 rounded border border-cyan-950/50">
                                  <span className="text-white font-bold">{item.name} <span className="text-[7px] text-slate-500 font-bold uppercase">{item.role.substring(0, 4)}</span></span>
                                  <span className="text-[#39ff14] font-bold font-mono">{item.count} appearance{item.count > 1 ? 's' : ''}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                      </div>
                    );
                  })()}

                  {/* Shared bottom logger decoration */}
                  <div className="mt-auto shrink-0 pt-3">
                    <div className="bg-[#050d22]/80 border border-cyan-950 p-3 rounded-lg text-[9px] text-slate-500 leading-relaxed flex items-start gap-2 font-mono uppercase tracking-wider">
                      <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-cyan-500/80" />
                      <span>
                        SYSTEM_LINK: Active interface synchronized with local disk indices.
                      </span>
                    </div>
                  </div>

                </div>
              </div>

            </div>
          </div>
        )}

        {/* TAB 2: PYTHON SOURCE CODE */}
        {activeTab === 'code' && (
          <div className="flex-1 flex flex-col gap-4 animate-fade-in relative z-10">
            {/* Header info bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#050a16] border border-cyan-950/80 rounded-2xl p-6 shadow-md">
              <div>
                <h3 className="font-display font-bold text-base text-white flex items-center gap-2.5 tracking-wider uppercase glow-cyan">
                  <FileCode className="text-cyan-400 w-5 h-5" />
                  Elysium Writer Script Layout (elysium_writer.py)
                </h3>
                <p className="text-xs text-[#a5c6f2] mt-1 font-mono uppercase">
                  COMPLETE STANDALONE SOURCE CODE DEVELOPED USING PYSIDE2 BINDINGS
                </p>
              </div>

              <div className="flex items-center gap-3 font-mono">
                <button 
                  onClick={handleCopyCode}
                  className="flex items-center gap-2 bg-cyan-950/40 hover:bg-cyan-500/20 text-xs font-bold px-4 py-2 rounded-lg border border-cyan-500/30 text-cyan-300 transition-all cursor-pointer shadow-sm"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      COPIED!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      COPY_SCRIPT
                    </>
                  )}
                </button>

                <button 
                  onClick={handleDownloadFile}
                  className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-xs font-bold px-4 py-2 rounded-lg text-black transition-all cursor-pointer shadow-md shadow-cyan-500/10"
                >
                  <Download className="w-4 h-4" />
                  DOWNLOAD_PY
                </button>
              </div>
            </div>

            {/* Main scrollable code viewport */}
            <div className="bg-[#02040a] border border-cyan-950 rounded-2xl overflow-hidden flex flex-col h-[550px] shadow-2xl relative">
              
              {/* Corner Brackets */}
              <div className="corner-bracket-tl" />
              <div className="corner-bracket-tr" />
              <div className="corner-bracket-bl" />
              <div className="corner-bracket-br" />

              {/* Window Controls Decorator */}
              <div className="bg-[#050a16] px-4 py-2.5 border-b border-cyan-950 flex items-center justify-between text-xs text-[#60a5fa] font-mono">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]"></span>
                  <span>STANDALONE_PYTHON_QT_SCRIPT_STRUCTURE</span>
                </div>
                <span className="text-cyan-500">[ 443 LINES ]</span>
              </div>

              {/* Code Blocks */}
              <div className="flex-1 overflow-auto p-4 md:p-6 font-mono text-xs md:text-[13px] leading-relaxed text-[#93c5fd] bg-[#02040a] scrollbar-thin">
                <pre className="text-left whitespace-pre">{pythonSourceCode}</pre>
              </div>
            </div>

            {/* Code Highlight specs cards (Bento Grid) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono">
              <div className="bg-[#050a16] border border-cyan-950 p-5 rounded-2xl shadow-md relative">
                <div className="corner-bracket-tl" />
                <div className="w-9 h-9 rounded-lg bg-cyan-950/50 flex items-center justify-center mb-3 border border-cyan-500/20">
                  <Folder className="w-4.5 h-4.5 text-cyan-400" />
                </div>
                <h4 className="font-bold text-xs text-white uppercase tracking-wider">WORKSPACE AUTO_BOOTSTRAP</h4>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  The script's <code>init_project_structure()</code> mechanism sweeps disk path lines. On absence, it boots 100 chapters and world notes structures automatically.
                </p>
              </div>

              <div className="bg-[#050a16] border border-cyan-950 p-5 rounded-2xl shadow-md relative">
                <div className="corner-bracket-tl" />
                <div className="w-9 h-9 rounded-lg bg-cyan-950/50 flex items-center justify-center mb-3 border border-cyan-500/20">
                  <Sparkles className="w-4.5 h-4.5 text-cyan-400" />
                </div>
                <h4 className="font-bold text-xs text-white uppercase tracking-wider">SISTER MEDIA MAPPING</h4>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  The cover graphics module overrides <code>QLabel</code> to intercept click streams. It links chapter manuscript records with sister PNG files cleanly.
                </p>
              </div>

              <div className="bg-[#050a16] border border-cyan-950 p-5 rounded-2xl shadow-md relative">
                <div className="corner-bracket-tl" />
                <div className="w-9 h-9 rounded-lg bg-cyan-950/50 flex items-center justify-center mb-3 border border-cyan-500/20">
                  <Award className="w-4.5 h-4.5 text-cyan-400" />
                </div>
                <h4 className="font-bold text-xs text-white uppercase tracking-wider">CLOSE_EVENT BUFFERS SAVE</h4>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  By subclassing the window's native <code>closeEvent(event)</code> signals, the program forces a clean commit of editing buffers prior to exit sequences.
                </p>
              </div>
            </div>

          </div>
        )}

        {/* TAB 3: DEVELOPER DOCS */}
        {activeTab === 'docs' && (
          <div className="flex-1 flex flex-col gap-6 animate-fade-in bg-[#050a16] border border-cyan-950/60 rounded-2xl p-6 md:p-8 shadow-2xl relative">
            <div className="corner-bracket-tl" />
            <div className="corner-bracket-tr" />
            <div className="corner-bracket-bl" />
            <div className="corner-bracket-br" />

            <h2 className="font-display font-bold text-xl text-white flex items-center gap-2.5 tracking-wider uppercase glow-cyan">
              <BookOpen className="text-cyan-400 w-6 h-6" />
              Elysium Writer Operation Protocols
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed font-mono uppercase">
              COGNITIVE PROTOCOL SECURED FOR NOVEL DESIGN DEPLOYMENTS
            </p>

            <div className="h-px bg-cyan-950" />

            <div className="space-y-6 font-mono text-xs">
              
              {/* Installation block */}
              <div>
                <h3 className="text-white font-bold text-xs flex items-center gap-2 mb-3 uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  1. Local Environment Execution Requirements
                </h3>
                <p className="text-slate-400 mb-3 leading-relaxed">
                  To host and execute the single-file PySide2 script interface locally on your machine, Python 3.8+ with standard Qt framework packages is required.
                </p>
                <div className="bg-[#02040a] border border-cyan-950 p-4 rounded-xl font-mono text-[13px] space-y-2 text-cyan-300 shadow-inner">
                  <p className="text-cyan-700"># Install PySide2 Qt-bindings via standard pip</p>
                  <p className="text-white font-semibold">pip install PySide2</p>
                  <p className="text-cyan-700 mt-2"># Spin up the standalone writer station</p>
                  <p className="text-white font-semibold">python elysium_writer.py</p>
                </div>
              </div>

              {/* Design specifications block */}
              <div>
                <h3 className="text-white font-bold text-xs flex items-center gap-2 mb-3 uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                  2. Native Cyber-Deck Color Palette (V1.2 Specifications)
                </h3>
                <p className="text-slate-400 leading-relaxed">
                  The visual structure of the terminal deck targets low-light environment safety. It shields the novelist's vision across marathon draft cycles:
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                  <div className="bg-[#02040a] p-3.5 rounded-xl border border-cyan-950 flex flex-col justify-between">
                    <span className="text-[9px] text-cyan-500 uppercase font-bold tracking-widest">Main Page Well</span>
                    <strong className="block text-[11px] text-white mt-1">#02040A</strong>
                  </div>
                  <div className="bg-[#040813] p-3.5 rounded-xl border border-cyan-950 flex flex-col justify-between">
                    <span className="text-[9px] text-cyan-500 uppercase font-bold tracking-widest">Outline Sidebar</span>
                    <strong className="block text-[11px] text-white mt-1">#040813</strong>
                  </div>
                  <div className="bg-[#060c1d] p-3.5 rounded-xl border border-cyan-950 flex flex-col justify-between">
                    <span className="text-[9px] text-cyan-500 uppercase font-bold tracking-widest">Active Marker</span>
                    <strong className="block text-[11px] text-white mt-1">#00F0FF</strong>
                  </div>
                  <div className="bg-[#081023] p-3.5 rounded-xl border border-cyan-950 flex flex-col justify-between">
                    <span className="text-[9px] text-cyan-500 uppercase font-bold tracking-widest">Window Grid Lines</span>
                    <strong className="block text-[11px] text-white mt-1">#0F2349</strong>
                  </div>
                </div>
              </div>

              {/* Technical implementations block */}
              <div>
                <h3 className="text-white font-bold text-xs flex items-center gap-2 mb-3 uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"></span>
                  3. Key Architectural Implementations
                </h3>
                <div className="space-y-3 leading-relaxed text-slate-400">
                  <div className="bg-[#02040a] p-4 rounded-xl border border-cyan-950">
                    <strong className="text-white block mb-1 font-semibold uppercase tracking-wider">A. Intelligent Image Synchronization</strong>
                    On chapter selections, the code queries the underlying filesystem index. Located sibling graphics are mapped seamlessly using standard scaling algorithms.
                  </div>
                  <div className="bg-[#02040a] p-4 rounded-xl border border-cyan-950">
                    <strong className="text-white block mb-1 font-semibold uppercase tracking-wider">B. Line Metrics Adjuster</strong>
                    To align editing layouts with book draft double-spacing, the underlying engine embeds specific structural styling blocks on initialization.
                  </div>
                  <div className="bg-[#02040a] p-4 rounded-xl border border-cyan-950">
                    <strong className="text-white block mb-1 font-semibold uppercase tracking-wider">C. Clean Index Trees</strong>
                    To omit confusing directory tables, we trigger <code>tree_view.setHeaderHidden(True)</code>, focusing the writer's complete focus onto novel indices.
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

      </main>

      {/* FOOTER */}
      <footer className="border-t border-cyan-950/60 bg-[#040814]/90 backdrop-blur-md py-6 px-6 text-center text-xs text-[#4f7cb8] mt-auto relative z-10 font-mono tracking-wider">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <p>© 2026 ELYSIUM COGNITIVE SYSTEMS. OFFLINE SECURITY PROTOCOLS LOCKED.</p>
          <div className="flex gap-4">
            <a href="#nav-tab-simulator" onClick={() => setActiveTab('simulator')} className="hover:text-cyan-400">WORKSPACE_CORE</a>
            <span>•</span>
            <a href="#nav-tab-code" onClick={() => setActiveTab('code')} className="hover:text-cyan-400">PYTHON_SCRIPT</a>
            <span>•</span>
            <a href="#nav-tab-docs" onClick={() => setActiveTab('docs')} className="hover:text-cyan-400">DOCS_DECK</a>
          </div>
        </div>
      </footer>

      {/* --- MODAL 1: AI IMAGE CONCEPT GENERATOR --- */}
      {isImageModalOpen && (
        <div className="fixed inset-0 bg-[#02040a]/85 flex items-center justify-center p-4 z-50 animate-fade-in backdrop-blur-xs overflow-y-auto">
          <div className="bg-[#050a16] border border-cyan-500/30 w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl flex flex-col relative font-mono my-8">
            
            {/* Corner brackets for modal */}
            <div className="corner-bracket-tl" />
            <div className="corner-bracket-tr" />
            <div className="corner-bracket-bl" />
            <div className="corner-bracket-br" />

            {/* Modal Header */}
            <div className="bg-[#080f22] px-5 py-4 border-b border-cyan-950/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="text-cyan-400 w-5 h-5 animate-pulse" />
                <h3 className="font-bold text-sm tracking-wider text-white uppercase glow-cyan">COGNITIVE ART SYNTHESIZER</h3>
              </div>
              <button 
                onClick={() => {
                  setIsImageModalOpen(false);
                  setArtError(null);
                }}
                className="text-cyan-600 hover:text-cyan-400 cursor-pointer p-1 rounded-lg hover:bg-cyan-950/40"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 flex-1 flex flex-col gap-4 max-h-[75vh] overflow-y-auto scrollbar-thin">
              
              {/* Engine Toggle */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-cyan-500 uppercase tracking-widest">Synthesis Core Engine</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => { setUseRealAI(true); setArtError(null); }}
                    className={`text-xs py-2 rounded-lg uppercase font-bold tracking-widest transition-all cursor-pointer border flex items-center justify-center gap-1.5 ${
                      useRealAI 
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 shadow-[0_0_8px_rgba(0,240,255,0.1)]' 
                        : 'bg-[#02040a] text-cyan-700 border-cyan-950 hover:text-cyan-400 hover:bg-cyan-950/30'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    Real Gemini-3 AI
                  </button>
                  <button
                    onClick={() => { setUseRealAI(false); setArtError(null); }}
                    className={`text-xs py-2 rounded-lg uppercase font-bold tracking-widest transition-all cursor-pointer border flex items-center justify-center gap-1.5 ${
                      !useRealAI 
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 shadow-[0_0_8px_rgba(0,240,255,0.1)]' 
                        : 'bg-[#02040a] text-cyan-700 border-cyan-950 hover:text-cyan-400 hover:bg-cyan-950/30'
                    }`}
                  >
                    <Terminal className="w-3.5 h-3.5 text-cyan-600" />
                    Procedural Simulator
                  </button>
                </div>
              </div>

              {useRealAI ? (
                <>
                  {/* Real AI parameters */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-cyan-950/60 pt-4">
                    {/* Model selector */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-cyan-500 uppercase tracking-widest flex items-center gap-1">
                        <Cpu className="w-3.5 h-3.5" /> Model Target
                      </label>
                      <div className="flex flex-col gap-1.5">
                        <button
                          onClick={() => {
                            setSelectedModel('gemini-3-pro-image-preview');
                            // Pro is for create-only, reset mode
                            setArtMode('create');
                          }}
                          className={`text-left text-[11px] px-3 py-2 rounded-lg transition-all cursor-pointer border ${
                            selectedModel === 'gemini-3-pro-image-preview'
                              ? 'bg-cyan-500/10 text-cyan-300 border-cyan-400/50'
                              : 'bg-[#02040a] text-cyan-600 border-cyan-950 hover:text-cyan-400'
                          }`}
                        >
                          <div className="font-bold">Gemini 3 Pro Image (Nano Banana Pro)</div>
                          <div className="text-[9px] text-slate-500 mt-0.5">High-Quality, supports 1K, 2K, 4K</div>
                        </button>
                        <button
                          onClick={() => setSelectedModel('gemini-3.1-flash-image-preview')}
                          className={`text-left text-[11px] px-3 py-2 rounded-lg transition-all cursor-pointer border ${
                            selectedModel === 'gemini-3.1-flash-image-preview'
                              ? 'bg-cyan-500/10 text-cyan-300 border-cyan-400/50'
                              : 'bg-[#02040a] text-cyan-600 border-cyan-950 hover:text-cyan-400'
                          }`}
                        >
                          <div className="font-bold">Gemini 3.1 Flash Image (Nano Banana)</div>
                          <div className="text-[9px] text-slate-500 mt-0.5">Fast, supports Create & Edit modes</div>
                        </button>
                        <button
                          onClick={() => {
                            setSelectedModel('imagen-3.0-generate-002');
                            setArtMode('create');
                          }}
                          className={`text-left text-[11px] px-3 py-2 rounded-lg transition-all cursor-pointer border ${
                            selectedModel === 'imagen-3.0-generate-002'
                              ? 'bg-cyan-500/10 text-cyan-300 border-cyan-400/50'
                              : 'bg-[#02040a] text-cyan-600 border-cyan-950 hover:text-cyan-400'
                          }`}
                        >
                          <div className="font-bold">Imagen 3.0 Generate (imagen-3.0-generate-002)</div>
                          <div className="text-[9px] text-slate-500 mt-0.5">Google's high quality dedicated image model</div>
                        </button>
                      </div>
                    </div>

                    {/* Image size selector */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-cyan-500 uppercase tracking-widest flex items-center gap-1">
                        <Maximize2 className="w-3.5 h-3.5" /> Target Resolution
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {/* Always support 1K, 2K, 4K as requested */}
                        {['1K', '2K', '4K'].map(size => (
                          <button
                            key={size}
                            onClick={() => setSelectedSize(size as any)}
                            className={`text-xs py-2 rounded-lg uppercase font-bold transition-all cursor-pointer border ${
                              selectedSize === size
                                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 shadow-[0_0_8px_rgba(0,240,255,0.1)]'
                                : 'bg-[#02040a] text-cyan-700 border-cyan-950 hover:text-cyan-400'
                            }`}
                          >
                            {size}
                          </button>
                        ))}
                        {/* Flash additionally supports 512px */}
                        {selectedModel === 'gemini-3.1-flash-image-preview' && (
                          <button
                            onClick={() => setSelectedSize('512px')}
                            className={`text-xs py-2 rounded-lg uppercase font-bold transition-all cursor-pointer border ${
                              selectedSize === '512px'
                                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 shadow-[0_0_8px_rgba(0,240,255,0.1)]'
                                : 'bg-[#02040a] text-cyan-700 border-cyan-950 hover:text-cyan-400'
                            }`}
                          >
                            512px
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Art Action Mode (Only for Gemini 3.1 Flash Image, or enabled optionally) */}
                  <div className="space-y-1.5 border-t border-cyan-950/60 pt-4">
                    <label className="text-xs font-bold text-cyan-500 uppercase tracking-widest">Synthesis Action Mode</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setArtMode('create')}
                        className={`text-xs py-1.5 rounded-lg uppercase font-bold transition-all cursor-pointer border ${
                          artMode === 'create'
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 shadow-[0_0_8px_rgba(0,240,255,0.1)]'
                            : 'bg-[#02040a] text-cyan-700 border-cyan-950 hover:text-cyan-400 hover:bg-cyan-950/30'
                        }`}
                      >
                        Create New Art
                      </button>
                      <button
                        onClick={() => {
                          if (selectedModel !== 'gemini-3.1-flash-image-preview') {
                            // Automatically upgrade to Flash if edit is selected
                            setSelectedModel('gemini-3.1-flash-image-preview');
                          }
                          setArtMode('edit');
                        }}
                        className={`text-xs py-1.5 rounded-lg uppercase font-bold transition-all cursor-pointer border flex items-center justify-center gap-1.5 ${
                          artMode === 'edit'
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 shadow-[0_0_8px_rgba(0,240,255,0.1)]'
                            : 'bg-[#02040a] text-cyan-700 border-cyan-950 hover:text-cyan-400 hover:bg-cyan-950/30'
                        }`}
                      >
                        Edit Current Art (3.1 Flash)
                      </button>
                    </div>

                    {artMode === 'edit' && (
                      <div className="bg-[#02040a] border border-cyan-950/80 p-3 rounded-lg flex items-center gap-3">
                        <div className="w-14 h-14 bg-[#050a16] rounded border border-cyan-950 overflow-hidden flex-shrink-0 flex items-center justify-center">
                          {files[currentPath]?.image ? (
                            <img src={files[currentPath].image} alt="Base layer" className="w-full h-full object-cover" />
                          ) : (
                            <ImageIcon className="w-6 h-6 text-cyan-950 animate-pulse" />
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 leading-relaxed">
                          <span className="text-cyan-400 font-bold block uppercase tracking-wider">Image Editing Active</span>
                          {files[currentPath]?.image 
                            ? "Using the current chapter art reference as base layer. Use prompt to instruct edits (e.g., 'add a futuristic portal in the background')."
                            : "Notice: No existing chapter art detected. Please upload an image below or switch back to Create Mode."}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : null}

              {/* Theme Selector (Used for both) */}
              <div className="space-y-1.5 border-t border-cyan-950/60 pt-4">
                <label className="text-xs font-bold text-cyan-500 uppercase tracking-widest">Visual Core Theme Overlay</label>
                <div className="grid grid-cols-5 gap-1.5">
                  {(['cyber', 'space', 'noir', 'forest', 'rune'] as const).map(theme => (
                    <button
                      key={theme}
                      onClick={() => setSelectedTheme(theme)}
                      className={`text-[10px] py-2 rounded-lg uppercase font-bold tracking-widest transition-all cursor-pointer border ${
                        selectedTheme === theme 
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 shadow-[0_0_8px_rgba(0,240,255,0.1)]' 
                          : 'bg-[#02040a] text-cyan-700 border-cyan-950 hover:text-cyan-400 hover:bg-cyan-950/30'
                      }`}
                    >
                      {theme}
                    </button>
                  ))}
                </div>
              </div>

              {/* Prompt Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-cyan-500 uppercase tracking-widest">
                  {artMode === 'edit' ? 'EDIT DIRECTIVE PROMPT' : 'COGNITIVE DESCRIPTION PROMPT'}
                </label>
                <input 
                  type="text"
                  placeholder={artMode === 'edit' ? "e.g., Modify the central node, add a deep red laser glow..." : "e.g., Cyberpunk atmospheric console deck, neon matrix grids..."}
                  value={artPrompt}
                  onChange={(e) => setArtPrompt(e.target.value)}
                  className="w-full bg-[#02040a] border border-cyan-950 text-xs text-cyan-200 placeholder-cyan-950 rounded-lg px-3 py-2.5 focus:outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/40 font-mono"
                />
              </div>

              {/* Error Box display if any */}
              {artError && (
                <div className="bg-rose-950/30 border border-rose-500/30 text-rose-300 text-[11px] p-3 rounded-lg leading-relaxed flex items-start gap-2 animate-fade-in font-mono">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" />
                  <div className="flex-1">
                    <span className="font-bold block uppercase tracking-wider mb-1 text-rose-400">Synthesis Error Occurred</span>
                    <p className="whitespace-pre-wrap">{artError}</p>
                  </div>
                </div>
              )}

              {/* Preview Slot - Canvas (Local) or Static/Render Info (Real) */}
              <div className="space-y-1.5 flex flex-col items-center border-t border-cyan-950/60 pt-4">
                <span className="text-xs font-bold text-cyan-500 uppercase tracking-widest self-start">SYSTEM VIEWPORT PREVIEW</span>
                <div className="w-full h-[180px] bg-[#02040a] rounded-xl border border-cyan-950 flex items-center justify-center overflow-hidden relative shadow-inner">
                  {useRealAI ? (
                    <div className="flex flex-col items-center justify-center text-slate-500 text-center p-4">
                      {files[currentPath]?.image ? (
                        <img 
                          src={files[currentPath].image} 
                          alt="Current Art reference" 
                          className="w-full h-full object-contain max-h-[160px] rounded border border-cyan-500/10"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <>
                          <Sparkles className="w-8 h-8 text-cyan-950 mb-2 animate-pulse" />
                          <span className="text-[10px] font-mono text-cyan-500 font-bold uppercase tracking-widest">Awaiting Live Render Stream</span>
                          <span className="text-[9px] text-slate-500 mt-1 max-w-xs leading-relaxed font-mono">
                            Press SYNTHESIZE to invoke Gemini models. The generated artifact will bind directly to your chapter slot.
                          </span>
                        </>
                      )}
                    </div>
                  ) : (
                    <canvas 
                      ref={canvasRef} 
                      width={320} 
                      height={180} 
                      className="w-full h-full object-contain"
                    />
                  )}
                  {isGeneratingArt && (
                    <div className="absolute inset-0 bg-[#02040a]/95 flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-5 h-5 text-cyan-400 animate-spin" />
                      <span className="text-xs font-semibold text-cyan-300">Rendering visual matrix...</span>
                      <span className="text-[9px] text-slate-500">Contacting Gemini Image Server ({selectedSize})</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="text-[10px] text-slate-400 leading-relaxed flex items-start gap-2.5 bg-[#02040a] p-3 rounded-lg border border-cyan-950">
                <Info className="w-4.5 h-4.5 flex-shrink-0 mt-0.5 text-cyan-500" />
                <span>
                  {useRealAI 
                    ? `Powered by "@google/genai" server-side SDK. Model: ${selectedModel}, target dimension: ${selectedSize}. Selected API Key remains secure.` 
                    : "The local render system compiles high-fidelity procedural vector graphics onto a data stream, binding the payload with your chapter manuscript."}
                </span>
              </div>

              {/* Direct file upload fallback */}
              <div className="flex items-center justify-between border-t border-cyan-950 pt-4">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-white uppercase">Upload Local Resource</span>
                  <span className="text-[10px] text-[#4f7cb8]">Bind a local PNG/JPG record manually</span>
                </div>
                <label className="bg-cyan-950/40 hover:bg-cyan-500/20 text-xs font-bold px-3 py-2 rounded-lg border border-cyan-500/30 text-cyan-300 transition-all cursor-pointer shadow-sm">
                  Choose Disk File
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden" 
                  />
                </label>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="bg-[#080f22] px-5 py-3.5 border-t border-cyan-950/60 flex items-center justify-end gap-2.5">
              <button 
                onClick={() => {
                  setIsImageModalOpen(false);
                  setArtError(null);
                }}
                className="bg-[#02040a] border border-cyan-950 text-cyan-600 hover:text-cyan-400 px-4 py-2 rounded-lg text-xs font-bold cursor-pointer"
              >
                CLOSE
              </button>
              <button 
                onClick={useRealAI ? generateAIArt : drawArtConcept}
                disabled={isGeneratingArt}
                className="bg-cyan-500 hover:bg-cyan-400 border border-cyan-500 text-black px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-md shadow-cyan-500/10"
              >
                {isGeneratingArt ? 'SYNTHESIZING...' : 'SYNTHESIZE'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* --- MODAL 2: NEW PROJECT WIZARD --- */}
      {isNewProjectModalOpen && (
        <div className="fixed inset-0 bg-[#02040a]/90 flex items-center justify-center p-4 z-50 animate-fade-in backdrop-blur-md overflow-y-auto">
          <div className={`bg-[#050a16] border border-cyan-500/30 w-full transition-all duration-300 rounded-2xl overflow-hidden shadow-2xl flex flex-col relative font-mono my-8 ${
            wizardStep === 'config' ? 'max-w-lg' : 'max-w-4xl'
          }`}>
            
            {/* Corner brackets */}
            <div className="corner-bracket-tl" />
            <div className="corner-bracket-tr" />
            <div className="corner-bracket-bl" />
            <div className="corner-bracket-br" />

            {/* Modal Header */}
            <div className="bg-[#080f22] px-5 py-4 border-b border-cyan-950/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="text-cyan-400 w-5 h-5 animate-pulse" />
                <h3 className="font-bold text-xs md:text-sm tracking-wider text-white uppercase glow-cyan">
                  {wizardStep === 'cover' && 'Step 1: Cover Page Setup (Procedural & AI Synthesizer)'}
                  {wizardStep === 'config' && 'Step 2: Core Story Configuration'}
                  {wizardStep === 'review' && 'Step 3: AI Book Profile Review'}
                </h3>
              </div>
              <button 
                onClick={() => setIsNewProjectModalOpen(false)}
                className="text-cyan-600 hover:text-cyan-400 cursor-pointer p-1 rounded-lg hover:bg-cyan-950/40"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Step Indicators */}
            <div className="bg-[#030612] px-6 py-3 border-b border-cyan-950/40 flex items-center justify-between text-[10px] text-slate-500 font-bold select-none">
              <span className={`transition-colors ${wizardStep === 'cover' ? 'text-cyan-400' : 'text-slate-600'}`}>
                [01. COVER SETUP]
              </span>
              <div className="flex-1 h-[1px] bg-cyan-950/40 mx-4" />
              <span className={`transition-colors ${wizardStep === 'config' ? 'text-cyan-400' : 'text-slate-600'}`}>
                [02. CONFIGURATION]
              </span>
              <div className="flex-1 h-[1px] bg-cyan-950/40 mx-4" />
              <span className={`transition-colors ${wizardStep === 'review' ? 'text-cyan-400' : 'text-slate-600'}`}>
                [03. REVIEW & SYNOPSIS]
              </span>
            </div>

            {/* Modal Body */}
            <div className="p-6 flex-grow overflow-y-auto max-h-[70vh]">
              
              {/* STEP 2: CONFIGURATION */}
              {wizardStep === 'config' && (
                <div className="space-y-5 animate-fade-in">
                  
                  {/* Auto-detected banner showing name and genre */}
                  <div className="p-3.5 bg-cyan-950/25 border border-cyan-500/25 rounded-xl space-y-2 animate-pulse-subtle">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-cyan-400 animate-spin-slow" />
                      <span className="text-[10px] font-bold text-cyan-300 uppercase tracking-wider block">⚡ Cover Data Synced & Realized</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-[10px] font-mono leading-tight">
                      <div>
                        <span className="text-slate-400 block uppercase font-bold text-[8px] tracking-widest pb-0.5">Auto-Detected Title:</span>
                        <span className="text-white font-bold bg-[#02040a] px-2 py-1 rounded border border-cyan-950/80 block truncate">
                          {coverTitle || 'Untitled'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block uppercase font-bold text-[8px] tracking-widest pb-0.5">Realized Genre:</span>
                        <span className="text-cyan-400 font-bold bg-[#02040a] px-2 py-1 rounded border border-cyan-950/80 block uppercase">
                          ★ {newProjectGenre || 'cyberpunk'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Project Name Input */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-cyan-500 uppercase tracking-widest block">Project Name Identifier</label>
                    <input 
                      type="text"
                      value={newProjectName}
                      onChange={(e) => {
                        setNewProjectName(e.target.value);
                        setCoverTitle(e.target.value);
                      }}
                      placeholder="e.g., Nebula_Chamber_Chronicles"
                      className="w-full bg-[#02040a] border border-cyan-500/30 text-xs text-cyan-200 rounded-lg p-2.5 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500/30 font-mono"
                    />
                    <span className="text-[10px] text-slate-500 block">Spaces will be automatically sanitized to underscores on creation.</span>
                  </div>

                  {/* Genre Selection */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-cyan-500 uppercase tracking-widest block">Workspace Core Theme / Genre</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => {
                          setNewProjectGenre('cyberpunk');
                          setCoverSubtitle('A Cyberpunk Saga of Sector 4');
                          setCustomPrimaryColor('#00f0ff');
                          setCustomSecondaryColor('#1b092a');
                          setCustomBgType('grid');
                        }}
                        className={`p-2.5 border rounded-lg text-center transition-all text-[11px] cursor-pointer flex flex-col gap-1 items-center justify-center ${
                          newProjectGenre === 'cyberpunk'
                            ? 'bg-cyan-950/30 border-cyan-400 text-cyan-300 shadow-[0_0_8px_rgba(0,240,255,0.15)]'
                            : 'bg-[#02040a]/40 border-cyan-950 text-slate-500 hover:border-cyan-500/35 hover:text-cyan-400'
                        }`}
                      >
                        <span className="font-bold uppercase">CYBERPUNK</span>
                        <span className="text-[8px] opacity-70">Neon, rain, mainframes</span>
                      </button>
                      
                      <button
                        onClick={() => {
                          setNewProjectGenre('space-opera');
                          setCoverSubtitle('An Interstellar Space Opera of the Sovereign Cluster');
                          setCustomPrimaryColor('#3b82f6');
                          setCustomSecondaryColor('#02010c');
                          setCustomBgType('stars');
                        }}
                        className={`p-2.5 border rounded-lg text-center transition-all text-[11px] cursor-pointer flex flex-col gap-1 items-center justify-center ${
                          newProjectGenre === 'space-opera'
                            ? 'bg-cyan-950/30 border-cyan-400 text-cyan-300 shadow-[0_0_8px_rgba(0,240,255,0.15)]'
                            : 'bg-[#02040a]/40 border-cyan-950 text-slate-500 hover:border-cyan-500/35 hover:text-cyan-400'
                        }`}
                      >
                        <span className="font-bold uppercase">SPACE OPERA</span>
                        <span className="text-[8px] opacity-70">Stars, warp-gates, fleets</span>
                      </button>

                      <button
                        onClick={() => {
                          setNewProjectGenre('fantasy');
                          setCoverSubtitle('An Epic Dark Fantasy of the Bronze Spires');
                          setCustomPrimaryColor('#eab308');
                          setCustomSecondaryColor('#0a0a0f');
                          setCustomBgType('runes');
                        }}
                        className={`p-2.5 border rounded-lg text-center transition-all text-[11px] cursor-pointer flex flex-col gap-1 items-center justify-center ${
                          newProjectGenre === 'fantasy'
                            ? 'bg-cyan-950/30 border-cyan-400 text-cyan-300 shadow-[0_0_8px_rgba(0,240,255,0.15)]'
                            : 'bg-[#02040a]/40 border-cyan-950 text-slate-500 hover:border-cyan-500/35 hover:text-cyan-400'
                        }`}
                      >
                        <span className="font-bold uppercase">FANTASY</span>
                        <span className="text-[8px] opacity-70">Runes, magic, spires</span>
                      </button>
                    </div>
                  </div>

                  {/* Adhyay count dropdown */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-cyan-500 uppercase tracking-widest block">Manuscript Size (অধ্যায় সংকলন)</label>
                      <span className="text-xs text-cyan-400 font-bold bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-500/20">{newProjectChapters} Adhyays</span>
                    </div>
                    <select
                      value={newProjectChapters}
                      onChange={(e) => setNewProjectChapters(Number(e.target.value))}
                      className="w-full bg-[#02040a] border border-cyan-950 p-2.5 text-cyan-300 rounded font-sans text-xs focus:outline-none focus:border-cyan-500 cursor-pointer"
                    >
                      <option value={10}>দ্রুতগতির গল্পে ভালো (১০ অধ্যায়)</option>
                      <option value={15}>অধিকাংশ নভেলের জন্য আদর্শ (১৫ অধ্যায়)</option>
                      <option value={25}>ফ্যান্টাসি/লিটারারি ফিকশনে সম্ভব (২৫ অধ্যায়)</option>
                    </select>
                    <span className="text-[10px] text-slate-500 block">System will pre-allocate writing cards and template files instantly on confirmation.</span>
                  </div>

                  {/* Enable cover setup */}
                  <div className="flex items-center gap-2.5 py-3.5 px-4 bg-[#02040a]/65 rounded-xl border border-cyan-950">
                    <input 
                      type="checkbox"
                      id="include-cover-checkbox-wizard"
                      checked={includeCoverPage}
                      onChange={(e) => setIncludeCoverPage(e.target.checked)}
                      className="w-4 h-4 rounded bg-[#02040a] border border-cyan-950 accent-cyan-500 cursor-pointer"
                    />
                    <label htmlFor="include-cover-checkbox-wizard" className="text-xs font-bold text-cyan-300 uppercase tracking-wider cursor-pointer select-none flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      Include the Synthesized Cover Page inside Project Manuscript
                    </label>
                  </div>
                </div>
              )}

              {/* STEP 2: COVER DESIGNER & UPLOADER */}
              {wizardStep === 'cover' && (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 animate-fade-in">
                  
                  {/* Left Column: Controls (Span 7) */}
                  <div className="md:col-span-7 flex flex-col gap-4">
                    
                    {/* Method Tabs */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 border-b border-cyan-950 pb-3">
                      <button
                        onClick={() => setCoverType('design')}
                        className={`py-2 text-[10px] font-bold uppercase rounded-lg border text-center transition-all cursor-pointer ${
                          coverType === 'design'
                            ? 'bg-cyan-950/40 text-cyan-400 border-cyan-400/50 shadow-[0_0_8px_rgba(0,240,255,0.1)]'
                            : 'bg-transparent text-slate-500 border-cyan-950 hover:text-cyan-400 hover:border-cyan-500/20'
                        }`}
                      >
                        🎨 Procedural Designer
                      </button>
                      <button
                        onClick={() => setCoverType('upload')}
                        className={`py-2 text-[10px] font-bold uppercase rounded-lg border text-center transition-all cursor-pointer ${
                          coverType === 'upload'
                            ? 'bg-cyan-950/40 text-cyan-400 border-cyan-400/50 shadow-[0_0_8px_rgba(0,240,255,0.1)]'
                            : 'bg-transparent text-slate-500 border-cyan-950 hover:text-cyan-400 hover:border-cyan-500/20'
                        }`}
                      >
                        📤 Upload Cover Art
                      </button>
                      <button
                        onClick={() => setCoverType('ai')}
                        className={`py-2 text-[10px] font-bold uppercase rounded-lg border text-center transition-all cursor-pointer ${
                          coverType === 'ai'
                            ? 'bg-cyan-950/40 text-cyan-400 border-cyan-400/50 shadow-[0_0_8px_rgba(0,240,255,0.1)]'
                            : 'bg-transparent text-slate-500 border-cyan-950 hover:text-cyan-400 hover:border-cyan-500/20'
                        }`}
                      >
                        ✨ AI Cover Synthesizer
                      </button>
                    </div>

                    {coverType === 'design' ? (
                      /* Procedural Designer */
                      <div className="space-y-3 text-xs">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[9px] uppercase text-slate-400 font-bold block">Book Title</label>
                            <input 
                              type="text"
                              value={coverTitle}
                              onChange={(e) => setCoverTitle(e.target.value)}
                              className="w-full bg-[#02040a] border border-cyan-950 p-2 text-cyan-300 rounded font-mono text-xs focus:outline-none focus:border-cyan-500"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] uppercase text-slate-400 font-bold block">Author Name</label>
                            <input 
                              type="text"
                              value={coverAuthor}
                              onChange={(e) => setCoverAuthor(e.target.value)}
                              className="w-full bg-[#02040a] border border-cyan-950 p-2 text-cyan-300 rounded font-mono text-xs focus:outline-none focus:border-cyan-500"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] uppercase text-slate-400 font-bold block">Subtitle / Tagline</label>
                          <input 
                            type="text"
                            value={coverSubtitle}
                            onChange={(e) => setCoverSubtitle(e.target.value)}
                            className="w-full bg-[#02040a] border border-cyan-950 p-2 text-cyan-300 rounded font-mono text-xs focus:outline-none focus:border-cyan-500"
                          />
                        </div>

                        {/* Visual Configurations */}
                        <div className="bg-[#02040a]/30 p-3 rounded-lg border border-cyan-950 space-y-3">
                          <span className="text-[9px] font-bold text-cyan-400 uppercase tracking-widest block border-b border-cyan-950/60 pb-1">Procedural Canvas Theme Parameters</span>
                          
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[9px] uppercase text-slate-400 block">Layout Visual</label>
                              <select
                                value={customBgType}
                                onChange={(e) => setCustomBgType(e.target.value as any)}
                                className="w-full bg-[#02040a] border border-cyan-950 p-1.5 text-cyan-300 rounded text-xs focus:outline-none"
                              >
                                <option value="grid">Tech Grid Frame</option>
                                <option value="stars">Cosmic Orbit Stars</option>
                                <option value="runes">Ancient Magic Runes</option>
                                <option value="solid">Minimal Gradient Box</option>
                              </select>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[9px] uppercase text-slate-400 block">Font Family</label>
                              <select
                                value={customFont}
                                onChange={(e) => setCustomFont(e.target.value)}
                                className="w-full bg-[#02040a] border border-cyan-950 p-1.5 text-cyan-300 rounded text-xs focus:outline-none"
                              >
                                <option value="Space Grotesk">Space Grotesk (Tech)</option>
                                <option value="JetBrains Mono">JetBrains Mono (Mono)</option>
                                <option value="Inter">Inter (Sans)</option>
                                <option value="Playfair Display">Playfair Display (Serif)</option>
                                <option value="Times New Roman">Times New Roman (Classic)</option>
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[9px] uppercase text-slate-400 block">Primary Accent</label>
                              <div className="flex gap-1.5 items-center">
                                <input 
                                  type="color" 
                                  value={customPrimaryColor}
                                  onChange={(e) => setCustomPrimaryColor(e.target.value)}
                                  className="w-7 h-7 bg-transparent border-0 cursor-pointer"
                                />
                                <span className="text-[10px] text-slate-400 font-mono">{customPrimaryColor}</span>
                              </div>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[9px] uppercase text-slate-400 block">Secondary Canvas</label>
                              <div className="flex gap-1.5 items-center">
                                <input 
                                  type="color" 
                                  value={customSecondaryColor}
                                  onChange={(e) => setCustomSecondaryColor(e.target.value)}
                                  className="w-7 h-7 bg-transparent border-0 cursor-pointer"
                                />
                                <span className="text-[10px] text-slate-400 font-mono">{customSecondaryColor}</span>
                              </div>
                            </div>
                          </div>

                          {/* Dynamic sliders */}
                          <div className="space-y-2 pt-1">
                            <div className="space-y-1">
                              <div className="flex justify-between text-[9px] text-slate-400">
                                <span>Title Font Size</span>
                                <span className="text-cyan-400 font-bold">{customTitleSize}px</span>
                              </div>
                              <input 
                                type="range" 
                                min="24" 
                                max="56" 
                                value={customTitleSize}
                                onChange={(e) => setCustomTitleSize(Number(e.target.value))}
                                className="w-full accent-cyan-500 cursor-pointer h-1 bg-[#02040a]"
                              />
                            </div>

                            <div className="space-y-1">
                              <div className="flex justify-between text-[9px] text-slate-400">
                                <span>Title Y-Offset</span>
                                <span className="text-cyan-400 font-bold">{customTitleY}px</span>
                              </div>
                              <input 
                                type="range" 
                                min="100" 
                                max="400" 
                                value={customTitleY}
                                onChange={(e) => setCustomTitleY(Number(e.target.value))}
                                className="w-full accent-cyan-500 cursor-pointer h-1 bg-[#02040a]"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : coverType === 'upload' ? (
                      /* Cover Uploader with AI Vision Siphon */
                      <div className="space-y-4 animate-fade-in flex-grow flex flex-col justify-center">
                        <div className="border-2 border-dashed border-cyan-500/20 bg-[#02040a]/40 rounded-xl p-6 text-center relative flex flex-col items-center justify-center hover:border-cyan-500/40 transition-all">
                          <input 
                            type="file" 
                            accept="image/*" 
                            onChange={handleCoverUpload}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                          />
                          <Upload className="w-8 h-8 text-cyan-500/40 mb-2 animate-bounce" />
                          <span className="text-xs font-bold text-cyan-400 uppercase tracking-widest block">[ SELECT COVER IMAGE ]</span>
                          <span className="text-[10px] text-slate-500 mt-1 block">PNG, JPG, or WEBP up to 8MB</span>
                          
                          {uploadedCover && (
                            <span className="text-[9px] text-emerald-400 mt-2 font-mono bg-emerald-950/30 px-2 py-0.5 rounded border border-emerald-500/20">
                              ✓ IMAGE LOADED SUCCESSFULLY
                            </span>
                          )}
                        </div>

                        {uploadedCover ? (
                          <div className="bg-cyan-950/20 p-4 rounded-xl border border-cyan-500/30 space-y-3">
                            <div className="flex items-start gap-3">
                              <Sparkles className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5 animate-pulse" />
                              <div className="space-y-0.5">
                                <span className="text-[10px] font-bold uppercase text-white tracking-wider block">Gemini AI Vision Siphon</span>
                                <p className="text-[10px] text-slate-400 leading-relaxed">Let Gemini analyze your uploaded image to detect what the book is, its title, subtitle, author, and appropriate genre!</p>
                              </div>
                            </div>
                            
                            <button
                              onClick={() => detectBookDetails(uploadedCover)}
                              disabled={isAnalyzingCover}
                              className={`w-full py-2.5 rounded-lg text-xs font-bold font-mono uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all ${
                                isAnalyzingCover 
                                  ? 'bg-cyan-950/40 text-cyan-600 border border-cyan-950 cursor-not-allowed' 
                                  : 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-md shadow-cyan-500/10'
                              }`}
                            >
                              {isAnalyzingCover ? (
                                <>
                                  <div className="w-3.5 h-3.5 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin" />
                                  AI DETECTING METADATA...
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-4 h-4" />
                                  RUN AI BOOK PROFILE DETECTOR
                                </>
                              )}
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="text-center p-4 bg-[#030712]/50 rounded-xl border border-cyan-950 text-[10px] text-slate-600">
                              Upload a book cover artwork mock to enable the futuristic Gemini AI vision scanner.
                            </div>
                            <div className="p-3.5 bg-cyan-950/15 border border-cyan-500/20 rounded-xl flex items-start gap-2.5 animate-fade-in text-left">
                              <span className="text-cyan-400 font-bold text-xs mt-0.5">💡</span>
                              <div className="space-y-1">
                                <span className="text-[10px] font-bold text-cyan-300 uppercase tracking-wider block">Have your own custom artwork?</span>
                                <p className="text-[10px] text-slate-400 leading-relaxed font-sans">
                                  Drag and drop any high-resolution JPG or PNG book cover image. Elysium will automatically bind it to your master manuscript deck!
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* AI Cover Synthesizer */
                      <div className="space-y-4 animate-fade-in flex-grow flex flex-col justify-center text-xs">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-cyan-500 uppercase tracking-widest block">AI Visual Prompt (বর্ণনা লিখুন)</label>
                          <textarea 
                            value={aiCoverPrompt}
                            onChange={(e) => setAiCoverPrompt(e.target.value)}
                            placeholder="Describe what you want to see on the cover..."
                            className="w-full h-24 bg-[#02040a] border border-cyan-950 p-2.5 text-cyan-300 rounded font-sans text-xs focus:outline-none focus:border-cyan-500 leading-relaxed resize-none"
                          />
                          <span className="text-[9px] text-slate-500 block">Gemini 3.5 will generate a 3:4 high-quality vertical cover artwork matching this description.</span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[9px] uppercase text-slate-400 font-bold block">Art Style Preset</label>
                            <select
                              value={aiCoverStyle}
                              onChange={(e) => setAiCoverStyle(e.target.value)}
                              className="w-full bg-[#02040a] border border-cyan-950 p-2 text-cyan-300 rounded text-xs focus:outline-none cursor-pointer"
                            >
                              <option value="Cinematic Digital Painting">Cinematic Digital Painting</option>
                              <option value="Minimalist Vector Graphic">Minimalist Vector Graphic</option>
                              <option value="Dark Synthwave / Cyberpunk Neon">Dark Synthwave / Neon</option>
                              <option value="Mystic Oil on Canvas">Mystic Oil Painting</option>
                              <option value="Immersive Retro Archival Sketch">Vintage Book Engraving</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[9px] uppercase text-slate-400 font-bold block">Aspect Ratio</label>
                            <div className="w-full bg-[#02040a]/40 border border-cyan-950 p-2 text-slate-500 rounded text-xs font-mono select-none">
                              3:4 (Book Cover)
                            </div>
                          </div>
                        </div>

                        {aiCoverError && (
                          <div className="bg-red-950/20 border border-red-500/20 text-red-400 p-2.5 rounded text-[10px] font-mono leading-relaxed">
                            {aiCoverError}
                          </div>
                        )}

                        <div className="space-y-2">
                          <button
                            onClick={handleGenerateAiCover}
                            disabled={isGeneratingAiCover}
                            className={`w-full py-3 rounded-lg text-xs font-bold font-mono uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all ${
                              isGeneratingAiCover 
                                ? 'bg-cyan-950/40 text-cyan-600 border border-cyan-950 cursor-not-allowed animate-pulse' 
                                : 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-lg shadow-cyan-500/20'
                            }`}
                          >
                            {isGeneratingAiCover ? (
                              <>
                                <div className="w-3.5 h-3.5 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin" />
                                SYNTHESIZING NEURAL COVER ART...
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-4 h-4" />
                                SYNTHESIZE AI COVER ART
                              </>
                            )}
                          </button>

                          {uploadedCover && (
                            <button
                              onClick={() => detectBookDetails(uploadedCover)}
                              disabled={isAnalyzingCover}
                              className="w-full py-2 rounded-lg text-[10px] font-bold font-mono uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-all border border-cyan-500/20 bg-cyan-950/20 text-cyan-400 hover:bg-cyan-950/40"
                            >
                              {isAnalyzingCover ? (
                                <>
                                  <div className="w-3 h-3 border border-cyan-400 border-t-transparent rounded-full animate-spin" />
                                  EXTRACTING NOVEL DETAILS...
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                                  RUN AI BOOK PROFILE DETECTOR ON ART
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Dynamic Cover Canvas Preview (Span 5) */}
                  <div className="md:col-span-5 bg-[#02040a]/40 p-4 rounded-2xl border border-cyan-950/70 flex flex-col items-center justify-center gap-3">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest font-mono">Real-Time Book cover preview</span>
                    
                    <div className="w-[210px] h-[280px] rounded-lg overflow-hidden shadow-2xl relative border border-cyan-500/10 shrink-0 bg-[#030712]">
                      {coverType === 'design' ? (
                        <img 
                          src={generateCustomCover(
                            coverTitle || 'Untitled Book',
                            coverSubtitle || 'A Compelling Tale',
                            coverAuthor || 'Author Name',
                            newProjectGenre,
                            customBgType,
                            customPrimaryColor,
                            customSecondaryColor,
                            customFont,
                            customTitleSize,
                            customTitleY,
                            customSubtitleY,
                            customAuthorY
                          )} 
                          alt="Procedural Preview" 
                          className="w-full h-full object-cover"
                        />
                      ) : uploadedCover ? (
                        <img 
                          src={uploadedCover} 
                          alt="Uploaded Cover Preview" 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center text-slate-700 bg-[#02040a]/80">
                          <ImageIcon className="w-10 h-10 mb-2 opacity-20 text-cyan-400" />
                          <span className="text-[9px] font-mono block">No Mock Loaded</span>
                        </div>
                      )}
                    </div>

                    <div className="text-[9px] text-center text-slate-500 leading-relaxed font-mono px-2">
                      {coverType === 'design' && 'This high-fidelity procedural cover template compiles directly to HTML5 Canvas in real-time.'}
                      {coverType === 'upload' && 'Your uploaded book cover mock art is analyzed server-side using Gemini Vision models.'}
                      {coverType === 'ai' && 'AI cover illustration synthesized dynamically by Gemini model based on your visual description.'}
                    </div>
                  </div>

                </div>
              )}

              {/* STEP 3: REVIEW & APPROVED DETAILS */}
              {wizardStep === 'review' && (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 animate-fade-in">
                  
                  {/* Left Column: Form Details (Span 7) */}
                  <div className="md:col-span-7 space-y-4">
                    <div className="p-4 bg-emerald-950/10 border border-emerald-500/20 rounded-xl space-y-1">
                      <span className="text-[10px] font-bold uppercase text-emerald-400 tracking-wider block">✓ Profile Synthesis Verified</span>
                      <p className="text-[10px] text-slate-400 leading-relaxed">Review the detected or designed novel details. These parameters will be used to initialize templates, variables, and cover content.</p>
                    </div>

                    <div className="space-y-3.5 text-xs">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] text-slate-400 uppercase font-bold block">Consolidated Title</label>
                          <input 
                            type="text"
                            value={coverTitle}
                            onChange={(e) => setCoverTitle(e.target.value)}
                            className="w-full bg-[#02040a] border border-cyan-950 p-2 text-cyan-200 rounded font-mono text-xs focus:outline-none focus:border-cyan-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] text-slate-400 uppercase font-bold block">Assigned Author</label>
                          <input 
                            type="text"
                            value={coverAuthor}
                            onChange={(e) => setCoverAuthor(e.target.value)}
                            className="w-full bg-[#02040a] border border-cyan-950 p-2 text-cyan-200 rounded font-mono text-xs focus:outline-none focus:border-cyan-500"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-400 uppercase font-bold block">Subtitle / Tagline</label>
                        <input 
                          type="text"
                          value={coverSubtitle}
                          onChange={(e) => setCoverSubtitle(e.target.value)}
                          className="w-full bg-[#02040a] border border-cyan-950 p-2 text-cyan-200 rounded font-mono text-xs focus:outline-none focus:border-cyan-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-400 uppercase font-bold block">AI-Generated Story Logline / Prologue Synopsis</label>
                        <textarea 
                          value={aiDetectedLogline}
                          onChange={(e) => setAiDetectedLogline(e.target.value)}
                          rows={4}
                          className="w-full bg-[#02040a] border border-cyan-950 p-2.5 text-cyan-300 rounded font-mono text-xs focus:outline-none focus:border-cyan-500 leading-relaxed"
                          placeholder="Draft your master book pitch, elevator tagline, or chapter synopsis here..."
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Visual Mockup (Span 5) */}
                  <div className="md:col-span-5 flex flex-col items-center justify-center gap-3 bg-[#02040a]/40 p-4 rounded-2xl border border-cyan-950/70">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest font-mono">Consolidated Book Mockup</span>
                    
                    <div className="w-[210px] h-[280px] rounded-lg overflow-hidden shadow-2xl relative border border-cyan-500/10 shrink-0 bg-[#030712]">
                      {coverType === 'design' ? (
                        <img 
                          src={generateCustomCover(
                            coverTitle,
                            coverSubtitle,
                            coverAuthor,
                            newProjectGenre,
                            customBgType,
                            customPrimaryColor,
                            customSecondaryColor,
                            customFont,
                            customTitleSize,
                            customTitleY,
                            customSubtitleY,
                            customAuthorY
                          )} 
                          alt="Procedural Cover" 
                          className="w-full h-full object-cover"
                        />
                      ) : uploadedCover ? (
                        <img 
                          src={uploadedCover} 
                          alt="Uploaded Cover" 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-slate-900 flex items-center justify-center text-slate-600">No cover art</div>
                      )}
                    </div>

                    <div className="p-2.5 bg-[#030612]/60 rounded-xl border border-cyan-950/60 w-full text-center space-y-1">
                      <span className="text-[9px] font-bold text-cyan-400 uppercase tracking-wider block">Assigned Theme</span>
                      <span className="text-[10px] font-bold text-white uppercase font-mono">{newProjectGenre}</span>
                    </div>
                  </div>

                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="bg-[#080f22] px-5 py-4 border-t border-cyan-950/60 flex items-center justify-between">
              
              {/* Back / Left buttons */}
              <div>
                {wizardStep !== 'cover' && (
                  <button 
                    onClick={() => {
                      if (wizardStep === 'config') setWizardStep('cover');
                      if (wizardStep === 'review') setWizardStep('config');
                    }}
                    className="bg-[#02040a] border border-cyan-950 text-cyan-500 hover:text-cyan-400 px-4 py-2 rounded-lg text-xs font-bold cursor-pointer font-mono"
                  >
                    ← BACK
                  </button>
                )}
              </div>

              {/* Right buttons */}
              <div className="flex items-center gap-2.5">
                <button 
                  onClick={() => setIsNewProjectModalOpen(false)}
                  className="bg-[#02040a] border border-cyan-950 text-cyan-600 hover:text-cyan-400 px-4 py-2 rounded-lg text-xs font-bold cursor-pointer font-mono"
                >
                  CANCEL
                </button>
                
                {wizardStep === 'cover' && (
                  <button 
                    onClick={() => {
                      // Automatically sanitize coverTitle to snake_case for the disk project name
                      const sanitized = coverTitle.trim().replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_');
                      setNewProjectName(sanitized || 'My_Novel_Project');
                      setWizardStep('config');
                    }}
                    className="bg-cyan-500 hover:bg-cyan-400 border border-cyan-500 text-black px-5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-md shadow-cyan-500/15 uppercase tracking-wider font-mono flex items-center gap-1.5"
                  >
                    NEXT: CONFIGURATION →
                  </button>
                )}

                {wizardStep === 'config' && (
                  <button 
                    onClick={() => setWizardStep('review')}
                    className="bg-cyan-500 hover:bg-cyan-400 border border-cyan-500 text-black px-5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-md shadow-cyan-500/15 uppercase tracking-wider font-mono flex items-center gap-1.5"
                  >
                    NEXT: REVIEW →
                  </button>
                )}

                {wizardStep === 'review' && (
                  <button 
                    onClick={() => {
                      const finalCoverImg = coverType === 'design' 
                        ? generateCustomCover(
                            coverTitle,
                            coverSubtitle,
                            coverAuthor,
                            newProjectGenre,
                            customBgType,
                            customPrimaryColor,
                            customSecondaryColor,
                            customFont,
                            customTitleSize,
                            customTitleY,
                            customSubtitleY,
                            customAuthorY
                          )
                        : uploadedCover;
                        
                      createNewProject(
                        newProjectName, 
                        newProjectChapters, 
                        newProjectGenre,
                        includeCoverPage,
                        coverTitle,
                        coverSubtitle,
                        coverAuthor,
                        finalCoverImg,
                        aiDetectedLogline
                      );
                      setIsNewProjectModalOpen(false);
                    }}
                    className="bg-emerald-500 hover:bg-emerald-400 border border-emerald-500 text-black px-5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-md shadow-emerald-500/15 uppercase tracking-wider font-mono flex items-center gap-1.5"
                  >
                    <FolderPlus className="w-4 h-4" />
                    APPROVE & INITIALIZE
                  </button>
                )}
              </div>

            </div>

          </div>
        </div>
      )}

      {/* --- MODAL 3: END NOVEL & BACK COVER PIPELINE --- */}
      {isEndNovelModalOpen && (
        <div className="fixed inset-0 bg-[#02040a]/90 flex items-center justify-center p-4 z-50 animate-fade-in backdrop-blur-md overflow-y-auto">
          <div className={`bg-[#050a16] border border-cyan-500/30 w-full rounded-2xl overflow-hidden shadow-2xl flex flex-col relative font-mono my-8 transition-all duration-300 ${
            endNovelStep === 'published' ? 'max-w-4xl' : 'max-w-2xl'
          }`}>
            
            {/* Corner brackets */}
            <div className="corner-bracket-tl" />
            <div className="corner-bracket-tr" />
            <div className="corner-bracket-bl" />
            <div className="corner-bracket-br" />

            {/* Modal Header */}
            <div className="bg-[#080f22] px-5 py-4 border-b border-cyan-950/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="text-cyan-400 w-5 h-5 animate-pulse" />
                <h3 className="font-bold text-xs md:text-sm tracking-wider text-white uppercase glow-cyan">
                  {endNovelStep === 'input' ? 'FINALIZE MANUSCRIPT: GENERATE BACK COVER' : 'CONGRATULATIONS: NOVEL COMPLETED!'}
                </h3>
              </div>
              <button 
                onClick={() => setIsEndNovelModalOpen(false)}
                className="text-cyan-600 hover:text-cyan-400 cursor-pointer p-1 rounded-lg hover:bg-cyan-950/40"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 flex-grow overflow-y-auto max-h-[70vh]">
              
              {endNovelStep === 'input' ? (
                <div className="space-y-4 text-xs animate-fade-in">
                  
                  {/* Explanation Banner */}
                  <div className="p-4 bg-cyan-950/20 border border-cyan-500/20 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-cyan-400 uppercase block">Back Cover Composition Module</span>
                    <p className="text-[10px] text-slate-400 leading-relaxed">Seal your journey with a polished book back cover! We will generate a theatrical blurb, embed a custom QR code linked to your project profiles, and generate a real barcodes block.</p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center pb-1">
                      <label className="text-[9px] uppercase text-slate-400 font-bold">Theatrical Book Blurb</label>
                      <button
                        onClick={generateBackCoverBlurb}
                        disabled={isGeneratingBlurb}
                        className="text-[9px] text-cyan-400 uppercase font-bold hover:underline cursor-pointer flex items-center gap-1"
                      >
                        {isGeneratingBlurb ? (
                          <>
                            <div className="w-2.5 h-2.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                            WEAVING BLURB...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3 h-3" />
                            AI RE-WEAVE BLURB WITH GEMINI
                          </>
                        )}
                      </button>
                    </div>
                    <textarea 
                      value={backBlurb}
                      onChange={(e) => setBackBlurb(e.target.value)}
                      rows={5}
                      className="w-full bg-[#02040a] border border-cyan-950 p-2.5 text-cyan-200 rounded font-mono leading-relaxed"
                      placeholder="Enter the exciting blurb to print on your back cover..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase text-slate-400 font-bold">Author Bio</label>
                      <input 
                        type="text"
                        value={backAuthorBio}
                        onChange={(e) => setBackAuthorBio(e.target.value)}
                        className="w-full bg-[#02040a] border border-cyan-950 p-2 text-cyan-200 rounded font-mono"
                        placeholder="e.g. A visionary wordsmith in Portland writing cyberpunk novels."
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase text-slate-400 font-bold">Price Code / Barcode Metadata</label>
                      <input 
                        type="text"
                        value={backPriceCode}
                        onChange={(e) => setBackPriceCode(e.target.value)}
                        className="w-full bg-[#02040a] border border-cyan-950 p-2 text-cyan-200 rounded font-mono"
                        placeholder="e.g. $14.99 USD / £12.99 GBP"
                      />
                    </div>
                  </div>

                </div>
              ) : (
                /* Success / Published celebration step! */
                <div className="space-y-6 text-xs text-center animate-fade-in">
                  
                  {/* Congratulations Callout */}
                  <div className="space-y-2 py-4 border-b border-cyan-950/60 max-w-xl mx-auto">
                    <div className="inline-block px-3 py-1 bg-emerald-950/40 border border-emerald-500/30 rounded-full text-[10px] text-emerald-400 font-bold uppercase animate-bounce">
                      ★ TRANSMISSION SEALED & ARCHIVED ★
                    </div>
                    <h2 className="text-xl font-bold tracking-widest text-white uppercase glow-cyan font-mono">
                      "{coverTitle}" IS OFFICIALLY COMPLETE!
                    </h2>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Your manuscript has been compiled. A finalized back cover artwork containing dynamic barcodes, publisher blocks, and a visual QR link has been appended to file path <span className="text-cyan-400">999_Back_Cover_Page.txt</span>.
                    </p>
                  </div>

                  {/* Covers Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
                    
                    {/* Front Cover Card */}
                    <div className="flex flex-col items-center gap-3">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">FRONT COVER</span>
                      <div className="w-[240px] h-[320px] rounded-xl overflow-hidden shadow-2xl border border-cyan-500/15 bg-slate-950">
                        {coverType === 'design' ? (
                          <img 
                            src={generateCustomCover(
                              coverTitle,
                              coverSubtitle,
                              coverAuthor,
                              newProjectGenre,
                              customBgType,
                              customPrimaryColor,
                              customSecondaryColor,
                              customFont,
                              customTitleSize,
                              customTitleY,
                              customSubtitleY,
                              customAuthorY
                            )} 
                            alt="Front Cover" 
                            className="w-full h-full object-cover"
                          />
                        ) : uploadedCover ? (
                          <img 
                            src={uploadedCover} 
                            alt="Front Cover" 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-slate-900 flex items-center justify-center">No Front Art</div>
                        )}
                      </div>
                    </div>

                    {/* Back Cover Card */}
                    <div className="flex flex-col items-center gap-3">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">FINAL BACK COVER</span>
                      <div className="w-[240px] h-[320px] rounded-xl overflow-hidden shadow-2xl border border-cyan-500/15 bg-slate-950">
                        {backCoverImg ? (
                          <img 
                            src={backCoverImg} 
                            alt="Back Cover Artwork" 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-slate-900 flex items-center justify-center">No Back Art</div>
                        )}
                      </div>
                    </div>

                  </div>

                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="bg-[#080f22] px-5 py-4 border-t border-cyan-950/60 flex items-center justify-end gap-2.5">
              {endNovelStep === 'input' ? (
                <>
                  <button 
                    onClick={() => setIsEndNovelModalOpen(false)}
                    className="bg-[#02040a] border border-cyan-950 text-cyan-600 hover:text-cyan-400 px-4 py-2 rounded-lg text-xs font-bold cursor-pointer font-mono"
                  >
                    CANCEL
                  </button>
                  <button 
                    onClick={finalizeEndNovel}
                    className="bg-emerald-500 hover:bg-emerald-400 border border-emerald-500 text-black px-5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-md shadow-emerald-500/15 uppercase tracking-wider font-mono flex items-center gap-1.5"
                  >
                    <BookOpen className="w-4 h-4" />
                    SEAL MANUSCRIPT & GENERATE COVERS
                  </button>
                </>
              ) : (
                <button 
                  onClick={() => setIsEndNovelModalOpen(false)}
                  className="bg-cyan-500 hover:bg-cyan-400 border border-cyan-500 text-black px-6 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-md shadow-cyan-500/15 uppercase tracking-wider font-mono"
                >
                  DISMISS & RETURN TO WORKSPACE
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* --- MOCK DIALOG ALERT BOX --- */}
      {simulatedDialog && simulatedDialog.isOpen && (
        <div className="fixed inset-0 bg-[#02040a]/85 flex items-center justify-center p-4 z-50 animate-fade-in backdrop-blur-xs">
          <div className="bg-[#050a16] border border-cyan-500/30 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl relative font-mono text-xs">
            
            {/* Corner brackets */}
            <div className="corner-bracket-tl" />
            <div className="corner-bracket-tr" />
            <div className="corner-bracket-bl" />
            <div className="corner-bracket-br" />

            {/* Dialog Header */}
            <div className="bg-[#080f22] px-4 py-3 border-b border-cyan-950/60 flex items-center gap-2">
              {simulatedDialog.type === 'warn' ? (
                <AlertTriangle className="text-amber-500 w-5 h-5 flex-shrink-0" />
              ) : (
                <Info className="text-cyan-400 w-5 h-5 flex-shrink-0 animate-pulse" />
              )}
              <h4 className="font-bold text-white uppercase tracking-wider">{simulatedDialog.title}</h4>
            </div>

            {/* Dialog Body */}
            <div className="p-5">
              <p className="text-cyan-100 whitespace-pre-wrap leading-relaxed">
                {simulatedDialog.message}
              </p>
            </div>

            {/* Dialog Footer */}
            <div className="bg-[#080f22] px-4 py-3 border-t border-cyan-950/60 flex justify-end gap-2.5">
              {simulatedDialog.type === 'confirm-delete-project' ? (
                <>
                  <button 
                    onClick={() => {
                      deleteEntireProject();
                    }}
                    className="bg-rose-600 hover:bg-rose-500 text-white font-bold font-mono text-xs px-4 py-2 rounded-lg transition-all cursor-pointer uppercase tracking-wider"
                  >
                    PROCEED PURGE
                  </button>
                  <button 
                    onClick={() => setSimulatedDialog(null)}
                    className="bg-[#02040a] border border-cyan-950 text-cyan-600 hover:text-cyan-400 font-bold font-mono text-xs px-4 py-2 rounded-lg transition-all cursor-pointer"
                  >
                    CANCEL
                  </button>
                </>
              ) : simulatedDialog.type === 'confirm-delete-active' ? (
                <>
                  <button 
                    onClick={() => {
                      deleteActiveFile();
                    }}
                    className="bg-rose-600 hover:bg-rose-500 text-white font-bold font-mono text-xs px-4 py-2 rounded-lg transition-all cursor-pointer uppercase tracking-wider"
                  >
                    DELETE NODE
                  </button>
                  <button 
                    onClick={() => setSimulatedDialog(null)}
                    className="bg-[#02040a] border border-cyan-950 text-cyan-600 hover:text-cyan-400 font-bold font-mono text-xs px-4 py-2 rounded-lg transition-all cursor-pointer"
                  >
                    CANCEL
                  </button>
                </>
              ) : (
                <button 
                  onClick={() => setSimulatedDialog(null)}
                  className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold px-4 py-2 rounded-lg transition-all cursor-pointer"
                >
                  ACKNOWLEDGE
                </button>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
