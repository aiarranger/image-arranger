// Bilingual (EN default / JA). Language follows the deck's settings.lang when set,
// otherwise the browser locale (ja* -> ja, else en) — mirroring the main app.
const GALLERY_I18N = {
  en: {
    favorite: "Favorite",
    filterAll: "All",
    filterBase: "Base",
    filterImage: "Image",
    speechLines: [
      "Hehe ♥", "Surprised?", "Thanks for looking!", "Hey, which me do you like?",
      "You can keep watching ♥", "Great to see you today!", "Tapping tickles~", "Added me to your favorites yet?",
    ],
    noAdopted: (name) => `${name} has no adopted images yet.`,
    back: "← Back to image-arranger",
    loadFailed: (msg) => `Failed to load: ${msg}`,
    defaultName: "This asset pattern",
  },
  ja: {
    favorite: "お気に入り",
    filterAll: "すべて",
    filterBase: "ベース",
    filterImage: "画像",
    speechLines: [
      "えへへ♪", "びっくりした？", "見てくれてありがと！", "ねぇ、どの私が好き？",
      "ずっと見てていいよ♪", "今日も会えたね！", "タップ、くすぐったいよ〜", "お気に入り、増やしてくれた？",
    ],
    noAdopted: (name) => `${name} に採用画像がまだありません。`,
    back: "← image-arranger にもどる",
    loadFailed: (msg) => `読み込みに失敗しました: ${msg}`,
    defaultName: "この素材パターン",
  },
};
function resolveLang(deckLang) {
  if (deckLang === "en" || deckLang === "ja") return deckLang;
  const nav = typeof navigator !== "undefined" ? navigator : {};
  const codes = [...(Array.isArray(nav.languages) ? nav.languages : []), nav.language];
  return codes.some((c) => typeof c === "string" && c.toLowerCase().startsWith("ja")) ? "ja" : "en";
}
let LANG = resolveLang();
let T = GALLERY_I18N[LANG];

const assetUrl = (file) => `/asset?path=${encodeURIComponent(file)}`;
const IMG_EXT = /\.(png|jpe?g|webp|gif|avif)$/i;
let allExpressions = [];
let expressions = [];
let activeFilter = 'all';
let surfacePan = { x:0, y:0 };
let tileLayout = null;
let tileCards = [];
let bgDrag = null;
let panLayerEl = null;
let lastWorld = { col: NaN, row: NaN };
let cascadePlayed = false; // 入場カスケードは初回ビルドのみ（パン/リサイズ再ビルドでは再生しない）
const $ = (sel, root=document) => root.querySelector(sel);
const surfaceWrap = $('#surfaceWrap');

function positiveMod(n, m) { return ((n % m) + m) % m; }

