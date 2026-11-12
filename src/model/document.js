import { HistoryManager } from "./history.js";

export class TextDocument {
    constructor(id = "welcome.txt", initialText = null) {
        this.id = id;
        this.blocLength = 256;

        this.cursor = { line: 0, col: 0 };
        this.preferredCursorCol = null;

        this.inSelection = false;
        this.selection = {
            start: { line: 0, col: 0 },
            end: { line: 0, col: 0 }
        };

        // Per-document viewport scroll state (makes future tabs seamless)
        this.scrollX = 0;
        this.scrollY = 0;

        this.history = new HistoryManager();

        if (initialText !== null) {
            this.setText(initialText);
        } else {
            this.initDefaultText();
        }
    }

    initDefaultText() {
        const defaultLines = [
            "theme: midnight",
            "",
            "Welcome to your Custom IDE.",
            "This editor is built from scratch on an HTML5 Canvas.",
            "",
            "--- TABS & FILE EXTENSIONS ---",
            "   Click '+' in the top bar to create a new file.",
            "   Double-click any tab to rename it (Enter to confirm, Escape to cancel).",
            "   Syntax highlighting is automatic based on the file extension:",
            "     • .c / .h   -> C89 Highlighter",
            "     • .js       -> JavaScript Highlighter",
            "     • .txt      -> Plain Text",
            "",
            "--- THEMES ---",
            "   You can optionally set 'theme: midnight', 'theme: nord', or",
            "   'theme: solarized_dark' on the first line.",
            "",
            "--- SHORTCUTS ---",
            "   Ctrl + Z / Y          Undo / Redo",
            "   Ctrl + C / X / V      Copy / Cut / Paste",
            "   Ctrl + A              Select All",
            "   Ctrl + Mouse Wheel    Zoom In / Out",
            "",
            "Have fun building your language!"
        ];
        this.setText(defaultLines.join("\n"));
    }

    // --- State & Metadata Helpers ---

    getStateSnapshot() {
        return {
            text: this.getText(),
            cursor: { ...this.cursor },
            inSelection: this.inSelection,
            selection: {
                start: { ...this.selection.start },
                end: { ...this.selection.end }
            }
        };
    }

    restoreSnapshot(snapshot) {
        if (!snapshot) return false;
        this.setText(snapshot.text);
        this.setCursor(snapshot.cursor.line, snapshot.cursor.col);
        this.inSelection = snapshot.inSelection;
        this.selection = {
            start: { ...snapshot.selection.start },
            end: { ...snapshot.selection.end }
        };
        return true;
    }

    undo() {
        const prev = this.history.undo(this.getStateSnapshot());
        return this.restoreSnapshot(prev);
    }

    redo() {
        const next = this.history.redo(this.getStateSnapshot());
        return this.restoreSnapshot(next);
    }

    getMetadata() {
        let lang = "TXT";
        const dotIdx = this.id.lastIndexOf(".");
        if (dotIdx !== -1 && dotIdx < this.id.length - 1) {
            const ext = this.id.slice(dotIdx + 1).toUpperCase();
            if (ext === "C" || ext === "H") {
                lang = "C";
            } else if (ext === "JS" || ext === "MJS") {
                lang = "JS";
            } else if (ext === "JSON") {
                lang = "JSON";
            } else {
                lang = ext;
            }
        }

        const firstLine = this.lineAt(0)?.content ?? "";
        let theme = "MIDNIGHT";
        const themeMatch = firstLine.match(/theme:\s*(\w+)/i);
        if (themeMatch) {
            theme = themeMatch[1].toUpperCase();
        }

        return { lang, theme };
    }

    // --- Line & Bloc Management ---

    getNbLines() {
        let count = 0;
        for (const bloc of this.lines) {
            count += bloc.lines.length;
        }
        return count;
    }

    lineToBlocLine(lineIdx) {
        let remaining = lineIdx;
        for (let b = 0; b < this.lines.length; b++) {
            const len = this.lines[b].lines.length;
            if (remaining < len || b === this.lines.length - 1) {
                return { bloc: b, line: Math.min(remaining, Math.max(0, len - 1)) };
            }
            remaining -= len;
        }
        return { bloc: 0, line: 0 };
    }

