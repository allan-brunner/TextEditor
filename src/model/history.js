export class HistoryManager {
    constructor(maxSnapshots = 100) {
        this.maxSnapshots = maxSnapshots;
        this.undos = [];
        this.redos = [];
        this.lastRecordTime = 0;
    }

    /**
     * Call BEFORE mutating the document.
     * @param {Object} state - { text, cursor, selection, inSelection }
     * @param {boolean} merge - Whether to merge rapid consecutive single-char edits
     */
    record(state, merge = false) {
        const now = Date.now();
        this.redos = [];

        // If typing continuously within 400ms, keep the initial pre-typing snapshot
        if (merge && this.undos.length > 0 && (now - this.lastRecordTime) < 400) {
            this.lastRecordTime = now;
            return;
        }

        const top = this.undos[this.undos.length - 1];
        if (top && top.text === state.text) {
            return;
        }

        this.undos.push(this._cloneState(state));
        if (this.undos.length > this.maxSnapshots) {
            this.undos.shift();
        }
        this.lastRecordTime = now;
    }

    undo(currentState) {
        if (this.undos.length === 0) return null;
        this.redos.push(this._cloneState(currentState));
        this.lastRecordTime = 0;
        return this.undos.pop();
    }

    redo(currentState) {
        if (this.redos.length === 0) return null;
        this.undos.push(this._cloneState(currentState));
        this.lastRecordTime = 0;
        return this.redos.pop();
    }

    _cloneState(state) {
        return {
            text: state.text,
            cursor: { ...state.cursor },
            inSelection: state.inSelection,
            selection: {
                start: { ...state.selection.start },
                end: { ...state.selection.end }
            }
        };
    }
}