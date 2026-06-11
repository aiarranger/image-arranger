# image-arranger — OSS公開レビュー（世の人に使ってもらうために）

> 作成日: 2026-06-11 / 6名のレビュー役（初見ユーザー・OSSメンテナー・ドキュメント/ポジショニング・コード品質・セキュリティ・アダプション戦略）＋横断批評役によるレビューを1ファイルに統合。
> レビュー前提: **製品哲学（依存ゼロ・ローカルファースト・生成は外部サービスのまま）は変えない**範囲で、「発見 → 信頼 → 初回起動の成功 → 継続/貢献」の各段で何が障害になるかを洗い出す。

---

## エグゼクティブサマリー

土台は本物です。依存ゼロでワンコマンド起動、READMEどおりに動き（16/16テスト約0.2秒、`--doctor` クリーン）、データモデル・パス検査・楽観ロック・原子的書き込みなど作り込みは堅実。`AGENTS.md` と監査用の `agent-logs/` はこのジャンルでは稀な差別化要素です。

一方で「公開して伸ばす」観点では、**製品の良さがほぼ伝わらない/初回でつまずく/公開当日に叩かれる**という3系統の穴があります。最優先は次の3点（横断批評役の結論とも一致）:

1. **ビジュアルがゼロ** — 視覚的ツールなのにREADMEにスクショ0枚、ランディングは `TODO(T13)` のCSSモックのまま。発見・信頼の最大レバー。
2. **目玉機能（ChatGPT自動処理 `process-queue.mjs`）が「不可視・自己矛盾・最低Nodeでクラッシュ」** — READMEに一切記載なし、`CONTRIBUTING.md` は「サービスUIを自動化しない」と明記して実装と矛盾、ToS免責もなし、推奨Node 20でグローバル`WebSocket`が無くクラッシュ、既定ポートも4217 vs 4310で不一致。
3. **localhostの無防備な露出** — Host/Origin検証が無く、DNSリバインディング/CSRFで、ユーザーがWeb閲覧中に黙ってデッキ・プロンプト・生成物が読まれ得る。公開当日にセキュリティ層が数分で見つけるクラス。

以下、深刻度（Critical/High/Medium/Low）付きで領域別に整理します。各項目に対応ファイル/行を明記。

### 深刻度別カウント
- **Critical: 3**（リポジトリメタ未整備で公開不可状態 / Host・Origin無検証 / ChatGPT自動化のToS矛盾）
- **High: 14** / **Medium: 17** / **Low: 11**（横断批評役の追加8件・訂正4件を含む）

---

## 強み（壊さずに守るべき価値）

- **依存ゼロ・ワンコマンド起動が本当に動く**。READMEのQuick Startを別ワークスペースで逐語実行 → 1秒未満で起動、UI配信、`/api/state`・`/api/requests` 応答。4つの検査すべてパス（テスト16/16 ≈0.2秒、`--doctor` exit 0）。
- **データ整合性の基礎が堅い**: `writeJson()` は `.tmp`→`renameSync()` で原子的（server.mjs:264）。`PUT /api/state` は `updatedAt` ベースの楽観ロックで409を返し、クライアントも409を検知してリロード（app.js:525-536）。
- **ローカルツールとして妥当なセキュリティ姿勢**: 127.0.0.1のみbind（server.mjs:1517）、`safeResolve()` が `..`・絶対パス・NULを拒否（879-890）、bodyは1MB・assetは80MBで上限。
- **フロントのXSS衛生が一貫**: `escapeHtml()`（app.js:393）をユーザー値の `innerHTML` 補間に適用。生データ流入は見当たらず。
- **`--doctor` の公開前スキャン**（validateStateForPublish, 1386-1421）は秘密文字列・絶対パス・provenance欠落を検査する良いOSS衛生機能。
- **`AGENTS.md` + `agent-logs/run-*/` は本物の差別化要素**: 役割分担、リトライ方針、フィールド検証済みのブラウザ手順、スクショ付き監査ログ。
- **request file はスキーマ付き**（`image-arranger-request.v1`, server.mjs:546）。安定契約の土台が既にデータ形式に存在。
- **EN/JPバイリンガル**で、初期コミュニティ（日本のAIキャラ制作層）の居場所に合っている。
- **CDPドライバが規律的**: セレクタ集中管理、各ステップが自身のDOM結果を検証、専用Chromeプロファイル（`~/.image-arranger/agent-chrome`）でユーザーの本ブラウザに触れない。
- **ガバナンス文書が実体を伴う**: MIT・CONTRIBUTING・SECURITY・CoC・CIが揃い、CIはREADMEが謳う検査と一致。

