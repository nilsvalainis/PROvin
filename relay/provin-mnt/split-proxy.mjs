// PROVIN mnt.ee split proxy: Chrome -> 127.0.0.1:MNT_SPLIT_PORT. Hosts matching MNT_SPLIT_HOSTS go
// through the upstream proxy (MNT_UPSTREAM_PROXY, e.g. Fixie static IP); everything else goes direct.
// Saves upstream quota (Fixie counts requests + MB). Logs host, route and bytes only (no credentials).
import http from "node:http";
import net from "node:net";
const env = process.env;
const PORT = Number(env.MNT_SPLIT_PORT || 8790);
const UP = env.MNT_UPSTREAM_PROXY ? new URL(env.MNT_UPSTREAM_PROXY) : null;
const HOSTS = new RegExp(env.MNT_SPLIT_HOSTS || "(^|\\.)(mnt\\.ee|transpordiamet\\.ee|google\\.com|gstatic\\.com|recaptcha\\.net)$", "i");
const LOG = /^(1|true|yes)$/i.test(env.MNT_SPLIT_LOG || "1");
const auth = UP && UP.username ? "Basic " + Buffer.from(decodeURIComponent(UP.username) + ":" + decodeURIComponent(UP.password)).toString("base64") : null;
const stats = { up: 0, direct: 0, upBytes: 0, directBytes: 0 };
const log = (...a) => LOG && console.log(new Date().toISOString(), ...a);

function viaUpstream(host, port, cb) {
  const s = net.connect(Number(UP.port || 80), UP.hostname);
  s.once("error", (e) => cb(e));
  s.once("connect", () => {
    s.write(`CONNECT ${host}:${port} HTTP/1.1\r\nHost: ${host}:${port}\r\n${auth ? `Proxy-Authorization: ${auth}\r\n` : ""}\r\n`);
    let buf = Buffer.alloc(0);
    const onData = (d) => {
      buf = Buffer.concat([buf, d]);
      const i = buf.indexOf("\r\n\r\n");
      if (i < 0) return;
      s.off("data", onData);
      const head = buf.slice(0, i).toString();
      if (!/^HTTP\/1\.[01] 200/.test(head)) { s.destroy(); return cb(new Error("upstream: " + head.split("\r\n")[0])); }
      const rest = buf.slice(i + 4);
      if (rest.length) s.unshift(rest);
      cb(null, s);
    };
    s.on("data", onData);
  });
}

const server = http.createServer((req, res) => {
  if (req.url === "/stats") { res.end(JSON.stringify(stats)); return; }
  res.writeHead(405); res.end("CONNECT only");
});
server.on("connect", (req, client, head) => {
  const [host, portStr] = req.url.split(":");
  const port = Number(portStr || 443);
  const useUp = !!UP && HOSTS.test(host);
  let called = false;
  const done = (err, upstream) => {
    if (called) return; called = true;
    if (err) { log("fail", host, useUp ? "up" : "direct", err.message); client.end("HTTP/1.1 502 Bad Gateway\r\n\r\n"); return; }
    client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
    if (head?.length) upstream.write(head);
    let bytes = 0;
    upstream.on("data", (d) => (bytes += d.length));
    client.on("data", (d) => (bytes += d.length));
    upstream.pipe(client); client.pipe(upstream);
    const close = () => { upstream.destroy(); client.destroy(); };
    upstream.on("error", close); client.on("error", close);
    upstream.once("close", () => { if (useUp) { stats.upBytes += bytes; } else { stats.directBytes += bytes; } log(useUp ? "UP" : "direct", host, bytes); close(); });
  };
  if (useUp) { stats.up++; viaUpstream(host, port, done); }
  else { stats.direct++; const s = net.connect(port, host, () => done(null, s)); s.once("error", (e) => done(e)); }
});
server.listen(PORT, "127.0.0.1", () => log(`split proxy on 127.0.0.1:${PORT}`, { upstream: !!UP, hosts: HOSTS.source }));
