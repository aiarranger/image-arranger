---
role: plan
depends_on:
  - docs/OSS_READINESS_REVIEW.md
---
# 実装計画 — image-arranger OSS公開改善

## 概要

`docs/OSS_READINESS_REVIEW.md`（6レビュー役＋横断批評役）で挙がった指摘を、OSS公開に向けて段階的に解消する実装計画。**開発は Codex（コーディングエージェント）に依頼**する前提で、各タスクに「対象ファイル/行・受け入れ条件・検証コマンド・担当」を明示する。

製品哲学（**依存ゼロ・ローカルファースト・生成は外部サービスのまま**）は変えない。すべてのタスクはこの枠内で実行可能。

### 外部サービス・リファレンスの適用可否

本スキルが必須参照とする `ref-google-cloud` / `ref-supabase` / `ref-vercel-deploy` / `ref-gemini-api` は **本プロジェクトには適用しない**。理由: image-arranger は依存ゼロのローカルNode.jsツールで、Supabase / Google Cloud / Vercel / Gemini を一切使わない。DBもOAuthもサーバーレスデプロイも無い。**唯一の外部接点は (1) npm への公開、(2) GitHub のリポジトリ設定/Pages/Release** の2つで、これらは本計画の Phase 0 / Phase 2 に固有手順として記載する。

### 担当凡例

| 記号 | 担当者 | 説明 |
|------|--------|------|
| 👤 | 人間（リポジトリオーナー） | npm/GitHub操作、アカウント権限、最終判断、ビジュアル素材の録画 |
| 🤖 | Codex | コーディング、テスト追加・実行、ドキュメント編集、構文チェック |
| 👤+🤖 | 共同 | Codexが実行し、人間がレビュー/承認 |

### 開発サイクル（タスク単位）

```
ブランチ作成 → 実装(🤖) → 検証コマンド全パス → 人間レビュー(👤) → main へマージ
```

### Codex への依頼方法（運用ルール）

- **1タスク = 1ブランチ = 1PR**。ブランチ名は `oss/<タスクID>`（例: `oss/P0-SEC-1`）。
- 依頼時は本計画の該当タスク行（対象ファイル/受け入れ条件/検証コマンド）をそのまま貼る。
- **検証ゲート（全タスク共通・マージ前に必須）**:
  ```bash
  node --check server.mjs
  node --check public/app.js
  node --check scripts/process-queue.mjs
  node --check scripts/agent-browser.mjs
  node --test server.test.mjs
  node server.mjs --workspace /tmp/ia-verify --init sample --doctor
  ```
- セキュリティ系（P0-SEC）は、受け入れ条件にある**手動再現テスト**もPR説明に貼る。
- 依存追加は**禁止**（`package.json` の `dependencies` は常に空）。ビルドステップ追加も禁止。

### フェーズ一覧

| Phase | 名称 | 主な担当 | 目標 | 状態 |
|-------|------|---------|------|------|
| 0 | 公開前ブロッカー | 👤+🤖 | これが無いと公開できない3系統(セキュリティ/自動化の正直化/パッケージング/ビジュアル)を解消 | ⏳ 未着手 |
| 1 | 初回成功率 | 🤖 | 初見ユーザーが詰まらず中核ループを完了できる | ⏳ 未着手 |
| 2 | 公開ローンチ＆拡大 | 👤+🤖 | npm公開・GitHub公開・告知、拡張点の整備 | ⏳ 未着手 |
| 3 | 品質底上げ | 🤖 | 保守性・堅牢性・データ安全・アクセシビリティ | ⏳ 未着手 |

> **依存順の注意**: Phase 0 のセキュリティ修正（P0-SEC-*）は他のどのタスクより先に着手してよい（独立）。Phase 2 の「npm公開」は P0-PKG-1（package.json作成）完了が前提。「GitHub公開/Pages有効化」は Phase 0 の全タスクと Phase 1 完了後に行う（公開当日に未解決の穴を残さない）。

---

## Phase 0: 公開前ブロッカー ⏳ 未着手

**目標**: 「公開当日に叩かれる/初回でクラッシュする/良さが伝わらない」を潰す
**主な担当**: 🤖 がコード、👤 がビジュアル素材とnpm名確保

> **凡例**: 👤 = 人間 / 🤖 = Codex

### 0.1 セキュリティ: localhost露出の封鎖（最優先・独立着手可）