---

## 🔴 Critical（公開前に必須）

### C1. リポジトリのメタ情報が公開仕様になっていない
*領域: GitHubリポジトリ設定 / distribution*
`gh repo view` が `isPrivate: true`, `description: ""`, `homepageUrl: ""`, `repositoryTopics: null`。package.jsonが無くnpm presenceも無いため、**GitHub検索・トピックとPagesランディングが唯一の発見経路なのに全部空/到達不能**（docs/index.html:12のハードコードされたPages URLはprivate中404）。
**対応:** 公開前に description（READMEのタグライン）・homepage（`https://aiarranger.github.io/image-arranger/`）・topics（`ai-art, image-generation, video-generation, prompt-management, local-first, zero-dependencies, nodejs, chatgpt, agent-workflow, ai-agents`）を設定し、Pagesを `/docs` から有効化。

### C2. Host/Origin無検証 — DNSリバインディング＋CSRFに無防備
*領域: server.mjs リクエストハンドラ 1473-1503 / bind 1517*
リクエストURLは `request.headers.host` から許可リストなしで構築（1475）、Originヘッダも未検査。127.0.0.1へのbindは他マシンを止めるが、**ユーザー自身のブラウザで開いた悪意あるページが 127.0.0.1:4217 へ要求するのは止められない**。認証もOrigin検査も無いため、(a) DNSリバインディングで同一オリジン化し全`/api`応答（デッキ全体・全プロンプト・全リクエスト）を読み取り、(b) リバインディング無しでも状態変更POSTを駆動できる。**サーバを起動したままWeb閲覧する全ユーザーが黙って晒される**、ローカルツールの教科書的脆弱性。
**対応:** ハンドラ先頭でHostが `127.0.0.1:<port>`/`localhost:<port>` 以外なら403。非GETはOriginがサーバ自身のオリジンと一致（または不在）でなければ拒否。数行・依存ゼロで可能。
> 批評役の補強: 「blind CSRF書き込みが効く」のは、多くの変更系ハンドラが `await readBody()` の**前**に `readState()` する順序（server.mjs:1030-1031, 1045-1046, 1062-1063, 1297+1313）のため。await中に別要求がコミットすると、先の要求が古いstateで上書きして更新を失う（後述M-CQ2参照）。

### C3. ChatGPT自動化のToS露出が未開示、かつ CONTRIBUTING が実装と真っ向矛盾
*領域: CONTRIBUTING.md / AGENTS.md / README.md*
`scripts/process-queue.mjs` はChatGPTのWeb UIをCDPで駆動（新規チャット・DOM注入・画像スクレイプ）＝OpenAIの自動アクセス規約に抵触する可能性。**ToS/免責/アカウントリスクの記載はリポジトリ内に皆無**（terms/disclaim/openai を全文書でgrep → 0件）。さらに `CONTRIBUTING.md:25` は「image-arranger writes request files; it does not automate accounts or bypass service UIs」と明記 — `AGENTS.md:7-32` が"preferred"として指示する内容と矛盾。公開（HN/Reddit/X）で最初のコメントになり、無警告のユーザーはOpenAIアカウントを失いかねない。
**対応:** README・AGENTS.md冒頭に「このスクリプトは**あなたのブラウザ・あなたのアカウント・あなたの責任**で動く／サービス規約と衝突しうる／**安定した正式インターフェースはrequest file契約**で、スクリプトは差し替え可能な任意ドライバ」と明記。`CONTRIBUTING.md:25` は「**サーバ本体は**サービスを自動化しない。自動化ドライバは `scripts/` にユーザー操作・免責付きツールとして存在」に改める。

---

## 🟠 High

### H1. 視覚的ツールなのにビジュアルがゼロ（READMEスクショ0枚／ランディングはCSSモック）
*領域: README.md / docs/index.html:184 / launch assets*
READMEに画像0。`docs/index.html:184` には `<!-- TODO(T13): replace this CSS mockup with the hero GIF cut from Friday's demo recording -->` が残り、本物UIでなく偽のCSSウィンドウを表示。OGPもテキストのみ。主要ペルソナ（VTuber/ゲーム素材/漫画のキャラ制作層）は「見た目」で数秒で判断する。**スター/シェアされない最大要因**。皮肉にも `agent-logs/` のスクショが理想的な素材を既に生成している。
**対応:** (a) 公開前に60-90秒のループ動画（URL投入→draft-prompt→生成→採用→次の参照になる）を録り、READMEにGIF・ランディングに動画（TODO T13解消）。(b) 静止スクショ3枚（Base採用・Imageタブ・スクショ付きrun-log）をREADMEへ。(c) `public/gallery.html` をリンク。**追加機能より効く**。

