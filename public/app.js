const I18N = {
  ja: {
    title: "画像/動画プロンプト管理ツール",
    subtitle: "image-arranger",
    character: "素材パターン",
    mode: "モード",
    kit: "素材作成",
    base: "ベース",
    image: "画像",
    video: "動画",
    queue: "キュー",
    generate: "生成",
    analyze: "分析",
    kitIntro: "1枚のベース画像から、キャラクター一貫性のためのパーツ別ベース（顔・表情・角・翼・尻尾など）を作ります。画像分析はChatGPT等への依頼としてキューに登録され、返ってきたJSONを取り込むとベースが自動作成されます。",
    kitSource: "ベース画像を選ぶ（複数選択可）",
    kitSourceHelp: "採用済みの画像から選択します（複数可。全身用＋顔色用のように組み合わせると精度が上がります）。",
    kitPartsAuto: "どのパーツに分解するか（顔・表情・角・翼・尻尾など）は、AIが画像を分析して判断します。",
    kitCharName: "キャラクター名",
    kitAnalyze: "分析を依頼",
    kitAnalyzeQueued: "分析依頼を登録しました。下の「依頼文コピー」でエージェントに渡してください。",
    kitExtra: "追加で分けてほしい要素（任意）",
    kitExtraHelp: "基本はAIが判断します。「靴も別パーツに」「胸の紋章を分けて」など、追加の指定があれば書いてください。",
    kitPasteTitle: "分析結果の取り込み",
    kitPasteHelp: "ChatGPT等が返したJSON（```コードブロックのままでも可）を貼り付けて「内容を確認」を押してください。",
    kitResultsEmpty: "取り込み待ちの分析結果はありません（エージェントが完了報告すると、ここに表示されます）。",
    kitSelectParts: "パーツを選択して取り込む",
    kitSelectPartsTitle: "ベースにするパーツを選択",
    kitParse: "内容を確認",
    kitCreateSelected: "選択したパーツでベース作成",
    kitPickOne: "取り込むパーツを1つ以上選択してください",
    kitQueueAfter: "取り込んだパーツの画像生成をすぐキューに登録する",
    kitChip: "分解パーツ",
    noImage: "画像未生成",
    allLabel: "すべて",
    newEntryRefs: "参照する採用画像（任意・複数可）",
    newEntryRefsHelp: "選んだ画像はこのエントリの元画像（生成入力）として添付され、キュー登録時にAIへ渡されます。",
    kitNoAdopted: "採用済みの画像がありません。ベース／画像タブのカードで「採用」にチェックを入れると、ここに表示されます。",
    promptShown: "この画像を生成したプロンプト",
    promptNext: "プロンプト（次の生成用）",
    genImages: "生成画像（候補）",
    refRole: "元画像",
    sourceImages: "元画像（生成入力）",
    refImagesHelp: "この行を生成するときにAIへ添付される入力画像です。成果物（採用）の対象ではありません。",
    asReference: "元画像（生成入力）として登録",
    asReferenceHelp: "チェックすると生成時の入力（参照）として使われます。チェックしなければ生成画像（候補）として登録されます。",
    kitImported: "ベースを作成しました",
    kitImportedQueued: "ベースの先頭に追加し、画像生成をキューに登録しました",
    kitNoSource: "ベース画像を選択してください",
    copyAgentPrompt: "依頼文コピー",
    copiedAgentPrompt: "エージェント依頼文をコピーしました。Codex / Claude Code 等にそのまま貼り付けてください。",
    request: "キューに登録",
    requestOne: "キュー登録",
    addCharacter: "素材パターン追加",
    editCharacter: "素材パターン編集",
    deleteCharacter: "素材パターン削除",
    save: "保存",
    characterName: "キャラクター名",
    description: "説明",
    newEntry: "新規",
    addAsset: "素材追加",
    useBaseRefs: "ベース画像参照",
    useBaseRefsHelp: "ベース画像を参照して同じキャラクターとして生成",
    baseRefs: "ベース参照",
    baseAssets: "ベース採用画像",
    noAdoptedAsset: "採用画像なし",
    addCategory: "カテゴリ追加",
    categoryName: "カテゴリ名",
    filter: "概要で絞り込み",
    reload: "再読込",
    selectVisible: "表示中を選択",
    clearSelection: "選択解除",
    prompt: "PROMPT",
    finalPrompt: "送信プロンプト",
    copy: "コピー",
    copied: "コピー済み",
    idle: "未依頼",
    requested: "キュー登録済み",
    done: "処理済み",
    error: "エラー",
    adopted: "採用",
    start: "始まり画像",
    end: "終わり画像",
    output: "出力予定",
    requestFile: "依頼ファイル",
    requestedAt: "登録日時",
    target: "対象",
    action: "種類",
    sourceFile: "元ファイル",
    required: "必須",
    assetName: "素材名",
    sourceLicense: "素材ライセンス/利用根拠",
    assetFormIntro: "生成済み画像ファイルを候補素材として登録します。",
    sourceFileHelp: "ChatGPT などで作成済みの画像ファイルのパスを指定します。",
    assetNameHelp: "一覧に表示する短い名前です。空欄ならファイル名を使います。",
    sourceLicenseHelp: "生成サービス名、利用条件、または自作であることを残します。",
    usageNotesHelp: "使いどころ、修正待ち、採用理由などを短く記録します。",
    adoptHelp: "チェックすると、この候補を参照画像やゲーム素材として採用扱いにします。",
    aiGenerated: "AI生成素材",
    humanReviewed: "人が確認済み",
    usageNotes: "利用メモ",
    category: "カテゴリ",
    create: "作成",
    cancel: "キャンセル",
    cancelRequest: "依頼取消",
    improve: "改善",
    improveSelected: "改善対象",
    improvePrompt: "改善指示",
    editImprovePrompt: "この画像を改善",
    saveImprovePrompt: "改善指示を保存",
    queueImprove: "改善を登録",
    duplicate: "複製",
    delete: "削除",
    deleteAsset: "素材を削除",
    deleteQueuedConfirm: "関連する依頼中キューを取り消してから削除します。よろしいですか。",
    deleteCharacterConfirm: "このキャラクターを削除します。元に戻せません。",
    lastCharacter: "最後のキャラクターは削除できません",
    close: "閉じる",
    deleteConfirm: "この項目を削除します。元に戻せません。",
    adopt: "採用",
    copyBase: "現在のベース設定をコピー",
    noRows: "表示する行がありません",
    noQueue: "依頼中のキューはありません",
    queueDetails: "内容",
    queuePrompt: "依頼プロンプト",
    refImages: "参照画像",
    saveQueue: "キュー内容を保存",
    requestOnlyTarget: "元データが見つからないため、この依頼ファイルだけを更新します。",
    queueUpdated: "キュー内容を保存しました",
    requestDone: "キューへ登録しました。依頼中のものを処理してください。",
    cancelDone: "依頼をキャンセルしました",
    cancelAll: "表示中をすべて取消",
    assetAdded: "素材候補を追加しました",
    characterAdded: "キャラクターを追加しました",
    characterUpdated: "キャラクターを更新しました",
    characterDeleted: "キャラクターを削除しました",
    batchImproveTitle: "改善指示を入力",
    commonImprovePrompt: "共通の改善指示",
    applyCommonImprove: "共通指示で登録",
    editIndividually: "個別に調整",
    batchImproveNote: "共通指示でまとめて登録できます。個別に調整する場合は素材カードを開いてください。",
  },
  en: {
    title: "Image / Video Prompt Manager",
    subtitle: "image-arranger",
    character: "Asset pattern",
    mode: "Mode",
    kit: "Create kit",
    base: "Base",
    image: "Image",
    video: "Video",
    queue: "Queue",
    generate: "Generate",
    analyze: "Analyze",
    kitIntro: "Build per-part character bases (face, expressions, horns, wings, tail...) from one key image. The analysis is queued as a request for ChatGPT or another service; paste the returned JSON to create the base entries automatically.",
    kitSource: "Pick source images (multi-select)",
    kitSourceHelp: "Choose adopted images (multiple allowed — e.g. one for structure plus one for face/color detail).",
    kitPartsAuto: "The AI decides which parts to extract (face, expressions, horns, wings, tail...) by analyzing the image.",
    kitCharName: "Character name",
    kitAnalyze: "Request analysis",
    kitAnalyzeQueued: "Analysis request queued. Use 'Copy agent prompt' below to hand it off.",
    kitExtra: "Extra elements to split out (optional)",
    kitExtraHelp: "The AI decides by default. Add requests like 'split the shoes' or 'separate the chest emblem' if needed.",
    kitPasteTitle: "Import analysis result",
    kitPasteHelp: "Paste the JSON returned by ChatGPT (a fenced ``` code block is fine) and press 'Review'.",
    kitResultsEmpty: "No analysis results waiting for import (agent completions appear here).",
    kitSelectParts: "Select parts to import",
    kitSelectPartsTitle: "Choose the parts to create as bases",
    kitParse: "Review",
    kitCreateSelected: "Create bases from selected parts",
    kitPickOne: "Select at least one part to import",
    kitQueueAfter: "Queue image generation for the imported parts right away",
    kitChip: "Kit part",
    noImage: "Not generated yet",
    allLabel: "All",
    newEntryRefs: "Adopted images to reference (optional, multiple)",
    newEntryRefsHelp: "Selected images are attached as source images (generation inputs) and sent to the AI when queued.",
    kitNoAdopted: "No adopted images yet. Check 'Adopt' on cards in the Base / Image tabs to make them selectable here.",
    promptShown: "Prompt that generated this image",
    promptNext: "Prompt (for the next generation)",
    genImages: "Generated candidates",
    refRole: "Source",
    sourceImages: "Source images (generation input)",
    refImagesHelp: "Input images attached to the AI when generating this row. Not adoption candidates.",
    asReference: "Register as source image (generation input)",
    asReferenceHelp: "Checked: used as generation input. Unchecked: registered as a generated candidate.",
    kitImported: "Base entries created",
    kitImportedQueued: "Added to the top of Base and queued image generation",
    kitNoSource: "Select a source image first",
    copyAgentPrompt: "Copy agent prompt",
    copiedAgentPrompt: "Agent prompt copied. Paste it into Codex / Claude Code or another agent.",
    request: "Queue selected",
    requestOne: "Queue row",
    addCharacter: "Add asset pattern",
    editCharacter: "Edit asset pattern",
    deleteCharacter: "Delete asset pattern",
    save: "Save",
    characterName: "Character name",
    description: "Description",
    newEntry: "New",
    addAsset: "Add asset",
    useBaseRefs: "Base image reference",
    useBaseRefsHelp: "Use base images to generate the same character",
    baseRefs: "Base references",
    baseAssets: "Adopted base images",
    noAdoptedAsset: "No adopted image",
    addCategory: "Add category",
    categoryName: "Category name",
    filter: "Filter by title",
    reload: "Reload",
    selectVisible: "Select visible",
    clearSelection: "Clear selection",
    prompt: "PROMPT",
    finalPrompt: "Final prompt",
    copy: "Copy",
    copied: "Copied",
    idle: "Not requested",
    requested: "Queued",
    done: "Processed",
    error: "Error",
    adopted: "Adopted",
    start: "Start frame",
    end: "End frame",
    output: "Output draft",
    requestFile: "Request file",
    requestedAt: "Queued at",
    target: "Target",
    action: "Action",
    sourceFile: "Source file",
    required: "Required",
    assetName: "Asset name",
    sourceLicense: "Source license / usage basis",
    assetFormIntro: "Register an existing generated image file as an asset candidate.",
    sourceFileHelp: "Path to an image file already generated with ChatGPT or another service.",
    assetNameHelp: "Short display name. Leave blank to use the file name.",
    sourceLicenseHelp: "Record the service, usage terms, or user-owned source.",
    usageNotesHelp: "Short notes such as use case, pending fixes, or adoption reason.",
    adoptHelp: "Mark this candidate as adopted for reference images or game assets.",
    aiGenerated: "AI generated",
    humanReviewed: "Human reviewed",
    usageNotes: "Usage notes",
    category: "Category",
    create: "Create",
    cancel: "Cancel",
    cancelRequest: "Cancel request",
    improve: "Improve",
    improveSelected: "Improve",
    improvePrompt: "Improvement instructions",
    editImprovePrompt: "Improve this image",
    saveImprovePrompt: "Save instructions",
    queueImprove: "Queue improvement",
    duplicate: "Duplicate",
    delete: "Delete",
    deleteAsset: "Delete asset",
    deleteQueuedConfirm: "This will cancel related queued targets before deleting. Continue?",
    deleteCharacterConfirm: "Delete this character? This cannot be undone.",
    lastCharacter: "The last character cannot be deleted",
    close: "Close",
    deleteConfirm: "Delete this item? This cannot be undone.",
    adopt: "Adopt",
    copyBase: "Copy current base settings",
    noRows: "No rows",
    noQueue: "No queued requests",
    queueDetails: "Details",
    queuePrompt: "Request prompt",
    refImages: "Reference images",
    saveQueue: "Save queue details",
    requestOnlyTarget: "The source deck target was not found, so only this request file will be updated.",
    queueUpdated: "Queue details were saved",
    requestDone: "Queued. Process the pending requests next.",
    cancelDone: "Request was cancelled",
    cancelAll: "Cancel all visible",
    assetAdded: "Asset candidate was added",
    characterAdded: "Character was added",
    characterUpdated: "Character was updated",
    characterDeleted: "Character was deleted",
    batchImproveTitle: "Add improvement instructions",
    commonImprovePrompt: "Shared improvement instructions",
    applyCommonImprove: "Queue with shared instructions",
    editIndividually: "Edit individually",
    batchImproveNote: "Add shared instructions here, or open each asset card to edit individually.",
  },
};