| # | タスク | 担当 | 対象 | 完了条件 | 状態 |
|---|--------|------|------|---------|------|
| P0-SEC-1 | Host/Origin許可リスト | 🤖 | server.mjs:1473-1503, 1517 | 下記受け入れ条件 | ✅ |
| P0-SEC-2 | Content-Type強制 | 🤖 | server.mjs readBody 852-877 | 非JSONボディを415で拒否 | ✅ |
| P0-SEC-3 | `/asset` スコープ縮小＋CORS除去 | 🤖 | server.mjs serveFile 1365-1380, /asset 1477-1492 | 下記受け入れ条件 | ✅ |
| P0-SEC-4 | 絶対パスsourceFile不許可 | 🤖 | server.mjs copyAssetIntoWorkspace 937-977 | workspace外パスを400で拒否 | ✅ |
| P0-SEC-5 | symlink realpath検証 | 🤖 | server.mjs safeResolve 879-890 | realpathが許可ディレクトリ外なら拒否 | ✅ |
| P0-SEC-6 | referenceUrl scheme検証 | 🤖 | public/app.js escapeHtml 393, link 777 | `javascript:` 等を非リンク化 | ✅ |
| P0-SEC-7 | 上記のテスト＋SECURITY.md/README更新 | 🤖 | server.test.mjs, SECURITY.md, README.md:74-78 | テスト追加・脅威モデル記述 | ✅ |

**P0-SEC-1 受け入れ条件**（根拠: レビュー C2）:
- `createServer` ハンドラ先頭で、`Host` ヘッダが `127.0.0.1:<port>` / `localhost:<port>` 以外なら 403。
- 非GETメソッドは `Origin` が不在 or サーバ自身のオリジンと一致しなければ 403。
- 手動再現テスト（PRに添付）:
  ```bash
  # 正常: 200
  curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4217/api/state
  # 偽Host: 403 を期待
  curl -s -o /dev/null -w "%{http_code}\n" -H "Host: evil.example" http://127.0.0.1:4217/api/state
  # 偽Origin POST: 403 を期待
  curl -s -o /dev/null -w "%{http_code}\n" -X POST -H "Origin: https://evil.example" -H "Content-Type: application/json" -d '{}' http://127.0.0.1:4217/api/requests
  ```

**P0-SEC-3 受け入れ条件**（根拠: レビュー H10）:
- `/asset` の配信ルートを `projectRoot` 全体ではなく workspace の `assets/` と `outputs/` に限定。
- `Access-Control-Allow-Origin: *` と `Access-Control-Allow-Private-Network: true` を除去（クロスオリジン読みは不要）。
- 手動再現テスト: `curl "http://127.0.0.1:4217/asset?path=server.mjs"` と `?path=workspace/demo/deck.json` がいずれも 403/404 を返す。assets配下の実ファイルは 200。

**P0-SEC-7 受け入れ条件**:
- `server.test.mjs` に: 偽Host403 / 偽Origin POST403 / `/asset` でソース・config・deck.jsonが読めない / 絶対パスsourceFile拒否、の各ケース。
- `SECURITY.md` に「サーバ起動中にWeb閲覧すると任意サイトが到達し得る」脅威と Host/Origin 緩和を記述。
- `README.md` Security Notes を実スコープに合わせて修正（`/asset` の実際の配信範囲）。

> **注意**: P0-SEC-1 と既存の Quick Start・テスト・`process-queue.mjs`（同一ホストからのアクセス）が壊れないこと。`process-queue.mjs` は `127.0.0.1:<port>` に出すので影響なし、を検証ゲートで確認。

### 0.2 ChatGPT自動化の「正直化＋初回クラッシュ解消」

| # | タスク | 担当 | 対象 | 完了条件 | 状態 |
|---|--------|------|------|---------|------|
| P0-AUTO-1 | CONTRIBUTINGの矛盾修正＋ToS免責 | 🤖 | CONTRIBUTING.md:25, README.md, AGENTS.md冒頭 | 下記受け入れ条件 | ✅ |
| P0-AUTO-2 | Node版ガード（22+要求の明示） | 🤖 | scripts/process-queue.mjs 冒頭, scripts/agent-browser.mjs:92 | Node20で明確メッセージ＋clean exit | ✅ |
| P0-AUTO-3 | ポート既定の4217統一 | 🤖 | scripts/process-queue.mjs:31, AGENTS.md:15,18 | 全箇所4217 | ✅ |
| P0-AUTO-4 | READMEに「Scripted processing(optional)」節 | 🤖 | README.md | 2コマンド＋免責＋プラットフォーム明記 | ✅ |

