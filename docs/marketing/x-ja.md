# X Thread Draft (JA)

Target: X / Japanese launch thread
Primary link: https://github.com/aiarranger/image-arranger?utm_source=x&utm_medium=social&utm_campaign=launch-ja
LP link: https://aiarranger.jp/image-arranger/?utm_source=x&utm_medium=social&utm_campaign=launch-ja
Media slot: attach the Aichan overview GIF from `docs/assets/marketing/image-arranger-overview-ja.gif` to post 1.

## Thread

1. AI画像生成で「どの絵が正だったっけ？」が増えてきたので、生成しない管理ツールを作りました。  
   image-arranger は参照画像・候補・採用・キューをローカルで整理します。  
   [video]

2. 生成APIは呼びません。  
   ChatGPT / Midjourney / Vidu など、使っている生成サービスはそのまま。image-arranger は依頼JSONを書き出し、人間またはCodex/Claude Codeのようなエージェントが通常UIで処理します。

3. いちばん便利なのは Create kit。  
   採用済み参照を選んで、キャラの正になるリファレンスシート作成依頼をキュー投入。必要ならシートを顔・衣装・小物などのパーツ参照へ分解して、部分修正にも使えます。

4. 生成結果は「候補」として戻り、良いものだけを「採用」。  
   採用画像が次の生成の参照になります。フォルダ名やスプレッドシートではなく、状態として管理する感じです。

5. アプリ本体は依存ゼロ、Node.js 20+ だけ。サンプルデッキとデモエージェントで、外部アカウントなしに一周試せます。  
   ターミナル1: `npm start`
   ターミナル2: `npm run demo-agent`

6. OSSです。  
   ローカルファーストなAI制作ワークフロー、参照管理、エージェント処理の土台に興味がある方は触ってみてください。  
   GitHub: https://github.com/aiarranger/image-arranger?utm_source=x&utm_medium=social&utm_campaign=launch-ja

## Notes

- Post 1 hook length: 46 Japanese characters before the product sentence, safely under 140 chars without URL/media expansion.
- If using only one link in the thread, keep GitHub in post 6 and put the LP in the profile/comment.
- After posting, reply once with the Quick Start command if people ask for setup details.
- Do not overstate Windows/Linux scripted-driver support. The app/server runs wherever Node.js runs; the optional scripted processor is macOS-tested, and the manual keystroke fallback is macOS-only.
