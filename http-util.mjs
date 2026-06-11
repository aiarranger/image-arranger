// http-util.mjs — HTTP plumbing: errors, path safety, body parsing, Range/206
// file serving, Host/Origin policy, and JSON/error responses.

import { createReadStream, existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, extname, isAbsolute, relative, resolve, sep } from "node:path";

export const MAX_BODY_CHARS = 1_000_000;

// Stream files larger than this (instead of readFileSync) so big video assets
// do not buffer fully into memory.
export const STREAM_THRESHOLD_BYTES = 1024 * 1024;

export const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

export class HttpError extends Error {
  constructor(status, publicMessage, detail = "") {
    super(detail || publicMessage);
    this.status = status;
    this.publicMessage = publicMessage;
  }
}

export function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
}

export function sendError(response, error) {
  const status = error instanceof HttpError ? error.status : 500;
  const message = error instanceof HttpError ? error.publicMessage : "Internal server error";
  if (status >= 500) console.error(error);
  sendJson(response, status, { ok: false, error: message });
}

export function readBody(request, maxBodyChars = MAX_BODY_CHARS) {
  const contentType = String(request.headers["content-type"] ?? "").toLowerCase();
  if (!contentType.includes("application/json")) {
    return Promise.reject(new HttpError(415, "Content-Type must be application/json"));
  }
  return new Promise((resolveBody, rejectBody) => {
    let raw = "";
    let rejected = false;
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      if (rejected) return;
      raw += chunk;
      if (raw.length > maxBodyChars) {
        rejected = true;
        rejectBody(new HttpError(413, "Request body too large"));
      }
    });
    request.on("end", () => {
      if (rejected) return;
      try {
        resolveBody(raw ? JSON.parse(raw) : {});
      } catch {
        rejectBody(new HttpError(400, "Invalid JSON body"));
      }
    });
    request.on("error", (error) => {
      if (!rejected) rejectBody(error);
    });
  });
}

export function safeResolve(baseDir, requestedPath) {
  const root = resolve(baseDir);
  if (!requestedPath || String(requestedPath).includes("\0")) {
    throw new HttpError(400, "Invalid path");
  }
  const resolved = resolve(root, requestedPath);
  const rel = relative(root, resolved);
  if (rel && (rel.startsWith("..") || isAbsolute(rel))) {
    throw new HttpError(403, "Path is outside the allowed directory");
  }
  // A symlink inside the tree must not escape it: realpath the deepest
  // existing ancestor of the resolved path and re-check containment.
  let probe = resolved;
  while (probe !== root && !existsSync(probe)) probe = dirname(probe);
  try {
    const rootReal = realpathSync(root);
    const probeReal = realpathSync(probe);
    if (probeReal !== rootReal && !probeReal.startsWith(rootReal + sep)) {
      throw new HttpError(403, "Path resolves outside the allowed directory");
    }
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(403, "Path could not be verified");
  }
  return resolved;
}

// Parse a single-range "bytes=start-end" header. Returns null when absent or
// unsatisfiable/malformed (caller then serves the full body, per RFC 7233 we
// may ignore a Range we cannot satisfy). Multi-range requests are not
// supported and fall back to a full 200 response.
function parseRange(rangeHeader, size) {
  if (!rangeHeader) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(String(rangeHeader).trim());
  if (!match) return null;
  const [, startRaw, endRaw] = match;
  if (startRaw === "" && endRaw === "") return null;
  let start;
  let end;
  if (startRaw === "") {
    // Suffix range: last N bytes.
    const suffix = Number(endRaw);
    if (!suffix) return null;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(startRaw);
    end = endRaw === "" ? size - 1 : Number(endRaw);
  }
  if (!Number.isInteger(start) || !Number.isInteger(end) || start > end || start >= size) {
    return { unsatisfiable: true };
  }
  return { start, end: Math.min(end, size - 1) };
}

export function serveFile(response, path, request = null) {
  if (!existsSync(path) || statSync(path).isDirectory()) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }
  const contentType = MIME[extname(path).toLowerCase()] ?? "application/octet-stream";
  const size = statSync(path).size;
  const isHead = (request?.method ?? "GET") === "HEAD";
  const range = parseRange(request?.headers?.range, size);

  // Strict Content-Security-Policy on HTML responses. `default-src 'self'`
  // blocks inline/remote script-URI injection (e.g. a malicious shared deck
  // whose referenceUrl is `javascript:...`) and third-party beacons.
  // NOTE: the frontend's Font Awesome cdnjs <link> is removed in a parallel
  // track (P2-FA-1). Once FA is vendored locally this policy is exactly right;
  // until then, a manual check in THIS worktree will see the cdnjs stylesheet
  // blocked — that is expected and fine, not a regression.
  const securityHeaders = contentType.startsWith("text/html")
    ? {
      "Content-Security-Policy":
        "default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; "
        + "style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'; "
        + "frame-ancestors 'none'",
      "X-Content-Type-Options": "nosniff",
    }
    : {};

  if (range?.unsatisfiable) {
    response.writeHead(416, {
      "Content-Range": `bytes */${size}`,
      "Accept-Ranges": "bytes",
    });
    response.end();
    return;
  }

  if (range) {
    const length = range.end - range.start + 1;
    response.writeHead(206, {
      "Content-Type": contentType,
      "Content-Length": length,
      "Content-Range": `bytes ${range.start}-${range.end}/${size}`,
      "Accept-Ranges": "bytes",
      ...securityHeaders,
    });
    if (isHead) { response.end(); return; }
    createReadStream(path, { start: range.start, end: range.end }).pipe(response);
    return;
  }

  response.writeHead(200, {
    "Content-Type": contentType,
    "Content-Length": size,
    "Accept-Ranges": "bytes",
    ...securityHeaders,
  });
  if (isHead) { response.end(); return; }
  if (size > STREAM_THRESHOLD_BYTES) {
    createReadStream(path).pipe(response);
    return;
  }
  response.end(readFileSync(path));
}

// The server binds to 127.0.0.1, but any web page the user browses can
// still issue requests to it (DNS rebinding / CSRF onto localhost). Require
// a loopback Host header, and for state-changing methods a loopback (or
// absent) Origin.
const LOOPBACK_HOSTNAMES = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);

export function originPolicyViolation(request) {
  let hostname = "";
  try {
    hostname = new URL(`http://${request.headers.host ?? ""}`).hostname;
  } catch {
    return "Missing or malformed Host header";
  }
  if (!LOOPBACK_HOSTNAMES.has(hostname)) {
    return `Host "${request.headers.host}" is not allowed on this local server`;
  }
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method ?? "GET")) {
    const origin = String(request.headers.origin ?? "");
    if (origin) {
      try {
        const parsed = new URL(origin);
        if (!LOOPBACK_HOSTNAMES.has(parsed.hostname)) {
          return `Origin "${origin}" is not allowed on this local server`;
        }
      } catch {
        return `Origin "${origin}" is not allowed on this local server`;
      }
    }
  }
  return null;
}