const CAT_LABEL = {
  master: { ja: "マスター", en: "Master" },
  accessory: { ja: "付属物", en: "Accessory" },
  expression: { ja: "表情", en: "Expression" },
  clothing: { ja: "衣装", en: "Clothing" },
  background: { ja: "背景", en: "Background" },
};

const MATERIAL_CATEGORY_LABELS = {
  expression: { ja: "場面/用途", en: "Scene / Use" },
  clothing: { ja: "形式", en: "Format" },
};

const state = {
  deck: null,
  mode: "image",
  lang: "ja",
  characterId: "",
  filter: "",
  expanded: new Set(),
  form: null,
  requests: [],
  toastTimer: null,
  kit: { sources: [], characterName: "", extra: "", json: "", preview: null },
  kitPresets: [],
  kitResults: [],
  projectRoot: "",
};

const $ = (selector) => document.querySelector(selector);
const t = (key) => I18N[state.lang]?.[key] ?? I18N.ja[key] ?? key;
const catText = (key, ch = character()) => {
  const custom = ch?.categoryLabels?.[key];
  return custom?.[state.lang] ?? custom?.ja ?? CAT_LABEL[key]?.[state.lang] ?? key;
};
const assetUrl = (file) => `/asset?path=${encodeURIComponent(file)}`;

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(state.lang === "ja" ? "ja-JP" : "en-US", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
  }[char]));
}

function slug(value, fallback = "item") {
  return String(value ?? "")
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_.]+|[-_.]+$/g, "")
    .slice(0, 72) || fallback;
}

function makeUniqueId(existingIds, prefix) {
  let index = 1;
  let id = prefix;
  while (existingIds.has(id)) {
    index += 1;
    id = `${prefix}-${index}`;
  }
  return id;
}

function entryIds(ch = character()) {
  return new Set([...allBaseEntries(ch), ...ch.images, ...ch.videos].map((entry) => entry.id));
}

function categoryKeys(ch = character()) {
  return Object.keys(ch.base ?? {});
}

function isMultiRefCategory(category, ch = character()) {
  return category !== "master";
}

function defaultBaseRefs(ch = character()) {
  const find = (category) => ch.base?.[category]?.[0]?.id ?? "";
  const findList = (category) => find(category) ? [find(category)] : [];
  const refs = {};
  for (const category of categoryKeys(ch)) {
    refs[category] = isMultiRefCategory(category, ch) ? findList(category) : find(category);
  }
  return refs;
}

function refIdsFor(category, refs, ch = character()) {
  const value = refs?.[category];
  if (isMultiRefCategory(category, ch)) {
    if (Array.isArray(value)) return value.filter(Boolean);
    return value ? [value] : [];
  }
  if (Array.isArray(value)) return value[0] ? [value[0]] : [];
  return value ? [value] : [];
}

function normalizeEntryRefs(ch, refs = {}) {
  const normalized = {
    ...defaultBaseRefs(ch),
    ...refs,
  };
  for (const category of categoryKeys(ch)) {
    if (isMultiRefCategory(category, ch)) {
      normalized[category] = refIdsFor(category, normalized, ch);
    } else {
      normalized[category] = refIdsFor(category, normalized, ch)[0] ?? "";
    }
  }
  return normalized;
}

function defaultCategoryLabels(ch) {
  return ch.workflow === "material" ? structuredClone(MATERIAL_CATEGORY_LABELS) : {};
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  if (!response.ok) {
    let message = response.statusText || "Request failed";
    try {
      const payload = await response.json();
      message = payload.error || message;
    } catch {
      message = await response.text() || message;
    }
    throw new Error(`${response.status} ${message}`);
  }
  return response.json();
}

async function loadDeck() {
  const [deck, queuePayload, kitPresets, kitResults] = await Promise.all([
    api("/api/state"),
    api("/api/requests").catch(() => ({ requests: [] })),
    api("/api/base-kit/presets").catch(() => ({ parts: [] })),
    api("/api/base-kit/results").catch(() => ({ kitResults: [] })),
  ]);
  state.deck = deck;
  state.requests = queuePayload.requests ?? [];
  state.projectRoot = queuePayload.projectRoot ?? state.projectRoot ?? "";
  state.kitPresets = kitPresets.parts ?? [];
  state.kitResults = kitResults.kitResults ?? [];
  normalizeDeck();
  state.lang = state.deck.settings?.lang ?? state.lang;
  state.mode = state.deck.settings?.mode ?? state.mode;
  state.characterId = state.deck.settings?.currentCharacterId ?? state.deck.characters?.[0]?.id ?? "";
  render();
}

async function loadQueue(showMessage = true) {
  const payload = await api("/api/requests");
  state.requests = payload.requests ?? [];
  state.projectRoot = payload.projectRoot ?? state.projectRoot ?? "";
  const resultsPayload = await api("/api/base-kit/results").catch(() => null);
  if (resultsPayload) state.kitResults = resultsPayload.kitResults ?? [];
  if (showMessage) render();
}

function normalizeDeck() {
  for (const ch of state.deck?.characters ?? []) {
    const legacyWorkflow = ch.workflow;
    ch.categoryLabels = {
      ...defaultCategoryLabels(ch),
      ...(ch.categoryLabels ?? {}),
    };
    ch.base = ch.base ?? {};
    for (const category of Object.keys(CAT_LABEL)) {
      ch.base[category] = ch.base[category] ?? [];
    }
    for (const category of Object.keys(ch.categoryLabels ?? {})) {
      ch.base[category] = ch.base[category] ?? [];
    }
    ch.images = ch.images ?? [];
    ch.videos = ch.videos ?? [];
    for (const entry of ch.images) {
      if (typeof entry.useBaseRefs !== "boolean") {
        entry.useBaseRefs = legacyWorkflow === "character";
      }
      entry.refs = normalizeEntryRefs(ch, entry.refs);
    }
    for (const entry of [...allBaseEntries(ch), ...ch.images, ...ch.videos]) {
      for (const asset of entry.assets ?? []) {
        asset.sourceLicense = asset.sourceLicense ?? "";
        asset.aiGenerated = typeof asset.aiGenerated === "boolean" ? asset.aiGenerated : false;
        asset.humanReviewed = typeof asset.humanReviewed === "boolean" ? asset.humanReviewed : false;
        asset.usageNotes = asset.usageNotes ?? "";
        asset.requestStatus = asset.requestStatus ?? "idle";
        asset.improveChecked = Boolean(asset.improveChecked);
        asset.improvementPrompt = asset.improvementPrompt ?? "";
      }
    }
  }
}

async function saveDeck(showMessage = true) {
  state.deck.settings = {
    ...(state.deck.settings ?? {}),
    lang: state.lang,
    mode: state.mode,
    currentCharacterId: state.characterId,
  };
  const result = await api("/api/state", {
    method: "PUT",
    body: JSON.stringify(state.deck),
  });
  state.deck = result.state;
  if (showMessage) toast("saved");
}

function character() {
  return state.deck.characters.find((item) => item.id === state.characterId) ?? state.deck.characters[0];
}

function allBaseEntries(ch = character()) {
  return Object.values(ch.base ?? {}).flatMap((items) => items ?? []);
}

function baseById(id) {
  return allBaseEntries().find((entry) => entry.id === id);
}

function allImageAssets() {
  const ch = character();
  const imageAssets = ch.images.flatMap((entry) => (entry.assets ?? []).map((asset) => ({ ...asset, entry })));
  if (!ch.images.some((entry) => entry.useBaseRefs)) return imageAssets;
  const baseAssets = allBaseEntries(ch)
    .flatMap((entry) => adoptedAssets(entry).map((asset) => ({ ...asset, entry })));
  return [...baseAssets, ...imageAssets];
}

function adoptedImagePool(ch = character()) {
  const pool = [];
  for (const entry of allBaseEntries(ch)) {
    for (const asset of (entry.assets ?? [])) {
      if (asset.adopted && asset.file && !isSourceRef(asset)) pool.push({ asset, entry, origin: "base" });
    }
  }
  for (const entry of ch.images ?? []) {
    for (const asset of (entry.assets ?? [])) {
      if (asset.adopted && asset.file && !isSourceRef(asset)) pool.push({ asset, entry, origin: "image" });
    }
  }
  return pool;
}

function adoptedAssets(entry) {
  // 採用＝生成画像（出力）にだけ適用される概念。参照画像（入力）は含めない
  return (entry.assets ?? []).filter((asset) => asset.adopted && !isSourceRef(asset));
}

function referenceAssets(entry) {
  return (entry.assets ?? []).filter((asset) => isSourceRef(asset) && asset.file);
}

function selectedBaseEntryRefs(entry) {
  const refs = entry.refs ?? {};
  return categoryKeys()
    .flatMap((category) => refIdsFor(category, refs))
    .filter(Boolean)
    .map((id) => baseById(id))
    .filter(Boolean);
}

function selectedBaseAssets(entry) {
  return selectedBaseEntryRefs(entry)
    .flatMap((baseEntry) => adoptedAssets(baseEntry).map((asset) => ({ ...asset, entry: baseEntry })))
    .filter((asset) => asset.file);
}

function selectedRows() {
  const ch = character();
  if (state.mode === "queue" || state.mode === "kit") return [];
  if (state.mode === "base") {
    return allBaseEntries(ch).filter((entry) => entry.checked && entry.requestStatus !== "requested");
  }
  return (state.mode === "video" ? ch.videos : ch.images).filter((entry) => entry.checked && entry.requestStatus !== "requested");
}

function selectedImproveAssets() {
  if (state.mode === "queue") return [];
  return modeRows()
    .flatMap((entry) => (entry.assets ?? []).map((asset) => ({ entry, asset })))
    .filter(({ asset }) => asset.improveChecked && asset.requestStatus !== "requested");
}

function modeRows(ch = character()) {
  if (state.mode === "queue" || state.mode === "kit") return [];
  if (state.mode === "base") return allBaseEntries(ch);
  return state.mode === "video" ? ch.videos : ch.images;
}

function visibleRows() {
  const filter = state.filter.toLowerCase();
  return modeRows().filter((entry) => !filter || entry.overview.toLowerCase().includes(filter));
}

function composedPrompt(entry) {
  if (state.mode !== "image" || !entry.useBaseRefs) return entry.prompt ?? "";
  const refs = entry.refs ?? {};
  const ch = character();
  const parts = [
    ...categoryKeys(ch).flatMap((category) => refIdsFor(category, refs, ch).map((id) => baseById(id)?.prompt)),
    entry.prompt,
  ].filter((part) => String(part ?? "").trim());
  return parts.join(", ");
}

function statusClass(entry) {
  return entry.requestStatus || "idle";
}

function statusBadge(entry) {
  const status = statusClass(entry);
  if (status === "idle") return "";
  return `<span class="badge ${status}">${t(status)}</span>`;
}