**P0-AUTO-1 受け入れ条件**（根拠: レビュー C3）:
- `CONTRIBUTING.md:25` を「**サーバ本体は**いかなるサービスも呼ばない/自動化しない。自動化ドライバは `scripts/` に**ユーザー操作・免責付き**のツールとして存在する」に修正。
- README と AGENTS.md 冒頭に明示: 「このスクリプトは**あなたのブラウザ・あなたのアカウント・あなたの責任**で動作し、生成サービスの利用規約と衝突し得る。安定した正式インターフェースは request file 契約であり、スクリプトは差し替え可能な任意ドライバ」。
- 全文書で `terms` / `disclaimer` / OpenAI ToS への言及が存在する（現状grep 0件を解消）。

**P0-AUTO-2 受け入れ条件**（根拠: レビュー H6, 批評役訂正で確認済み）:
- `process-queue.mjs` 先頭で `typeof WebSocket === 'undefined'`（= Node 20）を検知したら「このスクリプトは Node 22+ が必要（グローバルWebSocket）。サーバ本体は Node 20+ で動作します」と表示し `process.exit(1)`。
- `agent-browser.mjs:92` のコメントと整合。

**P0-AUTO-3 受け入れ条件**（根拠: レビュー H1群 共通指摘）:
- `process-queue.mjs:31` の `--server` 既定を `http://127.0.0.1:4217`。
- `AGENTS.md` のscript例(15,18)とcurl例(76,151,165)がすべて4217。`--server`/`IMAGE_ARRANGER_SERVER` 上書きは残す。

**検証**: `node scripts/process-queue.mjs --dry-run`（Node22で）が4217に接続を試みる。Node20では P0-AUTO-2 のメッセージで終了。

### 0.3 パッケージング＆リリース基盤

| # | タスク | 担当 | 対象 | 完了条件 | 状態 |
|---|--------|------|------|---------|------|
| P0-PKG-1 | 依存ゼロ package.json 作成 | 🤖 | （新規）package.json, server.mjs先頭(shebang) | 下記受け入れ条件 | ✅ |
| P0-PKG-2 | CONTRIBUTING/CIに scripts/ の --check 追加 | 🤖 | CONTRIBUTING.md:9-14, .github/workflows/ci.yml | 4ファイル全部 --check | ✅ |
| P0-PKG-3 | CIマトリクス(Node 20/22/24) | 🤖 | .github/workflows/ci.yml | matrix.node-version:[20,22,24] | ✅ |
| P0-PKG-4 | CHANGELOG.md 作成 | 🤖 | （新規）CHANGELOG.md | Keep a Changelog形式・Unreleased節 | ✅ |
| P0-PKG-5 | config.json を .gitignore | 🤖 | .gitignore | `config.json` 追加 | ✅ |
| P0-PKG-6 | npm名 `image-arranger` 確保 | 👤 | npmjs.com | 名前予約済み | ⏳ |

**P0-PKG-1 受け入れ条件**（根拠: レビュー H9, 批評役で名前空きを確認）:
```json
{
  "name": "image-arranger",
  "version": "0.1.0",
  "description": "Local-first prompt & asset request manager for AI image/video generation — it doesn't generate, it keeps your workflow organized.",
  "type": "module",
  "engines": { "node": ">=20" },
  "bin": { "image-arranger": "./server.mjs" },
  "files": ["server.mjs", "public/", "scripts/", "examples/", "AGENTS.md", "README.md", "LICENSE"],
  "repository": { "type": "git", "url": "https://github.com/aiarranger/image-arranger.git" },
  "homepage": "https://aiarranger.github.io/image-arranger/",
  "bugs": "https://github.com/aiarranger/image-arranger/issues",
  "license": "MIT",
  "scripts": {
    "start": "node server.mjs --workspace ./workspace/demo --init sample --port 4217",
    "test": "node --test server.test.mjs",
    "doctor": "node server.mjs --workspace ./workspace/demo --init sample --doctor",
    "check": "node --check server.mjs && node --check public/app.js && node --check scripts/process-queue.mjs && node --check scripts/agent-browser.mjs"
  }
}
```
- `dependencies` は記載しない（依存ゼロ）。
- `server.mjs` 先頭に `#!/usr/bin/env node` を追加（`bin` 用）。既存の `node --check` が通ること。
- **注意**: `engines.node` は `>=20`（サーバ基準）。スクリプトの22+要求は P0-AUTO-2 のランタイムガードで担保。

**P0-PKG-6 手順** (👤):
1. <https://www.npmjs.com/> にログイン（アカウント未作成なら作成）。
2. `npm whoami` でCLIログイン確認（未ログインなら `npm login`）。
3. **名前予約のみ**（実公開はPhase 2）。予約したい場合は最小 package.json で `npm publish --dry-run` で名前衝突が無いことを確認。実publishはPhase 2 P2-REL-2 で実施。
4. **メモすべき情報**: 【N1】npmユーザー名、【N2】`npm publish --dry-run` の結果（403/名前衝突の有無）。

