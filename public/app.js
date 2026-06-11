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
    kitRouteChoose: "作り方を選ぶ（どちらかのルートへ）",
    routeA: "A. シートを作る",
    routeABadge: "推奨",
    routeB: "B. パーツに分解",
    routeBBadge: "部分修正用",
    kitSheetTitle: "シートを作る（推奨）",
    kitSheetIntro: "選んだ参照画像から、同一性の正となるリファレンスシートを1回の生成で作ります。生成結果を採用するとマスターの正＝新規画像の既定参照になります。プロンプトはテンプレとして保存・使い回しできます（コミュニティの優れたシートプロンプトを貼ってもOK）。",
    sheetName: "シート名",
    sheetTpl: "プロンプトテンプレ",
    sheetTplBuiltin: "標準テンプレ（内蔵）",
    sheetSaveTpl: "テンプレとして保存",
    sheetTplSaved: "テンプレを保存しました",
    sheetQueue: "シート生成を依頼",
    sheetQueued: "シート生成をキューに登録しました。「依頼文コピー」でエージェントへ。",
    sheetNeedPrompt: "シートのプロンプトを入力してください",
    kitDecomposeTitle: "パーツに分解（シートの部分修正用）",
    kitDecomposeIntro: "シートの一部だけ直したいとき（角の形・翼の構造など）に使います。パーツ単体の高精細な正を作って改善し、直したパーツを参照に付けてシートを再生成すると、シート全体を崩さず部分更新できます。",
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
    registerImage: "画像を登録",
    allLabel: "すべて",
    adoptOneHelp: "採用＝この行の正。チェックすると他の候補の採用は自動で外れます（履歴として残ります）。",
    entryFile: "生成済みファイル（任意）",
    entryFileHelp: "ファイルを選択すると workspace の正しい場所へコピーされ、この素材の生成画像として登録されます（既定で採用＝正になります）。",
    newEntryRefs: "参照する採用画像（任意・複数可）",
    newEntryRefsHelp: "選んだ画像は元画像（生成入力・リンク式）として添付されます。マスターの正は既定で選択済み（クリックで外せます）。参照は2〜4枚が適正で、多すぎると精度が落ちます。",
    kitNoAdopted: "採用済みの画像がありません。ベース／画像タブのカードで「採用」にチェックを入れると、ここに表示されます。",
    promptShown: "この画像を生成したプロンプト",
    promptNext: "プロンプト（次の生成用）",
    refUrl: "参考URL（任意）",
    refUrlHelp: "雰囲気・構図の参考にしたい投稿やページのURL。キュー依頼のJSONに含まれます。",
    refUrlQueue: "AIに任せてキューへ",
    aiDraftHelp: "URLだけでOK。ボタンを押すと題名と生成プロンプトをAIエージェントが書き、取り込み後そのまま生成キューへ進みます。",
    draftPrompt: "AIプロンプト作成",
    aiDraftNeedsUrl: "プロンプト作成をAIに任せる場合は参考URLを入力してください",
    genImages: "生成画像",
    refRole: "元画像",
    sourceImages: "元画像（生成入力）",
    refImagesHelp: "この行を生成するときにAIへ添付される入力画像です。成果物（採用）の対象ではありません。",
    asReference: "元画像（生成入力）として登録",
    asReferenceHelp: "チェックすると生成時の入力（参照）として使われます。チェックしなければ生成画像（候補）として登録されます。",
    kitImported: "ベースを作成しました",
    kitImportedQueued: "ベースの先頭に追加し、画像生成をキューに登録しました",
    kitNoSource: "ベース画像を選択してください",
    improveMode: "改善の強さ",
    improveModeTweak: "微調整（この画像を活かして直す）",
    improveModeRebuild: "作り直し（正に合わせて描き直す）",
    improveModeHelp: "同一性のズレ（顔の形・角の大きさ等）を直すときは「作り直し」を選んでください。微調整は元画像に強くアンカーされるため、ズレ自体は直りにくくなります。",
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
    downloadSelected: "選択をDL",
    durationSec: "動画の長さ（秒）",
    framePair: "フレーム（始まり / 終わり）",
    clearFrame: "未設定にする",
    addAsset: "素材追加",
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
    sourceFileHelp: "ファイルを選択すると workspace の正しい場所へコピーされます。",
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
    linkPrefix: "リンク:",
    gallery: "ギャラリー",
    galleryTooltip: "採用画像ギャラリー",
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
    assetAddedCompleted: "素材を登録し、依頼中だったキューを完了にしました",
    characterAdded: "キャラクターを追加しました",
    characterUpdated: "キャラクターを更新しました",
    characterDeleted: "キャラクターを削除しました",
    batchImproveTitle: "改善指示を入力",
    commonImprovePrompt: "共通の改善指示",
    applyCommonImprove: "共通指示で登録",
    editIndividually: "個別に調整",
    batchImproveNote: "共通指示でまとめて登録できます。個別に調整する場合は素材カードを開いてください。",
    addToCategory: (cat) => `${cat}を追加`,
    unset: "未設定",
    pickImage: "クリックで画像を選択",
    clickToPick: "（クリックで選択）",
    partsCount: (n) => `${n}パーツ`,
    referenceSheetSuffix: "リファレンスシート",
    sampleLabelFace: "顔アップ（正面）",
    refLinkNote: "元画像（リンク参照：キュー登録時にリンク先の最新の採用画像へ解決）",
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
    kitRouteChoose: "Choose a route (either one)",
    routeA: "A. Create the sheet",
    routeABadge: "Recommended",
    routeB: "B. Decompose into parts",
    routeBBadge: "For partial repair",
    kitSheetTitle: "Create the identity sheet (recommended)",
    kitSheetIntro: "One-shot generate the canonical reference sheet from the selected references. Adopt the result and it becomes the master canonical = default reference for new images. Prompts are saved as reusable templates (community sheet prompts welcome).",
    sheetName: "Sheet name",
    sheetTpl: "Prompt template",
    sheetTplBuiltin: "Built-in template",
    sheetSaveTpl: "Save as template",
    sheetTplSaved: "Template saved",
    sheetQueue: "Queue sheet generation",
    sheetQueued: "Sheet generation queued. Use 'Copy agent prompt' to hand it off.",
    sheetNeedPrompt: "Enter the sheet prompt",
    kitDecomposeTitle: "Decompose into parts (for partial sheet repair)",
    kitDecomposeIntro: "Use when one part of the sheet needs fixing (horn shape, wing structure...). Generate a high-detail canonical for just that part, improve it, then regenerate the sheet with the fixed part attached as a reference.",
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
    registerImage: "Register image",
    allLabel: "All",
    adoptOneHelp: "Adopted = the canonical image for this row. Checking it un-adopts the other candidates (kept as history).",
    entryFile: "Existing generated file (optional)",
    entryFileHelp: "Pick a file and it is copied into the workspace and registered as this entry's generated image (adopted by default).",
    newEntryRefs: "Adopted images to reference (optional, multiple)",
    newEntryRefsHelp: "Selections are attached as linked source images. Master canonicals are pre-selected (click to remove). 2-4 references work best; too many dilute accuracy.",
    kitNoAdopted: "No adopted images yet. Check 'Adopt' on cards in the Base / Image tabs to make them selectable here.",
    promptShown: "Prompt that generated this image",
    promptNext: "Prompt (for the next generation)",
    refUrl: "Reference URL (optional)",
    refUrlHelp: "URL of a post/page used as inspiration. Included in the queue request JSON.",
    refUrlQueue: "Queue via AI",
    aiDraftHelp: "URL only is fine. The AI agent writes the title and the generation prompt, then the entry is queued for generation automatically.",
    draftPrompt: "AI prompt draft",
    aiDraftNeedsUrl: "Enter a reference URL to let the AI draft the prompt",
    genImages: "Generated images",
    refRole: "Source",
    sourceImages: "Source images (generation input)",
    refImagesHelp: "Input images attached to the AI when generating this row. Not adoption candidates.",
    asReference: "Register as source image (generation input)",
    asReferenceHelp: "Checked: used as generation input. Unchecked: registered as a generated candidate.",
    kitImported: "Base entries created",
    kitImportedQueued: "Added to the top of Base and queued image generation",
    kitNoSource: "Select a source image first",
    improveMode: "Improvement strength",
    improveModeTweak: "Tweak (keep this image)",
    improveModeRebuild: "Rebuild (redraw to match canon)",
    improveModeHelp: "Pick Rebuild to fix identity drift (face shape, horn size...). Tweak anchors strongly to the source image, so the drift itself rarely changes.",
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
    downloadSelected: "Download selected",
    durationSec: "Video length (sec)",
    framePair: "Frames (start / end)",
    clearFrame: "Clear",
    addAsset: "Add asset",
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
    sourceFileHelp: "Pick a file; it is copied into the workspace.",
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
    linkPrefix: "Linked:",
    gallery: "Gallery",
    galleryTooltip: "Adopted image gallery",
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
    assetAddedCompleted: "Asset registered; the pending queue target was marked completed",
    characterAdded: "Character was added",
    characterUpdated: "Character was updated",
    characterDeleted: "Character was deleted",
    batchImproveTitle: "Add improvement instructions",
    commonImprovePrompt: "Shared improvement instructions",
    applyCommonImprove: "Queue with shared instructions",
    editIndividually: "Edit individually",
    batchImproveNote: "Add shared instructions here, or open each asset card to edit individually.",
    addToCategory: (cat) => `Add ${cat}`,
    unset: "Unset",
    pickImage: "Click to pick an image",
    clickToPick: "(click to pick)",
    partsCount: (n) => `${n} parts`,
    referenceSheetSuffix: "Reference Sheet",
    sampleLabelFace: "Face close-up (front)",
    refLinkNote: "Source image (linked: resolves to the linked entry's latest adopted image when queued)",
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

// First-run UI language: Japanese only when the browser prefers a ja* locale,
// English otherwise. An explicit deck.settings.lang always wins over this (see
// loadDeck), and the header toggle still switches freely at any time.
function detectDefaultLang() {
  const nav = typeof navigator !== "undefined" ? navigator : {};
  const candidates = [
    ...(Array.isArray(nav.languages) ? nav.languages : []),
    nav.language,
  ];
  for (const code of candidates) {
    if (typeof code === "string" && code.toLowerCase().startsWith("ja")) return "ja";
  }
  return "en";
}