// 毎回ランダムに配置する。ページを開くたびに変わる種(shuffleSeed)と
// タイル座標(col,row)からハッシュを取り、無限スクロールで同じタイルが
// 再配置されても常に同じ画像に解決されるようにする（端が割れない）。
const shuffleSeed = (Math.random() * 0x7fffffff) | 0;
function tileHash(x, y) {
  let h = (shuffleSeed ^ Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1)) | 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) | 0;
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39) | 0;
  return (h ^ (h >>> 15)) >>> 0;
}
// お気に入り：localStorageに保存し、出現プールに3倍の重みで入れる
const FAV_KEY = 'imageArrangerGalleryFavs';
let favs = new Set();
try { favs = new Set(JSON.parse(localStorage.getItem(FAV_KEY) || '[]')); } catch {}
// 出現率はスロット表で決める：各画像に5スロットの基本割り当てを置き、
// お気に入りがある時は「最後の1巡」だけをお気に入りに再割り当てする。
// 表の大部分が変わらないため、♥を押しても壁の並びはほぼそのまま保たれ、
// 押したカード自体が別の画像にすり替わることもない。
const SLOT_CYCLES = 5;
let slotTable = [];
function rebuildWeighted() {
  const n = expressions.length;
  slotTable = new Array(n * SLOT_CYCLES);
  for (let i = 0; i < slotTable.length; i++) slotTable[i] = expressions[i % n];
  const favList = expressions.filter(e => favs.has(e.id));
  if (!favList.length) return;
  let k = 0;
  for (let i = slotTable.length - n; i < slotTable.length; i++) {
    if (!favs.has(slotTable[i].id)) slotTable[i] = favList[k++ % favList.length];
  }
}
function toggleFav(id) {
  if (favs.has(id)) favs.delete(id); else favs.add(id);
  localStorage.setItem(FAV_KEY, JSON.stringify([...favs]));
  rebuildWeighted();
  reflowTiles();
}
function burstHearts(card, btn) {
  for (let i = 0; i < 3; i++) {
    const h = document.createElement('span');
    h.className = 'heartPop';
    h.textContent = '♥';
    h.style.top = `${btn.offsetTop + 10}px`;
    h.style.left = `${btn.offsetLeft + 4 + (i - 1) * 10}px`;
    h.style.setProperty('--hx', `${(Math.random() * 40 - 20).toFixed(0)}px`);
    h.style.animationDelay = `${i * 0.08}s`;
    card.appendChild(h);
    setTimeout(() => h.remove(), 1200);
  }
}
function expressionForTile(col, row) {
  return slotTable[tileHash(col, row) % slotTable.length];
}
function setCardExpression(card, expr) {
  if (!card._img) {
    card._img = card.querySelector('.cardFace img');
    card._comment = card.querySelector('.cardComment');
    card._favBtn = card.querySelector('.favBtn');
  }
  const on = favs.has(expr.id);
  card.classList.toggle('fav', on);
  card._favBtn.textContent = on ? '♥' : '♡';
  card._favBtn.classList.toggle('on', on);
  if (card._expr && card._expr.id === expr.id) return;
  card._expr = expr;
  card.dataset.id = expr.id;
  card.dataset.origin = expr.origin;
  card._img.src = expr.img;
  card._img.alt = expr.comment;
  card._comment.textContent = expr.comment;
}
function makeCard(expr) {
  const card = document.createElement('article');
  card.className = 'expressionCard';
  card.innerHTML = `<div class="cardInner"><div class="cardFace"><img alt="" draggable="false"></div><div class="cardComment"></div></div><button class="favBtn" type="button" aria-label="${T.favorite}">♡</button>`;
  // 呼吸とキャプションの周期を1枚ごとにずらして有機的に見せる（負のdelayで途中から開始）
  card.style.setProperty('--breatheDur', `${(7 + Math.random() * 6).toFixed(2)}s`);
  card.style.setProperty('--breatheDelay', `${(-Math.random() * 12).toFixed(2)}s`);
  card.style.setProperty('--capDur', `${(13 + Math.random() * 9).toFixed(2)}s`);
  card.style.setProperty('--capDelay', `${(-Math.random() * 20).toFixed(2)}s`);
  const btn = card.querySelector('.favBtn');
  btn.addEventListener('pointerdown', e => e.stopPropagation());
  btn.addEventListener('click', e => {
    e.stopPropagation();
    if (!card._expr) return;
    const turningOn = !favs.has(card._expr.id);
    if (turningOn) burstHearts(card, btn);
    toggleFav(card._expr.id);
  });
  setCardExpression(card, expr);
  return card;
}
function buildColumns() {
  if (!expressions.length) return;
  const colsEl = $('#columns');
  colsEl.innerHTML = '<div class="panLayer"></div>';
  panLayerEl = colsEl.firstElementChild;
  tileCards = [];
  lastWorld = { col: NaN, row: NaN };
  const small = window.innerWidth < 720;
  // 画像は全て横長（16:9と4:3の混在）なので、中間の3:2タイルにすると切り抜きが最小で済む
  const cardW = small ? 190 : Math.max(240, Math.min(320, Math.round(window.innerWidth * 0.20)));
  const cardH = Math.round(cardW * 2 / 3);
  const gap = small ? 14 : 22;
  const stepX = cardW + gap;
  const stepY = cardH + gap;
  const wrapW = surfaceWrap.clientWidth || Math.round(window.innerWidth * 1.20);
  const wrapH = surfaceWrap.clientHeight || Math.round(window.innerHeight * 1.22);
  // 回転・千鳥配置・1ステップ分のラップを吸収するためのオフスクリーンバッファ
  const bufferCols = 2;
  const bufferRows = 2;
  const colCount = Math.ceil(wrapW / stepX) + bufferCols * 2 + 1;
  const rowCount = Math.ceil(wrapH / stepY) + bufferRows * 2 + 1;
  tileLayout = { cardW, cardH, gap, stepX, stepY, colCount, rowCount, bufferCols, bufferRows };

  const frag = document.createDocumentFragment();
  for (let r=0; r<rowCount; r++) {
    for (let c=0; c<colCount; c++) {
      const card = makeCard(expressionForTile(c, r));
      card.dataset.poolC = c;
      card.dataset.poolR = r;
      card.style.width = `${cardW}px`;
      card.style.height = `${cardH}px`;
      tileCards.push(card);
      frag.appendChild(card);
    }
  }
  panLayerEl.appendChild(frag);
  renderInfiniteSurface();
  // 入場カスケード：ビューポート中心に近いカードから順にfadeUpさせる。
  // 遅延=中心からの距離×0.5ms（最大400ms）+ アニメ.5s ＝ 全体0.9秒以内。
  // クラスとdelayはanimationendで掃除し、hover時のtransform遷移を取り戻す。
  if (!cascadePlayed) {
    cascadePlayed = true;
    if (!reducedMotion) {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      for (const card of tileCards) {
        const r = card.getBoundingClientRect();
        const d = Math.hypot(r.left + r.width / 2 - cx, r.top + r.height / 2 - cy);
        card.style.animationDelay = `${Math.min(Math.round(d * 0.5), 400)}ms`;
        card.classList.add('cardEnter');
        const onEnd = (ev) => {
          if (ev.animationName !== 'fadeUp') return; // 子要素のheartPop等は無視
          card.classList.remove('cardEnter');
          card.style.animationDelay = '';
          card.removeEventListener('animationend', onEnd);
        };
        card.addEventListener('animationend', onEnd);
      }
    }
  }
}