> **トラブルシューティング**: `npm publish` で `E403` → 名前が既に取られている。批評役確認時点では空きだが、念のため Phase 2 着手前に再確認。

### 0.4 ビジュアル（発見・信頼の最大レバー）

| # | タスク | 担当 | 対象 | 完了条件 | 状態 |
|---|--------|------|------|---------|------|
| P0-VIS-1 | サンプルにプレースホルダ画像同梱 | 🤖 | server.mjs(`--init sample`), examples/sample-deck.json | 候補/採用/canonicalが初回可視 | ✅ |
| P0-VIS-2 | デモGIF録画（中核ループ60-90秒） | 👤 | （新規）docs/assets/demo.gif | URL投入→生成→採用の一巡 | ⏳ |
| P0-VIS-3 | スクショ3枚撮影 | 👤 | （新規）docs/assets/*.png | Base採用/Imageタブ/run-log | ⏳ |
| P0-VIS-4 | README冒頭にGIF/スクショ挿入 | 🤖 | README.md | タグライン直下にGIF | ⏳ |
| P0-VIS-5 | landingのCSSモック差し替え | 🤖 | docs/index.html:184 (TODO T13) | TODO削除・実物GIF/画像 | ⏳ |

**P0-VIS-1 受け入れ条件**（根拠: レビュー L11）:
- `--init sample` 生成時に 3-5枚の公開安全なプレースホルダPNG（幾何/シルエット可）を `assets/` に配置し、1枚を採用済み・1枚を未採用に。
- テストfixtureが参照する `assets/base-reference.png` がfresh workspaceに存在する（現状の不整合を解消）。
- `--doctor` がクリーンを維持（provenanceフィールドを埋める）。

**P0-VIS-2/3 手順** (👤):
1. `node server.mjs --workspace /tmp/ia-demo --init sample --port 4217` で起動。
2. ブラウザの画面収録（macOS: Cmd+Shift+5）で中核ループを60-90秒録画 → GIF化（`ffmpeg` or gif変換ツール）。
3. 静止スクショ3枚を撮影し `docs/assets/` に保存。
4. ファイル名: `demo.gif`, `base-tab.png`, `image-tab.png`, `run-log.png`。
5. **メモすべき情報**: 【V1】各ファイルの最終パス（P0-VIS-4/5 でCodexが参照）。

> このタスクは👤がやる方が早い（実画面の録画）。素材は `agent-logs/run-*/` の既存スクショも流用可。

### Phase 0 完了条件

- [ ] P0-SEC-1〜7: セキュリティ手動再現テスト全パス、テスト追加、SECURITY.md/README更新 (🤖)
- [ ] P0-AUTO-1〜4: CONTRIBUTING矛盾解消、Node22ガード、ポート4217統一、README自動化節 (🤖)
- [ ] P0-PKG-1〜5: package.json/CI/CHANGELOG/.gitignore (🤖)、P0-PKG-6 npm名確認 (👤)
- [ ] P0-VIS-1: プレースホルダ画像 (🤖)、P0-VIS-2〜5: デモ素材とREADME/landing反映 (👤+🤖)
- [ ] 検証ゲート（4ファイル --check + test + doctor）全パス

### Phase 0 チェックリスト

```
⏳ セキュリティ
  ✅ P0-SEC-1 Host/Origin (🤖)
  ✅ P0-SEC-2 Content-Type (🤖)
  ✅ P0-SEC-3 /asset scope+CORS (🤖)
  ✅ P0-SEC-4 絶対パス拒否 (🤖)
  ✅ P0-SEC-5 symlink realpath (🤖)
  ✅ P0-SEC-6 referenceUrl scheme (🤖)
  ✅ P0-SEC-7 テスト+文書 (🤖)
⏳ 自動化の正直化
  ✅ P0-AUTO-1 CONTRIBUTING+免責 (🤖)
  ✅ P0-AUTO-2 Node22ガード (🤖)
  ✅ P0-AUTO-3 ポート4217統一 (🤖)
  ✅ P0-AUTO-4 README自動化節 (🤖)
⏳ パッケージング
  ✅ P0-PKG-1 package.json (🤖)
  ✅ P0-PKG-2 CI/CONTRIBUTING --check (🤖)
  ✅ P0-PKG-3 CIマトリクス (🤖)
  ✅ P0-PKG-4 CHANGELOG (🤖)
  ✅ P0-PKG-5 .gitignore config.json (🤖)
  ⏳ P0-PKG-6 npm名確保 (👤)