### H2. エージェント不在の人が中核ループを完了する手順がドキュメントに無い
*領域: README.md:49 / AGENTS.md*
README:49は「a human or a coding agent」と言うが、AGENTS.mdは完全にエージェント向け（"Manual Browser Fallback" もAppleScript/CDP復旧であって人間の手順ではない）。**実は手動パスは実装済みで簡単**: ChatGPTで生成→保存→UIで候補登録すると、保留中のgenerateターゲットが自動完了する（app.js:1662-1678, トースト「Asset registered; the pending queue target was marked completed」）。エージェント未設定の多数派は「使えない」と誤解する。
**対応:** README に「Process a request by hand (no agent needed)」節を追加: ①`requests/<id>.json` を開く ②プロンプト＋`inputs.refImages` を生成サービスに貼付/添付 ③出力を保存 ④UIでentryにドロップ → ターゲットが自動完了。AGENTS.mdからもリンク。

### H3. 「Copy agent prompt」の出力が英語UIでも日本語ハードコード
*領域: public/app.js agentPromptFor 2355-2460*
英語UIは繰り返しこのハンドオフへ誘導するのに、`agentPromptFor()` に英語版が無く、3テンプレ（analyze/draft-prompt/generate・improve）すべて日本語テンプレリテラルで `state.lang` 分岐なし。英語話者は日本語の指示の壁をエージェントに貼ることになる。macOS専用osascript手順も無条件で埋め込み。
**対応:** 既存のi18n基盤で3テンプレの英語版を `state.lang` 分岐。osascript依存はプラットフォームで条件分岐/注記。

### H4. 英語Quick Startから日本語UI＋日本語サンプルデッキに着地
*領域: public/app.js:360 / public/index.html / examples/sample-deck.json / gallery.html*
既定が日本語: `state.lang: "ja"`（app.js:360）、`<html lang="ja">`、サンプルデッキ `lang:"ja"`＋日本語entry（「全身ベース」等）。英語トグル（app.js:1280）はあるがREADMEは未言及。さらにEN時も日本語のまま残る箇所: Galleryツールチップが `title="採用画像ギャラリー"` ハードコード（app.js:1287）、`public/gallery.html` は全編日本語（i18nなし）。国際来訪者は「JP専用」と判断して離脱。
**対応:** UIとサンプルを既定英語（または `navigator.language` 検出）に、jaはトグルへ。gallery.htmlとツールチップもi18n化。README に「UI is bilingual EN/JA — toggle in the header」。スクショはEN UIで。

### H5. READMEが目玉スクリプト（process-queue.mjs）に一切触れていない
*領域: README.md / scripts/process-queue.mjs*
最も差別化される機能（ログ付き・リトライ付きのE2E自動化、`--parallel`、専用Chrome）がREADMEに無名。AGENTS.mdへ一般リンクのみ。エージェントツール層（最も拡散/スターしそうな人）は10秒スキャンでは辿り着けない。
**対応:** README に「Scripted processing (optional)」節（`--check` と本実行の2コマンド＋run-logスクショ1枚）を、**安定したrequest file契約の上に乗る任意ドライバ**と明記し、ToS免責を隣接。プラットフォーム明記（macOSテスト済み、Win/LinuxのChromeパスはあるが未検証）。

### H6. 目玉スクリプトが「推奨最低Node」でクラッシュ（README 20+ / 実体は22+）
*領域: README.md:28 / scripts/agent-browser.mjs:92*
agent-browser.mjs:92 のコメントは「Node 22+」、`class Cdp` はグローバル`WebSocket`を使う（Node 20に存在しない）。よって `node scripts/process-queue.mjs --check` はNode 20で `WebSocket is not defined` で落ちる。CIはNode 22のみテストなので検出されない。目玉機能の初回失敗は最大の離脱イベント。
**対応:** (a) 全箇所をNode 22+に引き上げる、または (b) サーバは20+のまま、process-queue.mjs冒頭に「このスクリプトはNode 22+（グローバルWebSocket）が必要／サーバは20+可」と表示してclean exitするガード。20+を維持するならCIにNode 20ジョブを追加。

