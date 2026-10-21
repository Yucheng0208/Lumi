/* 色彩引擎：把「輸入色彩 → 白平衡／曝光 → 濾鏡 → 手動調整」整合成一個函式，再烘焙成 3D LUT。
   預覽（WebGL）、縮圖、直方圖、影片輸出（ffmpeg lut3d）都使用同一份 LUT，確保結果一致。 */
(function () {
  'use strict';

  const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const mix = (a, b, t) => a + (b - a) * t;
  const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
  const s2l = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const l2s = (v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
  const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

  /* ---------- 曲線：單調三次樣條（Fritsch–Carlson），轉成查表 ---------- */

  const TABLE = 1024;
  function curveTable(points) {
    const pts = points.map((p) => [clamp(p[0]), clamp(p[1])]).sort((a, b) => a[0] - b[0]);
    const t = new Float32Array(TABLE);
    const n = pts.length;
    if (n < 2) { for (let i = 0; i < TABLE; i++) t[i] = i / (TABLE - 1); return t; }
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const d = [], m = new Array(n);
    for (let i = 0; i < n - 1; i++) d[i] = (ys[i + 1] - ys[i]) / Math.max(1e-6, xs[i + 1] - xs[i]);
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
      const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
      if (s > 9) { const k = 3 / Math.sqrt(s); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i]; }
    }
    let seg = 0;
    for (let k = 0; k < TABLE; k++) {
      const x = k / (TABLE - 1);
      let y;
      if (x <= xs[0]) y = ys[0];
      else if (x >= xs[n - 1]) y = ys[n - 1];
      else {
        while (seg < n - 2 && x > xs[seg + 1]) seg++;
        const h = xs[seg + 1] - xs[seg], u = (x - xs[seg]) / h, u2 = u * u, u3 = u2 * u;
        y = (2 * u3 - 3 * u2 + 1) * ys[seg] + (u3 - 2 * u2 + u) * h * m[seg]
          + (-2 * u3 + 3 * u2) * ys[seg + 1] + (u3 - u2) * h * m[seg + 1];
      }
      t[k] = clamp(y);
    }
    return t;
  }
  function lookup(t, x) {
    const f = clamp(x) * (TABLE - 1), i = f | 0;
    if (i >= TABLE - 1) return t[TABLE - 1];
    return t[i] + (t[i + 1] - t[i]) * (f - i);
  }
  const isIdentityCurve = (pts) => !pts || pts.length < 2 || pts.every((p) => Math.abs(p[0] - p[1]) < 1e-4);

  /** S 型對比：以 0.5 為中心，c ∈ [-1, 1] */
  function sCurve(x, c) {
    if (!c) return x;
    const e = c >= 0 ? 1 + 2 * c : 1 / (1 - 1.5 * c);
    x = clamp(x);
    return x < 0.5 ? 0.5 * Math.pow(2 * x, e) : 1 - 0.5 * Math.pow(2 - 2 * x, e);
  }

  /* ---------- HSL ---------- */

  function rgb2hsl(r, g, b) {
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
    if (max === min) return [0, 0, l];
    const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h;
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    return [h * 60, s, l];
  }
  function hue2(p, q, t) {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  }
  function hsl2rgb(h, s, l, out) {
    h = (((h % 360) + 360) % 360) / 360;
    if (s <= 0) { out[0] = out[1] = out[2] = l; return out; }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    out[0] = hue2(p, q, h + 1 / 3); out[1] = hue2(p, q, h); out[2] = hue2(p, q, h - 1 / 3);
    return out;
  }
  /** 色相 h 的純色減掉自身亮度，得到「不改亮度的色偏方向」 */
  function tintVector(h) {
    const c = hsl2rgb(h, 1, 0.5, [0, 0, 0]);
    const y = luma(c[0], c[1], c[2]);
    return [c[0] - y, c[1] - y, c[2] - y];
  }

  /* 八個顏色範圍（與 Lightroom 相同的分法） */
  const HSL_BANDS = [
    { key: 'red', name: '紅', hue: 0, color: '#e5484d' },
    { key: 'orange', name: '橙', hue: 30, color: '#f08c2e' },
    { key: 'yellow', name: '黃', hue: 60, color: '#f2cc2f' },
    { key: 'green', name: '綠', hue: 120, color: '#3fb950' },
    { key: 'aqua', name: '青', hue: 180, color: '#2ec4c9' },
    { key: 'blue', name: '藍', hue: 225, color: '#3b74e0' },
    { key: 'purple', name: '紫', hue: 270, color: '#8b5cf6' },
    { key: 'magenta', name: '洋紅', hue: 315, color: '#e04fb0' },
  ];

  /** 回傳 (h, s, l) → 調整後，不需要調整時回傳 null。hsl = { red:[色相°, 飽和, 明亮], ... } */
  function hslAdjuster(hsl) {
    if (!hsl) return null;
    const v = HSL_BANDS.map((b) => hsl[b.key] || [0, 0, 0]);
    if (v.every((a) => !a[0] && !a[1] && !a[2])) return null;
    const centers = HSL_BANDS.map((b) => b.hue);
    const n = centers.length;
    return function (h, s, l, out) {
      // 找出左右相鄰的兩個中心，線性分配權重（總和為 1）
      let i = n - 1;
      for (let k = 0; k < n; k++) if (h >= centers[k]) i = k;
      const j = (i + 1) % n;
      const a = centers[i], b = j === 0 ? 360 : centers[j];
      const hh = h < a ? h + 360 : h;
      const t = clamp((hh - a) / (b - a));
      const wi = 1 - t, wj = t;
      const dh = v[i][0] * wi + v[j][0] * wj;
      const ds = v[i][1] * wi + v[j][1] * wj;
      const dl = v[i][2] * wi + v[j][2] * wj;
      out[0] = h + dh * s;                 // 灰色不受色相影響
      out[1] = clamp(s * (1 + ds));
      out[2] = clamp(l + dl * 0.3 * Math.min(1, s * 1.5) * (1 - Math.abs(2 * l - 1) * 0.5));
      return out;
    };
  }

  /* ---------- 色域矩陣：由原色座標計算到 Rec.709 的轉換 ---------- */

  function rgbToXyz(p, w = [0.3127, 0.329]) {
    const XYZ = ([x, y]) => [x / y, 1, (1 - x - y) / y];
    const [R, G, B] = p.map(XYZ), W = XYZ(w);
    const M = [[R[0], G[0], B[0]], [R[1], G[1], B[1]], [R[2], G[2], B[2]]];
    const S = mulv(inv3(M), W);
    return M.map((row) => row.map((v, i) => v * S[i]));
  }
  function inv3(m) {
    const [a, b, c] = m[0], [d, e, f] = m[1], [g, h, i] = m[2];
    const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
    const det = a * A + b * B + c * C;
    return [
      [A / det, -(b * i - c * h) / det, (b * f - c * e) / det],
      [B / det, (a * i - c * g) / det, -(a * f - c * d) / det],
      [C / det, -(a * h - b * g) / det, (a * e - b * d) / det],
    ];
  }
  const mulv = (m, v) => m.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
  const mul3 = (a, b) => a.map((r) => [0, 1, 2].map((j) => r[0] * b[0][j] + r[1] * b[1][j] + r[2] * b[2][j]));
  const P709 = [[0.64, 0.33], [0.30, 0.60], [0.15, 0.06]];
  const to709 = (prim) => mul3(inv3(rgbToXyz(P709)), rgbToXyz(prim));

  const GAMUT = {
    rec2020: [[0.708, 0.292], [0.170, 0.797], [0.131, 0.046]],
    sgamut3cine: [[0.766, 0.275], [0.225, 0.800], [0.089, -0.087]],
    sgamut3: [[0.730, 0.280], [0.140, 0.855], [0.100, -0.050]],
    vgamut: [[0.730, 0.280], [0.165, 0.840], [0.100, -0.030]],
    cinemagamut: [[0.740, 0.270], [0.170, 1.140], [0.080, -0.100]],
    awg3: [[0.6840, 0.3130], [0.2210, 0.8480], [0.0861, -0.1020]],
    awg4: [[0.7347, 0.2653], [0.1424, 0.8576], [0.0991, -0.0308]],
    dgamut: [[0.71, 0.31], [0.21, 0.88], [0.09, -0.08]],
  };

  /* ---------- 相機 Log 曲線（依各廠公開規格） ---------- */
  // 瀏覽器把影片的 legal range（64–940）解成 0–1；多數 Log 公式以「碼值/1023」定義，先換回去
  const cv = (v) => (v * 876 + 64) / 1023;
  const logA = (a, b, c, d, e, f, cut) => (v) => { v = cv(v); return v >= cut ? (Math.pow(10, (v - d) / c) - b) / a : (v - f) / e; };

  const LOGC4 = (() => {
    const a = (Math.pow(2, 18) - 16) / 117.45, b = (1023 - 95) / 1023, c = 95 / 1023;
    const s = (7 * Math.LN2 * Math.pow(2, 7 - 14 * c / b)) / (a * b), t = (Math.pow(2, 14 * (-c / b) + 6) - 64) / a;
    return (v) => { v = cv(v); return v >= 0 ? (Math.pow(2, 14 * (v - c) / b + 6) - 64) / a : v * s + t; };
  })();

  const PROFILES = [
    { id: 'none', name: '一般影像（sRGB／Rec.709）' },
    { id: 'slog3', name: 'Sony S-Log3 · S-Gamut3.Cine', gamut: 'sgamut3cine',
      decode: (v) => { const c = cv(v) * 1023; return c >= 171.2102946929 ? Math.pow(10, (c - 420) / 261.5) * 0.19 - 0.01 : (c - 95) * 0.01125 / (171.2102946929 - 95); } },
    { id: 'slog3sg3', name: 'Sony S-Log3 · S-Gamut3', gamut: 'sgamut3',
      decode: (v) => { const c = cv(v) * 1023; return c >= 171.2102946929 ? Math.pow(10, (c - 420) / 261.5) * 0.19 - 0.01 : (c - 95) * 0.01125 / (171.2102946929 - 95); } },
    { id: 'flog', name: 'FUJIFILM F-Log · F-Gamut', gamut: 'rec2020', decode: logA(0.555556, 0.009468, 0.344676, 0.790453, 8.735631, 0.092864, 0.100537775223865) },
    { id: 'flog2', name: 'FUJIFILM F-Log2 · F-Gamut', gamut: 'rec2020', decode: logA(5.555556, 0.064829, 0.245281, 0.384316, 8.799461, 0.092864, 0.100686685370811) },
    { id: 'clog3', name: 'Canon Log 3 · Cinema Gamut', gamut: 'cinemagamut',
      decode: (x) => 0.9 * (x < 0.097465473 ? -(Math.pow(10, (0.12783901 - x) / 0.36726845) - 1) / 14.98325
        : x <= 0.15277891 ? (x - 0.12512219) / 1.9754798 : (Math.pow(10, (x - 0.12240537) / 0.36726845) - 1) / 14.98325) },
    { id: 'clog3709', name: 'Canon Log 3 · BT.709 色域', gamut: null,
      decode: (x) => 0.9 * (x < 0.097465473 ? -(Math.pow(10, (0.12783901 - x) / 0.36726845) - 1) / 14.98325
        : x <= 0.15277891 ? (x - 0.12512219) / 1.9754798 : (Math.pow(10, (x - 0.12240537) / 0.36726845) - 1) / 14.98325) },
    { id: 'nlog', name: 'Nikon N-Log · BT.2020', gamut: 'rec2020',
      decode: (v) => { const c = cv(v) * 1023; return c < 452 ? Math.pow(c / 650, 3) - 0.0075 : Math.exp((c - 619) / 150); } },
    { id: 'vlog', name: 'Panasonic V-Log · V-Gamut', gamut: 'vgamut',
      decode: (v) => { v = cv(v); return v < 0.181 ? (v - 0.125) / 5.6 : Math.pow(10, (v - 0.598206) / 0.241514) - 0.00873; } },
    { id: 'logc3', name: 'ARRI LogC3 (EI 800) · AWG3', gamut: 'awg3', decode: logA(5.555556, 0.052272, 0.247190, 0.385537, 5.367655, 0.092809, 0.010591 * 5.367655 + 0.092809) },
    { id: 'logc4', name: 'ARRI LogC4 · AWG4', gamut: 'awg4', decode: LOGC4 },
    { id: 'applelog', name: 'Apple Log · BT.2020', gamut: 'rec2020',
      decode: (p) => { const R0 = -0.05641088, Rt = 0.01, c = 47.28711236, b = 0.00964052, g = 0.08550479, be = 0.69336945;
        const Pt = c * (Rt - R0) * (Rt - R0);
        return p >= Pt ? Math.pow(2, (p - be) / g) - b : p >= 0 ? Math.sqrt(p / c) + R0 : R0; } },
    { id: 'dlog', name: 'DJI D-Log · D-Gamut', gamut: 'dgamut',
      decode: (x) => (x <= 0.14 ? (x - 0.0929) / 6.025 : (Math.pow(10, 3.89616 * x - 2.27752) - 0.0108) / 0.9892) },
    { id: 'hlg', name: 'HLG · BT.2020（平面解碼）', gamut: 'rec2020', gain: 3.2,
      decode: (e) => { const a = 0.17883277, b = 0.28466892, c = 0.55991073; return e <= 0.5 ? e * e / 3 : (Math.exp((e - c) / a) + b) / 12; } },
  ];
  for (const p of PROFILES) if (p.gamut) p.M = to709(GAMUT[p.gamut]);

  /** 場景線性 → 顯示（ACES 近似色調映射＋sRGB） */
  const filmic = (x) => { x = Math.max(0, x) * 0.72; return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14)); };

  /* ---------- 濾鏡（風格參數 → 函式） ---------- */

  /**
   * 風格參數（全部可省略）：
   *  mat 3×3 線性混色、wb [色溫, 色調]、mono [r,g,b] 黑白權重、con 對比、sat 飽和、vib 自然飽和、
   *  curve / r / g / b 曲線點、hsl 各色、sh / mid / hi [色相, 強度] 分離色調、fade 褪色、roll 亮部上限、
   *  tone [色相, 強度] 黑白染色（依亮度漸變）、gamma 中間調
   */
  function compileLook(p) {
    if (!p) return null;
    const cRgb = p.curve && !isIdentityCurve(p.curve) ? curveTable(p.curve) : null;
    const cR = p.r ? curveTable(p.r) : null, cG = p.g ? curveTable(p.g) : null, cB = p.b ? curveTable(p.b) : null;
    const hslFn = hslAdjuster(p.hsl);
    const sh = p.sh ? tintVector(p.sh[0]).map((v) => v * p.sh[1]) : null;
    const md = p.mid ? tintVector(p.mid[0]).map((v) => v * p.mid[1]) : null;
    const hi = p.hi ? tintVector(p.hi[0]).map((v) => v * p.hi[1]) : null;
    const tone = p.tone ? tintVector(p.tone[0]).map((v) => v * p.tone[1]) : null;
    let wb = null;
    if (p.wb) wb = wbMul(p.wb[0], p.wb[1]);
    const sat = p.sat == null ? 1 : p.sat, vib = p.vib || 0, con = p.con || 0;
    const fade = p.fade || 0, roll = p.roll == null ? 1 : p.roll, gam = p.gamma || 1;
    const tmp = [0, 0, 0];
    return function (c) {
      let r = c[0], g = c[1], b = c[2];
      if (p.mat || wb) {
        r = s2l(r); g = s2l(g); b = s2l(b);
        if (p.mat) { const m = p.mat; const R = m[0][0] * r + m[0][1] * g + m[0][2] * b, G = m[1][0] * r + m[1][1] * g + m[1][2] * b, B = m[2][0] * r + m[2][1] * g + m[2][2] * b; r = R; g = G; b = B; }
        if (wb) { r *= wb[0]; g *= wb[1]; b *= wb[2]; }
        r = l2s(clamp(r)); g = l2s(clamp(g)); b = l2s(clamp(b));
      }
      if (p.mono) {
        const w = p.mono, y = l2s(clamp(w[0] * s2l(r) + w[1] * s2l(g) + w[2] * s2l(b)));
        r = g = b = y;
      }
      if (gam !== 1) { r = Math.pow(clamp(r), gam); g = Math.pow(clamp(g), gam); b = Math.pow(clamp(b), gam); }
      if (hslFn) {
        const h = rgb2hsl(clamp(r), clamp(g), clamp(b));
        hslFn(h[0], h[1], h[2], tmp); hsl2rgb(tmp[0], tmp[1], tmp[2], tmp);
        r = tmp[0]; g = tmp[1]; b = tmp[2];
      }
      if (sat !== 1 || vib) {
        const y = luma(r, g, b);
        let k = sat;
        if (vib) { const s = Math.max(r, g, b) - Math.min(r, g, b); k *= 1 + vib * (1 - s) * (1 - s); }
        r = y + (r - y) * k; g = y + (g - y) * k; b = y + (b - y) * k;
      }
      if (con) { r = sCurve(r, con); g = sCurve(g, con); b = sCurve(b, con); }
      if (cRgb) { r = lookup(cRgb, r); g = lookup(cRgb, g); b = lookup(cRgb, b); }
      if (cR) r = lookup(cR, r);
      if (cG) g = lookup(cG, g);
      if (cB) b = lookup(cB, b);
      if (sh || md || hi || tone) {
        const y = clamp(luma(r, g, b));
        const ws = 1 - smooth(0, 0.55, y), wh = smooth(0.45, 1, y), wm = Math.max(0, 1 - ws - wh);
        const add = (v, w) => { r += v[0] * w; g += v[1] * w; b += v[2] * w; };
        if (sh) add(sh, ws * 0.5);
        if (md) add(md, wm * 0.5);
        if (hi) add(hi, wh * 0.5);
        if (tone) add(tone, 0.5 * (1 - Math.abs(2 * y - 1) * 0.6));
      }
      if (fade || roll !== 1) {
        r = fade + clamp(r) * (roll - fade); g = fade + clamp(g) * (roll - fade); b = fade + clamp(b) * (roll - fade);
      }
      c[0] = clamp(r); c[1] = clamp(g); c[2] = clamp(b);
      return c;
    };
  }

  /** 白平衡倍率（線性），保持亮度不變 */
  function wbMul(temp, tint) {
    const t = temp / 100, n = tint / 100;
    let r = Math.exp(0.32 * t), g = Math.exp(-0.22 * n), b = Math.exp(-0.32 * t);
    const y = luma(r, g, b);
    return [r / y, g / y, b / y];
  }

  /* ---------- 自訂 LUT（.cube / .3dl / HaldCLUT）---------- */

  function parseCube(text) {
    let size = 0, size1 = 0, dmin = [0, 0, 0], dmax = [1, 1, 1], title = '';
    const vals = [];
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line[0] === '#') continue;
      const c = line.charCodeAt(0);
      if ((c >= 48 && c <= 57) || c === 45 || c === 46 || c === 43) {
        const p = line.split(/\s+/);
        if (p.length >= 3) vals.push(+p[0], +p[1], +p[2]);
        continue;
      }
      const [k, ...rest] = line.split(/\s+/);
      const K = k.toUpperCase();
      if (K === 'TITLE') title = rest.join(' ').replace(/^"|"$/g, '');
      else if (K === 'LUT_3D_SIZE') size = +rest[0];
      else if (K === 'LUT_1D_SIZE') size1 = +rest[0];
      else if (K === 'DOMAIN_MIN') dmin = rest.slice(0, 3).map(Number);
      else if (K === 'DOMAIN_MAX') dmax = rest.slice(0, 3).map(Number);
      else if (K === 'LUT_3D_INPUT_RANGE' || K === 'LUT_1D_INPUT_RANGE') { dmin = [+rest[0], +rest[0], +rest[0]]; dmax = [+rest[1], +rest[1], +rest[1]]; }
    }
    if (size) {
      if (vals.length < size * size * size * 3) throw new Error('LUT 資料不完整');
      return { kind: '3d', size, data: new Float32Array(vals.slice(0, size * size * size * 3)), dmin, dmax, title };
    }
    if (size1) {
      if (vals.length < size1 * 3) throw new Error('LUT 資料不完整');
      return { kind: '1d', size: size1, data: new Float32Array(vals.slice(0, size1 * 3)), dmin, dmax, title };
    }
    throw new Error('找不到 LUT_3D_SIZE');
  }

  /** Autodesk / Lustre .3dl：整數，藍色變化最快 */
  function parse3dl(text) {
    const rows = [];
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line[0] === '#' || /^[a-z]/i.test(line)) continue;
      const p = line.split(/\s+/).map(Number);
      if (p.length === 3 && p.every(isFinite)) rows.push(p);
    }
    const size = Math.round(Math.cbrt(rows.length));
    if (size < 2 || size * size * size !== rows.length) throw new Error('無法辨識 .3dl 尺寸');
    let max = 0;
    for (const r of rows) max = Math.max(max, r[0], r[1], r[2]);
    const scale = max <= 1 ? 1 : Math.pow(2, Math.ceil(Math.log2(max + 1))) - 1;
    const data = new Float32Array(rows.length * 3);
    let i = 0;
    for (let r = 0; r < size; r++) for (let g = 0; g < size; g++) for (let b = 0; b < size; b++, i++) {
      const o = (r + g * size + b * size * size) * 3;
      data[o] = rows[i][0] / scale; data[o + 1] = rows[i][1] / scale; data[o + 2] = rows[i][2] / scale;
    }
    return { kind: '3d', size, data, dmin: [0, 0, 0], dmax: [1, 1, 1], title: '' };
  }

  /** HaldCLUT 圖片：level L → 圖片邊長 L³、LUT 尺寸 L² */
  function parseHald(imageData) {
    const { width, height, data } = imageData;
    const L = Math.round(Math.cbrt(width));
    if (width !== height || L * L * L !== width) throw new Error('不是 HaldCLUT 圖片（需為 L³×L³ 正方形）');
    const size = L * L, n = size * size * size;
    const out = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { out[i * 3] = data[i * 4] / 255; out[i * 3 + 1] = data[i * 4 + 1] / 255; out[i * 3 + 2] = data[i * 4 + 2] / 255; }
    return { kind: '3d', size, data: out, dmin: [0, 0, 0], dmax: [1, 1, 1], title: '' };
  }

  /** 對 LUT 三線性取樣，c 為 [r,g,b]（會被改寫） */
  function sampleLut(lut, c) {
    const { size: N, data: d, dmin, dmax } = lut;
    if (lut.kind === '1d') {
      for (let k = 0; k < 3; k++) {
        const x = clamp((c[k] - dmin[k]) / (dmax[k] - dmin[k])) * (N - 1), i = Math.min(N - 2, x | 0), f = x - i;
        c[k] = d[i * 3 + k] * (1 - f) + d[(i + 1) * 3 + k] * f;
      }
      return c;
    }
    const fx = clamp((c[0] - dmin[0]) / (dmax[0] - dmin[0])) * (N - 1);
    const fy = clamp((c[1] - dmin[1]) / (dmax[1] - dmin[1])) * (N - 1);
    const fz = clamp((c[2] - dmin[2]) / (dmax[2] - dmin[2])) * (N - 1);
    const x0 = Math.min(N - 2, fx | 0), y0 = Math.min(N - 2, fy | 0), z0 = Math.min(N - 2, fz | 0);
    const tx = fx - x0, ty = fy - y0, tz = fz - z0;
    const N2 = N * N;
    for (let k = 0; k < 3; k++) {
      const at = (x, y, z) => d[(x + y * N + z * N2) * 3 + k];
      const c00 = mix(at(x0, y0, z0), at(x0 + 1, y0, z0), tx), c10 = mix(at(x0, y0 + 1, z0), at(x0 + 1, y0 + 1, z0), tx);
      const c01 = mix(at(x0, y0, z0 + 1), at(x0 + 1, y0, z0 + 1), tx), c11 = mix(at(x0, y0 + 1, z0 + 1), at(x0 + 1, y0 + 1, z0 + 1), tx);
      c[k] = mix(mix(c00, c10, ty), mix(c01, c11, ty), tz);
    }
    return c;
  }

  /* ---------- 調整參數 ---------- */

  const DEFAULT_CURVE = () => [[0, 0], [1, 1]];
  function defaultGrade() {
    return {
      input: 'none', look: 'none', lutAmount: 100,
      temp: 0, tint: 0, exposure: 0, contrast: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0,
      vibrance: 0, saturation: 0,
      curves: { rgb: DEFAULT_CURVE(), r: DEFAULT_CURVE(), g: DEFAULT_CURVE(), b: DEFAULT_CURVE() },
      hsl: Object.fromEntries(HSL_BANDS.map((b) => [b.key, [0, 0, 0]])),
      wheels: { sh: [220, 0], mid: [40, 0], hi: [45, 0], balance: 0 },
      fade: 0, vignette: 0, vigMid: 50, vigFeather: 50, grain: 0, grainSize: 25, sharpen: 0,
    };
  }

  /** 亮部／陰影／白色／黑色／對比 → 查表 */
  function toneTable(g) {
    const H = g.highlights / 100, S = g.shadows / 100, W = g.whites / 100, B = g.blacks / 100, C = g.contrast / 100;
    if (!H && !S && !W && !B && !C) return null;
    const t = new Float32Array(TABLE);
    for (let i = 0; i < TABLE; i++) {
      let x = i / (TABLE - 1);
      x += B * 0.18 * Math.pow(1 - x, 4);
      x += W * 0.22 * Math.pow(x, 4);
      x += S * 0.42 * 4 * x * Math.pow(1 - x, 3) * 1.6;
      x += H * 0.42 * 4 * Math.pow(x, 3) * (1 - x) * 1.6;
      x = sCurve(clamp(x), C * 0.75);
      t[i] = clamp(x);
    }
    return t;
  }

  /**
   * 把整組設定編譯成單一函式 f([r,g,b]) → [r,g,b]（輸入為檔案中的 0–1 數值）。
   * ctx.look(id) 取得濾鏡函式（內建或自訂 LUT）
   */
  function compile(g, ctx) {
    const prof = PROFILES.find((p) => p.id === g.input) || PROFILES[0];
    const [wr, wg, wb] = wbMul(g.temp, g.tint);
    const ex = Math.pow(2, g.exposure) * (prof.gain || 1);
    const needLinear = prof.decode || g.temp || g.tint || g.exposure;
    const look = g.look && g.look !== 'none' ? ctx.look(g.look) : null;
    const k = clamp(g.lutAmount / 100);
    const tone = toneTable(g);
    const c = g.curves || {};
    const cRgb = isIdentityCurve(c.rgb) ? null : curveTable(c.rgb);
    const cR = isIdentityCurve(c.r) ? null : curveTable(c.r);
    const cG = isIdentityCurve(c.g) ? null : curveTable(c.g);
    const cB = isIdentityCurve(c.b) ? null : curveTable(c.b);
    const hslFn = hslAdjuster(g.hsl);
    const sat = 1 + g.saturation / 100, vib = g.vibrance / 100;
    const W = g.wheels || {};
    const wv = (w) => (w && w[1] ? tintVector(w[0]).map((v) => v * w[1] / 100 * 0.35) : null);
    const wSh = wv(W.sh), wMid = wv(W.mid), wHi = wv(W.hi);
    const pivot = 0.5 + (W.balance || 0) / 100 * 0.3;
    const fade = (g.fade || 0) / 100 * 0.16;
    const tmp = [0, 0, 0], L = [0, 0, 0];

    return function (px) {
      let r = px[0], gg = px[1], b = px[2];
      if (needLinear) {
        if (prof.decode) {
          r = prof.decode(r); gg = prof.decode(gg); b = prof.decode(b);
          if (prof.M) { const m = prof.M; const R = m[0][0] * r + m[0][1] * gg + m[0][2] * b, G = m[1][0] * r + m[1][1] * gg + m[1][2] * b, B = m[2][0] * r + m[2][1] * gg + m[2][2] * b; r = R; gg = G; b = B; }
        } else { r = s2l(r); gg = s2l(gg); b = s2l(b); }
        r *= wr * ex; gg *= wg * ex; b *= wb * ex;
        if (prof.decode) { r = l2s(filmic(r)); gg = l2s(filmic(gg)); b = l2s(filmic(b)); }
        else { r = l2s(clamp(r)); gg = l2s(clamp(gg)); b = l2s(clamp(b)); }
      }
      if (look && k > 0) {
        L[0] = clamp(r); L[1] = clamp(gg); L[2] = clamp(b);
        look(L);
        r = mix(r, L[0], k); gg = mix(gg, L[1], k); b = mix(b, L[2], k);
      }
      if (tone) { r = lookup(tone, r); gg = lookup(tone, gg); b = lookup(tone, b); }
      if (cRgb) { r = lookup(cRgb, r); gg = lookup(cRgb, gg); b = lookup(cRgb, b); }
      if (cR) r = lookup(cR, r);
      if (cG) gg = lookup(cG, gg);
      if (cB) b = lookup(cB, b);
      if (hslFn) {
        const h = rgb2hsl(clamp(r), clamp(gg), clamp(b));
        hslFn(h[0], h[1], h[2], tmp); hsl2rgb(tmp[0], tmp[1], tmp[2], tmp);
        r = tmp[0]; gg = tmp[1]; b = tmp[2];
      }
      if (sat !== 1 || vib) {
        const y = luma(r, gg, b);
        let kk = sat;
        if (vib) { const s = clamp(Math.max(r, gg, b) - Math.min(r, gg, b)); kk *= Math.max(0, 1 + vib * (1 - s) * (1 - s) * 1.2); }
        r = y + (r - y) * kk; gg = y + (gg - y) * kk; b = y + (b - y) * kk;
      }
      if (wSh || wMid || wHi) {
        const y = clamp(luma(r, gg, b));
        const ws = 1 - smooth(0, pivot, y), wh = smooth(pivot, 1, y), wm = Math.max(0, 1 - ws - wh);
        if (wSh) { r += wSh[0] * ws; gg += wSh[1] * ws; b += wSh[2] * ws; }
        if (wMid) { r += wMid[0] * wm; gg += wMid[1] * wm; b += wMid[2] * wm; }
        if (wHi) { r += wHi[0] * wh; gg += wHi[1] * wh; b += wHi[2] * wh; }
      }
      if (fade) { r = fade + clamp(r) * (1 - fade * 0.4); gg = fade + clamp(gg) * (1 - fade * 0.4); b = fade + clamp(b) * (1 - fade * 0.4); }
      px[0] = clamp(r); px[1] = clamp(gg); px[2] = clamp(b);
      return px;
    };
  }

  /** 烘焙成 N³ 的 LUT（r 變化最快），RGBA Float32 方便直接上傳 WebGL */
  function bake(fn, N) {
    const out = new Float32Array(N * N * N * 4);
    const c = [0, 0, 0];
    let o = 0;
    for (let b = 0; b < N; b++) for (let g = 0; g < N; g++) for (let r = 0; r < N; r++) {
      c[0] = r / (N - 1); c[1] = g / (N - 1); c[2] = b / (N - 1);
      fn(c);
      out[o] = c[0]; out[o + 1] = c[1]; out[o + 2] = c[2]; out[o + 3] = 1;
      o += 4;
    }
    return out;
  }

  /** 把 RGBA 的烘焙結果包成可取樣的 LUT 物件 */
  function bakedLut(rgba, N) {
    const data = new Float32Array(N * N * N * 3);
    for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) { data[j] = rgba[i]; data[j + 1] = rgba[i + 1]; data[j + 2] = rgba[i + 2]; }
    return { kind: '3d', size: N, data, dmin: [0, 0, 0], dmax: [1, 1, 1] };
  }

  function toCube(rgba, N, title) {
    const lines = [`TITLE "${(title || 'Lumi').replace(/"/g, '')}"`, '# Created with 光色 Lumi — https://lumi.yucheng208.net', `LUT_3D_SIZE ${N}`, 'DOMAIN_MIN 0.0 0.0 0.0', 'DOMAIN_MAX 1.0 1.0 1.0'];
    for (let i = 0; i < rgba.length; i += 4) lines.push(`${rgba[i].toFixed(6)} ${rgba[i + 1].toFixed(6)} ${rgba[i + 2].toFixed(6)}`);
    return lines.join('\n') + '\n';
  }

  /** 是否與預設相同（用來顯示「已調整」標記） */
  function isDefault(g, keys) {
    const d = defaultGrade();
    return keys.every((k) => JSON.stringify(g[k]) === JSON.stringify(d[k]));
  }

  window.Color = {
    clamp, s2l, l2s, luma, curveTable, lookup, compileLook, compile, bake, bakedLut, toCube, sampleLut,
    parseCube, parse3dl, parseHald, defaultGrade, isDefault, PROFILES, HSL_BANDS, hsl2rgb, rgb2hsl, tintVector,
  };
})();
