import { TextDocument } from "./model/document.js";
import { Renderer } from "./view/renderer.js";
import { Theme } from "./view/theme.js";
import { InputController } from "./controller/input.js";
import { initHighlighter } from "./highlighters/index.js";
import { saveDocument, deleteDocument } from "./storage.js";

export class Editor {
    constructor(canvas) {
        this.canvas = canvas;
        this.renderer = new Renderer(canvas);

        this.documents = new Map();
        this.activeDoc = null;

        // Tab renaming state
        this.renamingTabId = null;
        this.renameDoc = null;

        this.caretVisible = true;
        this.skipCaretChange = false;
        this.saveTimer = null;
        this.mousePos = null;

        // Console state
        this.consoleOpen = false;
        this.consoleLogs = [
            { type: "info", text: "IDE Console ready. Press Ctrl+J or click '>_ Console' to toggle." }
        ];
        this.consoleScrollY = 0;

        this.openDocument("welcome.txt");

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
        if (this.renamingTabId && this.renamingTabId !== id) {
            this.finishRenameTab(true);
        }
        this.activeDoc = doc;
        this.syncMetadataAndStates(0);
        this.render();
    }

    createNewTab() {
        if (this.renamingTabId) this.finishRenameTab(true);
        let index = 1;
        while (this.documents.has(`script_${index}.js`)) {
            index++;
        }
        const id = `script_${index}.js`;
        const starter = `// ${id}\n\n`;
        this.openDocument(id, starter);
        this.scheduleSave();
    }

    get targetDoc() {
        return this.renamingTabId ? this.renameDoc : this.activeDoc;
    }

    startRenameTab(id) {
        if (!this.documents.has(id)) return;
        this.switchDocument(id);
        this.renamingTabId = id;
        this.renameDoc = new TextDocument("__rename__", id);

        const dotIdx = id.lastIndexOf(".");
        const endCol = dotIdx > 0 ? dotIdx : id.length;
        this.renameDoc.selection = {
            start: { line: 0, col: 0 },
            end: { line: 0, col: endCol }
        };
        this.renameDoc.inSelection = endCol > 0;
        this.renameDoc.setCursor(0, endCol);

        this.resetCaretBlink();
        this.render();
    }

    async finishRenameTab(commit = true) {
        if (!this.renamingTabId) return;
        const oldId = this.renamingTabId;
        const newId = this.renameDoc ? this.renameDoc.lineAt(0).content.trim() : "";

        this.renamingTabId = null;
        this.renameDoc = null;

        if (!commit || !newId || newId === oldId || this.documents.has(newId)) {
            this.render();
            return;
        }

        const updatedMap = new Map();
        for (const [key, doc] of this.documents) {
            if (key === oldId) {
                doc.id = newId;
                updatedMap.set(newId, doc);
            } else {
                updatedMap.set(key, doc);
            }
        }
        this.documents = updatedMap;

        this.syncMetadataAndStates(0);
        this.render();

        await deleteDocument(oldId);
        this.scheduleSave();
    }

    async closeDocument(id) {
        if (this.renamingTabId === id) {
            this.renamingTabId = null;
            this.renameDoc = null;
        }
        if (this.documents.size <= 1 || !this.documents.has(id)) return;
        this.documents.delete(id);
        await deleteDocument(id);

        if (this.activeDoc.id === id) {
            const firstRemainingId = this.documents.keys().next().value;
            this.switchDocument(firstRemainingId);
        } else {
            this.render();
        }
    }

    syncMetadataAndStates(startLine = 0) {
        const { lang, theme } = this.activeDoc.getMetadata();
        if (this.currentLang !== lang || this.highlighter?.doc !== this.activeDoc) {
            this.currentLang = lang;
            this.highlighter = initHighlighter(lang, this.activeDoc);
            startLine = 0;
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

    toggleConsole(forceState = null) {
        this.consoleOpen = forceState !== null ? forceState : !this.consoleOpen;
        this.renderer.ensureVisibleCursor(this.activeDoc, this.consoleOpen);
        this.render();
    }

    clearConsole() {
        this.consoleLogs = [];
        this.consoleScrollY = 0;
        this.render();
    }

    logToConsole(text, type = "info") {
        const lines = String(text).split("\n");
        for (const line of lines) {
            this.consoleLogs.push({ type, text: line });
        }
        const lineH = this.renderer.consoleLineHeight;
        const visibleH = this.renderer.consoleHeight - this.renderer.consoleHeaderHeight - 16;
        this.consoleScrollY = Math.max(0, this.consoleLogs.length * lineH - visibleH);
        this.render();
    }

    runActiveDocument() {
        this.toggleConsole(true);
        const file = this.activeDoc.id;
        const lang = this.currentLang || "TXT";
        const time = new Date().toLocaleTimeString();

        this.logToConsole(`[${time}] Running "${file}"...`, "info");
        this.logToConsole(
            `Error: Language "${lang}" is not supported by the interpreter yet.`,
            "error"
        );
    }

    copy(e) {
        const doc = this.targetDoc;
        const text = doc.getSelectionText();
        if (!text) return;
        e.preventDefault();
        e.clipboardData.setData("text/plain", text);
    }

    cut(e) {
        const doc = this.targetDoc;
        if (!doc.inSelection) return;
        this.copy(e);
        const startLine = doc.getOrderedSelection().start.line;
        doc.history.record(doc.getStateSnapshot(), false);
        if (doc.deleteSelection()) {
            this.resetCaretBlink();
            if (!this.renamingTabId) {
                this.onDocumentChanged(startLine);
                this.renderer.ensureVisibleCursor(doc);
            }
            this.render();
        }
    }

    paste(e) {
        const rawText = e.clipboardData?.getData("text/plain");
        if (!rawText) return;
        e.preventDefault();

        const doc = this.targetDoc;
        const text = this.renamingTabId ? rawText.replace(/[\r\n]/g, "") : rawText;

        const startLine = doc.inSelection
            ? doc.getOrderedSelection().start.line
            : doc.cursor.line;
        doc.insertText(text);
        this.resetCaretBlink();

        if (!this.renamingTabId) {
            this.onDocumentChanged(startLine);
            this.renderer.ensureVisibleCursor(doc);
        }
        this.render();
    }

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
            this.documents,
            this.highlighter,
            this.theme,
            this.caretVisible,
            this.mousePos,
            {
                renamingTabId: this.renamingTabId,
                renameDoc: this.renameDoc,
                consoleOpen: this.consoleOpen,
                consoleLogs: this.consoleLogs,
                consoleScrollY: this.consoleScrollY,
                resizingConsole: Boolean(this.input?.resizingConsole)
            }
        );
    }
}