function assetCard(asset, entry) {
  const adopted = asset.adopted ? " adopted" : "";
  const requested = asset.requestStatus === "requested";
  const image = asset.file
    ? `<img src="${assetUrl(asset.file)}" alt="${escapeHtml(asset.name)}" loading="lazy">`
    : `<span>${asset.kind === "video" ? "VIDEO" : "NO FILE"}</span>`;
  return `
    <div class="asset${adopted}" data-asset-id="${escapeHtml(asset.id)}" data-entry-id="${escapeHtml(entry.id)}">
      ${asset.adopted ? `<div class="asset-tag">${t("adopted")}</div>` : ""}
      ${requested ? `<div class="asset-tag is-requested">${t("requested")}</div>` : ""}
      <div class="thumb">${image}</div>
      <div class="asset-name">${escapeHtml(asset.name ?? asset.file ?? asset.id)}</div>
      <label class="asset-adopt">
        <input type="checkbox" data-adopt-asset="${escapeHtml(asset.id)}" data-adopt-entry="${escapeHtml(entry.id)}" ${asset.adopted ? "checked" : ""}>
        ${t("adopt")}
      </label>
      ${requested ? `
        <button class="asset-action" data-cancel-asset="${escapeHtml(asset.id)}" data-cancel-entry="${escapeHtml(entry.id)}">${t("cancelRequest")}</button>
      ` : `
        <label class="asset-improve">
          <input type="checkbox" data-improve-asset="${escapeHtml(asset.id)}" data-improve-entry="${escapeHtml(entry.id)}" ${asset.improveChecked ? "checked" : ""}>
          ${t("improveSelected")}
        </label>
        <button class="asset-action secondary" data-edit-improve-asset="${escapeHtml(asset.id)}" data-edit-improve-entry="${escapeHtml(entry.id)}">${t("editImprovePrompt")}</button>
      `}
    </div>
  `;
}

function promptBlock(entry) {
  const key = `${state.mode}:${entry.id}`;
  const opened = state.expanded.has(key);
  const prompt = state.mode === "image" ? composedPrompt(entry) : (entry.prompt ?? "");
  return `
    <button class="prompt-toggle" data-toggle="${escapeHtml(key)}">
      <strong>${t("prompt")}</strong>
      <span class="prompt-preview">${escapeHtml(prompt || "empty")}</span>
      <span>${opened ? "▲" : "▼"}</span>
    </button>
    ${opened ? `<textarea class="prompt" data-prompt-entry="${escapeHtml(entry.id)}">${escapeHtml(entry.prompt ?? "")}</textarea>` : ""}
  `;
}

function refThumb(baseEntry) {
  const adopted = adoptedAssets(baseEntry)[0];
  if (adopted?.file) {
    return `<span class="ref-thumb"><img src="${assetUrl(adopted.file)}" alt="${escapeHtml(adopted.name ?? baseEntry.overview)}" loading="lazy"></span>`;
  }
  return `<span class="ref-thumb empty-ref">＋</span>`;
}

function refChip(baseEntry, entry, category, selected, multi = false) {
  const noAsset = !adoptedAssets(baseEntry).some((asset) => asset.file);
  return `
    <button class="ref-chip ${selected ? "selected" : ""} ${noAsset ? "missing-asset" : ""}"
      data-ref-${multi ? "multi" : "single"}="${escapeHtml(entry.id)}"
      data-ref-category="${escapeHtml(category)}"
      data-ref-id="${escapeHtml(baseEntry.id)}"
      title="${escapeHtml(noAsset ? t("noAdoptedAsset") : baseEntry.overview)}">
      ${refThumb(baseEntry)}
      <span>${escapeHtml(baseEntry.overview || baseEntry.id)}</span>
      <strong>${selected ? "✓" : multi ? "+" : ""}</strong>
    </button>
  `;
}

function characterRefsBlock(entry) {
  const refs = normalizeEntryRefs(character(), entry.refs);
  entry.refs = refs;
  const ch = character();
  const refRow = (category) => `
    <div class="ref-row">
      <div class="ref-label">${catText(category)}</div>
      <div class="ref-options">
        ${(ch.base?.[category] ?? []).map((baseEntry) => refChip(
          baseEntry,
          entry,
          category,
          refIdsFor(category, refs, ch).includes(baseEntry.id),
          isMultiRefCategory(category, ch),
        )).join("")}
      </div>
    </div>
  `;
  return `
    <div class="base-ref-panel">
      <div class="base-ref-title">${t("baseRefs")} <span>${t("baseAssets")}</span></div>
      ${categoryKeys(ch).map(refRow).join("")}
    </div>
    <div class="compose">
      <div class="compose-head"><span>${t("finalPrompt")}</span><button class="ghost" data-copy-entry="${escapeHtml(entry.id)}">${t("copy")}</button></div>
      <div class="compose-text">${escapeHtml(composedPrompt(entry))}</div>
    </div>
  `;
}

function materialRefsBlock(entry) {
  return `
    <div class="compose">
      <div class="compose-head"><span>${t("finalPrompt")}</span><button class="ghost" data-copy-entry="${escapeHtml(entry.id)}">${t("copy")}</button></div>
      <div class="compose-text">${escapeHtml(composedPrompt(entry))}</div>
    </div>
  `;
}

function refsBlock(entry) {
  if (state.mode !== "image") return "";
  const toggle = `
    <label class="base-ref-toggle" title="${escapeHtml(t("useBaseRefsHelp"))}">
      <input type="checkbox" data-use-base-refs="${escapeHtml(entry.id)}" ${entry.useBaseRefs ? "checked" : ""}>
      <span>${t("useBaseRefs")}</span>
    </label>
  `;
  return `${toggle}${entry.useBaseRefs ? characterRefsBlock(entry) : materialRefsBlock(entry)}`;
}

function rowQueueButton(entry) {
  if (entry.requestStatus === "requested") {
    return `<button class="ghost small" data-cancel-entry-request="${escapeHtml(entry.id)}">${t("cancelRequest")}</button>`;
  }
  return `<button class="ghost small request-row" data-request-one="${escapeHtml(entry.id)}">${t("requestOne")}</button>`;
}

function duplicateButton(entry) {
  return `<button class="icon" data-dup="${escapeHtml(entry.id)}" title="${t("duplicate")}" aria-label="${t("duplicate")}"><i class="fa-solid fa-copy" aria-hidden="true"></i></button>`;
}

function deleteEntryButton(entry) {
  return `<button class="icon danger" data-delete="${escapeHtml(entry.id)}" title="${t("delete")}" aria-label="${t("delete")}"><i class="fa-solid fa-trash" aria-hidden="true"></i></button>`;
}

function isSourceRef(asset) {
  return (asset?.tags ?? []).includes("source-reference") || asset?.name === "source-reference";
}

function entryCard(entry) {
  const generated = (entry.assets ?? []).filter((asset) => !isSourceRef(asset));
  const main = generated.find((asset) => asset.adopted && asset.file) ?? generated.find((asset) => asset.file);
  const requested = entry.requestStatus === "requested";
  return `
    <div class="bcard ${entry.checked ? "selected" : ""}" data-open-entry="${escapeHtml(entry.id)}" title="${escapeHtml(entry.overview)}">
      ${main ? `<label class="bcard-check" title="${t("adopt")}">
        <input type="checkbox" data-adopt-card="${escapeHtml(entry.id)}" ${main.adopted ? "checked" : ""}>
      </label>` : ""}
      <div class="bcard-thumb">
        ${main ? `<img src="${assetUrl(main.file)}" alt="${escapeHtml(entry.overview)}" loading="lazy">` : `<span class="no-image">${t("noImage")}</span>`}
      </div>
      <div class="bcard-title">${escapeHtml(entry.overview)}</div>
      <div class="bcard-meta">${main?.adopted ? `<span class="kit-chip adopted-chip">${t("adopted")}</span>` : ""}${(entry.tags ?? []).includes("base-kit") ? `<span class="kit-chip">${t("kitChip")}</span>` : ""}${entry.useBaseRefs ? `<span class="kit-chip">${t("useBaseRefs")}</span>` : ""}${statusBadge(entry)}</div>
    </div>
  `;
}

function openEntryModal(entryId, shownAssetId = null) {
  const entry = findEntry(entryId);
  if (!entry) return;
  const isImage = (character().images ?? []).some((item) => item.id === entry.id);
  const sources = (entry.assets ?? []).filter(isSourceRef);
  const generated = (entry.assets ?? []).filter((asset) => !isSourceRef(asset));
  const shown = (entry.assets ?? []).find((asset) => asset.id === shownAssetId)
    ?? generated.find((asset) => asset.adopted && asset.file)
    ?? generated.find((asset) => asset.file)
    ?? sources.find((asset) => asset.file)
    ?? null;
  const requested = entry.requestStatus === "requested";
  const refresh = () => openEntryModal(entry.id, shown?.id ?? null);
  const thumb = (asset, role) => `
    <button class="emodal-thumb ${shown && shown.id === asset.id ? "shown" : ""}" data-show-asset="${escapeHtml(asset.id)}" title="${escapeHtml(asset.name ?? asset.id)}">
      ${asset.file ? `<img src="${assetUrl(asset.file)}" alt="" loading="lazy">` : "—"}
      ${role === "src" ? `<span class="emodal-thumb-tag">${t("refRole")}</span>` : asset.adopted ? `<span class="emodal-thumb-tag adopted">${t("adopted")}</span>` : ""}
    </button>`;
  $("#modal").innerHTML = `
    <button class="close" id="closeModal" title="${t("close")}" aria-label="${t("close")}">×</button>
    <div class="modal-card emodal">
      <div class="modal-media">
        ${shown?.file ? `<img src="${assetUrl(shown.file)}" alt="${escapeHtml(entry.overview)}">` : `<span class="emodal-empty">${t("noImage")}</span>`}
      </div>
      <div class="emodal-side">
        <div class="emodal-head">
          <input class="title-input" id="entryModalTitle" value="${escapeHtml(entry.overview)}">
          ${(entry.tags ?? []).includes("base-kit") ? `<span class="kit-chip">${t("kitChip")}</span>` : ""}
          ${statusBadge(entry)}
        </div>
        ${shown ? `
          <div class="emodal-shownbar">
            <span class="emodal-shown-name">${escapeHtml(shown.name ?? shown.id)}</span>
            ${isSourceRef(shown)
              ? `<span class="kit-chip">${t("refRole")}</span>`
              : `<label class="asset-adopt"><input type="checkbox" id="entryModalAdoptShown" ${shown.adopted ? "checked" : ""}> ${t("adopt")}</label>
                 <button class="ghost small" id="entryModalAssetDetail">${t("editImprovePrompt")}</button>`}
          </div>` : ""}
        ${shown && !isSourceRef(shown) ? `
        <label class="emodal-prompt">${t("promptShown")}
          <textarea id="entryModalAssetPrompt" rows="5">${escapeHtml(shown.prompt ?? "")}</textarea>
        </label>` : ""}
        <label class="emodal-prompt emodal-prompt-next">${t("promptNext")}
          <textarea id="entryModalPrompt" rows="${shown && !isSourceRef(shown) && (shown.prompt ?? "").trim() ? 3 : 6}">${escapeHtml(entry.prompt ?? "")}</textarea>
        </label>
        ${isImage ? `
          <label class="base-ref-toggle" title="${escapeHtml(t("useBaseRefsHelp"))}">
            <input type="checkbox" id="entryModalUseRefs" ${entry.useBaseRefs ? "checked" : ""}>
            <span>${t("useBaseRefs")}</span>
          </label>
          ${entry.useBaseRefs ? characterRefsBlock(entry) : ""}
        ` : ""}
        <h4>${t("genImages")}</h4>
        <div class="emodal-thumbs">${generated.length ? generated.map((asset) => thumb(asset, "gen")).join("") : `<p class="form-note">${t("noImage")}</p>`}</div>
        ${sources.length ? `<h4>${t("sourceImages")}</h4><p class="form-note">${t("refImagesHelp")}</p><div class="emodal-thumbs">${sources.map((asset) => thumb(asset, "src")).join("")}</div>` : ""}
        <div class="entry-modal-actions">
          <button class="ghost danger" id="entryModalDelete"><i class="fa-solid fa-trash" aria-hidden="true"></i> ${t("delete")}</button>
          <button class="ghost" id="entryModalDup">${t("duplicate")}</button>
          <button class="ghost" id="entryModalAddAsset">${t("addAsset")}</button>
          <button class="ghost" id="entryModalSave">${t("save")}</button>
          ${requested
            ? `<button class="primary" id="entryModalCancelReq">${t("cancelRequest")}</button>`
            : `<button class="primary" id="entryModalQueue">${t("requestOne")}</button>`}
        </div>
      </div>
    </div>`;
  $("#modal").classList.add("open");
  const closeModal = () => $("#modal").classList.remove("open");
  $("#closeModal").onclick = closeModal;
  $("#modal").onclick = (event) => { if (event.target.id === "modal") closeModal(); };
  const commitFields = () => {
    entry.overview = $("#entryModalTitle").value;
    entry.prompt = $("#entryModalPrompt").value;
    if (shown && !isSourceRef(shown) && $("#entryModalAssetPrompt")) {
      shown.prompt = $("#entryModalAssetPrompt").value;
    }
  };
  $("#entryModalSave").onclick = async () => {
    commitFields();
    await saveDeck(false);
    render();
    toast(t("save"));
  };
  $("#entryModalDelete").onclick = () => { closeModal(); deleteEntry(entry.id); };
  $("#entryModalDup").onclick = async () => {
    duplicateEntry(entry.id);
    closeModal();
    await saveDeck(false);
    render();
  };
  $("#entryModalAddAsset").onclick = () => { closeModal(); openAssetForm(entry.id); };
  if ($("#entryModalQueue")) {
    $("#entryModalQueue").onclick = async () => {
      commitFields();
      closeModal();
      await requestEntries([entry]);
    };
  }
  if ($("#entryModalCancelReq")) {
    $("#entryModalCancelReq").onclick = async () => {
      closeModal();
      await cancelTargets([{ action: "generate", entryId: entry.id }]);
    };
  }
  if ($("#entryModalAdoptShown")) {
    $("#entryModalAdoptShown").onchange = async () => {
      shown.adopted = $("#entryModalAdoptShown").checked;
      await saveDeck(false);
      render();
      refresh();
    };
  }
  if ($("#entryModalAssetDetail")) {
    $("#entryModalAssetDetail").onclick = () => openAsset(shown.id, entry.id);
  }
  if ($("#entryModalUseRefs")) {
    $("#entryModalUseRefs").onchange = async () => {
      commitFields();
      entry.useBaseRefs = $("#entryModalUseRefs").checked;
      entry.refs = normalizeEntryRefs(character(), entry.refs);
      await saveDeck(false);
      render();
      refresh();
    };
  }
  $("#modal").querySelectorAll("[data-show-asset]").forEach((button) => {
    button.onclick = () => openEntryModal(entry.id, button.dataset.showAsset);
  });
  $("#modal").querySelectorAll("[data-ref-single]").forEach((button) => {
    button.onclick = async () => {
      commitFields();
      entry.refs = normalizeEntryRefs(character(), entry.refs);
      entry.refs[button.dataset.refCategory] = button.dataset.refId;
      await saveDeck(false);
      render();
      refresh();
    };
  });
  $("#modal").querySelectorAll("[data-ref-multi]").forEach((button) => {
    button.onclick = async () => {
      commitFields();
      entry.refs = normalizeEntryRefs(character(), entry.refs);
      const category = button.dataset.refCategory;
      const current = new Set(refIdsFor(category, entry.refs));
      if (current.has(button.dataset.refId)) current.delete(button.dataset.refId);
      else current.add(button.dataset.refId);
      entry.refs[category] = [...current];
      await saveDeck(false);
      render();
      refresh();
    };
  });
  $("#modal").querySelectorAll("[data-copy-entry]").forEach((button) => {
    button.onclick = async () => {
      await navigator.clipboard.writeText(composedPrompt(entry));
      toast(t("copied"));
    };
  });
}