function expressionCounts() {
  return {
    all: allExpressions.length,
    base: allExpressions.filter(e => e.origin === 'base').length,
    image: allExpressions.filter(e => e.origin === 'image').length,
  };
}

function applyGalleryFilter(origin = activeFilter) {
  activeFilter = origin;
  expressions = origin === 'all' ? [...allExpressions] : allExpressions.filter(e => e.origin === origin);
  surfacePan = { x:0, y:0 };
  tileLayout = null;
  tileCards = [];
  rebuildWeighted();
  buildColumns();
  document.querySelectorAll('[data-gallery-filter]').forEach((button) => {
    button.classList.toggle('active', button.dataset.galleryFilter === activeFilter);
  });
}

function renderGalleryFilters() {
  const host = $('#galleryFilters');
  if (!host) return;
  const counts = expressionCounts();
  const labels = { all: T.filterAll, base: T.filterBase, image: T.filterImage };
  host.innerHTML = ['all', 'base', 'image'].map((origin) => `
    <button type="button" class="${origin === activeFilter ? 'active' : ''}" data-gallery-filter="${origin}" ${counts[origin] ? '' : 'disabled'}>
      ${labels[origin]} <span>${counts[origin]}</span>
    </button>
  `).join('');
  host.querySelectorAll('[data-gallery-filter]').forEach((button) => {
    button.onclick = () => applyGalleryFilter(button.dataset.galleryFilter);
  });
}
// タイル境界を越えた時だけ呼ばれる。各カードのワールド座標を引き直して
// 表情と千鳥オフセットを更新する（毎フレームは走らない）。
function reflowTiles() {
  if (!tileLayout || Number.isNaN(lastWorld.col)) return;
  const L = tileLayout;
  for (const card of tileCards) {
    const poolC = Number(card.dataset.poolC);
    const poolR = Number(card.dataset.poolR);
    const worldCol = lastWorld.col + poolC;
    const worldRow = lastWorld.row + poolR;
    const stagger = (worldRow & 1) ? Math.round(L.stepX * .46) : 0;
    setCardExpression(card, expressionForTile(worldCol, worldRow));
    card.style.left = `${poolC * L.stepX + stagger}px`;
    card.style.top = `${poolR * L.stepY}px`;
  }
}
function renderInfiniteSurface() {
  if (!tileLayout) return;
  const L = tileLayout;
  // 毎フレームの移動はレイヤー1枚のtransformだけ（GPU合成のみ、レイアウト不要）
  const offsetX = positiveMod(surfacePan.x, L.stepX) - L.stepX * L.bufferCols;
  const offsetY = positiveMod(surfacePan.y, L.stepY) - L.stepY * L.bufferRows;
  panLayerEl.style.transform = `translate3d(${offsetX.toFixed(1)}px, ${offsetY.toFixed(1)}px, 0)`;
  const worldCol0 = Math.floor(-surfacePan.x / L.stepX) - L.bufferCols;
  const worldRow0 = Math.floor(-surfacePan.y / L.stepY) - L.bufferRows;
  if (worldCol0 !== lastWorld.col || worldRow0 !== lastWorld.row) {
    lastWorld = { col: worldCol0, row: worldRow0 };
    reflowTiles();
  }
}