    lineAt(nbLine) {
        const { bloc, line } = this.lineToBlocLine(nbLine);
        return this.lines[bloc].lines[line];
    }

    setText(text) {
        const cleanLines = text.replace(/\r/g, "").split("\n").map(s => this._createLine(s));
        this.lines = [this._createBloc(cleanLines.length ? cleanLines : [this._createLine("")])];
        this._reshapeBlocs();
    }

    getText() {
        const result = [];
        for (const bloc of this.lines) {
            for (const line of bloc.lines) {
                result.push(line.content);
            }
        }
        return result.join("\n");
    }

    _createLine(content, lastState = "normal") {
        return { content, lastState };
    }

    _createBloc(lines, lastState = "normal") {
        return { lines, lastState };
    }

    _reshapeBlocs() {
        this.lines = this.lines.filter(b => b && Array.isArray(b.lines) && b.lines.length > 0);
        if (this.lines.length === 0) {
            this.lines = [this._createBloc([this._createLine("")])];
            return;
        }

        let idx = 0;
        while (idx < this.lines.length) {
            const bloc = this.lines[idx].lines;
            while (bloc.length > this.blocLength) {
                const transfer = bloc.splice(this.blocLength);
                if (idx + 1 < this.lines.length) {
                    this.lines[idx + 1].lines.unshift(...transfer);
                } else {
                    this.lines.push(this._createBloc(transfer));
                }
            }
            while (bloc.length < this.blocLength && idx < this.lines.length - 1) {
                const next = this.lines[idx + 1].lines;
                const need = this.blocLength - bloc.length;
                bloc.push(...next.splice(0, need));
                if (next.length === 0) {
                    this.lines.splice(idx + 1, 1);
                }
            }
            idx++;
        }
        this.lines = this.lines.filter(b => b && b.lines && b.lines.length > 0);
    }

    // --- Cursor & Selection Management ---

    isSpecialChar(char) {
        return char === undefined || /\W/.test(char);
    }

    _clamp(val, low, high) {
        return Math.max(low, Math.min(high, val));
    }

    setCursor(line, col, usePreferredCol = false) {
        this.cursor.line = this._clamp(line, 0, this.getNbLines() - 1);
        const maxCol = this.lineAt(this.cursor.line).content.length;

        if (!usePreferredCol) {
            this.cursor.col = this._clamp(col, 0, maxCol);
            this.preferredCursorCol = null;
            return;
        }

        if (this.preferredCursorCol == null) {
            this.preferredCursorCol = this.cursor.col;
        }
        this.cursor.col = Math.min(this.preferredCursorCol, maxCol);
    }

    getOrderedSelection() {
        let { start, end } = this.selection;
        if (start.line > end.line || (start.line === end.line && start.col > end.col)) {
            return { start: { ...end }, end: { ...start } };
        }
        return { start: { ...start }, end: { ...end } };
    }

    selectToCursor(shift, prevLine, prevCol) {
        if (shift) {
            if (!this.inSelection) {
                this.inSelection = true;
                this.selection.start = { line: prevLine, col: prevCol };
            }
            this.selection.end = { line: this.cursor.line, col: this.cursor.col };
            if (
                this.selection.start.line === this.selection.end.line &&
                this.selection.start.col === this.selection.end.col
            ) {
                this.inSelection = false;
            }
        } else {
            this.inSelection = false;
        }
    }

    selectAll() {
        const lastLineIdx = this.getNbLines() - 1;
        const lastCol = this.lineAt(lastLineIdx).content.length;
        this.setCursor(lastLineIdx, lastCol);
        this.inSelection = true;
        this.selection = {
            start: { line: 0, col: 0 },
            end: { line: lastLineIdx, col: lastCol }
        };
    }

    selectWordAt(line, col) {
        const s = this.lineAt(line)?.content ?? "";
        if (s.length === 0) return;

        let start = this._clamp(col, 0, s.length);
        let end = start;

        while (start > 0 && !this.isSpecialChar(s[start - 1])) start--;
        while (end < s.length && !this.isSpecialChar(s[end])) end++;

        this.inSelection = start !== end;
        this.selection = { start: { line, col: start }, end: { line, col: end } };
        this.setCursor(line, end);
    }