### H7. request file契約（プロジェクトの生存機構）が仕様/拡張点として未文書化
*領域: AGENTS.md / docs（REQUEST-SPEC欠落）*
スクリプト化はChatGPT画像生成のみ（process-queue.mjs:66 が `service==="chatgpt"||!service`）、Viduは手動、他は未対応。この狭さは「あなたのサービスでも動く」拡張点が文書化されていてこそ許容される。だが `image-arranger-request.v1`（server.mjs:546）の仕様は未記載、フィールドはエージェント向け散文に散在。互換保証もドライバ作成ガイドも無い。
**対応:** `docs/request-spec.md` を作成: 全フィールドの型・意味、completeAPIの各payload形状（results/error/parts/prompt）、互換約束（v1の意味は不変・追加のみ）。`agent-browser.mjs` のexport群（ensureChrome/openChat/attachImages/setPrompt/waitForImageReply…）を参照実装とする「サービスドライバの書き方」節。→ 正直なカバレッジ訴求が成立: ChatGPTはスクリプト/Viduは手動/他は安定仕様に対する200行ドライバ。

### H8. DOMセレクタ脆弱性が現役のアダプションリスク（早期警告なし）
*領域: scripts/agent-browser.mjs*
スクリプトは2026-06-11着地で同日3回の破損修正（2056fee, 68d4de9, b1eab2c）。セレクタは集中管理だがロケール依存: 完成画像検出はalt先頭「生成された画像」優先（agent-browser.mjs:343）で `naturalWidth>600` ヒューリスティックfallbackのみ、ERROR_TEXT(324)/checkLogin(262)もJP/EN混在 → 他言語UIで黙って劣化。ChatGPTの再設計で全員壊れるのに「あなたの設定でなく上流が壊れた」と伝える機構が無い。
**対応:** (1) `--check` にライブページのセレクタ自己診断を追加し、不一致時に「ChatGPTがUIを変更 — image-arrangerの更新を確認」と明示。(2) 画像/エラー検出をロケール中立に（data-testid構造シグナル）。(3) `SELECTORS.md` ＋「ChatGPT UI breakage」issueテンプレ。(4) READMEで期待値設定（ドライバはベストエフォート／キューと手動は常に動く）。

### H9. package.json不在で、何も得ずに慣習と発見性を損ねている
*領域: distribution（複数レビュアーが独立に指摘）*
package.jsonが皆無 → (1) バージョン識別子がどこにも無い（タグも無し、バグ報告でバージョン不明）、(2) `engines` 無くNode 20+はprose only、(3) `npm test`/`npm start` 慣習が無効、(4) `npx image-arranger` 不可、(5) GitHub/IDE/Dependabot等のエコシステムシグナル劣化。**依存ゼロのpackage.jsonは哲学に反しない**。
**対応:** 依存なしの最小package.json: `name`, `version:0.1.0`, `"type":"module"`, `"engines":{"node":">=20"}`, `repository/homepage/bugs`, `license`, `bin`（server.mjsにshebang）, `files` ホワイトリスト, `scripts`（start/test/doctor/check はREADMEの検査をそのままラップ）。npm公開で `npx image-arranger` を**唯一の推奨インストール経路**に、git-cloneは貢献者/エージェント向けに残す。v0.1.0タグ＋GitHub Releaseを公開時に。
> 批評役: `image-arranger` はnpm未使用・GitHub同名なし（近いのは無関係な ImageRearranger）。**名前を今押さえられる資産**。package.json追加時にnpm名も確保。

### H10. `/asset` が全プロジェクトルートをワイルドカードCORS＋PNAで任意サイトに公開
*領域: server.mjs serveFile 1365-1380, /asset 1477-1492*
serveFileは `/asset` に `Access-Control-Allow-Origin: *` と `Access-Control-Allow-Private-Network: true` を付与、配信ルートは `context.projectRoot`（config.example.jsonで `.`＝リポジトリ全体）。`GET /asset?path=workspace/demo/deck.json` はCORS-simpleなので**任意の訪問サイトが応答を読める**: デッキ全体・全生成物・server.mjs・config.json・`.git` まで。READMEの「/asset only serves files under the configured project root」は技術的には真だがルート＝全体である点を過小表現。
**対応:** `/asset` を assets/outputs ディレクトリに限定、ワイルドカードACAOを除去。クロスオリジン読みが本当に必要なら明示的許可リストに限定し、ソース/設定ファイルは決して配信しない。README/SECURITY.mdに実スコープを反映。

