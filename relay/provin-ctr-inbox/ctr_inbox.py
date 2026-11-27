#!/usr/bin/env python3
"""CheckThisReg -> PROVIN (Hetzner darbinieks, Nila «jā» 27.11.2026).

Ik 10 min (systemd taimeris): Nila pastā (IMAP) meklē jaunus CheckThisReg e-pastus «Your Report is Ready!» un
«Update About Your Order», no tiem paņem guest saiti, ar GET nolasa pasūtījuma JSON + PDF un sūta uz PROVIN
`POST /api/ctr/ingest`. Tikai stdlib (Python 3.10+).

STINGRI: sistēma NEKAD nepērk, netērē tokenus, neizsauc redeem / purchase / refund. Uz checkthisreg.com tiek
sūtīti tikai GET pieprasījumi uz `/api/guest/order/<id>` (sk. `guard_ctr_url`). PDF - tikai GET no Google Cloud
Storage `checkthisreg.firebasestorage.app/orders/`.

Paroles / tokeni netiek rakstīti diskā vai žurnālā: IMAP parole palaišanas brīdī no 1Password (`op-galv`),
guest saites tokens žurnālā aizstāts ar ***.
"""

from __future__ import annotations

import argparse
import base64
import email
import hashlib
import html
import imaplib
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from email.header import decode_header, make_header
from email.utils import parsedate_to_datetime

CTR_HOST = "checkthisreg.com"
CTR_ORDER_PATH_RE = re.compile(r"^/api/guest/order/[A-Za-z0-9_-]{6,120}$")
GCS_HOST = "storage.googleapis.com"
GCS_PATH_PREFIX = "/checkthisreg.firebasestorage.app/orders/"
GUEST_LINK_RE = re.compile(r"https://(?:www\.)?checkthisreg\.com/guest/([A-Za-z0-9_-]{6,120})\?token=([A-Za-z0-9._~%-]{8,600})")
VIN_RE = re.compile(r"\b([A-HJ-NPR-Z0-9]{17})\b")
CHUNK_BYTES = 2 * 1024 * 1024  # < 2,5 MB servera limits
MAX_DOC_BYTES = 20 * 1024 * 1024
MAX_ATTEMPTS = 12
USER_AGENT = "provin-ctr-inbox/1.0"


def log(msg: str) -> None:
    print(f"[ctr-inbox] {time.strftime('%Y-%m-%dT%H:%M:%S')} {redact(msg)}", flush=True)


def redact(s: str) -> str:
    s = re.sub(r"token=[^&\s\"']+", "token=***", s)
    return re.sub(r"(Bearer\s+)\S+", r"\1***", s)


# ---------------------------------------------------------------- e-pasta parsēšana (tīras funkcijas)


def decode_subject(raw: str | None) -> str:
    try:
        return str(make_header(decode_header(raw or "")))
    except Exception:
        return raw or ""


def email_kind(subject: str) -> str | None:
    """«Your Report is Ready! - 2026…» -> ready; «Update About Your Order - …» -> update; citādi None."""
    if re.search(r"Your Report is Ready", subject, re.I):
        return "ready"
    if re.search(r"Update About Your Order", subject, re.I):
        return "update"
    return None


def order_number_from_subject(subject: str) -> str:
    m = re.search(r"\b(\d{8}-[A-Z0-9]{4,10})\b", subject)
    return m.group(1) if m else ""


def message_text(msg: email.message.Message) -> tuple[str, str]:
    text, htm = "", ""
    for part in msg.walk():
        if part.get_filename():
            continue
        ct = part.get_content_type()
        payload = part.get_payload(decode=True) or b""
        charset = part.get_content_charset() or "utf-8"
        try:
            decoded = payload.decode(charset, "ignore")
        except LookupError:
            decoded = payload.decode("utf-8", "ignore")
        if ct == "text/plain":
            text += decoded
        elif ct == "text/html":
            htm += decoded
    if not text and htm:
        t = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", htm, flags=re.S)
        t = re.sub(r"<[^>]+>", " ", t)
        text = re.sub(r"\s+", " ", html.unescape(t))
    return text, htm


