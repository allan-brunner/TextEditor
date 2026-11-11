import { Highlighter } from "./base.js";

export class JsHighlighter extends Highlighter {
    constructor(doc) {
        super(doc);
        this.keywords = new Set([
            "var", "let", "const", "function", "class",
            "if", "else", "switch", "case", "default",
            "for", "while", "do", "break", "continue",
            "try", "catch", "finally", "throw",
            "import", "export", "from", "as",
            "new", "this", "super", "extends",
            "return", "yield", "await", "async",
            "typeof", "instanceof", "in", "of",
            "delete", "void", "debugger", "with",
            "enum", "implements", "interface", "package",
            "private", "protected", "public",
            "eval", "arguments", "get", "set", "static"
        ]);
        this.literals = new Set([
            "true", "false", "null", "undefined", "NaN", "Infinity"
        ]);
        this._stringChars = new Set(['"', "'", "`"]);
    }

    tokenize(lineIdx) {
        const tokens = [];
        let i = 0;
        let state = lineIdx > 0 ? this.doc.lineAt(lineIdx - 1).lastState : "normal";
        const s = this.doc.lineAt(lineIdx).content;

        while (i < s.length) {
            // Continuing a multiline block comment
            if (state === "comment") {
                const closeIdx = s.indexOf("*/", i);
                if (closeIdx !== -1) {
                    tokens.push({ val: s.slice(i, closeIdx + 2), type: "comment" });
                    i = closeIdx + 2;
                    state = "normal";
                } else {
                    tokens.push({ val: s.slice(i), type: "comment" });
                    break;
                }
                continue;
            }

            // Continuing a multiline template literal (`...`)
            if (state === "string") {
                let value = "";
                let closed = false;
                while (i < s.length) {
                    if (s[i] === "\\" && i + 1 < s.length) {
                        value += s[i++] + s[i++];
                    } else if (s[i] === "`") {
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

            // Single-line comment
            if (char === "/" && s[i + 1] === "/") {
                tokens.push({ val: s.slice(i), type: "comment" });
                break;
            }

            // Multiline comment start
            if (char === "/" && s[i + 1] === "*") {
                const closeIdx = s.indexOf("*/", i + 2);
                if (closeIdx !== -1) {
                    tokens.push({ val: s.slice(i, closeIdx + 2), type: "comment" });
                    i = closeIdx + 2;
                } else {
                    tokens.push({ val: s.slice(i), type: "comment" });
                    state = "comment";
                    break;
                }
                continue;
            }

            // Strings & Template literals
            if (this._stringChars.has(char)) {
                const quote = char;
                let value = quote;
                let closed = false;
                i++;
                while (i < s.length) {
                    if (s[i] === "\\" && i + 1 < s.length) {
                        value += s[i++] + s[i++];
                    } else if (s[i] === quote) {
                        value += s[i++];
                        closed = true;
                        break;
                    } else {
                        value += s[i++];
                    }
                }
                if (!closed && quote === "`") {
                    state = "string";
                }
                tokens.push({ val: value, type: "string" });
                continue;
            }

            // Numbers
            if (/[0-9]/.test(char)) {
                let start = i;
                while (i < s.length && /[0-9a-fA-FxX._n]/.test(s[i])) i++;
                tokens.push({ val: s.slice(start, i), type: "literal" });
                continue;
            }

            // Identifiers & Keywords
            if (/[a-zA-Z_$]/.test(char)) {
                let start = i;
                while (i < s.length && /[a-zA-Z0-9_$]/.test(s[i])) i++;
                const word = s.slice(start, i);
                let type = "identifier";
                if (this.keywords.has(word)) type = "keyword";
                else if (this.literals.has(word)) type = "literal";
                tokens.push({ val: word, type });
                continue;
            }

            // Operators
            tokens.push({ val: char, type: "operator" });
            i++;
        }

        this.doc.lineAt(lineIdx).lastState = state;
        return tokens;
    }
}