function frameCard(label, assetId) {
  const found = allImageAssets().find((asset) => asset.id === assetId);
  const image = found?.file ? `<img src="${assetUrl(found.file)}" alt="${escapeHtml(found.name)}" loading="lazy">` : "<span>missing</span>";
  return `<div class="frame-card"><div class="thumb">${image}</div><div class="label">${label}: ${escapeHtml(found?.name ?? assetId ?? "未設定")}</div></div>`;
}

function videoRow(entry) {
  return `
    <div class="row ${entry.checked ? "selected" : ""}" data-row-id="${escapeHtml(entry.id)}">
      <div class="row-top">
        <input class="check" type="checkbox" data-check="${escapeHtml(entry.id)}" ${entry.checked ? "checked" : ""} ${entry.requestStatus === "requested" ? "disabled" : ""}>
        <input class="title-input" data-title="${escapeHtml(entry.id)}" value="${escapeHtml(entry.overview)}">
        ${statusBadge(entry)}
        ${rowQueueButton(entry)}
        <button class="ghost small" data-add-asset="${escapeHtml(entry.id)}"><i class="fa-solid fa-plus" aria-hidden="true"></i> ${t("addAsset")}</button>
        ${duplicateButton(entry)}
        ${deleteEntryButton(entry)}
      </div>
      ${promptBlock(entry)}
      <div class="frame-pair">
        ${frameCard(t("start"), entry.startFrame)}
        ${frameCard(t("end"), entry.endFrame)}
        <div class="output"><strong>${t("output")}</strong><br>${escapeHtml(entry.outputDraft ?? "")}</div>
      </div>
      <div class="assets">${(entry.assets ?? []).map((asset) => assetCard(asset, entry)).join("")}</div>
    </div>
  `;
}

function renderBase() {
  const ch = character();
  const groups = Object.entries(ch.base ?? {}).map(([category, rows]) => {
    const filtered = rows.filter((entry) => !state.filter || entry.overview.toLowerCase().includes(state.filter.toLowerCase()));
    return `
      <div class="group">
        <div class="group-head">
          <div class="group-title">${catText(category)}</div>
          <button class="ghost small" data-add-base-category="${escapeHtml(category)}"><i class="fa-solid fa-plus" aria-hidden="true"></i> ${catText(category)}を追加</button>
        </div>
        ${filtered.length ? `<div class="bgrid">${filtered.map(entryCard).join("")}</div>` : `<div class="empty">${t("noRows")}</div>`}
      </div>
    `;
  }).join("");
  return groups;
}

function renderListToolbar() {
  if (state.mode === "queue") return "";
  return `
    <div class="list-toolbar">
      <button class="ghost" id="newEntryBtn"><i class="fa-solid fa-plus" aria-hidden="true"></i> ${t("newEntry")}</button>
      ${state.mode === "base" ? `<button class="ghost" id="addCategoryBtn"><i class="fa-solid fa-plus" aria-hidden="true"></i> ${t("addCategory")}</button>` : ""}
    </div>
  `;
}

function renderKit() {
  const ch = character();
  const kit = state.kit;
  const srcFilter = kit.srcFilter ?? "all";
  const pool = adoptedImagePool(ch)
    .filter((item) => item.asset.kind !== "video")
    .filter((item) => srcFilter === "all" || item.origin === srcFilter);
  return `
    <div class="kit">
      <p class="kit-intro">${t("kitIntro")}</p>
      <h3 class="kit-step">1. ${t("kitSource")}</h3>
      <p class="form-note">${t("kitSourceHelp")}</p>
      <div class="kit-filter">
        ${[["all", t("allLabel")], ["base", t("base")], ["image", t("image")]].map(([key, label]) => `
          <button class="kit-filter-chip ${srcFilter === key ? "active" : ""}" data-kit-filter="${key}">${label}</button>`).join("")}
      </div>
      <div class="kit-sources">
        ${pool.length ? pool.map(({ asset, entry, origin }) => `
          <button class="kit-source ${kit.sources.some((s) => s.assetId === asset.id) ? "selected" : ""}"
            data-kit-source-entry="${escapeHtml(entry.id)}"
            data-kit-source-asset="${escapeHtml(asset.id)}"
            title="${escapeHtml(`${asset.name ?? asset.id} / ${entry.overview}`)}">
            <span class="thumb"><img src="${assetUrl(asset.file)}" loading="lazy" alt="${escapeHtml(asset.name ?? asset.id)}"></span>
            <span class="kit-source-name">${escapeHtml(entry.overview || asset.name || asset.id)}</span>
            <span class="kit-source-origin">${origin === "base" ? t("base") : t("image")}</span>
          </button>`).join("") : `<p class="form-note">${t("kitNoAdopted")}</p>`}
      </div>
      <h3 class="kit-step">2. ${t("kitAnalyze")}</h3>
      <p class="form-note">${t("kitPartsAuto")}</p>
      <label class="kit-name">${t("kitCharName")}<input id="kitCharName" value="${escapeHtml(kit.characterName || ch.name)}"></label>
      <label class="kit-name kit-extra">${t("kitExtra")}<textarea id="kitExtra" rows="2" placeholder="${escapeHtml(t("kitExtraHelp"))}">${escapeHtml(kit.extra ?? "")}</textarea></label>
      <div class="kit-actions"><button class="primary" id="kitAnalyzeBtn">${t("kitAnalyze")}</button></div>
      ${(state.requests ?? []).filter((row) => row.action === "analyze" && row.characterId === ch.id).map((row) => `
        <div class="kit-result kit-pending">
          <span class="kit-result-info">
            <strong>${escapeHtml(row.overview || row.entryId)}</strong>
            <small>${t("requested")} ・ ${escapeHtml(formatDateTime(row.requestedAt))} ・ ${escapeHtml(row.requestId)}</small>
          </span>
          <span class="kit-actions">
            <button class="ghost small" data-copy-agent="${escapeHtml(row.requestId)}" data-target-index="${row.targetIndex}"><i class="fa-solid fa-robot" aria-hidden="true"></i> ${t("copyAgentPrompt")}</button>
            <button class="ghost small danger" data-cancel-queue="${escapeHtml(row.requestId)}" data-target-index="${row.targetIndex}">${t("cancelRequest")}</button>
          </span>
        </div>`).join("")}
      <h3 class="kit-step">3. ${t("kitPasteTitle")}</h3>
      ${(state.kitResults ?? []).length ? state.kitResults.map((result, index) => `
        <div class="kit-result">
          <span class="kit-result-info">
            <strong>${escapeHtml(result.characterName || result.characterId)}</strong>
            <small>${escapeHtml(result.sourceFile.split("/").pop() ?? "")} ・ ${escapeHtml(formatDateTime(result.completedAt))} ・ ${result.parts.length}パーツ</small>
          </span>
          <button class="ghost small" data-kit-result="${index}">${t("kitSelectParts")}</button>
        </div>`).join("") : `<p class="form-note">${t("kitResultsEmpty")}</p>`}
      <p class="form-note">${t("kitPasteHelp")}</p>
      <textarea id="kitJson" class="kit-json" rows="5" placeholder='{"parts":[{"key":"face-front","label":"顔アップ（正面）","category":"master","prompt":"..."}]}'>${escapeHtml(kit.json ?? "")}</textarea>
      <div class="kit-actions"><button class="ghost" id="kitParseBtn">${t("kitParse")}</button></div>
      ${kit.preview ? `
        <div class="kit-preview">
          <h4>${t("kitSelectPartsTitle")}（${kit.preview.parts.filter((row) => row.checked).length} / ${kit.preview.parts.length}）</h4>
          ${kit.preview.parts.map((row, index) => `
            <label class="kit-part-row ${row.checked ? "selected" : ""}">
              <input type="checkbox" data-kit-pick="${index}" ${row.checked ? "checked" : ""}>
              <span class="kit-part-label">${escapeHtml(row.part.label ?? row.part.key ?? "")}</span>
              <small>${escapeHtml(catText(row.part.category))}</small>
              <span class="kit-part-prompt">${escapeHtml(String(row.part.prompt ?? "").slice(0, 180))}</span>
            </label>`).join("")}
          <label class="kit-queue-after">
            <input type="checkbox" id="kitQueueAfter" ${kit.preview.queueAfter !== false ? "checked" : ""}>
            ${t("kitQueueAfter")}
          </label>
          <div class="kit-actions">
            <button class="primary" id="kitCreateBtn">${t("kitCreateSelected")}</button>
            <button class="ghost" id="kitPreviewCancel">${t("cancel")}</button>
          </div>
        </div>
      ` : ""}
    </div>
  `;
}

function renderRows() {
  if (state.mode === "queue") return renderQueue();
  if (state.mode === "kit") return renderKit();
  if (state.mode === "base") return `${renderListToolbar()}${renderBase()}`;
  const ch = character();
  const rows = state.mode === "video" ? ch.videos : ch.images;
  const filtered = rows.filter((entry) => !state.filter || entry.overview.toLowerCase().includes(state.filter.toLowerCase()));
  if (state.mode === "image") {
    return `
      ${renderListToolbar()}
      ${filtered.length ? `<div class="bgrid">${filtered.map(entryCard).join("")}</div>` : `<div class="empty">${t("noRows")}</div>`}
    `;
  }
  return `
    ${renderListToolbar()}
    ${filtered.length ? filtered.map(videoRow).join("") : `<div class="empty">${t("noRows")}</div>`}
  `;
}

