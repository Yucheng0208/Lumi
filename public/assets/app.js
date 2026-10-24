/* 光色 Lumi：介面與流程 */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const t = I18n.t;
  const PREVIEW_MAX = 3200;  // 預覽貼圖長邊上限（輸出時使用原始解析度）
  const LUT_FAST = 25, LUT_FULL = 49;
  const SETTINGS_KEY = 'lumi.settings';

  /* ---------- 設定（記在瀏覽器） ---------- */
  const settings = Object.assign({
    theme: 'auto', tab: 'look', photoFormat: 'jpeg', quality: 92, photoSize: 0, keepExif: true,
    videoFormat: 'mp4', videoWidth: 0, fps: 15, mute: false, cubeSize: 33, lookFilter: 'all',
    slideFormat: 'gif', slideHold: 1.5, slideMotion: 'fade', slideTrans: 0.5, slideFit: 'cover', slideSize: 720,
    dateFormat: 'dash',  // slash：2026/10/24；dash：2026-10-24；dot：2026.10.24；short：10月24日（同光痕）
  }, (() => { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch (e) { return {}; } })());
  const saveSettings = () => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* 無痕模式 */ } };

  const state = {
    photos: [], activeId: null, nextId: 1,
    view: 'after', split: 0.5, holdOriginal: false,
    curveCh: 'rgb', hslBand: 'red', clipboard: null,
    customLuts: [], lookCache: new Map(),
  };
  const active = () => state.photos.find((p) => p.id === state.activeId) || null;

  let renderer = null;
  try { renderer = new Renderer($('preview')); } catch (e) { console.error(e); }

  /* ---------- 狀態列 ---------- */
  function setStatus(msg) { $('status').textContent = msg || ''; }
  function setBusy(msg) { $('stage-busy').hidden = !msg; $('stage-busy-text').textContent = msg || ''; }
  function setProgress(r) { const p = $('progress'); if (r == null) { p.hidden = true; return; } p.hidden = false; p.value = r; }

  /* ====================================================================
     濾鏡函式（內建與自訂 LUT）
     ==================================================================== */
  function lookFn(id) {
    if (state.lookCache.has(id)) return state.lookCache.get(id);
    let fn = null;
    if (id.startsWith('u:')) {
      const u = state.customLuts.find((l) => l.id === id);
      if (u) fn = (c) => Color.sampleLut(u.lut, c);
    } else {
      const l = Looks.get(id);
      if (l) fn = Color.compileLook(l.p);
    }
    state.lookCache.set(id, fn);
    return fn;
  }
  const ctx = { look: lookFn };
  const compileGrade = (g) => Color.compile(g, ctx);

  /* ====================================================================
     預覽：烘焙 LUT → WebGL
     ==================================================================== */
  let fullTimer = 0, rafPending = false;
  function gradeChanged() {
    const p = active();
    if (!p || !renderer) return;
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      const fn = compileGrade(p.grade);
      renderer.setLut(Color.bake(fn, LUT_FAST), LUT_FAST);
      draw();
      clearTimeout(fullTimer);
      fullTimer = setTimeout(() => {
        const q = active(); if (!q) return;
        renderer.setLut(Color.bake(compileGrade(q.grade), LUT_FULL), LUT_FULL);
        draw();
        updateHistogram();
      }, 180);
    });
    markDirty();
  }

  function fitPreview() {
    const p = active();
    if (!p) return null;
    const wrap = $('preview-wrap');
    const cs = getComputedStyle(wrap);
    const aw = wrap.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const ah = wrap.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    if (aw <= 0 || ah <= 0) return null;
    const s = Math.min(aw / p.W, ah / p.H);
    const cssW = Math.max(1, Math.floor(p.W * s)), cssH = Math.max(1, Math.floor(p.H * s));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const c = $('preview');
    c.style.width = cssW + 'px'; c.style.height = cssH + 'px';
    return { w: Math.min(p.pw, Math.round(cssW * dpr)), h: Math.min(p.ph, Math.round(cssH * dpr)) };
  }

  function draw() {
    const p = active();
    if (!p || !renderer) return;
    const size = fitPreview();
    if (!size) return;
    const showOrig = state.view === 'before' || state.holdOriginal;
    renderer.render(size.w, size.h, p.grade, {
      seed: p.seed, original: showOrig, split: state.view === 'split' && !state.holdOriginal ? state.split : null,
    });
    placeSplit();
  }

  function placeSplit() {
    const on = state.view === 'split' && !!active();
    $('split-line').hidden = $('tag-before').hidden = $('tag-after').hidden = !on;
    if (!on) return;
    const c = $('preview'), wrap = $('preview-wrap');
    const r = c.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
    const left = r.left - wr.left, top = r.top - wr.top;
    const line = $('split-line');
    line.style.left = (left + r.width * state.split) + 'px';
    line.style.top = top + 'px'; line.style.height = r.height + 'px';
    $('tag-before').style.left = (left + 8) + 'px'; $('tag-before').style.top = (top + 8) + 'px';
    $('tag-after').style.left = (left + r.width - $('tag-after').offsetWidth - 8) + 'px'; $('tag-after').style.top = (top + 8) + 'px';
  }

  /* 影片／GIF 持續更新畫面 */
  let loopOn = false;
  function frameLoop() {
    const p = active();
    if (!p || p.kind === 'photo') { loopOn = false; return; }
    if (p.kind === 'video') {
      if (!p.el.paused || p.needFrame) { uploadFrame(p); draw(); p.needFrame = false; }
      const d = p.el.duration || 0;
      if (d && !scrubbing) $('scrub').value = Math.round(p.el.currentTime / d * 1000);
      $('vtime').textContent = `${fmtTime(p.el.currentTime)} / ${fmtTime(d)}`;
    } else if (p.kind === 'gif' && p.decoder) {
      if (p.playing && !p.decoding && performance.now() >= p.nextAt) showGifFrame(p, (p.frame + 1) % p.frameCount);
      if (!scrubbing) $('scrub').value = p.frameCount > 1 ? Math.round(p.frame / (p.frameCount - 1) * 1000) : 0;
      $('vtime').textContent = `${p.frame + 1} / ${p.frameCount}`;
    } else if (p.kind === 'gif' && p.playing) {
      uploadFrame(p); draw();
    }
    requestAnimationFrame(frameLoop);
  }
  const fmtTime = (s) => { s = Math.max(0, Math.floor(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  function startLoop() { if (!loopOn) { loopOn = true; requestAnimationFrame(frameLoop); } }

  function uploadFrame(p) {
    if (p.kind === 'video') {
      if (p.pw === p.W) renderer.setImage(p.el, p.W, p.H, false);
      else { p.frameCtx.drawImage(p.el, 0, 0, p.pw, p.ph); renderer.setImage(p.frameCanvas, p.pw, p.ph, false); }
    } else if (p.kind === 'gif') {
      if (!p.decoder) { p.frameCtx.clearRect(0, 0, p.pw, p.ph); p.frameCtx.drawImage(p.el, 0, 0, p.pw, p.ph); }
      renderer.setImage(p.frameCanvas, p.pw, p.ph, false);
    }
  }

  /** GIF（ImageDecoder）：解碼指定影格並畫到預覽 */
  async function showGifFrame(p, index) {
    p.decoding = true;
    try {
      const { image } = await p.decoder.decode({ frameIndex: index });
      p.frame = index;
      p.nextAt = performance.now() + Math.max(20, (image.duration || 100000) / 1000);
      p.frameCtx.clearRect(0, 0, p.pw, p.ph);
      p.frameCtx.drawImage(image, 0, 0, p.pw, p.ph);
      image.close();
      if (p === active()) { uploadFrame(p); draw(); }
    } catch (e) { console.warn('GIF frame', e); p.nextAt = performance.now() + 100; } finally { p.decoding = false; }
  }

  /* ---------- 直方圖（套用調整後，不含效果） ---------- */
  let histTimer = 0;
  function updateHistogram() {
    clearTimeout(histTimer);
    histTimer = setTimeout(() => {
      const p = active();
      if (!p || !p.small) { Widgets.drawHistogram($('histo'), null); curveEd.setHistogram(null); return; }
      const fn = compileGrade(p.grade);
      const d = p.small.data, h = { r: new Uint32Array(256), g: new Uint32Array(256), b: new Uint32Array(256), l: new Uint32Array(256) };
      const c = [0, 0, 0];
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 8) continue;
        c[0] = d[i] / 255; c[1] = d[i + 1] / 255; c[2] = d[i + 2] / 255;
        fn(c);
        const r = (c[0] * 255) | 0, g = (c[1] * 255) | 0, b = (c[2] * 255) | 0;
        h.r[r]++; h.g[g]++; h.b[b]++; h.l[(0.2126 * r + 0.7152 * g + 0.0722 * b) | 0]++;
      }
      Widgets.drawHistogram($('histo'), h);
      curveEd.setHistogram(h);
    }, 60);
  }

  /* ====================================================================
     加入檔案
     ==================================================================== */
  $('file-input').accept = Decode.ACCEPT;

  async function addFiles(files) {
    const list = [...files].filter(Decode.isSupported);
    if (!list.length) { setStatus(t('st.noFiles')); return; }
    for (const file of list) {
      setBusy(t('st.reading', { name: file.name }));
      try {
        const p = await loadFile(file);
        state.photos.push(p);
        renderList();
        if (!state.activeId || state.photos.length === 1) selectPhoto(p.id);
      } catch (err) {
        console.error(err);
        setStatus(t('st.readFail', { name: file.name, err: err.message || err }));
      }
    }
    setBusy(''); setProgress(null);
    if (state.activeId) selectPhoto(state.activeId);
  }

  const progressFor = (label) => (phase, r) => {
    setProgress(r);
    const pct = Math.round(r * 100) + '%';
    setBusy(`${label} — ${t(phase === 'download' ? 'st.ffDownload' : 'st.transcoding')} ${pct}`);
  };

  async function loadFile(file) {
    const kind = Decode.kindOf(file);
    // 新檔案沿用目前檔案的設定，方便一次處理同一批相片
    const base = active() ? clone(active().grade) : Color.defaultGrade();
    const p = { id: state.nextId++, kind, file, name: file.name, grade: base, seed: Math.random() * 100, history: [], future: [] };
    p.saved = JSON.stringify(p.grade);

    if (kind === 'video') {
      let url = URL.createObjectURL(file);
      let el;
      try { el = await Media.loadVideo(url); } catch (e) {
        URL.revokeObjectURL(url);
        url = await Media.transcodePreview(file, progressFor(t('st.transcodePrev', { name: file.name })));
        el = await Media.loadVideo(url);
        p.noteKey = 'note.transcoded';
      }
      Object.assign(p, { url, el, W: el.videoWidth, H: el.videoHeight });
      el.addEventListener('seeked', () => { p.needFrame = true; });
    } else if (kind === 'gif' && 'ImageDecoder' in window) {
      // 逐格解碼，才能暫停與拖曳時間軸
      const decoder = new ImageDecoder({ data: await file.arrayBuffer(), type: 'image/gif' });
      await decoder.tracks.ready;
      await decoder.completed;
      const { image } = await decoder.decode({ frameIndex: 0 });
      Object.assign(p, { decoder, frameCount: decoder.tracks.selectedTrack.frameCount, frame: 0, nextAt: 0, playing: true, first: image, W: image.displayWidth, H: image.displayHeight });
    } else if (kind === 'gif') {
      const url = URL.createObjectURL(file);
      const el = await Decode.loadImage(url);
      // 動畫要掛在文件上瀏覽器才會持續播放
      el.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
      document.body.appendChild(el);
      Object.assign(p, { url, el, W: el.naturalWidth, H: el.naturalHeight, playing: true });
    } else {
      const dec = await Decode.decodePhoto(file, setBusy);
      Object.assign(p, { source: dec.source, W: dec.w, H: dec.h, noteKey: dec.noteKey, noteVars: dec.noteVars });
      if (Decode.formatOf(file) === 'std') p.exif = await Decode.jpegExif(file).catch(() => null);
    }

    // 預覽用的縮小版本
    const s = Math.min(1, PREVIEW_MAX / Math.max(p.W, p.H), (renderer ? renderer.maxTex : 4096) / Math.max(p.W, p.H));
    p.pw = Math.max(1, Math.round(p.W * s)); p.ph = Math.max(1, Math.round(p.H * s));
    const frameSrc = p.kind === 'photo' ? p.source : (p.first || p.el);
    if (p.kind === 'photo') {
      if (s < 1) p.preview = await scaled(p.source, p.pw, p.ph);
      else p.preview = p.source;
    } else {
      p.frameCanvas = document.createElement('canvas');
      p.frameCanvas.width = p.pw; p.frameCanvas.height = p.ph;
      p.frameCtx = p.frameCanvas.getContext('2d', { willReadFrequently: false });
    }
    captureSmall(p, frameSrc);
    p.thumb = thumbURL(frameSrc, p.W, p.H);
    if (p.first) { p.frameCtx.drawImage(p.first, 0, 0, p.pw, p.ph); p.first.close(); p.first = null; }
    return p;
  }

  async function scaled(src, w, h) {
    try { return await createImageBitmap(src, { resizeWidth: w, resizeHeight: h, resizeQuality: 'high' }); } catch (e) {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(src, 0, 0, w, h);
      return c;
    }
  }

  /** 小尺寸像素資料：給直方圖與濾鏡縮圖用 */
  function captureSmall(p, src) {
    // 來源可能是縮小過的影格畫布，以來源本身的尺寸裁切
    const SW = src.videoWidth || src.displayWidth || src.naturalWidth || src.width, SH = src.videoHeight || src.displayHeight || src.naturalHeight || src.height;
    const s = Math.min(1, 200 / Math.max(p.W, p.H));
    const w = Math.max(1, Math.round(p.W * s)), h = Math.max(1, Math.round(p.H * s));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(src, 0, 0, w, h);
    p.small = x.getImageData(0, 0, w, h);
    // 濾鏡縮圖：中央正方形 72px
    const t = document.createElement('canvas'); t.width = t.height = 72;
    const tx = t.getContext('2d', { willReadFrequently: true });
    const side = Math.min(SW, SH);
    tx.drawImage(src, (SW - side) / 2, (SH - side) / 2, side, side, 0, 0, 72, 72);
    p.lookThumb = tx.getImageData(0, 0, 72, 72);
    p.lookThumbKey = null;
  }

  function thumbURL(src, W, H) {
    const c = document.createElement('canvas'); c.width = c.height = 104;
    const side = Math.min(W, H);
    c.getContext('2d').drawImage(src, (W - side) / 2, (H - side) / 2, side, side, 0, 0, 104, 104);
    return c.toDataURL('image/jpeg', 0.8);
  }

  /* ---------- 列表 ---------- */
  function renderList() {
    const ul = $('photo-list');
    ul.innerHTML = '';
    for (const p of state.photos) {
      const li = document.createElement('li');
      li.className = 'photo-item' + (p.id === state.activeId ? ' active' : '');
      li.innerHTML = `<img alt=""><div><div class="name"></div><div class="meta"></div></div><button class="remove" type="button" >×</button>`;
      li.querySelector('img').src = p.thumb;
      li.querySelector('.name').textContent = p.name;
      li.querySelector('.meta').textContent = metaText(p);
      li.addEventListener('click', (e) => { if (!e.target.closest('.remove')) selectPhoto(p.id); });
      li.querySelector('.remove').addEventListener('click', () => removePhoto(p.id));
      ul.appendChild(li);
    }
    $('count').textContent = state.photos.length;
    const has = state.photos.length > 0;
    $('dropzone').hidden = has; $('stage').hidden = !has;
    for (const id of ['dl-one', 'share-one', 'save-top', 'dl-cube-dock']) $(id).disabled = !has;
    $('dl-all').disabled = state.photos.length < 2;
    syncSlideButton();
  }
  function metaText(p) {
    const kind = p.kind === 'video' ? t('kind.video') : p.kind === 'gif' ? 'GIF' : (p.name.split('.').pop() || '').toUpperCase();
    const look = p.grade.look !== 'none' ? ' · ' + lookName(p.grade.look) : '';
    return `${kind} · ${p.W}×${p.H}${look}`;
  }
  function markDirty() {
    const p = active();
    const li = p && $('photo-list').children[state.photos.indexOf(p)];
    if (li) li.querySelector('.meta').textContent = metaText(p);
  }

  function removePhoto(id) {
    const i = state.photos.findIndex((p) => p.id === id);
    if (i < 0) return;
    const [p] = state.photos.splice(i, 1);
    if (p.decoder) p.decoder.close();
    if (p.first) p.first.close();
    if (p.el) { if (p.kind === 'video') { p.el.pause(); p.el.removeAttribute('src'); p.el.load(); } else p.el.remove(); }
    if (p.url) URL.revokeObjectURL(p.url);
    if (p.source && p.source.close) p.source.close();
    if (state.activeId === id) state.activeId = state.photos.length ? state.photos[Math.min(i, state.photos.length - 1)].id : null;
    renderList();
    if (state.activeId) selectPhoto(state.activeId); else { setStatus(''); renderLooks(); }
  }

  function selectPhoto(id) {
    const prev = active();
    if (prev && prev.id !== id && prev.kind === 'video') prev.el.pause();
    state.activeId = id;
    const p = active();
    if (!p) return;
    $$('#photo-list .photo-item').forEach((li, i) => li.classList.toggle('active', state.photos[i] === p));
    if (renderer) {
      if (p.kind === 'photo') renderer.setImage(p.preview, p.pw, p.ph);
      else uploadFrame(p);
    }
    const isAnim = p.kind !== 'photo';
    // 播放鍵在時間軌道旁；GIF 沒有時間軸，只顯示播放鍵
    $('video-bar').hidden = !isAnim;
    $('scrub').hidden = $('vtime').hidden = !(p.kind === 'video' || p.decoder);
    if (p.kind === 'video') { p.el.play().catch(() => {}); }
    syncPlayBtn();
    $('dims').textContent = `${p.W} × ${p.H}${p.kind === 'video' ? ' · ' + t('kind.video') : p.kind === 'gif' ? ' · GIF' : ''}`;
    setStatus(p.noteKey ? t(p.noteKey, p.noteVars) : '');
    fillForm();
    gradeChanged();
    updateHistogram();
    renderLooks();
    if (isAnim) startLoop();
  }

  /* ---------- 播放 ---------- */
  function syncPlayBtn() {
    const p = active();
    if (!p || p.kind === 'photo') return;
    const playing = p.kind === 'video' ? !p.el.paused : p.playing;
    $('play-toggle').textContent = playing ? '❚❚' : '▶';
  }
  $('play-toggle').addEventListener('click', () => {
    const p = active();
    if (!p) return;
    if (p.kind === 'video') { if (p.el.paused) p.el.play(); else p.el.pause(); setTimeout(syncPlayBtn, 30); }
    else { p.playing = !p.playing; syncPlayBtn(); }
    startLoop();
  });
  let scrubbing = false;
  $('scrub').addEventListener('input', () => {
    const p = active(); if (!p) return;
    scrubbing = true;
    if (p.kind === 'video') p.el.currentTime = $('scrub').value / 1000 * (p.el.duration || 0);
    else if (p.decoder && !p.decoding) showGifFrame(p, Math.round($('scrub').value / 1000 * (p.frameCount - 1)));
  });
  $('scrub').addEventListener('change', () => {
    scrubbing = false;
    const p = active(); if (!p || p.kind === 'photo') return;
    if (p.kind === 'gif' && p.decoder) showGifFrame(p, Math.round($('scrub').value / 1000 * (p.frameCount - 1))).then(() => { captureSmall(p, p.frameCanvas); renderLooks(); updateHistogram(); });
    else if (p.kind === 'video') { captureSmall(p, p.el); renderLooks(); updateHistogram(); }
  });

  /* ====================================================================
     表單：滑桿
     ==================================================================== */
  function getPath(obj, path) { return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj); }
  function setPath(obj, path, v) { const ks = path.split('.'); const last = ks.pop(); ks.reduce((o, k) => o[k], obj)[last] = v; }

  const sliders = [];
  for (const el of $$('.slider')) {
    const d = el.dataset;
    const min = +(d.min ?? -100), max = +(d.max ?? 100), step = +(d.step ?? 1), def = +(d.def ?? 0);
    const fixed = +(d.fixed ?? 0), unit = d.unit || '';
    el.innerHTML = `<div class="slider-head"><label></label><output></output></div><input type="range">`;
    const label = el.querySelector('label'), out = el.querySelector('output'), input = el.querySelector('input');
    label.textContent = t(d.label);
    Object.assign(input, { min, max, step, value: def });
    input.setAttribute('aria-label', t(d.label));
    if (d.grad) { input.classList.add('grad'); input.style.setProperty('--track', d.grad); }
    const fmt = (v) => (v > 0 && min < 0 ? '+' : '') + Number(v).toFixed(fixed) + unit;
    const s = { el, input, out, def, fmt, d };
    sliders.push(s);
    const apply = (v, done) => {
      out.textContent = fmt(v);
      el.classList.toggle('changed', Number(v) !== def);
      if (d.key) {
        const p = active(); if (!p) return;
        setPath(p.grade, d.key, Number(v));
        gradeChanged();
        if (d.key === 'lutAmount' || done) updateHistogram();
      } else if (d.hsl != null) {
        const p = active(); if (!p) return;
        p.grade.hsl[state.hslBand][+d.hsl] = Number(v) / 100 * (d.hsl === '0' ? 100 : 1);
        syncHslChips();
        gradeChanged();
      } else if (d.out) {
        settings[d.out] = Number(v); saveSettings();
      }
      if (done) commit();
    };
    input.addEventListener('input', () => apply(input.value, false));
    input.addEventListener('change', () => { apply(input.value, true); updateHistogram(); });
    label.addEventListener('dblclick', () => { input.value = def; apply(def, true); updateHistogram(); });
    out.addEventListener('dblclick', () => { input.value = def; apply(def, true); updateHistogram(); });
    s.set = (v) => { input.value = v; out.textContent = fmt(v); el.classList.toggle('changed', Number(v) !== def); };
  }

  function fillForm() {
    const p = active();
    for (const s of sliders) {
      if (s.d.key && p) s.set(getPath(p.grade, s.d.key));
      else if (s.d.hsl != null && p) {
        const v = p.grade.hsl[state.hslBand][+s.d.hsl];
        s.set(s.d.hsl === '0' ? v : Math.round(v * 100));
      } else if (s.d.out) s.set(settings[s.d.out]);
    }
    if (!p) return;
    $('input-profile').value = p.grade.input;
    curveEd.set(p.grade.curves[state.curveCh], state.curveCh);
    for (const w of wheels) w.wheel.set(p.grade.wheels[w.key]);
    syncHslChips();
    $$('#look-list .look').forEach((b) => b.classList.toggle('active', b.dataset.id === p.grade.look));
  }

  /* 重設按鈕 */
  $$('[data-reset]').forEach((b) => b.addEventListener('click', () => {
    const p = active(); if (!p) return;
    const d = Color.defaultGrade();
    for (const k of b.dataset.reset.split(',')) p.grade[k] = clone(d[k]);
    fillForm(); gradeChanged(); updateHistogram(); commit();
  }));

  /* ---------- 輸入色彩 ---------- */
  for (const prof of Color.PROFILES) {
    const o = document.createElement('option'); o.value = prof.id; o.textContent = t('profile.' + prof.id, null, prof.name);
    $('input-profile').appendChild(o);
  }
  $('input-profile').addEventListener('change', () => {
    const p = active(); if (!p) return;
    p.grade.input = $('input-profile').value;
    gradeChanged(); updateHistogram(); renderLooks(); commit();
  });

  /* ====================================================================
     濾鏡列表
     ==================================================================== */
  function lookName(id) {
    if (id.startsWith('u:')) { const u = state.customLuts.find((l) => l.id === id); return u ? u.name : t('look.custom'); }
    const l = Looks.get(id);
    return l ? (l.brand ? `${l.brand} ${lookLabel(l)}` : lookLabel(l)) : '';
  }

  const lookLabel = (l) => t('look.' + l.id, null, l.name);
  const chipDefs = [{ id: 'all', key: 'look.all' }, ...Looks.GROUPS.map((g) => ({ id: g.id, key: 'group.' + g.id })), { id: 'mine', key: 'look.mine' }];
  for (const g of chipDefs) {
    const b = document.createElement('button');
    b.className = 'chip'; b.type = 'button'; b.dataset.filter = g.id; b.dataset.i18n = g.key; b.textContent = t(g.key);
    b.addEventListener('click', () => { settings.lookFilter = g.id; saveSettings(); renderLooks(); });
    $('look-chips').appendChild(b);
  }
  $('look-search').addEventListener('input', () => renderLooks());

  let thumbJob = 0;
  function renderLooks() {
    const filter = settings.lookFilter, q = $('look-search').value.trim().toLowerCase();
    $$('#look-chips .chip').forEach((b) => b.classList.toggle('active', b.dataset.filter === filter));
    const p = active();
    const cur = p ? p.grade.look : 'none';
    const box = $('look-list');
    box.innerHTML = '';
    const match = (text) => !q || text.toLowerCase().includes(q);
    const sections = [];
    if (filter === 'all' && !q) sections.push({ title: '', items: [{ id: 'none', name: t('look.none'), sub: t('look.none.sub') }] });
    if (filter === 'all' || filter === 'mine') {
      const items = state.customLuts.filter((u) => match(u.name)).map((u) => ({ id: u.id, name: u.name, sub: `${u.lut.size}${u.lut.kind === '3d' ? '³' : ' 1D'} LUT`, custom: true }));
      if (items.length || filter === 'mine') sections.push({ title: t('look.mine'), items, empty: t('look.mine.empty') });
    }
    for (const g of Looks.GROUPS) {
      if (filter !== 'all' && filter !== g.id) continue;
      const items = Looks.LOOKS.filter((l) => l.group === g.id && match(`${l.brand} ${l.name} ${lookLabel(l)}`))
        .map((l) => ({ id: l.id, name: lookLabel(l), sub: l.brand }));
      if (items.length) sections.push({ title: t('group.' + g.id), items });
    }
    const cards = [];
    for (const s of sections) {
      if (s.title) {
        const h = document.createElement('div'); h.className = 'look-group-title';
        h.innerHTML = `<span></span><span class="muted"></span>`;
        h.firstChild.textContent = s.title; h.lastChild.textContent = s.items.length || '';
        box.appendChild(h);
      }
      if (!s.items.length) { const n = document.createElement('p'); n.className = 'empty-note'; n.textContent = s.empty || ''; box.appendChild(n); continue; }
      const grid = document.createElement('div'); grid.className = 'look-grid';
      for (const it of s.items) {
        const b = document.createElement('div');
        b.className = 'look' + (it.id === cur ? ' active' : '');
        b.dataset.id = it.id; b.tabIndex = 0; b.setAttribute('role', 'button');
        b.innerHTML = `<canvas width="72" height="72"></canvas><span class="look-name"></span><span class="look-sub"></span>`;
        b.querySelector('.look-name').textContent = it.name;
        b.querySelector('.look-sub').textContent = it.sub || '';
        b.title = it.sub ? `${it.sub} ${it.name}` : it.name;
        if (it.custom) {
          const del = document.createElement('button'); del.className = 'look-del'; del.type = 'button'; del.textContent = '×'; del.setAttribute('aria-label', t('look.delete'));
          del.addEventListener('click', (e) => { e.stopPropagation(); deleteCustomLut(it.id); });
          b.appendChild(del);
        }
        const pick = () => chooseLook(it.id);
        b.addEventListener('click', pick);
        b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
        grid.appendChild(b);
        cards.push({ id: it.id, canvas: b.querySelector('canvas') });
      }
      box.appendChild(grid);
    }
    drawLookThumbs(cards);
  }

  /** 範例影像：沒有相片時給濾鏡縮圖用。黃昏湖景：天空、夕陽、山、水面、草地、紅帆、黃花，涵蓋常見色調 */
  const sampleThumb = (() => {
    const S = 288, k = S / 72;  // 先畫 4 倍再縮小，邊緣比較平滑
    const big = document.createElement('canvas'); big.width = big.height = S;
    const x = big.getContext('2d');
    x.scale(k, k);
    const lin = (y0, y1, stops) => { const g = x.createLinearGradient(0, y0, 0, y1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; };
    const blob = (pts, fill) => { x.fillStyle = fill; x.beginPath(); x.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) x.lineTo(pts[i], pts[i + 1]); x.closePath(); x.fill(); };

    // 天空：深藍 → 淡紫 → 蜜桃色地平線
    x.fillStyle = lin(0, 42, [[0, '#2f5fa8'], [0.45, '#8a8fd0'], [0.8, '#f3b38a'], [1, '#ffd9a0']]);
    x.fillRect(0, 0, 72, 42);
    // 夕陽與光暈
    let g = x.createRadialGradient(50, 26, 0, 50, 26, 28);
    g.addColorStop(0, 'rgba(255,240,200,.95)'); g.addColorStop(0.25, 'rgba(255,200,120,.55)'); g.addColorStop(1, 'rgba(255,170,110,0)');
    x.fillStyle = g; x.fillRect(0, 0, 72, 42);
    x.fillStyle = '#fff4d6'; x.beginPath(); x.arc(50, 26, 5, 0, 7); x.fill();
    // 遠山（帶霧的藍紫）與近山
    blob([0, 42, 0, 30, 10, 24, 20, 29, 30, 21, 42, 30, 52, 26, 62, 31, 72, 27, 72, 42], '#7c76b4');
    blob([0, 42, 0, 34, 12, 31, 24, 36, 34, 32, 46, 37, 58, 33, 72, 36, 72, 42], '#4f5a8f');
    // 湖面：倒映天空，中間一道夕陽光
    x.fillStyle = lin(42, 58, [[0, '#f0b48e'], [0.35, '#9a8fc4'], [1, '#3d5a96']]);
    x.fillRect(0, 42, 72, 16);
    for (let i = 0; i < 6; i++) { x.fillStyle = `rgba(255,236,190,${0.75 - i * 0.11})`; x.fillRect(50 - 5 + i * 0.6, 43 + i * 2.4, 10 - i * 1.2, 0.9); }
    // 紅色帆船
    blob([20, 50, 31, 50, 29, 52.5, 22, 52.5], '#3a2b2b');
    blob([25, 49.5, 25, 40, 31, 49.5], '#e2483d');
    blob([24.5, 49.5, 24.5, 42.5, 20.5, 49.5], '#f6efe4');
    // 前景草地
    blob([0, 72, 0, 57, 14, 55, 30, 57.5, 44, 56, 58, 57, 72, 55.5, 72, 72], lin(55, 72, [[0, '#7fae4e'], [1, '#2f5a2a']]));
    // 黃花與粉花
    [[6, 62], [11, 66], [16, 61], [9, 69], [60, 63], [65, 67], [56, 68], [68, 62]].forEach(([fx, fy], i) => {
      x.fillStyle = i % 3 === 2 ? '#f48fb1' : '#ffd23f'; x.beginPath(); x.arc(fx, fy, 1.4, 0, 7); x.fill();
    });

    const c = document.createElement('canvas'); c.width = c.height = 72;
    const cx = c.getContext('2d');
    cx.imageSmoothingQuality = 'high';
    cx.drawImage(big, 0, 0, 72, 72);
    return cx.getImageData(0, 0, 72, 72);
  })();

  function drawLookThumbs(cards) {
    const job = ++thumbJob;
    const p = active();
    const src = p ? p.lookThumb : sampleThumb;
    const base = Color.defaultGrade();
    base.input = p ? p.grade.input : 'none';
    let i = 0;
    const step = () => {
      if (job !== thumbJob) return;
      const t0 = performance.now();
      while (i < cards.length && performance.now() - t0 < 12) {
        const { id, canvas } = cards[i++];
        const g = Object.assign({}, base, { look: id, lutAmount: 100 });
        const fn = compileGrade(g);
        const out = new ImageData(72, 72), d = src.data, o = out.data, c = [0, 0, 0];
        for (let k = 0; k < d.length; k += 4) {
          c[0] = d[k] / 255; c[1] = d[k + 1] / 255; c[2] = d[k + 2] / 255;
          fn(c);
          o[k] = c[0] * 255; o[k + 1] = c[1] * 255; o[k + 2] = c[2] * 255; o[k + 3] = 255;
        }
        canvas.getContext('2d').putImageData(out, 0, 0);
      }
      if (i < cards.length) setTimeout(step, 0);
    };
    step();
  }

  function chooseLook(id) {
    const p = active();
    if (!p) { setStatus(t('st.addFirst')); return; }
    p.grade.look = id;
    $$('#look-list .look').forEach((b) => b.classList.toggle('active', b.dataset.id === id));
    gradeChanged(); updateHistogram(); commit();
    setStatus(id === 'none' ? t('st.lookRemoved') : t('st.look', { name: lookName(id) }));
  }
  $('look-none').addEventListener('click', () => chooseLook('none'));

  /* ---------- 自訂 LUT：匯入與保存（IndexedDB） ---------- */
  const DB = (() => {
    let dbp = null;
    const open = () => dbp || (dbp = new Promise((res, rej) => {
      const r = indexedDB.open('lumi', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('luts', { keyPath: 'id' });
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    }));
    const tx = async (mode, fn) => { const db = await open(); return new Promise((res, rej) => { const t = db.transaction('luts', mode); const s = t.objectStore('luts'); const r = fn(s); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); }); };
    return { all: () => tx('readonly', (s) => s.getAll()), put: (v) => tx('readwrite', (s) => s.put(v)), del: (id) => tx('readwrite', (s) => s.delete(id)) };
  })();

  async function importLuts(files) {
    let n = 0;
    for (const f of files) {
      try {
        let lut;
        if (/\.cube$/i.test(f.name)) lut = Color.parseCube(await f.text());
        else if (/\.3dl$/i.test(f.name)) lut = Color.parse3dl(await f.text());
        else if (/\.png$/i.test(f.name) || f.type === 'image/png') {
          const bmp = await createImageBitmap(f, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
          const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
          const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(bmp, 0, 0);
          lut = Color.parseHald(x.getImageData(0, 0, c.width, c.height));
        } else throw new Error(t('st.lutOnly'));
        const name = (lut.title || f.name.replace(/\.[^.]+$/, '')).slice(0, 60);
        const item = { id: 'u:' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, lut };
        state.customLuts.unshift(item);
        DB.put(item).catch((e) => console.warn('LUT 無法保存', e));
        n++;
        if (active()) chooseLook(item.id);
      } catch (e) {
        console.error(e);
        setStatus(`${f.name}：${e.message}`);
      }
    }
    if (n) { settings.lookFilter = active() ? settings.lookFilter : 'mine'; renderLooks(); setStatus(t('st.lutImported', { n })); }
  }
  async function deleteCustomLut(id) {
    state.customLuts = state.customLuts.filter((l) => l.id !== id);
    state.lookCache.delete(id);
    DB.del(id).catch(() => {});
    for (const p of state.photos) if (p.grade.look === id) p.grade.look = 'none';
    renderLooks(); gradeChanged();
  }
  $('lut-input').addEventListener('change', (e) => { importLuts([...e.target.files]); e.target.value = ''; });

  /* ====================================================================
     曲線、HSL、色輪
     ==================================================================== */
  const curveEd = new Widgets.CurveEditor($('curve'), (pts, ch, done) => {
    const p = active(); if (!p) return;
    p.grade.curves[ch] = pts;
    gradeChanged();
    if (done) { updateHistogram(); commit(); }
  });
  $$('#curve-seg .seg-btn').forEach((b) => b.addEventListener('click', () => {
    state.curveCh = b.dataset.ch;
    $$('#curve-seg .seg-btn').forEach((x) => x.classList.toggle('active', x === b));
    const p = active();
    curveEd.set(p ? p.grade.curves[state.curveCh] : [[0, 0], [1, 1]], state.curveCh);
  }));
  $('curve-reset').addEventListener('click', () => {
    const p = active();
    if (!p) { curveEd.set([[0, 0], [1, 1]], state.curveCh); return; }
    const linear = (pts) => pts.length === 2 && pts[0][0] === 0 && pts[0][1] === 0 && pts[1][0] === 1 && pts[1][1] === 1;
    // 這條已經是直線時改為重設全部曲線，避免按了看起來沒反應
    const keys = linear(p.grade.curves[state.curveCh]) ? ['rgb', 'r', 'g', 'b'] : [state.curveCh];
    for (const k of keys) p.grade.curves[k] = [[0, 0], [1, 1]];
    curveEd.set(p.grade.curves[state.curveCh], state.curveCh);
    gradeChanged(); updateHistogram(); commit();
  });
  const CURVE_PRESETS = {
    linear: [[0, 0], [1, 1]],
    soft: [[0, 0], [0.25, 0.21], [0.75, 0.79], [1, 1]],
    strong: [[0, 0], [0.25, 0.16], [0.75, 0.85], [1, 1]],
    matte: [[0, 0.08], [0.22, 0.2], [0.75, 0.77], [1, 0.96]],
    fade: [[0, 0.12], [0.5, 0.52], [1, 0.9]],
    invert: [[0, 1], [1, 0]],
  };
  $$('#curve-presets .chip').forEach((b) => b.addEventListener('click', () => {
    const p = active(); if (!p) return;
    p.grade.curves[state.curveCh] = clone(CURVE_PRESETS[b.dataset.preset]);
    curveEd.set(p.grade.curves[state.curveCh], state.curveCh);
    gradeChanged(); updateHistogram(); commit();
  }));

  for (const band of Color.HSL_BANDS) {
    const b = document.createElement('button');
    b.className = 'hsl-chip'; b.type = 'button'; b.dataset.band = band.key;
    b.style.setProperty('--c', band.color); b.dataset.i18nTitle = b.dataset.i18nAria = 'band.' + band.key; b.title = t('band.' + band.key); b.setAttribute('aria-label', b.title);
    b.addEventListener('click', () => { state.hslBand = band.key; fillForm(); });
    $('hsl-chips').appendChild(b);
  }
  function syncHslChips() {
    const p = active();
    $$('#hsl-chips .hsl-chip').forEach((b) => {
      b.classList.toggle('active', b.dataset.band === state.hslBand);
      b.classList.toggle('dirty', !!p && p.grade.hsl[b.dataset.band].some((v) => v));
    });
  }

  const wheels = $$('.wheel').map((el) => {
    const key = el.dataset.wheel;
    const wheel = new Widgets.Wheel(el.querySelector('canvas'), (v, done) => {
      const p = active(); if (!p) return;
      p.grade.wheels[key] = v;
      gradeChanged();
      if (done) { updateHistogram(); commit(); }
    });
    return { key, wheel };
  });

  /* ====================================================================
     復原／重做
     ==================================================================== */
  function commit() {
    const p = active(); if (!p) return;
    const now = JSON.stringify(p.grade);
    if (now === p.saved) return;
    p.history.push(p.saved); if (p.history.length > 100) p.history.shift();
    p.future = []; p.saved = now;
  }
  function undo(redo) {
    const p = active(); if (!p) return;
    const from = redo ? p.future : p.history, to = redo ? p.history : p.future;
    if (!from.length) return;
    to.push(p.saved);
    p.saved = from.pop();
    p.grade = JSON.parse(p.saved);
    fillForm(); gradeChanged(); updateHistogram();
    setStatus(t(redo ? 'st.redo' : 'st.undo'));
  }

  /* ====================================================================
     複製／貼上／套用全部
     ==================================================================== */
  $('copy-grade').addEventListener('click', () => {
    const p = active(); if (!p) return;
    state.clipboard = clone(p.grade); $('paste-grade').disabled = false; setStatus(t('st.copied'));
  });
  $('paste-grade').addEventListener('click', () => {
    const p = active(); if (!p || !state.clipboard) return;
    p.grade = clone(state.clipboard); fillForm(); gradeChanged(); updateHistogram(); commit(); setStatus(t('st.pasted'));
  });
  $('apply-all').addEventListener('click', () => {
    const p = active(); if (!p) return;
    for (const q of state.photos) if (q !== p) { q.history.push(JSON.stringify(q.grade)); q.grade = clone(p.grade); q.saved = JSON.stringify(q.grade); }
    renderList(); setStatus(t('st.appliedAll', { n: state.photos.length }));
  });
  $('reset-all').addEventListener('click', () => {
    const p = active(); if (!p) return;
    const input = p.grade.input;
    p.grade = Color.defaultGrade(); p.grade.input = input;
    fillForm(); gradeChanged(); updateHistogram(); commit(); renderLooks(); setStatus(t('st.reset'));
  });

  /* ====================================================================
     輸出
     ==================================================================== */
  function segBind(id, key, onSet) {
    const btns = $$(`#${id} .seg-btn`);
    const sync = () => { btns.forEach((b) => b.classList.toggle('active', b.dataset.v === settings[key])); onSet && onSet(); };
    btns.forEach((b) => b.addEventListener('click', () => { if (b.disabled) return; settings[key] = b.dataset.v; saveSettings(); sync(); }));
    sync();
  }
  segBind('photo-format', 'photoFormat', () => { $$('[data-out="quality"]').forEach((e) => { e.style.opacity = settings.photoFormat === 'png' ? 0.45 : 1; }); });
  segBind('video-format', 'videoFormat', () => {
    $$('.gif-only').forEach((e) => { e.hidden = settings.videoFormat !== 'gif'; });
    $$('.video-only').forEach((e) => { e.hidden = settings.videoFormat === 'gif'; });
  });
  const bindSelect = (id, key, num = true) => { $(id).value = String(settings[key]); $(id).addEventListener('change', () => { settings[key] = num ? Number($(id).value) : $(id).value; saveSettings(); }); };
  bindSelect('photo-size', 'photoSize'); bindSelect('video-width', 'videoWidth'); bindSelect('cube-size', 'cubeSize');
  $('keep-exif').checked = settings.keepExif; $('keep-exif').addEventListener('change', () => { settings.keepExif = $('keep-exif').checked; saveSettings(); });
  $('video-mute').checked = settings.mute; $('video-mute').addEventListener('change', () => { settings.mute = $('video-mute').checked; saveSettings(); });

  // 不支援 AVIF 編碼的瀏覽器停用該選項
  (function () {
    const c = document.createElement('canvas'); c.width = c.height = 2;
    c.toBlob((b) => {
      if (!b || b.type !== 'image/avif') {
        const btn = $$('#photo-format .seg-btn').find((x) => x.dataset.v === 'avif');
        btn.disabled = true; btn.dataset.i18nTitle = 'st.avifNo'; btn.title = t('st.avifNo');
        if (settings.photoFormat === 'avif') { settings.photoFormat = 'jpeg'; saveSettings(); $$('#photo-format .seg-btn').forEach((x) => x.classList.toggle('active', x.dataset.v === 'jpeg')); }
      }
    }, 'image/avif');
  })();

  // 日期格式（對齊光痕 LuTrace），取本地日期
  const pad2 = (n) => String(n).padStart(2, '0');
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function fmtDate(d = new Date(), format = settings.dateFormat) {
    const y = d.getFullYear(), mo = d.getMonth() + 1, day = d.getDate();
    if (format === 'slash') return `${y}/${pad2(mo)}/${pad2(day)}`;
    if (format === 'dot') return `${y}.${pad2(mo)}.${pad2(day)}`;
    if (format === 'short') return I18n.lang === 'en' ? `${MONTHS[mo - 1]} ${day}` : `${mo}月${day}日`; // 中文、日文相同
    return `${y}-${pad2(mo)}-${pad2(day)}`;
  }
  const dateLabels = () => $$('#date-format .seg-btn').forEach((b) => { b.textContent = fmtDate(new Date(), b.dataset.v); });
  if (!['slash', 'dash', 'dot', 'short'].includes(settings.dateFormat)) settings.dateFormat = 'dash';
  segBind('date-format', 'dateFormat');
  dateLabels();
  // 範例日期跟著今天走：過午夜、切回分頁時重新整理
  (function tickMidnight() {
    const now = new Date(), next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    setTimeout(() => { dateLabels(); tickMidnight(); }, next - now + 1000);
  })();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) dateLabels(); });

  const baseName = (n) => n.replace(/\.[^.]+$/, '');
  const outName = (p, ext) => `${baseName(p.name)}_lumi.${ext}`;

  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);
  }

  /** 以原始解析度算圖輸出相片 */
  async function renderPhoto(p) {
    const fmt = settings.photoFormat;
    const maxSide = settings.photoSize || 0;
    const canvas = document.createElement('canvas');
    const r = new Renderer(canvas);
    try {
      let s = 1;
      if (maxSide && Math.max(p.W, p.H) > maxSide) s = maxSide / Math.max(p.W, p.H);
      s = Math.min(s, r.maxTex / Math.max(p.W, p.H));
      const w = Math.round(p.W * s), h = Math.round(p.H * s);
      const src = s < 1 ? await scaled(p.source, w, h) : p.source;
      r.setImage(src, w, h, false);
      r.setLut(Color.bake(compileGrade(p.grade), 65), 65);
      r.render(w, h, p.grade, { seed: p.seed });
      let out = canvas;
      if (fmt === 'jpeg') { // JPEG 沒有透明：鋪白底
        out = document.createElement('canvas'); out.width = w; out.height = h;
        const x = out.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(canvas, 0, 0);
      }
      const type = `image/${fmt}`;
      let blob = await new Promise((res) => out.toBlob(res, type, settings.quality / 100));
      if (!blob) throw new Error(t('err.format'));
      if (fmt === 'jpeg' && settings.keepExif && p.exif) blob = await Decode.withExif(blob, p.exif);
      if (out !== canvas) { out.width = out.height = 0; }
      return { blob, name: outName(p, fmt === 'jpeg' ? 'jpg' : fmt) };
    } finally { r.dispose(); canvas.width = canvas.height = 0; }
  }

  async function renderVideo(p, label) {
    const fx = p.grade;
    const cube = Color.toCube(Color.bake(compileGrade(p.grade), 33), 33, 'Lumi');
    let mask = null;
    if (fx.vignette) {
      const mw = Math.min(p.W, 1920), mh = Math.round(p.H * mw / p.W);
      const mc = Renderer.vignetteMask(mw, mh, fx);
      mask = await new Promise((r) => mc.toBlob(r, 'image/png'));
    }
    const fmt = settings.videoFormat;
    const blob = await Media.exportVideo({
      file: p.file, cube, fx, mask, width: p.W, height: p.H, format: fmt,
      mute: settings.mute, fps: settings.fps, maxWidth: settings.videoWidth,
    }, (phase, r) => {
      setProgress(r);
      setStatus(`${label ? label + ' — ' : ''}${t(phase === 'download' ? 'st.ffDownload' : 'st.encoding')} ${Math.round(r * 100)}%`);
    });
    return { blob, name: outName(p, fmt) };
  }

  const renderOne = (p, label) => (p.kind === 'photo' ? renderPhoto(p) : renderVideo(p, label));

  let busy = false;
  async function guarded(fn) {
    if (busy) return;
    busy = true;
    $$('.export-dock .btn, #save-top').forEach((b) => { b.dataset.wasDisabled = b.disabled; b.disabled = true; });
    try { await fn(); } catch (e) { console.error(e); setStatus(t('st.exportFail', { err: (e.message || e).toString().split('\n')[0] })); } finally {
      busy = false; setProgress(null);
      $$('.export-dock .btn, #save-top').forEach((b) => { b.disabled = b.dataset.wasDisabled === 'true'; });
      renderList();
    }
  }

  async function downloadActive() {
    const p = active(); if (!p) return;
    await guarded(async () => {
      setStatus(t('st.exporting'));
      const { blob, name } = await renderOne(p);
      download(blob, name);
      setStatus(t('st.exported', { name, mb: (blob.size / 1048576).toFixed(1) }));
    });
  }
  $('dl-one').addEventListener('click', downloadActive);
  $('save-top').addEventListener('click', downloadActive);

  $('share-one').addEventListener('click', async () => {
    const p = active(); if (!p) return;
    await guarded(async () => {
      setStatus(t('st.exporting'));
      const { blob, name } = await renderOne(p);
      const file = new File([blob], name, { type: blob.type });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file] }); setStatus(t('st.shareOpened')); } catch (e) { if (e.name !== 'AbortError') throw e; setStatus(''); }
      } else { download(blob, name); setStatus(t('st.shareFallback', { name })); }
    });
  });

  $('dl-all').addEventListener('click', () => guarded(async () => {
    if (!window.JSZip) throw new Error(t('st.zipLoading'));
    const zip = new JSZip();
    const used = new Set();
    for (let i = 0; i < state.photos.length; i++) {
      const p = state.photos[i];
      const label = `(${i + 1}/${state.photos.length}) ${p.name}`;
      setStatus(t('st.exportingN', { label }));
      setProgress(i / state.photos.length);
      let { blob, name } = await renderOne(p, label);
      while (used.has(name)) name = name.replace(/(\.[^.]+)$/, '_1$1');
      used.add(name);
      zip.file(name, blob);
    }
    setStatus(t('st.zipping'));
    const out = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
    download(out, `lumi_${fmtDate().replace(/\//g, '／')}.zip`); // 檔名不能有斜線，改用全形
    setStatus(t('st.zipDone', { n: state.photos.length }));
  }));

  function exportCube() {
    const p = active(); if (!p) return;
    const N = settings.cubeSize || 33;
    const name = p.grade.look !== 'none' ? lookName(p.grade.look) : 'Lumi Grade';
    const text = Color.toCube(Color.bake(compileGrade(p.grade), N), N, name);
    download(new Blob([text], { type: 'text/plain' }), `${name.replace(/[\\/:*?"<>|\s]+/g, '_')}_${N}.cube`);
    setStatus(t('st.cubeDone', { n: N }));
  }
  $('export-cube').addEventListener('click', exportCube);

  /* ====================================================================
     多張相片合成 GIF／MP4
     ==================================================================== */
  const slidePhotos = () => state.photos.filter((p) => p.kind === 'photo');
  function syncSlideButton() {
    const n = slidePhotos().length;
    $('make-slides').textContent = t('slide.make', { n });
    $('make-slides').disabled = n < 2 || busy;
  }
  segBind('slide-format', 'slideFormat');
  segBind('slide-fit', 'slideFit');
  segBind('slide-motion', 'slideMotion', () => { $$('.slide-smooth').forEach((e) => { e.hidden = settings.slideMotion === 'none'; }); });
  bindSelect('slide-size', 'slideSize');

  /** 以指定長邊算圖，回傳套用調整後的 2D 畫布 */
  async function renderGraded(p, longSide) {
    const canvas = document.createElement('canvas');
    const r = new Renderer(canvas);
    try {
      const s = Math.min(1, longSide / Math.max(p.W, p.H), r.maxTex / Math.max(p.W, p.H));
      const w = Math.max(1, Math.round(p.W * s)), h = Math.max(1, Math.round(p.H * s));
      r.setImage(s < 1 ? await scaled(p.source, w, h) : p.source, w, h, false);
      r.setLut(Color.bake(compileGrade(p.grade), LUT_FULL), LUT_FULL);
      r.render(w, h, p.grade, { seed: p.seed });
      const out = document.createElement('canvas'); out.width = w; out.height = h;
      out.getContext('2d').drawImage(canvas, 0, 0);
      return out;
    } finally { r.dispose(); canvas.width = canvas.height = 0; }
  }

  $('make-slides').addEventListener('click', () => guarded(async () => {
    const list = slidePhotos();
    if (list.length < 2) { setStatus(t('slide.need2')); return; }
    const S = settings, cover = S.slideFit === 'cover';
    // 輸出尺寸依第一張的比例，長邊為設定值（偶數，影片編碼需要）
    const ar = list[0].W / list[0].H, L = S.slideSize;
    const W = 2 * Math.round((ar >= 1 ? L : L * ar) / 2), H = 2 * Math.round((ar >= 1 ? L / ar : L) / 2);

    // 每張先算好調整後、符合構圖的畫面
    const slides = [];
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      setStatus(t('slide.rendering', { i: i + 1, n: list.length })); setProgress(i / list.length);
      const k = cover ? Math.max(W / p.W, H / p.H) : Math.min(W / p.W, H / p.H);
      const src = await renderGraded(p, Math.ceil(Math.max(p.W, p.H) * k * (S.slideMotion === 'zoom' ? 1.1 : 1)));
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const x = c.getContext('2d');
      x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
      const dw = p.W * k, dh = p.H * k;
      x.imageSmoothingQuality = 'high';
      x.drawImage(src, (W - dw) / 2, (H - dh) / 2, dw, dh);
      src.width = src.height = 0;
      slides.push(c);
    }

    const gif = S.slideFormat === 'gif';
    const frames = [];
    const frame = document.createElement('canvas'); frame.width = W; frame.height = H;
    const fx = frame.getContext('2d');
    const toJpeg = () => new Promise((res) => frame.toBlob(res, 'image/jpeg', 0.92));
    let fps;
    if (S.slideMotion === 'none') {
      // 直接切換：一張一格，用影格率控制停留時間
      fps = 1 / S.slideHold;
      for (const c of slides) { fx.drawImage(c, 0, 0); frames.push(await toJpeg()); }
    } else {
      fps = gif ? 15 : 30;
      const hold = Math.max(1, Math.round(S.slideHold * fps)), trans = Math.max(2, Math.round(S.slideTrans * fps));
      const per = hold + trans, total = per * slides.length;
      const ease = (v) => v * v * (3 - 2 * v);
      // 推近：每張在自己的時間內從 1.0 慢慢放大到 1.08
      const drawSlide = (c, z, alpha) => {
        fx.globalAlpha = alpha;
        fx.drawImage(c, (W - W * z) / 2, (H - H * z) / 2, W * z, H * z);
      };
      const zoomOf = (local) => (S.slideMotion === 'zoom' ? 1 + 0.08 * (local / (per + trans)) : 1);
      let holdBlob = null;
      for (let f = 0; f < total; f++) {
        const i = Math.floor(f / per), local = f % per;
        const a = slides[i], b = slides[(i + 1) % slides.length]; // 最後一張淡回第一張，循環播放更順
        if (local < hold && S.slideMotion !== 'zoom' && holdBlob && local > 0) { frames.push(holdBlob); continue; }
        fx.globalAlpha = 1; fx.fillStyle = '#000'; fx.fillRect(0, 0, W, H);
        drawSlide(a, zoomOf(local + trans), 1);
        if (local >= hold) drawSlide(b, zoomOf(local - hold), ease((local - hold + 1) / trans));
        fx.globalAlpha = 1;
        const blob = await toJpeg();
        frames.push(blob);
        holdBlob = local < hold ? blob : null;
        if (f % 10 === 0) { setStatus(t('slide.frames', { i: f + 1, n: total })); setProgress(f / total); }
      }
    }
    slides.forEach((c) => { c.width = c.height = 0; });

    const blob = await Media.encodeFrames({ frames, fps, format: S.slideFormat }, (phase, r) => {
      setProgress(r);
      setStatus(`${t(phase === 'download' ? 'st.ffDownload' : 'st.encoding')} ${Math.round(r * 100)}%`);
    });
    const name = `lumi_${list.length}photos.${S.slideFormat}`;
    download(blob, name);
    setStatus(t('st.exported', { name, mb: (blob.size / 1048576).toFixed(1) }));
  }));
  $('dl-cube-dock').addEventListener('click', exportCube);

  /* ====================================================================
     介面：分頁、主題、檢視模式、拖放
     ==================================================================== */
  function setTab(tab) {
    settings.tab = tab; saveSettings();
    $('settings-panel').dataset.tab = tab;
    $$('.itab, .tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    if (tab === 'curve') requestAnimationFrame(() => curveEd.draw());
    if (tab === 'color') requestAnimationFrame(() => wheels.forEach((w) => w.wheel.draw()));
    if (tab === 'adjust') updateHistogram();
    $('settings-panel').scrollTop = 0;
  }
  $$('.itab, .tab').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));

  function applyTheme(t) {
    settings.theme = t; saveSettings();
    if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
    try { localStorage.setItem('lumi.theme', t); } catch (e) { /* 無痕模式 */ }
    $('ui-theme').value = t;
    $$('#ui-theme-m .seg-btn').forEach((b) => b.classList.toggle('active', b.dataset.uiTheme === t));
    requestAnimationFrame(() => { curveEd.draw(); wheels.forEach((w) => w.wheel.draw()); updateHistogram(); });
  }
  $('ui-theme').addEventListener('change', () => applyTheme($('ui-theme').value));
  $$('#ui-theme-m .seg-btn').forEach((b) => b.addEventListener('click', () => applyTheme(b.dataset.uiTheme)));

  $$('#view-seg .seg-btn').forEach((b) => b.addEventListener('click', () => {
    state.view = b.dataset.view;
    $$('#view-seg .seg-btn').forEach((x) => x.classList.toggle('active', x === b));
    draw();
  }));

  // 前後對比的分隔線；在「調整後」模式按住畫面可暫時看原圖
  const wrap = $('preview-wrap');
  let dragSplit = false;
  function splitFrom(e) {
    const r = $('preview').getBoundingClientRect();
    state.split = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    draw();
  }
  wrap.addEventListener('pointerdown', (e) => {
    if (!active()) return;
    if (state.view === 'split') { dragSplit = true; wrap.setPointerCapture(e.pointerId); splitFrom(e); }
    else if (state.view === 'after' && e.target.id === 'preview') { state.holdOriginal = true; draw(); }
  });
  wrap.addEventListener('pointermove', (e) => { if (dragSplit) splitFrom(e); });
  const endHold = () => { dragSplit = false; if (state.holdOriginal) { state.holdOriginal = false; draw(); } };
  wrap.addEventListener('pointerup', endHold);
  wrap.addEventListener('pointercancel', endHold);
  wrap.addEventListener('pointerleave', () => { if (state.holdOriginal) endHold(); });
  new ResizeObserver(() => draw()).observe(wrap);

  // 鍵盤：\ 看原圖、⌘Z 復原
  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input[type=text], input[type=search], input[type=url], select, textarea')) return;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(e.shiftKey); return; }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); undo(true); return; }
    if (e.key === '\\' && !e.repeat) { state.holdOriginal = true; draw(); }
    if (e.key === ' ' && active() && active().kind !== 'photo' && !e.target.closest('button, input')) { e.preventDefault(); $('play-toggle').click(); }
  });
  document.addEventListener('keyup', (e) => { if (e.key === '\\') { state.holdOriginal = false; draw(); } });

  // 加入檔案
  $('file-input').addEventListener('change', (e) => { addFiles(e.target.files); e.target.value = ''; });
  $('dz-add').addEventListener('click', () => $('file-input').click());
  $('remove-all').addEventListener('click', () => { for (const p of [...state.photos]) removePhoto(p.id); });

  let dragDepth = 0;
  const isLut = (f) => /\.(cube|3dl)$/i.test(f.name);
  document.addEventListener('dragenter', (e) => { if ([...(e.dataTransfer?.types || [])].includes('Files')) { dragDepth++; $('stage-panel').classList.add('dragging'); } });
  document.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; $('stage-panel').classList.remove('dragging'); } });
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => {
    e.preventDefault(); dragDepth = 0; $('stage-panel').classList.remove('dragging');
    const files = [...(e.dataTransfer?.files || [])];
    const luts = files.filter(isLut);
    if (luts.length) importLuts(luts);
    const media = files.filter((f) => !isLut(f));
    if (media.length) addFiles(media);
  });
  document.addEventListener('paste', (e) => {
    if (e.target.closest('input, textarea')) return;
    const files = [...(e.clipboardData?.files || [])];
    if (files.length) { e.preventDefault(); addFiles(files); }
  });

  $('url-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = $('url-input').value.trim();
    if (!url) return;
    setBusy(t('st.downloading'));
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      let name = decodeURIComponent(new URL(url).pathname.split('/').pop() || 'image');
      if (!/\.[a-z0-9]{2,5}$/i.test(name)) name += '.' + ((blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg').replace('quicktime', 'mov'));
      $('url-input').value = '';
      await addFiles([new File([blob], name, { type: blob.type })]);
    } catch (err) {
      setBusy('');
      setStatus(t('st.urlFail', { err: err.message }));
    }
  });

  document.querySelectorAll('.copyright-year').forEach((e) => { e.textContent = new Date().getFullYear(); });
  window.addEventListener('beforeunload', (e) => { if (state.photos.some((p) => p.history.length)) { e.preventDefault(); e.returnValue = ''; } });

  /* ---------- 啟動 ---------- */
  if (!renderer) setStatus(t('st.noWebgl'));
  /* ---------- 語言 ---------- */
  function fillLangSelects() {
    for (const id of ['ui-lang', 'ui-lang-m']) {
      const sel = $(id);
      sel.innerHTML = '';
      for (const l of I18n.SUPPORTED) { const o = document.createElement('option'); o.value = l.code; o.textContent = l.label; sel.appendChild(o); }
      sel.value = I18n.lang;
      sel.onchange = () => I18n.setLang(sel.value);
    }
  }
  function localize() {
    I18n.apply();
    $$('#photo-size option[data-size]').forEach((o) => { o.textContent = t('size.long', { n: o.dataset.size }); });
    for (const s of sliders) { const l = t(s.d.label); s.el.querySelector('label').textContent = l; s.input.setAttribute('aria-label', l); }
    $$('#input-profile option').forEach((o) => { const prof = Color.PROFILES.find((x) => x.id === o.value); o.textContent = t('profile.' + o.value, null, prof.name); });
    ['ui-lang', 'ui-lang-m'].forEach((id) => { $(id).value = I18n.lang; });
  }
  window.addEventListener('langchange', () => {
    localize(); renderList(); renderLooks(); dateLabels();
    const p = active();
    if (p) { $('dims').textContent = `${p.W} × ${p.H}${p.kind === 'video' ? ' · ' + t('kind.video') : p.kind === 'gif' ? ' · GIF' : ''}`; setStatus(p.noteKey ? t(p.noteKey, p.noteVars) : ''); }
  });
  fillLangSelects();
  localize();

  applyTheme(settings.theme);
  setTab(settings.tab);
  renderList();
  renderLooks();
  DB.all().then((items) => {
    state.customLuts = (items || []).sort((a, b) => (a.id < b.id ? 1 : -1));
    if (state.customLuts.length) renderLooks();
  }).catch(() => {});

  window.Lumi = { state, addFiles, compileGrade, renderOne }; // 方便在主控台除錯
})();
