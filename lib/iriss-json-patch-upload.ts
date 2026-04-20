/**
 * PATCH ar JSON ķermeni un reālu augšupielādes progresu (XMLHttpRequest.upload).
 * `fetch` API progresu augšupielādē nesniedz.
 */
export type JsonPatchProgress = (loaded: number, total: number) => void;

export type JsonPatchResult =
  | { ok: true; status: number; data: unknown }
  | { ok: false; status: number; data: unknown; networkError?: boolean };

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
      let data: unknown = {};
      try {
        const t = xhr.responseText;
        if (t) data = JSON.parse(t) as unknown;
      } catch {
        data = {};
      }
      const status = xhr.status;
      if (status >= 200 && status < 300) {
        resolve({ ok: true, status, data });
      } else {
        resolve({ ok: false, status, data });
      }
    };

    xhr.send(payload);
  });
}
