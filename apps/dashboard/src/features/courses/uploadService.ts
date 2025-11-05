// uploadService.ts
const MEDIA_BASE = import.meta.env.VITE_MEDIA_API_URL || 'http://localhost:3006'; // media server
const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks (used by multipart uploader)

export type SmallUploadOpts = { courseId: string; lectureId?: string; isIntro?: boolean };

export async function uploadSmallFile(file: File, opts: SmallUploadOpts, onProgress?: (pct:number)=>void) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('courseId', opts.courseId);
  if (opts.lectureId) fd.append('lectureId', opts.lectureId);
  if (opts.isIntro !== undefined) fd.append('isIntro', String(Boolean(opts.isIntro)));

  const xhr = new XMLHttpRequest();
  return new Promise<any>((resolve, reject) => {
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      try {
        const json = JSON.parse(xhr.responseText);
        resolve(json);
      } catch (err) { reject(err); }
    };
    xhr.onerror = () => reject(new Error('Upload failed'));
    xhr.open('POST', `${MEDIA_BASE}/api/upload`);
    xhr.send(fd);
  });
}

export async function signMultipart(filename: string, contentType: string, courseId?: string, isIntro?: boolean) {
  const body: any = { filename, contentType };
  if (courseId) body.courseId = courseId;
  if (typeof isIntro !== 'undefined') body.isIntro = Boolean(isIntro);
  const res = await fetch(`${MEDIA_BASE}/api/upload/sign-multipart`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function signPart(body:{ key:string; uploadId:string; partNumber:number }) {
  const res = await fetch(`${MEDIA_BASE}/api/upload/sign-part`, {
    method:'POST',
    headers:{ 'content-type':'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

export async function completeMultipart(payload:{ key:string; uploadId:string; parts:any[]; courseId?:string; filename?:string; lectureId?:string; isIntro?:boolean }) {
  const res = await fetch(`${MEDIA_BASE}/api/upload/complete`, {
    method:'POST',
    headers:{ 'content-type':'application/json' },
    body: JSON.stringify(payload)
  });
  return res.json();
}

/**
 * Generic chunked multipart uploader that uses signMultipart/signPart/completeMultipart endpoints.
 * opts: { courseId, lectureId?, isIntro? }
 * onProgress: optional callback
 * returns complete response JSON (should include ok and videoId)
 */
export async function uploadLargeFileMultipart(file: File, opts: { courseId: string; lectureId?: string; isIntro?: boolean }, onProgress?: (pct:number)=>void) {
  const parts: { ETag: string; PartNumber: number }[] = [];

  // 1) Start multipart on media server
  const start = await signMultipart(file.name, file.type);
  if (!start?.key || !start?.uploadId) throw new Error('Failed to start multipart upload');

  const totalParts = Math.ceil(file.size / CHUNK_SIZE);
  let uploadedBytes = 0;

  for (let part = 1; part <= totalParts; part++) {
    const startByte = (part - 1) * CHUNK_SIZE;
    const endByte = Math.min(part * CHUNK_SIZE, file.size);
    const chunk = file.slice(startByte, endByte);

    // sign this part
    const signRes = await signPart({ key: start.key, uploadId: start.uploadId, partNumber: part });
    if (!signRes) throw new Error('Failed to sign part');

    const presignedUrl: string | undefined = signRes.url;
    const proxyOk: boolean = !!signRes.proxy;
    const proxyUrl: string | undefined = signRes.proxyUrl;

    let etag = '';

    // try direct PUT first
    if (presignedUrl) {
      try {
        const putRes = await fetch(presignedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: chunk,
        });

        if (putRes.ok) {
          etag = (putRes.headers.get('ETag') || putRes.headers.get('etag') || '').replace(/"/g, '');
        } else {
          console.warn(`Direct PUT part ${part} failed status=${putRes.status}`);
        }
      } catch (err) {
        console.warn(`Direct PUT part ${part} threw, will try proxy`, err);
      }
    }

    // fallback to proxy (server-side) if direct didn't work
    if (!etag && proxyOk && proxyUrl) {
      const fd = new FormData();
      fd.append('key', start.key);
      fd.append('uploadId', start.uploadId);
      fd.append('partNumber', String(part));
      // IMPORTANT: include filename so formidable writes a proper file entry
      fd.append('part', chunk as Blob, `part-${part}.bin`);

      const proxyRes = await fetch(`${MEDIA_BASE}/api/upload/proxy-part`, {
        method: 'POST',
        body: fd,
      });

      let proxyJson: any = null;
      try {
        proxyJson = await proxyRes.json();
      } catch (e) {
        throw new Error(`Proxy upload for part ${part} failed to parse JSON: ${String(e)}`);
      }

      if (!proxyRes.ok || !proxyJson?.ok) {
        throw new Error(`Proxy upload failed for part ${part}: ${proxyRes.status} ${JSON.stringify(proxyJson)}`);
      }

      etag = (proxyJson.ETag || proxyJson?.etag || '').replace(/"/g, '');
    }

    if (!etag) throw new Error(`Part ${part} failed (no ETag)`);

    parts.push({ ETag: etag, PartNumber: part });

    uploadedBytes += chunk.size;
    if (onProgress) onProgress(Math.round((uploadedBytes / file.size) * 100));
  }

  // 3) Complete multipart (include metadata)
  const completeRes = await completeMultipart({
    key: start.key,
    uploadId: start.uploadId,
    parts,
    courseId: opts.courseId,
    lectureId: opts.lectureId,
    isIntro: opts.isIntro,
    filename: file.name,
  });
  if (!completeRes?.ok) throw new Error('Failed to complete multipart upload');

  return completeRes;
}
