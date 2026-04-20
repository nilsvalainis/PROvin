/**
 * PATCH ar JSON ķermeni un reālu augšupielādes progresu (XMLHttpRequest.upload).
 * `fetch` API progresu augšupielādē nesniedz.
 */
export type JsonPatchProgress = (loaded: number, total: number) => void;

export type JsonPatchResult =
  | { ok: true; status: number; data: unknown }
  | {
      ok: false;
      status: number;
      data: unknown;
      networkError?: boolean;
      /** Ne-JSON atbildes (piem. 413/502 HTML) — īss fragments diagnostikai. */
      responseTextSnippet?: string;
    };

export function patchJsonWithUploadProgress(
  url: string,
  body: unknown,
  onProgress: JsonPatchProgress | undefined,
): Promise<JsonPatchResult> {
  const payload = JSON.stringify(body);
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PATCH", url);
    xhr.withCredentials = true;
    xhr.setRequestHeader("Content-Type", "application/json; charset=utf-8");

    xhr.upload.onprogress = (ev) => {
      if (!onProgress) return;
      if (ev.lengthComputable && ev.total > 0) {
        onProgress(ev.loaded, ev.total);
      } else {
        onProgress(ev.loaded, Math.max(ev.loaded, 1));
      }
    };

    xhr.onerror = () => {
      resolve({ ok: false, status: 0, data: {}, networkError: true });
    };

    xhr.onload = () => {
      const t = xhr.responseText ?? "";
      let data: unknown = {};
      try {
        if (t) data = JSON.parse(t) as unknown;
      } catch {
        data = {};
      }
      const status = xhr.status;
      const snippet =
        t.length > 0
          ? t.length > 320
            ? `${t.slice(0, 280).replace(/\s+/g, " ")}…`
            : t.replace(/\s+/g, " ").slice(0, 320)
          : undefined;
      if (status >= 200 && status < 300) {
        resolve({ ok: true, status, data });
      } else {
        resolve({ ok: false, status, data, responseTextSnippet: snippet });
      }
    };

    xhr.send(payload);
  });
}
