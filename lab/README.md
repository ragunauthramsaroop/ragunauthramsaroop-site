# OpenLab IDE
A free, independent browser-based coding workspace for HTML, CSS, and JavaScript.

Live application: https://ragunauthramsaroop.com/lab/

## Features
- Edit HTML, CSS, JavaScript, JSON, Markdown, and text files in a multi-file workspace.
- Run HTML/CSS/JS websites in an isolated iframe with a JavaScript console.
- Create, rename, delete, search, and switch files and projects.
- Start with website, JavaScript, portfolio, or blank project templates.
- Save projects locally in browser storage and switch between projects.
- Import text files and OpenLab JSON backups.
- Export a project as a ZIP of source files, a standalone HTML page, or a restorable JSON backup.
- Responsive mobile layout, light/dark mode, keyboard shortcuts, and optional automatic preview refresh.
- No sign-up, paid API, server-side execution, or subscription.

## Run locally
Open \`index.html\` using a local HTTP server. For example:

\`\`\`bash
python3 -m http.server 8000
\`\`\`

Then visit \`http://localhost:8000/lab/\` when serving the parent repository, or \`http://localhost:8000/\` when serving this folder itself.

## How publishing works
On GitHub Pages, host the three source files in this folder. Sites built *inside* OpenLab can be exported as a ZIP and hosted on any free static web host that serves HTML/CSS/JS. Users should consult each hosting provider's free-tier terms.

## Deliberate limits
OpenLab is a browser-only editor, not a complete reproduction of Replit. It does not run a cloud VM, provide a hosted terminal, execute Python or server-side languages, install npm packages, save to a shared cloud database, offer multiplayer editing, or include paid AI models. Its browser preview supports HTML, CSS and JavaScript. Other text formats can be edited and exported, not executed.

Projects are stored in your browser's localStorage. Private/incognito mode, browser storage clearing, switching devices, or storage limits can remove them. Use **Export → Download OpenLab backup** or **Download ZIP** regularly.

The iframe preview is sandboxed without same-origin permissions. Avoid putting production secrets into client-side JavaScript or HTML, whether in OpenLab or any other frontend tool.

## REA provenance
The \`morluto/rea\` repository was reviewed to assess the user's reverse-engineering request. REA is a separate MCP/CLI toolkit requiring an installed agent and a permitted analysis target. OpenLab was independently authored from commonplace browser IDE interaction patterns. Replit binaries, source code and private APIs were not copied or reverse engineered.

## License
MIT. See [LICENSE](./LICENSE).