def parse_ctr_email(raw_bytes: bytes) -> dict | None:
    """E-pasts -> {kind, orderNumber, vin, manufacturer, guestId, guestToken, messageId, receivedAt} vai None."""
    msg = email.message_from_bytes(raw_bytes)
    sender = (msg.get("From") or "").lower()
    if "checkthisreg.com" not in sender:
        return None
    subject = decode_subject(msg.get("Subject"))
    kind = email_kind(subject)
    if not kind:
        return None
    text, htm = message_text(msg)
    link = GUEST_LINK_RE.search(html.unescape(htm)) or GUEST_LINK_RE.search(text)
    vin_m = re.search(r"Vehicle(?: ID)?:\s*(?:[A-Za-z-]+\s+)?([A-HJ-NPR-Z0-9]{17})", text) or VIN_RE.search(text)
    manu_m = re.search(r"Manufacturer:\s*([A-Za-z][A-Za-z .&-]{1,30}?)\s*(?:\n|-|Vehicle|$)", text)
    received = ""
    try:
        received = parsedate_to_datetime(msg.get("Date")).isoformat()
    except Exception:
        received = ""
    return {
        "kind": kind,
        "orderNumber": order_number_from_subject(subject),
        "vin": vin_m.group(1) if vin_m else "",
        "manufacturer": manu_m.group(1).strip() if manu_m else "",
        "guestId": link.group(1) if link else "",
        "guestToken": urllib.parse.unquote(link.group(2)) if link else "",
        "messageId": (msg.get("Message-ID") or msg.get("Message-Id") or "").strip(),
        "receivedAt": received,
    }


# ---------------------------------------------------------------- HTTP ar sargu


def guard_ctr_url(url: str, method: str) -> None:
    """Uz CheckThisReg drīkst tikai GET /api/guest/order/<id>; PDF tikai GET no GCS pasūtījuma mapes."""
    u = urllib.parse.urlsplit(url)
    if method != "GET":
        raise PermissionError("CheckThisReg/GCS: atļauts tikai GET")
    if u.scheme != "https":
        raise PermissionError("tikai https")
    host = (u.hostname or "").lower()
    if host in (CTR_HOST, f"www.{CTR_HOST}"):
        if not CTR_ORDER_PATH_RE.match(u.path):
            raise PermissionError("CheckThisReg: atļauts tikai /api/guest/order/<id>")
        return
    if host == GCS_HOST:
        if not urllib.parse.unquote(u.path).startswith(GCS_PATH_PREFIX):
            raise PermissionError("GCS: atļauta tikai checkthisreg pasūtījumu mape")
        return
    raise PermissionError(f"neatļauts hosts: {host}")


