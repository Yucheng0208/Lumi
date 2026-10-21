/* 讀取各種影像格式：一般格式交給瀏覽器，HEIC 用 libheif（heic-to），RAW 用 LibRaw，SVG 轉高解析點陣圖。
   支援格式與光印 Lumark 相同。 */
(function () {
  'use strict';

  const RAW_EXT = /\.(dng|nef|nrw|cr2|cr3|crw|arw|srf|sr2|raf|orf|rw2|rwl|pef|srw|x3f|3fr|fff|iiq|erf|mrw|kdc|dcr|mos|mef|gpr|raw)$/i;
  const HEIC_EXT = /\.(heic|heif|hif)$/i;
  const VIDEO_EXT = /\.(mp4|m4v|mov|qt|webm|mkv|avi|wmv|asf|flv|f4v|mpg|mpeg|m2v|ts|mts|m2ts|3gp|3g2|ogv|vob)$/i;
  const ACCEPT = 'image/*,video/*,.mov,.mp4,.m4v,.mkv,.avi,.wmv,.webm,.flv,.mpg,.mpeg,.ts,.mts,.m2ts,.3gp,.ogv,.gif,.svg,.webp,.avif,.tif,.tiff,.bmp,'
    + '.heic,.heif,.hif,.dng,.nef,.nrw,.cr2,.cr3,.crw,.arw,.srf,.sr2,.raf,.orf,.rw2,.rwl,.pef,.srw,.x3f,.3fr,.fff,.iiq,.erf,.mrw,.kdc,.dcr,.mos,.mef,.gpr';

  function kindOf(file) {
    if (file.type === 'image/gif' || /\.gif$/i.test(file.name)) return 'gif';
    if (/^video\//.test(file.type) || VIDEO_EXT.test(file.name)) return 'video';
    return 'photo';
  }
  function formatOf(file) {
    if (RAW_EXT.test(file.name)) return 'raw';
    if (/\.svgz?$/i.test(file.name) || file.type === 'image/svg+xml') return 'svg';
    if (HEIC_EXT.test(file.name) || /^image\/hei[cf]/.test(file.type)) return 'heic';
    return 'std';
  }
  function isSupported(file) {
    return /^(image|video)\//.test(file.type) || /\.(jpe?g|png|webp|gif|tiff?|bmp|avif)$/i.test(file.name)
      || kindOf(file) !== 'photo' || formatOf(file) !== 'std';
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = () => reject(new Error('無法載入 ' + src));
      document.head.appendChild(s);
    });
  }
  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => (img.naturalWidth ? resolve(img) : reject(new Error('empty image')));
      img.onerror = () => reject(new Error('瀏覽器無法解碼這張影像'));
      img.src = url;
    });
  }
  const canDecode = (url) => loadImage(url).then(() => true, () => false);

  /* ---------- HEIC ---------- */
  let heicReady = null;
  async function decodeHeic(file) {
    const direct = URL.createObjectURL(file);
    if (await canDecode(direct)) return { blob: file, url: direct };
    URL.revokeObjectURL(direct);
    if (!heicReady) heicReady = loadScript('vendor/heic/heic-to.js').catch((e) => { heicReady = null; throw e; });
    await heicReady;
    const blob = await window.HeicTo({ blob: file, type: 'image/png' });
    return { blob, url: URL.createObjectURL(blob) };
  }

  /* ---------- SVG：長邊至少 2048px ---------- */
  async function decodeSvg(file) {
    const doc = new DOMParser().parseFromString(await file.text(), 'image/svg+xml');
    const svg = doc.documentElement;
    if (!svg || svg.nodeName.toLowerCase() !== 'svg') throw new Error('invalid svg');
    const num = (v) => { const n = parseFloat(v); return isFinite(n) && n > 0 ? n : 0; };
    const vb = (svg.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
    let w = num(svg.getAttribute('width')) || (vb.length === 4 ? vb[2] : 0) || 1024;
    let h = num(svg.getAttribute('height')) || (vb.length === 4 ? vb[3] : 0) || w;
    const s = Math.min(4096 / Math.max(w, h), Math.max(1, 2048 / Math.max(w, h)));
    if (!svg.getAttribute('viewBox')) svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    w = Math.round(w * s); h = Math.round(h * s);
    svg.setAttribute('width', w); svg.setAttribute('height', h);
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }));
    try {
      const img = await loadImage(url);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
      return { blob, url: URL.createObjectURL(blob) };
    } finally { URL.revokeObjectURL(url); }
  }

  /* ---------- RAW ---------- */
  let LibRawClass = null;
  async function decodeRaw(file) {
    const buf = new Uint8Array(await file.arrayBuffer());
    try {
      if (!LibRawClass) LibRawClass = (await import(new URL('vendor/libraw/index.js', document.baseURI).href)).default;
      const raw = new LibRawClass();
      try {
        await raw.open(buf.slice(), { useCameraWb: true, outputBps: 8, userQual: 3 });
        const data = await raw.imageData();
        if (!data || !data.width) throw new Error('empty image');
        const canvas = rgbToCanvas(data);
        return { canvas, method: 'libraw' };
      } finally { raw.dispose(); }
    } catch (err) {
      console.warn('LibRaw 解碼失敗，改用內嵌預覽', err);
      const prev = await largestEmbeddedJpeg(buf);
      if (!prev) throw err;
      return { blob: prev.blob, url: prev.url, method: 'preview' };
    }
  }
  function rgbToCanvas({ width, height, colors, data }) {
    const c = document.createElement('canvas');
    c.width = width; c.height = height;
    const ctx = c.getContext('2d');
    const out = ctx.createImageData(width, height);
    const px = out.data;
    const src = data instanceof Uint8Array ? data : new Uint8Array(data.buffer || data);
    const step = colors || 3;
    for (let i = 0, j = 0; j < px.length; i += step, j += 4) {
      px[j] = src[i]; px[j + 1] = src[i + (step > 1 ? 1 : 0)]; px[j + 2] = src[i + (step > 2 ? 2 : 0)]; px[j + 3] = 255;
    }
    ctx.putImageData(out, 0, 0);
    return c;
  }
  // 掃描檔案中所有 JPEG，取解析度最大且能顯示的一張
  async function largestEmbeddedJpeg(d) {
    const found = [];
    let i = 0;
    const n = d.length;
    while (i < n - 3) {
      if (!(d[i] === 0xff && d[i + 1] === 0xd8 && d[i + 2] === 0xff)) { i++; continue; }
      let j = i + 2, ok = false, w = 0, lossless = false;
      while (j + 4 <= n && d[j] === 0xff) {
        const m = d[j + 1];
        if (m === 0xd9) { ok = true; j += 2; break; }
        if (m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { j += 2; continue; }
        const len = (d[j + 2] << 8) | d[j + 3];
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
          w = (d[j + 7] << 8) | d[j + 8];
          if (m === 0xc3 || m === 0xc7 || m === 0xcb || m === 0xcf) lossless = true;
        }
        if (m === 0xda) {
          let k = j + 2 + len;
          while (k + 1 < n && !(d[k] === 0xff && d[k + 1] !== 0 && !(d[k + 1] >= 0xd0 && d[k + 1] <= 0xd7))) k++;
          j = k; continue;
        }
        j += 2 + len;
      }
      if (ok && w && !lossless) { found.push({ start: i, end: j, w }); i = j; } else i += 3;
    }
    found.sort((a, b) => b.w - a.w);
    for (const f of found) {
      const blob = new Blob([d.subarray(f.start, f.end)], { type: 'image/jpeg' });
      const url = URL.createObjectURL(blob);
      if (await canDecode(url)) return { url, blob };
      URL.revokeObjectURL(url);
    }
    return null;
  }
  /** RAW 內嵌預覽（通常 1 秒內），先顯示，再背景完整解碼 */
  async function rawPreview(file) {
    try {
      const head = new DataView(await file.slice(0, 96).arrayBuffer());
      const magic = String.fromCharCode(...new Uint8Array(head.buffer, 0, 8));
      if (magic === 'FUJIFILM') {
        const off = head.getUint32(84), len = head.getUint32(88);
        if (off && len && off + len <= file.size) {
          const blob = file.slice(off, off + len, 'image/jpeg');
          const url = URL.createObjectURL(blob);
          if (await canDecode(url)) return { url, blob };
          URL.revokeObjectURL(url);
        }
      }
    } catch (e) { /* 改用掃描 */ }
    return largestEmbeddedJpeg(new Uint8Array(await file.arrayBuffer()));
  }

  /**
   * 把任何來源變成可上傳 WebGL 的點陣圖（已套用 EXIF 方向）。
   * 回傳 { source, w, h }，source 為 ImageBitmap 或 canvas
   */
  async function toBitmap(blobOrCanvas) {
    if (blobOrCanvas instanceof HTMLCanvasElement) return { source: blobOrCanvas, w: blobOrCanvas.width, h: blobOrCanvas.height };
    try {
      const bmp = await createImageBitmap(blobOrCanvas, { imageOrientation: 'from-image', premultiplyAlpha: 'none', colorSpaceConversion: 'default' });
      return { source: bmp, w: bmp.width, h: bmp.height };
    } catch (e) {
      const url = URL.createObjectURL(blobOrCanvas);
      try {
        const img = await loadImage(url);
        const c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        c.getContext('2d').drawImage(img, 0, 0);
        return { source: c, w: c.width, h: c.height };
      } finally { URL.revokeObjectURL(url); }
    }
  }

  /** 讀取相片；onPreview 會在 RAW 內嵌預覽可用時先呼叫一次 */
  async function decodePhoto(file, onStatus) {
    const fmt = formatOf(file);
    if (fmt === 'raw') {
      onStatus && onStatus(I18n.t('st.decodingRaw', { name: file.name }));
      const dec = await decodeRaw(file);
      if (dec.canvas) return { ...(await toBitmap(dec.canvas)) };
      const bm = await toBitmap(dec.blob);
      URL.revokeObjectURL(dec.url);
      return { ...bm, noteKey: 'note.rawPreview', noteVars: { w: bm.w, h: bm.h } };
    }
    if (fmt === 'heic') {
      onStatus && onStatus(I18n.t('st.decodingHeic', { name: file.name }));
      const dec = await decodeHeic(file);
      URL.revokeObjectURL(dec.url);
      return { ...(await toBitmap(dec.blob)) };
    }
    if (fmt === 'svg') {
      const dec = await decodeSvg(file);
      URL.revokeObjectURL(dec.url);
      return { ...(await toBitmap(dec.blob)) };
    }
    return { ...(await toBitmap(file)) };
  }

  /** 從 JPEG 取出 EXIF（APP1），並把方向改成 1（像素已轉正） */
  async function jpegExif(file) {
    if (!/\.jpe?g$/i.test(file.name) && file.type !== 'image/jpeg') return null;
    const d = new Uint8Array(await file.slice(0, 256 * 1024).arrayBuffer());
    if (d[0] !== 0xff || d[1] !== 0xd8) return null;
    let i = 2;
    while (i + 4 < d.length && d[i] === 0xff) {
      const m = d[i + 1], len = (d[i + 2] << 8) | d[i + 3];
      if (m === 0xe1 && d[i + 4] === 0x45 && d[i + 5] === 0x78 && d[i + 6] === 0x69 && d[i + 7] === 0x66) {
        const seg = d.slice(i, i + 2 + len);
        try { resetOrientation(seg); } catch (e) { /* 格式異常就照原樣 */ }
        return seg;
      }
      if (m === 0xda) break;
      i += 2 + len;
    }
    return null;
  }
  function resetOrientation(seg) {
    const t = 10; // APP1 標頭(4) + "Exif\0\0"(6)
    const dv = new DataView(seg.buffer, seg.byteOffset);
    const le = dv.getUint16(t) === 0x4949;
    const ifd = t + dv.getUint32(t + 4, le);
    const n = dv.getUint16(ifd, le);
    for (let k = 0; k < n; k++) {
      const e = ifd + 2 + k * 12;
      if (dv.getUint16(e, le) === 0x0112) { dv.setUint16(e + 8, 1, le); return; }
    }
  }
  /** 把 EXIF 段落插回 JPEG（SOI 之後） */
  async function withExif(jpegBlob, exif) {
    if (!exif) return jpegBlob;
    const d = new Uint8Array(await jpegBlob.arrayBuffer());
    let i = 2;
    if (d[2] === 0xff && d[3] === 0xe0) i = 4 + ((d[4] << 8) | d[5]); // 保留 JFIF 之後
    return new Blob([d.subarray(0, i), exif, d.subarray(i)], { type: 'image/jpeg' });
  }

  window.Decode = { kindOf, formatOf, isSupported, decodePhoto, rawPreview, toBitmap, loadImage, jpegExif, withExif, ACCEPT, loadScript };
})();
