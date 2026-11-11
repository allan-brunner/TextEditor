import { TextDocument } from "./model/document.js";
import { Renderer } from "./view/renderer.js";
import { Theme } from "./view/theme.js";
import { InputController } from "./controller/input.js";
import { initHighlighter } from "./highlighters/index.js";
import { saveDocument } from "./storage.js";

export class Editor {
    constructor(canvas) {
        this.canvas = canvas;
        this.renderer = new Renderer(canvas);

        // Multi-document / tab registry
        this.documents = new Map();
        this.activeDoc = null;

        this.caretVisible = true;
        this.skipCaretChange = false;
        this.saveTimer = null;

        this.mousePos = null;

        // Open default document
        this.openDocument("default");

        this.input = new InputController(this, canvas);
    }

    openDocument(id, initialText = null) {
        let doc = this.documents.get(id);
        if (!doc) {
            doc = new TextDocument(id, initialText);
            this.documents.set(id, doc);
        } else if (initialText !== null) {
            doc.setText(initialText);
        }
        this.switchDocument(id);
        return doc;
    }

    switchDocument(id) {
        const doc = this.documents.get(id);
        if (!doc) return;
        this.activeDoc = doc;
        this.syncMetadataAndStates(0);
        this.render();
    }

    syncMetadataAndStates(startLine = 0) {
        const { lang, theme } = this.activeDoc.getMetadata();
        if (this.currentLang !== lang || this.highlighter?.doc !== this.activeDoc) {
            this.currentLang = lang;
            this.highlighter = initHighlighter(lang, this.activeDoc);
            startLine = 0; // Full state pass when language or document changes
        }
        this.theme = Theme.get(theme);
        this.highlighter.updateStates(startLine);
    }

    onDocumentChanged(startLine = 0) {
        this.syncMetadataAndStates(startLine);
        this.scheduleSave();
    }

    scheduleSave() {
        const docToSave = this.activeDoc;
        if (this.saveTimer) clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(async () => {
            this.saveTimer = null;
            await saveDocument({
                id: docToSave.id,
                text: docToSave.getText(),
                updatedAt: Date.now()
            });
        }, 300);
    }

    // --- Clipboard Actions ---

    copy(e) {
        const text = this.activeDoc.getSelectionText();
        if (!text) return;
        e.preventDefault();
        e.clipboardData.setData("text/plain", text);
    }

    cut(e) {
        if (!this.activeDoc.inSelection) return;
        this.copy(e);
        const startLine = this.activeDoc.getOrderedSelection().start.line;
        this.activeDoc.history.record(this.activeDoc.getStateSnapshot(), false);
        if (this.activeDoc.deleteSelection()) {
            this.resetCaretBlink();
            this.onDocumentChanged(startLine);
            this.renderer.ensureVisibleCursor(this.activeDoc);
            this.render();
        }
    }

    paste(e) {
        const text = e.clipboardData?.getData("text/plain");
        if (!text) return;
        e.preventDefault();
        const startLine = this.activeDoc.inSelection
            ? this.activeDoc.getOrderedSelection().start.line
            : this.activeDoc.cursor.line;
        this.activeDoc.insertText(text);
        this.resetCaretBlink();
        this.onDocumentChanged(startLine);
        this.renderer.ensureVisibleCursor(this.activeDoc);
        this.render();
    }

    // --- Rendering & Caret Loop ---

    setDpr(dpr) {
        this.renderer.setDpr(dpr);
    }

    resetCaretBlink() {
        this.caretVisible = true;
        this.skipCaretChange = true;
    }

    toggleCaret() {
        if (!this.skipCaretChange) {
            this.caretVisible = !this.caretVisible;
        } else {
            this.skipCaretChange = false;
        }
        this.render();
    }

    render() {
        if (!this.activeDoc) return;
        this.renderer.render(
            this.activeDoc,
            this.highlighter,
            this.theme,
            this.caretVisible,
            this.mousePos
        );
    }
}