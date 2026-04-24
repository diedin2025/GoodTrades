/** @type {import('tailwindcss').Config} */
// #region agent log H1
fetch("http://127.0.0.1:7671/ingest/2e61fa01-49b1-486d-9b23-328d2b16dda2", {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "bbec9a" },
  body: JSON.stringify({
    sessionId: "bbec9a",
    runId: "pre-fix",
    hypothesisId: "H1",
    location: "tailwind.config.js:2",
    message: "Tailwind config module loaded",
    data: { cwd: process.cwd() },
    timestamp: Date.now(),
  }),
}).catch(() => {});
// #endregion
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Plus Jakarta Sans", "sans-serif"],
        display: ["Bricolage Grotesque", "sans-serif"],
      },
      borderRadius: {
        panel: "24px",
        soft: "18px",
      },
      boxShadow: {
        glow: "0 18px 45px rgba(255, 92, 92, 0.22)",
        panel: "0 24px 80px rgba(0, 0, 0, 0.28)",
      },
      colors: {
        ink: "#fff4f4",
        muted: "#d6b4b4",
        bg: "#140708",
        "bg-soft": "#200c0e",
        panel: "rgba(37, 13, 16, 0.82)",
        "panel-strong": "rgba(47, 16, 20, 0.94)",
        line: "rgba(255, 173, 173, 0.16)",
        "line-strong": "rgba(255, 173, 173, 0.28)",
        accent: "#ff8a8a",
        brand: "#ff5c5c",
        positive: "#82d173",
        negative: "#ff7b7b",
        info: "#7dd3fc",
      },
    },
  },
  plugins: [
    // #region agent log H2/H3/H4
    ({ theme }) => {
      fetch("http://127.0.0.1:7671/ingest/2e61fa01-49b1-486d-9b23-328d2b16dda2", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "bbec9a" },
        body: JSON.stringify({
          sessionId: "bbec9a",
          runId: "pre-fix",
          hypothesisId: "H2_H3_H4",
          location: "tailwind.config.js:40",
          message: "Theme resolution snapshot",
          data: {
            colorLine: theme("colors.line"),
            borderLine: theme("borderColor.line"),
            bgPanel: theme("colors.panel"),
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
    },
    // #endregion
  ],
};
