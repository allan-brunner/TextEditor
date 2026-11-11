export class InputController {
    constructor(editor, canvas) {
        this.editor = editor;
        this.canvas = canvas;
        this.lastClick = 0;
        this.nbClick = 0;

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
        this.canvas.addEventListener("mouseleave", () => {
            this.editor.mousePos = null;
            this.editor.render();
        });
    }

    onMouseDown(e) {
        const shift = e.shiftKey;
        const doc = this.editor.activeDoc;

        this.editor.resetCaretBlink();
        const pos = this.editor.renderer.posFromMouseEvent(e, doc);
        const { line, col } = doc.cursor;

        doc.setCursor(pos.line, pos.col);
        doc.selectToCursor(shift, line, col);

        this.editor.renderer.ensureVisibleCursor(doc);
        this.editor.render();
    }

    onMouseClick(e) {
        const now = Date.now();
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
        this.editor.mousePos = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };

        if (e.buttons !== 1) {
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
        const ctrl = e.ctrlKey || e.metaKey;
        const doc = this.editor.activeDoc;
        const renderer = this.editor.renderer;

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

        const ctrl = e.ctrlKey || e.metaKey;
        const shift = e.shiftKey;
        const doc = this.editor.activeDoc;
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
        if (textChanged) {
            this.editor.onDocumentChanged(editLine);
        }
        this.editor.renderer.ensureVisibleCursor(doc);
        this.editor.render();
    }

    _handleShortcut(e) {
        const key = e.key.toLowerCase();
        const doc = this.editor.activeDoc;

        switch (key) {
            case "a":
                e.preventDefault();
                doc.selectAll();
                this.editor.resetCaretBlink();
                this.editor.render();
                break;
            case "z":
                e.preventDefault();
                if (e.shiftKey) {
                    if (doc.redo()) this.editor.onDocumentChanged(0);
                } else {
                    if (doc.undo()) this.editor.onDocumentChanged(0);
                }
                this.editor.resetCaretBlink();
                this.editor.renderer.ensureVisibleCursor(doc);
                this.editor.render();
                break;
            case "y":
                e.preventDefault();
                if (doc.redo()) this.editor.onDocumentChanged(0);
                this.editor.resetCaretBlink();
                this.editor.renderer.ensureVisibleCursor(doc);
                this.editor.render();
                break;
            default:
                // Let native Ctrl+C / Ctrl+V / Ctrl+X events fire
                break;
        }
    }
}