⏳ ビジュアル
  ✅ P0-VIS-1 サンプル画像 (🤖)
  ⏳ P0-VIS-2 デモGIF (👤)
  ⏳ P0-VIS-3 スクショ (👤)
  ⏳ P0-VIS-4 README挿入 (🤖)
  ⏳ P0-VIS-5 landing差し替え (🤖)
```

---

## Phase 1: 初回成功率 ⏳ 未着手

**目標**: エージェント不在の人を含め、初見ユーザーが詰まらず中核ループを完了できる
**主な担当**: 🤖 がコード/ドキュメント

> **凡例**: 👤 = 人間 / 🤖 = Codex

| # | タスク | 担当 | 対象 | 受け入れ条件 | 状態 |
|---|--------|------|------|------------|------|
| P1-DOC-1 | 「手動処理（エージェント不要）」節 | 🤖 | README.md, AGENTS.md | ①requests/開く②貼付/添付③保存④UIドロップで自動完了、の4手順 | ⏳ |
| P1-I18N-1 | agent-promptの英語版 | 🤖 | public/app.js agentPromptFor 2355-2460 | 3テンプレ(analyze/draft-prompt/generate)を `state.lang` 分岐 | ⏳ |
| P1-I18N-2 | UI/サンプル既定を英語化 | 🤖 | public/app.js:360, public/index.html:2, examples/sample-deck.json | 既定`en`(or navigator.language)、jaはトグル | ⏳ |
| P1-I18N-3 | gallery.html とツールチップのi18n | 🤖 | public/gallery.html, public/app.js:1287 | EN時に日本語ハードコードが残らない | ⏳ |
| P1-DOC-2 | request-file契約の仕様書 | 🤖 | （新規）docs/request-spec.md | 全フィールド型/意味+completeAPI payload+互換約束+ドライバ作成ガイド | ⏳ |
| P1-DOC-3 | glossary追加 | 🤖 | README.md | deck/kit/entry/adopted/canonical/coding agent の定義 | ⏳ |
| P1-DOC-4 | Queue/Gallery/landing をREADMEに反映 | 🤖 | README.md:24 | 5タブ整合、clone手順、landingリンク | ⏳ |
| P1-CI-1 | issue/PRテンプレ | 🤖 | （新規）.github/ISSUE_TEMPLATE/*, PULL_REQUEST_TEMPLATE.md | bug/feature/「ChatGPT UI breakage」/「new service」+PRテンプレ | ⏳ |

**P1-DOC-1 受け入れ条件**（根拠: レビュー H2、app.js:1662-1678で自動完了を確認済み）:
- 「Process a request by hand (no agent needed)」節を README に追加し AGENTS.md からリンク。
- 手順は実装挙動（候補登録で保留generateターゲットが自動完了）に一致。

**P1-DOC-2 受け入れ条件**（根拠: レビュー H7）:
- `image-arranger-request.v1`（server.mjs:546）の全フィールドを型・意味付きで列挙。
- `POST /api/requests/complete` の各payload形状（results / error / parts / prompt）を記載。
- 互換約束（v1の意味は不変・追加のみ）と「サービスドライバの書き方」（agent-browser.mjsのexportを参照実装として）を記載。

#### Phase 1 E2Eテストチェックリスト（手動・👤+🤖）

```
⏳ E2E-P1-01: 初見ENユーザー
  - 既定起動 → UIが英語で表示される（P1-I18N-2）
⏳ E2E-P1-02: 手動処理パス
  - requests/<id>.json のプロンプトを手で処理 → UIに候補登録 → ターゲットが done になる（P1-DOC-1）
⏳ E2E-P1-03: agent-prompt英語
  - EN時に「Copy agent prompt」した内容が英語（P1-I18N-1）
⏳ E2E-P1-04: gallery EN
  - EN時にGalleryビュー/ツールチップに日本語が残らない（P1-I18N-3）
