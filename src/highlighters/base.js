export class Highlighter {
    constructor(doc) {
        this.doc = doc;
    }

    tokenize(lineIdx) {
        const line = this.doc.lineAt(lineIdx);
        line.lastState = "normal";
        return [{ val: line.content, type: "default" }];
    }

    /**
     * Propagates multiline state (e.g. unclosed block comments or template strings)
     * from startLine down until the state stabilizes.
     */
    updateStates(startLine = 0) {
        const total = this.doc.getNbLines();
        for (let i = startLine; i < total; i++) {
            const prevState = this.doc.lineAt(i).lastState;
            this.tokenize(i);
            // Once a line's output state matches what it already had,
            // subsequent lines won't change unless we are doing a full pass.
            if (i > startLine && this.doc.lineAt(i).lastState === prevState) {
                break;
            }
        }
    }
}