### H11. POSTエンドポイントのCSRF（text/plainバイパス、リバインディング不要）
*領域: server.mjs readBody 852-877, POST routes, copyAssetIntoWorkspace 937-977*
readBodyはContent-Type問わず生bodyを `JSON.parse`。悪意ページが `Content-Type:text/plain` のCORS-simple POSTを送ればプリフライト無しで処理される。応答は読めないが副作用は着弾: `/api/requests`（キュー投入）、`/complete`・`/cancel`（リクエストファイル変更）、`/api/characters`、`/api/assets`（ファイルをワークスペースにコピー）。`copyAssetIntoWorkspace` は絶対パスの `sourceFile` を受理（940-942）するため、**ディスク上の任意画像/動画を予測可能なパスにコピー → world-readableな `/asset` で読み出し**＝blind CSRFがファイル流出に化ける。
**対応:** C2のOrigin検査を全状態変更メソッドに強制し、Content-Typeが `application/json` でないbodyを拒否。`/api/assets` の絶対パス`sourceFile`を不許可（または封じ込め検査）。

### H12. CIがNode 22・Ubuntuのみで、scripts/未検査
*領域: .github/workflows/ci.yml*
ci.ymlはubuntu-latest・node 22の単一ジョブ。READMEは「Node.js 20+」と謳うがNode 20（サポート内）・Node 24（メンテナ実環境v24.13.1）は未検証。Windows/macOSも未テスト（ファイル多用アプリでWindowsはパスで壊れがち）。`node --check scripts/process-queue.mjs` / `agent-browser.mjs` がCIにもCONTRIBUTINGにも無く、目玉スクリプトの構文エラーがgreenでmergeされ得る。
**対応:** マトリクス `node-version:[20,22,24]` × `os:[ubuntu, macos, windows]`（またはWindows主張を明示的に外す）。Syntax checkとCONTRIBUTINGに `scripts/*.mjs` の `--check` を追加。

### H13. リリース体制が無い（タグ/リリース/CHANGELOG/バージョン方針なし）
*領域: release process*
`git tag` 空、`latestRelease: null`、CHANGELOG.md無し。cloneして使うツールで、更新時期・変更内容（retry semantics 2056fee、completion detection 68d4de9等の挙動変化）・「既知の良い」スナップショットが分からない。CONTRIBUTINGもリリース手順に無言＝いつ放棄されたか分からないシグナル。
**対応:** 公開前に v0.1.0 タグ＋GitHub Release（短いchangelog）、CHANGELOG.md（Keep a Changelog形式）、CONTRIBUTINGに「Releases」段落。タグpushでCI実行＋release下書きする10行workflowで十分。

### H14. CONTRIBUTINGの依存ポリシーがREADMEの約束より緩い
*領域: CONTRIBUTING.md*
README:82は「keep it dependency-free」だがCONTRIBUTINGは「Prefer small dependency-free changes unless a dependency is clearly necessary」＝却下される依存PRを誘発。
**対応:** ハードルールに整合: ランタイムは依存ゼロを維持、npm依存を追加するPRはmergeしないと明記。

---

## 🟡 Medium

### M-DOC. ドキュメント/ポジショニング
- **M-DOC1. 比較/代替セクションが無い** — スプレッドシート+フォルダ / ComfyUI / Eagle等DAMとの違い、「使うべきでない人」が無く30秒で自己判断できない。READMEに短い「Alternatives」節（採用状態・キュー・provenanceの無いスプレッドシート対比、生成するComfyUI対比＝補完関係、プロンプト/リクエストライフサイクルの無いEagle対比）＋正直な「not for you if（ワンクリックAPI生成が欲しいなら不向き）」1行。
- **M-DOC2. 日本語READMEが英語版に対しスタブ** — README:90-106はピッチ＋5機能＋起動コマンドのみ。How Requests Flow/Workspaces/Provenance/Security/Contributing/scriptを欠く。UI既定が日本語＝JP層が主要ユーザーになり得るのにteaserしか無い。`README.ja.md` に分離して章のパリティを取るか、現セクションを「要約」と明示してアンカーリンク。
- **M-DOC3. AGENTS.mdの構造** — 「Manual Browser Fallback」H2(95)に本文が無く、続くH2群が実体で境界不明。技術リストに「4.」が2つ(133-135)。macOS専用スコープがREADMEに浮上しない。macOS設定とブラウザ手順をfallback配下のH3に入れ、番号修正、深い手順は `docs/manual-fallback.md` へ移してAGENTS.mdをスキャナブルに。READMEに1行プラットフォーム注記。
- **M-DOC4. READMEがQueueタブ・Galleryビュー・ランディング自体を省略** — README:24は「Create kit→Base→Image→Video」だがUIは5タブ＋Galleryボタン（landingは5タブ表示済みで自己矛盾）。Quick Startに `git clone` が無い。Queue（outbox）とGalleryを1行ずつ追記、ランディングをREADME冒頭にリンク、clone手順追加。
- **M-DOC5. Font Awesomeをcdnjsからロード（local-first/依存ゼロのピッチと矛盾）** — public/index.html:7-13。約15個のfa-*アイコン。devtoolsで第三者リクエストが即見え、オフラインでアイコン消失。**インラインSVGにvendoring**（または明示的に文書化された例外）。