```

### Phase 1 完了条件

- [ ] エージェント不要の手動パスが文書化され、実挙動と一致
- [ ] EN既定でUI/サンプル/agent-prompt/galleryに日本語ハードコードが残らない
- [ ] `docs/request-spec.md` が存在し v1 全フィールドを網羅
- [ ] issue/PRテンプレ設置
- [ ] 検証ゲート全パス＋E2E-P1-01〜04 確認

---

## Phase 2: 公開ローンチ＆拡大 ⏳ 未着手

**目標**: npm公開・GitHub公開・告知し、拡張点と差別化を整える
**主な担当**: 👤 がnpm/GitHub操作と告知、🤖 がドキュメント

> **重要**: Phase 0/1 完了が前提（未解決の穴を残して公開しない）。順序は P2-REL-1（タグ）→ P2-REL-2（npm）→ P2-PUB-1（GitHub公開/Pages）。

| # | タスク | 担当 | 対象 | 受け入れ条件 | 状態 |
|---|--------|------|------|------------|------|
| P2-DOC-1 | 比較/代替セクション | 🤖 | README.md | spreadsheet/ComfyUI/Eagle対比＋「not for you if」 | ⏳ |
| P2-DOC-2 | 日本語READMEのparity | 🤖 | README.md or 新規README.ja.md | 英語版と章対応 or 要約明示+アンカー | ⏳ |
| P2-DOC-3 | OSサポートマトリクス | 🤖 | README.md | サーバ/スクリプト/keystroke fallbackの対応表 | ⏳ |
| P2-DOC-4 | AGENTS.md構造修正 | 🤖 | AGENTS.md:95-135 | H3入れ子・番号修正・深い手順をdocs/manual-fallback.mdへ | ⏳ |
| P2-FA-1 | Font Awesomeローカル化 | 🤖 | public/index.html:7-13, public/app.js | CDN除去・インラインSVG/vendoring・オフライン動作 | ⏳ |
| P2-SEL-1 | セレクタ自己診断＋SELECTORS.md | 🤖 | scripts/process-queue.mjs(--check), agent-browser.mjs, （新規）SELECTORS.md | --checkでUI変更を検知し明確メッセージ | ⏳ |
| P2-SEL-2 | 画像/エラー検出のロケール中立化 | 🤖 | scripts/agent-browser.mjs:324,343,262 | 日本語alt前提を構造シグナルに | ⏳ |
| P2-REL-1 | v0.1.0タグ＋GitHub Release | 👤 | git tag, GitHub Releases | リリースノート付き | ⏳ |
| P2-REL-2 | npm publish | 👤 | npmjs.com | `npx image-arranger` が動く | ⏳ |
| P2-PUB-1 | GitHub公開/メタ/Pages | 👤 | GitHub repo settings | public化・description/homepage/topics・Pages有効 | ⏳ |
| P2-PUB-2 | 告知（JP/EN） | 👤 | Zenn/note/X, Show HN | 記事＋デモGIF | ⏳ |

**P2-REL-1 手順** (👤):
1. ローカルで検証ゲート全パスを確認。
2. `git tag v0.1.0 && git push origin v0.1.0`。
3. GitHub → Releases → Draft a new release → tag `v0.1.0` 選択 → CHANGELOGの該当節を本文に貼付 → Publish。
4. **メモ**: 【R1】Release URL。

**P2-REL-2 手順** (👤):
1. `npm whoami` でログイン確認。
2. `npm publish --dry-run` で `files` の中身を確認（workspace/agent-logs等の私的データが含まれないこと）。
3. `npm publish`。
4. 別ディレクトリで `npx image-arranger --workspace /tmp/ia-npx --init sample --port 4217` が起動することを確認。
5. **メモ**: 【R2】公開バージョン、【R3】`npx` 動作確認結果。

> **トラブルシューティング**: `npm publish` で `E403`（名前衝突）→ scope付き `@aiarranger/image-arranger` を検討し、READMEのnpx例も合わせて更新。

**P2-PUB-1 手順** (👤):
1. GitHub repo → Settings → General → 「Change visibility」→ Public。
2. リポジトリ右上 ⚙（About）→ description にタグライン、website に `https://aiarranger.github.io/image-arranger/`、topics に `ai-art, image-generation, video-generation, prompt-management, local-first, zero-dependencies, nodejs, chatgpt, agent-workflow, ai-agents`。
3. Settings → Pages → Source: Deploy from a branch → `main` / `/docs`。
4. CIバッジ（README:3）が公開後に描画されることを確認。
5. **メモ**: 【P1】Pages URLが200で開く、【P2】CIバッジ表示。

> **トラブルシューティング**: Pagesが404 → `docs/.nojekyll` 存在を確認（既にあり）。ビルド完了まで数分。

### Phase 2 完了条件

- [ ] README に比較/JP parity/OSマトリクス、AGENTS.md構造修正、Font Awesomeローカル化
- [ ] セレクタ自己診断＋ロケール中立化
- [ ] v0.1.0 Release、npm公開（npx動作）、GitHub公開＋Pages＋メタ設定
- [ ] JP/EN告知実施

---

## Phase 3: 品質底上げ ⏳ 未着手

**目標**: 保守性・堅牢性・データ安全・アクセシビリティ
**主な担当**: 🤖

> **凡例**: 👤 = 人間 / 🤖 = Codex

