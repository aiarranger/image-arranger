# image-arranger

[![CI](https://github.com/aiarranger/image-arranger/actions/workflows/ci.yml/badge.svg)](https://github.com/aiarranger/image-arranger/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-6c5ce7.svg)](LICENSE)

**AI 画像／動画生成のための、ローカルファーストなプロンプト・素材依頼マネージャー。生成はしません——生成ワークフローを整理し続けるツールです。**

image-arranger は、画像生成サービスが持っていない層を管理します。どのリファレンスを正（canonical）とするか、どの候補を採用したか、何を依頼中か、どのプロンプトが何を生んだか——。生成サービス（ChatGPT・Midjourney・Vidu …）を一切呼び出さないため、どのサービスとも併用できます。代わりに、あなた自身またはコーディングエージェントがサービスの通常 UI で処理する「依頼ファイル（request file）」を書き出します。

[ランディングページ](https://aiarranger.github.io/image-arranger/) · [English README](README.md)

## なぜ（Why）

2026 年のキャラクター一貫生成はリファレンス画像の勝負です。顔・表情・衣装・付属パーツといったパーツ別リファレンスを厳選して与えるほど良い結果が得られます。しかし、そのリファレンス集合（バージョン・候補・採用判断・依頼中の状態）を*管理*する道具は、たいていスプレッドシートか PNG が詰まったフォルダのままです。

image-arranger はそのワークフローに構造を与えます。

- **素材作成（Create kit）** — 採用済みリファレンスを選び、再利用可能なテンプレプロンプトから同一性の正となるシートを一発生成（お気に入りのコミュニティ製シートプロンプトを持ち込み可）。シートの一部だけ直したいときは、パーツ別リファレンスに分解 → そのパーツだけ改善 → 直したパーツを添えてシートを再生成。
- **ベース（Base）** — パーツ別リファレンスを候補つきで管理し、承認した候補だけを「採用（adopted）」に。
- **画像（Image）** — 1 プロンプト＝1 アウトプット。採用画像を生成入力として添付でき、リンクとして保存され、キュー登録時にリンク先エントリの*最新の*正（canonical）画像へ解決されます。
- **動画（Video）** — 採用画像を start/end フレームに指定し、image-to-video サービスへ。
- **キュー（Queue）** — アウトボックス。送信した依頼はすべて、人間でもエージェントでも処理できる JSON ファイルになります。依頼中のものはここで確認・編集・キャンセル・完了できます。

タブの並びがそのまま制作フローです：**素材作成 → ベース → 画像 → 動画**。**キュー**は依頼が処理を待つアウトボックスです。ヘッダーの *Gallery* ボタンで開く**ギャラリー**ビューは、デッキ全体の採用画像を一覧します。

## 代替手段／あなたに向いているか

- **スプレッドシート＋PNG フォルダと比べて** — スプレッドシートには採用状態・依頼キュー・来歴（provenance）がありません。image-arranger はどの候補を採用したか、何が依頼中か、どのプロンプトが何を生んだかを追跡します。
- **ComfyUI／ノード系ツールと比べて** — それらは画像を*生成*します。image-arranger は生成の*周辺*ワークフローを*管理*し、生成は一切しません。補完関係です。生成は好きな場所で行い、リファレンス・候補・依頼はここで整理します。
- **Eagle のような DAM と比べて** — 素材管理ツールはファイルを整理しますが、プロンプトや依頼のライフサイクル、人間／エージェントが処理できるキューはありません。image-arranger はそのライフサイクルを軸に作られています。

**向いていないのは**、ツール内でワンクリックの API 生成をしたい場合です。image-arranger はあえて生成サービスを呼び出しません。

## クイックスタート

Node.js 20+ が必要です。依存パッケージなし・ビルドステップなし。

```bash
git clone https://github.com/aiarranger/image-arranger.git
cd image-arranger
node server.mjs --workspace ./workspace/demo --init sample --port 4217
```

<http://127.0.0.1:4217/> を開いてください。

チェック：

```bash
node --check server.mjs
node --check public/app.js
node --test server.test.mjs
node server.mjs --workspace ./workspace/demo --init sample --doctor
```

## 依頼の流れ（How Requests Flow）

1. 行（または改善したい素材）を選んで **Queue** をクリック。
2. image-arranger が `workspace/<name>/requests/<id>.json` を書き出します。成果物ごとに 1 ターゲット（プロンプト・参照画像・出力先ディレクトリ・サービス）を含みます。
3. 人間またはコーディングエージェントが生成サービスでターゲットを処理し（[AGENTS.md](AGENTS.md) 参照）、`POST /api/requests/complete` で完了を報告します（または JSON を直接編集）。
4. 結果は候補素材として登録され、良いものを採用すると次のラウンドのリファレンスになります。

解析依頼（`action: "analyze"`）も同じ流れですが、成果物は画像ではなく JSON（パーツ別の生成プロンプト）で、image-arranger が自動でベースエントリ化します。

## 手動で依頼を処理する（エージェント不要）

コーディングエージェントもスクリプト処理も必須ではありません。手動パスは標準で組み込まれています。結果をエントリに登録すると、対応する依頼中ターゲットが自動的に完了します。

1. **依頼を開く。** `workspace/<name>/requests/<id>.json` で処理したいターゲットを確認します。`prompt`、`inputs.refImages` の入力ファイル、`outputDir` が入っています。（パスはインストールディレクトリからの相対です——[docs/request-spec.md](docs/request-spec.md) 参照。）
2. **自分で生成する。** 生成サービスの通常 UI で `prompt` を貼り付け、`inputs.refImages` に挙がっているファイル*だけ*を添付します。成果物はちょうど 1 つ作ります。
3. **出力を保存する。** あとで見つけられる場所に保存します。
4. **UI に登録する。** 「依頼中（queued）」バッジの付いたエントリを開き、保存したファイルを候補素材として追加します（*Add asset* フォーム、またはエントリへのドラッグ）。image-arranger は依頼中の `generate` ターゲットを自動で完了扱いにし、*「Asset registered; the pending queue target was marked completed.」* と表示します。

良ければ候補を採用すると、次のラウンドのリファレンスになります。`analyze`・`draft-prompt`・`improve` ターゲットは、代わりに `POST /api/requests/complete` への 1 回の `curl` で報告します——[AGENTS.md](AGENTS.md) と [docs/request-spec.md](docs/request-spec.md) を参照。

## 用語集（Glossary）

- **deck（デッキ）** — ワークスペースの `deck.json`。全キャラクター・プロンプト・エントリ・採用状態。
- **kit（キット）** — *素材作成*タブで構築する、キャラクターのパーツ別リファレンス（顔・衣装・付属パーツ）の基本セット。
- **entry（エントリ）** — 生成できる 1 行。ベースパーツ、画像プロンプト、または動画クリップ。エントリは候補素材を持ちます。
- **candidate / adopted（候補／採用）** — *候補*はエントリに登録された素材、*採用*はリファレンスとして使う承認済みのものです。
- **canonical（正）** — エントリが解決する現在の採用画像。リンクはキュー登録時に正へ解決されるため、リファレンスを更新するとそれを指す全てが更新されます。
- **request / target（依頼／ターゲット）** — *依頼*は `requests/` 内のキューされた JSON ファイル。中の各*ターゲット*が 1 つの成果物（画像・動画・解析・ドラフトプロンプトのいずれか 1 つ）です。
- **coding agent（コーディングエージェント）** — Claude Code や Codex のような LLM 駆動ツール。手作業の代わりに、生成サービスの Web UI を操作してキューの依頼を処理してくれます。

## スクリプト処理（任意）

リポジトリには、キューされた ChatGPT 画像ターゲットを端から端まで処理し、レビュー可能な実行ログ（手順＋スクリーンショット）を `agent-logs/` に書き出す任意の自動化ドライバが同梱されています。

```bash
node scripts/process-queue.mjs --check    # 初回セットアップ：専用の自動化用 Chrome を開き、ChatGPT に一度サインイン
node scripts/process-queue.mjs            # キューされた chatgpt の generate ターゲットを全処理
```

- **Node 22+**（サーバ本体は Node 20+ で動作）と Chrome/Chromium が必要です。macOS でテスト済みで、Windows/Linux でも動作見込み（CDP ベース・OS レベルの権限不要）。
- **免責**：これは *あなたのブラウザ*を *あなたのアカウント*で *あなたの責任*において操作し、生成サービスの利用規約と衝突しうるため、使用前に必ず確認してください。安定したインターフェースは [依頼ファイル契約](docs/request-spec.md) であり、このドライバは差し替え可能な便宜ツールです。手動でも、独自ツールでも依頼を処理できます。

## OS サポート

| 層 | 要件 | 状態 |
|----|------|------|
| **サーバ**（`server.mjs`・UI・依頼ファイル） | Node 20+ が動く任意の OS | Node が動く環境すべてでサポート |
| **スクリプト処理**（`scripts/`） | **Node 22+**（グローバル `WebSocket` を使用）＋ Chrome/Chromium | 設計上クロスプラットフォーム（CDP・OS 権限不要）。macOS でテスト済み。Windows/Linux 用の Chrome パスは `agent-browser.mjs` にあるが未検証——フィードバック歓迎 |
| **手動キーストロークのフォールバック**（[AGENTS.md](AGENTS.md) ／ [docs/manual-fallback.md](docs/manual-fallback.md)） | macOS（`osascript` / `pbcopy` / `pbpaste`） | **macOS のみ**。Windows/Linux 相当は未確立 |

バージョンの差分に注意：**サーバは Node 20+** で動きますが、**スクリプト処理はグローバル `WebSocket` のため Node 22+** が必要です。Node 20 ではスクリプトが明確なメッセージを表示してクリーンに終了します。

## ワークスペース（Workspaces）

すべてのユーザーデータは、選んだワークスペースディレクトリに置かれます（Git 管理外）。

```text
workspace/<name>/
  deck.json     # 全プロンプト・エントリ・採用状態
  assets/       # 登録された候補ファイル（コピーされる）
  requests/     # キューされた依頼 JSON
  outputs/      # 処理側が生成結果を置く場所
```

- `--init sample` — 公開安全なサンプルデッキ（既定）
- `--init empty` — 空のスターターデッキ
- `--config config.example.json` — 設定ファイルから起動

## 来歴と権利（Provenance & Rights）

各素材は `sourceLicense`・`aiGenerated`・`humanReviewed`・`usageNotes` を記録します。ワークスペースを公開する前に `--doctor` を実行してください。秘密文字列らしきもの、絶対ローカルパス、欠落した provenance フィールドを検査します。

## セキュリティ上の注意（Security Notes）

- `127.0.0.1` でのみ動作します。ネットワークに公開しないでください。
- ループバック以外の `Host` ヘッダ、および外部 `Origin` を持つ状態変更リクエストを拒否します（DNS リバインディング／CSRF の緩和）。API ボディは `application/json` を必須とします。
- リクエストボディは 1 MB、素材ファイルは 80 MB に制限。`/asset` はワークスペースの `assets/` と `outputs/` ディレクトリ内のファイルのみ配信します。
- 脅威モデルと脆弱性報告については [SECURITY.md](SECURITY.md) を参照してください。

## 貢献（Contributing）

[CONTRIBUTING.md](CONTRIBUTING.md) を参照。要点：依存ゼロを保つ／サンプルデータは公開安全に保つ／生成サービスは外部に保つ。

## ライセンス

[MIT](LICENSE) © 2026 AI Arranger