### M-DIST. distribution / コミュニティ基盤
- **M-DIST1. issue/PRテンプレ無し・リポジトリメタ空** — `.github/` はworkflowのみ。bug/feature/「ChatGPT UI breakage」/「new service request」テンプレ、PULL_REQUEST_TEMPLATE（CONTRIBUTINGの4項目を転記）を追加。公開時にdescription/homepage/topics設定。
- **M-DIST2. OS対応状況が未文書** — agent-browser.mjs:16-23はWin/Linux Chromeパスを含みCDP方式は本来クロスプラットフォームだが、対応/テスト状況の記載なし。手動fallbackはmacOS専用（osascript/pbpaste、line104が自認）。READMEに**サポートマトリクス**（サーバ=Node可なOS全部 / スクリプト=CDPでクロスプラットフォーム実装・macOSテスト済み・Win/Linuxフィードバック募集 / keystroke fallback=macOSのみ）。
- **M-DIST3. ポート既定の不一致 4217 vs 4310** — server.mjs:20=4217（README/config/landing/AGENTSのcurl例）に対し process-queue.mjs:31=4310（AGENTSのscript例も4310）。READMEで起動→スクリプトbare実行で接続失敗。**全箇所4217に統一**、process-queue.mjs既定を4217に、AGENTS.mdのscript例も4217に。`--server`/`IMAGE_ARRANGER_SERVER` は上書き用に残す。

### M-CQ. コード品質
- **M-CQ1. server.mjsが1525行の単一ファイル** — HTTP/ルーティング/データモデル/永続化/プロンプトテンプレが混在。route dispatchは `handleApi` 内のif/elseチェーン(979-1362)で誤順序リスク。**ビルド/依存なしで分割**: deck-model.mjs / requests.mjs / prompts.mjs / doctor.mjs、server.mjsはrouting+bootstrapに。if-chainを `{method, pattern, handler}` 配列に。貢献者の自信に最も効くリファクタ。
- **M-CQ2. 共有JSON書き込みの更新ロスト** — `PUT /api/state` 以外の変更系（POST /api/assets, /requests, /complete, /characters, base-kit/import）はバージョン検査なしのread-modify-write。**批評役の訂正**: `.tmp` 衝突は同期writeFileSync+renameSyncで単一プロセスのため**到達不能（過大評価）**。真の問題は多くのハンドラが `await readBody()` の**前**に `readState()` する順序（1030-1031, 1045-1046, 1062-1063, 1297+1313）で、await中の別コミットを古いstateで上書きすること。最小修正: bodyを読んでからstateを読む、もしくはdeck.json変更をin-processの非同期mutexで直列化。「ワークスペースはsingle-writer」を文書化。
- **M-CQ3. ChatGPT自動化が第三者DOMセレクタにハードコード依存（リポジトリ内の保守負債）** — `#prompt-textarea`, `[data-testid="send-button"]`, `[data-testid^="conversation-turn-"]` 等とimage-src/ロケール正規表現。CIで覆えない未テストコード。**残すが脱リスク化**: 冒頭バナー＋READMEで「動く第三者UIを狙うため予告なく壊れ得る／セレクタの所在」を明記、`integrations/` または `experimental/` への移動でサポート階層を示す、AGENTS.mdの手動fallbackが**恒久契約**だと明示。
- **M-CQ4. テストがサーバのみ** — app.js・キュープロセッサ・doctorシークレットスキャナに自動カバレッジ無し（doctorは目玉安全機能なのに）。依存ゼロのnode:testで: `validateStateForPublish` に `sk-...`/絶対パス/license欠落assetを与えて検証（最優先・公開をgateするため）、process-queue.mjsの `slugify`/ターゲットフィルタをexportしてテスト、escapeHtml/setAdopted/resolveReferenceFile を小モジュール化してテスト。