// ===== クリック演出（4種ランダム） =====
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function surpriseAt(x, y, card) {
  let pool = card ? ['ripple', 'zoom', 'burst', 'speech'] : ['ripple', 'speech'];
  if (reducedMotion) pool = pool.filter(e => e === 'zoom' || e === 'speech');
  const effect = pool[(Math.random() * pool.length) | 0];
  if (effect === 'ripple') rippleFrom(x, y);
  else if (effect === 'zoom') zoomUp(card);
  else if (effect === 'burst') burstFrom(x, y, card);
  else speechAt(x, y);
}
function rippleFrom(x, y) {
  const ring = document.createElement('div');
  ring.className = 'clickRing';
  ring.style.left = `${x}px`;
  ring.style.top = `${y}px`;
  document.body.appendChild(ring);
  setTimeout(() => ring.remove(), 900);
  for (const card of tileCards) {
    const r = card.getBoundingClientRect();
    if (r.right < -300 || r.left > innerWidth + 300 || r.bottom < -300 || r.top > innerHeight + 300) continue;
    const d = Math.hypot(r.left + r.width / 2 - x, r.top + r.height / 2 - y);
    const face = card.querySelector('.cardFace');
    if (face.classList.contains('rippling')) continue;
    face.style.animationDelay = `${Math.round(d * 0.55)}ms`;
    face.classList.add('rippling');
    setTimeout(() => { face.classList.remove('rippling'); face.style.animationDelay = ''; }, d * 0.55 + 750);
  }
}
let zoomLayer = null;
function zoomUp(card) {
  const expr = card._expr;
  if (!expr) return;
  if (!zoomLayer) {
    zoomLayer = document.createElement('div');
    zoomLayer.id = 'zoomLayer';
    zoomLayer.innerHTML = '<figure><img alt=""><figcaption></figcaption></figure>';
    zoomLayer.addEventListener('click', closeZoom);
    document.body.appendChild(zoomLayer);
  }
  zoomLayer.querySelector('img').src = expr.img;
  zoomLayer.querySelector('figcaption').textContent = expr.comment.replace(/^\d+\s*/, '');
  zoomLayer.classList.remove('closing');
  zoomLayer.classList.add('open');
  sparkleAt(innerWidth / 2, innerHeight / 2, '♥');
}
function closeZoom() {
  if (!zoomLayer || !zoomLayer.classList.contains('open') || zoomLayer.classList.contains('closing')) return;
  zoomLayer.classList.add('closing');
  setTimeout(() => zoomLayer.classList.remove('open', 'closing'), 280);
}
function burstFrom(x, y, card) {
  const face = card.querySelector('.cardFace');
  face.classList.add('bursting');
  setTimeout(() => face.classList.remove('bursting'), 700);
  sparkleAt(x, y);
  for (const other of tileCards) {
    if (other === card) continue;
    const r = other.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const d = Math.hypot(cx - x, cy - y);
    if (d > 700 || d < 1) continue;
    const k = 90 * (1 - d / 700);
    const f = other.querySelector('.cardFace');
    f.style.setProperty('--px', `${((cx - x) / d * k).toFixed(1)}px`);
    f.style.setProperty('--py', `${((cy - y) / d * k).toFixed(1)}px`);
    f.style.setProperty('--pr', `${(Math.random() * 8 - 4).toFixed(1)}deg`);
    f.classList.add('pushed');
    setTimeout(() => f.classList.remove('pushed'), 850);
  }
}
function sparkleAt(x, y, char) {
  for (let i = 0; i < 10; i++) {
    const s = document.createElement('span');
    s.className = 'sparkle';
    s.textContent = char || ['✦', '✧', '♥'][i % 3];
    const a = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * 100;
    s.style.left = `${x}px`;
    s.style.top = `${y}px`;
    s.style.setProperty('--sx', `${Math.round(Math.cos(a) * dist)}px`);
    s.style.setProperty('--sy', `${Math.round(Math.sin(a) * dist)}px`);
    s.style.animationDelay = `${i * 25}ms`;
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 1200);
  }
}
function speechAt(x, y) {
  const b = document.createElement('div');
  b.className = 'speechBubble';
  const lines = T.speechLines;
  b.textContent = lines[(Math.random() * lines.length) | 0];
  b.style.left = `${Math.min(Math.max(x, 110), innerWidth - 110)}px`;
  b.style.top = `${Math.max(y - 24, 60)}px`;
  document.body.appendChild(b);
  setTimeout(() => b.classList.add('gone'), 1600);
  setTimeout(() => b.remove(), 2150);
}

