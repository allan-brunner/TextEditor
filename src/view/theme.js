export class Theme {
    static get(name = "MIDNIGHT") {
        switch (name.toUpperCase()) {
            case "NORD":
                return Theme.nord();
            case "SOLARIZED_DARK":
                return Theme.solarizedDark();
            case "MIDNIGHT":
            default:
                return Theme.midnight();
        }
    }

    static midnight() {
        return new Map([
            ["background", "#0b0f19"],
            ["topbarBg", "#060911"],
            ["tabActiveBg", "#0b0f19"],
            ["tabHoverBg", "#161f33"],
            ["border", "rgba(230, 237, 243, 0.12)"],
            ["accent", "#3b82f6"],
            ["foreground", "#e6edf3"],
            ["gutter", "rgba(230, 237, 243, 0.45)"],
            ["selection", "rgba(110, 170, 255, 0.28)"],
            ["caret", "#e6edf3"],
            ["default", "#e6edf3"],
            ["keyword", "#c792ea"],
            ["string", "#a5d6ff"],
            ["comment", "rgba(230, 237, 243, 0.35)"],
            ["literal", "#ffcb6b"],
            ["identifier", "#82aaff"],
            ["operator", "#89ddff"],
            ["special", "#f07178"]
        ]);
    }

    static nord() {
        return new Map([
            ["background", "#2e3440"],
            ["topbarBg", "#242933"],
            ["tabActiveBg", "#2e3440"],
            ["tabHoverBg", "#3b4252"],
            ["border", "rgba(236, 239, 244, 0.12)"],
            ["accent", "#88c0d0"],
            ["foreground", "#eceff4"],
            ["gutter", "rgba(236, 239, 244, 0.50)"],
            ["selection", "rgba(136, 192, 208, 0.25)"],
            ["caret", "#eceff4"],
            ["default", "#eceff4"],
            ["keyword", "#81a1c1"],
            ["string", "#a3be8c"],
            ["comment", "rgba(236, 239, 244, 0.40)"],
            ["literal", "#d08770"],
            ["identifier", "#88c0d0"],
            ["operator", "#81a1c1"],
            ["special", "#bf616a"]
        ]);
    }

    static solarizedDark() {
        return new Map([
            ["background", "#002b36"],
            ["topbarBg", "#001f27"],
            ["tabActiveBg", "#002b36"],
            ["tabHoverBg", "#073642"],
            ["border", "rgba(238, 232, 213, 0.15)"],
            ["accent", "#2aa198"],
            ["foreground", "#eee8d5"],
            ["gutter", "rgba(238, 232, 213, 0.45)"],
            ["selection", "rgba(38, 139, 210, 0.25)"],
            ["caret", "#eee8d5"],
            ["default", "#eee8d5"],
            ["keyword", "#268bd2"],
            ["string", "#2aa198"],
            ["comment", "rgba(238, 232, 213, 0.35)"],
            ["literal", "#b58900"],
            ["identifier", "#6c71c4"],
            ["operator", "#93a1a1"],
            ["special", "#dc322f"]
        ]);
    }
}