### M-CRIT. 横断批評役の追加
- **M-CRIT1. デッキの世代マイグレーションが一方向・未テスト・前方版ガード無し** — normalizeState()(446)は `prompt-deck.v1`→`image-arranger.v1` を昇格するが、**新しいサーバが書いたdeck.jsonを古いサーバが読む**ケースの扱いが無い。バージョン識別子も無いため、更新→編集→ロールバックで新しいデッキが黙って正規化/欠落。`state.schema` がサーバの `SCHEMA_VERSION` より新しければ拒否（or 警告＋backup）するガード＋移行のロスレステスト2-3件。
- **M-CRIT2. UIが毎操作で全アプリHTMLを再描画** — render()(1255)が `$('#app').innerHTML` を丸ごと再構築(1265)し、ほぼ全変更後に呼ばれる。数百entry/assetのパワーユーザー（=擁護者になる層）で全DOM再パース/リフローが上限になる。ローンチブロッカーではないが、実用的なデッキ規模目安を文書化し、再描画をアクティブタブ/リストにスコープ。スタジオ展開前に数百entryでテスト。
- **M-CRIT3. HTTP Range非対応 — 動画がメモリ全読みでスクラブ不可** — 動画を明示サポート（mp4/webm, 80MB, app.js:874）するのに serveFile(1364-1380)は `readFileSync` で全体読み・Accept-Ranges/Range無し。`<video>` のシークは範囲要求依存なので不可、大きいクリップでカクつく。最小Range/206対応（~20行・依存ゼロ）＋大assetはreadStream。
- **M-CRIT4. SECURITY.md/READMEが実際の脅威モデルを省略／doctorのシークレットスキャンが狭く誇大** — 「閲覧中に任意サイトが到達できる」最重要リスクが両者に無く、「127.0.0.1のみ」で誤った安心感。README:72「scans for secret-like strings」だが `validateStateForPublish` はデッキ**state JSONのみ**スキャンし、request files・agent-logs/（ChatGPT UIスクショ＝アカウントメール写り込み）・ワークスペース全体は対象外。`SECRET_PATTERNS` も `/token/i` `/api[_-]?key/i` が無害な部分文字列にマッチする一方、AWS `AKIA…`/Google `AIza…`/JWT/bearerは未検出。脅威モデルとOrigin緩和をSECURITY.mdに記述、doctorを拡張するかREADMEの表現を実態に合わせる、正規表現を既知prefixへ。

---

## 🟢 Low

- **L1. 中核用語が未定義** — deck/kit/entry/adopted/canonical/「coding agent」。READMEに6行のglossary＋「coding agent」の定義（Claude Code/Codex等がサービスのWeb UIを代理操作する、の1文）。
- **L2. configユーザーコピーがignoreされない** — config.example.json→config.json（ローカルパス含む）が未ignore。`.gitignore` に `config.json`（＋`*.local.json` 慣習）。
- **L3. 公開ローンチの未了点** — CIバッジ/Pagesがまだ存在しないリポジトリ状態に依存（README:3, docs/）。公開チェックリスト: public化・Pages有効化・homepage設定・バッジ描画確認・landingにNode 20+行追加。
- **L4. SECURITY.mdに応答SLA/サポート版記述が無い** — 初回応答目安（例: 7日・ソロベストエフォート）と「最新release/mainのみサポート」の2文。
- **L5. dead code** — process-queue.mjs:21の未使用 `sleep` import、server.mjs:1507の `createPromptDeckServer` 別名＋`LEGACY_SCHEMA_VERSION`/workflow移行コード。`prompt-deck.v1` デッキが作者外に存在しないなら初公開タグ前に削除。
- **L6. README「Node 20+」だがCIはNode 22のみ** — H6/H12と関連。floorを検証するNode 20ジョブ追加、またはサーバ20+/スクリプト22+を明記。
- **L7. APIレスポンス形状が不統一** — `GET /api/state` は生stateを返すが他は `{ok:true,...}` envelope。規約を文書化するか state を `{ok:true,state}` で包む。
- **L8. referenceUrl が scheme検証なしで href 化（共有デッキ経由のscript-URI）** — escapeHtml(393)はscheme未検査、entry.referenceUrl が `<a href>` に（app.js:777）。共有deck.jsonが `javascript:...` を設定でき、↗クリックでアプリオリジンでスクリプト実行。`http(s)://` 始まりを検証して非該当はリンク化しない。シングルクォートもescapeHtmlで符号化（多層防御）。
- **L9（批評役）. CSPヘッダ無し** — `default-src 'self'` でreferenceUrlの `javascript:` 実行・共有デッキXSS・Font Awesome cdnjsビーコンを同時に緩和/可視化。Font Awesomeをローカルvendoring後に厳格CSP付与。
- **L10（批評役）. モーダルにキーボード/Esc/フォーカストラップ無し** — entry/formモーダル(750, 1242)は×クリックのみ。空 `alt=""` 画像(745, 1186)も。Escで閉じる＋簡易フォーカストラップ/復帰、意味のあるalt。aria-label・:focus-visibleは既に良好なので底上げのみ。
- **L11. サンプルワークスペースに画像ゼロ** — `--init sample` のassets/が空で、候補/採用/canonicalの中核概念が初回不可視。テストfixtureはfreshに存在しない `assets/base-reference.png` を参照。3-5枚の公開安全なプレースホルダPNG（幾何/シルエットでも可）を、1枚採用済み・1枚未採用で同梱。