const state = {
  deck: null,
  mode: "image",
  lang: detectDefaultLang(),
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

// Locally vendored icons (replaces the Font Awesome CDN — keeps the app fully
// offline / zero-dependency). Path data is from Font Awesome 6 Free Solid
// (CC BY 4.0, https://fontawesome.com/license/free). Each entry stores its
// native viewBox width; height is the FA standard 512.
const ICONS = {
  plus: { w: 448, d: "M256 80c0-17.7-14.3-32-32-32s-32 14.3-32 32V224H48c-17.7 0-32 14.3-32 32s14.3 32 32 32H192V432c0 17.7 14.3 32 32 32s32-14.3 32-32V288H400c17.7 0 32-14.3 32-32s-14.3-32-32-32H256V80z" },
  trash: { w: 448, d: "M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z" },
  copy: { w: 448, d: "M208 0H332.1c12.7 0 24.9 5.1 33.9 14.1l67.9 67.9c9 9 14.1 21.2 14.1 33.9V336c0 26.5-21.5 48-48 48H208c-26.5 0-48-21.5-48-48V48c0-26.5 21.5-48 48-48zM48 128h80v64H64V448H256V416h64v48c0 26.5-21.5 48-48 48H48c-26.5 0-48-21.5-48-48V176c0-26.5 21.5-48 48-48z" },
  download: { w: 512, d: "M288 32c0-17.7-14.3-32-32-32s-32 14.3-32 32V274.7l-73.4-73.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l128 128c12.5 12.5 32.8 12.5 45.3 0l128-128c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L288 274.7V32zM64 352c-35.3 0-64 28.7-64 64v32c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V416c0-35.3-28.7-64-64-64H346.5l-45.3 45.3c-25 25-65.5 25-90.5 0L165.5 352H64zm368 56a24 24 0 1 1 0 48 24 24 0 1 1 0-48z" },
  robot: { w: 640, d: "M320 0c17.7 0 32 14.3 32 32V96H472c39.8 0 72 32.2 72 72V440c0 39.8-32.2 72-72 72H168c-39.8 0-72-32.2-72-72V168c0-39.8 32.2-72 72-72H288V32c0-17.7 14.3-32 32-32zM208 384c-8.8 0-16 7.2-16 16s7.2 16 16 16h32c8.8 0 16-7.2 16-16s-7.2-16-16-16H208zm96 0c-8.8 0-16 7.2-16 16s7.2 16 16 16h32c8.8 0 16-7.2 16-16s-7.2-16-16-16H304zm96 0c-8.8 0-16 7.2-16 16s7.2 16 16 16h32c8.8 0 16-7.2 16-16s-7.2-16-16-16H400zM264 256a40 40 0 1 0 -80 0 40 40 0 1 0 80 0zm152 40a40 40 0 1 0 0-80 40 40 0 1 0 0 80zM48 224H64V416H48c-26.5 0-48-21.5-48-48V272c0-26.5 21.5-48 48-48zm544 0c26.5 0 48 21.5 48 48v96c0 26.5-21.5 48-48 48H576V224h16z" },
  images: { w: 576, d: "M160 32c-35.3 0-64 28.7-64 64V320c0 35.3 28.7 64 64 64H512c35.3 0 64-28.7 64-64V96c0-35.3-28.7-64-64-64H160zM396 138.7l96 144c4.9 7.4 5.4 16.8 1.2 24.6S480.9 320 472 320H328 280 192c-9.2 0-17.6-5.3-21.6-13.6s-2.9-18.2 2.9-25.4l64-80c4.6-5.7 11.4-9 18.7-9s14.2 3.3 18.7 9l17.3 21.6 56-84C360.5 132.1 368 128 376 128s15.5 4.1 20 10.7zM192 128a32 32 0 1 1 0 64 32 32 0 1 1 0-64zM48 120c0-13.3-10.7-24-24-24S0 106.7 0 120V344c0 75.1 60.9 136 136 136H456c13.3 0 24-10.7 24-24s-10.7-24-24-24H136c-48.6 0-88-39.4-88-88V120z" },
  "pen-to-square": { w: 512, d: "M471.6 21.7c-21.9-21.9-57.3-21.9-79.2 0L362.3 51.7l97.9 97.9 30.1-30.1c21.9-21.9 21.9-57.3 0-79.2L471.6 21.7zm-299.2 220c-6.1 6.1-10.8 13.6-13.5 21.9l-29.6 88.8c-2.9 8.6-.6 18.1 5.8 24.6s15.9 8.7 24.6 5.8l88.8-29.6c8.2-2.7 15.7-7.4 21.9-13.5L437.7 172.3 339.7 74.3 172.4 241.7zM96 64C43 64 0 107 0 160V416c0 53 43 96 96 96H352c53 0 96-43 96-96V320c0-17.7-14.3-32-32-32s-32 14.3-32 32v96c0 17.7-14.3 32-32 32H96c-17.7 0-32-14.3-32-32V160c0-17.7 14.3-32 32-32h96c17.7 0 32-14.3 32-32s-14.3-32-32-32H96z" },
};
function icon(name) {
  const def = ICONS[name];
  if (!def) return "";
  return `<svg class="icon-svg" aria-hidden="true" focusable="false" viewBox="0 0 ${def.w} 512" width="1em" height="1em" fill="currentColor"><path d="${def.d}"></path></svg>`;
}

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

function defaultCategoryLabels(ch) {
  return ch.workflow === "material" ? structuredClone(MATERIAL_CATEGORY_LABELS) : {};
}

function safeLinkUrl(value) {
  const url = String(value ?? "").trim();
  return /^https?:\/\//i.test(url) ? url : "";
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
  let result;
  try {
    result = await api("/api/state", {
      method: "PUT",
      body: JSON.stringify(state.deck),
    });
  } catch (error) {
    if (String(error.message).startsWith("409")) {
      const message = state.lang === "en"
        ? "Deck was updated elsewhere — reloaded latest. Redo your last change."
        : "他の画面で更新されていたため最新を読み込みました。直前の変更はやり直してください。";
      await loadDeck();
      toast(message);
      // 呼び出し元のフロー（キュー登録・自動採用など）を古い前提のまま続行させない
      throw new Error(message);
    }
    throw error;
  }
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

function setAdopted(entry, asset, adopted) {
  // 採用＝この行の「正」。生成画像のうち常に1枚だけが採用になる（履歴は未採用候補として残る）
  if (adopted) {
    for (const item of entry.assets ?? []) {
      if (!isSourceRef(item)) item.adopted = item.id === asset.id;
    }
  } else {
    asset.adopted = false;
  }
}

function resolveReferenceFile(asset) {
  // linkEntryId 付きの元画像は「その entry の現在の正（採用画像）」に解決する
  if (asset?.linkEntryId) {
    const linked = findEntry(asset.linkEntryId);
    const canonical = linked ? adoptedAssets(linked).find((item) => item.file) : null;
    if (canonical?.file) return canonical.file;
  }
  return asset?.file ?? "";
}

function referenceAssets(entry) {
  return (entry.assets ?? []).filter((asset) => isSourceRef(asset) && asset.file);
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
  return entry.prompt ?? "";
}

function statusClass(entry) {
  return entry.requestStatus || "idle";
}

function statusBadge(entry) {
  const status = statusClass(entry);
  if (status === "idle") return "";
  return `<span class="badge ${status}">${t(status)}</span>`;
}

function mediaTag(file, alt = "", opts = {}) {
  if (/\.(mp4|webm)$/i.test(file ?? "")) {
    return opts.preview
      ? `<video src="${assetUrl(file)}" muted loop autoplay playsinline style="pointer-events:none"></video>`
      : `<video src="${assetUrl(file)}" controls muted loop playsinline preload="metadata"></video>`;
  }
  return `<img src="${assetUrl(file)}" alt="${escapeHtml(alt)}" loading="lazy">`;
}

function assetCard(asset, entry) {
  const adopted = asset.adopted ? " adopted" : "";
  const requested = asset.requestStatus === "requested";
  const image = asset.file
    ? mediaTag(asset.file, asset.name)
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

function rowQueueButton(entry) {
  if (entry.requestStatus === "requested") {
    return `<button class="ghost small" data-cancel-entry-request="${escapeHtml(entry.id)}">${t("cancelRequest")}</button>`;
  }
  return `<button class="ghost small request-row" data-request-one="${escapeHtml(entry.id)}">${t("requestOne")}</button>`;
}

function duplicateButton(entry) {
  return `<button class="icon" data-dup="${escapeHtml(entry.id)}" title="${t("duplicate")}" aria-label="${t("duplicate")}">${icon("copy")}</button>`;
}

function deleteEntryButton(entry) {
  return `<button class="icon danger" data-delete="${escapeHtml(entry.id)}" title="${t("delete")}" aria-label="${t("delete")}">${icon("trash")}</button>`;
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
      <label class="bcard-check" title="${t("downloadSelected")}">
        <input type="checkbox" data-select-card="${escapeHtml(entry.id)}" ${entry.checked ? "checked" : ""}>
      </label>
      <div class="bcard-thumb">
        ${main ? `<img src="${assetUrl(main.file)}" alt="${escapeHtml(entry.overview)}" loading="lazy">` : `<span class="no-image">${t("noImage")}</span>`}
      </div>
      <div class="bcard-title">${escapeHtml(entry.overview)}</div>
      <div class="bcard-meta">${main ? `<button class="kit-chip adopt-toggle ${main.adopted ? "adopted-chip" : ""}" data-adopt-chip="${escapeHtml(entry.id)}">${main.adopted ? "✓ " : ""}${t("adopted")}</button>` : ""}${(entry.tags ?? []).includes("base-kit") ? `<span class="kit-chip">${t("kitChip")}</span>` : ""}${statusBadge(entry)}</div>
    </div>
  `;
}

function openEntryModal(entryId, shownAssetId = null) {
  const entry = findEntry(entryId);
  if (!entry) return;
  const isImage = (character().images ?? []).some((item) => item.id === entry.id);
  const isVideo = (character().videos ?? []).some((item) => item.id === entry.id);
  const sources = (entry.assets ?? []).filter(isSourceRef);
  const generated = (entry.assets ?? []).filter((asset) => !isSourceRef(asset));
  const shown = (entry.assets ?? []).find((asset) => asset.id === shownAssetId)
    ?? generated.find((asset) => asset.adopted && asset.file)
    ?? generated.find((asset) => asset.file)
    ?? sources.find((asset) => resolveReferenceFile(asset))
    ?? null;
  const shownFile = shown ? (isSourceRef(shown) ? resolveReferenceFile(shown) : shown.file) : "";
  const requested = entry.requestStatus === "requested";
  const refresh = () => openEntryModal(entry.id, shown?.id ?? null);
  const thumb = (asset, role) => {
    const file = role === "src" ? resolveReferenceFile(asset) : asset.file;
    const thumbName = (asset.linkEntryId ? `${t("linkPrefix")} ` : "") + (asset.name ?? asset.id);
    return `
    <button class="emodal-thumb ${shown && shown.id === asset.id ? "shown" : ""}" data-show-asset="${escapeHtml(asset.id)}" title="${escapeHtml(thumbName)}">
      ${file ? mediaTag(file, thumbName, { preview: true }) : "—"}
      ${role === "src" ? `<span class="emodal-thumb-tag">${t("refRole")}</span>` : asset.adopted ? `<span class="emodal-thumb-tag adopted">${t("adopted")}</span>` : ""}
      <span class="emodal-thumb-x" data-del-asset="${escapeHtml(asset.id)}" title="${t("deleteAsset")}">×</span>
    </button>`;
  };
  $("#modal").innerHTML = `
    <button class="close" id="closeModal" title="${t("close")}" aria-label="${t("close")}">×</button>
    <div class="modal-card emodal">
      <div class="modal-media">
        ${shownFile ? mediaTag(shownFile, entry.overview) : `<span class="emodal-empty">${t("noImage")}</span>`}
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
              : `<label class="asset-adopt" title="${escapeHtml(t("adoptOneHelp"))}"><input type="checkbox" id="entryModalAdoptShown" ${shown.adopted ? "checked" : ""}> ${t("adopt")}</label>
                 <button class="ghost small" id="entryModalAssetDetail">${t("editImprovePrompt")}</button>`}
          </div>` : ""}
        ${shown && !isSourceRef(shown) ? `
        <label class="emodal-prompt">${t("promptShown")}
          <textarea id="entryModalAssetPrompt" rows="5">${escapeHtml(shown.prompt ?? "")}</textarea>
        </label>` : ""}
        <label class="emodal-prompt emodal-prompt-next">${t("promptNext")}
          <textarea id="entryModalPrompt" rows="${shown && !isSourceRef(shown) && (shown.prompt ?? "").trim() ? 3 : 6}">${escapeHtml(entry.prompt ?? "")}</textarea>
        </label>
        <label class="emodal-prompt">${t("refUrl")}${safeLinkUrl(entry.referenceUrl) ? ` <a href="${escapeHtml(safeLinkUrl(entry.referenceUrl))}" target="_blank" rel="noopener" title="${t("refUrl")}">↗</a>` : ""}
          <input id="entryModalRefUrl" type="url" placeholder="https://x.com/..." value="${escapeHtml(entry.referenceUrl ?? "")}">
        </label>
        <h4>${t("genImages")}</h4>
        <div class="emodal-thumbs">
          ${generated.length ? generated.map((asset) => thumb(asset, "gen")).join("") : `<p class="form-note">${t("noImage")}</p>`}
          <button class="ghost small" id="entryModalRegisterImage">${icon("plus")} ${t("registerImage")}</button>
        </div>
        ${isVideo ? `
        <h4>${t("framePair")}</h4>
        <div class="emodal-frames">
          ${frameCard(t("start"), entry.startFrame, entry.id, "startFrame")}
          ${frameCard(t("end"), entry.endFrame, entry.id, "endFrame")}
        </div>` : ""}
        ${sources.length ? `<h4>${t("sourceImages")}</h4><p class="form-note">${t("refImagesHelp")}</p><div class="emodal-thumbs">${sources.map((asset) => thumb(asset, "src")).join("")}</div>` : ""}
        <div class="entry-modal-actions">
          <button class="ghost danger" id="entryModalDelete">${icon("trash")} ${t("delete")}</button>
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
  document.querySelectorAll("#modal [data-pick-frame-entry]").forEach((button) => {
    button.onclick = (event) => {
      event.stopPropagation();
      openFramePicker(button.dataset.pickFrameEntry, button.dataset.pickFrameField, true);
    };
  });
  const closeModal = () => $("#modal").classList.remove("open");
  $("#closeModal").onclick = closeModal;
  $("#modal").onclick = (event) => { if (event.target.id === "modal") closeModal(); };
  const commitFields = () => {
    entry.overview = $("#entryModalTitle").value;
    entry.prompt = $("#entryModalPrompt").value;
    if ($("#entryModalRefUrl")) entry.referenceUrl = $("#entryModalRefUrl").value.trim();
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
  if ($("#entryModalRegisterImage")) $("#entryModalRegisterImage").onclick = () => { closeModal(); openAssetForm(entry.id); };
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
      setAdopted(entry, shown, $("#entryModalAdoptShown").checked);
      await saveDeck(false);
      render();
      refresh();
    };
  }
  if ($("#entryModalAssetDetail")) {
    $("#entryModalAssetDetail").onclick = () => openAsset(shown.id, entry.id);
  }
  $("#modal").querySelectorAll("[data-show-asset]").forEach((button) => {
    button.onclick = () => openEntryModal(entry.id, button.dataset.showAsset);
  });
  $("#modal").querySelectorAll("[data-del-asset]").forEach((span) => {
    span.onclick = async (event) => {
      event.stopPropagation();
      const target = (entry.assets ?? []).find((item) => item.id === span.dataset.delAsset);
      if (!target) return;
      await deleteAsset(entry, target);
      if (findEntry(entry.id)) openEntryModal(entry.id);
    };
  });
}

function frameAssetPool() {
  const ch = character();
  const sceneAssets = ch.images.flatMap((entry) => (entry.assets ?? [])
    .filter((asset) => asset.file && !isSourceRef(asset))
    .map((asset) => ({ asset, entry })));
  const baseAssets = allBaseEntries(ch)
    .flatMap((entry) => adoptedAssets(entry).map((asset) => ({ asset, entry })));
  return [...sceneAssets, ...baseAssets];
}

function frameCard(label, assetId, entryId, field) {
  const found = allImageAssets().find((asset) => asset.id === assetId);
  const image = found?.file
    ? `<img src="${assetUrl(found.file)}" alt="${escapeHtml(found.name)}" loading="lazy">`
    : `<span>${assetId ? "missing" : t("unset")}</span>`;
  const chosen = found ? (found.entry?.overview || found.name || found.id) : (assetId ? "missing" : t("unset"));
  return `<button type="button" class="frame-card" data-pick-frame-entry="${escapeHtml(entryId)}" data-pick-frame-field="${escapeHtml(field)}" title="${t("pickImage")}">
    <div class="thumb">${image}</div><div class="label">${label}: ${escapeHtml(chosen)}</div></button>`;
}

function openFramePicker(entryId, field, returnToModal = false) {
  const entry = findEntry(entryId);
  if (!entry) return;
  const closePicker = () => $("#modal").classList.remove("open");
  const finish = async (value) => {
    entry[field] = value;
    await saveDeck(false).catch((error) => toast(error.message));
    render();
    if (returnToModal && findEntry(entryId)) openEntryModal(entryId);
    else closePicker();
  };
  $("#modal").innerHTML = `
    <button class="close" id="closeModal" title="${t("close")}" aria-label="${t("close")}">×</button>
    <div class="modal-card frame-picker">
      <h3>${field === "startFrame" ? t("start") : t("end")}</h3>
      <div class="kit-sources frame-picker-pool">
        ${frameAssetPool().map(({ asset, entry: source }) => `
          <button type="button" class="kit-source ${entry[field] === asset.id ? "selected" : ""}" data-frame-pick="${escapeHtml(asset.id)}" title="${escapeHtml(source.overview)}">
            <span class="thumb"><img src="${assetUrl(asset.file)}" loading="lazy" alt="${escapeHtml(source.overview || asset.name || asset.id)}"></span>
            <span class="kit-source-name">${escapeHtml(source.overview || asset.name || asset.id)}</span>
          </button>`).join("")}
      </div>
      <div class="btns"><button class="ghost" id="framePickClear">${t("clearFrame")}</button></div>
    </div>`;
  $("#modal").classList.add("open");
  $("#closeModal").onclick = () => (returnToModal ? openEntryModal(entryId) : closePicker());
  $("#modal").onclick = (event) => { if (event.target.id === "modal") closePicker(); };
  $("#framePickClear").onclick = () => finish("");
  document.querySelectorAll("[data-frame-pick]").forEach((button) => {
    button.onclick = () => finish(button.dataset.framePick);
  });
}

function videoCard(entry) {
  const generated = (entry.assets ?? []).filter((asset) => !isSourceRef(asset));
  const main = generated.find((asset) => asset.adopted && asset.file) ?? generated.find((asset) => asset.file);
  return `
    <div class="bcard vcard ${entry.checked ? "selected" : ""}" data-open-entry="${escapeHtml(entry.id)}" title="${escapeHtml(entry.overview)}">
      <label class="bcard-check" title="${t("downloadSelected")}">
        <input type="checkbox" data-select-card="${escapeHtml(entry.id)}" ${entry.checked ? "checked" : ""}>
      </label>
      <div class="bcard-thumb">
        ${main ? mediaTag(main.file, entry.overview, { preview: true }) : `<span class="no-image">${t("noImage")}</span>`}
      </div>
      <div class="bcard-title">${escapeHtml(entry.overview)}</div>
      <div class="bcard-meta">${main ? `<button class="kit-chip adopt-toggle ${main.adopted ? "adopted-chip" : ""}" data-adopt-chip="${escapeHtml(entry.id)}">${main.adopted ? "✓ " : ""}${t("adopted")}</button>` : ""}<span class="kit-chip">${entry.durationSec ?? 8}s</span>${statusBadge(entry)}</div>
      <div class="vcard-frames">
        ${frameCard(t("start"), entry.startFrame, entry.id, "startFrame")}
        ${frameCard(t("end"), entry.endFrame, entry.id, "endFrame")}
      </div>
    </div>
  `;
}

function videoRow(entry) {
  return `
    <div class="row ${entry.checked ? "selected" : ""}" data-row-id="${escapeHtml(entry.id)}">
      <div class="row-top">
        <input class="check" type="checkbox" data-check="${escapeHtml(entry.id)}" ${entry.checked ? "checked" : ""} ${entry.requestStatus === "requested" ? "disabled" : ""}>
        <input class="title-input" data-title="${escapeHtml(entry.id)}" value="${escapeHtml(entry.overview)}">
        ${statusBadge(entry)}
        ${rowQueueButton(entry)}
        <button class="ghost small" data-add-asset="${escapeHtml(entry.id)}">${icon("plus")} ${t("addAsset")}</button>
        ${duplicateButton(entry)}
        ${deleteEntryButton(entry)}
      </div>
      ${promptBlock(entry)}
      <div class="frame-pair">
        ${frameCard(t("start"), entry.startFrame, entry.id, "startFrame")}
        ${frameCard(t("end"), entry.endFrame, entry.id, "endFrame")}
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
          <button class="ghost small" data-add-base-category="${escapeHtml(category)}">${icon("plus")} ${t("addToCategory")(catText(category))}</button>
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
      <button class="ghost" id="newEntryBtn">${icon("plus")} ${t("newEntry")}</button>
      <button class="ghost" id="downloadSelectedBtn">${icon("download")} ${t("downloadSelected")}${selectedRows().length ? `（${selectedRows().length}）` : ""}</button>
      ${state.mode === "base" ? `<button class="ghost" id="addCategoryBtn">${icon("plus")} ${t("addCategory")}</button>` : ""}
    </div>
  `;
}

const BUILTIN_SHEET_TEMPLATE = {
  id: "builtin-identity-sheet",
  // Display name is resolved per-language via t("sheetTplBuiltin") in
  // sheetTemplates(); see below. The `text` body below is an agent-facing
  // generation instruction and is intentionally JA-only by design (out of i18n
  // scope) — the bilingual production guidance inside it is meant for the agent.
  text: [
    "参照画像をキャラクターデザインの正として使用し、AI画像生成・i2i・動画生成で同一性を維持するための「AI可読型キャラクターリファレンスシート」を1枚作成してください。",
    "",
    "Create exactly ONE high-resolution reference sheet image. This is not a poster, not concept art, not a finished illustration — it is a practical production reference document.",
    "",
    "Faithfully preserve the character's identity from the attached reference image(s): face, eyes, hairstyle, hair colors, body proportions, silhouette, outfit design, colors, and attached body parts (horns, wings, tails, etc. are anatomy, not accessories). Do not redesign. Do not average into a generic face.",
    "",
    "Include, in an organized grid layout:",
    "- Full-body front, back, and side views (neutral standing pose)",
    "- Face close-up (front) with precise eye design",
    "- Expression variations (smile / neutral / angry / surprised)",
    "- Hair structure (front / side / back) with highlight and streak placement",
    "- Outfit reference (front and back) with fabric and fastener details",
    "- Attached body parts with natural attachment points",
    "- Color palette swatches with HEX codes for hair, eyes, skin, and outfit",
    "- Short AI-control annotations (e.g. \"do not shift hair hue\", \"keep shadow saturation low\")",
    "",
    "Style: clean cel-style anime rendering, white background, high readability, like a professional anime production design sheet. No dramatic lighting, no heavy painting, no watermark, no logo. One image only — no A/B variants.",
  ].join("\n"),
};

function sheetTemplates() {
  return [{ ...BUILTIN_SHEET_TEMPLATE, name: t("sheetTplBuiltin") }, ...(state.deck?.promptTemplates ?? [])];
}

// EN uses a space before the suffix ("Name Reference Sheet"); JA joins directly
// ("名前リファレンスシート"). Both call sites compose through this helper.
function defaultSheetName(ch) {
  const suffix = t("referenceSheetSuffix");
  return state.lang === "ja" ? `${ch.name}${suffix}` : `${ch.name} ${suffix}`;
}

function isSheetQueueRow(row) {
  return row.action === "generate" && ((findEntry(row.entryId)?.tags ?? []).includes("identity-sheet"));
}

function pendingQueueRow(row) {
  return `
    <div class="kit-result kit-pending">
      <span class="kit-result-info">
        <strong>${escapeHtml(row.overview || row.entryId)}</strong>
        <small>${t("requested")} ・ ${escapeHtml(formatDateTime(row.requestedAt))} ・ ${escapeHtml(row.requestId)}</small>
      </span>
      <span class="kit-actions">
        <button class="ghost small" data-copy-agent="${escapeHtml(row.requestId)}" data-target-index="${row.targetIndex}">${icon("robot")} ${t("copyAgentPrompt")}</button>
        <button class="ghost small danger" data-cancel-queue="${escapeHtml(row.requestId)}" data-target-index="${row.targetIndex}">${t("cancelRequest")}</button>
      </span>
    </div>`;
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
      <h3 class="kit-step">2. ${t("kitRouteChoose")}</h3>
      <div class="kit-routes">
        <div class="kit-route">
          <div class="kit-route-head"><strong>${t("routeA")}</strong><span class="kit-chip adopted-chip">${t("routeABadge")}</span></div>
          <p class="form-note">${t("kitSheetIntro")}</p>
          <label class="kit-name">${t("sheetName")}<input id="sheetName" value="${escapeHtml(kit.sheetName || defaultSheetName(ch))}"></label>
          <label class="kit-name">${t("sheetTpl")}
            <select id="sheetTplSelect">
              ${sheetTemplates().map((tpl) => `<option value="${escapeHtml(tpl.id)}" ${kit.sheetTplId === tpl.id ? "selected" : ""}>${escapeHtml(tpl.name)}</option>`).join("")}
            </select>
          </label>
          <label class="kit-name kit-extra">${t("prompt")}<textarea id="sheetPrompt" rows="8">${escapeHtml(kit.sheetPrompt ?? BUILTIN_SHEET_TEMPLATE.text)}</textarea></label>
          <div class="kit-actions">
            <button class="primary" id="sheetQueueBtn">${t("sheetQueue")}</button>
            <button class="ghost" id="sheetSaveTplBtn">${t("sheetSaveTpl")}</button>
          </div>
          ${(state.requests ?? []).filter((row) => row.characterId === ch.id && isSheetQueueRow(row)).map(pendingQueueRow).join("")}
        </div>
        <div class="kit-route">
          <div class="kit-route-head"><strong>${t("routeB")}</strong><span class="kit-chip">${t("routeBBadge")}</span></div>
          <p class="form-note">${t("kitDecomposeIntro")}</p>
          <p class="form-note">${t("kitPartsAuto")}</p>
          <label class="kit-name">${t("kitCharName")}<input id="kitCharName" value="${escapeHtml(kit.characterName || ch.name)}"></label>
          <label class="kit-name kit-extra">${t("kitExtra")}<textarea id="kitExtra" rows="2" placeholder="${escapeHtml(t("kitExtraHelp"))}">${escapeHtml(kit.extra ?? "")}</textarea></label>
          <div class="kit-actions"><button class="primary" id="kitAnalyzeBtn">${t("kitAnalyze")}</button></div>
          ${(state.requests ?? []).filter((row) => row.action === "analyze" && row.characterId === ch.id).map(pendingQueueRow).join("")}
          <h4 class="kit-route-sub">${t("kitPasteTitle")}</h4>
      ${(state.kitResults ?? []).length ? state.kitResults.map((result, index) => `
        <div class="kit-result">
          <span class="kit-result-info">
            <strong>${escapeHtml(result.characterName || result.characterId)}</strong>
            <small>${escapeHtml(result.sourceFile.split("/").pop() ?? "")} ・ ${escapeHtml(formatDateTime(result.completedAt))} ・ ${escapeHtml(t("partsCount")(result.parts.length))}</small>
          </span>
          <button class="ghost small" data-kit-result="${index}">${t("kitSelectParts")}</button>
        </div>`).join("") : `<p class="form-note">${t("kitResultsEmpty")}</p>`}
      <p class="form-note">${t("kitPasteHelp")}</p>
      <textarea id="kitJson" class="kit-json" rows="5" placeholder="${escapeHtml(`{"parts":[{"key":"face-front","label":"${t("sampleLabelFace")}","category":"master","prompt":"..."}]}`)}">${escapeHtml(kit.json ?? "")}</textarea>
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
      </div>
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
    ${filtered.length ? `<div class="bgrid">${filtered.map(videoCard).join("")}</div>` : `<div class="empty">${t("noRows")}</div>`}
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
                <span class="chip">${t(item.action === "improve" ? "improve" : item.action === "analyze" ? "analyze" : item.action === "draft-prompt" ? "draftPrompt" : "generate")}</span>
                <span class="chip">${t("requestedAt")}: ${escapeHtml(formatDateTime(item.requestedAt))}</span>
                <span class="queue-file" title="${escapeHtml(`${item.requestFile} / ${t("target")}: ${item.targetIndex}`)}">${escapeHtml(item.requestId)}</span>
              </div>
              <div class="queue-actions">
                <button class="ghost small" data-copy-agent="${escapeHtml(item.requestId)}" data-target-index="${item.targetIndex}">${icon("robot")} ${t("copyAgentPrompt")}</button>
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
                ${(item.referenceUrl ?? "").trim() ? `
                  <p class="form-note">${t("refUrl")}: ${safeLinkUrl(item.referenceUrl) ? `<a href="${escapeHtml(safeLinkUrl(item.referenceUrl))}" target="_blank" rel="noopener">${escapeHtml(item.referenceUrl)}</a>` : escapeHtml(item.referenceUrl)}</p>
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

function formFramePicker(field, label, form) {
  const selected = form.frameSel?.[field] ?? "";
  return `
      <div class="form-note"><strong>${label}</strong>${t("clickToPick")}</div>
      <div class="kit-sources form-ref-pool">
        ${frameAssetPool().map(({ asset, entry }) => `
          <button type="button" class="kit-source ${selected === asset.id ? "selected" : ""}"
            data-form-frame-field="${escapeHtml(field)}" data-form-frame-asset="${escapeHtml(asset.id)}" title="${escapeHtml(entry.overview)}">
            <span class="thumb"><img src="${assetUrl(asset.file)}" loading="lazy" alt="${escapeHtml(entry.overview || asset.name || asset.id)}"></span>
            <span class="kit-source-name">${escapeHtml(entry.overview || asset.name || asset.id)}</span>
          </button>`).join("")}
      </div>`;
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
    const refFilter = form.refFilter ?? "base";
    const refPool = state.mode === "image"
      ? adoptedImagePool()
        .filter((item) => item.asset.kind !== "video")
        .filter((item) => refFilter === "all" || item.origin === refFilter)
      : [];
    const refPicker = state.mode === "image" ? `
      <div class="form-note"><strong>${t("newEntryRefs")}</strong><br>${t("newEntryRefsHelp")}</div>
      <div class="kit-filter">
        ${[["base", t("base")], ["image", t("image")], ["all", t("allLabel")]].map(([key, label]) => `
          <button type="button" class="kit-filter-chip ${refFilter === key ? "active" : ""}" data-form-ref-filter="${key}">${label}</button>`).join("")}
      </div>
      <div class="kit-sources form-ref-pool">
        ${refPool.length ? refPool.map(({ asset, entry, origin }) => `
          <button type="button" class="kit-source ${(form.refSel ?? []).some((row) => row.assetId === asset.id) ? "selected" : ""}"
            data-form-ref-entry="${escapeHtml(entry.id)}" data-form-ref-asset="${escapeHtml(asset.id)}"
            data-form-ref-file="${escapeHtml(asset.file)}" data-form-ref-name="${escapeHtml(asset.name ?? asset.id)}"
            title="${escapeHtml(entry.overview)}">
            <span class="thumb"><img src="${assetUrl(asset.file)}" loading="lazy" alt="${escapeHtml(entry.overview || asset.name || asset.id)}"></span>
            <span class="kit-source-name">${escapeHtml(entry.overview || asset.name || asset.id)}</span>
            <span class="kit-source-origin">${origin === "base" ? t("base") : t("image")}</span>
          </button>`).join("") : `<p class="form-note">${t("kitNoAdopted")}</p>`}
      </div>` : "";
    body = `
      ${categoryField}
      <label>${t("assetName")}<input name="overview" required value="${escapeHtml(form.draftOverview ?? "")}" placeholder="${state.mode === "video" ? "fish-jump-loop" : "new asset prompt"}"></label>
      <label>${t("prompt")}<textarea name="prompt" rows="7">${escapeHtml(form.draftPrompt ?? "")}</textarea></label>
      <label>${t("refUrl")}
        <span class="form-refurl-row">
          <input name="referenceUrl" type="url" placeholder="https://x.com/..." value="${escapeHtml(form.draftReferenceUrl ?? "")}">
          ${state.mode === "image" ? `<button type="button" class="primary" id="refUrlQueueBtn">${t("refUrlQueue")}</button>` : ""}
        </span>
        <small>${state.mode === "image" ? t("aiDraftHelp") : t("refUrlHelp")}</small>
      </label>
      <label>${t("entryFile")}<input type="file" name="entryFileUpload" accept=".png,.jpg,.jpeg,.webp,.gif,.mp4,.webm"><small>${t("entryFileHelp")}</small></label>
      <label class="inline"><input name="entryFileAdopt" type="checkbox" checked> ${t("adopt")}<small>${t("adoptOneHelp")}</small></label>
      ${refPicker}
      ${state.mode === "video" ? `
        ${formFramePicker("startFrame", t("start"), form)}
        ${formFramePicker("endFrame", t("end"), form)}
        <label>${t("durationSec")}<select name="durationSec">${optionList([4, 6, 8, 10, 12].map((value) => ({ value: String(value), label: `${value}s` })), "8")}</select></label>
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
      <label>${t("sourceFile")} <span class="required">${t("required")}</span><input type="file" name="sourceFileUpload" required accept=".png,.jpg,.jpeg,.webp,.gif,.mp4,.webm"><small>${t("sourceFileHelp")}</small></label>
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
          <button class="icon-button" id="addCharacterBtn" title="${t("addCharacter")}" aria-label="${t("addCharacter")}">${icon("plus")}</button>
          <button class="icon-button" id="editCharacterBtn" title="${t("editCharacter")}" aria-label="${t("editCharacter")}">${icon("pen-to-square")}</button>
          <button class="icon-button danger" id="deleteCharacterBtn" title="${t("deleteCharacter")}" aria-label="${t("deleteCharacter")}">${icon("trash")}</button>
          <button class="ghost" id="langBtn">${state.lang === "ja" ? "English" : "日本語"}</button>
        </div>
      </header>
      <div class="toolbar action-bar">
        <label>${t("mode")}</label>
        <div class="tabs">
          ${["kit", "base", "image", "video", "queue"].map((mode) => `<button data-mode="${mode}" class="${state.mode === mode ? "active" : ""}">${t(mode)}${mode === "queue" && state.requests.length ? ` (${state.requests.length})` : ""}</button>`).join("")}
          <button id="galleryBtn" title="${t("galleryTooltip")}" aria-label="${t("galleryTooltip")}">${icon("images")} ${t("gallery")}</button>
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
  if (state.mode === "image") {
    // 既定参照＝マスターカテゴリの正（同一性の核）。パーツは必要なときだけ手動追加する
    const masterIds = new Set((character().base?.master ?? []).map((entry) => entry.id));
    state.form.refSel = adoptedImagePool()
      .filter(({ origin, entry, asset }) => origin === "base" && masterIds.has(entry.id) && asset.kind !== "video")
      .map(({ entry, asset }) => ({ entryId: entry.id, assetId: asset.id, file: asset.file, name: asset.name ?? asset.id }));
  }
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
  const referenceUrl = String(data.get("referenceUrl") ?? "").trim();
  const ids = entryIds(ch);
  if (state.mode === "base") {
    const category = String(data.get("category") ?? "master");
    const id = makeUniqueId(ids, `base-${slug(category)}-${slug(overview)}`);
    ch.base[category] = ch.base[category] ?? [];
    ch.base[category].push({
      id,
      overview,
      prompt,
      referenceUrl,
      version: 1,
      checked: false,
      requestStatus: "idle",
      tags: [],
      assets: [],
    });
    return id;
  }
  if (state.mode === "video") {
    const id = makeUniqueId(ids, `video-${slug(overview)}`);
    const outputDraft = String(data.get("outputDraft") ?? "").trim();
    ch.videos.push({
      id,
      overview,
      prompt,
      referenceUrl,
      version: 1,
      checked: false,
      requestStatus: "idle",
      tags: [],
      startFrame: String(state.form?.frameSel?.startFrame ?? ""),
      endFrame: String(state.form?.frameSel?.endFrame ?? ""),
      durationSec: Number(data.get("durationSec")) || 8,
      outputDraft,
      assets: [],
    });
    return id;
  }
  const id = makeUniqueId(ids, `image-${slug(overview)}`);
  const refSel = state.form?.refSel ?? [];
  ch.images.push({
    id,
    overview,
    prompt,
    referenceUrl,
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
      usageNotes: t("refLinkNote"),
      tags: ["source-reference"],
      linkEntryId: row.entryId,
    })),
  });
  return id;
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

async function uploadAssetFile(entryId, file, name = "") {
  const params = new URLSearchParams({
    characterId: state.characterId,
    entryId,
    filename: file.name,
    name,
  });
  const response = await fetch(`/api/assets/upload?${params}`, { method: "POST", body: file });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "upload failed");
  }
  return response.json();
}