// Background drag: infinite pan card world. The card field is recycled with modulo positions, so it never reaches an edge.
// 8px未満の移動・600ms未満ならクリック扱いにして演出を発火する。
surfaceWrap.addEventListener('pointerdown', e => {
  if (e.button !== undefined && e.button !== 0) return;
  bgDrag = { x:e.clientX, y:e.clientY, panX:surfacePan.x, panY:surfacePan.y, t:performance.now(), moved:false };
  surfaceWrap.setPointerCapture(e.pointerId);
  surfaceWrap.classList.add('dragging');
});
surfaceWrap.addEventListener('pointermove', e => {
  if (!bgDrag) return;
  const dx = e.clientX - bgDrag.x;
  const dy = e.clientY - bgDrag.y;
  if (Math.hypot(dx, dy) > 8) bgDrag.moved = true;
  surfacePan.x = bgDrag.panX + dx;
  surfacePan.y = bgDrag.panY + dy;
  renderInfiniteSurface();
});
function finishBgDrag(e) {
  if (!bgDrag) return;
  const wasClick = !bgDrag.moved && (performance.now() - bgDrag.t) < 600;
  const sx = bgDrag.x;
  const sy = bgDrag.y;
  bgDrag = null;
  surfaceWrap.classList.remove('dragging');
  if (wasClick && e && e.type === 'pointerup') {
    // pointer captureでe.targetがsurfaceWrapになるため、座標からカードを引く
    const el = document.elementFromPoint(sx, sy);
    surpriseAt(sx, sy, el ? el.closest('.expressionCard') : null);
  }
}
surfaceWrap.addEventListener('pointerup', finishBgDrag);
surfaceWrap.addEventListener('pointercancel', finishBgDrag);
surfaceWrap.addEventListener('wheel', e => {
  e.preventDefault();
  surfacePan.x -= e.deltaX;
  surfacePan.y -= e.deltaY;
  renderInfiniteSurface();
}, { passive:false });

