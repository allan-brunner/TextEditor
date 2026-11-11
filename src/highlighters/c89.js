import { Highlighter } from "./base.js";

export class C89Highlighter extends Highlighter {
    constructor(doc) {
        super(doc);
        this.keywords = new Set([
            "auto", "break", "case", "char", "const", "continue", "default", "do",
            "double", "else", "enum", "extern", "float", "for", "goto", "if",
            "int", "long", "register", "return", "short", "signed", "sizeof", "static",
            "struct", "switch", "typedef", "union", "unsigned", "void", "volatile", "while"
        ]);
        this.literals = new Set(["true", "false", "NULL"]);
    }

    tokenize(lineIdx) {
        const tokens = [];
        let i = 0;
        let state = lineIdx > 0 ? this.doc.lineAt(lineIdx - 1).lastState : "normal";
        const s = this.doc.lineAt(lineIdx).content;

        while (i < s.length) {
            // Inside a multiline comment from a previous line or earlier on this line
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

            // String or char literals with escape support
            if (char === '"' || char === "'") {
                const quote = char;
                let value = quote;
                i++;
                while (i < s.length && s[i] !== quote) {
                    if (s[i] === "\\" && i + 1 < s.length) {
                        value += s[i++] + s[i++];
                    } else {
                        value += s[i++];
                    }
                }
                if (i < s.length && s[i] === quote) {
                    value += s[i++];
                }
                tokens.push({ val: value, type: "string" });
                continue;
            }

            // Preprocessor directives (#include <stdio.h>, #define, etc.)
            if (char === "#") {
                let start = i;
                while (i < s.length && !/\s/.test(s[i])) i++;
                const directive = s.slice(start, i);
                tokens.push({ val: directive, type: "special" });

                if (directive === "#include") {
                    while (i < s.length && /\s/.test(s[i])) {
                        tokens.push({ val: s[i++], type: "default" });
                    }
                    if (s[i] === "<") {
                        const closeAngle = s.indexOf(">", i + 1);
                        if (closeAngle !== -1) {
                            tokens.push({ val: s.slice(i, closeAngle + 1), type: "string" });
                            i = closeAngle + 1;
                        }
                    }
                }
                continue;
            }

            // Numbers
            if (/[0-9]/.test(char)) {
                let start = i;
                while (i < s.length && /[0-9a-fA-FxX._]/.test(s[i])) i++;
                tokens.push({ val: s.slice(start, i), type: "literal" });
                continue;
            }

            // Identifiers & Keywords
            if (/[a-zA-Z_]/.test(char)) {
                let start = i;
                while (i < s.length && /[a-zA-Z0-9_]/.test(s[i])) i++;
                const word = s.slice(start, i);
                let type = "identifier";
                if (this.keywords.has(word)) type = "keyword";
                else if (this.literals.has(word)) type = "literal";
                tokens.push({ val: word, type });
                continue;
            }

            // Operators & Punctuation
            tokens.push({ val: char, type: "operator" });
            i++;
        }

        this.doc.lineAt(lineIdx).lastState = state;
        return tokens;
    }
}