function renderQueue() {
  const filter = state.filter.toLowerCase();
  const rows = (state.requests ?? []).filter((item) => {
    if (!filter) return true;
    return [item.overview, item.characterName, item.requestFile, item.action]
      .some((value) => String(value ?? "").toLowerCase().includes(filter));
  });
  if (!rows.length) return `<div class="empty">${t("noQueue")}</div>`;
  return `
    <div class="queue-list">
      ${rows.map((item) => {
        const key = `queue:${item.requestId}:${item.targetIndex}`;
        const opened = state.expanded.has(key);
        const refImages = item.inputs?.refImages ?? [];
        return `
          <div class="queue-card ${item.existsInDeck ? "" : "missing-target"}">
            <div class="queue-row">
              <button class="queue-main" data-toggle="${escapeHtml(key)}" title="${t("queueDetails")}">
                <strong>${escapeHtml(item.overview || item.entryId)}</strong>
                <span>${escapeHtml(item.characterName || item.characterId)} / ${escapeHtml(item.mode)} / ${escapeHtml(item.service)}</span>
              </button>
              <div class="queue-meta">
                <span class="chip">${t(item.action === "improve" ? "improve" : item.action === "analyze" ? "analyze" : "generate")}</span>
                <span class="chip">${t("requestedAt")}: ${escapeHtml(formatDateTime(item.requestedAt))}</span>
                <span class="queue-file" title="${escapeHtml(`${item.requestFile} / ${t("target")}: ${item.targetIndex}`)}">${escapeHtml(item.requestId)}</span>
              </div>
              <div class="queue-actions">
                <button class="ghost small" data-copy-agent="${escapeHtml(item.requestId)}" data-target-index="${item.targetIndex}"><i class="fa-solid fa-robot" aria-hidden="true"></i> ${t("copyAgentPrompt")}</button>
                <button class="ghost small" data-toggle="${escapeHtml(key)}">${opened ? "▲" : "▼"} ${t("queueDetails")}</button>
                <button class="ghost small danger" data-cancel-queue="${escapeHtml(item.requestId)}" data-target-index="${item.targetIndex}">${t("cancelRequest")}</button>
              </div>
            </div>
            ${opened ? `
              <div class="queue-detail">
                ${item.existsInDeck ? "" : `<p class="form-note">${t("requestOnlyTarget")}</p>`}
                <label>
                  ${t("queuePrompt")}
                  <textarea data-queue-prompt="${escapeHtml(item.requestId)}:${item.targetIndex}" rows="6">${escapeHtml(item.prompt ?? "")}</textarea>
                </label>
                ${item.action === "improve" ? `
                  <label>
                    ${t("improvePrompt")}
                    <textarea data-queue-improvement="${escapeHtml(item.requestId)}:${item.targetIndex}" rows="4">${escapeHtml(item.improvementPrompt ?? "")}</textarea>
                  </label>
                ` : ""}
                <label>
                  ${t("refImages")}
                  <textarea readonly rows="3">${escapeHtml(refImages.length ? refImages.join("\n") : "-")}</textarea>
                </label>
                <div class="queue-detail-actions">
                  <button class="primary small" data-save-queue="${escapeHtml(item.requestId)}" data-target-index="${item.targetIndex}">${t("saveQueue")}</button>
                </div>
              </div>
            ` : ""}
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function optionList(items, selected = "") {
  return items.map((item) => `<option value="${escapeHtml(item.value)}" ${item.value === selected ? "selected" : ""}>${escapeHtml(item.label)}</option>`).join("");
}

function renderFormModal() {
  if (!state.form) return "";
  const ch = character();
  const form = state.form;
  const imageAssets = allImageAssets().map((item) => ({ value: item.id, label: `${item.name ?? item.id} / ${item.entry.overview}` }));
  const editingCharacter = form.type === "character" && form.characterId
    ? state.deck.characters.find((item) => item.id === form.characterId)
    : null;
  let body = "";
  if (form.type === "character") {
    body = `
      <label>${t("characterName")}<input name="name" required placeholder="My Character" value="${escapeHtml(editingCharacter?.name ?? "")}"></label>
      <label>${t("description")}<textarea name="description" rows="3">${escapeHtml(editingCharacter?.description ?? "")}</textarea></label>
      ${editingCharacter ? "" : `<label class="inline"><input name="copyBase" type="checkbox"> ${t("copyBase")}</label>`}
    `;
  } else if (form.type === "entry") {
    const categoryField = state.mode === "base"
      ? `<input type="hidden" name="category" value="${escapeHtml(form.category ?? "master")}">
         <p class="form-note">${t("category")}: ${catText(form.category ?? "master")}</p>`
      : "";
    const refPool = state.mode === "image" ? adoptedImagePool().filter((item) => item.asset.kind !== "video") : [];
    const refPicker = state.mode === "image" ? `
      <div class="form-note"><strong>${t("newEntryRefs")}</strong><br>${t("newEntryRefsHelp")}</div>
      <div class="kit-sources form-ref-pool">
        ${refPool.length ? refPool.map(({ asset, entry, origin }) => `
          <button type="button" class="kit-source ${(form.refSel ?? []).some((row) => row.assetId === asset.id) ? "selected" : ""}"
            data-form-ref-entry="${escapeHtml(entry.id)}" data-form-ref-asset="${escapeHtml(asset.id)}"
            data-form-ref-file="${escapeHtml(asset.file)}" data-form-ref-name="${escapeHtml(asset.name ?? asset.id)}"
            title="${escapeHtml(entry.overview)}">
            <span class="thumb"><img src="${assetUrl(asset.file)}" loading="lazy" alt=""></span>
            <span class="kit-source-name">${escapeHtml(entry.overview || asset.name || asset.id)}</span>
            <span class="kit-source-origin">${origin === "base" ? t("base") : t("image")}</span>
          </button>`).join("") : `<p class="form-note">${t("kitNoAdopted")}</p>`}
      </div>` : "";
    body = `
      ${categoryField}
      <label>${t("assetName")}<input name="overview" required value="${escapeHtml(form.draftOverview ?? "")}" placeholder="${state.mode === "video" ? "fish-jump-loop" : "new asset prompt"}"></label>
      <label>${t("prompt")}<textarea name="prompt" rows="7">${escapeHtml(form.draftPrompt ?? "")}</textarea></label>
      ${refPicker}
      ${state.mode === "video" ? `
        <label>${t("start")}<select name="startFrame"><option value="">未設定</option>${optionList(imageAssets)}</select></label>
        <label>${t("end")}<select name="endFrame"><option value="">未設定</option>${optionList(imageAssets)}</select></label>
        <label>${t("output")}<input name="outputDraft" placeholder="outputs/${escapeHtml(ch.id)}/new-video.mp4"></label>
      ` : ""}
    `;
  } else if (form.type === "category") {
    body = `
      <label>${t("categoryName")}<input name="label" required placeholder="${state.lang === "ja" ? "場面" : "Scene"}"></label>
    `;
  } else if (form.type === "asset") {
    const entry = findEntry(form.entryId);
    body = `
      <p class="form-note">${escapeHtml(entry?.overview ?? form.entryId)}</p>
      <p class="form-note">${t("assetFormIntro")}</p>
      <label>${t("sourceFile")} <span class="required">${t("required")}</span><input name="sourceFile" required placeholder="/Users/.../Downloads/generated.png"><small>${t("sourceFileHelp")}</small></label>
      <label>${t("assetName")}<input name="name" placeholder="candidate-a"><small>${t("assetNameHelp")}</small></label>
      <label>${t("sourceLicense")}<input name="sourceLicense" placeholder="User-owned / generated under service terms / CC0"><small>${t("sourceLicenseHelp")}</small></label>
      <label>${t("prompt")}<textarea name="prompt" rows="4"></textarea></label>
      <label>${t("usageNotes")}<textarea name="usageNotes" rows="3"></textarea><small>${t("usageNotesHelp")}</small></label>
      <label class="inline"><input name="asReference" type="checkbox"> ${t("asReference")}<small>${t("asReferenceHelp")}</small></label>
      <label class="inline"><input name="aiGenerated" type="checkbox" checked> ${t("aiGenerated")}</label>
      <label class="inline"><input name="humanReviewed" type="checkbox"> ${t("humanReviewed")}</label>
      <label class="inline"><input name="adopted" type="checkbox"> ${t("adopt")}<small>${t("adoptHelp")}</small></label>
    `;
  } else if (form.type === "improveBatch") {
    body = `
      <p class="form-note">${form.count} ${t("improveSelected")}</p>
      <p class="form-note">${t("batchImproveNote")}</p>
      <label>${t("commonImprovePrompt")}<textarea name="commonPrompt" rows="5" required></textarea></label>
    `;
  }
  return `
    <div class="form-modal open">
      <form class="form-card" id="activeForm" data-form-type="${escapeHtml(form.type)}">
        <div class="form-head">
          <strong>${escapeHtml(form.title)}</strong>
          <button type="button" class="icon" id="closeForm" title="${t("close")}" aria-label="${t("close")}">×</button>
        </div>
        <div class="form-body">${body}</div>
        <div class="form-actions">
          <button type="button" class="ghost" id="cancelForm">${t("cancel")}</button>
          ${form.type === "improveBatch" ? `<button type="button" class="ghost" id="editImproveIndividually">${t("editIndividually")}</button>` : ""}
          <button class="primary" type="submit">${form.type === "improveBatch" ? t("applyCommonImprove") : editingCharacter ? t("save") : t("create")}</button>
        </div>
      </form>
    </div>
  `;
}

function render() {
  const ch = character();
  const generateCount = selectedRows().length;
  const improveCount = selectedImproveAssets().length;
  const queueCount = generateCount + improveCount;
  const requestLabel = queueCount
    ? `${t("request")}（${t("generate")}${generateCount}・${t("improve")}${improveCount}）`
    : t("request");
  const isQueue = state.mode === "queue";
  document.documentElement.lang = state.lang;
  $("#app").innerHTML = `
    <div class="app">
      <header class="top">
        <div class="brand">
          <div class="mark">IMAGE ARRANGER</div>
          <h1>${t("title")}<small>${t("subtitle")}</small></h1>
        </div>
        <div class="toolbar">
          <label>${t("character")}</label>
          <select id="characterSelect">
            ${state.deck.characters.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === state.characterId ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}
          </select>
          <button class="icon-button" id="addCharacterBtn" title="${t("addCharacter")}" aria-label="${t("addCharacter")}"><i class="fa-solid fa-plus" aria-hidden="true"></i></button>
          <button class="icon-button" id="editCharacterBtn" title="${t("editCharacter")}" aria-label="${t("editCharacter")}"><i class="fa-solid fa-pen-to-square" aria-hidden="true"></i></button>
          <button class="icon-button danger" id="deleteCharacterBtn" title="${t("deleteCharacter")}" aria-label="${t("deleteCharacter")}"><i class="fa-solid fa-trash" aria-hidden="true"></i></button>
          <button class="ghost" id="langBtn">${state.lang === "ja" ? "English" : "日本語"}</button>
        </div>
      </header>
      <div class="toolbar action-bar">
        <label>${t("mode")}</label>
        <div class="tabs">
          ${["kit", "base", "image", "video", "queue"].map((mode) => `<button data-mode="${mode}" class="${state.mode === mode ? "active" : ""}">${t(mode)}${mode === "queue" && state.requests.length ? ` (${state.requests.length})` : ""}</button>`).join("")}
        </div>
        <input class="grow" id="filterInput" value="${escapeHtml(state.filter)}" placeholder="${t("filter")}">
        ${isQueue ? `
          <button class="ghost danger" id="cancelAllQueueBtn" ${state.requests.length ? "" : "disabled"}>${t("cancelAll")}</button>
        ` : `
          <button class="primary" id="requestBtn" ${queueCount ? "" : "disabled"}>${requestLabel}</button>
        `}
      </div>
      <section class="panel">
        <div class="panel-head">
          <h2>${escapeHtml(ch.name)} / ${t(state.mode)}</h2>
          <span>${escapeHtml(ch.description ?? "")}</span>
        </div>
        <div class="panel-body">${renderRows()}</div>
      </section>
    </div>
    <div class="modal" id="modal"></div>
    ${renderFormModal()}
    <div class="toast" id="toast"></div>
  `;
  bind();
}

function findEntry(id) {
  const ch = character();
  return [...allBaseEntries(ch), ...ch.images, ...ch.videos].find((entry) => entry.id === id);
}

function removeEntry(id) {
  const ch = character();
  for (const category of Object.keys(ch.base ?? {})) {
    ch.base[category] = ch.base[category].filter((entry) => entry.id !== id);
  }
  ch.images = ch.images.filter((entry) => entry.id !== id);
  ch.videos = ch.videos.filter((entry) => entry.id !== id);
}

function cancellationTargetsForEntry(entry, characterId = state.characterId) {
  if (!entry) return [];
  return [
    { action: "generate", characterId, entryId: entry.id },
    ...(entry.assets ?? []).flatMap((asset) => [
      { action: "improve", characterId, entryId: entry.id, assetId: asset.id },
      { action: "analyze", characterId, entryId: entry.id, assetId: asset.id },
    ]),
  ];
}

function cancellationTargetsForCharacter(ch) {
  return [...allBaseEntries(ch), ...ch.images, ...ch.videos].flatMap((entry) => cancellationTargetsForEntry(entry, ch.id));
}

function hasRequestedTarget(target) {
  return (state.requests ?? []).some((requestItem) => {
    if (target.characterId && requestItem.characterId !== target.characterId) return false;
    if (requestItem.entryId !== target.entryId) return false;
    const action = ["improve", "analyze"].includes(target.action) ? target.action : "generate";
    if (requestItem.action !== action) return false;
    return action === "generate" || String(requestItem.assetId ?? "") === String(target.assetId ?? "");
  });
}

async function cancelTargetsBeforeDelete(targets) {
  const requestedTargets = targets.filter(hasRequestedTarget);
  if (!requestedTargets.length) return;
  await cancelTargets(requestedTargets, false);
}

async function deleteEntry(id) {
  const entry = findEntry(id);
  if (!entry) return;
  const targets = cancellationTargetsForEntry(entry);
  const hasQueued = targets.some(hasRequestedTarget);
  if (!confirm(hasQueued ? t("deleteQueuedConfirm") : t("deleteConfirm"))) return;
  await cancelTargetsBeforeDelete(targets);
  removeEntry(id);
  await saveDeck(false);
  await loadQueue(false);
  render();
}

async function deleteAsset(entry, asset) {
  if (!entry || !asset) return;
  const targets = [{ action: "improve", entryId: entry.id, assetId: asset.id }];
  const hasQueued = targets.some(hasRequestedTarget);
  if (!confirm(hasQueued ? t("deleteQueuedConfirm") : t("deleteConfirm"))) return;
  await cancelTargetsBeforeDelete(targets);
  entry.assets = (entry.assets ?? []).filter((item) => item.id !== asset.id);
  await saveDeck(false);
  await loadQueue(false);
  $("#modal").classList.remove("open");
  render();
}

function duplicateEntry(id) {
  const ch = character();
  const collections = [...Object.values(ch.base ?? {}), ch.images, ch.videos];
  for (const collection of collections) {
    const index = collection.findIndex((entry) => entry.id === id);
    if (index >= 0) {
      const copy = structuredClone(collection[index]);
      copy.id = `${copy.id}-v${(copy.version ?? 1) + 1}-${Date.now().toString(36)}`;
      copy.version = (copy.version ?? 1) + 1;
      copy.checked = false;
      copy.requestStatus = "idle";
      copy.assets = [];
      collection.splice(index + 1, 0, copy);
      return;
    }
  }
}

function openCharacterForm() {
  state.form = { type: "character", title: t("addCharacter") };
  render();
}

function openEditCharacterForm() {
  state.form = { type: "character", title: t("editCharacter"), characterId: state.characterId };
  render();
}

function openEntryForm() {
  state.form = { type: "entry", title: `${t("newEntry")} / ${t(state.mode)}`, category: "master" };
  render();
}

function openBaseCategoryForm(category) {
  state.mode = "base";
  state.form = { type: "entry", title: `${t("newEntry")} / ${catText(category)}`, category };
  render();
}

function openCategoryForm() {
  state.mode = "base";
  state.form = { type: "category", title: t("addCategory") };
  render();
}

function openAssetForm(entryId) {
  state.form = { type: "asset", entryId, title: t("addAsset") };
  render();
}

function closeForm() {
  state.form = null;
  render();
}

async function submitCategoryForm(form) {
  const ch = character();
  const data = new FormData(form);
  const label = String(data.get("label") ?? "").trim();
  if (!label) throw new Error("category name is required");
  const id = makeUniqueId(new Set(categoryKeys(ch)), slug(label, "category"));
  ch.base[id] = [];
  ch.categoryLabels = {
    ...(ch.categoryLabels ?? {}),
    [id]: { ja: label, en: label },
  };
  for (const entry of ch.images ?? []) entry.refs = normalizeEntryRefs(ch, entry.refs);
  state.form = null;
  await saveDeck(false);
  render();
  toast(`${t("addCategory")} saved`);
}

function createEntryFromForm(form) {
  const ch = character();
  const data = new FormData(form);
  const overview = String(data.get("overview") ?? "").trim();
  if (!overview) throw new Error("overview is required");
  const prompt = String(data.get("prompt") ?? "");
  const ids = entryIds(ch);
  if (state.mode === "base") {
    const category = String(data.get("category") ?? "master");
    const id = makeUniqueId(ids, `base-${slug(category)}-${slug(overview)}`);
    ch.base[category] = ch.base[category] ?? [];
    ch.base[category].push({
      id,
      overview,
      prompt,
      version: 1,
      checked: false,
      requestStatus: "idle",
      tags: [],
      assets: [],
    });
    return;
  }
  if (state.mode === "video") {
    const id = makeUniqueId(ids, `video-${slug(overview)}`);
    const outputDraft = String(data.get("outputDraft") ?? "").trim();
    ch.videos.push({
      id,
      overview,
      prompt,
      version: 1,
      checked: false,
      requestStatus: "idle",
      tags: [],
      startFrame: String(data.get("startFrame") ?? ""),
      endFrame: String(data.get("endFrame") ?? ""),
      outputDraft,
      assets: [],
    });
    return;
  }
  const id = makeUniqueId(ids, `image-${slug(overview)}`);
  const refSel = state.form?.refSel ?? [];
  ch.images.push({
    id,
    overview,
    prompt,
    version: 1,
    checked: false,
    requestStatus: "idle",
    tags: [],
    assets: refSel.map((row, index) => ({
      id: `asset-${id}-src-${index}`,
      kind: "image",
      file: row.file,
      name: row.name || "source-reference",
      adopted: false,
      prompt: "",
      sourceLicense: "",
      aiGenerated: true,
      humanReviewed: true,
      usageNotes: "新規作成時に選択した元画像（生成入力）",
      tags: ["source-reference"],
    })),
    useBaseRefs: false,
    refs: defaultBaseRefs(ch),
  });
}

async function submitCharacterForm(form) {
  const data = new FormData(form);
  const payload = {
    name: String(data.get("name") ?? ""),
    description: String(data.get("description") ?? ""),
    copyBaseFrom: data.get("copyBase") ? state.characterId : "",
  };
  const editingId = state.form?.characterId;
  const result = await api(editingId ? `/api/characters/${encodeURIComponent(editingId)}` : "/api/characters", {
    method: editingId ? "PUT" : "POST",
    body: JSON.stringify(payload),
  });
  state.deck = result.state;
  state.characterId = result.character?.id ?? state.characterId;
  state.form = null;
  await loadQueue(false);
  render();
  toast(t(editingId ? "characterUpdated" : "characterAdded"));
}

async function deleteCurrentCharacter() {
  const ch = character();
  if (!ch) return;
  if ((state.deck.characters ?? []).length <= 1) {
    toast(t("lastCharacter"));
    return;
  }
  const hasQueued = cancellationTargetsForCharacter(ch).some(hasRequestedTarget);
  if (!confirm(hasQueued ? t("deleteQueuedConfirm") : t("deleteCharacterConfirm"))) return;
  const result = await api(`/api/characters/${encodeURIComponent(ch.id)}`, { method: "DELETE" });
  state.deck = result.state;
  state.characterId = state.deck.settings?.currentCharacterId ?? state.deck.characters?.[0]?.id ?? "";
  state.requests = result.requests ?? [];
  render();
  toast(t("characterDeleted"));
}

async function submitEntryForm(form) {
  createEntryFromForm(form);
  state.form = null;
  await saveDeck(false);
  render();
  toast(`${t("newEntry")} saved`);
}

async function submitImproveBatchForm(form) {
  const data = new FormData(form);
  const commonPrompt = String(data.get("commonPrompt") ?? "").trim();
  if (!commonPrompt) throw new Error(t("improvePrompt"));
  const improveAssets = selectedImproveAssets();
  for (const { asset } of improveAssets) {
    if (!String(asset.improvementPrompt ?? "").trim()) {
      asset.improvementPrompt = commonPrompt;
    }
  }
  state.form = null;
  await saveDeck(false);
  await enqueueTargets(improveAssets.map(improveTarget), false);
}

async function submitAssetForm(form) {
  const data = new FormData(form);
  const result = await api("/api/assets", {
    method: "POST",
    body: JSON.stringify({
      characterId: state.characterId,
      entryId: state.form.entryId,
      sourceFile: String(data.get("sourceFile") ?? ""),
      name: String(data.get("name") ?? ""),
      prompt: String(data.get("prompt") ?? ""),
      sourceLicense: String(data.get("sourceLicense") ?? ""),
      aiGenerated: Boolean(data.get("aiGenerated")),
      humanReviewed: Boolean(data.get("humanReviewed")),
      usageNotes: String(data.get("usageNotes") ?? ""),
      adopted: Boolean(data.get("adopted")),
      reference: Boolean(data.get("asReference")),
    }),
  });
  state.deck = result.state;
  state.form = null;
  render();
  toast(t("assetAdded"));
}

async function saveQueueTarget(requestId, targetIndex) {
  const key = `${requestId}:${targetIndex}`;
  const prompt = document.querySelector(`[data-queue-prompt="${CSS.escape(key)}"]`)?.value ?? "";
  const improvementPrompt = document.querySelector(`[data-queue-improvement="${CSS.escape(key)}"]`)?.value ?? "";
  const result = await api("/api/requests/update", {
    method: "POST",
    body: JSON.stringify({
      requestId,
      targetIndex: Number(targetIndex),
      prompt,
      improvementPrompt,
    }),
  });
  state.deck = result.state;
  state.requests = result.requests ?? [];
  render();
  toast(t("queueUpdated"));
}

async function handleFormSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  try {
    if (state.form?.type === "character") {
      await submitCharacterForm(form);
    } else if (state.form?.type === "category") {
      await submitCategoryForm(form);
    } else if (state.form?.type === "entry") {
      await submitEntryForm(form);
    } else if (state.form?.type === "asset") {
      await submitAssetForm(form);
    } else if (state.form?.type === "improveBatch") {
      await submitImproveBatchForm(form);
    }
  } catch (error) {
    toast(error.message);
  }
}

