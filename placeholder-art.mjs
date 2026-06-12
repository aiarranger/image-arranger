// Dependency-free placeholder art toolkit shared by server.mjs (sample
// workspace seeding) and scripts/demo-agent.mjs (demo completions).
//
// It renders small "tasteful gradient" PNGs entirely in process: an RGB
// canvas, soft bokeh circles, a built-in 5x7 pixel font, and a minimal PNG
// encoder (deflate via node:zlib). No binaries are committed anywhere — every
// sample/demo image is generated at runtime by this code.

import { deflateSync } from "node:zlib";

// Curated gradient duos. Deterministic pick via hash32(seed) % PALETTES.length.
export const PALETTES = [
  { name: "aurora", from: [14, 36, 73], to: [96, 214, 178] },
  { name: "sunset", from: [60, 16, 70], to: [248, 142, 102] },
  { name: "sakura", from: [88, 22, 60], to: [250, 198, 214] },
  { name: "ocean", from: [10, 42, 86], to: [118, 198, 236] },
  { name: "ember", from: [52, 18, 12], to: [244, 164, 58] },
  { name: "violet", from: [38, 18, 78], to: [168, 140, 250] },
  { name: "forest", from: [12, 46, 34], to: [172, 224, 152] },
  { name: "dusk", from: [28, 32, 50], to: [198, 210, 230] },
];

