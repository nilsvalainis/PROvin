/**
 * Releja stāvoklis diskā (`LISTINGS_STATE_FILE`, noklusējums /var/lib/provin-listings/state.json):
 * katras platformas pēdējā sesijas pārbaude, pēdējā nolasīšana, dienas skaitītāji, Auto1 API atklājumi.
 * Nekad nesatur paroles vai cookies.
 */
import fs from "node:fs/promises";
import path from "node:path";

export const PLATFORMS = ["openlane", "auto1", "autobid"];

function emptyPlatform() {
  return {
    session: "unknown", // ok | login_required | unknown
    sessionCheckedAt: "",
    lastFetchAt: "",
    lastFetchStatus: "",
    lastError: "",
    lastLoginAt: "",
    lastLoginNote: "",
    /** Auto1: pamanītie JSON API URL, lai var precizēt mapējumu. */
    discoveredApis: [],
  };
}

export class RelayState {
  constructor(file) {
    this.file = file;
    this.data = {
      version: 1,
      platforms: Object.fromEntries(PLATFORMS.map((p) => [p, emptyPlatform()])),
      daily: { day: "", fetches: {} },
    };
    this.saveTimer = null;
  }

  async load() {
    try {
      const raw = JSON.parse(await fs.readFile(this.file, "utf8"));
      if (raw && typeof raw === "object" && raw.platforms) {
        for (const p of PLATFORMS) {
          this.data.platforms[p] = { ...emptyPlatform(), ...(raw.platforms[p] ?? {}) };
        }
        if (raw.daily && typeof raw.daily === "object") this.data.daily = { day: "", fetches: {}, ...raw.daily };
      }
    } catch {
      /* pirmā palaišana */
    }
  }

  scheduleSave() {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      void this.save();
    }, 500);
  }

  async save() {
    try {
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      const tmp = `${this.file}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(this.data, null, 2), "utf8");
      await fs.rename(tmp, this.file);
    } catch (e) {
      console.error("[listings-relay] stāvokli neizdevās saglabāt:", e instanceof Error ? e.message : e);
    }
  }

  platform(p) {
    return this.data.platforms[p];
  }

  setSession(p, session, note = "") {
    const s = this.platform(p);
    s.session = session;
    s.sessionCheckedAt = new Date().toISOString();
    if (note) s.lastError = note;
    this.scheduleSave();
  }

  setFetch(p, status, error = "") {
    const s = this.platform(p);
    s.lastFetchAt = new Date().toISOString();
    s.lastFetchStatus = status;
    s.lastError = error;
    this.scheduleSave();
  }

  setLogin(p, note) {
    const s = this.platform(p);
    s.lastLoginAt = new Date().toISOString();
    s.lastLoginNote = note;
    this.scheduleSave();
  }

  addDiscoveredApi(p, url) {
    const s = this.platform(p);
    const clean = url.split("?")[0];
    if (!s.discoveredApis.includes(clean)) {
      s.discoveredApis = [...s.discoveredApis, clean].slice(-20);
      this.scheduleSave();
    }
  }

  /** Dienas limits (UTC diena). Atgriež true, ja limits jau pilns. */
  countFetch(p, maxPerDay) {
    const day = new Date().toISOString().slice(0, 10);
    if (this.data.daily.day !== day) this.data.daily = { day, fetches: {} };
    const n = this.data.daily.fetches[p] ?? 0;
    if (n >= maxPerDay) return true;
    this.data.daily.fetches[p] = n + 1;
    this.scheduleSave();
    return false;
  }

  healthView(extra = {}) {
    return {
      ok: true,
      checkedAt: new Date().toISOString(),
      daily: this.data.daily,
      platforms: Object.fromEntries(
        PLATFORMS.map((p) => {
          const s = this.platform(p);
          return [
            p,
            {
              session: s.session,
              sessionCheckedAt: s.sessionCheckedAt,
              lastFetchAt: s.lastFetchAt,
              lastFetchStatus: s.lastFetchStatus,
              lastError: s.lastError,
              lastLoginAt: s.lastLoginAt,
              lastLoginNote: s.lastLoginNote,
              discoveredApis: s.discoveredApis,
            },
          ];
        }),
      ),
      ...extra,
    };
  }
}
