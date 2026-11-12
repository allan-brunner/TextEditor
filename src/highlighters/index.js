import { C89Highlighter } from "./c89.js";
import { JsHighlighter } from "./js.js";
import { TextHighlighter } from "./text.js";
import { JsonHighlighter } from "./json.js";

export function initHighlighter(language, doc) {
    switch (language.toUpperCase()) {
        case "JAVASCRIPT":
        case "JS":
            return new JsHighlighter(doc);
        case "C":
        case "C89":
            return new C89Highlighter(doc);
        case "JSON":
            return new JsonHighlighter(doc);
        case "TXT":
        default:
            return new TextHighlighter(doc);
    }
}