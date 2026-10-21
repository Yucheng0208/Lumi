/* 曲線編輯器、色輪、直方圖 */
(function () {
  'use strict';

  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const CH_COLOR = { rgb: null, r: '#e5484d', g: '#2f9e44', b: '#2f6fd1' };

  function fitCanvas(canvas) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
    if (w && (canvas.width !== w || canvas.height !== h)) { canvas.width = w; canvas.height = h; }
    return dpr;
  }

  /* ---------- 曲線 ---------- */
  class CurveEditor {
    constructor(canvas, onChange) {
      this.c = canvas; this.onChange = onChange;
      this.points = [[0, 0], [1, 1]]; this.ch = 'rgb'; this.hist = null; this.drag = -1;
      canvas.addEventListener('pointerdown', (e) => this.down(e));
      canvas.addEventListener('pointermove', (e) => this.move(e));
      canvas.addEventListener('pointerup', (e) => this.up(e));
      canvas.addEventListener('pointercancel', (e) => this.up(e));
      canvas.addEventListener('dblclick', (e) => this.dbl(e));
      new ResizeObserver(() => this.draw()).observe(canvas);
    }
    set(points, ch) { this.points = points.map((p) => p.slice()); this.ch = ch; this.draw(); }
    setHistogram(h) { this.hist = h; this.draw(); }
    pos(e) {
      const r = this.c.getBoundingClientRect(), pad = 8;
      return [Math.min(1, Math.max(0, (e.clientX - r.left - pad) / (r.width - pad * 2))),
        (1 - (e.clientY - r.top - pad) / (r.height - pad * 2))];
    }
    hit(p) {
      const r = this.c.getBoundingClientRect(), tol = (e) => e * 14 / r.width;
      let best = -1, bd = 1e9;
      this.points.forEach((q, i) => { const d = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d < bd) { bd = d; best = i; } });
      return bd < tol(1.4) ? best : -1;
    }
    down(e) {
      e.preventDefault();
      const p = this.pos(e);
      let i = this.hit(p);
      if (i < 0) {
        const t = Color.curveTable(this.points);
        const np = [p[0], Color.lookup(t, p[0])];
        this.points.push(np);
        this.points.sort((a, b) => a[0] - b[0]);
        i = this.points.indexOf(np);
      }
      this.drag = i; this.removed = false;
      this.c.setPointerCapture(e.pointerId);
      this.move(e);
    }
    move(e) {
      if (this.drag < 0) return;
      const p = this.pos(e), pts = this.points, i = this.drag;
      const last = pts.length - 1;
      const lo = i === 0 ? 0 : pts[i - 1][0] + 0.01, hi = i === last ? 1 : pts[i + 1][0] - 0.01;
      // 中間的點拖出框外就刪除
      const out = i > 0 && i < last && (p[1] < -0.08 || p[1] > 1.08);
      this.removed = out;
      pts[i] = [Math.min(hi, Math.max(lo, p[0])), Math.min(1, Math.max(0, p[1]))];
      this.draw();
      this.emit(out ? pts.filter((_, k) => k !== i) : pts);
    }
    up() {
      if (this.drag < 0) return;
      if (this.removed) this.points.splice(this.drag, 1);
      this.drag = -1; this.removed = false;
      this.draw();
      this.emit(this.points, true);
    }
    dbl(e) {
      const i = this.hit(this.pos(e));
      if (i > 0 && i < this.points.length - 1) { this.points.splice(i, 1); this.draw(); this.emit(this.points, true); }
    }
    emit(pts, done) { this.onChange(pts.map((p) => p.slice()), this.ch, done); }

    draw() {
      const c = this.c, dpr = fitCanvas(c), ctx = c.getContext('2d');
      const W = c.width, H = c.height, pad = 8 * dpr, w = W - pad * 2, h = H - pad * 2;
      const X = (x) => pad + x * w, Y = (y) => pad + (1 - y) * h;
      ctx.clearRect(0, 0, W, H);
      // 直方圖
      const hist = this.hist && (this.ch === 'rgb' ? this.hist.l : this.hist[this.ch]);
      if (hist) {
        let max = 0; for (let i = 2; i < 254; i++) max = Math.max(max, hist[i]);
        ctx.fillStyle = this.ch === 'rgb' ? css('--muted') : CH_COLOR[this.ch];
        ctx.globalAlpha = 0.18;
        ctx.beginPath(); ctx.moveTo(X(0), Y(0));
        for (let i = 0; i < 256; i++) ctx.lineTo(X(i / 255), Y(Math.min(1, hist[i] / (max || 1)) * 0.9));
        ctx.lineTo(X(1), Y(0)); ctx.fill();
        ctx.globalAlpha = 1;
      }
      // 格線
      ctx.strokeStyle = css('--border'); ctx.lineWidth = dpr;
      ctx.beginPath();
      for (let k = 1; k < 4; k++) { ctx.moveTo(X(k / 4), Y(0)); ctx.lineTo(X(k / 4), Y(1)); ctx.moveTo(X(0), Y(k / 4)); ctx.lineTo(X(1), Y(k / 4)); }
      ctx.stroke();
      ctx.setLineDash([4 * dpr, 4 * dpr]);
      ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(1), Y(1)); ctx.stroke();
      ctx.setLineDash([]);
      // 曲線
      const pts = this.removed ? this.points.filter((_, k) => k !== this.drag) : this.points;
      const t = Color.curveTable(pts);
      ctx.strokeStyle = CH_COLOR[this.ch] || css('--text'); ctx.lineWidth = 2 * dpr;
      ctx.beginPath();
      for (let i = 0; i <= 200; i++) { const x = i / 200; const y = Color.lookup(t, x); i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y)); }
      ctx.stroke();
      // 控制點
      this.points.forEach((p, i) => {
        ctx.beginPath(); ctx.arc(X(p[0]), Y(p[1]), (i === this.drag ? 6 : 5) * dpr, 0, Math.PI * 2);
        ctx.fillStyle = css('--panel'); ctx.fill();
        ctx.lineWidth = 2 * dpr; ctx.strokeStyle = CH_COLOR[this.ch] || css('--primary');
        if (this.removed && i === this.drag) ctx.globalAlpha = 0.3;
        ctx.stroke(); ctx.globalAlpha = 1;
      });
    }
  }

  /* ---------- 色輪：角度 = 色相，半徑 = 強度 ---------- */
  class Wheel {
    constructor(canvas, onChange) {
      this.c = canvas; this.onChange = onChange; this.v = [0, 0];
      const set = (e) => {
        const r = canvas.getBoundingClientRect();
        const dx = e.clientX - r.left - r.width / 2, dy = e.clientY - r.top - r.height / 2;
        const R = r.width / 2 - 6;
        const hue = (Math.atan2(-dy, dx) * 180 / Math.PI + 360) % 360;
        const amt = Math.min(100, Math.round(Math.hypot(dx, dy) / R * 100));
        this.v = [Math.round(hue), amt];
        this.draw(); this.onChange(this.v.slice());
      };
      let on = false;
      canvas.addEventListener('pointerdown', (e) => { on = true; canvas.setPointerCapture(e.pointerId); set(e); });
      canvas.addEventListener('pointermove', (e) => { if (on) set(e); });
      canvas.addEventListener('pointerup', () => { on = false; this.onChange(this.v.slice(), true); });
      canvas.addEventListener('dblclick', () => { this.v = [this.v[0], 0]; this.draw(); this.onChange(this.v.slice(), true); });
      new ResizeObserver(() => this.draw()).observe(canvas);
    }
    set(v) { this.v = v.slice(); this.draw(); }
    draw() {
      const c = this.c, dpr = fitCanvas(c), ctx = c.getContext('2d');
      const W = c.width, cx = W / 2, R = W / 2 - 6 * dpr;
      if (!W) return;
      ctx.clearRect(0, 0, W, W);
      if (!this.bg || this.bg.width !== W) {
        const bg = document.createElement('canvas'); bg.width = bg.height = W;
        const b = bg.getContext('2d'), img = b.createImageData(W, W), out = [0, 0, 0];
        for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
          const dx = x - cx, dy = y - cx, d = Math.hypot(dx, dy) / R;
          if (d > 1) continue;
          const hue = (Math.atan2(-dy, dx) * 180 / Math.PI + 360) % 360;
          Color.hsl2rgb(hue, 0.85, 1 - 0.5 * Math.min(1, d), out);
          const o = (y * W + x) * 4;
          img.data[o] = out[0] * 255; img.data[o + 1] = out[1] * 255; img.data[o + 2] = out[2] * 255;
          img.data[o + 3] = 255 * Math.min(1, (1 - d) * R / dpr + 0.5);
        }
        b.putImageData(img, 0, 0);
        this.bg = bg;
      }
      ctx.drawImage(this.bg, 0, 0);
      ctx.strokeStyle = css('--border'); ctx.lineWidth = dpr;
      ctx.beginPath(); ctx.arc(cx, cx, R, 0, Math.PI * 2); ctx.stroke();
      const a = this.v[0] * Math.PI / 180, d = this.v[1] / 100 * R;
      const px = cx + Math.cos(a) * d, py = cx - Math.sin(a) * d;
      ctx.beginPath(); ctx.arc(px, py, 6 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = '#fff'; ctx.fill();
      ctx.lineWidth = 2 * dpr; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.stroke();
    }
  }

  /* ---------- 直方圖（RGB 疊加） ---------- */
  function drawHistogram(canvas, h) {
    const dpr = fitCanvas(canvas), ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    if (!h) return;
    let max = 0;
    for (const k of ['r', 'g', 'b']) for (let i = 2; i < 254; i++) max = Math.max(max, h[k][i]);
    ctx.globalCompositeOperation = getComputedStyle(document.documentElement).colorScheme === 'dark' ? 'screen' : 'multiply';
    const cols = { r: 'rgba(229,72,77,.6)', g: 'rgba(47,158,68,.6)', b: 'rgba(47,111,209,.6)' };
    for (const k of ['r', 'g', 'b']) {
      ctx.fillStyle = cols[k];
      ctx.beginPath(); ctx.moveTo(0, H);
      for (let i = 0; i < 256; i++) ctx.lineTo(i / 255 * W, H - Math.min(1, h[k][i] / (max || 1)) * (H - 4 * dpr));
      ctx.lineTo(W, H); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  window.Widgets = { CurveEditor, Wheel, drawHistogram, CH_COLOR };
})();