function bind() {
  $("#characterSelect").onchange = async (event) => {
    state.characterId = event.target.value;
    await saveDeck(false).catch((error) => toast(error.message));
    render();
  };
  $("#langBtn").onclick = async () => {
    state.lang = state.lang === "ja" ? "en" : "ja";
    await saveDeck(false).catch((error) => toast(error.message));
    render();
  };
  $("#filterInput").oninput = (event) => {
    state.filter = event.target.value;
    render();
  };
  $("#addCharacterBtn").onclick = openCharacterForm;
  $("#editCharacterBtn").onclick = openEditCharacterForm;
  $("#deleteCharacterBtn").onclick = deleteCurrentCharacter;
  if ($("#newEntryBtn")) $("#newEntryBtn").onclick = openEntryForm;
  if ($("#requestBtn")) $("#requestBtn").onclick = requestSelected;
  if ($("#cancelAllQueueBtn")) $("#cancelAllQueueBtn").onclick = cancelAllQueued;
  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.onclick = async () => {
      state.mode = button.dataset.mode;
      if (state.mode === "queue") await loadQueue(false);
      await saveDeck(false).catch((error) => toast(error.message));
      render();
    };
  });
  document.querySelectorAll("[data-add-base-category]").forEach((button) => {
    button.onclick = () => openBaseCategoryForm(button.dataset.addBaseCategory);
  });
  document.querySelectorAll("[data-open-entry]").forEach((card) => {
    card.onclick = (event) => {
      if (event.target.closest(".bcard-check")) return;
      openEntryModal(card.dataset.openEntry);
    };
  });
  document.querySelectorAll(".bcard-check").forEach((label) => {
    label.onclick = (event) => event.stopPropagation();
  });
  document.querySelectorAll("[data-adopt-card]").forEach((input) => {
    input.onchange = () => {
      const entry = findEntry(input.dataset.adoptCard);
      if (!entry) return;
      const generated = (entry.assets ?? []).filter((asset) => !isSourceRef(asset));
      const main = generated.find((asset) => asset.adopted && asset.file) ?? generated.find((asset) => asset.file);
      if (!main) return;
      main.adopted = input.checked;
      saveDeck(false).catch((error) => toast(error.message));
      render();
    };
  });
  document.querySelectorAll("[data-kit-filter]").forEach((button) => {
    button.onclick = () => {
      state.kit.srcFilter = button.dataset.kitFilter;
      render();
    };
  });
  document.querySelectorAll("[data-kit-source-asset]").forEach((button) => {
    button.onclick = () => {
      const sel = { entryId: button.dataset.kitSourceEntry, assetId: button.dataset.kitSourceAsset };
      const index = state.kit.sources.findIndex((s) => s.assetId === sel.assetId);
      if (index >= 0) state.kit.sources.splice(index, 1);
      else state.kit.sources.push(sel);
      render();
    };
  });
  if ($("#kitCharName")) $("#kitCharName").onchange = () => { state.kit.characterName = $("#kitCharName").value; };
  if ($("#kitExtra")) $("#kitExtra").oninput = () => { state.kit.extra = $("#kitExtra").value; };
  if ($("#kitJson")) $("#kitJson").oninput = () => { state.kit.json = $("#kitJson").value; };
  if ($("#kitAnalyzeBtn")) $("#kitAnalyzeBtn").onclick = () => requestKitAnalysis().catch((error) => toast(error.message));
  if ($("#kitParseBtn")) $("#kitParseBtn").onclick = openKitPreviewFromPaste;
  if ($("#kitCreateBtn")) $("#kitCreateBtn").onclick = () => importSelectedKitParts().catch((error) => toast(error.message));
  if ($("#kitQueueAfter")) $("#kitQueueAfter").onchange = () => { if (state.kit.preview) state.kit.preview.queueAfter = $("#kitQueueAfter").checked; };
  if ($("#kitPreviewCancel")) $("#kitPreviewCancel").onclick = () => { state.kit.preview = null; render(); };
  document.querySelectorAll("[data-kit-result]").forEach((button) => {
    button.onclick = () => openKitPreviewFromResult(Number(button.dataset.kitResult));
  });
  document.querySelectorAll("[data-kit-pick]").forEach((input) => {
    input.onchange = () => {
      const row = state.kit.preview?.parts?.[Number(input.dataset.kitPick)];
      if (row) row.checked = input.checked;
      render();
    };
  });
  document.querySelectorAll("[data-copy-agent]").forEach((button) => {
    button.onclick = async (event) => {
      event.stopPropagation();
      const item = (state.requests ?? []).find((row) => row.requestId === button.dataset.copyAgent && row.targetIndex === Number(button.dataset.targetIndex));
      if (!item) return;
      await navigator.clipboard.writeText(agentPromptFor(item));
      toast(t("copiedAgentPrompt"));
    };
  });
  if ($("#addCategoryBtn")) $("#addCategoryBtn").onclick = openCategoryForm;
  document.querySelectorAll("[data-ref-single]").forEach((button) => {
    button.onclick = () => {
      const entry = findEntry(button.dataset.refSingle);
      entry.refs = normalizeEntryRefs(character(), entry.refs);
      entry.refs[button.dataset.refCategory] = button.dataset.refId;
      saveDeck(false);
      render();
    };
  });
  document.querySelectorAll("[data-ref-multi]").forEach((button) => {
    button.onclick = () => {
      const entry = findEntry(button.dataset.refMulti);
      entry.refs = normalizeEntryRefs(character(), entry.refs);
      const category = button.dataset.refCategory;
      const current = new Set(refIdsFor(category, entry.refs));
      if (current.has(button.dataset.refId)) current.delete(button.dataset.refId);
      else current.add(button.dataset.refId);
      entry.refs[category] = [...current];
      saveDeck(false);
      render();
    };
  });
  document.querySelectorAll("[data-use-base-refs]").forEach((input) => {
    input.onchange = () => {
      const entry = findEntry(input.dataset.useBaseRefs);
      if (!entry) return;
      entry.useBaseRefs = input.checked;
      entry.refs = normalizeEntryRefs(character(), entry.refs);
      saveDeck(false).catch((error) => toast(error.message));
      render();
    };
  });
  document.querySelectorAll("[data-check]").forEach((input) => {
    input.onchange = () => {
      const entry = findEntry(input.dataset.check);
      entry.checked = input.checked;
      saveDeck(false).catch((error) => toast(error.message));
      render();
    };
  });
  document.querySelectorAll("[data-title]").forEach((input) => {
    input.onchange = () => {
      findEntry(input.dataset.title).overview = input.value;
      saveDeck(false);
    };
  });
  document.querySelectorAll("[data-toggle]").forEach((button) => {
    button.onclick = () => {
      const key = button.dataset.toggle;
      if (state.expanded.has(key)) state.expanded.delete(key);
      else state.expanded.add(key);
      render();
    };
  });
  document.querySelectorAll("[data-prompt-entry]").forEach((textarea) => {
    textarea.onchange = () => {
      findEntry(textarea.dataset.promptEntry).prompt = textarea.value;
      saveDeck(false);
    };
  });
  document.querySelectorAll("[data-copy-entry]").forEach((button) => {
    button.onclick = async () => {
      await navigator.clipboard.writeText(composedPrompt(findEntry(button.dataset.copyEntry)));
      button.textContent = t("copied");
      setTimeout(() => { button.textContent = t("copy"); }, 900);
    };
  });
  document.querySelectorAll("[data-dup]").forEach((button) => {
    button.onclick = () => {
      duplicateEntry(button.dataset.dup);
      render();
    };
  });
  document.querySelectorAll("[data-delete]").forEach((button) => {
    button.onclick = () => deleteEntry(button.dataset.delete);
  });
  document.querySelectorAll("[data-add-asset]").forEach((button) => {
    button.onclick = () => openAssetForm(button.dataset.addAsset);
  });
  document.querySelectorAll("[data-request-one]").forEach((button) => {
    button.onclick = () => requestEntries([findEntry(button.dataset.requestOne)].filter(Boolean));
  });
  document.querySelectorAll("[data-cancel-entry-request]").forEach((button) => {
    button.onclick = () => cancelTargets([{ action: "generate", entryId: button.dataset.cancelEntryRequest }]);
  });
  document.querySelectorAll("[data-save-queue]").forEach((button) => {
    button.onclick = () => saveQueueTarget(button.dataset.saveQueue, button.dataset.targetIndex).catch((error) => toast(error.message));
  });
  document.querySelectorAll("[data-adopt-asset]").forEach((input) => {
    input.onclick = (event) => event.stopPropagation();
    input.onchange = () => {
      const entry = findEntry(input.dataset.adoptEntry);
      const asset = (entry.assets ?? []).find((item) => item.id === input.dataset.adoptAsset);
      if (!asset) return;
      asset.adopted = input.checked;
      saveDeck(false);
      render();
    };
  });
  document.querySelectorAll("[data-improve-asset]").forEach((input) => {
    input.onclick = (event) => event.stopPropagation();
    input.onchange = () => {
      const entry = findEntry(input.dataset.improveEntry);
      const asset = (entry.assets ?? []).find((item) => item.id === input.dataset.improveAsset);
      if (!asset) return;
      asset.improveChecked = input.checked;
      saveDeck(false).catch((error) => toast(error.message));
      render();
    };
  });
  document.querySelectorAll("[data-cancel-asset]").forEach((button) => {
    button.onclick = (event) => {
      event.stopPropagation();
      cancelTargets([{ action: "improve", entryId: button.dataset.cancelEntry, assetId: button.dataset.cancelAsset }]);
    };
  });
  document.querySelectorAll("[data-edit-improve-asset]").forEach((button) => {
    button.onclick = (event) => {
      event.stopPropagation();
      openAsset(button.dataset.editImproveAsset, button.dataset.editImproveEntry);
    };
  });
  document.querySelectorAll("[data-cancel-queue]").forEach((button) => {
    button.onclick = () => cancelQueueTarget(button.dataset.cancelQueue, Number(button.dataset.targetIndex));
  });
  document.querySelectorAll(".asset-adopt").forEach((label) => {
    label.onclick = (event) => event.stopPropagation();
  });
  document.querySelectorAll(".asset-improve").forEach((label) => {
    label.onclick = (event) => event.stopPropagation();
  });
  document.querySelectorAll(".asset").forEach((card) => {
    card.onclick = () => openAsset(card.dataset.assetId, card.dataset.entryId);
  });
  document.querySelectorAll("[data-form-ref-asset]").forEach((button) => {
    button.onclick = () => {
      if (!state.form) return;
      const formEl = $("#activeForm");
      if (formEl) {
        const data = new FormData(formEl);
        state.form.draftOverview = String(data.get("overview") ?? "");
        state.form.draftPrompt = String(data.get("prompt") ?? "");
      }
      state.form.refSel = state.form.refSel ?? [];
      const index = state.form.refSel.findIndex((row) => row.assetId === button.dataset.formRefAsset);
      if (index >= 0) state.form.refSel.splice(index, 1);
      else state.form.refSel.push({
        entryId: button.dataset.formRefEntry,
        assetId: button.dataset.formRefAsset,
        file: button.dataset.formRefFile,
        name: button.dataset.formRefName,
      });
      render();
    };
  });
  if ($("#activeForm")) $("#activeForm").onsubmit = handleFormSubmit;
  if ($("#closeForm")) $("#closeForm").onclick = closeForm;
  if ($("#cancelForm")) $("#cancelForm").onclick = closeForm;
  if ($("#editImproveIndividually")) {
    $("#editImproveIndividually").onclick = () => {
      closeForm();
      toast(t("editIndividually"));
    };
  }
}