    selectLineAt(line) {
        const nbLines = this.getNbLines();
        const safeLine = this._clamp(line, 0, nbLines - 1);
        this.inSelection = true;

        if (safeLine < nbLines - 1) {
            this.selection = {
                start: { line: safeLine, col: 0 },
                end: { line: safeLine + 1, col: 0 }
            };
            this.setCursor(safeLine + 1, 0);
        } else {
            const len = this.lineAt(safeLine).content.length;
            this.selection = {
                start: { line: safeLine, col: 0 },
                end: { line: safeLine, col: len }
            };
            this.setCursor(safeLine, len);
        }
    }

    getSelectionText() {
        if (!this.inSelection) return "";
        const { start, end } = this.getOrderedSelection();

        if (start.line === end.line) {
            return this.lineAt(start.line).content.slice(start.col, end.col);
        }

        const text = [];
        text.push(this.lineAt(start.line).content.slice(start.col));
        for (let i = start.line + 1; i < end.line; i++) {
            text.push(this.lineAt(i).content);
        }
        text.push(this.lineAt(end.line).content.slice(0, end.col));
        return text.join("\n");
    }

    // --- Text Editing Operations ---

    deleteSelection() {
        if (!this.inSelection) return false;
        const { start, end } = this.getOrderedSelection();
        this.inSelection = false;

        if (start.line === end.line && start.col === end.col) return false;

        const first = this.lineAt(start.line).content;
        const last = this.lineAt(end.line).content;
        const mergedContent = this._createLine(
            first.slice(0, start.col) + last.slice(end.col),
            this.lineAt(end.line).lastState
        );

        const startBloc = this.lineToBlocLine(start.line);
        const endBloc = this.lineToBlocLine(end.line);

        if (startBloc.bloc === endBloc.bloc) {
            const deleteCount = end.line - start.line + 1;
            this.lines[startBloc.bloc].lines.splice(startBloc.line, deleteCount, mergedContent);
        } else {
            const nbBlocks = endBloc.bloc - startBloc.bloc;
            if (nbBlocks > 1) {
                this.lines.splice(startBloc.bloc + 1, nbBlocks - 1);
            }
            const del = this.lines[startBloc.bloc].lines.length - startBloc.line;
            this.lines[startBloc.bloc].lines.splice(startBloc.line, del, mergedContent);
            this.lines[startBloc.bloc + 1].lines.splice(0, endBloc.line + 1);
        }

        this._reshapeBlocs();
        this.setCursor(start.line, start.col);
        return true;
    }

    insertText(text) {
        const isSingleChar = text.length === 1 && !this.isSpecialChar(text) && !this.inSelection;
        this.history.record(this.getStateSnapshot(), isSingleChar);

        this.deleteSelection();

        const insertLines = text.replace(/\r/g, "").split("\n");
        const { line, col } = this.cursor;
        const s = this.lineAt(line).content;

        if (insertLines.length === 1) {
            this.lineAt(line).content = s.slice(0, col) + text + s.slice(col);
            this.setCursor(line, col + text.length);
        } else {
            const prefix = s.slice(0, col) + insertLines[0];
            const suffix = insertLines[insertLines.length - 1] + s.slice(col);
            const conv = this.lineToBlocLine(line);
            const newLines = [prefix, ...insertLines.slice(1, -1), suffix].map(c => this._createLine(c));

            this.lines[conv.bloc].lines.splice(conv.line, 1, ...newLines);
            this._reshapeBlocs();
            this.setCursor(line + insertLines.length - 1, insertLines[insertLines.length - 1].length);
        }
    }

    insertNewLine() {
        this.history.record(this.getStateSnapshot(), false);
        this.deleteSelection();

        const { line, col } = this.cursor;
        const s = this.lineAt(line).content;
        let nbLeadingSpace = 0;
        while (nbLeadingSpace < col && s[nbLeadingSpace] === " ") {
            nbLeadingSpace++;
        }

        const left = s.slice(0, col);
        const right = s.slice(col);
        this.lineAt(line).content = left;

        const conv = this.lineToBlocLine(line);
        this.lines[conv.bloc].lines.splice(
            conv.line + 1,
            0,
            this._createLine(" ".repeat(nbLeadingSpace) + right)
        );
        this._reshapeBlocs();
        this.setCursor(line + 1, nbLeadingSpace);
    }

