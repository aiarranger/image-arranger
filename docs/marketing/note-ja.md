# note Draft (JA)

Target: note / Japanese article
Primary link: https://github.com/aiarranger/image-arranger?utm_source=note&utm_medium=article&utm_campaign=launch-ja
LP link: https://aiarranger.github.io/image-arranger/?utm_source=note&utm_medium=article&utm_campaign=launch-ja
Media slots:
- Hero: 45s demo video or GIF from `docs/assets/readme/demo.gif`
- Inline image 1: Create kit route selection
- Inline image 2: Queue + candidate arrival
- Inline image 3: Gallery / adopted assets

## Title

AI画像生成の「参照・候補・採用」をローカルで整理する、生成しないツールを作りました

## Body

AI画像生成を続けていると、ある時点から問題が「どう生成するか」だけではなくなります。

この顔が正しい。衣装はこっち。帽子は前の候補のほうがいい。表情は最新だけど、髪色は初期案から動かしたくない。動画に使った開始フレームはどれだったか。次の依頼に添付すべき参照画像はどれか。

最初はフォルダ名やスプレッドシートでなんとかなります。でも候補が増え、キャラやパーツが増え、画像と動画を行き来し始めると、生成サービス側の履歴だけでは追いきれません。欲しかったのは、生成モデルではなく、制作判断を覚えておく管理層でした。

そこで作ったのが **image-arranger** です。

image-arranger は、AI画像・動画生成のためのローカルファーストなプロンプト／アセット管理ツールです。大事な特徴は、**生成しない**ことです。ChatGPT、Midjourney、Vidu、ComfyUI など、実際の生成は好きな場所で続けます。image-arranger は「何を依頼するか」「どの参照を添付するか」「どの候補を採用したか」「いま何がキューにあるか」を整理します。

[media: 45s demo video]

基本の流れは、Create kit → Base → Image → Video → Queue です。

Create kit では、採用済みの参照画像を選んで、キャラクターの正になるリファレンスシートを1枚作る依頼をキューに入れます。シートがある場合は、それを顔、衣装、小物、表情などのパーツ参照へ分解することもできます。全体を毎回作り直すのではなく、崩れたパーツだけを直してから、もう一度シートに反映するための導線です。

Base では、顔・衣装・アクセサリなどの基準画像を管理します。各エントリには複数の候補を置けますが、「採用」できるのは自分が正だと判断したものだけです。採用済み画像は、次の生成リクエストで参照として使われます。

Image と Video は、通常の画像・動画プロンプトの管理場所です。Image では採用済み参照を添付して1枚ずつ依頼できます。Video では開始フレームと終了フレームを採用済み画像から指定できます。

Queue は、依頼のアウトボックスです。ボタンを押すと、image-arranger は `requests/*.json` に依頼ファイルを書き出します。人間が手で処理してもよいし、Codex や Claude Code のようなコーディングエージェントに渡してもよい。処理結果は候補アセットとして戻り、気に入ったものだけを採用します。

[media: Queue + result candidate]

この「候補」と「採用」を分けているところが、個人的にはいちばん効きました。生成サービスの履歴は、作った順番を覚えてくれます。でも制作では、順番よりも「どれを正にしたか」のほうが大事です。顔の正、衣装の正、小物の正、背景の正が別々に存在していて、それらを次の依頼へまとめて添付したい。image-arranger では、採用済みだけが次の参照候補として扱われるので、迷い中の案を残しながら、正として使うものだけを切り分けられます。

また、依頼は必ず「1ターゲット = 1成果物」として扱います。複数案のグリッドや比較画像を1件の成果物にしない、という単純な制約です。地味ですが、あとから採用・改善・動画化するときに、どのファイルが何の結果なのかを崩さないために必要でした。

この設計にした理由は、生成サービスを置き換えたいわけではないからです。むしろ逆で、今使っている生成環境をそのまま活かしたい。サービスごとに得意な表現やUIがあり、アカウントやワークフローも人によって違います。image-arranger はそこへ無理に入り込まず、安定した依頼ファイル契約だけを持ちます。

依頼ファイルは、人間にもエージェントにも読める JSON です。プロンプト、参照画像、保存先、対象サービス、アクションが入っていて、完了時は結果ファイルを返すだけ。特定の生成サービスや自動化スクリプトに閉じないので、手作業でも、ChatGPT UI を使う自動化でも、将来の別サービス用ドライバでも同じ流れを使えます。

ローカルで動くことも重視しました。Node.js 20+ だけで起動し、ランタイム依存はありません。ユーザーのデータは選んだ workspace に保存されます。デッキ JSON、依頼ファイル、出力、候補素材が手元のフォルダに残るので、生成サービスの履歴やクラウド側の状態に依存しすぎません。サンプルデッキとデモエージェントも同梱しているので、外部アカウントなしで一周試せます。

```bash
git clone https://github.com/aiarranger/image-arranger.git
cd image-arranger
```

ターミナル1:

```bash
npm start
```

ターミナル2:

```bash
npm run demo-agent
```

ComfyUI や画像生成ツールと競合するものではありません。生成するツールが「絵を作る場所」だとしたら、image-arranger は「どの絵を正にしたか、次に何を頼むかを忘れない場所」です。スプレッドシートとフォルダで管理していた部分を、制作フローとして扱えるようにするための道具です。

まずはサンプルキャラで、Create kit から1件キューに入れてみてください。デモエージェントを動かすと、数秒で候補が戻ってきます。そこから採用、改善、ギャラリー確認まで進めると、このツールが管理したい層が見えてくると思います。

GitHub:
https://github.com/aiarranger/image-arranger?utm_source=note&utm_medium=article&utm_campaign=launch-ja

Landing page:
https://aiarranger.github.io/image-arranger/?utm_source=note&utm_medium=article&utm_campaign=launch-ja

## Publishing Notes

- Target length: about 2,000-3,000 Japanese characters excluding code/link blocks.
- Replace media slots before posting.
- Do not imply image-arranger performs API generation.
- If adding a screenshot of the scripted processor, include the ToS disclaimer from README/AGENTS nearby.