window.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (zoomLayer && zoomLayer.classList.contains('open')) closeZoom();
  else location.href = '/';
});

let lastTick = 0;
function tick(t) {
  if (!lastTick) lastTick = t;
  const dt = Math.min(50, t - lastTick);
  lastTick = t;
  if (!bgDrag) {
    surfacePan.y -= dt * .018;
    surfacePan.x += Math.sin(t / 9000) * dt * .010;
  }
  renderInfiniteSurface();
  requestAnimationFrame(tick);
}

// ===== データ読み込み：選択中の素材パターンの「採用」画像をカードにする =====
// 空・エラー時はbodyを上書きせず #app の中身だけ差し替える。
// bodyごと消すと .backChip（本体へもどる導線）まで失われるため。
function showEmptyMsg(innerHtml) {
  const app = $('#app');
  if (app) app.innerHTML = `<div class="emptyMsg">${innerHtml}</div>`;
  else document.body.innerHTML = `<div class="emptyMsg">${innerHtml}</div>`;
}
function selectCharacter(state) {
  const chars = state.characters ?? [];
  const wanted = new URLSearchParams(location.search).get('character') || state.settings?.currentCharacterId;
  return chars.find(ch => ch.id === wanted) ?? chars[0];
}
function collectAdopted(ch) {
  const found = [];
  if (!ch) return found;
  const isSourceRef = (asset) => (asset.tags ?? []).includes('source-reference');
  const addEntry = (entry, origin) => {
    for (const asset of entry.assets ?? []) {
      if (asset.adopted && asset.file && !isSourceRef(asset) && IMG_EXT.test(asset.file)) {
        const legacyId = asset.id ?? asset.file;
        found.push({
          id: `${entry.id}:${legacyId}`,
          legacyId,
          origin,
          img: assetUrl(asset.file),
          comment: entry.overview || asset.name || '',
        });
      }
    }
  };
  // The gallery is for adopted still images across the character, including
  // canonical base references created through Create kit.
  for (const rows of Object.values(ch.base ?? {})) {
    for (const entry of rows ?? []) addEntry(entry, 'base');
  }
  for (const entry of ch.images ?? []) {
    addEntry(entry, 'image');
  }
  return found;
}

function migrateFavoriteIds(items) {
  let changed = false;
  const next = new Set(favs);
  for (const expr of items) {
    if (expr.legacyId && next.has(expr.legacyId) && expr.legacyId !== expr.id) {
      next.add(expr.id);
      next.delete(expr.legacyId);
      changed = true;
    }
  }
  if (!changed) return;
  favs = next;
  localStorage.setItem(FAV_KEY, JSON.stringify([...favs]));
}

fetch('/api/state').then(r => r.json()).then(state => {
  LANG = resolveLang(state.settings?.lang);
  T = GALLERY_I18N[LANG];
  document.documentElement.lang = LANG;
  const ch = selectCharacter(state);
  allExpressions = collectAdopted(ch);
  migrateFavoriteIds(allExpressions);
  if (!allExpressions.length) {
    showEmptyMsg(`<p>${T.noAdopted(ch?.name ?? T.defaultName)}</p><a href="/">${T.back}</a>`);
    return;
  }
  // 全画像を先読みしておく。タイル使い回しでsrcを差し替えた瞬間の
  // 「ちらつき」（読み込み中の空白が見える）を防ぐ。
  for (const e of allExpressions) { const im = new Image(); im.src = e.img; }
  renderGalleryFilters();
  applyGalleryFilter('all');
  // リサイズは150msのtrailingデバウンス：録画中のウィンドウ操作で
  // 1イベントごとに全カードを作り直すスタッターを防ぐ。
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(buildColumns, 150);
  });
  requestAnimationFrame(tick);
}).catch(error => {
  showEmptyMsg(`<p>${T.loadFailed(String(error.message || error))}</p><a href="/">${T.back}</a>`);
});