    tab() {
        if (this.inSelection) {
            this.history.record(this.getStateSnapshot(), false);
            const { start, end } = this.getOrderedSelection();
            for (let i = start.line; i <= end.line; i++) {
                this.lineAt(i).content = "  " + this.lineAt(i).content;
            }
            this.selection.start.col += 2;
            this.selection.end.col += 2;
            this.setCursor(this.cursor.line, this.cursor.col + 2);
        } else {
            this.insertText(" ".repeat(this.cursor.col % 2 === 0 ? 2 : 1));
        }
    }

    untab() {
        this.history.record(this.getStateSnapshot(), false);
        if (this.inSelection) {
            const { start, end } = this.getOrderedSelection();
            for (let i = start.line; i <= end.line; i++) {
                const content = this.lineAt(i).content;
                const removeCount = content.startsWith("  ") ? 2 : content.startsWith(" ") ? 1 : 0;
                if (removeCount > 0) {
                    this.lineAt(i).content = content.substring(removeCount);
                    if (i === this.selection.start.line) {
                        this.selection.start.col = Math.max(0, this.selection.start.col - removeCount);
                    }
                    if (i === this.selection.end.line) {
                        this.selection.end.col = Math.max(0, this.selection.end.col - removeCount);
                    }
                    if (i === this.cursor.line) {
                        this.setCursor(this.cursor.line, Math.max(0, this.cursor.col - removeCount));
                    }
                }
            }
        } else {
            const content = this.lineAt(this.cursor.line).content;
            const removeCount = content.startsWith("  ") ? 2 : content.startsWith(" ") ? 1 : 0;
            if (removeCount > 0) {
                this.lineAt(this.cursor.line).content = content.substring(removeCount);
                this.setCursor(this.cursor.line, Math.max(0, this.cursor.col - removeCount));
            }
        }
    }

    backspace({ ctrl } = { ctrl: false }) {
        if (this.inSelection) {
            this.history.record(this.getStateSnapshot(), false);
            this.deleteSelection();
            return;
        }

        const { line, col } = this.cursor;
        if (line === 0 && col === 0) return;

        this.history.record(this.getStateSnapshot(), !ctrl && col > 0);
        const s = this.lineAt(line).content;

        if (col > 0) {
            if (!ctrl) {
                this.lineAt(line).content = s.slice(0, col - 1) + s.slice(col);
                this.setCursor(line, col - 1);
                return;
            }
            let i = col - 1;
            while (i >= 0 && this.isSpecialChar(s[i])) i--;
            while (i >= 0 && !this.isSpecialChar(s[i])) i--;
            const newCol = i + 1;
            this.lineAt(line).content = s.slice(0, newCol) + s.slice(col);
            this.setCursor(line, newCol);
            return;
        }

        // Merge with previous line when col === 0
        const prev = this.lineAt(line - 1).content;
        this.lineAt(line - 1).content = prev + s;
        const conv = this.lineToBlocLine(line);
        this.lines[conv.bloc].lines.splice(conv.line, 1);
        this._reshapeBlocs();
        this.setCursor(line - 1, prev.length);
    }

    delete({ ctrl } = { ctrl: false }) {
        if (this.inSelection) {
            this.history.record(this.getStateSnapshot(), false);
            this.deleteSelection();
            return;
        }

        const { line, col } = this.cursor;
        const s = this.lineAt(line).content;
        if (line === this.getNbLines() - 1 && col === s.length) return;

        this.history.record(this.getStateSnapshot(), !ctrl && col < s.length);

        if (col < s.length) {
            if (!ctrl) {
                this.lineAt(line).content = s.slice(0, col) + s.slice(col + 1);
                return;
            }
            let i = col;
            while (i < s.length && !this.isSpecialChar(s[i])) i++;
            while (i < s.length && this.isSpecialChar(s[i])) i++;
            this.lineAt(line).content = s.slice(0, col) + s.slice(i);
            return;
        }

        // Merge with next line when col === s.length
        const next = this.lineAt(line + 1).content;
        this.lineAt(line).content = s + next;
        const conv = this.lineToBlocLine(line + 1);
        this.lines[conv.bloc].lines.splice(conv.line, 1);
        this._reshapeBlocs();
    }