---

## 推奨アクション順序（公開ロードマップ）

### フェーズ0: 公開前ブロッカー（数日）
1. **C2 + H10 + H11 + M-CRIT4**: Host/Origin許可リスト、`/asset` をassets/outputsに限定＋ワイルドカードCORS除去、Content-Type強制、絶対パスsourceFile不許可、SECURITY.mdに脅威モデル記述。（公開当日に叩かれる層対策）
2. **C3 + H5 + H6 + M-DIST3**: ChatGPT自動化を「正直＋動く」に — CONTRIBUTING:25矛盾修正、ToS免責、READMEに節追加、Node 22+ガード/明記、ポート4217統一。
3. **C1 + H9 + H13**: package.json（依存ゼロ・bin・engines・scripts）、npm名確保、v0.1.0タグ＋Release、リポジトリメタ設定、Pages有効化。
4. **H1**: 60-90秒デモGIF＋スクショ3枚をREADME/landingへ（TODO T13解消）。

### フェーズ1: 初回成功率（公開直後）
5. **H2 + H3 + H4 + L11**: 手動パス文書、agent-prompt英語化、UI/サンプル既定英語、サンプルにプレースホルダ画像。
6. **H7**: `docs/request-spec.md`（安定契約＋ドライバ作成ガイド）。
7. **H12 + M-DIST1**: CIマトリクス、issue/PRテンプレ（特に「ChatGPT UI breakage」「new service」）。

### フェーズ2: 継続と拡大（最初の90日）
8. **H8**: `--check` セレクタ自己診断、SELECTORS.md、ロケール中立化。
9. **M-DOC群 + M-DIST2**: 比較セクション、日本語README parity、OSサポートマトリクス、Font Awesome vendoring。
10. **ローンチ**: JP（Zenn/note記事＋X、デモGIF再利用） / EN（Show HN「local-first request-file manager — the agent does the generating」）。Week4-8に `request-spec.md` 公開し、コミュニティドライバ（Midjourney/ComfyUI）を旗艦貢献として招待。**成功指標: 90日で外部ドライバPR 1件＋作者外バグ修正merge 1件**。

### フェーズ3: 品質の底上げ（継続）
11. **M-CQ群 + M-CRIT群**: server.mjs分割、更新ロスト修正、doctor/app.jsテスト、デッキbackup/export、Range対応、世代マイグレーションガード。
12. **L群**: glossary、config.json ignore、CSP、モーダルキーボード対応、dead code削除。

---

## 横断批評役が挙げた「もし3つしかできないなら」

1. **本物のビジュアルを出す**（H1）— 視覚的ツールの発見/信頼の#1レバー。素材は `agent-logs/` に既にある。
2. **目玉自動化を正直かつ動くものに**（C3+H5+H6+M-DIST3）— 今は不可視・矛盾・推奨最低Nodeでクラッシュ。
3. **localhostの無音の露出を塞ぐ**（C2+H10+H11）— 公開当日に数分で見つかるクラス。閲覧中に発火。

---

*このレビューは製品哲学（依存ゼロ・ローカルファースト・生成は外部）を前提に、その枠内で実行可能な改善のみを提案しています。全項目にファイル/行番号の根拠あり。*
