/* image-arranger LP — zero-dependency and offline-safe */
(() => {
  "use strict";
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const LANG_KEY = "image-arrangrer-lp-lang";
  const COPY_LABELS = {
    en: { ready: "copy", copied: "copied!", failed: "select & copy" },
    ja: { ready: "コピー", copied: "コピーしました", failed: "選択してコピー" }
  };
  const I18N = {
    en: {
      title: "Image-Arrangrer — the missing management layer for AI image generation",
      description: "Local-first prompt & asset request manager for AI image/video generation. It doesn't generate — it keeps your workflow organized: canonical references, adopted candidates, queued requests.",
      lang_switch_aria: "Language switch",
      language_label: "Language",
      hero_ver: "MIT License · Node.js 20+ · zero dependencies",
      hero_title: "Generators create.<br><span class=\"em\">Nothing keeps track.</span>",
      hero_lede: "Character-consistent generation is a reference-image game — and today the bookkeeping is a spreadsheet and a folder of PNGs. image-arranger is the <strong>local-first layer that remembers</strong>: canonical references, adopted candidates, the prompt behind every image, and what's still queued. It <strong>doesn't generate</strong> — by design. It works with any generation service.",
      cta_run: "Run it locally — 30 seconds",
      cta_watch: "View the base references",
      cta_star: "★ Star on GitHub<span class=\"starcount\" id=\"starCount\" hidden></span>",
      cta_star_plain: "★ Star on GitHub",
      pill_local: "runs on 127.0.0.1 only",
      pill_files: "all data = plain JSON + files",
      pill_agent: "agent-ready request queue",
      hero_screen_url: "Aichan design sheet — source reference pack",
      real_app_screen: "Source reference",
      overview_card_aria: "Image-Arrangrer Aichan base references",
      overview_primary_aria: "Open the English Aichan base references",
      overview_links_aria: "Base reference language links",
      overview_poster_alt: "Poster for an English Aichan base showing Image-Arrangrer organizing image, prompt, source, and video generation assets",
      overview_eyebrow: "Aichan base",
      overview_open: "Open design sheet",
      overview_en: "Design sheet",
      overview_ja: "Key visual",
      overview_caption: "A visual walkthrough of the same prompt, source, image, and video organization flow. <span lang=\"ja\">キー画像もあります。</span>",
      strip_any_service: "…any service with a UI",
      strip_aria: "Works with any generation service",
      strip_agent: "any coding agent",
      screens_title: "One reference pack, honest working state",
      screens_sub: "The landing page shows what the sample actually contains. It does not replace missing assets with decorative stand-ins.",
      screens_base_title: "Real references only",
      screens_base_caption: "The bundled sample keeps only the two real Aichan reference files. Empty part rows are not prefilled.",
      screens_queue_title: "Requests stay inspectable",
      screens_queue_caption: "Generation work appears as plain JSON only after the operator queues it. A fresh clone starts with no pending request files.",
      screens_gallery_title: "Only adopted assets appear",
      screens_gallery_caption: "The gallery does not invent thumbnails. It shows files that were registered and adopted by the operator.",
      workflow_title: "The tab order <em>is</em> the workflow",
      workflow_sub: "From one key visual to a consistent character across stills and video — every step feeds the next.",
      wf_nav_kit: "Create kit",
      wf_kit_label: "01 · CREATE KIT",
      wf_kit_title: "Identity sheet",
      wf_kit_body: "One-shot generate the character's canonical sheet from a reusable prompt template. Fix one part without rerolling everything: decompose into per-part references.",
      wf_kit_caption: "Create kit view: source images become a structured character sheet request.",
      wf_base_label: "02 · BASE",
      wf_base_title: "Part references",
      wf_base_body: "Manage per-part reference entries (face, expression, outfit…) with candidates. Only approved ones get adopted.",
      wf_base_no_prefill: "created only from real registered outputs",
      wf_base_caption: "Base view: approved references are tracked by role instead of loose files.",
      wf_image_label: "03 · IMAGE",
      wf_image_title: "One prompt, one output",
      wf_image_body: "Compose prompts that attach adopted images as source inputs. Improve or retry; adoption stays exclusive.",
      wf_image_caption: "Image view: candidates, adoption state, and retry intent stay separate.",
      wf_video_label: "04 · VIDEO",
      wf_video_title: "Scene stills only",
      wf_video_body: "Queue video only after a real adopted scene still exists. For locked-camera motion, reuse the same adopted still as both start and end.",
      wf_video_step_one: "Requires a real adopted scene still.",
      wf_video_step_two: "Uses explicit startFrame and endFrame paths.",
      wf_video_step_three: "Shows no completed clip until a real MP4 is registered.",
      wf_video_caption: "Video view: no fake completed clips; start/end frame fields point to adopted stills from the same scene.",
      wf_queue_label: "05 · QUEUE",
      wf_queue_title: "Requests as files",
      wf_queue_body: "Each request is a JSON file with prompt, references and output dir. Edit, cancel or complete from the UI — or hand the folder to an agent.",
      wf_queue_caption: "Queue view: the handoff is a reviewable request file, not hidden app state.",
      features_title: "Why image-arranger?",
      features_sub: "The generators are great — the bookkeeping around them is not. This fixes the bookkeeping.",
      feature_local_title: "Local-first, zero dependencies",
      feature_local_body: "One Node.js file, no build step, no accounts. Your prompts and assets never leave your machine — everything lives in a workspace folder you choose, as plain JSON and files you can read, grep and version.",
      feature_adoption_title: "Adoption, not chaos",
      feature_adoption_body: "Every output is a candidate; you adopt the good ones. Adopted images become the canonical references for the next round — per part, per character — and source links always resolve to the <em>current</em> canonical at queue time.",
      feature_adoption_step_candidate: "a real exported file is registered",
      feature_adoption_step_adopted: "the operator approves one current asset",
      feature_adoption_step_reference: "future requests resolve to that asset",
      feature_agent_title: "Agent-ready queue",
      feature_agent_body: "Requests are JSON files, not API calls. Any coding agent can process them — and you review what comes back.",
      feature_doctor_title: "<code>--doctor</code> pre-publish scan",
      feature_doctor_body: "Run it before sharing a workspace.",
      check_secrets: "no secret-like strings",
      check_paths: "no local absolute paths",
      check_provenance: "provenance fields present",
      feature_lang_title: "EN/JA built-in",
      feature_lang_body: "Full bilingual UI, one click.",
      feature_gallery_title: "Gallery &amp; gates",
      feature_gallery_body: "A dark showcase wall of everything you adopted — gated so only reviewed work ships.",
      agents_title: "Requests are files,<br>not API calls.",
      agents_body: "Hand the queue to a coding agent. It reads the JSON, generates with whatever it has, drops the results back — and you adopt only what passes review.",
      agents_link: "Read AGENTS.md →",
      quickstart_title: "Quick Start",
      quickstart_sub: "Requires Node.js 20+. No dependencies, no build step.",
      quickstart_outcome: "→ open http://127.0.0.1:4217 — sample workspace, no accounts, nothing leaves your machine",
      quickstart_doctor: "The <code>--doctor</code> scan looks for secret-like strings, local paths and missing provenance fields. Every asset records license, AI-generated and human-reviewed flags.",
      faq_title: "FAQ",
      faq_generate_q: "Does it generate images?",
      faq_generate_a: "No — by design. image-arranger is the management layer <em>around</em> generation: it remembers references, prompts, candidates and queued requests. You (or your agent) generate wherever you already generate.",
      faq_data_q: "Where is my data?",
      faq_data_a: "In a workspace folder you chose, as plain JSON and image files. No database, no cloud, no accounts. Delete the folder and it's gone; copy it and it's backed up; <code>git init</code> it and it's versioned.",
      faq_api_q: "Do I need an API key?",
      faq_api_a: "No. The tool makes zero network calls to generation services. It runs on 127.0.0.1 and works fully offline.",
      faq_agent_q: "Can my agent break things?",
      faq_agent_a: "The queue is a folder of reviewable JSON files — not live API access. The agent reads requests and drops results back; nothing becomes canonical until you adopt it. <code>--doctor</code> scans a workspace before you publish it.",
      faq_lang_q: "Can I use Japanese?",
      faq_lang_a: "Yes. The product UI and this page can switch between English and Japanese in one click. Prompts can be written in either language.",
      final_title: "Your generations deserve <span class=\"em\" style=\"background:var(--accent-grad);-webkit-background-clip:text;background-clip:text;color:transparent\">a memory.</span>",
      final_sub: "Local-first. Zero dependencies. Thirty seconds to running."
    },
    ja: {
      title: "Image-Arrangrer — AI画像生成のためのローカル管理レイヤー",
      description: "AI画像・動画生成のためのローカルファーストなプロンプト/素材/依頼管理ツール。生成はせず、正リファレンス、採用候補、依頼キューを整理します。",
      lang_switch_aria: "言語切り替え",
      language_label: "言語",
      hero_ver: "MIT License · Node.js 20+ · 依存パッケージなし",
      hero_title: "生成サービスは作る。<br><span class=\"em\">でも管理は残らない。</span>",
      hero_lede: "キャラクターの一貫性はリファレンス画像の管理で決まります。ところが現場では、スプレッドシートとPNGフォルダで追いかけがちです。image-arranger は <strong>ローカルで記憶する管理レイヤー</strong>です。正リファレンス、採用候補、各画像のプロンプト、未処理キューを整理します。設計上、<strong>生成はしません</strong>。どの生成サービスとも併用できます。",
      cta_run: "ローカルで起動 — 30秒",
      cta_watch: "ベース資料を見る",
      cta_star: "★ GitHubでStar<span class=\"starcount\" id=\"starCount\" hidden></span>",
      cta_star_plain: "★ GitHubでStar",
      pill_local: "127.0.0.1 だけで動作",
      pill_files: "データはJSON + ファイル",
      pill_agent: "エージェント対応キュー",
      hero_screen_url: "AIちゃん設定資料 — 正リファレンスパック",
      real_app_screen: "正リファレンス",
      overview_card_aria: "Image-Arrangrer AIちゃんベース資料",
      overview_primary_aria: "日本語のAIちゃんベース資料を開く",
      overview_links_aria: "ベース資料のリンク",
      overview_poster_alt: "サンプルのベース参照として使うAIちゃんキー画像",
      overview_eyebrow: "AIちゃんベース",
      overview_open: "日本語設定資料を開く",
      overview_en: "設定資料",
      overview_ja: "キー画像",
      overview_caption: "プロンプト、元画像、生成画像、動画素材を整理する流れを実画面ベースで紹介します。キー画像もあります。",
      strip_any_service: "UIがある生成サービスなら併用可能",
      strip_aria: "任意の生成サービスと併用可能",
      strip_agent: "任意のコーディングエージェント",
      screens_title: "1つの参照パックと、正直な作業状態",
      screens_sub: "LPではサンプルに実在する内容だけを見せます。足りない素材を装飾カードで埋めません。",
      screens_base_title: "実在する参照だけ",
      screens_base_caption: "同梱サンプルにはAIちゃんの実在する参照ファイル2つだけを入れます。空のパーツ行は先に作りません。",
      screens_queue_title: "依頼は読める状態で残る",
      screens_queue_caption: "生成依頼は、ユーザーがキューに入れた後だけJSONとして現れます。clone直後は未処理依頼なしです。",
      screens_gallery_title: "採用済み素材だけを表示",
      screens_gallery_caption: "Gallery はサムネイルを捏造しません。登録され、採用されたファイルだけを表示します。",
      workflow_title: "タブの順番が、そのままワークフロー",
      workflow_sub: "1枚のキー画像から、静止画と動画で一貫したキャラクターへ。各ステップが次のステップにつながります。",
      wf_nav_kit: "Create kit",
      wf_kit_label: "01 · CREATE KIT",
      wf_kit_title: "正リファレンスシート",
      wf_kit_body: "再利用できるプロンプトテンプレートから、キャラクターの正となるシートを作ります。全部を引き直さず、直したい部分だけをパーツ単位のリファレンスに分解できます。",
      wf_kit_caption: "Create kit 画面：元画像から、構造化されたキャラクターシート依頼を作ります。",
      wf_base_label: "02 · BASE",
      wf_base_title: "パーツ別リファレンス",
      wf_base_body: "顔、表情、衣装などのリファレンスを候補として管理します。承認したものだけが採用状態になります。",
      wf_base_no_prefill: "実在する登録済み出力からだけ作成",
      wf_base_caption: "Base 画面：承認済みリファレンスを、バラバラのファイルではなく役割ごとに追跡します。",
      wf_image_label: "03 · IMAGE",
      wf_image_title: "1プロンプト、1アウトプット",
      wf_image_body: "採用済み画像を元画像として添付しながらプロンプトを組みます。改善や再試行をしても、採用状態は常に明確です。",
      wf_image_caption: "Image 画面：候補、採用状態、再試行の意図を分けて管理します。",
      wf_video_label: "04 · VIDEO",
      wf_video_title: "同一シーンの静止画だけを使う",
      wf_video_body: "動画キューは、実在する採用済みシーン画像ができてから使います。固定カメラなら同じ採用済み画像を start/end に指定します。",
      wf_video_step_one: "実在する採用済みシーン画像が必要です。",
      wf_video_step_two: "startFrame と endFrame に明示的なファイルパスを入れます。",
      wf_video_step_three: "実在するMP4が登録されるまで、完成動画として見せません。",
      wf_video_caption: "Video 画面：完成済み動画を装わず、start/end は同一シーンの採用済み静止画だけを参照します。",
      wf_queue_label: "05 · QUEUE",
      wf_queue_title: "依頼はファイル",
      wf_queue_body: "各依頼は、プロンプト、参照画像、出力先を持つJSONファイルです。UIから編集・キャンセル・完了でき、フォルダごとエージェントにも渡せます。",
      wf_queue_caption: "Queue 画面：受け渡しは隠れたアプリ状態ではなく、レビューできる依頼ファイルです。",
      features_title: "なぜ image-arranger なのか",
      features_sub: "生成サービスは強力ですが、その周辺の管理は弱いままです。image-arranger はそこを補います。",
      feature_local_title: "ローカルファースト、依存なし",
      feature_local_body: "Node.js ファイル1つで、ビルドもアカウントも不要です。プロンプトと素材はあなたのマシンから出ません。選んだワークスペース内に、読めて検索できてバージョン管理できるJSONとファイルとして残ります。",
      feature_adoption_title: "候補を採用して、混乱させない",
      feature_adoption_body: "すべての出力は候補です。良いものだけを採用します。採用済み画像は、次の生成で使う正リファレンスになります。パーツ別、キャラクター別に管理でき、キュー作成時には常に<em>最新の正</em>へ解決されます。",
      feature_adoption_step_candidate: "実在する出力ファイルを登録",
      feature_adoption_step_adopted: "ユーザーが現在の正として承認",
      feature_adoption_step_reference: "次の依頼がその素材へ解決",
      feature_agent_title: "エージェント対応キュー",
      feature_agent_body: "依頼はAPI呼び出しではなくJSONファイルです。任意のコーディングエージェントで処理でき、返ってきた結果は人間がレビューできます。",
      feature_doctor_title: "<code>--doctor</code> 公開前チェック",
      feature_doctor_body: "ワークスペースを共有する前に実行できます。",
      check_secrets: "秘密情報らしい文字列なし",
      check_paths: "ローカル絶対パスなし",
      check_provenance: "由来情報フィールドあり",
      feature_lang_title: "日英対応",
      feature_lang_body: "UIもLPもワンクリックで切り替えられます。",
      feature_gallery_title: "ギャラリーとゲート",
      feature_gallery_body: "採用したものだけを並べるダークなギャラリー。レビュー済みの成果だけを出せるゲート付きです。",
      agents_title: "依頼はファイル。<br>API呼び出しではありません。",
      agents_body: "キューをコーディングエージェントに渡せます。エージェントはJSONを読み、使える手段で生成し、結果を戻します。採用するのはレビューを通ったものだけです。",
      agents_link: "AGENTS.md を読む →",
      quickstart_title: "Quick Start",
      quickstart_sub: "Node.js 20+ が必要です。依存パッケージなし、ビルドなし。",
      quickstart_outcome: "→ http://127.0.0.1:4217 を開く — サンプルワークスペース、アカウント不要、データは外へ出ません",
      quickstart_doctor: "<code>--doctor</code> は秘密情報らしい文字列、ローカルパス、由来情報の不足を確認します。各素材にはライセンス、AI生成、人間レビュー済みのフラグを記録できます。",
      faq_title: "FAQ",
      faq_generate_q: "画像を生成しますか？",
      faq_generate_a: "いいえ。設計上、生成しません。image-arranger は生成の<em>周辺</em>を管理するレイヤーです。リファレンス、プロンプト、候補、依頼キューを記憶し、生成自体はあなたやエージェントが普段のサービス上で行います。",
      faq_data_q: "データはどこにありますか？",
      faq_data_a: "あなたが選んだワークスペースフォルダ内です。プレーンなJSONと画像ファイルとして保存されます。データベースもクラウドもアカウントもありません。消せば消え、コピーすればバックアップでき、<code>git init</code> すればバージョン管理できます。",
      faq_api_q: "APIキーは必要ですか？",
      faq_api_a: "不要です。このツールは生成サービスへネットワーク呼び出しをしません。127.0.0.1 上で動き、オフラインでも使えます。",
      faq_agent_q: "エージェントが壊してしまいませんか？",
      faq_agent_a: "キューはレビュー可能なJSONファイルのフォルダであり、ライブなAPI権限ではありません。エージェントは依頼を読み、結果を戻すだけです。採用するまで正リファレンスにはなりません。公開前には <code>--doctor</code> でワークスペースをスキャンできます。",
      faq_lang_q: "英語でも使えますか？",
      faq_lang_a: "はい。製品UIとこのページは日本語/英語をワンクリックで切り替えられます。プロンプト本文はどちらの言語でも扱えます。",
      final_title: "あなたの生成物には、<span class=\"em\" style=\"background:var(--accent-grad);-webkit-background-clip:text;background-clip:text;color:transparent\">記憶する場所</span>が必要です。",
      final_sub: "ローカルファースト。依存なし。30秒で起動。"
    }
  };
  let activeLang = "en";

  function storedLanguage() {
    try { return localStorage.getItem(LANG_KEY); } catch { return ""; }
  }
  function preferredLanguage() {
    const fromQuery = new URLSearchParams(location.search).get("lang");
    if (fromQuery === "ja" || fromQuery === "en") return fromQuery;
    const stored = storedLanguage();
    if (stored === "ja" || stored === "en") return stored;
    return /^ja\b/i.test(navigator.language || "") ? "ja" : "en";
  }
  function applyLanguage(lang) {
    activeLang = I18N[lang] ? lang : "en";
    const dict = I18N[activeLang];
    document.documentElement.lang = activeLang;
    document.body.dataset.lang = activeLang;
    document.title = dict.title;
    const description = $('meta[name="description"]');
    const ogTitle = $('meta[property="og:title"]');
    const ogDescription = $('meta[property="og:description"]');
    if (description) description.setAttribute("content", dict.description);
    if (ogTitle) ogTitle.setAttribute("content", dict.title);
    if (ogDescription) ogDescription.setAttribute("content", dict.description);
    $$("[data-i18n]").forEach((el) => {
      const value = dict[el.dataset.i18n];
      if (value !== undefined) el.innerHTML = value;
    });
    const overviewAsset = activeLang === "ja"
      ? {
        gif: "assets/base/aichan_design.png",
        poster: "assets/base/aichan.png",
      }
      : {
        gif: "assets/base/aichan_design.png",
        poster: "assets/base/aichan.png",
      };
    const langSwitch = $(".lang-switch");
    const overviewCard = $(".walkthrough-card");
    const overviewLink = $(".hero-gif-link");
    const overviewPoster = overviewLink ? $("img", overviewLink) : null;
    const overviewLinks = $(".overview-links");
    const strip = $(".strip");
    if (langSwitch) langSwitch.setAttribute("aria-label", dict.lang_switch_aria);
    if (overviewCard) overviewCard.setAttribute("aria-label", dict.overview_card_aria);
    if (overviewLink) {
      overviewLink.setAttribute("href", overviewAsset.gif);
      overviewLink.setAttribute("aria-label", dict.overview_primary_aria);
    }
    if (overviewPoster) {
      overviewPoster.setAttribute("src", overviewAsset.poster);
      overviewPoster.setAttribute("alt", dict.overview_poster_alt);
    }
    if (overviewLinks) overviewLinks.setAttribute("aria-label", dict.overview_links_aria);
    if (strip) strip.setAttribute("aria-label", dict.strip_aria);
    $$(".copy").forEach((btn) => {
      if (!btn.classList.contains("copied")) btn.textContent = COPY_LABELS[activeLang].ready;
    });
    $$("[data-lang-choice]").forEach((btn) => {
      const isActive = btn.dataset.langChoice === activeLang;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-pressed", String(isActive));
    });
    try { localStorage.setItem(LANG_KEY, activeLang); } catch {}
  }
  applyLanguage(preferredLanguage());
  $$("[data-lang-choice]").forEach((btn) => {
    btn.addEventListener("click", () => applyLanguage(btn.dataset.langChoice));
  });

  /* ---------- copy buttons (Clipboard API + execCommand fallback) ---------- */
  function legacyCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;opacity:0;pointer-events:none";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { ok = false; }
    ta.remove();
    return ok;
  }
  $$(".copy").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const text = btn.dataset.copy || "";
      let ok = false;
      try {
        await navigator.clipboard.writeText(text);
        ok = true;
      } catch {
        ok = legacyCopy(text);
      }
      btn.textContent = ok ? COPY_LABELS[activeLang].copied : COPY_LABELS[activeLang].failed;
      btn.classList.toggle("copied", ok);
      setTimeout(() => {
        btn.textContent = COPY_LABELS[activeLang].ready;
        btn.classList.remove("copied");
      }, 1500);
    });
  });

  /* ---------- smooth anchors ---------- */
  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const el = document.querySelector(a.getAttribute("href"));
      if (el) {
        e.preventDefault();
        el.scrollIntoView({ behavior: reduceMotion.matches ? "auto" : "smooth" });
      }
    });
  });

  /* ---------- works-with marquee: duplicate the row for a seamless loop ---------- */
  const stripRow = $("#stripRow");
  if (stripRow) {
    $$("span", stripRow).forEach((chip) => {
      const dup = chip.cloneNode(true);
      dup.setAttribute("data-dup", "");
      dup.setAttribute("aria-hidden", "true");
      stripRow.appendChild(dup);
    });
  }

  /* ---------- shared scroll-reveal observer ---------- */
  const revealIO = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (en.isIntersecting) {
        en.target.classList.add("in-view");
        revealIO.unobserve(en.target);
      }
    }
  }, { threshold: 0.25 });
  $$("[data-reveal], .cell").forEach((el) => revealIO.observe(el));

  /* ---------- workflow scrollytelling ---------- */
  const wfSteps = $$(".wf-step");
  const wfLabels = $$(".wf-label");
  const wfProgress = $("#wfProgress");
  if (wfSteps.length && wfLabels.length) {
    const setActive = (i) => {
      wfLabels.forEach((l, j) => l.classList.toggle("on", j === i));
      if (wfProgress) wfProgress.style.transform = `scaleY(${(i + 1) / wfSteps.length})`;
    };
    const wfIO = new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (en.isIntersecting) setActive(wfSteps.indexOf(en.target));
      }
    }, { threshold: 0.5 });
    wfSteps.forEach((s) => wfIO.observe(s));
    wfLabels.forEach((l) => {
      l.addEventListener("click", () => {
        const step = wfSteps[Number(l.dataset.wf)];
        if (step) step.scrollIntoView({ behavior: reduceMotion.matches ? "auto" : "smooth", block: "center" });
      });
    });
    setActive(0);
  }
})();
