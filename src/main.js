import { Editor } from "./editor.js";
import { loadDocument } from "./storage.js";

const canvas = document.getElementById("editor-canvas");
const editor = new Editor(canvas);

function resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    editor.setDpr(dpr);
    editor.render();
}

window.addEventListener("load", async () => {
    const saved = await loadDocument("default");
    if (saved?.text) {
        editor.openDocument("default", saved.text);
    }
});

window.addEventListener("resize", resize);
resize();

setInterval(() => editor.toggleCaret(), 500);