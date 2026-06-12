---
role: review
depends_on:
  - docs/04_impl/codex_plan_kit_ux_env_marketing.md
---
# Codex 自走分のレビュー結果と修正リスト（2026-06-13）

Claude Code による独立検証の結果。検証体制: 対抗コードレビュー3本（アプリdiff / 環境・docs・CI /
マーケ事実確認）＋新規コンテキストのサブエージェント走行2本（初心者再走 = Phase 3.4、開発者ペルソナ
= Phase 3.2）＋実ブラウザでのデグレ確認（E2E-P1-04）。詳細ログ: `agent-logs/2026-06-13-claude-review/`。

**総評**: 実装は計画の受け入れ条件を概ね満たし、`npm run check` / `npm test` 38件 / doctor /
i18n パリティ（ja=en=261）/ CSP / 契約互換 すべて合格。初心者・開発者ペルソナとも完走。
ただし下記 P0 3件は**実害のある回帰**のため、マーケ投稿（Phase 4.4）前に修正すること。

## ✅ Claude Code 側で修正済み（コミット済み）

- **比較スライダーが真っ黒（幅0px）**: `.modal-media` の `align-items:center` 継承で、絶対配置の
  子しか持たない `.compare-box` の幅が 0 に潰れていた。`width:100%; align-self:stretch` を追加して
  実ブラウザで A/B 分割表示・ハンドル・ラベルまで動作確認済み（styles.css:1633）。
  ※デモ動画のヒーローショットだったため即時修正した。

## P0 — 投稿前に必須（実害のある回帰）

1. **ギャラリーのお気に入りが全消失** (`public/gallery.js:413`)
   アイテムIDが `asset.id` → `entry.id:asset.id` 形式に変更され、localStorage 保存済みの
   お気に入りが全て無効化される。旧形式IDからの移行処理（読み込み時に旧キーを新キーへ昇格）を追加。
2. **ルートB解析結果の発見性の後退** (`public/app.js` renderKit)
   `kit.route` はリロード/キャラ切替で `""` に戻るため、解析結果が届いていてもルートカード2枚しか
   見えない。ルート未選択画面に「解析結果 N件 待ち」バッジ/通知をカードB上に表示する（結果が
   ある場合はBカードに件数チップ）。
3. **パレットCTAの連打で重複リクエスト・重複エントリ** (`public/app.js:3497-3559`)
   投入直後も「採用済みパレットなし」＋同じCTAが再表示され、押すたびに `base-kit-palette-N` が増殖。
   pending 中はCTAを「依頼中…（キューで確認）」表示に切替え、未採用候補が届いている場合は
   「候補が届いています — 確認して採用」導線を出す。

## P1 — 品質（コード）

4. `isPaletteEntry` のフォールバック順序違反: `partKey` が存在し非palette でも id 接頭辞判定が走る
   （`palette-skin` → `base-kit-palette-skin` が誤検出）。partKey 存在時はフォールバック禁止に（app.js:1117）。
5. キャラ切替時の kit フォーム状態リセット漏れ: `sheetName`/`characterName`/`extra`/`json`（app.js:2946）。
6. `data-mode-jump` が本来のタブハンドラの副作用（queue 進入時の `loadQueue`、モード永続化）を
   スキップ。`[data-mode]` クリックへ委譲する形に（app.js:3095）。
7. CI boot smoke がリクエストを1件も処理しない（初期キューは video のみで demo-agent はスキップ）。
   画像リクエストを API で1件投入 → demo-agent --once → completed 確認、までをジョブに追加（ci.yml）。
8. CLAUDE.md がコマンド表を複製しており一方向参照の原則違反（video-skip 注記が3ファイルに重複）。
   CLAUDE.md は「正準コマンドは AGENTS.md Quick bootstrap を参照」+ Claude Code 固有の注意のみに削減。
9. ギャラリーのベース参照追加が「リファレンスシート」より広い（パレットやパーツ寄りも含む）。
   意図的なら CHANGELOG にその旨を書き、`source-reference` 除外の変更も CHANGELOG に追記（gallery.js:420）。
10. 軽微: `defaultSheetName` の連番重複（app.js:1915）/ kit モードで `flyToQueue` セレクタが
    絶対にマッチしない死にコード（app.js:3559）/ EADDRINUSE ヘルプの workspace パス引用符なし（server.mjs:1866）。

## P1 — マーケティング（投稿前に反映）

11. **note-ja.md が約1,593字**で目標 2,000-3,000字 未達（Publishing Note の「約2,300字」も誤り）。増補する。
12. README/note/checklist が参照する `docs/assets/readme/demo.gif` が**未録画**。チェックリストの
    投稿前ゲートに「demo.gif 配置済み」を追加（録画は👤）。
13. note-ja のクイックスタートが1ブロックで `npm start` と `npm run demo-agent` を連続記載
    （そのまま貼ると詰まる）。2ターミナルに分割（x-ja/x-en の post 5 も同様の注記）。
14. Reddit 草稿から LP リンクと UTM を除去（r/StableDiffusion はトラッキングに敏感）。
    Show HN 用 URL の `utm_source=hn` も除去（HN は clean URL 慣習）。
15. checklist の文字数チェックを「フック」でなく投稿全文に変更 / OGP プレビュー手段を実在ツールに
    （metatags.io 等）/ 「Codex は投稿禁止」を「AIエージェントは投稿禁止」に一般化。
16. x-ja Notes のフック字数表記（58字→実測46字）修正。x-en にある Windows/Linux 過大表現ガードを
    x-ja にも追記。逆に Cmd+K・品質ゲート・PNGメタデータ取り込みはどの草稿でも未訴求 — 1投稿分追加を検討。

