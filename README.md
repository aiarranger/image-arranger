# image-arranger

[![CI](https://github.com/aiarranger/image-arranger/actions/workflows/ci.yml/badge.svg)](https://github.com/aiarranger/image-arranger/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-6c5ce7.svg)](LICENSE)

**A local-first prompt & asset request manager for AI image / video generation — it doesn't generate, it keeps your generation workflow organized.**

image-arranger manages the layer that image generators don't: which reference is canonical, which candidates you adopted, what is queued, and what prompt produced what. It works with any generation service (ChatGPT, Midjourney, Vidu, ...) because it never calls one — it writes request files that you, or a coding agent, process in the service's normal UI.

[日本語の説明はこちら](#日本語)

## Why

Character-consistent generation in 2026 is a reference-image game: you get the best results by giving the model a curated set of part references (face, expressions, outfit, attached parts). But the tooling for *managing* that reference set — versions, candidates, adoption decisions, pending requests — is usually a spreadsheet or a folder full of PNGs.

image-arranger gives that workflow structure:

- **Create kit** — pick adopted reference images and one-shot generate the character's canonical identity sheet from a reusable prompt template (bring your favorite community sheet prompt). Need to fix one part without rerolling the whole sheet? Decompose into per-part references, improve just that part, and regenerate the sheet with it attached.
- **Base** — manage per-part reference entries with candidate assets; mark only approved candidates as adopted.
- **Image** — one prompt per output image. Attach adopted images as source inputs; they are stored as links and resolve to each linked entry's *current* canonical image at queue time.
- **Video** — point start/end frames at adopted images for image-to-video services.
- **Queue** — every request is a JSON file a human or agent can process; edit, cancel, or complete requests from the UI.

The tab order *is* the workflow: **Create kit → Base → Image → Video**.

## Quick Start

Requires Node.js 20+. No dependencies, no build step.

```bash
node server.mjs --workspace ./workspace/demo --init sample --port 4217
```

Open <http://127.0.0.1:4217/>.

Checks:

```bash
node --check server.mjs
node --check public/app.js
node --test server.test.mjs
node server.mjs --workspace ./workspace/demo --init sample --doctor
```

## How Requests Flow

1. Select rows (or assets to improve) and click **Queue**.
2. image-arranger writes `workspace/<name>/requests/<id>.json` with one target per deliverable: prompt, reference images, output directory, service.
3. A human or a coding agent processes the targets in the generation service (see [AGENTS.md](AGENTS.md)) and reports completion via `POST /api/requests/complete` — or by editing the JSON.
4. Results are registered as candidate assets; you adopt the good ones, and they become references for the next round.

Analysis requests (`action: "analyze"`) work the same way, except the deliverable is JSON: per-part generation prompts that image-arranger turns into base entries automatically.

## Workspaces

All user data lives in a workspace directory you choose (kept out of Git):

```text
workspace/<name>/
  deck.json     # all prompts, entries, adoption state
  assets/       # registered candidate files (copied in)
  requests/     # queued request JSON files
  outputs/      # where processors put generated results
```

- `--init sample` — public-safe sample deck (default)
- `--init empty` — blank starter deck
- `--config config.example.json` — start from a config file

## Provenance & Rights

Every asset records `sourceLicense`, `aiGenerated`, `humanReviewed`, and `usageNotes`. Run `--doctor` before publishing any workspace: it scans for secret-like strings, absolute local paths, and missing provenance fields.

## Security Notes

- Runs on `127.0.0.1` only. Do not expose it to the network.
- Request bodies are limited to 1 MB; asset files to 80 MB; `/asset` only serves files under the configured project root.
- See [SECURITY.md](SECURITY.md) for reporting vulnerabilities.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The short version: keep it dependency-free, keep sample data public-safe, and keep generation services external.

## License

[MIT](LICENSE) © 2026 AI Arranger

---

## 日本語

**image-arranger は「生成しない」画像・動画生成ワークフロー管理ツールです。** どのリファレンスを正とするか、どの候補を採用したか、何を依頼中か——生成サービス側が持っていない管理層をローカルで完結させます。

- **素材作成**：採用画像を参照に、同一性の正となるリファレンスシートをテンプレプロンプトで一発生成（コミュニティの優れたシートプロンプトをテンプレ登録可）。シートの一部だけ直したいときはパーツに分解→そのパーツだけ改善→直したパーツを添えてシートを再生成
- **ベース**：パーツ別リファレンスを候補管理し、承認したものだけ「採用」に
- **画像**：1プロンプト＝1アウトプット。採用済み画像を元画像（生成入力）として添付でき、リンク先の最新の「正」にキュー時解決されます
- **動画**：採用画像を start/end フレームに指定して image-to-video へ
- **キュー**：依頼はすべて JSON ファイル。人間でもコーディングエージェント（[AGENTS.md](AGENTS.md) 参照）でも処理できます

タブの並びがそのまま制作フローです：**素材作成 → ベース → 画像 → 動画**。

```bash
node server.mjs --workspace ./workspace/demo --init sample --port 4217
```

を実行して <http://127.0.0.1:4217/> を開いてください。Node.js 20+ のみで動作し、依存パッケージはありません。
