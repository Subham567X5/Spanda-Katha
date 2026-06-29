export const pythonSourceCode = `#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
KathaSpanda - Production-Ready Scrivener Clone for Long-Form Novel Projects
Theme: Futuristic Year 3000 Cyber-Terminal
Framework: PySide2 (Qt for Python)
License: Apache-2.0
"""

import os
import sys
import re
import shutil
from PySide2.QtCore import Qt, QSize, QDir, QFileInfo, QEvent
from PySide2.QtGui import QFont, QColor, QPalette, QPixmap, QTextCursor, QTextBlockFormat
from PySide2.QtWidgets import (
    QApplication, QMainWindow, QWidget, QHBoxLayout, QVBoxLayout,
    QSplitter, QTreeView, QTextEdit, QLabel, QFileSystemModel,
    QFileDialog, QMessageBox, QFrame, QStyle, QLineEdit
)

class ImageSlotLabel(QLabel):
    """
    Custom QLabel subclass that acts as an interactive holographic slot.
    Handles mouse press events to select an image, copy it to the local project folder
    associated with the currently active text file, and smoothly scales the image on resize.
    """
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setAlignment(Qt.AlignCenter)
        self.setWordWrap(True)
        self.setStyleSheet("""
            QLabel {
                border: 2px dashed #00f0ff;
                background-color: #0e121a;
                color: #00f0ff;
                font-size: 11pt;
                font-family: 'Consolas', 'JetBrains Mono', monospace;
                padding: 15px;
                border-radius: 8px;
            }
            QLabel:hover {
                border-color: #39ff14;
                background-color: #121b24;
                color: #39ff14;
            }
        """)
        self.setText("[ LINK NEURAL ART WORKSPACES ]\\n\\nClick to load cybernetic\\nreference stream for this chapter.")
        self.setCursor(Qt.PointingHandCursor)

    def mousePressEvent(self, event):
        if event.button() == Qt.LeftButton:
            window = self.window()
            if hasattr(window, "handle_image_slot_click"):
                window.handle_image_slot_click()
        super().mousePressEvent(event)


class KathaSpanda(QMainWindow):
    def __init__(self):
        super().__init__()
        self.current_filepath = None
        self.project_root = self.init_project_structure()
        self.init_ui()

    def init_project_structure(self) -> str:
        """
        Initializes the project structure under the user's home directory if it doesn't exist.
        Returns the absolute path of the 'KathaSpanda_Novel_Project' root folder.
        """
        home_dir = os.path.expanduser("~")
        root_path = os.path.join(home_dir, "KathaSpanda_Novel_Project")
        
        # Ensure root directory exists
        if not os.path.exists(root_path):
            os.makedirs(root_path)
            
        manuscript_path = os.path.join(root_path, "1. Manuscript")
        notes_path = os.path.join(root_path, "2. Character & World Notes")
        
        # Generate Manuscript Directory and 100 chapters if missing
        if not os.path.exists(manuscript_path):
            os.makedirs(manuscript_path)
            for i in range(1, 101):
                chap_name = f"Chapter_{i:03d}.txt"
                chap_file = os.path.join(manuscript_path, chap_name)
                with open(chap_file, "w", encoding="utf-8") as f:
                    f.write(f"--- CHAPTER {i:03d} ---\\n\\nWrite your quantum-linked chronicle here...\\n")
                    
        # Generate Notes Directory and default files if missing
        if not os.path.exists(notes_path):
            os.makedirs(notes_path)
            
            # Characters Note
            char_file = os.path.join(notes_path, "Characters.txt")
            if not os.path.exists(char_file):
                with open(char_file, "w", encoding="utf-8") as f:
                    f.write("=== COGNITIVE ENTITY SIGNATURES ===\\n\\nPROTAGONIST:\\n- Name: \\n- Neural Motivation: \\n\\nANTAGONIST:\\n- Name: \\n- Adversarial Pattern: \\n\\nSUPPORTING NODES:\\n- Profile 1:\\n")
            
            # World Rules Note
            world_file = os.path.join(notes_path, "World_Rules.txt")
            if not os.path.exists(world_file):
                with open(world_file, "w", encoding="utf-8") as f:
                    f.write("=== SECTOR PROTOCOLS & CORE PHYSICS ===\\n\\nSETTING SPECIFICATION:\\n- Grid Coordinates: \\n\\nCOSMIC CONSTRAINTS:\\n- 1. Neural uplink bandwidth limit:\\n- 2. Deuterium cooling rates:\\n")
                    
        return root_path

    def init_ui(self):
        self.setWindowTitle("KATHASPANDA // V3000")
        self.setMinimumSize(1100, 750)
        self.apply_dark_theme()

        # Core Splitter: divides the window into three panels
        main_splitter = QSplitter(Qt.Horizontal, self)
        self.setCentralWidget(main_splitter)

        # -------------------------------------------------------------
        # PANEL 1: LEFT TREE NAVIGATION (NEURAL OUTLINE)
        # -------------------------------------------------------------
        left_widget = QWidget()
        left_layout = QVBoxLayout(left_widget)
        left_layout.setContentsMargins(10, 10, 10, 10)
        
        nav_label = QLabel("NEURAL CORE OUTLINE")
        nav_label.setStyleSheet("font-weight: bold; color: #00f0ff; font-size: 10pt; letter-spacing: 2px; margin-bottom: 5px;")
        left_layout.addWidget(nav_label)

        self.file_model = QFileSystemModel()
        self.file_model.setRootPath(self.project_root)
        self.file_model.setFilter(QDir.NoDotAndDotDot | QDir.AllDirs | QDir.Files)

        self.tree_view = QTreeView()
        self.tree_view.setModel(self.file_model)
        self.tree_view.setRootIndex(self.file_model.index(self.project_root))
        self.tree_view.setHeaderHidden(True)

        # Hide file size, kind, and modification date columns (only show Name)
        for col in range(1, self.file_model.columnCount()):
            self.tree_view.setColumnHidden(col, True)

        self.tree_view.selectionModel().selectionChanged.connect(self.on_tree_selection_changed)
        left_layout.addWidget(self.tree_view)

        # -------------------------------------------------------------
        # PANEL 2: CENTER TEXT EDITOR & COMPLIANCE TELEMETRY
        # -------------------------------------------------------------
        center_widget = QWidget()
        center_layout = QVBoxLayout(center_widget)
        center_layout.setContentsMargins(0, 10, 0, 10)

        # Text Edit Area
        self.text_editor = QTextEdit()
        self.text_editor.setStyleSheet("""
            QTextEdit {
                background-color: #08090d;
                color: #c5d1e0;
                font-family: 'Segoe UI', 'Calibri', Arial, sans-serif;
                font-size: 13pt;
                padding: 40px 50px;
                border: 1px solid #132237;
                border-radius: 8px;
            }
        """)
        # Ensure focus out also triggers intermediate saves
        self.text_editor.textChanged.connect(self.on_text_changed)
        center_layout.addWidget(self.text_editor)

        # Separator line
        sep = QFrame()
        sep.setFrameShape(QFrame.HLine)
        sep.setFrameShadow(QFrame.Sunken)
        sep.setStyleSheet("background-color: #00f0ff; max-height: 1px; border: none;")
        center_layout.addWidget(sep)

        # Live Word Count Label (Status bar style with futuristic specs)
        self.word_count_label = QLabel("SYNAPSES HARVESTED: 0 / 1500 (0% COMPLIANCE)")
        self.word_count_label.setStyleSheet("color: #00f0ff; font-weight: bold; font-family: 'Consolas', 'JetBrains Mono', monospace; font-size: 11px; padding: 5px 20px;")
        center_layout.addWidget(self.word_count_label)

        # -------------------------------------------------------------
        # PANEL 3: RIGHT CHAPTER ART SLOT
        # -------------------------------------------------------------
        right_widget = QWidget()
        right_widget.setFixedWidth(280)
        right_layout = QVBoxLayout(right_widget)
        right_layout.setContentsMargins(15, 10, 15, 15)

        right_header = QLabel("HOLOGRAPHIC CHRONICLE ART")
        right_header.setStyleSheet("font-weight: bold; color: #00f0ff; font-size: 9pt; letter-spacing: 1px; margin-bottom: 5px;")
        right_header.setWordWrap(True)
        right_layout.addWidget(right_header)

        # Image Label Slot
        self.image_label = ImageSlotLabel()
        self.image_label.setMinimumHeight(240)
        right_layout.addWidget(self.image_label)
        
        # Info Box inside the right panel
        info_label = QLabel(
            "SYS_LOG: Establish neural art vectors to bind with chronicle streams. "
            "Data models will clone dynamically with matching index."
        )
        info_label.setWordWrap(True)
        info_label.setStyleSheet("color: #4a6a8a; font-family: 'Consolas', monospace; font-size: 9pt; line-height: 1.4;")
        right_layout.addWidget(info_label)
        right_layout.addStretch()

        # Add widgets to horizontal splitter
        main_splitter.addWidget(left_widget)
        main_splitter.addWidget(center_widget)
        main_splitter.addWidget(right_widget)

        # Set stretch factors for splitter (left=1, center=3, right=0 due to fixed size)
        main_splitter.setStretchFactor(0, 1)
        main_splitter.setStretchFactor(1, 3)
        main_splitter.setStretchFactor(2, 0)

        # Initial view state
        self.text_editor.setEnabled(False)
        self.image_label.setEnabled(False)

    def apply_dark_theme(self):
        """
        Applies a breathtakingly high-tech Year 3000 Neon Cyber Terminal theme.
        """
        self.setStyleSheet("""
            QMainWindow {
                background-color: #040508;
            }
            QWidget {
                background-color: #040508;
                color: #e2e8f0;
                font-family: 'Consolas', 'JetBrains Mono', 'Segoe UI', sans-serif;
            }
            QSplitter::handle {
                background-color: #101c2c;
                width: 6px;
            }
            QSplitter::handle:hover {
                background-color: #00f0ff;
            }
            QTreeView {
                background-color: #080b11;
                border: 1px solid #14293f;
                color: #a5b4fc;
                font-size: 11pt;
                outline: none;
                border-radius: 6px;
            }
            QTreeView::item {
                padding: 6px;
                border-radius: 4px;
            }
            QTreeView::item:hover {
                background-color: #112135;
                color: #00f0ff;
            }
            QTreeView::item:selected {
                background-color: #162f4e;
                color: #39ff14;
                font-weight: bold;
                border: 1px solid #00f0ff;
            }
            QScrollBar:vertical {
                border: none;
                background: #040508;
                width: 10px;
                margin: 0px;
            }
            QScrollBar::handle:vertical {
                background: #14293f;
                min-height: 20px;
                border-radius: 5px;
            }
            QScrollBar::handle:vertical:hover {
                background: #00f0ff;
            }
            QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {
                height: 0px;
            }
        """)

    def on_tree_selection_changed(self, selected, deselected):
        indexes = selected.indexes()
        if not indexes:
            return

        index = indexes[0]
        filepath = self.file_model.filePath(index)

        # 1. AUTO-SAVE PREVIOUS FILE before shifting focus
        if self.current_filepath and os.path.exists(self.current_filepath):
            if self.current_filepath.endswith(".txt"):
                self.save_file(self.current_filepath)

        # 2. LOAD NEW FILE
        if os.path.isfile(filepath):
            self.current_filepath = filepath
            self.text_editor.setEnabled(True)
            self.image_label.setEnabled(True)
            self.load_file(filepath)
            self.update_image_display()
        else:
            # Selection is a directory, disable editing/image slot
            self.current_filepath = None
            self.text_editor.clear()
            self.text_editor.setEnabled(False)
            self.image_label.setPixmap(QPixmap())
            self.image_label.setText("[ LINK NEURAL ART WORKSPACES ]\\n\\nClick to load cybernetic\\nreference stream for this chapter.")
            self.image_label.setEnabled(False)
            self.word_count_label.setText("SYNAPSES HARVESTED: 0 / 1500 (0% COMPLIANCE)")
            self.word_count_label.setStyleSheet("color: #00f0ff; font-weight: bold; font-family: 'Consolas', monospace;")

    def load_file(self, filepath: str):
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                content = f.read()
            
            # Temporarily disconnect textChanged signal to prevent count calculations during load
            self.text_editor.textChanged.disconnect(self.on_text_changed)
            
            self.text_editor.setPlainText(content)
            
            # Reconnect signal
            self.text_editor.textChanged.connect(self.on_text_changed)
            
            self.apply_editor_formatting()
            self.update_word_count()
        except Exception as e:
            QMessageBox.critical(self, "SYSTEM FAULT", f"Uplink compromised. Failed to read stream:\\n{str(e)}")

    def save_file(self, filepath: str):
        if not filepath:
            return
        try:
            content = self.text_editor.toPlainText()
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(content)
        except Exception as e:
            QMessageBox.critical(self, "UPLINK ERROR", f"Buffer flush failed:\\n{str(e)}")

    def apply_editor_formatting(self):
        """
        Sets font to Calibri 13pt and forces document to 150% line-height.
        """
        font = QFont("Calibri", 13)
        self.text_editor.setFont(font)
        
        # Merge block format across the entire document
        cursor = self.text_editor.textCursor()
        cursor.select(QTextCursor.Document)
        block_fmt = QTextBlockFormat()
        block_fmt.setLineHeight(150, QTextBlockFormat.ProportionalHeight)
        cursor.mergeBlockFormat(block_fmt)
        cursor.clearSelection()
        self.text_editor.setTextCursor(cursor)

    def on_text_changed(self):
        self.update_word_count()

    def update_word_count(self):
        text = self.text_editor.toPlainText()
        # Count words (regex handles word separation robustly)
        words = len(re.findall(r'\\b\\w+\\b', text))
        target = 1500
        percentage = int((words / target) * 100) if target > 0 else 0
        
        self.word_count_label.setText(f"SYNAPSES COMPACTED: {words:,} / {target:,} ({percentage}% COMPLIANCE)")
        
        if words >= target:
            self.word_count_label.setStyleSheet("color: #39ff14; font-weight: bold; font-family: 'Consolas', monospace; font-size: 11px; padding: 5px 20px;")
        else:
            self.word_count_label.setStyleSheet("color: #00f0ff; font-weight: bold; font-family: 'Consolas', monospace; font-size: 11px; padding: 5px 20px;")

    def update_image_display(self):
        """
        Scales and displays the active chapter's corresponding image smoothly.
        """
        if not self.current_filepath or not self.current_filepath.endswith(".txt"):
            return
            
        base_path, _ = os.path.splitext(self.current_filepath)
        png_path = base_path + ".png"
        
        if os.path.exists(png_path):
            pixmap = QPixmap(png_path)
            if not pixmap.isNull():
                # Scale smoothly while preserving aspect ratio
                # Margins included for a cleaner UI experience
                scaled_pixmap = pixmap.scaled(
                    self.image_label.width() - 10,
                    self.image_label.height() - 10,
                    Qt.KeepAspectRatio,
                    Qt.SmoothTransformation
                )
                self.image_label.setPixmap(scaled_pixmap)
            else:
                self.image_label.setText("[ LINK NEURAL ART WORKSPACES ]\\n\\nClick to load cybernetic\\nreference stream for this chapter.")
        else:
            self.image_label.setPixmap(QPixmap())
            self.image_label.setText("[ LINK NEURAL ART WORKSPACES ]\\n\\nClick to load cybernetic\\nreference stream for this chapter.")

    def handle_image_slot_click(self):
        if not self.current_filepath:
            return
            
        file_path, _ = QFileDialog.getOpenFileName(
            self, "Choose AI Reference Art", "", 
            "Image Files (*.png *.jpg *.jpeg)"
        )
        
        if file_path:
            base_path, _ = os.path.splitext(self.current_filepath)
            target_png_path = base_path + ".png"
            
            try:
                # Copy the file dynamically to project root and rename to chapter.png
                shutil.copy(file_path, target_png_path)
                self.update_image_display()
            except Exception as e:
                QMessageBox.critical(self, "SYS FAIL", f"Holographic vector bind failed:\\n{str(e)}")

    def closeEvent(self, event):
        """
        Override closeEvent to safely flush any active modifications to disk before termination.
        """
        if self.current_filepath and os.path.exists(self.current_filepath):
            try:
                self.save_file(self.current_filepath)
            except Exception as e:
                QMessageBox.critical(self, "SHUTDOWN FAULT", f"Critical state flush interrupted:\\n{str(e)}")
        event.accept()


if __name__ == "__main__":
    app = QApplication(sys.argv)
    
    # Enable high DPI scaling
    if hasattr(Qt, 'AA_EnableHighDpiScaling'):
        QApplication.setAttribute(Qt.AA_EnableHighDpiScaling, True)
    if hasattr(Qt, 'AA_UseHighDpiPixmaps'):
        QApplication.setAttribute(Qt.AA_UseHighDpiPixmaps, True)
        
    writer = KathaSpanda()
    writer.show()
    sys.exit(app.exec_())
`;