// 5x7 pixel font, one byte per row, bit 4 = leftmost column.
export const FONT = {
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0e],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  N: [0x11, 0x11, 0x19, 0x15, 0x13, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x1b, 0x11],
  X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  0: [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  1: [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  2: [0x0e, 0x11, 0x01, 0x06, 0x08, 0x10, 0x1f],
  3: [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  4: [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  5: [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  6: [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  7: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  8: [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  9: [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  " ": [0, 0, 0, 0, 0, 0, 0],
  "-": [0, 0, 0, 0x0e, 0, 0, 0],
  "_": [0, 0, 0, 0, 0, 0, 0x1f],
  ".": [0, 0, 0, 0, 0, 0x0c, 0x0c],
  ",": [0, 0, 0, 0, 0x0c, 0x04, 0x08],
  ":": [0, 0x0c, 0x0c, 0, 0x0c, 0x0c, 0],
  "/": [0x01, 0x02, 0x02, 0x04, 0x08, 0x08, 0x10],
  "!": [0x04, 0x04, 0x04, 0x04, 0x04, 0, 0x04],
  "?": [0x0e, 0x11, 0x01, 0x06, 0x04, 0, 0x04],
  "+": [0, 0x04, 0x04, 0x1f, 0x04, 0x04, 0],
  "(": [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02],
  ")": [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
  "[": [0x0e, 0x08, 0x08, 0x08, 0x08, 0x08, 0x0e],
  "]": [0x0e, 0x02, 0x02, 0x02, 0x02, 0x02, 0x0e],
  "#": [0x0a, 0x1f, 0x0a, 0x0a, 0x0a, 0x1f, 0x0a],
};

export function hash32(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeCanvas(width, height) {
  return { width, height, data: Buffer.alloc(width * height * 3) };
}

export function blendPx(canvas, x, y, color, alpha) {
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
  const i = (y * canvas.width + x) * 3;
  for (let c = 0; c < 3; c += 1) {
    canvas.data[i + c] = Math.round(canvas.data[i + c] * (1 - alpha) + color[c] * alpha);
  }
}

export function fillRect(canvas, x, y, w, h, color, alpha) {
  const x0 = Math.max(0, Math.round(x));
  const y0 = Math.max(0, Math.round(y));
  const x1 = Math.min(canvas.width, Math.round(x + w));
  const y1 = Math.min(canvas.height, Math.round(y + h));
  for (let py = y0; py < y1; py += 1) {
    for (let px = x0; px < x1; px += 1) blendPx(canvas, px, py, color, alpha);
  }
}

export function drawSoftCircle(canvas, cx, cy, r, color, alpha) {
  const x0 = Math.max(0, Math.floor(cx - r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const x1 = Math.min(canvas.width, Math.ceil(cx + r));
  const y1 = Math.min(canvas.height, Math.ceil(cy + r));
  for (let py = y0; py < y1; py += 1) {
    for (let px = x0; px < x1; px += 1) {
      const d = Math.hypot(px - cx, py - cy) / r;
      if (d >= 1) continue;
      blendPx(canvas, px, py, color, alpha * (1 - d * d));
    }
  }
}

export function drawText(canvas, x, y, text, scale, color, alpha = 1) {
  let cx = Math.round(x);
  for (const ch of text) {
    const glyph = FONT[ch] ?? FONT[" "];
    for (let row = 0; row < 7; row += 1) {
      for (let col = 0; col < 5; col += 1) {
        if (!(glyph[row] & (1 << (4 - col)))) continue;
        fillRect(canvas, cx + col * scale, y + row * scale, scale, scale, color, alpha);
      }
    }
    cx += 6 * scale;
  }
}

export function textWidth(text, scale) {
  return text.length * 6 * scale - scale;
}

// Keep only characters the built-in font can draw (text may be Japanese —
// anything unsupported collapses into single spaces).
export function sanitizeText(value) {
  let out = "";
  for (const ch of String(value ?? "").toUpperCase()) {
    out += FONT[ch] ? ch : " ";
  }
  return out.replace(/\s+/g, " ").trim();
}

export function clipLine(text, maxChars) {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(1, maxChars - 3)).trimEnd()}...`;
}

export function wrapLines(text, maxChars, maxLines) {
  const words = text.split(" ").filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= maxChars) { line = next; continue; }
    if (line) lines.push(line);
    line = word.length > maxChars ? word.slice(0, maxChars) : word;
    if (lines.length === maxLines) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length > maxLines || words.join(" ").length > maxChars * maxLines) {
    while (lines.length > maxLines) lines.pop();
    if (lines.length) lines[lines.length - 1] = clipLine(`${lines[lines.length - 1]}...`, maxChars);
  }
  return lines;
}

export function mix(a, b, t) {
  return [0, 1, 2].map((i) => Math.round(a[i] * (1 - t) + b[i] * t));
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crcBuffer]);
}

export function encodePng(canvas) {
  const { width, height, data } = canvas;
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y += 1) {
    // filter byte 0 (None) + the row
    data.copy(raw, y * (1 + width * 3) + 1, y * width * 3, (y + 1) * width * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolor
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// Paint the standard backdrop shared by demo/sample art: smoothstep diagonal
// gradient + vignette in one pass, then soft bokeh circles in the light end
// of the palette. Returns the glow color so callers can reuse it for accents.
export function paintBackdrop(canvas, palette, rng) {
  const W = canvas.width;
  const H = canvas.height;
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      let t = 0.62 * (x / (W - 1)) + 0.38 * (y / (H - 1));
      t = t * t * (3 - 2 * t);
      const dx = (x - W / 2) / (W / 2);
      const dy = (y - H / 2) / (H / 2);
      const vignette = 1 - 0.26 * Math.min(1, (dx * dx + dy * dy) / 2);
      const i = (y * W + x) * 3;
      for (let c = 0; c < 3; c += 1) {
        canvas.data[i + c] = Math.round((palette.from[c] * (1 - t) + palette.to[c] * t) * vignette);
      }
    }
  }
  const glow = mix(palette.to, [255, 255, 255], 0.45);
  const circles = 4 + Math.floor(rng() * 3);
  for (let i = 0; i < circles; i += 1) {
    drawSoftCircle(canvas, rng() * W, rng() * H * 0.72, 70 + rng() * 170, glow, 0.05 + rng() * 0.09);
  }
  return glow;
}