| # | タスク | 担当 | 対象 | 受け入れ条件 | 状態 |
|---|--------|------|------|------------|------|
| P3-CQ-1 | server.mjs分割 | 🤖 | server.mjs → deck-model/requests/prompts/doctor.mjs | ビルド/依存なしで分割・全テストパス | ⏳ |
| P3-CQ-2 | 更新ロスト修正 | 🤖 | server.mjs 変更系ハンドラ(1030,1045,1062,1297) | readBody後にreadState、or deck.json書き込み直列化 | ⏳ |
| P3-CQ-3 | doctor/純粋関数テスト | 🤖 | server.test.mjs | validateStateForPublishにsk-/絶対パス/license欠落を与え検証 | ⏳ |
| P3-CQ-4 | 自動化スクリプトを experimental/ へ | 🤖 | scripts/ → integrations/ or experimental/ | サポート階層を明示・README更新 | ⏳ |
| P3-CQ-5 | dead code削除 | 🤖 | process-queue.mjs:21, server.mjs:1507,28 | 未使用import/legacy alias削除（prompt-deck.v1デッキが外部に無い前提で） | ⏳ |
| P3-DATA-1 | deck.json backup/export | 🤖 | server.mjs writeJson周辺 | 保存前.bak or .history/スナップショット＋export/import | ⏳ |
| P3-DATA-2 | 世代マイグレーションガード＋テスト | 🤖 | server.mjs normalizeState 446 | newer schemaを拒否/警告+backup、移行ロスレステスト | ⏳ |
| P3-PERF-1 | HTTP Range/206対応 | 🤖 | server.mjs serveFile 1364-1380 | 動画シーク可・readStream化 | ⏳ |
| P3-PERF-2 | 再描画スコープ化（任意） | 🤖 | public/app.js render 1255-1265 | アクティブタブ/リストに限定、数百entryで実用 | ⏳ |
| P3-A11Y-1 | モーダルEsc/フォーカストラップ | 🤖 | public/app.js モーダル 750,1242 | Escで閉じる・focus復帰・意味あるalt | ⏳ |
| P3-SEC-1 | CSPヘッダ | 🤖 | server.mjs HTML応答 | `default-src 'self'`（Font Awscローカル化後） | ⏳ |
| P3-API-1 | APIレスポンス形状統一（任意） | 🤖 | server.mjs GET /api/state 981 | 規約文書化 or `{ok,state}` 包む | ⏳ |

**P3-CQ-2 受け入れ条件**（根拠: 批評役の訂正 — `.tmp`競合ではなく readState-before-await が真因）:
- 変更系ハンドラで `await readBody()` の**後**に `readState()` する、または deck.json 変更をin-processの非同期mutexで直列化。
- 「ワークスペースは single-writer」をドキュメント化。

**P3-DATA-1 受け入れ条件**（根拠: 批評役 MISSED）:
- 保存前に `deck.json.bak`（or `workspace/.history/` のタイムスタンプ付き）を書く。
- JSON export/import の手段を提供し README に backup場所を記載。

### Phase 3 完了条件

- [ ] server.mjs分割後も全テストパス、更新ロスト修正＋テスト
- [ ] doctorテスト、deck backup/export、マイグレーションガード
- [ ] Range対応、モーダルキーボード、CSP
- [ ] dead code削除、（任意）再描画スコープ化/API統一

---

## ドリフト確認（現状スナップショット）

| 項目 | 現状 | あるべき | 対応タスク |
|------|------|---------|-----------|
| package.json | 不在 | 依存ゼロで作成 | P0-PKG-1 |
| 既定ポート | server=4217 / script=4310 | 4217統一 | P0-AUTO-3 |
| Node要件 | README「20+」/ script実体「22+」 | サーバ20+/スクリプト22+を明示 | P0-AUTO-2, P0-PKG-1 |
| `/asset` 配信ルート | projectRoot=`.`（リポジトリ全体）| assets/outputsのみ | P0-SEC-3 |
| リポジトリ可視性 | private / メタ空 | public / メタ設定 | P2-PUB-1 |
| タグ/リリース | 無し | v0.1.0 | P2-REL-1 |
| CONTRIBUTING:25 | 「サービスUIを自動化しない」（実装と矛盾）| サーバ本体限定に修正 | P0-AUTO-1 |
| Font Awesome | cdnjs CDN | ローカルvendoring | P2-FA-1 |

## 未完了の手動タスク（👤のみ実施可）

- P0-PKG-6 / P2-REL-2: npm名確保・publish（npmアカウント権限）
- P0-VIS-2/3: デモGIF・スクショ録画（実画面操作）
- P2-REL-1 / P2-PUB-1 / P2-PUB-2: タグ・GitHub公開設定・告知