function setVisibleChecked(checked) {
  for (const entry of visibleRows()) entry.checked = checked;
  saveDeck(false).catch((error) => toast(error.message));
  render();
}

function requestTarget(entry) {
  if (state.mode === "video") {
    const start = allImageAssets().find((assetItem) => assetItem.id === entry.startFrame);
    const end = allImageAssets().find((assetItem) => assetItem.id === entry.endFrame);
    return {
      action: "generate",
      entryId: entry.id,
      overview: entry.overview,
      prompt: entry.prompt,
      inputs: {
        startFrame: start?.file ?? null,
        endFrame: end?.file ?? null,
        refImages: [start?.file, end?.file].filter(Boolean),
      },
      outputDir: entry.outputDraft ? entry.outputDraft.split("/").slice(0, -1).join("/") || null : null,
    };
  }
  const ownReferences = referenceAssets(entry).map((assetItem) => assetItem.file);
  const ownAdopted = adoptedAssets(entry).map((assetItem) => assetItem.file).filter(Boolean);
  const refImages = state.mode === "image" && entry.useBaseRefs
    ? selectedBaseAssets(entry).map((assetItem) => assetItem.file)
    : (ownReferences.length ? ownReferences : ownAdopted);
  return {
    action: "generate",
    entryId: entry.id,
    overview: entry.overview,
    prompt: state.mode === "image" ? composedPrompt(entry) : entry.prompt,
    inputs: {
      startFrame: null,
      endFrame: null,
      refImages,
    },
    outputDir: null,
  };
}

async function requestSelected() {
  const improveAssets = selectedImproveAssets();
  const missingImprovePrompt = improveAssets.filter(({ asset }) => !String(asset.improvementPrompt ?? "").trim());
  if (improveAssets.length > 1 && missingImprovePrompt.length) {
    state.form = { type: "improveBatch", title: t("batchImproveTitle"), count: missingImprovePrompt.length };
    render();
    return;
  }
  await enqueueTargets([
    ...selectedRows().map(requestTarget),
    ...improveAssets.map(improveTarget),
  ]);
}

async function requestEntries(entries) {
  await enqueueTargets(entries.map(requestTarget));
}

function improvePrompt(asset, entry) {
  const basePrompt = asset.prompt || (state.mode === "image" ? composedPrompt(entry) : entry.prompt) || "";
  const instruction = String(asset.improvementPrompt ?? "").trim()
    || "Improve quality, readability, and asset extraction while preserving the useful composition and original intent.";
  return [
    "Improve the existing generated asset. Use the attached source asset as the primary reference.",
    instruction,
    "Keep it usable as a game asset. No text, no logo, no watermark, no UI unless explicitly requested.",
    basePrompt ? `Original prompt:\n${basePrompt}` : "",
  ].filter(Boolean).join("\n\n");
}

function improveTarget({ entry, asset }) {
  const service = asset.kind === "video" ? "vidu" : "chatgpt";
  return {
    action: "improve",
    entryId: entry.id,
    assetId: asset.id,
    assetName: asset.name ?? asset.id,
    assetFile: asset.file ?? "",
    overview: `${entry.overview} / ${asset.name ?? asset.id}`,
    prompt: improvePrompt(asset, entry),
    basePrompt: asset.prompt || (state.mode === "image" ? composedPrompt(entry) : entry.prompt) || "",
    improvementPrompt: asset.improvementPrompt ?? "",
    service,
    inputs: {
      startFrame: null,
      endFrame: null,
      refImages: asset.file ? [asset.file] : [],
      sourceAsset: asset.file ?? null,
    },
    outputDir: null,
  };
}

async function enqueueTargets(targets, saveBeforeRequest = true) {
  if (saveBeforeRequest) await saveDeck(false);
  if (!targets.length) return;
  const result = await api("/api/requests", {
    method: "POST",
    body: JSON.stringify({
      state: state.deck,
      characterId: state.characterId,
      mode: state.mode,
      targets,
    }),
  });
  state.deck = result.state;
  await loadQueue(false);
  render();
  toast(`${t("requestDone")}\n${result.requestFile}`);
}