async function submitEntryForm(form, aiDraftForce = false) {
  const data = new FormData(form);
  const entryFileAdopt = Boolean(data.get("entryFileAdopt"));
  const file = form.querySelector('input[name="entryFileUpload"]')?.files?.[0] ?? null;
  const aiDraft = state.mode === "image" && aiDraftForce;
  const newId = createEntryFromForm(form);
  state.form = null;
  await saveDeck(false);
  if (file && newId) {
    const result = await uploadAssetFile(newId, file);
    state.deck = result.state;
    normalizeDeck();
    if (entryFileAdopt) {
      const entry = findEntry(newId);
      const asset = entry?.assets?.find((item) => item.id === result.asset.id);
      if (entry && asset) {
        setAdopted(entry, asset, true);
        await saveDeck(false);
      }
    }
  }
  // 画像の新規作成（完成ファイルの登録ではない場合）は、そのまま生成キューに入れる
  // AIにプロンプト作成を任せる場合は draft-prompt 依頼（取り込み後にサーバが生成依頼を自動キュー）
  if (state.mode === "image" && !file && newId) {
    const entry = findEntry(newId);
    if (entry) {
      await requestEntries([entry], aiDraft ? "draft-prompt" : undefined);
      return;
    }
  }
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
  const file = form.querySelector('input[name="sourceFileUpload"]')?.files?.[0] ?? null;
  if (!file) {
    toast(t("sourceFileHelp"));
    return;
  }
  const entryId = state.form.entryId;
  const result = await uploadAssetFile(entryId, file, String(data.get("name") ?? "").trim());
  state.deck = result.state;
  normalizeDeck();
  const entry = findEntry(entryId);
  const asset = entry?.assets?.find((item) => item.id === result.asset.id);
  if (asset) {
    asset.prompt = String(data.get("prompt") ?? "");
    asset.sourceLicense = String(data.get("sourceLicense") ?? "");
    asset.aiGenerated = Boolean(data.get("aiGenerated"));
    asset.humanReviewed = Boolean(data.get("humanReviewed"));
    asset.usageNotes = String(data.get("usageNotes") ?? "");
    if (Boolean(data.get("asReference"))) {
      asset.tags = [...new Set([...(asset.tags ?? []), "source-reference"])];
      asset.adopted = false;
    } else if (Boolean(data.get("adopted"))) {
      setAdopted(entry, asset, true);
    }
    await saveDeck(false);
  }
  let completedQueue = false;
  if (entry && entry.requestStatus === "requested" && asset && !Boolean(data.get("asReference"))) {
    // 生成は手動で済んでいたケース：依頼中の generate target を完了扱いにしてバッジを外す
    const completedResult = await api("/api/requests/complete", {
      method: "POST",
      body: JSON.stringify({
        targets: [{ action: "generate", entryId, results: [{ file: asset.file, assetId: asset.id }] }],
      }),
    });
    state.deck = completedResult.state;
    normalizeDeck();
    completedQueue = true;
    await loadQueue(false);
  }
  state.form = null;
  render();
  toast(completedQueue ? t("assetAddedCompleted") : t("assetAdded"));
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
  if ($("#downloadSelectedBtn")) $("#downloadSelectedBtn").onclick = () => {
    const ids = selectedRows().map((entry) => entry.id);
    if (!ids.length) { toast(`${t("downloadSelected")}: 0`); return; }
    window.location.href = `/api/export?characterId=${encodeURIComponent(character().id)}&entries=${encodeURIComponent(ids.join(","))}`;
  };
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
  const galleryBtn = document.querySelector("#galleryBtn");
  if (galleryBtn) galleryBtn.onclick = () => { location.href = "/gallery.html"; };
  const refUrlQueueBtn = document.querySelector("#refUrlQueueBtn");
  if (refUrlQueueBtn) refUrlQueueBtn.onclick = async () => {
    const formEl = $("#activeForm");
    if (!formEl || !state.form) return;
    const referenceUrl = String(formEl.querySelector('input[name="referenceUrl"]')?.value ?? "").trim();
    if (!referenceUrl) {
      toast(t("aiDraftNeedsUrl"));
      return;
    }
    // 題名は仮置き（エージェントが complete 時に正式な題名とプロンプトを書く）
    const overviewInput = formEl.querySelector('input[name="overview"]');
    if (overviewInput && !overviewInput.value.trim()) overviewInput.value = draftTitleFromUrl(referenceUrl);
    await submitEntryForm(formEl, true);
  };
  document.querySelectorAll("[data-add-base-category]").forEach((button) => {
    button.onclick = () => openBaseCategoryForm(button.dataset.addBaseCategory);
  });
  document.querySelectorAll("[data-open-entry]").forEach((card) => {
    card.onclick = (event) => {
      if (event.target.closest(".bcard-check, .vcard-frames, .frame-select, [data-adopt-chip]")) return;
      openEntryModal(card.dataset.openEntry);
    };
  });
  document.querySelectorAll(".bcard-check").forEach((label) => {
    label.onclick = (event) => event.stopPropagation();
  });
  document.querySelectorAll("[data-select-card]").forEach((input) => {
    input.onchange = () => {
      const entry = findEntry(input.dataset.selectCard);
      if (!entry) return;
      entry.checked = input.checked;
      saveDeck(false).catch((error) => toast(error.message));
      render();
    };
  });
  document.querySelectorAll("[data-adopt-chip]").forEach((button) => {
    button.onclick = (event) => {
      event.stopPropagation();
      const entry = findEntry(button.dataset.adoptChip);
      if (!entry) return;
      const generated = (entry.assets ?? []).filter((asset) => !isSourceRef(asset));
      const main = generated.find((asset) => asset.adopted && asset.file) ?? generated.find((asset) => asset.file);
      if (!main) return;
      setAdopted(entry, main, !main.adopted);
      saveDeck(false).catch((error) => toast(error.message));
      render();
    };
  });
  document.querySelectorAll("#app [data-pick-frame-entry]").forEach((button) => {
    button.onclick = (event) => {
      event.stopPropagation();
      openFramePicker(button.dataset.pickFrameEntry, button.dataset.pickFrameField, false);
    };
  });
  document.querySelectorAll("[data-form-frame-asset]").forEach((button) => {
    button.onclick = () => {
      if (!state.form) return;
      captureEntryFormDrafts();
      state.form.frameSel = state.form.frameSel ?? {};
      const field = button.dataset.formFrameField;
      state.form.frameSel[field] = state.form.frameSel[field] === button.dataset.formFrameAsset ? "" : button.dataset.formFrameAsset;
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
  if ($("#sheetName")) $("#sheetName").onchange = () => { state.kit.sheetName = $("#sheetName").value; };
  if ($("#sheetPrompt")) $("#sheetPrompt").oninput = () => { state.kit.sheetPrompt = $("#sheetPrompt").value; };
  if ($("#sheetTplSelect")) {
    $("#sheetTplSelect").onchange = () => {
      const tpl = sheetTemplates().find((item) => item.id === $("#sheetTplSelect").value);
      if (!tpl) return;
      state.kit.sheetTplId = tpl.id;
      state.kit.sheetPrompt = tpl.text;
      render();
    };
  }
  if ($("#sheetQueueBtn")) $("#sheetQueueBtn").onclick = () => requestSheetGeneration().catch((error) => toast(error.message));
  if ($("#sheetSaveTplBtn")) {
    $("#sheetSaveTplBtn").onclick = async () => {
      const text = ($("#sheetPrompt")?.value ?? "").trim();
      if (!text) { toast(t("sheetNeedPrompt")); return; }
      const name = prompt(t("sheetSaveTpl"), "");
      if (!name) return;
      state.deck.promptTemplates = state.deck.promptTemplates ?? [];
      const tplId = makeUniqueId(new Set(sheetTemplates().map((item) => item.id)), `tpl-${slug(name)}`);
      state.deck.promptTemplates.push({ id: tplId, name, text });
      state.kit.sheetTplId = tplId;
      await saveDeck(false);
      render();
      toast(t("sheetTplSaved"));
    };
  }
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
      setAdopted(entry, asset, input.checked);
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
  const captureEntryFormDrafts = () => {
    const formEl = $("#activeForm");
    if (!formEl || !state.form) return;
    const data = new FormData(formEl);
    state.form.draftOverview = String(data.get("overview") ?? "");
    state.form.draftPrompt = String(data.get("prompt") ?? "");
    state.form.draftReferenceUrl = String(data.get("referenceUrl") ?? "");
  };
  document.querySelectorAll("[data-form-ref-filter]").forEach((button) => {
    button.onclick = () => {
      if (!state.form) return;
      captureEntryFormDrafts();
      state.form.refFilter = button.dataset.formRefFilter;
      render();
    };
  });
  document.querySelectorAll("[data-form-ref-asset]").forEach((button) => {
    button.onclick = () => {
      if (!state.form) return;
      captureEntryFormDrafts();
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

function draftTitleFromUrl(referenceUrl) {
  try {
    const url = new URL(referenceUrl);
    const host = url.hostname.replace(/^www\./, "");
    const handle = (host === "x.com" || host.endsWith("twitter.com"))
      ? url.pathname.split("/").filter(Boolean)[0] ?? ""
      : "";
    if (handle && handle !== "status" && handle !== "i") {
      return state.lang === "en" ? `From @${handle}` : `@${handle} の投稿参考`;
    }
    return state.lang === "en" ? `From ${host}` : `${host} 参考`;
  } catch {
    return state.lang === "en" ? "From reference URL" : "URL参考";
  }
}

function requestTarget(entry, action) {
  if (state.mode === "video") {
    const start = allImageAssets().find((assetItem) => assetItem.id === entry.startFrame);
    const end = allImageAssets().find((assetItem) => assetItem.id === entry.endFrame);
    return {
      action: "generate",
      entryId: entry.id,
      overview: entry.overview,
      prompt: entry.prompt,
      referenceUrl: entry.referenceUrl ?? "",
      inputs: {
        startFrame: start?.file ?? null,
        endFrame: end?.file ?? null,
        durationSec: entry.durationSec ?? 8,
        refImages: [start?.file, end?.file].filter(Boolean),
      },
      outputDir: entry.outputDraft ? entry.outputDraft.split("/").slice(0, -1).join("/") || null : null,
    };
  }
  const ownReferences = referenceAssets(entry).map((assetItem) => resolveReferenceFile(assetItem)).filter(Boolean);
  const ownAdopted = adoptedAssets(entry).map((assetItem) => assetItem.file).filter(Boolean);
  const refImages = [...new Set(ownReferences.length ? ownReferences : ownAdopted)];
  return {
    action: action ?? "generate",
    entryId: entry.id,
    overview: entry.overview,
    prompt: state.mode === "image" ? composedPrompt(entry) : entry.prompt,
    referenceUrl: entry.referenceUrl ?? "",
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

async function requestEntries(entries, action) {
  await enqueueTargets(entries.map((entryItem) => requestTarget(entryItem, action)));
}

function improvePrompt(asset, entry, mode = "tweak") {
  const basePrompt = asset.prompt || (state.mode === "image" ? composedPrompt(entry) : entry.prompt) || "";
  const instruction = String(asset.improvementPrompt ?? "").trim()
    || "Improve quality, readability, and asset extraction while preserving the useful composition and original intent.";
  if (mode === "rebuild") {
    return [
      "Recreate this asset so it correctly matches the character's canonical design.",
      "The attached identity reference image(s) are the GROUND TRUTH for face, colors, proportions, and attached body parts — match them precisely.",
      "The LAST attached image is the previous attempt: use it ONLY for composition, framing, and intent. Do NOT copy its incorrect details.",
      instruction,
      "Keep it usable as a game asset. No text, no logo, no watermark, no UI unless explicitly requested. Create exactly ONE image.",
      basePrompt ? `Original prompt:\n${basePrompt}` : "",
    ].filter(Boolean).join("\n\n");
  }
  return [
    "Improve the existing generated asset.",
    "The FIRST attached image is the asset to improve — keep its composition and intent.",
    "Any OTHER attached images are the original identity references (the character's canonical design): match face, colors, proportions, and attached body parts to them.",
    instruction,
    "Keep it usable as a game asset. No text, no logo, no watermark, no UI unless explicitly requested. Create exactly ONE image.",
    basePrompt ? `Original prompt:\n${basePrompt}` : "",
  ].filter(Boolean).join("\n\n");
}

function improveTarget({ entry, asset }) {
  const service = asset.kind === "video" ? "vidu" : "chatgpt";
  // 改善元を主参照に、元の生成で使った元画像（＋ベース参照合成の採用画像）も同一性維持のため添付する
  const mode = asset.improveMode === "rebuild" ? "rebuild" : "tweak";
  const originalRefs = referenceAssets(entry).map((item) => resolveReferenceFile(item));
  const refImages = mode === "rebuild"
    ? [...new Set([...originalRefs, asset.file].filter(Boolean))]
    : [...new Set([asset.file, ...originalRefs].filter(Boolean))];
  return {
    action: "improve",
    entryId: entry.id,
    assetId: asset.id,
    assetName: asset.name ?? asset.id,
    assetFile: asset.file ?? "",
    overview: `${entry.overview} / ${asset.name ?? asset.id}`,
    prompt: improvePrompt(asset, entry, mode),
    referenceUrl: entry.referenceUrl ?? "",
    basePrompt: asset.prompt || (state.mode === "image" ? composedPrompt(entry) : entry.prompt) || "",
    improvementPrompt: asset.improvementPrompt ?? "",
    service,
    inputs: {
      startFrame: null,
      endFrame: null,
      refImages,
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

async function requestSheetGeneration() {
  const kit = state.kit;
  if (!kit.sources.length) {
    toast(t("kitNoSource"));
    return;
  }
  const promptText = ($("#sheetPrompt")?.value ?? "").trim();
  if (!promptText) {
    toast(t("sheetNeedPrompt"));
    return;
  }
  const ch = character();
  const name = ($("#sheetName")?.value ?? "").trim() || defaultSheetName(ch);
  const ids = entryIds(ch);
  const id = makeUniqueId(ids, `base-sheet-${slug(name)}`);
  const refFiles = [];
  const assets = kit.sources.map((sel, index) => {
    const srcAsset = findEntry(sel.entryId)?.assets?.find((item) => item.id === sel.assetId);
    const resolved = srcAsset ? (resolveReferenceFile(srcAsset) || srcAsset.file) : "";
    if (resolved) refFiles.push(resolved);
    return {
      id: `asset-${id}-src-${index}`,
      kind: "image",
      file: srcAsset?.file ?? "",
      name: srcAsset?.name ?? "source",
      adopted: false,
      prompt: "",
      sourceLicense: "",
      aiGenerated: true,
      humanReviewed: true,
      usageNotes: t("refLinkNote"),
      tags: ["source-reference"],
      linkEntryId: sel.entryId,
    };
  });
  ch.base.master = ch.base.master ?? [];
  ch.base.master.unshift({
    id,
    overview: name,
    prompt: promptText,
    version: 1,
    checked: false,
    requestStatus: "idle",
    tags: ["identity-sheet"],
    assets,
  });
  await saveDeck(false);
  const queueResult = await api("/api/requests", {
    method: "POST",
    body: JSON.stringify({
      characterId: state.characterId,
      mode: "base",
      targets: [{
        action: "generate",
        entryId: id,
        overview: name,
        prompt: promptText,
        inputs: { startFrame: null, endFrame: null, refImages: [...new Set(refFiles)] },
        outputDir: null,
      }],
    }),
  });
  state.deck = queueResult.state;
  normalizeDeck();
  await loadQueue(false);
  render();
  toast(t("sheetQueued"));
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
  if (state.lang === "en") return agentPromptForEn(item);
  return agentPromptForJa(item);
}

// English handoff prompts. The macOS-only osascript keystroke flow is offered
// strictly as an optional fallback (and clearly gated to macOS), instead of
// being emitted unconditionally as it is in the Japanese path.
function agentPromptForEn(item) {
  const origin = window.location.origin;
  const root = state.projectRoot || "(server project root)";
  const refs = (item.inputs?.refImages ?? []).map((file) => `   - ${file}`).join("\n") || "   - (none)";
  const attachNote = `   Browser tips (field-tested):
   - Attaching images: prefer the browser tool's native file-attach / upload API. If that is unavailable, fall back to a paste flow.
     On macOS only, you can copy a file to the clipboard and paste it, e.g.:
       osascript -e 'set the clipboard to (read (POSIX file "<absolute path>") as «class PNGf»)'
       then bring the tab to the front, click the input, and trigger a real Cmd+V via System Events. Repeat one image at a time.
     On Windows/Linux there is no osascript — use the browser tool's upload API or your platform's clipboard-image mechanism instead.
   - Entering the prompt (try in this order; always confirm the full text landed in the input before sending — never send an empty input):
     1) the browser tool's text-input API (type/fill); 2) in-page JS document.execCommand("insertText", ...);
     3) (macOS fallback) put the text on the real clipboard, verify with pbpaste, click the input, and paste with a real Cmd+V (only after every image is attached).
   - If a previous unsent attachment is left in the input when you start, clear it with × before beginning.
   - Once the attachment spinner disappears, insert the prompt and send without delay (two screenshots — before and after sending — are enough).`;
  if (item.action === "analyze") {
    return `Process one image-arranger base-decomposition / image-analysis request.

Server: ${origin} (already running — do not start or restart the server or any dev server)
Working directory (projectRoot): ${root}
Target: requestId ${item.requestId} / targetIndex ${item.targetIndex} (action: analyze)

Steps (if a precondition cannot be met, stop and report rather than working around it):
1. Run curl -s ${origin}/api/requests and confirm the row for the above requestId / targetIndex still exists. If it is gone, stop and report.
2. This is an image-analysis task. Do NOT generate any image.
3. Open ChatGPT, attach the following images (paths relative to projectRoot), and send the row's prompt verbatim:
${refs}
${attachNote}
   - The reply can take 5–15 minutes. Poll with a light read every 30–60s; do not reload or resend.
4. Extract the JSON code block from the reply ({"character","parts":[{"key","label","category","prompt"}]}).
   Clicking the "Copy" button at the top-right of the code block is the reliable way to grab it (the clipboard API can fail due to focus constraints).
   Check that each parts[].prompt satisfies "single part / one image only / faithful trace of the original design (no redesign) /
   horns, wings, tails connected naturally as body parts / plain background / no text, logo, or watermark" and minimally fix any gaps.
   The parts MUST come from ChatGPT's reply. Do not write them yourself.
5. Report completion:
   curl -X POST ${origin}/api/requests/complete \\
     -H "Content-Type: application/json" \\
     -d '{"requestId":"${item.requestId}","targetIndex":${item.targetIndex},"parts":<the extracted JSON>}'
   Confirm that kitResultsStored in the response is 1.
   Note: the user creates the base entries by selecting parts in the UI, so the agent does not need to verify entry creation.
   Only if the POST fails, format the JSON and report it as-is (the user will import it from the screen).
6. Final report: list of the chosen parts / any fixes you made to the JSON / any issues you noticed, concisely.

Forbidden: generating images / inventing or editing requests / inventing parts / starting the server or a dev server / unrelated checkouts or worktree exploration.`;
  }
  if (item.action === "draft-prompt") {
    return `Process one image-arranger prompt-drafting request (reference URL).

Server: ${origin} (already running — do not start or restart the server or any dev server)
Working directory (projectRoot): ${root}
Target: requestId ${item.requestId} / targetIndex ${item.targetIndex} (action: draft-prompt)

Steps (if a precondition cannot be met, stop and report rather than working around it):
1. Run curl -s ${origin}/api/requests and confirm the row for the above requestId / targetIndex still exists. If it is gone, stop and report.
2. This is a prompt-drafting task. Do NOT generate an image at this stage.
3. Open the reference URL and analyze what makes the referenced image/post appealing (composition / pose / art style / color palette / props / mood):
   ${item.referenceUrl || "(no reference URL — write from the row's overview and identity references only)"}
4. Check the character's identity references (paths relative to projectRoot). Face, hair, colors, and attached parts are authoritative here:
${refs}
5. Write one English image-generation prompt that reproduces the appeal of the reference URL while strictly preserving the identity of the references.
   Requirements: one image only / concrete scene, composition, and lighting / do NOT override identity (hair color, eyes, horns, wings, tail, outfit follow the references) / no text, no logo, no watermark.
   Also write a short title that conveys the content at a glance (match the deck's display language, e.g. "Smiling at a shrine at dusk").
6. Report completion (escape the prompt and title as JSON strings):
   curl -X POST ${origin}/api/requests/complete \\
     -H "Content-Type: application/json" \\
     -d '{"requestId":"${item.requestId}","targetIndex":${item.targetIndex},"overview":"<short title>","prompt":"<the prompt you wrote>"}'
   The server imports the title and prompt into the entry and automatically queues the generation request (the response's draftQueued holds the new requestId).
7. Then re-fetch curl -s ${origin}/api/requests and process the auto-queued generation request as usual (the normal image-generation steps).
8. Final report: the prompt you wrote / the elements you read from the reference URL / where the result was saved, concisely.

Forbidden: generating an image without reporting the prompt first / inventing or editing requests / starting the server or a dev server / unrelated checkouts or worktree exploration.`;
  }
  const isImprove = item.action === "improve";
  return `Process one image-arranger image-${isImprove ? "improvement" : "generation"} request.

Server: ${origin} (already running — do not start or restart the server or any dev server)
Working directory (projectRoot): ${root}
Target: requestId ${item.requestId} / targetIndex ${item.targetIndex} (action: ${item.action} / service: ${item.service})

Steps (if a precondition cannot be met, stop and report rather than working around it):
1. Run curl -s ${origin}/api/requests and confirm the row for the above requestId / targetIndex still exists. If it is gone, stop and report.
2. Use the row's prompt as-is and attach all of the following reference images (paths relative to projectRoot, one at a time):
${refs}
${isImprove ? "   Treat the improvement source (inputs.sourceAsset) as the primary reference and prioritize improvementPrompt as the improvement intent. The other references are for identity preservation.\n" : ""}${attachNote}
3. 1 target = 1 deliverable. Do not produce multiple variants, grids, A/B comparisons, or contact sheets.
   Reuse a single working tab (do not open a new tab/window per target — use "New chat" in the same tab).
4. If refused by content policy etc.: 1) resend once with the same prompt; 2) resend once with a minimal wording change that does not alter the design;
   3) if it still fails, report an error and move on:
   curl -X POST ${origin}/api/requests/complete \\
     -H "Content-Type: application/json" \\
     -d '{"requestId":"${item.requestId}","targetIndex":${item.targetIndex},"error":"<reason and what you tried>"}'
5. Save the result to ${item.outputDir || "outputDir"} and report completion:
   curl -X POST ${origin}/api/requests/complete \\
     -H "Content-Type: application/json" \\
     -d '{"requestId":"${item.requestId}","targetIndex":${item.targetIndex},"results":[{"file":"<saved relative path>"}]}'
6. Final report: where it was saved / the quality points you checked / if there was an error, the reason and your next fix idea, concisely.

Forbidden: substituting screenshots, cache, or blob URLs when the normal UI cannot save / inventing or editing requests / starting the server or a dev server / unrelated checkout exploration.`;
}

function agentPromptForJa(item) {
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
   - 画像の添付: ネイティブのファイル選択ダイアログを開かない。
     osascript -e 'set the clipboard to (read (POSIX file "<絶対パス>") as «class PNGf»)'
     → 対象タブ前面化 → 入力欄クリック → System Events の実 Cmd+V。複数画像は1枚ずつ繰り返す。
   - プロンプトの入力（この順に試し、送信前に入力欄へ全文反映を必ず確認。空のまま送信しない）:
     ①ブラウザツールのテキスト入力API（type/fill） ②ページ内JSの document.execCommand("insertText", ...)
     ③argv渡しosascriptでテキストを実クリップボードへ→pbpasteで検証→入力欄クリック→実Cmd+V（画像添付が全部終わってから）。
   - 開始時、入力欄に前回の未送信添付が残っていたら×で消してから始める。
   - 添付のスピナー消滅を確認したら、プロンプト挿入→送信まで間を置かず一気に行う（確認スクショは送信前後の2回で十分）。
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
  if (item.action === "draft-prompt") {
    return `image-arranger のプロンプト作成依頼（URL参考）を1件処理してください。

サーバ: ${origin}（起動済み。サーバや開発サーバの起動・再起動はしない）
作業ディレクトリ（projectRoot）: ${root}
対象: requestId ${item.requestId} / targetIndex ${item.targetIndex}（action: draft-prompt）

手順（前提が満たせない場合は回避策を取らず停止して報告すること）:
1. curl -s ${origin}/api/requests で上記 requestId / targetIndex の行がまだあることを確認。無ければ停止して報告。
2. これはプロンプト作成タスク。この段階では画像を生成しない。
3. 参考URLを開き、参照されている画像・投稿の魅力（構図 / ポーズ / 画風 / 配色 / 小物 / 雰囲気）を分析する:
   ${item.referenceUrl || "(参考URLなし — 行の overview と identity 参照だけから書く)"}
4. キャラクターの identity 参照（projectRoot からの相対パス）を確認する。顔・髪・色・付属パーツはこちらが正:
${refs}
5. 参考URLの魅力を再現しつつ identity 参照のキャラクター同一性を厳守する画像生成プロンプトを英語で1本書く。
   要件: 1画像のみ / シーン・構図・ライティングを具体的に / identity の上書き禁止（髪色・目・角・翼・尻尾・衣装は参照優先）/ no text, no logo, no watermark。
   あわせて内容がひと目で分かる短い題名（デッキの表示言語に合わせる。例:「夕暮れの神社で微笑む」）も書く。
6. 完了報告（プロンプト・題名は JSON 文字列としてエスケープする）:
   curl -X POST ${origin}/api/requests/complete \\
     -H "Content-Type: application/json" \\
     -d '{"requestId":"${item.requestId}","targetIndex":${item.targetIndex},"overview":"<短い題名>","prompt":"<書いたプロンプト>"}'
   サーバが題名とプロンプトを entry に取り込み、生成依頼を自動でキューに追加する（レスポンスの draftQueued に新しい requestId）。
7. 続けて curl -s ${origin}/api/requests を再取得し、自動キューされた生成依頼をそのまま処理する（通常の画像生成手順）。
8. 最終報告: 書いたプロンプト / 参考URLから読み取った要素 / 生成結果の保存先を簡潔に。

禁止: プロンプト未報告のままの画像生成 / 依頼の自作・編集 / サーバ・開発サーバの起動 / 無関係な checkout や worktree の探索。`;
  }
  const isImprove = item.action === "improve";
  return `image-arranger の画像${isImprove ? "改善" : "生成"}依頼を1件処理してください。

サーバ: ${origin}（起動済み。サーバや開発サーバの起動・再起動はしない）
作業ディレクトリ（projectRoot）: ${root}
対象: requestId ${item.requestId} / targetIndex ${item.targetIndex}（action: ${item.action} / service: ${item.service}）

手順（前提が満たせない場合は回避策を取らず停止して報告すること）:
1. curl -s ${origin}/api/requests で上記 requestId / targetIndex の行がまだあることを確認。無ければ停止して報告。
2. 該当行の prompt をそのまま使い、参照画像は次をすべて添付する（projectRoot からの相対パス・1枚ずつ実Cmd+V）:
${refs}
${isImprove ? "   改善元（inputs.sourceAsset）を主参照として扱い、improvementPrompt を改善意図として優先する。他の参照は同一性維持用。\n" : ""}   プロンプトの入力（この順に試し、送信前に入力欄へ全文反映を必ず確認。空のまま送信しない）:
   ①ブラウザツールのテキスト入力API ②ページ内JS insertText ③argv渡しosascript→pbpaste検証→実Cmd+V（画像添付完了後）。
   開始時、入力欄に前回の未送信添付が残っていたら×で消してから始める。添付完了→挿入→送信は一気に行う。
3. 1 target = 1成果物。複数案・グリッド・A/B比較・コンタクトシートを作らない。
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
      <div class="modal-media">${asset.file ? mediaTag(asset.file, asset.name) : "No file"}</div>
      <div class="modal-side">
        <h3>${escapeHtml(asset.name ?? entry.overview)}</h3>
        <p>${escapeHtml(entry.overview ?? "")}</p>
        <pre>${escapeHtml(prompt)}</pre>
        <label class="modal-field">${t("improvePrompt")}
          <textarea id="assetImprovePrompt" rows="5">${escapeHtml(asset.improvementPrompt ?? "")}</textarea>
        </label>
        <div class="modal-field improve-mode">
          ${t("improveMode")}
          <label><input type="radio" name="improveMode" value="tweak" ${asset.improveMode !== "rebuild" ? "checked" : ""}> ${t("improveModeTweak")}</label>
          <label><input type="radio" name="improveMode" value="rebuild" ${asset.improveMode === "rebuild" ? "checked" : ""}> ${t("improveModeRebuild")}</label>
          <small>${t("improveModeHelp")}</small>
        </div>
        <div class="modal-actions">
          <button class="ghost danger" id="deleteAssetBtn" type="button">${icon("trash")} ${t("deleteAsset")}</button>
          <button class="ghost" id="saveImprovePrompt" type="button">${t("saveImprovePrompt")}</button>
          ${asset.requestStatus === "requested"
            ? `<button class="primary" id="cancelImproveAsset" type="button">${t("cancelRequest")}</button>`
            : `<button class="primary" id="queueImproveAsset" type="button">${t("queueImprove")}</button>`}
        </div>
      </div>
    </div>
  `;
  $("#modal").classList.add("open");
  $("#closeModal").onclick = () => $("#modal").classList.remove("open");
  $("#deleteAssetBtn").onclick = () => deleteAsset(entry, asset);
  const readImproveMode = () => document.querySelector('input[name="improveMode"]:checked')?.value ?? "tweak";
  $("#saveImprovePrompt").onclick = async () => {
    asset.improvementPrompt = $("#assetImprovePrompt").value;
    asset.improveMode = readImproveMode();
    await saveDeck(false);
    render();
    toast(t("saveImprovePrompt"));
  };
  if ($("#queueImproveAsset")) {
    $("#queueImproveAsset").onclick = async () => {
      asset.improvementPrompt = $("#assetImprovePrompt").value;
      asset.improveMode = readImproveMode();
      await enqueueTargets([improveTarget({ entry, asset })]);
      $("#modal").classList.remove("open");
    };
  }
  if ($("#cancelImproveAsset")) {
    $("#cancelImproveAsset").onclick = async () => {
      asset.improvementPrompt = $("#assetImprovePrompt").value;
      asset.improveMode = readImproveMode();
      await saveDeck(false);
      $("#modal").classList.remove("open");
      await cancelTargets([{ action: "improve", entryId: entry.id, assetId: asset.id }]);
    };
  }
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

// ---- Modal accessibility: Escape-to-close, focus trap, focus restore ----
// All content modals share #modal; the entry/asset form uses .form-modal.open.
// A single controller observes both so every open path (× button, backdrop
// click, action buttons) gets keyboard support without per-call wiring.
const modalA11y = {
  lastFocus: null,
  isOpen(el) {
    return Boolean(el && el.classList && el.classList.contains("open"));
  },
  activeModal() {
    const sheet = $("#modal");
    if (this.isOpen(sheet)) return sheet;
    const form = document.querySelector(".form-modal.open");
    if (form) return form;
    return null;
  },
  // Close whichever modal is currently open. Returns true if one was closed.
  closeActive() {
    const form = document.querySelector(".form-modal.open");
    if (form) {
      closeForm();
      return true;
    }
    const sheet = $("#modal");
    if (this.isOpen(sheet)) {
      sheet.classList.remove("open");
      return true;
    }
    return false;
  },
  focusables(root) {
    return Array.from(
      root.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((node) => node.offsetParent !== null || node === document.activeElement);
  },
  // Called when a modal transitions to open: remember the trigger and move
  // focus inside so keyboard users land in the dialog.
  onOpened(root) {
    if (!this.lastFocus) {
      const trigger = document.activeElement;
      this.lastFocus = trigger && trigger !== document.body ? trigger : null;
    }
    // Announce the open container as a modal dialog to assistive tech.
    const dialog = root.querySelector(".modal-card") ?? root.querySelector(".form-card") ?? root;
    if (dialog && !dialog.getAttribute("role")) dialog.setAttribute("role", "dialog");
    if (dialog) dialog.setAttribute("aria-modal", "true");
    const focusables = this.focusables(root);
    const target = focusables[0] ?? root;
    // Defer so the modal content is laid out before focusing.
    requestAnimationFrame(() => {
      if (this.isOpen(root) || root.classList.contains("form-modal")) target.focus();
    });
  },
  // Called when no modal is open anymore: restore focus to the trigger.
  onClosed() {
    const node = this.lastFocus;
    this.lastFocus = null;
    if (node && document.contains(node)) {
      requestAnimationFrame(() => node.focus());
    }
  },
};

document.addEventListener("keydown", (event) => {
  const modal = modalA11y.activeModal();
  if (!modal) return;
  if (event.key === "Escape") {
    event.preventDefault();
    modalA11y.closeActive();
    return;
  }
  if (event.key === "Tab") {
    const focusables = modalA11y.focusables(modal);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (event.shiftKey) {
      if (active === first || !modal.contains(active)) {
        event.preventDefault();
        last.focus();
      }
    } else if (active === last || !modal.contains(active)) {
      event.preventDefault();
      first.focus();
    }
  }
});

// Detect open/close transitions on both modal containers without touching the
// many call sites. #modal toggles its class in place; .form-modal is recreated
// by render(), so observe the document for both.
let modalWasOpen = false;
const modalObserver = new MutationObserver(() => {
  const modal = modalA11y.activeModal();
  const open = Boolean(modal);
  if (open && !modalWasOpen) modalA11y.onOpened(modal);
  else if (!open && modalWasOpen) modalA11y.onClosed();
  modalWasOpen = open;
});
modalObserver.observe(document.body, {
  subtree: true,
  childList: true,
  attributes: true,
  attributeFilter: ["class"],
});

loadDeck().catch((error) => {
  document.body.innerHTML = `<pre>${escapeHtml(error.stack || error.message)}</pre>`;
});
