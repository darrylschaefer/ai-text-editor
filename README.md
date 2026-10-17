# ai-text-editor

Local-first AI text editor for writers. Manage documents, run powerful macros, and collaborate with AI agents (with tools) using your own API key.

[Visit Website](https://fthr.vercel.app/) · [Report Bugs](https://github.com/darrylschaefer/ai-text-editor/issues/new/choose) · [Request Feature](https://github.com/darrylschaefer/ai-text-editor/issues/new/choose)

## Core features
- **Document management**: create, edit, organize, export/import
- **AI agents with tool access**: multi-step workflows that can call tools to help complete tasks
- **Reusable macros & prompts**: quick actions, templates, and selection sending
- **Semantic / hybrid search (embeddings)**: faster "find by meaning," not just keywords
- **Revision history & diffs**: inspect changes over time
- **Mobile + desktop friendly**

## Privacy / Data
Your documents and API key are stored locally on your device. When you use AI features (including agents, tools, and embeddings), the app sends relevant text/context and request payloads to the OpenAI API for processing; we don't store your content on our servers.

## Prerequisites
- **Node.js 24** (see `.nvmrc`) and **npm 11.19.0** (see `package.json`)
- **OpenAI API key** for AI features; local unit tests do not require one

## Getting started (dev)
```bash
git clone https://github.com/darrylschaefer/ai-text-editor
cd ai-text-editor
npm ci
npm run dev
```

Open: `http://localhost:5173`

## Backup
Use **Export** in the sidebar to save your data and **Import** to restore it.

## Contributing
Issues and PRs welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for installation, checks, and the pull request process.

Before submitting a change, run:

```bash
npm run check
```

This type-checks the application and tests, runs the unit tests, and creates the production web build. GitHub Actions runs the same command on Linux and Windows for pull requests and updates to `main`.

## License / Credits
Inspired by and adapted from BetterChatGPT (CC0). This project is released under the MIT license.