    // --- Cursor Navigation ---

    moveLeft({ ctrl, shift }) {
        if (this.inSelection && !shift) {
            const { start } = this.getOrderedSelection();
            this.inSelection = false;
            this.setCursor(start.line, start.col);
            return;
        }

        const { line, col } = this.cursor;
        if (!ctrl) {
            if (col > 0) {
                this.setCursor(line, col - 1);
            } else if (line > 0) {
                this.setCursor(line - 1, this.lineAt(line - 1).content.length);
            }
            this.selectToCursor(shift, line, col);
            return;
        }

        if (col === 0) {
            if (line > 0) {
                this.setCursor(line - 1, this.lineAt(line - 1).content.length);
            }
            this.selectToCursor(shift, line, col);
            return;
        }

        const s = this.lineAt(line).content;
        let i = col - 1;
        while (i >= 0 && this.isSpecialChar(s[i])) i--;
        while (i >= 0 && !this.isSpecialChar(s[i])) i--;
        this.setCursor(line, i + 1);
        this.selectToCursor(shift, line, col);
    }

    moveRight({ ctrl, shift }) {
        if (this.inSelection && !shift) {
            const { end } = this.getOrderedSelection();
            this.inSelection = false;
            this.setCursor(end.line, end.col);
            return;
        }

        const { line, col } = this.cursor;
        const s = this.lineAt(line).content;
        const length = s.length;

        if (!ctrl) {
            if (col < length) {
                this.setCursor(line, col + 1);
            } else if (line < this.getNbLines() - 1) {
                this.setCursor(line + 1, 0);
            }
            this.selectToCursor(shift, line, col);
            return;
        }

        if (col === length) {
            if (line < this.getNbLines() - 1) {
                this.setCursor(line + 1, 0);
            }
            this.selectToCursor(shift, line, col);
            return;
        }

        let i = col;
        while (i < length && !this.isSpecialChar(s[i])) i++;
        while (i < length && this.isSpecialChar(s[i])) i++;
        this.setCursor(line, Math.min(length, i));
        this.selectToCursor(shift, line, col);
    }

    moveUp({ ctrl, shift }) {
        const { line, col } = this.cursor;
        if (!ctrl && line > 0) {
            this.setCursor(line - 1, col, true);
        } else if (ctrl) {
            this.setCursor(line, 0);
        }
        this.selectToCursor(shift, line, col);
    }

    moveDown({ ctrl, shift }) {
        const { line, col } = this.cursor;
        if (!ctrl && line < this.getNbLines() - 1) {
            this.setCursor(line + 1, col, true);
        } else if (ctrl) {
            this.setCursor(line, this.lineAt(line).content.length);
        }
        this.selectToCursor(shift, line, col);
    }

    moveHome({ ctrl, shift }) {
        const { line, col } = this.cursor;
        this.setCursor(ctrl ? 0 : line, 0);
        this.selectToCursor(shift, line, col);
    }

    moveEnd({ ctrl, shift }) {
        const { line, col } = this.cursor;
        const targetLine = ctrl ? this.getNbLines() - 1 : line;
        this.setCursor(targetLine, this.lineAt(targetLine).content.length);
        this.selectToCursor(shift, line, col);
    }

    movePageUp({ shift, linesPerPage }) {
        const { line, col } = this.cursor;
        const targetLine = Math.max(0, line - linesPerPage);
        const atTop = line - linesPerPage < 0;
        this.setCursor(targetLine, atTop ? 0 : col, !atTop);
        this.selectToCursor(shift, line, col);
    }

    movePageDown({ shift, linesPerPage }) {
        const { line, col } = this.cursor;
        const maxLine = this.getNbLines() - 1;
        const targetLine = Math.min(maxLine, line + linesPerPage);
        const atBottom = line + linesPerPage > maxLine;
        this.setCursor(
            targetLine,
            atBottom ? this.lineAt(maxLine).content.length : col,
            !atBottom
        );
        this.selectToCursor(shift, line, col);
    }
}