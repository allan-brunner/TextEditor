export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");

        this.dpr = 1;
        this.fontSize = 16;
        this.lineHeight = 20;
        this.paddingHeight = 16;
        this.paddingWidth = 40;
        this.log10NbLines = 1;
        this.fontFamily =
            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";

        this.measure();
    }

    setDpr(dpr) {
        this.dpr = dpr;
        this.measure();
    }

    zoom(delta) {
        const step = Math.max(-1, Math.min(1, delta));
        this.fontSize = Math.max(12, Math.min(64, this.fontSize + 4 * -step));
        this.lineHeight = this.fontSize + 4;
        this.measure();
    }

    measure() {
        const ctx = this.ctx;
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        ctx.font = `${this.fontSize}px ${this.fontFamily}`;
        this.charWidth = ctx.measureText("M").width;
    }

    adjustPaddingWidth(nbLines) {
        this.log10NbLines = Math.max(1, Math.floor(Math.log10(Math.max(1, nbLines))) + 1);
        this.paddingWidth = 16 + this.log10NbLines * this.charWidth + 8;
    }

    getLinesPerPage() {
        const h = this.canvas.height / this.dpr;
        return Math.max(1, Math.floor((h - 2 * this.paddingHeight) / this.lineHeight));
    }

    posFromMouseEvent(e, doc) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        this.adjustPaddingWidth(doc.getNbLines());

        const contentX = x + doc.scrollX - this.paddingWidth;
        const contentY = y + doc.scrollY - this.paddingHeight;

        const nbLines = doc.getNbLines();
        const line = Math.max(0, Math.min(nbLines - 1, Math.floor(contentY / this.lineHeight)));
        const maxCol = doc.lineAt(line).content.length;
        const col = Math.max(0, Math.min(maxCol, Math.round(contentX / this.charWidth)));

        return { line, col };
    }

    ensureVisibleCursor(doc) {
        const viewW = this.canvas.width / this.dpr;
        const viewH = this.canvas.height / this.dpr;

        this.adjustPaddingWidth(doc.getNbLines());

        const caretX = doc.cursor.col * this.charWidth;
        const caretY = doc.cursor.line * this.lineHeight;

        const hMargin = this.charWidth * 5;
        const vMargin = this.lineHeight * 2;

        const visibleWidth = Math.max(this.charWidth * 10, viewW - this.paddingWidth);
        const visibleHeight = Math.max(this.lineHeight * 2, viewH - this.paddingHeight);

        if (caretX < doc.scrollX + hMargin) {
            doc.scrollX = Math.max(0, caretX - hMargin);
        } else if (caretX > doc.scrollX + visibleWidth - hMargin) {
            doc.scrollX = caretX - visibleWidth + hMargin;
        }

        if (caretY < doc.scrollY + vMargin) {
            doc.scrollY = Math.max(0, caretY - vMargin);
        } else if (caretY > doc.scrollY + visibleHeight - vMargin) {
            doc.scrollY = caretY - visibleHeight + vMargin;
        }
    }

    render(doc, highlighter, theme, caretVisible, mousePos) {
        const ctx = this.ctx;
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

        const w = this.canvas.width / this.dpr;
        const h = this.canvas.height / this.dpr;
        const nbLines = doc.getNbLines();

        this.adjustPaddingWidth(nbLines);

        // Background
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = theme.get("background") ?? "#0b0f19";
        ctx.fillRect(0, 0, w, h);

        ctx.font = `${this.fontSize}px ${this.fontFamily}`;
        ctx.textBaseline = "top";

        // Use Math.floor so top partially scrolled line is still rendered
        const startLine = Math.max(0, Math.floor(doc.scrollY / this.lineHeight));
        const visibleLines = Math.ceil((h - this.paddingHeight) / this.lineHeight) + 1;
        const endLine = Math.min(nbLines, startLine + visibleLines);

        const { start: selStart, end: selEnd } = doc.getOrderedSelection();

        // Clip code area so horizontally scrolled text/selection never overlaps the gutter
        ctx.save();
        ctx.beginPath();
        ctx.rect(this.paddingWidth, 0, Math.max(0, w - this.paddingWidth), h);
        ctx.clip();

        const minChar = Math.max(0, Math.floor(doc.scrollX / this.charWidth));
        const maxChar = minChar + Math.ceil((w - this.paddingWidth) / this.charWidth) + 2;

        for (let i = startLine; i < endLine; i++) {
            const x = this.paddingWidth - doc.scrollX;
            const y = this.paddingHeight + i * this.lineHeight - doc.scrollY;
            const lineContent = doc.lineAt(i).content;

            // Selection highlight
            if (doc.inSelection && selStart.line <= i && selEnd.line >= i) {
                const selColStart = selStart.line < i ? 0 : selStart.col;
                const selColEnd = selEnd.line > i ? lineContent.length : selEnd.col;
                const highlightWidth = Math.max(
                    (selColEnd - selColStart) * this.charWidth,
                    selEnd.line > i ? this.charWidth * 0.5 : 0 // Show newline selection indicator
                );

                ctx.fillStyle = theme.get("selection") ?? "rgba(255, 255, 255, 0.3)";
                ctx.fillRect(
                    x + selColStart * this.charWidth,
                    y - 2,
                    highlightWidth,
                    this.lineHeight
                );
            }

            // Syntax highlighted tokens
            const tokens = highlighter.tokenize(i);
            let pastNbChars = 0;

            for (const token of tokens) {
                const tokenLen = token.val.length;
                const tokenEnd = pastNbChars + tokenLen;

                if (tokenEnd <= minChar) {
                    pastNbChars = tokenEnd;
                    continue;
                }
                if (pastNbChars >= maxChar) {
                    break;
                }

                const sliceStart = Math.max(0, minChar - pastNbChars);
                const sliceEnd = Math.min(tokenLen, maxChar - pastNbChars);
                const visibleSlice = token.val.slice(sliceStart, sliceEnd);
                const drawX = x + (pastNbChars + sliceStart) * this.charWidth;

                ctx.fillStyle = theme.get(token.type) ?? theme.get("default") ?? "#ffffff";
                ctx.fillText(visibleSlice, drawX, y);

                pastNbChars = tokenEnd;
            }
        }

        // Caret (drawn inside the code clip area so it also hides behind the gutter if scrolled off)
        if (caretVisible) {
            const cx = this.paddingWidth + doc.cursor.col * this.charWidth - doc.scrollX;
            const cy = this.paddingHeight + doc.cursor.line * this.lineHeight - 2 - doc.scrollY;
            if (cx >= this.paddingWidth - 2 && cx <= w + 2 && cy >= -this.lineHeight && cy <= h + this.lineHeight) {
                ctx.fillStyle = theme.get("caret") ?? "#ffffff";
                ctx.fillRect(cx, cy, 2, this.lineHeight);
            }
        }

        ctx.restore();

        // Draw Gutter (Line Numbers) outside the clip region
        ctx.fillStyle = theme.get("gutter") ?? "rgba(255, 255, 255, 0.5)";
        for (let i = startLine; i < endLine; i++) {
            const y = this.paddingHeight + i * this.lineHeight - doc.scrollY;
            const lineNumber = String(i + 1).padStart(this.log10NbLines, " ");
            ctx.fillText(lineNumber, 8, y);
        }

        if (mousePos) {
            this._drawMouseCursor(mousePos, theme);
        }
    }

    _drawMouseCursor(mousePos, theme) {
        const ctx = this.ctx;
        const { x, y } = mousePos;
        const color = theme.get("caret") ?? "#ffffff";

        ctx.save();
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 1.5;

        if (x >= this.paddingWidth) {
            // Draw I-Beam cursor over the text area
            const halfH = Math.round(this.lineHeight * 0.45);
            const serifW = 3;

            ctx.beginPath();
            // Vertical stem
            ctx.moveTo(x, y - halfH);
            ctx.lineTo(x, y + halfH);
            // Top crossbar
            ctx.moveTo(x - serifW, y - halfH);
            ctx.lineTo(x + serifW, y - halfH);
            // Bottom crossbar
            ctx.moveTo(x - serifW, y + halfH);
            ctx.lineTo(x + serifW, y + halfH);
            ctx.stroke();
        } else {
            // Draw a clean arrow cursor when hovering over the gutter
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x, y + 14);
            ctx.lineTo(x + 4, y + 10);
            ctx.lineTo(x + 10, y + 10);
            ctx.closePath();
            ctx.fill();
        }

        ctx.restore();
    }
}