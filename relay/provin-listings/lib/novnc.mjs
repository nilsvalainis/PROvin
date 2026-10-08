/**
 * noVNC palīgs manuālajai ielogošanai: īslaicīgs tokens ceļā, x11vnc+websockify
 * tikai localhost. Paroles / cookies šeit nav. Tokens dzīvo tikai atmiņā.
 */
import { spawn } from "node:child_process";
import { randomBytes, timingSafeEqual } from "node:crypto";
import http from "node:http";
import net from "node:net";

export const VNC_RFB_PORT = Number(process.env.LISTINGS_X11VNC_PORT || 5999);
export const VNC_HTTP_PORT = Number(process.env.LISTINGS_NOVNC_PORT || 6089);
const NOVNC_WEB = process.env.LISTINGS_NOVNC_WEB || "/usr/share/novnc";
const DISPLAY = process.env.DISPLAY || ":98";

const VNC_PATH_RE = /^\/(?:listings\/)?vnc\/([a-f0-9]{64})(\/.*)?$/i;
const HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
]);

let spawned = { x11vnc: null, websockify: null, weStarted: false };

export function createVncToken() {
  return randomBytes(32).toString("hex");
}

export function tokenLooksValid(token) {
  return typeof token === "string" && /^[a-f0-9]{64}$/i.test(token);
}

export function tokensEqual(a, b) {
  if (!tokenLooksValid(a) || !tokenLooksValid(b)) return false;
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** `/listings/vnc/<token>/vnc.html` vai `/vnc/<token>/` (pēc Caddy prefiksa noņemšanas). */
export function parseVncRequestPath(pathname) {
  const m = String(pathname || "").match(VNC_PATH_RE);
  if (!m) return null;
  return { token: m[1].toLowerCase(), rest: m[2] && m[2].length > 0 ? m[2] : "/" };
}

export function vncViewerPath(token) {
  return `/listings/vnc/${token}/vnc.html`;
}

/**
 * noVNC WS ceļš pret hosta sakni. Jāpadod `path=`, citādi klients iet uz `/websockify`.
 */
export function vncViewerQuery(token) {
  const path = `listings/vnc/${token}/`;
  return `autoconnect=true&reconnect=true&resize=scale&path=${encodeURIComponent(path)}`;
}

export function buildVncViewerUrl(relayBaseUrl, token) {
  const base = String(relayBaseUrl || "").replace(/\/+$/, "");
  if (!base || !tokenLooksValid(token)) return "";
  return `${base}/vnc/${token}/vnc.html?${vncViewerQuery(token)}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function portOpen(port, host = "127.0.0.1", timeoutMs = 400) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host }, () => {
      socket.end();
      resolve(true);
    });
    socket.setTimeout(timeoutMs);
    socket.on("error", () => resolve(false));
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function spawnDetached(bin, args) {
  const child = spawn(bin, args, { stdio: "ignore" });
  child.on("error", () => undefined);
  child.unref();
  return child;
}

export async function ensureNovnc() {
  if (await portOpen(VNC_HTTP_PORT)) return { ok: true, started: false };
  try {
    if (!(await portOpen(VNC_RFB_PORT))) {
      spawned.x11vnc = spawnDetached("x11vnc", [
        "-display",
        DISPLAY,
        "-localhost",
        "-rfbport",
        String(VNC_RFB_PORT),
        "-nopw",
        "-forever",
        "-shared",
        "-quiet",
      ]);
    }
    spawned.websockify = spawnDetached("websockify", [
      `--web=${NOVNC_WEB}`,
      `127.0.0.1:${VNC_HTTP_PORT}`,
      `127.0.0.1:${VNC_RFB_PORT}`,
    ]);
    spawned.weStarted = true;
  } catch (e) {
    return { ok: false, started: false, error: e instanceof Error ? e.message.split("\n")[0].slice(0, 160) : "noVNC start neizdevās" };
  }
  for (let i = 0; i < 25; i += 1) {
    if (await portOpen(VNC_HTTP_PORT)) return { ok: true, started: true };
    await sleep(160);
  }
  return { ok: false, started: true, error: "noVNC nenostrādāja (x11vnc / websockify). Jāstartē: systemctl start provin-listings-novnc" };
}

export function stopNovncIfStarted() {
  if (!spawned.weStarted) return;
  for (const child of [spawned.websockify, spawned.x11vnc]) {
    if (!child || child.killed) continue;
    try {
      child.kill("SIGTERM");
    } catch {
      /* jau beidzies */
    }
  }
  spawned = { x11vnc: null, websockify: null, weStarted: false };
}

function upstreamPath(rest, search) {
  let path = rest && rest.length > 0 ? rest : "/";
  if (path === "/websockify") path = "/";
  return `${path}${search || ""}`;
}

function copyHeaders(src, skip = HOP_HEADERS) {
  const out = {};
  for (const [key, value] of Object.entries(src)) {
    if (value == null || skip.has(key.toLowerCase())) continue;
    out[key] = value;
  }
  return out;
}

export function proxyVncHttp(req, res, rest, search) {
  const p = http.request(
    {
      host: "127.0.0.1",
      port: VNC_HTTP_PORT,
      path: upstreamPath(rest, search),
      method: req.method,
      headers: { ...copyHeaders(req.headers), host: `127.0.0.1:${VNC_HTTP_PORT}` },
    },
    (up) => {
      const headers = copyHeaders(up.headers, new Set(["connection", "keep-alive", "transfer-encoding"]));
      headers["cache-control"] = "no-store";
      res.writeHead(up.statusCode ?? 502, headers);
      up.pipe(res);
    },
  );
  p.on("error", () => {
    if (!res.headersSent) {
      res.writeHead(503, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: false, error: "noVNC nav sasniedzams" }));
    } else {
      res.destroy();
    }
  });
  req.pipe(p);
}

export function proxyVncUpgrade(req, socket, head, rest, search) {
  const up = net.connect(VNC_HTTP_PORT, "127.0.0.1", () => {
    const path = upstreamPath(rest, search);
    const hdrs = [`${req.method} ${path} HTTP/1.1`, `Host: 127.0.0.1:${VNC_HTTP_PORT}`];
    for (const [key, value] of Object.entries(req.headers)) {
      if (value == null || key.toLowerCase() === "host") continue;
      hdrs.push(`${key}: ${Array.isArray(value) ? value.join(", ") : value}`);
    }
    up.write(`${hdrs.join("\r\n")}\r\n\r\n`);
    if (head && head.length) up.write(head);
    up.pipe(socket);
    socket.pipe(up);
  });
  up.on("error", () => {
    try {
      socket.write("HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n");
    } catch {
      /* ignore */
    }
    socket.destroy();
  });
  socket.on("error", () => up.destroy());
}
