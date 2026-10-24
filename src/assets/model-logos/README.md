# Model logos

The nine SVG files in this folder are unmodified monochrome assets from
[Lobe Icons](https://github.com/lobehub/lobe-icons), pinned to revision
`7d7d0379f18b114a4009dc5cb85a7c375284f31b`.

Source directory: `packages/static-svg/icons/`.
Files: `openai.svg`, `claude.svg`, `gemini.svg`, `deepseek.svg`, `meta.svg`,
`mistral.svg`, `qwen.svg`, `grok.svg`, and `openrouter.svg`.

Copyright (c) 2023 LobeHub. The MIT license is preserved in `LICENSE.txt`
and distributed with the app at `public/licenses/lobe-icons.txt`.
The marks identify their respective brands.

`ModelLogo` uses these bundled files as 16px CSS masks to follow the current
theme. No logo service, external image URL, or icon-package runtime is used.
Model IDs resolve through `src/utils/model-brand.ts`; unknown models use the
app's generic model icon. Adding a logo does not enable an API connection or
add a model to the catalog.
