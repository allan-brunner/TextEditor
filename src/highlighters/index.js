import { C89Highlighter } from "./c89.js";
import { JsHighlighter } from "./js.js";
import { TextHighlighter } from "./text.js";

export function initHighlighter(language, doc) {
    switch (language.toUpperCase()) {
        case "JAVASCRIPT":
        case "JS":
            return new JsHighlighter(doc);
        case "C":
        case "C89":
            return new C89Highlighter(doc);
        case "TXT":
        default:
            return new TextHighlighter(doc);
    }
}