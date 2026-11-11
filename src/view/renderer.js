export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");

        this.dpr = 1;
        this.topBarHeight = 36;
        this.consoleHeight = 190;
        this.consoleHeaderHeight = 30;
        this.consoleFontSize = 14;
        this.consoleLineHeight = 20;
        this.fontSize = 16;
        this.lineHeight = 20;
        this.paddingHeight = 16;
        this.paddingWidth = 40;
        this.log10NbLines = 1;
        this.fontFamily =
            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";

        // Stores interactive top bar hitboxes from the latest frame
        this.uiHitboxes = [];
        this.renameBoxMeta = null;

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

    zoomConsole(delta) {
        const step = Math.max(-1, Math.min(1, delta));
        this.consoleFontSize = Math.max(10, Math.min(48, this.consoleFontSize + 2 * -step));
        this.consoleLineHeight = this.consoleFontSize + 6;
    }

    setConsoleHeight(newHeight) {
        const h = this.canvas.height / this.dpr;
        const minH = this.consoleHeaderHeight + 40;
        const maxH = Math.max(minH, h - this.topBarHeight - 80);
        this.consoleHeight = Math.max(minH, Math.min(maxH, newHeight));
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

    getLinesPerPage(consoleOpen = false) {
        const bottomSpace = consoleOpen ? this.consoleHeight : 0;
        const h = this.canvas.height / this.dpr - this.topBarHeight - bottomSpace;
        return Math.max(1, Math.floor((h - 2 * this.paddingHeight) / this.lineHeight));
    }

    posFromMouseEvent(e, doc) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        this.adjustPaddingWidth(doc.getNbLines());

        const contentX = x + doc.scrollX - this.paddingWidth;
        const contentY = y - this.topBarHeight + doc.scrollY - this.paddingHeight;

        const nbLines = doc.getNbLines();
        const line = Math.max(0, Math.min(nbLines - 1, Math.floor(contentY / this.lineHeight)));
        const maxCol = doc.lineAt(line).content.length;
        const col = Math.max(0, Math.min(maxCol, Math.round(contentX / this.charWidth)));

        return { line, col };
    }

    posFromRenameInput(mouseX, renameDoc) {
        if (!this.renameBoxMeta || !renameDoc) return 0;
        const { textX, charW } = this.renameBoxMeta;
        const relX = mouseX - textX + renameDoc.scrollX;
        const maxCol = renameDoc.lineAt(0).content.length;
        return Math.max(0, Math.min(maxCol, Math.round(relX / charW)));
    }

    hitTestUI(x, y, consoleOpen = false) {
        for (let i = this.uiHitboxes.length - 1; i >= 0; i--) {
            const box = this.uiHitboxes[i];
            if (x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) {
                return box;
            }
        }
        if (y <= this.topBarHeight) {
            return { type: "topbar_empty" };
        }
        const h = this.canvas.height / this.dpr;
        if (consoleOpen && y >= h - this.consoleHeight) {
            return { type: "console_body" };
        }
        return null;
    }

    ensureVisibleCursor(doc, consoleOpen = false) {
        const viewW = this.canvas.width / this.dpr;
        const bottomSpace = consoleOpen ? this.consoleHeight : 0;
        const viewH = this.canvas.height / this.dpr - this.topBarHeight - bottomSpace;

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

    render(doc, documents, highlighter, theme, caretVisible, mousePos = null, uiState = {}) {
        const ctx = this.ctx;
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

        const w = this.canvas.width / this.dpr;
        const h = this.canvas.height / this.dpr;
        const editorTop = this.topBarHeight;
        const bottomPanelH = uiState.consoleOpen ? this.consoleHeight : 0;
        const editorH = Math.max(0, h - editorTop - bottomPanelH);
        const nbLines = doc.getNbLines();

        this.adjustPaddingWidth(nbLines);

        // Editor Background
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = theme.get("background") ?? "#0b0f19";
        ctx.fillRect(0, editorTop, w, editorH);

        ctx.font = `${this.fontSize}px ${this.fontFamily}`;
        ctx.textBaseline = "top";

        const startLine = Math.max(0, Math.floor(doc.scrollY / this.lineHeight));
        const visibleLines = Math.ceil((editorH - this.paddingHeight) / this.lineHeight) + 1;
        const endLine = Math.min(nbLines, startLine + visibleLines);

        const { start: selStart, end: selEnd } = doc.getOrderedSelection();

        // Clip code area below Top Bar and right of Gutter
        ctx.save();
        ctx.beginPath();
        ctx.rect(this.paddingWidth, editorTop, Math.max(0, w - this.paddingWidth), editorH);
        ctx.clip();

        const minChar = Math.max(0, Math.floor(doc.scrollX / this.charWidth));
        const maxChar = minChar + Math.ceil((w - this.paddingWidth) / this.charWidth) + 2;

        for (let i = startLine; i < endLine; i++) {
            const x = this.paddingWidth - doc.scrollX;
            const y = editorTop + this.paddingHeight + i * this.lineHeight - doc.scrollY;
            const lineContent = doc.lineAt(i).content;

            if (doc.inSelection && selStart.line <= i && selEnd.line >= i) {
                const selColStart = selStart.line < i ? 0 : selStart.col;
                const selColEnd = selEnd.line > i ? lineContent.length : selEnd.col;
                const highlightWidth = Math.max(
                    (selColEnd - selColStart) * this.charWidth,
                    selEnd.line > i ? this.charWidth * 0.5 : 0
                );

                ctx.fillStyle = theme.get("selection") ?? "rgba(255, 255, 255, 0.3)";
                ctx.fillRect(
                    x + selColStart * this.charWidth,
                    y - 2,
                    highlightWidth,
                    this.lineHeight
                );
            }

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

        // Caret
        if (caretVisible) {
            const cx = this.paddingWidth + doc.cursor.col * this.charWidth - doc.scrollX;
            const cy = editorTop + this.paddingHeight + doc.cursor.line * this.lineHeight - 2 - doc.scrollY;
            if (cx >= this.paddingWidth - 2 && cx <= w + 2 && cy >= editorTop - this.lineHeight && cy <= editorTop + editorH) {
                ctx.fillStyle = theme.get("caret") ?? "#ffffff";
                ctx.fillRect(cx, cy, 2, this.lineHeight);
            }
        }

        ctx.restore();

        // Draw Gutter (clipped vertically below the top bar)
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, editorTop, this.paddingWidth, editorH);
        ctx.clip();
        ctx.fillStyle = theme.get("gutter") ?? "rgba(255, 255, 255, 0.5)";
        for (let i = startLine; i < endLine; i++) {
            const y = editorTop + this.paddingHeight + i * this.lineHeight - doc.scrollY;
            const lineNumber = String(i + 1).padStart(this.log10NbLines, " ");
            ctx.fillText(lineNumber, 8, y);
        }
        ctx.restore();

        // Draw IDE Top Bar
        this._drawTopBar(w, doc, documents, theme, mousePos, caretVisible, uiState);

        // Draw Bottom Console Panel (if open)
        if (uiState.consoleOpen) {
            this._drawConsole(w, h, theme, mousePos, uiState);
        }

        // Draw Custom Mouse Cursor on top of everything
        if (mousePos) {
            this._drawMouseCursor(mousePos, theme, uiState);
        }
    }

    _drawTopBar(w, activeDoc, documents, theme, mousePos, caretVisible, uiState = {}) {
        const ctx = this.ctx;
        const h = this.topBarHeight;
        const { renamingTabId, renameDoc } = uiState;
        this.uiHitboxes = [];
        this.renameBoxMeta = null;

        ctx.save();
        ctx.font = `13px ${this.fontFamily}`;
        ctx.textBaseline = "middle";

        ctx.fillStyle = theme.get("topbarBg") ?? "#060911";
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = theme.get("border") ?? "rgba(255, 255, 255, 0.12)";
        ctx.fillRect(0, h - 1, w, 1);

        let tabX = 0;
        const tabWidth = 150;
        const canCloseTabs = documents.size > 1;

        for (const [id] of documents) {
            const isActive = id === activeDoc.id;
            const isRenaming = id === renamingTabId;
            const isHovered =
                mousePos &&
                mousePos.y <= h &&
                mousePos.x >= tabX &&
                mousePos.x <= tabX + tabWidth;

            if (isActive) {
                ctx.fillStyle = theme.get("tabActiveBg") ?? "#0b0f19";
                ctx.fillRect(tabX, 0, tabWidth, h);
                ctx.fillStyle = theme.get("accent") ?? "#3b82f6";
                ctx.fillRect(tabX, 0, tabWidth, 2);
            } else if (isHovered) {
                ctx.fillStyle = theme.get("tabHoverBg") ?? "#161f33";
                ctx.fillRect(tabX, 0, tabWidth, h - 1);
            }

            ctx.fillStyle = theme.get("border") ?? "rgba(255, 255, 255, 0.12)";
            ctx.fillRect(tabX + tabWidth - 1, 0, 1, h);

            if (isRenaming && renameDoc) {
                const boxX = tabX + 8;
                const boxY = 6;
                const boxW = tabWidth - (canCloseTabs ? 36 : 16);
                const boxH = h - 12;
                const textX = boxX + 4;
                const innerW = boxW - 8;

                const charW = ctx.measureText("M").width;
                this.renameBoxMeta = { boxX, boxY, boxW, boxH, textX, charW };

                const caretPx = renameDoc.cursor.col * charW;
                if (caretPx < renameDoc.scrollX) {
                    renameDoc.scrollX = caretPx;
                } else if (caretPx > renameDoc.scrollX + innerW - 2) {
                    renameDoc.scrollX = Math.max(0, caretPx - innerW + 2);
                }

                // Input box background & border
                ctx.fillStyle = theme.get("topbarBg") ?? "#060911";
                ctx.fillRect(boxX, boxY, boxW, boxH);
                ctx.strokeStyle = theme.get("accent") ?? "#3b82f6";
                ctx.lineWidth = 1;
                ctx.strokeRect(boxX, boxY, boxW, boxH);

                // Clip contents to the input box
                ctx.save();
                ctx.beginPath();
                ctx.rect(boxX + 1, boxY + 1, boxW - 2, boxH - 2);
                ctx.clip();

                const text = renameDoc.lineAt(0).content;

                // Selection highlight inside the rename box
                if (renameDoc.inSelection) {
                    const { start, end } = renameDoc.getOrderedSelection();
                    const selX = textX + start.col * charW - renameDoc.scrollX;
                    const selW = (end.col - start.col) * charW;
                    ctx.fillStyle = theme.get("selection") ?? "rgba(110, 170, 255, 0.28)";
                    ctx.fillRect(selX, boxY + 2, selW, boxH - 4);
                }

                // Filename text
                ctx.fillStyle = theme.get("foreground") ?? "#ffffff";
                ctx.fillText(text, textX - renameDoc.scrollX, h / 2 + 1);

                // Caret at exact cursor column
                if (caretVisible) {
                    const cx = textX + renameDoc.cursor.col * charW - renameDoc.scrollX;
                    ctx.fillStyle = theme.get("caret") ?? "#ffffff";
                    ctx.fillRect(cx, boxY + 3, 1.5, boxH - 6);
                }

                ctx.restore();
            } else {
                // Standard tab title
                ctx.fillStyle = isActive
                    ? (theme.get("foreground") ?? "#ffffff")
                    : (theme.get("gutter") ?? "rgba(255, 255, 255, 0.5)");
                const label = id.length > 14 ? id.slice(0, 13) + "…" : id;
                ctx.fillText(label, tabX + 12, h / 2 + 1);
            }

            this.uiHitboxes.push({
                type: "tab",
                id,
                x: tabX,
                y: 0,
                w: tabWidth,
                h
            });

            if (canCloseTabs) {
                const closeSize = 18;
                const closeX = tabX + tabWidth - closeSize - 8;
                const closeY = (h - closeSize) / 2;
                const closeHovered =
                    mousePos &&
                    mousePos.x >= closeX &&
                    mousePos.x <= closeX + closeSize &&
                    mousePos.y >= closeY &&
                    mousePos.y <= closeY + closeSize;

                if (closeHovered) {
                    ctx.fillStyle = "rgba(240, 113, 120, 0.25)";
                    ctx.fillRect(closeX, closeY, closeSize, closeSize);
                    ctx.fillStyle = "#f07178";
                } else {
                    ctx.fillStyle = theme.get("gutter") ?? "rgba(255, 255, 255, 0.5)";
                }

                ctx.fillText("×", closeX + 5, h / 2 + 1);

                this.uiHitboxes.push({
                    type: "close_tab",
                    id,
                    x: closeX,
                    y: closeY,
                    w: closeSize,
                    h: closeSize
                });
            }

            tabX += tabWidth;
        }

        // '+' New Tab button
        const addBtnW = 36;
        const addHovered =
            mousePos &&
            mousePos.y <= h &&
            mousePos.x >= tabX &&
            mousePos.x <= tabX + addBtnW;

        if (addHovered) {
            ctx.fillStyle = theme.get("tabHoverBg") ?? "#161f33";
            ctx.fillRect(tabX, 0, addBtnW, h - 1);
        }
        ctx.fillStyle = theme.get("foreground") ?? "#ffffff";
        ctx.fillText("+", tabX + 14, h / 2 + 1);

        this.uiHitboxes.push({
            type: "new_tab",
            x: tabX,
            y: 0,
            w: addBtnW,
            h
        });

        // '>_ Console' Toggle Button
        const consoleBtnW = 94;
        const consoleBtnH = 24;
        const consoleBtnX = w - 76 - 12 - consoleBtnW - 8;
        const consoleBtnY = (h - consoleBtnH) / 2;
        const consoleHovered =
            mousePos &&
            mousePos.x >= consoleBtnX &&
            mousePos.x <= consoleBtnX + consoleBtnW &&
            mousePos.y >= consoleBtnY &&
            mousePos.y <= consoleBtnY + consoleBtnH;

        ctx.fillStyle = uiState.consoleOpen || consoleHovered
            ? (theme.get("tabHoverBg") ?? "#161f33")
            : "transparent";
        ctx.fillRect(consoleBtnX, consoleBtnY, consoleBtnW, consoleBtnH);

        ctx.strokeStyle = uiState.consoleOpen
            ? (theme.get("accent") ?? "#3b82f6")
            : (theme.get("border") ?? "rgba(255, 255, 255, 0.2)");
        ctx.strokeRect(consoleBtnX, consoleBtnY, consoleBtnW, consoleBtnH);

        ctx.fillStyle = theme.get("foreground") ?? "#ffffff";
        ctx.fillText(">_ Console", consoleBtnX + 10, h / 2 + 1);

        this.uiHitboxes.push({
            type: "toggle_console",
            x: consoleBtnX,
            y: consoleBtnY,
            w: consoleBtnW,
            h: consoleBtnH
        });

        // '▶ Run' Button on the right side
        const runW = 76;
        const runH = 24;
        const runX = w - runW - 12;
        const runY = (h - runH) / 2;
        const runHovered =
            mousePos &&
            mousePos.x >= runX &&
            mousePos.x <= runX + runW &&
            mousePos.y >= runY &&
            mousePos.y <= runY + runH;

        ctx.fillStyle = runHovered
            ? (theme.get("keyword") ?? "#c792ea")
            : (theme.get("accent") ?? "#3b82f6");
        ctx.fillRect(runX, runY, runW, runH);

        ctx.fillStyle = "#ffffff";
        ctx.fillText("▶ Run", runX + 14, h / 2 + 1);

        this.uiHitboxes.push({
            type: "run",
            x: runX,
            y: runY,
            w: runW,
            h: runH
        });

        ctx.restore();
    }

    _drawConsole(w, h, theme, mousePos, uiState) {
        const ctx = this.ctx;
        const top = h - this.consoleHeight;
        const headerH = this.consoleHeaderHeight;
        const logs = uiState.consoleLogs ?? [];
        const scrollY = uiState.consoleScrollY ?? 0;

        ctx.save();

        // Console Panel Background
        ctx.fillStyle = theme.get("topbarBg") ?? "#060911";
        ctx.fillRect(0, top, w, this.consoleHeight);

        // Console Header Bar & Borders
        ctx.fillStyle = theme.get("tabActiveBg") ?? "#0b0f19";
        ctx.fillRect(0, top, w, headerH);

        const resizeHovered =
            uiState.resizingConsole ||
            (mousePos && mousePos.y >= top - 4 && mousePos.y <= top + 4);

        this.uiHitboxes.push({
            type: "resize_console",
            x: 0,
            y: top - 4,
            w,
            h: 8
        });

        // Highlight top border when hovered or dragging
        ctx.fillStyle = resizeHovered
            ? (theme.get("accent") ?? "#3b82f6")
            : (theme.get("border") ?? "rgba(255, 255, 255, 0.12)");
        ctx.fillRect(0, top - (resizeHovered ? 1 : 0), w, resizeHovered ? 2 : 1);

        ctx.fillStyle = theme.get("border") ?? "rgba(255, 255, 255, 0.12)";
        ctx.fillRect(0, top + headerH - 1, w, 1);

        ctx.font = `12px ${this.fontFamily}`;
        ctx.textBaseline = "middle";
        ctx.fillStyle = theme.get("foreground") ?? "#ffffff";
        ctx.fillText("CONSOLE / OUTPUT", 12, top + headerH / 2 + 1);

        // Accent underline under title
        ctx.fillStyle = theme.get("accent") ?? "#3b82f6";
        ctx.fillRect(12, top + headerH - 2, 115, 2);

        // 'Clear' Button
        const clearW = 52;
        const clearH = 20;
        const clearX = w - 68 - clearW;
        const clearY = top + (headerH - clearH) / 2;
        const clearHovered =
            mousePos &&
            mousePos.x >= clearX &&
            mousePos.x <= clearX + clearW &&
            mousePos.y >= clearY &&
            mousePos.y <= clearY + clearH;

        if (clearHovered) {
            ctx.fillStyle = theme.get("tabHoverBg") ?? "#161f33";
            ctx.fillRect(clearX, clearY, clearW, clearH);
        }
        ctx.fillStyle = theme.get("gutter") ?? "rgba(255, 255, 255, 0.6)";
        ctx.fillText("Clear", clearX + 8, top + headerH / 2 + 1);

        this.uiHitboxes.push({
            type: "clear_console",
            x: clearX,
            y: clearY,
            w: clearW,
            h: clearH
        });

        // '×' Close Console Button
        const closeSize = 20;
        const closeX = w - closeSize - 12;
        const closeY = top + (headerH - closeSize) / 2;
        const closeHovered =
            mousePos &&
            mousePos.x >= closeX &&
            mousePos.x <= closeX + closeSize &&
            mousePos.y >= closeY &&
            mousePos.y <= closeY + closeSize;

        if (closeHovered) {
            ctx.fillStyle = "rgba(240, 113, 120, 0.25)";
            ctx.fillRect(closeX, closeY, closeSize, closeSize);
            ctx.fillStyle = "#f07178";
        } else {
            ctx.fillStyle = theme.get("gutter") ?? "rgba(255, 255, 255, 0.6)";
        }
        ctx.fillText("×", closeX + 6, top + headerH / 2 + 1);

        this.uiHitboxes.push({
            type: "close_console",
            x: closeX,
            y: closeY,
            w: closeSize,
            h: closeSize
        });

        const bodyTop = top + headerH;
        const bodyH = this.consoleHeight - headerH;

        ctx.beginPath();
        ctx.rect(0, bodyTop, w, bodyH);
        ctx.clip();

        ctx.font = `${this.consoleFontSize}px ${this.fontFamily}`;
        ctx.textBaseline = "top";

        const lineH = this.consoleLineHeight;
        const startIdx = Math.max(0, Math.floor(scrollY / lineH));
        const endIdx = Math.min(logs.length, startIdx + Math.ceil(bodyH / lineH) + 1);

        for (let i = startIdx; i < endIdx; i++) {
            const entry = logs[i];
            const y = bodyTop + 8 + i * lineH - scrollY;

            if (entry.type === "error") {
                ctx.fillStyle = theme.get("special") ?? "#f07178";
            } else if (entry.type === "warn") {
                ctx.fillStyle = theme.get("literal") ?? "#ffcb6b";
            } else if (entry.type === "success") {
                ctx.fillStyle = theme.get("string") ?? "#a3be8c";
            } else {
                ctx.fillStyle = theme.get("foreground") ?? "#e6edf3";
            }

            ctx.fillText(`> ${entry.text}`, 12, y);
        }

        ctx.restore();
    }

    _drawMouseCursor(mousePos, theme, uiState = {}) {
        const ctx = this.ctx;
        const { x, y } = mousePos;
        const h = this.canvas.height / this.dpr;
        const consoleOpen = Boolean(uiState.consoleOpen);
        const editorBottom = consoleOpen ? h - this.consoleHeight : h;
        const color = theme.get("caret") ?? "#ffffff";

        ctx.save();
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 1.5;

        const onResizeBorder =
            consoleOpen &&
            (uiState.resizingConsole || (y >= editorBottom - 4 && y <= editorBottom + 4));

        const overRenameBox =
            this.renameBoxMeta &&
            x >= this.renameBoxMeta.boxX &&
            x <= this.renameBoxMeta.boxX + this.renameBoxMeta.boxW &&
            y >= this.renameBoxMeta.boxY &&
            y <= this.renameBoxMeta.boxY + this.renameBoxMeta.boxH;

        if (onResizeBorder) {
            // Draw vertical resize cursor (ns-resize ↕)
            ctx.beginPath();
            // Horizontal divider bar
            ctx.moveTo(x - 6, y);
            ctx.lineTo(x + 6, y);
            // Vertical shaft
            ctx.moveTo(x, y - 8);
            ctx.lineTo(x, y + 8);
            // Up arrow head
            ctx.moveTo(x - 3, y - 5);
            ctx.lineTo(x, y - 8);
            ctx.lineTo(x + 3, y - 5);
            // Down arrow head
            ctx.moveTo(x - 3, y + 5);
            ctx.lineTo(x, y + 8);
            ctx.lineTo(x + 3, y + 5);
            ctx.stroke();
        } else if ((y > this.topBarHeight && y < editorBottom - 4 && x >= this.paddingWidth) || overRenameBox) {
            // Draw I-Beam cursor
            const halfH = overRenameBox ? 7 : Math.round(this.lineHeight * 0.45);
            const serifW = 3;

            ctx.beginPath();
            ctx.moveTo(x, y - halfH);
            ctx.lineTo(x, y + halfH);
            ctx.moveTo(x - serifW, y - halfH);
            ctx.lineTo(x + serifW, y - halfH);
            ctx.moveTo(x - serifW, y + halfH);
            ctx.lineTo(x + serifW, y + halfH);
            ctx.stroke();
        } else {
            // Draw Pointer Arrow
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