async function requestKitAnalysis() {
  const kit = state.kit;
  if (!kit.sources.length) {
    toast(t("kitNoSource"));
    return;
  }
  const result = await api("/api/base-kit/analyze", {
    method: "POST",
    body: JSON.stringify({
      characterId: state.characterId,
      sources: kit.sources,
      characterName: ($("#kitCharName")?.value ?? "").trim() || character().name,
      extraRequest: ($("#kitExtra")?.value ?? state.kit.extra ?? "").trim(),
    }),
  });
  state.deck = result.state;
  normalizeDeck();
  state.requests = result.requests ?? state.requests;
  render();
  toast(`${t("kitAnalyzeQueued")}\n${result.requestFile}`);
}

function parseKitText(text) {
  const fenced = String(text).match(/```(?:json)?\s*([\s\S]*?)```/);
  const parsed = JSON.parse(fenced ? fenced[1] : text);
  if (Array.isArray(parsed)) return parsed;
  return Array.isArray(parsed?.parts) ? parsed.parts : [];
}

function openKitPreviewFromPaste() {
  const text = String($("#kitJson")?.value ?? state.kit.json ?? "").trim();
  if (!text) {
    toast(t("kitPasteHelp"));
    return;
  }
  let parts;
  try {
    parts = parseKitText(text);
  } catch (error) {
    toast(`JSON: ${error.message}`);
    return;
  }
  if (!parts.length) {
    toast(t("kitPasteHelp"));
    return;
  }
  const pasteSourceFiles = state.kit.sources
    .map((sel) => findEntry(sel.entryId)?.assets?.find((item) => item.id === sel.assetId)?.file)
    .filter(Boolean);
  state.kit.preview = {
    origin: "paste",
    characterId: state.characterId,
    sourceFiles: pasteSourceFiles,
    requestId: null,
    targetIndex: null,
    parts: parts.map((part) => ({ part, checked: true })),
  };
  render();
}

function openKitPreviewFromResult(index) {
  const result = state.kitResults[index];
  if (!result) return;
  state.kit.preview = {
    origin: "request",
    characterId: result.characterId || state.characterId,
    sourceFiles: (result.sourceFiles ?? []).length ? result.sourceFiles : [result.sourceFile].filter(Boolean),
    requestId: result.requestId,
    targetIndex: result.targetIndex,
    parts: result.parts.map((part) => ({ part, checked: true })),
  };
  render();
}

async function importSelectedKitParts() {
  const preview = state.kit.preview;
  if (!preview) return;
  const parts = preview.parts.filter((row) => row.checked).map((row) => row.part);
  if (!parts.length) {
    toast(t("kitPickOne"));
    return;
  }
  const characterId = preview.characterId || state.characterId;
  const result = await api("/api/base-kit/import", {
    method: "POST",
    body: JSON.stringify({
      characterId,
      sourceFiles: preview.sourceFiles ?? [],
      requestId: preview.requestId,
      targetIndex: preview.targetIndex,
      parts,
    }),
  });
  state.deck = result.state;
  const queueAfter = preview.queueAfter !== false;
  if (queueAfter && result.created.length) {
    const refFiles = (preview.sourceFiles ?? []).filter(Boolean);
    const queueResult = await api("/api/requests", {
      method: "POST",
      body: JSON.stringify({
        characterId,
        mode: "base",
        targets: result.created.map((entryInfo) => ({
          action: "generate",
          entryId: entryInfo.id,
          overview: entryInfo.overview,
          prompt: entryInfo.prompt,
          inputs: { startFrame: null, endFrame: null, refImages: refFiles },
          outputDir: null,
        })),
      }),
    });
    state.deck = queueResult.state;
  }
  normalizeDeck();
  state.kitResults = result.kitResults ?? state.kitResults;
  state.kit.preview = null;
  state.kit.json = "";
  state.mode = "base";
  await loadQueue(false);
  await saveDeck(false);
  render();
  toast(queueAfter ? `${t("kitImportedQueued")}（${result.created.length}）` : `${t("kitImported")}（${result.created.length}）`);
}

function agentPromptFor(item) {
  const origin = window.location.origin;
  const root = state.projectRoot || "(server project root)";
  const refs = (item.inputs?.refImages ?? []).map((file) => `   - ${file}`).join("\n") || "   - (なし)";
  if (item.action === "analyze") {
    return `image-arranger のベース分解・画像分析依頼を1件処理してください。

サーバ: ${origin}（起動済み。サーバや開発サーバの起動・再起動はしない）
作業ディレクトリ（projectRoot）: ${root}
対象: requestId ${item.requestId} / targetIndex ${item.targetIndex}（action: analyze）

手順（前提が満たせない場合は回避策を取らず停止して報告すること）:
1. curl -s ${origin}/api/requests で上記 requestId / targetIndex の行がまだあることを確認。無ければ停止して報告。
2. これは画像分析タスク。画像は生成しない。
3. ChatGPT を開き、次の画像（projectRoot からの相対パス）を添付して、該当行の prompt を一字一句そのまま送信する:
${refs}
   ブラウザ操作の注意（実機検証済み）:
   - ネイティブのファイル選択ダイアログを開かない。macOS の外部 Chrome では
     osascript -e 'set the clipboard to (read (POSIX file "<絶対パス>") as «class PNGf»)'
     で画像をクリップボードに載せ、入力欄をクリックして Cmd+V で貼り付ける。
   - サムネイルのアップロード完了（スピナー消滅）を待ってから、プロンプトを pbcopy → Cmd+V で貼り付けて送信する。
   - 応答は5〜15分かかることがある。30〜60秒間隔の軽い読み取りでポーリングし、リロードや再送信をしない。
4. 返答の JSON コードブロック（{"character","parts":[{"key","label","category","prompt"}]}）を取り出す。
   コードブロック右上の「コピーする」ボタンをクリックして取り出すのが確実（clipboard API はフォーカス制約で失敗しうる）。
   各 parts[].prompt が「パーツ単体・1画像のみ・元デザインの忠実トレース（再デザイン禁止）・
   角/翼/尻尾は身体部位として自然接続・無地背景・文字/ロゴ/透かしなし」を満たすか確認し、欠けは最小修正。
   parts は必ず ChatGPT の返答から作る。自分では書かない。
5. 完了報告:
   curl -X POST ${origin}/api/requests/complete \\
     -H "Content-Type: application/json" \\
     -d '{"requestId":"${item.requestId}","targetIndex":${item.targetIndex},"parts":<取り出したJSON>}'
   レスポンスの kitResultsStored が 1 であることを確認する。
   ※ベースentryの作成はユーザーが画面でパーツを選択して行うため、エージェントは entry 作成を確認しなくてよい。
   POST に失敗した場合のみ、JSON を整形してそのまま報告する（ユーザーが画面から取り込む）。
6. 最終報告: 選ばれたパーツの一覧 / JSON の修正点 / 気づいた問題を簡潔に。

禁止: 画像生成 / 依頼の自作・編集 / parts の自作 / サーバ・開発サーバの起動 / 無関係な checkout や worktree の探索。`;
  }
  const isImprove = item.action === "improve";
  return `image-arranger の画像${isImprove ? "改善" : "生成"}依頼を1件処理してください。

サーバ: ${origin}（起動済み。サーバや開発サーバの起動・再起動はしない）
作業ディレクトリ（projectRoot）: ${root}
対象: requestId ${item.requestId} / targetIndex ${item.targetIndex}（action: ${item.action} / service: ${item.service}）

手順（前提が満たせない場合は回避策を取らず停止して報告すること）:
1. curl -s ${origin}/api/requests で上記 requestId / targetIndex の行がまだあることを確認。無ければ停止して報告。
2. 該当行の prompt をそのまま使い、参照画像は次のみ添付する（projectRoot からの相対パス）:
${refs}
${isImprove ? "   改善元（inputs.sourceAsset）を主参照として扱い、improvementPrompt を改善意図として優先する。\n" : ""}3. 1 target = 1成果物。複数案・グリッド・A/B比較・コンタクトシートを作らない。
   作業タブは1つだけ使い回す（targetごとに新しいタブ/ウィンドウを開かず、同じタブで「新しいチャット」）。
4. コンテンツポリシー等で拒否された場合: ①同一プロンプトで1回だけ再送 ②デザインを変えない最小限の表現修正で1回再送
   ③それでも失敗したら error 報告して次へ:
   curl -X POST ${origin}/api/requests/complete \\
     -H "Content-Type: application/json" \\
     -d '{"requestId":"${item.requestId}","targetIndex":${item.targetIndex},"error":"<理由と試した修正>"}'
5. 生成結果を ${item.outputDir || "outputDir"} に保存し、完了報告:
   curl -X POST ${origin}/api/requests/complete \\
     -H "Content-Type: application/json" \\
     -d '{"requestId":"${item.requestId}","targetIndex":${item.targetIndex},"results":[{"file":"<保存した相対パス>"}]}'
6. 最終報告: 保存先 / 確認した品質ポイント / エラーがあれば理由と次の修正案を簡潔に。

禁止: 通常UIで保存できない場合のスクリーンショット・キャッシュ・blob URL での代替 / 依頼の自作・編集 / サーバ・開発サーバの起動 / 無関係な checkout の探索。`;
}

async function cancelTargets(targets, shouldRender = true) {
  const result = await api("/api/requests/cancel", {
    method: "POST",
    body: JSON.stringify({
      characterId: state.characterId,
      targets,
    }),
  });
  state.deck = result.state;
  state.requests = result.requests ?? state.requests;
  if (shouldRender) render();
  toast(t("cancelDone"));
}

async function cancelQueueTarget(requestId, targetIndex) {
  await cancelTargets([{ requestId, targetIndex }]);
}

async function cancelAllQueued() {
  if (!state.requests.length) return;
  if (!confirm(t("cancelRequest"))) return;
  await cancelTargets(state.requests.map((item) => ({
    requestId: item.requestId,
    targetIndex: item.targetIndex,
  })));
}

function openAsset(assetId, entryId) {
  const entry = findEntry(entryId);
  const asset = (entry.assets ?? []).find((item) => item.id === assetId) ?? allImageAssets().find((item) => item.id === assetId);
  if (!asset) return;
  const prompt = asset.prompt || (state.mode === "image" ? composedPrompt(entry) : entry.prompt) || "";
  $("#modal").innerHTML = `
    <button class="close" id="closeModal" title="${t("close")}" aria-label="${t("close")}">×</button>
    <div class="modal-card">
      <div class="modal-media">${asset.file ? `<img src="${assetUrl(asset.file)}" alt="${escapeHtml(asset.name)}">` : "No file"}</div>
      <div class="modal-side">
        <h3>${escapeHtml(asset.name ?? entry.overview)}</h3>
        <p>${escapeHtml(entry.overview ?? "")}</p>
        <pre>${escapeHtml(prompt)}</pre>
        <label class="modal-field">${t("improvePrompt")}
          <textarea id="assetImprovePrompt" rows="5">${escapeHtml(asset.improvementPrompt ?? "")}</textarea>
        </label>
        <div class="modal-actions">
          <button class="ghost danger" id="deleteAssetBtn" type="button"><i class="fa-solid fa-trash" aria-hidden="true"></i> ${t("deleteAsset")}</button>
          <button class="ghost" id="saveImprovePrompt" type="button">${t("saveImprovePrompt")}</button>
          <button class="primary" id="queueImproveAsset" type="button" ${asset.requestStatus === "requested" ? "disabled" : ""}>${asset.requestStatus === "requested" ? t("requested") : t("queueImprove")}</button>
        </div>
      </div>
    </div>
  `;
  $("#modal").classList.add("open");
  $("#closeModal").onclick = () => $("#modal").classList.remove("open");
  $("#deleteAssetBtn").onclick = () => deleteAsset(entry, asset);
  $("#saveImprovePrompt").onclick = async () => {
    asset.improvementPrompt = $("#assetImprovePrompt").value;
    await saveDeck(false);
    render();
    toast(t("saveImprovePrompt"));
  };
  $("#queueImproveAsset").onclick = async () => {
    asset.improvementPrompt = $("#assetImprovePrompt").value;
    await enqueueTargets([improveTarget({ entry, asset })]);
    $("#modal").classList.remove("open");
  };
  $("#modal").onclick = (event) => {
    if (event.target.id === "modal") $("#modal").classList.remove("open");
  };
}

function toast(message) {
  clearTimeout(state.toastTimer);
  const node = $("#toast");
  node.textContent = message;
  node.classList.add("show");
  state.toastTimer = setTimeout(() => node.classList.remove("show"), 4200);
}

loadDeck().catch((error) => {
  document.body.innerHTML = `<pre>${escapeHtml(error.stack || error.message)}</pre>`;
});
