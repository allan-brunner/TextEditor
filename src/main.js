import { Editor } from "./editor.js";
import { loadAllDocuments, deleteDocument, saveDocument } from "./storage.js";

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
    const savedDocs = await loadAllDocuments();
    const validDocs = savedDocs.filter(d => d && d.text && d.text.trim().length > 0);

    if (validDocs.length > 0) {
        editor.documents.clear();
        for (const doc of validDocs) {
            const id = doc.id ?? "welcome.txt";
            editor.openDocument(id, doc.text);
        }
    }
});

window.addEventListener("resize", resize);
resize();

setInterval(() => editor.toggleCaret(), 500);