def http_get(url: str, timeout: int = 60, max_bytes: int = MAX_DOC_BYTES) -> tuple[int, bytes]:
    guard_ctr_url(url, "GET")
    req = urllib.request.Request(url, method="GET", headers={"User-Agent": USER_AGENT, "Accept": "application/json, application/pdf, */*"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            data = r.read(max_bytes + 1)
            if len(data) > max_bytes:
                raise ValueError("too_large")
            return r.status, data
    except urllib.error.HTTPError as e:
        return e.code, b""


def gcs_url(raw: str) -> str:
    u = urllib.parse.urlsplit(raw)
    return urllib.parse.urlunsplit((u.scheme, u.netloc, urllib.parse.quote(urllib.parse.unquote(u.path)), u.query, ""))


def provin_post(cfg: dict, body: dict, timeout: int = 300) -> tuple[int, dict]:
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        cfg["ingest_url"],
        data=data,
        method="POST",
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {cfg['ingest_token']}", "User-Agent": USER_AGENT},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read().decode("utf-8") or "{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode("utf-8") or "{}")
        except Exception:
            return e.code, {}
    except Exception as e:  # tīkla kļūda / taimauts
        return 0, {"error": type(e).__name__}


# ---------------------------------------------------------------- stāvoklis


def load_state(path: str) -> dict | None:
    try:
        with open(path, "r", encoding="utf-8") as f:
            d = json.load(f)
        return d if isinstance(d, dict) else None
    except FileNotFoundError:
        return None
    except Exception:
        return None


def save_state(path: str, state: dict) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = f"{path}.tmp"
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=1)
    os.replace(tmp, path)


def mark(state: dict, key: str, status: str, **extra) -> None:
    prev = state["messages"].get(key, {})
    state["messages"][key] = {**prev, "status": status, "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), **extra}


def is_done(entry: dict | None) -> bool:
    return bool(entry) and entry.get("status") not in ("retry",)


# ---------------------------------------------------------------- IMAP


def imap_password(cfg: dict) -> str:
    cmd = [cfg["op_cmd"], "item", "get", cfg["op_item"], "--vault", cfg["op_vault"], "--fields", "password", "--reveal"]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    pw = (r.stdout or "").strip()
    if r.returncode != 0 or not pw:
        raise RuntimeError("IMAP parole no 1Password nav nolasīta")
    return pw


def all_mail_box(m: imaplib.IMAP4_SSL) -> str:
    typ, boxes = m.list()
    for b in boxes or []:
        line = b.decode("utf-8", "ignore") if isinstance(b, bytes) else str(b)
        if "\\All" in line:
            name = line.split(' "/" ')[-1].strip()
            return name if name.startswith('"') else f'"{name}"'
    return "INBOX"


def fetch_ctr_messages(cfg: dict, password: str, days: int) -> list[tuple[str, bytes]]:
    m = imaplib.IMAP4_SSL(cfg["imap_host"], 993)
    try:
        m.login(cfg["imap_user"], password)
        m.select(all_mail_box(m), readonly=True)
        # Gmail: {a b} = a OR b. Precīzu tēmu pārbauda `email_kind`.
        q = f"from:noreply@checkthisreg.com newer_than:{days}d {{subject:ready subject:update}}"
        typ, data = m.search(None, "X-GM-RAW", f'"{q}"')
        if typ != "OK":
            since = time.strftime("%d-%b-%Y", time.gmtime(time.time() - days * 86400))
            typ, data = m.search(None, "FROM", '"noreply@checkthisreg.com"', "SINCE", since)
        ids = (data[0] or b"").split() if data else []
        out = []
        for i in ids[-200:]:
            typ, dd = m.fetch(i, "(BODY.PEEK[])")
            if typ == "OK" and dd and isinstance(dd[0], tuple):
                out.append((i.decode(), dd[0][1]))
        return out
    finally:
        try:
            m.logout()
        except Exception:
            pass


# ---------------------------------------------------------------- viens e-pasts


def process_message(cfg: dict, info: dict, dry_run: bool) -> tuple[str, str]:
    """-> (statuss, īss iemesls). Statuss: done | retry | failed."""
    if not info["guestId"] or not info["guestToken"]:
        return "failed", "nav guest saites"
    order_url = f"https://{CTR_HOST}/api/guest/order/{info['guestId']}?token={urllib.parse.quote(info['guestToken'], safe='')}"
    code, raw = http_get(order_url, timeout=60, max_bytes=2 * 1024 * 1024)
    if code in (401, 403, 404, 410):
        return "failed", f"guest saite {code} (beigusies?)"
    if code != 200:
        return "retry", f"guest {code}"
    try:
        order = json.loads(raw.decode("utf-8")).get("order") or {}
    except Exception:
        return "retry", "guest json"
    docs_meta = [d for d in (order.get("documents") or []) if isinstance(d, dict) and d.get("url")]
    status = str(order.get("status") or "")
    if info["kind"] == "ready" and not docs_meta and status != "completed":
        return "retry", f"pasūtījums vēl {status or 'nav gatavs'}"
    vin = (order.get("vehicleId") or info["vin"] or "").strip().upper()
    if not VIN_RE.fullmatch(vin):
        return "failed", "nav VIN"
    ctr_order_id = str(order.get("id") or info["guestId"])

    documents = []
    for d in docs_meta[:40]:
        code, pdf = http_get(gcs_url(str(d["url"])), timeout=120)
        if code != 200 or not pdf.startswith(b"%PDF-"):
            return "retry", f"PDF lejupielāde {code}"
        md5 = hashlib.md5(pdf).hexdigest()
        name = str(d.get("name") or f"{md5}.pdf")[:160]
        documents.append({"md5": md5, "fileName": name, "size": len(pdf), "_bytes": pdf})

    if dry_run:
        log(f"dry-run: {info['orderNumber']} {vin} {info['kind']} - {len(documents)} PDF ({', '.join(x['fileName'] for x in documents)[:300]})")
        return "retry", "dry-run"

    for d in documents:
        pdf = d.pop("_bytes")
        chunks = [pdf[i : i + CHUNK_BYTES] for i in range(0, len(pdf), CHUNK_BYTES)] or [b""]
        for idx, part in enumerate(chunks):
            code, res = provin_post(
                cfg,
                {
                    "action": "document",
                    "ctrOrderId": ctr_order_id,
                    "md5": d["md5"],
                    "fileName": d["fileName"],
                    "chunkIndex": idx,
                    "chunkCount": len(chunks),
                    "chunkBase64": base64.b64encode(part).decode("ascii"),
                },
                timeout=120,
            )
            if code != 200 or res.get("status") not in ("chunk_saved", "document_saved"):
                return "retry", f"PDF augšupielāde {code} {res.get('status') or res.get('error') or ''}".strip()

    code, res = provin_post(
        cfg,
        {
            "action": "finalize",
            "ctrOrderId": ctr_order_id,
            "orderNumber": str(order.get("orderNumber") or info["orderNumber"]),
            "vin": vin,
            "manufacturer": str(order.get("manufacturer") or info["manufacturer"]),
            "product": str(order.get("product") or ""),
            "emailKind": info["kind"],
            "receivedAt": info["receivedAt"],
            "ctrStatus": status,
            "documents": [{k: v for k, v in d.items() if not k.startswith("_")} for d in documents],
        },
        timeout=300,
    )
    st = res.get("status")
    if code == 200 and st in ("attached", "no_data", "pending", "duplicate"):
        return "done", f"{st} {res.get('result') or ''} rindas={res.get('serviceRows', '-')}".strip()
    return "retry", f"finalize {code} {st or res.get('error') or ''}".strip()


# ---------------------------------------------------------------- galvenais


def config_from_env() -> dict:
    return {
        "ingest_url": os.environ.get("CTR_INGEST_URL", "https://www.provin.lv/api/ctr/ingest").strip(),
        "ingest_token": os.environ.get("CTR_INGEST_TOKEN", "").strip(),
        "imap_host": os.environ.get("CTR_IMAP_HOST", "imap.gmail.com").strip(),
        "imap_user": os.environ.get("CTR_IMAP_USER", "").strip(),
        "op_cmd": os.environ.get("CTR_OP_CMD", "/usr/local/bin/op-galv").strip(),
        "op_item": os.environ.get("CTR_OP_ITEM", "").strip(),
        "op_vault": os.environ.get("CTR_OP_VAULT", "Cowork Claude").strip(),
        "state_dir": os.environ.get("CTR_STATE_DIR", "/var/lib/provin-ctr-inbox").strip(),
        "days": int(os.environ.get("CTR_LOOKBACK_DAYS", "35") or 35),
    }


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description="CheckThisReg -> PROVIN (tikai lasīšana no CheckThisReg)")
    ap.add_argument("--baseline", action="store_true", help="atzīmē visus esošos e-pastus kā apstrādātus, neko nesūta")
    ap.add_argument("--dry-run", action="store_true", help="nolasa e-pastus un guest pasūtījumus, uz PROVIN nesūta")
    args = ap.parse_args(argv)

    cfg = config_from_env()
    if not cfg["imap_user"] or not cfg["op_item"]:
        log("CTR_IMAP_USER / CTR_OP_ITEM nav iestatīts")
        return 2
    if not args.dry_run and not args.baseline and len(cfg["ingest_token"]) < 24:
        log("CTR_INGEST_TOKEN nav iestatīts (>= 24 zīmes)")
        return 2
    state_path = os.path.join(cfg["state_dir"], "seen.json")
    state = load_state(state_path)
    first_run = state is None
    state = state or {"messages": {}}
    state.setdefault("messages", {})
    # Pirmā palaišana: esošie e-pasti (arī jau nosūtītiem pasūtījumiem) tikai atzīmēti, nekas netiek sūtīts.
    baseline = args.baseline or (first_run and not args.dry_run)

    msgs = fetch_ctr_messages(cfg, imap_password(cfg), cfg["days"])
    summary = {"found": len(msgs), "done": 0, "retry": 0, "failed": 0, "baseline": 0}
    for _, raw in msgs:
        info = parse_ctr_email(raw)
        if not info:
            continue
        key = info["messageId"] or hashlib.sha256(raw[:4096]).hexdigest()
        entry = state["messages"].get(key)
        if is_done(entry):
            continue
        if baseline:
            mark(state, key, "baseline", order=info["orderNumber"])
            summary["baseline"] += 1
            continue
        try:
            status, reason = process_message(cfg, info, args.dry_run)
        except PermissionError as e:
            status, reason = "failed", f"sargs: {e}"
        except Exception as e:
            status, reason = "retry", type(e).__name__
        if args.dry_run:
            continue
        attempts = int((entry or {}).get("attempts", 0)) + 1
        if status == "retry" and attempts >= MAX_ATTEMPTS:
            status, reason = "failed", f"{reason} (mēģinājumi {attempts})"
        mark(state, key, status, order=info["orderNumber"], vin=info["vin"], attempts=attempts, reason=reason[:200])
        summary[status] = summary.get(status, 0) + 1
        log(f"{info['orderNumber'] or '?'} {info['vin'] or '?'} {info['kind']}: {status} - {reason}")

    if not args.dry_run and not baseline:
        code, res = provin_post(cfg, {"action": "retry_pending"}, timeout=300)
        summary["pending_retry"] = res if code == 200 else {"code": code}

    # Vecāki par 90 dienām ieraksti izkrīt (e-pasti tiek meklēti tikai CTR_LOOKBACK_DAYS).
    cutoff = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() - 90 * 86400))
    state["messages"] = {k: v for k, v in state["messages"].items() if str(v.get("at", "")) >= cutoff}
    if not args.dry_run:
        state["lastRun"] = {"at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), **summary}
        save_state(state_path, state)
    log(f"gatavs: {json.dumps(summary, ensure_ascii=False)}" + (" (bāzes līnija - esošie e-pasti atzīmēti, nekas nav sūtīts)" if baseline else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
