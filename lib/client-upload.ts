"use client";

/**
 * Uploads a file to one of our own server routes as multipart/form-data,
 * reporting progress via XHR (fetch() has no upload-progress event).
 * Same-origin, so no CORS is involved — see the upload routes for why that
 * matters here.
 */
export function uploadFileWithProgress(
  url: string,
  file: File,
  onProgress: (percentage: number) => void,
  signal?: AbortSignal
): Promise<{ url: string }> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress((e.loaded / e.total) * 100);
    };

    xhr.onload = () => {
      let data: unknown;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        reject(new Error("Onverwacht antwoord van de server"));
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data as { url: string });
      } else {
        const error = (data as { error?: string })?.error;
        reject(new Error(error || `Uploaden mislukt (${xhr.status})`));
      }
    };

    xhr.onerror = () => reject(new Error("Netwerkfout tijdens uploaden"));

    if (signal) {
      if (signal.aborted) {
        xhr.abort();
      } else {
        signal.addEventListener("abort", () => xhr.abort());
      }
      xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));
    }

    xhr.send(formData);
  });
}
