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
      language_label: "Language",
      hero_ver: "MIT License · Node.js 20+ · zero dependencies",
      hero_title: "Generators create.<br><span class=\"em\">Nothing keeps track.</span>",
      hero_lede: "Character-consistent generation is a reference-image game — and today the bookkeeping is a spreadsheet and a folder of PNGs. image-arranger is the <strong>local-first layer that remembers</strong>: canonical references, adopted candidates, the prompt behind every image, and what's still queued. It <strong>doesn't generate</strong> — by design. It works with any generation service.",
      cta_run: "Run it locally — 30 seconds",
      cta_watch: "Watch the EN/JA GIF",
      cta_star: "★ Star on GitHub<span class=\"starcount\" id=\"starCount\" hidden></span>",
      cta_star_plain: "★ Star on GitHub",
      pill_local: "runs on 127.0.0.1 only",
      pill_files: "all data = plain JSON + files",
      pill_agent: "agent-ready request queue",
      hero_screen_url: "127.0.0.1:4217 — real sample workspace screen",
      real_app_screen: "Real app screen",
      overview_eyebrow: "2-minute overview",
      overview_open: "Open English GIF",
      overview_en: "English GIF",
      overview_ja: "日本語 GIF",
      overview_caption: "A visual walkthrough of the same prompt, source, image, and video organization flow. <span lang=\"ja\">日本語版GIFもあります。</span>",
      strip_any_service: "…any service with a UI",
      strip_agent: "any coding agent",
      screens_title: "Actual screens from the local app",
      screens_sub: "These are captured from the sample workspace running at <code>127.0.0.1:4217</code>: the real tabs, real candidate cards, real adopted state, and the real gallery.",
      screens_base_bar: "Base — adopted canonical references",
      screens_base_caption: "Base keeps canonical character references organized by part.",
      screens_kit_caption: "Create kit starts from selected real references.",
      screens_gallery_caption: "Gallery shows the adopted image set.",
      workflow_title: "The tab order <em>is</em> the workflow",
      workflow_sub: "From one key visual to a consistent character across stills and video — every step feeds the next.",
      wf_nav_kit: "Create kit",
      wf_kit_label: "01 · CREATE KIT",
      wf_kit_title: "Identity sheet",
      wf_kit_body: "One-shot generate the character's canonical sheet from a reusable prompt template. Fix one part without rerolling everything: decompose into per-part references.",
      wf_kit_caption: "Actual Create kit tab",
      wf_base_label: "02 · BASE",
      wf_base_title: "Part references",
      wf_base_body: "Manage per-part reference entries (face, expression, outfit…) with candidates. Only approved ones get adopted.",
      wf_base_caption: "Actual Base tab",
      wf_image_label: "03 · IMAGE",
      wf_image_title: "One prompt, one output",
      wf_image_body: "Compose prompts that attach adopted images as source inputs. Improve or retry; adoption stays exclusive.",
      wf_image_caption: "Actual Image tab",
      wf_video_label: "04 · VIDEO",
      wf_video_title: "Frames for i2v",
      wf_video_body: "Point start/end frames at adopted images for image-to-video services like Vidu.",
      wf_video_caption: "Actual Video tab",
      wf_queue_label: "05 · QUEUE",
      wf_queue_title: "Requests as files",
      wf_queue_body: "Each request is a JSON file with prompt, references and output dir. Edit, cancel or complete from the UI — or hand the folder to an agent.",
      wf_queue_caption: "Actual Queue tab",
      features_title: "Why image-arranger?",
      features_sub: "The generators are great — the bookkeeping around them is not. This fixes the bookkeeping.",
      feature_local_title: "Local-first, zero dependencies",
      feature_local_body: "One Node.js file, no build step, no accounts. Your prompts and assets never leave your machine — everything lives in a workspace folder you choose, as plain JSON and files you can read, grep and version.",
      feature_adoption_title: "Adoption, not chaos",
      feature_adoption_body: "Every output is a candidate; you adopt the good ones. Adopted images become the canonical references for the next round — per part, per character — and source links always resolve to the <em>current</em> canonical at queue time.",
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
      language_label: "言語",
      hero_ver: "MIT License · Node.js 20+ · 依存パッケージなし",
      hero_title: "生成サービスは作る。<br><span class=\"em\">でも管理は残らない。</span>",
      hero_lede: "キャラクターの一貫性はリファレンス画像の管理で決まります。ところが現場では、スプレッドシートとPNGフォルダで追いかけがちです。image-arranger は <strong>ローカルで記憶する管理レイヤー</strong>です。正リファレンス、採用候補、各画像のプロンプト、未処理キューを整理します。設計上、<strong>生成はしません</strong>。どの生成サービスとも併用できます。",
      cta_run: "ローカルで起動 — 30秒",
      cta_watch: "日英GIFを見る",
      cta_star: "★ GitHubでStar<span class=\"starcount\" id=\"starCount\" hidden></span>",
      cta_star_plain: "★ GitHubでStar",
      pill_local: "127.0.0.1 だけで動作",
      pill_files: "データはJSON + ファイル",
      pill_agent: "エージェント対応キュー",
      hero_screen_url: "127.0.0.1:4217 — 実サンプルワークスペース画面",
      real_app_screen: "実アプリ画面",
      overview_eyebrow: "2分の概要",
      overview_open: "英語GIFを開く",
      overview_en: "英語 GIF",
      overview_ja: "日本語 GIF",
      overview_caption: "プロンプト、元画像、生成画像、動画素材を整理する流れを実画面ベースで紹介します。英語版GIFもあります。",
      strip_any_service: "UIがある生成サービスなら併用可能",
      strip_agent: "任意のコーディングエージェント",
      screens_title: "ローカルアプリの実画面",
      screens_sub: "<code>127.0.0.1:4217</code> で動くサンプルワークスペースから撮影した画面です。実タブ、候補カード、採用状態、ギャラリーをそのまま使っています。",
      screens_base_bar: "Base — 採用済みの正リファレンス",
      screens_base_caption: "Base はキャラクターの正リファレンスをパーツごとに整理します。",
      screens_kit_caption: "Create kit は選択した実リファレンスから始まります。",
      screens_gallery_caption: "Gallery は採用済み画像セットを一覧できます。",
      workflow_title: "タブの順番が、そのままワークフロー",
      workflow_sub: "1枚のキー画像から、静止画と動画で一貫したキャラクターへ。各ステップが次のステップにつながります。",
      wf_nav_kit: "Create kit",
      wf_kit_label: "01 · CREATE KIT",
      wf_kit_title: "正リファレンスシート",
      wf_kit_body: "再利用できるプロンプトテンプレートから、キャラクターの正となるシートを作ります。全部を引き直さず、直したい部分だけをパーツ単位のリファレンスに分解できます。",
      wf_kit_caption: "実際の Create kit タブ",
      wf_base_label: "02 · BASE",
      wf_base_title: "パーツ別リファレンス",
      wf_base_body: "顔、表情、衣装などのリファレンスを候補として管理します。承認したものだけが採用状態になります。",
      wf_base_caption: "実際の Base タブ",
      wf_image_label: "03 · IMAGE",
      wf_image_title: "1プロンプト、1アウトプット",
      wf_image_body: "採用済み画像を元画像として添付しながらプロンプトを組みます。改善や再試行をしても、採用状態は常に明確です。",
      wf_image_caption: "実際の Image タブ",
      wf_video_label: "04 · VIDEO",
      wf_video_title: "i2v 用フレーム",
      wf_video_body: "Vidu のような image-to-video サービスに渡す start/end フレームを、採用済み画像から指定できます。",
      wf_video_caption: "実際の Video タブ",
      wf_queue_label: "05 · QUEUE",
      wf_queue_title: "依頼はファイル",
      wf_queue_body: "各依頼は、プロンプト、参照画像、出力先を持つJSONファイルです。UIから編集・キャンセル・完了でき、フォルダごとエージェントにも渡せます。",
      wf_queue_caption: "実際の Queue タブ",
      features_title: "なぜ image-arranger なのか",
      features_sub: "生成サービスは強力ですが、その周辺の管理は弱いままです。image-arranger はそこを補います。",
      feature_local_title: "ローカルファースト、依存なし",
      feature_local_body: "Node.js ファイル1つで、ビルドもアカウントも不要です。プロンプトと素材はあなたのマシンから出ません。選んだワークスペース内に、読めて検索できてバージョン管理できるJSONとファイルとして残ります。",
      feature_adoption_title: "候補を採用して、混乱させない",
      feature_adoption_body: "すべての出力は候補です。良いものだけを採用します。採用済み画像は、次の生成で使う正リファレンスになります。パーツ別、キャラクター別に管理でき、キュー作成時には常に<em>最新の正</em>へ解決されます。",
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
  $$("[data-reveal], .cell, .ba-panel.after").forEach((el) => revealIO.observe(el));

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

  /* ---------- self-playing hero demo loop (~12s, exactly loopable) ---------- */
  const mock = $("#demoMock");
  if (!mock) return;
  // Reduced motion keeps the static data-step="1" frame, but the loop wiring
  // below still attaches so an RM-on → off flip mid-session starts the demo.

  const body = $("#demoBody");
  const pill = $("#demoPill");
  const cursor = $("#demoCursor");
  const typed = $("#demoTyped");
  const tabBase = $("#demoTabBase");
  const tabImage = $("#demoTabImage");
  const tabQueue = $("#demoTabQueue");
  const PROMPT = "full body, red dress, soft studio light";
  const STEP_MS = [1500, 1900, 1500, 2900, 2200, 2000]; // ≈ 12s total
  let stepTimer = 0;
  let typeTimer = 0;
  let running = false;

  function placePill(tab) {
    pill.style.width = tab.offsetWidth + "px";
    pill.style.transform = `translateX(${tab.offsetLeft}px)`;
  }
  function moveCursorTo(el, dx, dy) {
    const r = el.getBoundingClientRect();
    const b = body.getBoundingClientRect();
    const x = r.left - b.left + r.width / 2 + (dx || 0) - 7;
    const y = r.top - b.top + r.height / 2 + (dy || 0) - 7;
    cursor.style.transform = `translate(${x}px, ${y}px)`;
  }
  function typewriter() {
    clearInterval(typeTimer);
    let i = 0;
    typed.textContent = "";
    typeTimer = setInterval(() => {
      i += 1;
      typed.textContent = PROMPT.slice(0, i);
      if (i >= PROMPT.length) clearInterval(typeTimer);
    }, Math.floor(2100 / PROMPT.length));
  }
  function flyCardToQueue() {
    const src = $(".card.c3 .ph", mock);
    if (!src || typeof src.animate !== "function") return;
    const from = src.getBoundingClientRect();
    const to = tabQueue.getBoundingClientRect();
    const clone = src.cloneNode(false);
    clone.innerHTML = "";
    clone.className = "fly-card";
    clone.style.cssText += `;left:${from.left}px;top:${from.top}px;width:${from.width}px;height:${from.height}px;` +
      `background:linear-gradient(140deg,#b8e8f7,#b8f7d8);box-shadow:0 10px 28px rgba(155,125,255,.3)`;
    document.body.appendChild(clone);
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    clone.animate(
      [
        { transform: "translate(0,0) scale(1)", opacity: 0.95 },
        { transform: `translate(${dx}px, ${dy}px) scale(.15)`, opacity: 0.2 }
      ],
      { duration: 450, easing: "cubic-bezier(.3,.8,.4,1)", fill: "forwards" }
    ).finished.then(() => clone.remove()).catch(() => clone.remove());
  }
  function applyStep(n) {
    mock.dataset.step = String(n);
    const onImage = n >= 2;
    tabBase.classList.toggle("on", !onImage);
    tabImage.classList.toggle("on", onImage);
    placePill(onImage ? tabImage : tabBase);
    if (n === 0) { typed.textContent = ""; moveCursorTo(body, -200, 80); }
    if (n === 1) moveCursorTo($(".card.c1 .badge.adopted", mock), 0, 0);
    if (n === 2) moveCursorTo(tabImage, 0, 0);
    if (n === 3) { moveCursorTo($(".json", mock), -80, 0); typewriter(); }
    if (n === 4) { moveCursorTo($(".card.c3 .ph", mock), 0, 0); flyCardToQueue(); }
  }
  function runStep(n) {
    if (n === 0 && mock.dataset.step === "5") {
      // soft crossfade back to the start state (loop ends where it began)
      if (typeof body.animate === "function") {
        body.animate([{ opacity: 1 }, { opacity: 0.25, offset: 0.5 }, { opacity: 1 }], { duration: 500, easing: "ease-in-out" });
      }
      setTimeout(() => applyStep(0), 240);
    } else {
      applyStep(n);
    }
    stepTimer = setTimeout(() => { if (running) runStep((n + 1) % STEP_MS.length); }, STEP_MS[n]);
  }
  function start() {
    if (running) return;
    running = true;
    mock.classList.add("live");
    runStep(0);
  }
  function stop() {
    running = false;
    clearTimeout(stepTimer);
    clearInterval(typeTimer);
  }
  // pause off-screen, restart (from a clean step 0) when visible again
  let mockInView = false;
  new IntersectionObserver((entries) => {
    for (const en of entries) {
      mockInView = en.isIntersecting;
      if (mockInView && !reduceMotion.matches) start();
      else stop();
    }
  }, { threshold: 0.2 }).observe(mock);
  addEventListener("resize", () => {
    if (running) placePill(mock.dataset.step >= "2" ? tabImage : tabBase);
  });
  // RM flipped on mid-session: stop and show the static frame.
  // RM flipped off: start the loop if the mock is on screen.
  reduceMotion.addEventListener?.("change", (e) => {
    if (e.matches) {
      stop();
      mock.classList.remove("live");
      mock.dataset.step = "1";
      typed.textContent = PROMPT;
      tabBase.classList.add("on");
      tabImage.classList.remove("on");
    } else if (mockInView) {
      start();
    }
  });
})();
