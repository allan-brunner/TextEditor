export class InputController {
    constructor(editor, canvas) {
        this.editor = editor;
        this.canvas = canvas;
        this.lastClick = 0;
        this.nbClick = 0;
        this.draggingText = false;
        this.draggingRename = false;
        this.resizingConsole = false;

        this._bindEvents();
    }

    _bindEvents() {
        window.addEventListener("keydown", (e) => this.onKeyDown(e));
        window.addEventListener("paste", (e) => this.editor.paste(e));
        window.addEventListener("copy", (e) => this.editor.copy(e));
        window.addEventListener("cut", (e) => this.editor.cut(e));

        this.canvas.addEventListener("mousedown", (e) => this.onMouseDown(e));
        this.canvas.addEventListener("click", (e) => this.onMouseClick(e));
        this.canvas.addEventListener("mousemove", (e) => this.onMouseMove(e));
        this.canvas.addEventListener("wheel", (e) => this.onWheel(e), { passive: false });
        window.addEventListener("mouseup", () => {
            if (this.resizingConsole) {
                this.resizingConsole = false;
                this.editor.render();
            }
        });
        this.canvas.addEventListener("mouseleave", () => {
            this.editor.mousePos = null;
            this.editor.render();
        });
    }

    onMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const shift = e.shiftKey;

        const hit = this.editor.renderer.hitTestUI(x, y, this.editor.consoleOpen);
        if (hit) {
            this.draggingText = false;
            this.draggingRename = false;
            this.resizingConsole = false;

            if (hit.type === "resize_console") {
                this.resizingConsole = true;
                this.editor.render();
                return;
            } else if (hit.type === "tab") {
                if (this.editor.renamingTabId === hit.id && this.editor.renameDoc) {
                    this.draggingRename = true;
                    const rDoc = this.editor.renameDoc;
                    const col = this.editor.renderer.posFromRenameInput(x, rDoc);
                    const prevCol = rDoc.cursor.col;
                    rDoc.setCursor(0, col);
                    rDoc.selectToCursor(shift, 0, prevCol);
                    this.editor.resetCaretBlink();
                    this.editor.render();
                    return;
                }
                if (this.editor.renamingTabId && this.editor.renamingTabId !== hit.id) {
                    this.editor.finishRenameTab(true);
                }
                this.editor.switchDocument(hit.id);
            } else {
                if (this.editor.renamingTabId) {
                    this.editor.finishRenameTab(true);
                }
                if (hit.type === "close_tab") {
                    this.editor.closeDocument(hit.id);
                } else if (hit.type === "new_tab") {
                    this.editor.createNewTab();
                } else if (hit.type === "run") {
                    this.editor.runActiveDocument();
                } else if (hit.type === "toggle_console" || hit.type === "close_console") {
                    this.editor.toggleConsole();
                } else if (hit.type === "clear_console") {
                    this.editor.clearConsole();
                }
            }
            return;
        }

        if (this.editor.renamingTabId) {
            this.editor.finishRenameTab(true);
        }

        this.draggingText = true;
        this.draggingRename = false;
        const doc = this.editor.activeDoc;

        this.editor.resetCaretBlink();
        const pos = this.editor.renderer.posFromMouseEvent(e, doc);
        const { line, col } = doc.cursor;

        doc.setCursor(pos.line, pos.col);
        doc.selectToCursor(shift, line, col);

        this.editor.renderer.ensureVisibleCursor(doc, this.editor.consoleOpen);
        this.editor.render();
    }

    onMouseClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const now = Date.now();
        const renderer = this.editor.renderer;

        if (y <= renderer.topBarHeight) {
            const hit = renderer.hitTestUI(x, y, this.editor.consoleOpen);
            if (hit && hit.type === "tab") {
                if (now - this.lastClick < 350) {
                    if (this.editor.renamingTabId === hit.id && this.editor.renameDoc) {
                        this.editor.renameDoc.selectWordAt(0, this.editor.renameDoc.cursor.col);
                        this.editor.render();
                    } else {
                        this.editor.startRenameTab(hit.id);
                    }
                    this.nbClick = 0;
                } else {
                    this.nbClick = 1;
                }
                this.lastClick = now;
            }
            return;
        }

        const canvasH = this.canvas.height / renderer.dpr;
        if (this.editor.consoleOpen && y >= canvasH - renderer.consoleHeight) {
            return;
        }

        const doc = this.editor.activeDoc;
        if (now - this.lastClick < 250) {
            this.nbClick++;
            if (this.nbClick === 2) {
                doc.selectWordAt(doc.cursor.line, doc.cursor.col);
            } else if (this.nbClick >= 3) {
                doc.selectLineAt(doc.cursor.line);
                this.nbClick = 3;
            }
        } else {
            this.nbClick = 1;
        }

        this.lastClick = now;
        this.editor.render();
    }

    onMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        this.editor.mousePos = { x, y };

        if (e.buttons === 1 && this.resizingConsole) {
            e.preventDefault();
            const renderer = this.editor.renderer;
            const canvasH = this.canvas.height / renderer.dpr;
            renderer.setConsoleHeight(canvasH - y);

            const lineH = renderer.consoleLineHeight;
            const visibleH = renderer.consoleHeight - renderer.consoleHeaderHeight - 16;
            const maxScroll = Math.max(0, this.editor.consoleLogs.length * lineH - visibleH);
            this.editor.consoleScrollY = Math.min(this.editor.consoleScrollY, maxScroll);

            renderer.ensureVisibleCursor(this.editor.activeDoc, this.editor.consoleOpen);
            this.editor.render();
            return;
        } else if (e.buttons === 1 && this.draggingRename && this.editor.renameDoc) {
            e.preventDefault();
            const rDoc = this.editor.renameDoc;
            const col = this.editor.renderer.posFromRenameInput(x, rDoc);
            const prevCol = rDoc.cursor.col;
            rDoc.setCursor(0, col);
            rDoc.selectToCursor(true, 0, prevCol);
            this.editor.resetCaretBlink();
            this.editor.render();
            return;
        }

        if (e.buttons !== 1 || !this.draggingText) {
            this.editor.render();
            return;
        }

        e.preventDefault();
        const doc = this.editor.activeDoc;
        this.editor.resetCaretBlink();

        const pos = this.editor.renderer.posFromMouseEvent(e, doc);
        const { line, col } = doc.cursor;

        doc.setCursor(pos.line, pos.col);
        doc.selectToCursor(true, line, col);

        this.editor.renderer.ensureVisibleCursor(doc);
        this.editor.render();
    }

    onWheel(e) {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const ctrl = e.ctrlKey || e.metaKey;
        const renderer = this.editor.renderer;
        const canvasH = this.canvas.height / renderer.dpr;

        if (this.editor.consoleOpen && y >= canvasH - renderer.consoleHeight) {
            if (ctrl) {
                renderer.zoomConsole(e.deltaY);
            } else {
                const lineH = renderer.consoleLineHeight;
                const visibleH = renderer.consoleHeight - renderer.consoleHeaderHeight - 16;
                const maxScroll = Math.max(0, this.editor.consoleLogs.length * lineH - visibleH);
                this.editor.consoleScrollY = Math.max(
                    0,
                    Math.min(maxScroll, this.editor.consoleScrollY + e.deltaY)
                );
            }
            const lineH = renderer.consoleLineHeight;
            const visibleH = renderer.consoleHeight - renderer.consoleHeaderHeight - 16;
            const maxScroll = Math.max(0, this.editor.consoleLogs.length * lineH - visibleH);
            this.editor.consoleScrollY = Math.max(0, Math.min(maxScroll, this.editor.consoleScrollY));

            this.editor.render();
            return;
        }

        const doc = this.editor.activeDoc;
        if (!ctrl) {
            const maxScrollY = Math.max(0, (doc.getNbLines() - 1) * renderer.lineHeight);
            doc.scrollY = Math.max(0, Math.min(maxScrollY, doc.scrollY + e.deltaY));
            if (e.deltaX) {
                doc.scrollX = Math.max(0, doc.scrollX + e.deltaX);
            }
        } else {
            renderer.zoom(e.deltaY);
        }

        this.editor.render();
    }

    onKeyDown(e) {
        if (e.altKey) return;

        const isRenaming = Boolean(this.editor.renamingTabId);
        if (isRenaming) {
            if (e.key === "Enter") {
                e.preventDefault();
                this.editor.finishRenameTab(true);
                return;
            }
            if (e.key === "Escape") {
                e.preventDefault();
                this.editor.finishRenameTab(false);
                return;
            }
            if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Tab"].includes(e.key)) {
                e.preventDefault();
                return;
            }
        }

        const ctrl = e.ctrlKey || e.metaKey;
        const shift = e.shiftKey;
        const doc = this.editor.targetDoc;
        let textChanged = false;
        let editLine = doc.cursor.line;

        switch (e.key) {
            case "ArrowRight":
                e.preventDefault();
                doc.moveRight({ ctrl, shift });
                break;
            case "ArrowLeft":
                e.preventDefault();
                doc.moveLeft({ ctrl, shift });
                break;
            case "ArrowUp":
                e.preventDefault();
                doc.moveUp({ ctrl, shift });
                break;
            case "ArrowDown":
                e.preventDefault();
                doc.moveDown({ ctrl, shift });
                break;
            case "End":
                e.preventDefault();
                doc.moveEnd({ ctrl, shift });
                break;
            case "Home":
                e.preventDefault();
                doc.moveHome({ ctrl, shift });
                break;
            case "PageUp":
                e.preventDefault();
                doc.movePageUp({
                    shift,
                    linesPerPage: this.editor.renderer.getLinesPerPage()
                });
                break;
            case "PageDown":
                e.preventDefault();
                doc.movePageDown({
                    shift,
                    linesPerPage: this.editor.renderer.getLinesPerPage()
                });
                break;
            case "Enter":
                e.preventDefault();
                editLine = Math.min(editLine, doc.getOrderedSelection().start.line);
                doc.insertNewLine();
                textChanged = true;
                break;
            case "Backspace":
                e.preventDefault();
                editLine = Math.max(0, Math.min(editLine, doc.getOrderedSelection().start.line) - 1);
                doc.backspace({ ctrl });
                textChanged = true;
                break;
            case "Delete":
                e.preventDefault();
                editLine = Math.min(editLine, doc.getOrderedSelection().start.line);
                doc.delete({ ctrl });
                textChanged = true;
                break;
            case "Tab":
                e.preventDefault();
                editLine = Math.min(editLine, doc.getOrderedSelection().start.line);
                if (shift) {
                    doc.untab();
                } else {
                    doc.tab();
                }
                textChanged = true;
                break;
            default:
                if (e.key.length === 1) {
                    if (ctrl) {
                        this._handleShortcut(e);
                        return;
                    } else {
                        e.preventDefault();
                        editLine = Math.min(editLine, doc.getOrderedSelection().start.line);
                        doc.insertText(e.key);
                        textChanged = true;
                    }
                } else {
                    return;
                }
                break;
        }

        this.editor.resetCaretBlink();
        if (!isRenaming) {
            if (textChanged) {
                this.editor.onDocumentChanged(editLine);
            }
            this.editor.renderer.ensureVisibleCursor(doc);
        }
        this.editor.render();
    }

    _handleShortcut(e) {
        const key = e.key.toLowerCase();
        const doc = this.editor.targetDoc;
        const isRenaming = Boolean(this.editor.renamingTabId);

        switch (key) {
            case "a":
                e.preventDefault();
                doc.selectAll();
                this.editor.resetCaretBlink();
                this.editor.render();
                break;
            case "j":
                e.preventDefault();
                this.editor.toggleConsole();
                break;
            case "z":
                e.preventDefault();
                if (e.shiftKey) {
                    if (doc.redo() && !isRenaming) this.editor.onDocumentChanged(0);
                } else {
                    if (doc.undo() && !isRenaming) this.editor.onDocumentChanged(0);
                }
                this.editor.resetCaretBlink();
                if (!isRenaming) this.editor.renderer.ensureVisibleCursor(doc);
                this.editor.render();
                break;
            case "y":
                e.preventDefault();
                if (doc.redo() && !isRenaming) this.editor.onDocumentChanged(0);
                this.editor.resetCaretBlink();
                if (!isRenaming) this.editor.renderer.ensureVisibleCursor(doc);
                this.editor.render();
                break;
            default:
                break;
        }
    }
}