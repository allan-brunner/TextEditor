import { Highlighter } from "./base.js";

export class JsonHighlighter extends Highlighter {
    constructor(doc) {
        super(doc);
        this.literals = new Set(["true", "false", "null"]);
    }

    tokenize(lineIdx) {
        const tokens = [];
        let i = 0;
        let state = lineIdx > 0 ? this.doc.lineAt(lineIdx - 1).lastState : "normal";
        const s = this.doc.lineAt(lineIdx).content;

        while (i < s.length) {
            // Continuing an unclosed string from the previous line
            if (state === "string") {
                let value = "";
                let closed = false;
                while (i < s.length) {
                    if (s[i] === "\\" && i + 1 < s.length) {
                        value += s[i++] + s[i++];
                    } else if (s[i] === '"') {
                        value += s[i++];
                        closed = true;
                        state = "normal";
                        break;
                    } else {
                        value += s[i++];
                    }
                }
                tokens.push({ val: value, type: "string" });
                if (!closed) break;
                continue;
            }

            const char = s[i];

            // Whitespace
            if (/\s/.test(char)) {
                let start = i;
                while (i < s.length && /\s/.test(s[i])) i++;
                tokens.push({ val: s.slice(start, i), type: "default" });
                continue;
            }

            // Strings
            if (char === '"') {
                let value = '"';
                let closed = false;
                i++;
                while (i < s.length) {
                    if (s[i] === "\\" && i + 1 < s.length) {
                        value += s[i++] + s[i++];
                    } else if (s[i] === '"') {
                        value += s[i++];
                        closed = true;
                        break;
                    } else {
                        value += s[i++];
                    }
                }
                if (!closed) state = "string";
                tokens.push({ val: value, type: "string" });
                continue;
            }

            // Numbers
            if (/[0-9\-]/.test(char)) {
                let start = i;
                while (i < s.length && /[0-9\-+.eE]/.test(s[i])) i++;
                // Fallback in case a rogue '-' isn't a number
                if (i - start === 1 && char === '-') {
                    tokens.push({ val: "-", type: "operator" });
                } else {
                    tokens.push({ val: s.slice(start, i), type: "literal" });
                }
                continue;
            }

            // Literals (true, false, null)
            if (/[a-z]/.test(char)) {
                let start = i;
                while (i < s.length && /[a-z]/.test(s[i])) i++;
                const word = s.slice(start, i);
                const type = this.literals.has(word) ? "keyword" : "default";
                tokens.push({ val: word, type });
                continue;
            }

            // Structural Punctuation / Operators ({, }, [, ], :, ,)
            tokens.push({ val: char, type: "operator" });
            i++;
        }

        this.doc.lineAt(lineIdx).lastState = state;
        return tokens;
    }
}