## P2 — ドキュメント（開発者ペルソナ走行より）

17. `POST /api/assets` のペイロードを request-spec.md に正式記載（現状 demo-agent のソースを読まないと
    分からず、spec の「特定スクリプトに依存しない」方針と矛盾）。
18. ヘッドレス投入手順の文書化: 「spec 準拠の JSON を `requests/` に置けばサーバーが拾う」を
    request-spec.md に明記（初心者・開発者の両走行がこの経路で完走している）。
19. AGENTS.md Quick bootstrap にポート変更方法（`npm start -- --port` は二重渡しになる罠の回避）と
    demo-agent 直接実行例（`--workspace`/`--server` 込み）を追記。
20. `qualityReport` の推奨スキーマ/実例と `maxAttempts` の clamp 範囲を spec に追記。
21. `/api/state` の1行説明を README か request-spec のどこかに（確認用の最重要エンドポイント）。

## 決定事項（Codex からの質問への回答 2026-06-13）

### Gallery の対象範囲（#9 を確定）

> **⚠ 2026-06-13 夜にオーナー裁定で上書き（こちらが最終決定）**:
> **ギャラリーは「画像（Image）エントリで採用されたもの」のみが対象。ベースは対象外。**
> 下記の旧決定（全採用静止画＋originフィルタ）は破棄。実装は修正済み（base収集と
> originフィルタチップを撤去、README EN/JA・CHANGELOGも契約として明文化）。
> 以後この仕様を変更する場合はオーナー承認必須。


**「すべての採用済み静止画（Base + Image、source-reference 除外）」で確定。** 根拠:
README の製品定義が「a separate Gallery view shows **every adopted image across the deck**」であり、
初心者テストの期待（Baseで採用したシートがギャラリーに出る）とも一致する。絞り込みはしない。
ただしセットで以下を実施:
- Gallery に **origin フィルタチップ（すべて / ベース / 画像）** を追加してノイズを解消
  （既定は「すべて」。Create kit のソースフィルタと同じUI言語で）
- CHANGELOG に「ギャラリーは採用済み全静止画を表示（source-reference は除外）」とスコープ変更を明記
- #9 は「意図的な仕様」と確定したのでコード修正は不要、上記フィルタ＋CHANGELOG のみ
- P0 #1（お気に入り移行）は引き続き必須

### マーケ草稿への追加訴求（#16 を確定）

**今回のローンチ投稿セットは既存草稿の修正のみ**（過大にしない）。Cmd+K・品質ゲート・
PNGメタデータ取り込みは **ローンチ後フォローアップ投稿** として扱う:
- `docs/marketing/x-followup.md` を新規作成（JA/EN 各1投稿分: 「ローンチで紹介しきれなかった3機能」枠）
- checklist.md に「ローンチ +2〜3日: フォローアップ投稿」の行を追加（投稿は👤）
- 初回投稿群（x-ja/x-en/note/devto/reddit）には追記しない — 焦点は「管理レイヤーの不在」一点突破を維持

### テスト環境について（ユーザー指摘への回答）

- 127.0.0.1:**4880** は本件のテストとは無関係の死んだ残骸（タブのみ残存）→ タブ閉鎖済み、
  自動再起動の仕掛けなしを確認済み。
- Claude Code 側の検証はすべて使い捨てサーバー（4242/4244/4246/4310、新規 `--init sample`）で実施
  しており、テストデータの取り違えはない。
- ⚠ 既定ポート **4217** に `--workspace ./workspace/fishing-fitness` の常駐インスタンス（PID 4818、
  起動 6/11）が残っている。ドキュメントどおり 4217 を開くと別プロジェクトのデータが表示されて
  紛らわしいため、不要なら停止を推奨（**ユーザー判断待ち — Codex/Claude Code は勝手に kill しない**）。

## 担当分担

| 誰が | 何を |
|------|------|
| **Codex** | 上記 1-21 の修正（P0 → P1 → P2 の順）。各修正で毎タスク必須コマンド＋該当領域の🤖S再検証 |
| **Claude Code** | 修正後の最終リグレッション確認（実ブラウザ）と再レビュー。完了済み: 独立検証・E2E-P1-04・Phase 3.2/3.4 の走行・比較スライダー修正 |
| **👤** | Phase 3.5 実機確認 / demo.gif 録画（絵コンテ: docs/marketing/video-shotlist.md）/ Phase 4.4 投稿 |


## 追記（2026-06-13 夜）: テストデータ事故の再発防止 — Codex への必須指示

ユーザーから「テストの残骸が自分のデータと紛らわしい」との指摘が2度あった（4880タブ、
4252の閉じ忘れタブ＝死んだサーバーの黒いギャラリー）。以後、**全エージェント共通の必須規約**:

1. ユーザーの正データは `workspace/demo-aichan/` のみ。`workspace/archive/` と合わせて**不可侵**。
2. 検証サーバーは `/tmp/ia-test-*` ＋ ポート **4901-4999** 限定（4217と任意ポートの使用禁止）。
3. 終了時の後始末3点セット: サーバー kill / `/tmp/ia-test-*` 削除 / **開いたタブを全て閉じる**。
4. Aoi サンプルはOSS同梱の架空デモ。ユーザー向け報告で「ユーザーのデータ」として見せない。
5. 詳細・最新版は `workspace/_LOCAL_RULES.md`（gitignored・このマシン固有）を毎セッション冒頭に読む。

処分済み: 残存テストサーバー（4391/4799）停止、4217の fishing-fitness インスタンス停止、
workspace/ 配下のテスト残骸7ディレクトリ削除、古いブラウザタブ閉鎖。