## 最短再実行コマンド（検証ゲート）

```bash
node --check server.mjs && node --check public/app.js \
  && node --check scripts/process-queue.mjs && node --check scripts/agent-browser.mjs \
  && node --test server.test.mjs \
  && node server.mjs --workspace /tmp/ia-verify --init sample --doctor
```


---

## 自律実行ログ（2026-06-12・サブエージェント並列オーケストレーション）

`docs/04_impl/implementation_plan.md` の Phase 1〜3 のうち **自動化可能なコード/ドキュメント作業を完了**。人間ゲート（npm公開・GitHub公開・ビジュアル録画）と、リスクで部分停止した1件を除き反映済み。main は全工程で **32テスト全パス**を維持。

### 完了（✅）

| タスク | 内容 | 反映 |
|---|---|---|
| P1-DOC-1 | 手動（エージェント不要）処理パス | DOCSトラック |
| P1-DOC-2 | `docs/request-spec.md`（contract仕様＋ドライバガイド） | DOCS＋精度修正 `cdb6dcc` |
| P1-DOC-3 | glossary | DOCS |
| P1-DOC-4 | Queue/Gallery/clone/landingリンク | DOCS |
| P1-I18N-1 | agent-prompt英語版 | FRONTEND |
| P1-I18N-2 | UI/サンプル既定EN＋`detectDefaultLang` | FRONTEND |
| P1-I18N-3 | gallery i18n＋ツールチップ | FRONTEND |
| P1-CI-1 | issue/PRテンプレ（UI-breakage/new-service含む） | DOCS |
| P2-DOC-1 | 比較/代替セクション | DOCS |
| P2-DOC-2 | 日本語READMEパリティ（README.ja.md） | DOCS |
| P2-DOC-3 | OSサポートマトリクス | DOCS |
| P2-DOC-4 | AGENTS.md再構成＋`docs/manual-fallback.md` | DOCS |
| P2-FA-1 | Font Awesome をインライン SVG に vendoring（オフライン化） | FRONTEND |
| P2-SEL-1 | セレクタ自己診断＋`SELECTORS.md` | SCRIPTS |
| P2-SEL-2 | ロケール中立な画像/エラー/ログイン検出 | SCRIPTS＋硬化 `2bf584a` |
| P3-CQ-2 | 更新ロスト修正（単一書き込みmutex） | BACKEND |
| P3-CQ-3 | doctor/純粋関数テスト | BACKEND |
| P3-DATA-1 | deck backup/export（.bak＋.history＋export/import API） | BACKEND |
| P3-DATA-2 | スキーマ前方版ガード＋テスト | BACKEND |
| P3-PERF-1 | HTTP Range/206（動画スクラブ） | BACKEND |
| P3-SEC-1 | CSPヘッダ＋nosniff | BACKEND |
| P3-API-1 | API形状は文書化（/api/state はbare、他はenvelope） | BACKEND |
| P3-A11Y-1 | モーダルEsc/フォーカストラップ/復帰 | FRONTEND |

### 部分完了（🚧）

| タスク | 状態 |
|---|---|
| P3-CQ-1 | server.mjs分割は **`http-util.mjs`＋`prompts.mjs` 抽出で部分完了**（コミット `e7f0476`,`503d7c4`,`a568374`）。最も結合の強い `deck-model`/`persistence`/`requests`/`doctor` の抽出はエージェントがストールしたため、緑のまま停止し**フォローアップに延期**。 |

### 見送り（意図的）

| タスク | 理由 |
|---|---|
| P3-PERF-2 | render()全再描画のスコープ化はモーダルライフサイクルの大改修で回帰リスク大。フォーカストラップは「再描画されないモーダルでは正しい」と限定（既知の制約）。 |

### 未了（人間ゲート・あなた側の作業）

- P0-PKG-6 / P2-REL-2: npm名確保・publish（npm権限）
- P0-VIS-2..5: デモGIF・スクショ録画とREADME/landing差し込み
- P2-REL-1 / P2-PUB-1 / P2-PUB-2: v0.1.0タグ・GitHub公開設定・告知

### レビュー（敵対的・読み取り専用）で検出し修正済み

- Docs契約精度: `projectRoot` は `/api/requests`（`/api/state`ではない）、`mode` に `"kit"`、`outputDir` は nullable 等 → `cdb6dcc`
- Scripts: 自己診断の非throw保証(M1)・assistant優先の成果物検出(M2)・refusal正規表現の誤検知抑制(L3) → `2bf584a`
- Frontend: EN表示時の日本語ハードコード8キーをi18n化・`navigator`ガード → `e6797b4`（en/ja=183キー一致）

