<div align="center">
  <img src="public/fthr-mark.svg" alt="fthr quill" width="64" height="64" />
  <h1>fthr</h1>
  <p><strong>A place for your words.</strong></p>
  <p>A writing workspace with AI tools, built around your documents.</p>
  <p>
    <a href="https://fthr.vercel.app/">Open fthr</a> ·
    <a href="https://github.com/darrylschaefer/ai-text-editor/issues/new/choose">Report a bug</a> ·
    <a href="CONTRIBUTING.md">Contribute</a>
  </p>
</div>

![The fthr workspace with its document library, editor, and AI assistant](docs/screenshots/readme-workspace.jpg)

fthr brings your library, writing, and AI assistant into one workspace. Keep your draft in the center, resize or close the side panes, and use Focus mode when you want more room to write. On smaller screens, the side panes open as drawers.

Write and organize documents in your browser. Connect your own API key when you want help from AI.

## Inside the workspace

| Feature | What you can do |
| --- | --- |
| Writing and organization | Format your text, organize documents into folders, and work across Draft, Finished, and Snippets sections. |
| Flexible layout | Resize or close the library and assistant, restore your desktop arrangement, and switch between dark and light themes. |
| AI assistance | Chat with configurable agents, send selected text, and enable tools that work with your documents. |
| Macros and prompts | Reuse instructions for recurring writing and editing tasks. |
| Search | Find text by keyword or use embeddings for meaning-based retrieval when configured. |
| Version history | Create checkpoints and inspect earlier content and differences. |

## Try it

Open **[fthr.vercel.app](https://fthr.vercel.app/)** to start writing. You can dismiss the API-key prompt to use the editor without AI.

To use AI, open the library pane's **Workspace settings → API** and enter your key. Agent and embedding options are available in the same settings menu. API usage is billed by your configured provider.

## Your writing and data

Documents, preferences, and your API key are stored in your browser, primarily through IndexedDB. They belong to that site's browser profile; opening another browser, device, or local installation does not automatically bring them across.

AI features send relevant text and context to the configured API provider. Embedding requests also send text when enabled. Local storage does not mean AI processing stays on your device.

Use **Workspace settings → Import / Export** to download a JSON export regularly, especially before clearing site data or changing browsers. The current export includes documents, folders, prompts, and the default chat configuration. Separate agent conversations and checkpoint history are **not included**, so it is not a complete workspace backup.

## Run locally

Use **Node.js 24.15.0 or newer within 24.x** and **npm 11.19.0**. The repository checks supported versions during installation.

```bash
git clone https://github.com/darrylschaefer/ai-text-editor.git
cd ai-text-editor
npm ci
npm run dev
```

Open [localhost:5173](http://localhost:5173/). An API key is needed for AI features, not for local editing or the automated test suite.

No environment file is required for the default setup. Optional configuration is listed in [.env.example](.env.example). `VITE_*` values are included in the browser build; use the in-app API setting for a personal key rather than embedding it in a public deployment.

## Development

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server. |
| `npm run check` | Type-check the application and tests, run the test suite, and build the web app. |
| `npm run test:watch` | Run tests while making changes. |
| `npm run build` | Create the production web build in `dist/`. |
| `npm run preview` | Serve the production build locally after building it. |

Pull requests and updates to `main` run validation on Linux and Windows. The Linux job also builds the web Docker image. See [CONTRIBUTING.md](CONTRIBUTING.md) for the branch/PR workflow, individual checks, Docker, and desktop development notes.

## Project status

fthr is actively developed. The browser app is available now; native desktop packaging is not certified by the web checks. Persistence recovery, complete backups, and AI editing safeguards remain areas of ongoing work. Keep copies of important writing and review AI changes.

Found a problem or have an idea? [Open an issue](https://github.com/darrylschaefer/ai-text-editor/issues/new/choose). The [engineering backlog](docs/engineering-backlog.md) records known follow-ups.

## License and credits

Built by Darryl Schaefer. Released under the [MIT License](LICENSE).

Inspired by and adapted from BetterChatGPT, whose original work is released under CC0.
