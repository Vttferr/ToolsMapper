# ToolMapper AI

Minimalist terminal-style tool functionality mapper built with React, Tailwind CSS, Express, and Google Gemini API, designed with extreme token economy and secure gatekeeper authorization.

## Features

- **Zero Tokens in Mapping**: Select a local program folder (`webkitdirectory`). The app parses metadata (`file.webkitRelativePath`, `file.name`) entirely client-side without reading file contents.
- **Gatekeeper Authorization**: Locally filters documentation/help files (`.md`, `.txt`, `.html`, `.json`, `.xml`, `help`, `manual`, `readme`, etc.). Content is only read and processed after express user authorization.
- **Incremental State Memory**: Persistent state (`localStorage` + import/export `resumo_estado.md`) checked prior to AI calls to avoid redundant processing.
- **Token Economy & Smart Snippet Extraction**: 100% local smart snippet extractor matches challenge keywords against authorized file paragraphs, sending only relevant snippets (~350 chars) to the Gemini model (`gemini-3.5-flash-lite`) to prevent quota exhaustion (Rate Limit 429).
- **Full-Stack Express & Server-Side Gemini**: All Gemini API calls are securely executed server-side via Express (`server.ts`).

## Setup & Installation

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and add your Gemini API key:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and set `GEMINI_API_KEY="your_api_key_here"`.

4. Run development server:
   ```bash
   npm run dev
   ```

5. Build for production:
   ```bash
   npm run build
   ```
   ```bash
   npm start
   ```

## License

Apache-2.0
