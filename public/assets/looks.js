/* 內建濾鏡：以參數描述的風格（相機色彩模式、底片、電影感、黑白）。
   全部是依公開樣張與常見描述調出的「近似風格」，不是各廠原廠 LUT。參數說明見 color.js 的 compileLook。 */
(function () {
  'use strict';

  // 常用曲線
  const S_SOFT = [[0, 0], [0.25, 0.22], [0.75, 0.78], [1, 1]];
  const S_MED = [[0, 0], [0.25, 0.2], [0.75, 0.8], [1, 1]];
  const S_HARD = [[0, 0], [0.25, 0.17], [0.75, 0.84], [1, 1]];
  const FLAT = [[0, 0.04], [0.25, 0.27], [0.75, 0.73], [1, 0.96]];
  const MATTE = [[0, 0.07], [0.2, 0.2], [0.75, 0.77], [1, 0.95]];
  const BW = { lum: [0.2126, 0.7152, 0.0722], red: [0.55, 0.38, 0.07], orange: [0.45, 0.45, 0.1], yellow: [0.38, 0.55, 0.07], green: [0.18, 0.72, 0.1], blue: [0.12, 0.38, 0.5] };

  const GROUPS = [
    { id: 'camera', name: '相機' },
    { id: 'film', name: '底片' },
    { id: 'cine', name: '電影感' },
    { id: 'mono', name: '黑白' },
    { id: 'creative', name: '創意' },
  ];

  const LOOKS = [];
  const add = (group, brand, id, name, p) => LOOKS.push({ id, group, brand, name, p });

  /* ---------- FUJIFILM 底片模擬 ---------- */
  const F = 'FUJIFILM';
  add('camera', F, 'fuji-provia', 'PROVIA／標準', { con: 0.1, sat: 1.06, hsl: { red: [0, 0.04, 0], blue: [-3, 0.05, 0] } });
  add('camera', F, 'fuji-velvia', 'Velvia／鮮豔', { con: 0.28, sat: 1.32, curve: S_MED, hsl: { red: [2, 0.12, -0.04], green: [-5, 0.18, -0.06], blue: [-6, 0.22, -0.12], aqua: [0, 0.15, -0.05] }, sh: [280, 0.04] });
  add('camera', F, 'fuji-astia', 'ASTIA／柔和', { con: -0.04, sat: 1.1, roll: 0.98, hsl: { orange: [0, -0.05, 0.06], red: [0, 0.03, 0.02], blue: [-4, 0.12, 0], green: [0, 0.06, 0.02] } });
  add('camera', F, 'fuji-cc', 'Classic Chrome', { sat: 0.78, con: 0.14, curve: [[0, 0.02], [0.22, 0.16], [0.6, 0.62], [1, 0.97]], hsl: { red: [-4, -0.15, -0.03], orange: [-3, -0.1, 0], yellow: [-8, -0.35, -0.04], green: [12, -0.38, -0.06], aqua: [-6, -0.25, -0.04], blue: [-8, -0.12, -0.14] }, sh: [195, 0.08], hi: [45, 0.05] });
  add('camera', F, 'fuji-ccneg', 'Classic Neg.', { sat: 0.86, con: 0.24, curve: [[0, 0.03], [0.25, 0.16], [0.7, 0.75], [1, 0.97]], hsl: { red: [-6, -0.04, -0.03], orange: [-4, -0.06, 0], yellow: [-12, -0.22, 0], green: [18, -0.18, -0.06], blue: [-6, -0.06, -0.08] }, sh: [185, 0.12], hi: [40, 0.08], g: [[0, 0], [0.5, 0.505], [1, 0.99]] });
  add('camera', F, 'fuji-nostalgic', 'Nostalgic Neg.', { sat: 0.92, con: 0.04, roll: 0.96, fade: 0.03, hi: [38, 0.16], sh: [20, 0.04], hsl: { green: [8, -0.15, 0], yellow: [-4, 0.05, 0], blue: [-4, -0.1, 0] } });
  add('camera', F, 'fuji-realaace', 'REALA ACE', { con: 0.12, sat: 1.06, hsl: { green: [-2, 0.04, 0], orange: [0, 0, 0.02] }, curve: S_SOFT });
  add('camera', F, 'fuji-pronegstd', 'PRO Neg. Std', { con: -0.12, sat: 0.9, hsl: { orange: [0, -0.04, 0.04], red: [0, -0.04, 0] }, roll: 0.98 });
  add('camera', F, 'fuji-pronehi', 'PRO Neg. Hi', { con: 0.16, sat: 0.96, hsl: { orange: [0, -0.02, 0.03] } });
  add('camera', F, 'fuji-eterna', 'ETERNA／電影', { con: -0.32, sat: 0.7, fade: 0.04, roll: 0.96, sh: [190, 0.06], hsl: { green: [10, -0.2, 0], orange: [0, -0.05, 0] } });
  add('camera', F, 'fuji-bleach', 'ETERNA 漂白', { con: 0.48, sat: 0.42, curve: S_HARD, fade: 0.015, sh: [200, 0.04] });
  add('camera', F, 'fuji-acros', 'ACROS', { mono: BW.lum, con: 0.22, curve: [[0, 0.01], [0.25, 0.19], [0.7, 0.76], [1, 1]] });
  add('camera', F, 'fuji-acros-r', 'ACROS＋R 濾鏡', { mono: BW.red, con: 0.26, curve: [[0, 0.01], [0.25, 0.19], [0.7, 0.76], [1, 1]] });
  add('camera', F, 'fuji-acros-g', 'ACROS＋G 濾鏡', { mono: BW.green, con: 0.2 });
  add('camera', F, 'fuji-sepia', '棕褐色', { mono: BW.lum, con: 0.06, tone: [35, 0.28], fade: 0.02 });

  /* ---------- Canon Picture Style ---------- */
  const C = 'Canon';
  add('camera', C, 'canon-std', '標準', { con: 0.14, sat: 1.12, hsl: { red: [0, 0.08, 0], orange: [2, 0.03, 0.02] } });
  add('camera', C, 'canon-portrait', '人像', { con: 0.02, sat: 1.02, roll: 0.98, hsl: { orange: [3, -0.04, 0.07], red: [2, -0.02, 0.03] } });
  add('camera', C, 'canon-landscape', '風景', { con: 0.2, sat: 1.22, hsl: { green: [-4, 0.22, -0.02], blue: [-2, 0.25, -0.06], aqua: [0, 0.2, 0] } });
  add('camera', C, 'canon-neutral', '中性', { con: -0.2, sat: 0.86 });
  add('camera', C, 'canon-faithful', '忠實', { con: -0.1, sat: 0.92, wb: [-2, 0] });

  /* ---------- Nikon Picture Control ---------- */
  const N = 'Nikon';
  add('camera', N, 'nikon-std', '標準', { con: 0.12, sat: 1.08 });
  add('camera', N, 'nikon-vivid', '鮮艷', { con: 0.24, sat: 1.3, hsl: { red: [0, 0.1, -0.03], blue: [-3, 0.15, -0.05] } });
  add('camera', N, 'nikon-portrait', '人像', { con: 0, sat: 1.0, hsl: { orange: [2, -0.06, 0.06] }, roll: 0.98 });
  add('camera', N, 'nikon-landscape', '風景', { con: 0.18, sat: 1.18, hsl: { green: [-2, 0.18, 0], blue: [-4, 0.2, -0.04] } });
  add('camera', N, 'nikon-flat', '平淡', { con: -0.45, sat: 0.8, curve: FLAT });
  add('camera', N, 'nikon-dream', 'Dream', { con: -0.15, sat: 0.9, fade: 0.05, hi: [330, 0.1], sh: [260, 0.06], roll: 0.97 });
  add('camera', N, 'nikon-morning', 'Morning', { con: -0.05, sat: 0.92, hi: [50, 0.14], sh: [210, 0.06], fade: 0.03 });
  add('camera', N, 'nikon-pop', 'Pop', { con: 0.25, sat: 1.4, vib: 0.2 });
  add('camera', N, 'nikon-somber', 'Somber', { con: 0.12, sat: 0.62, sh: [210, 0.08], gamma: 1.08 });
  add('camera', N, 'nikon-denim', 'Denim', { mono: BW.lum, con: 0.12, tone: [215, 0.32], fade: 0.03 });
  add('camera', N, 'nikon-charcoal', 'Charcoal', { mono: BW.lum, con: 0.3, gamma: 1.15, curve: S_HARD });

  /* ---------- Sony Creative Look ---------- */
  const S = 'Sony';
  add('camera', S, 'sony-st', 'ST 標準', { con: 0.1, sat: 1.05 });
  add('camera', S, 'sony-pt', 'PT 人像', { con: -0.04, sat: 0.95, hsl: { orange: [2, -0.05, 0.06] }, roll: 0.98 });
  add('camera', S, 'sony-nt', 'NT 自然', { con: -0.08, sat: 0.84 });
  add('camera', S, 'sony-vv', 'VV 鮮豔', { con: 0.22, sat: 1.3 });
  add('camera', S, 'sony-vv2', 'VV2 亮麗', { con: 0.14, sat: 1.35, gamma: 0.94, vib: 0.15 });
  add('camera', S, 'sony-fl', 'FL 電影', { con: 0.2, sat: 0.82, sh: [195, 0.1], hi: [45, 0.06], fade: 0.02 });
  add('camera', S, 'sony-in', 'IN 柔霧', { con: -0.2, sat: 0.7, fade: 0.06, roll: 0.95 });
  add('camera', S, 'sony-sh', 'SH 清亮', { con: -0.06, sat: 0.95, gamma: 0.88, hi: [200, 0.04], roll: 0.99 });
  add('camera', S, 'sony-bw', 'BW 黑白', { mono: BW.lum, con: 0.12 });
  add('camera', S, 'sony-se', 'SE 棕褐', { mono: BW.lum, tone: [32, 0.3], con: 0.05 });

  /* ---------- Leica Looks ---------- */
  const LC = 'Leica';
  add('camera', LC, 'leica-std', 'Standard', { con: 0.12, sat: 1.02, hsl: { red: [2, 0.06, -0.02], blue: [-4, 0.04, -0.04] }, sh: [220, 0.02] });
  add('camera', LC, 'leica-vivid', 'Vivid', { con: 0.22, sat: 1.22, hsl: { red: [2, 0.1, -0.03] } });
  add('camera', LC, 'leica-natural', 'Natural', { con: -0.04, sat: 0.94 });
  add('camera', LC, 'leica-chrome', 'Chrome', { con: 0.2, sat: 0.8, hsl: { yellow: [-6, -0.2, 0], green: [8, -0.25, -0.04], blue: [-5, -0.05, -0.1] }, sh: [200, 0.05] });
  add('camera', LC, 'leica-contemporary', 'Contemporary', { con: 0.08, sat: 0.88, sh: [200, 0.1], hi: [30, 0.08], fade: 0.02 });
  add('camera', LC, 'leica-eternal', 'Eternal', { con: -0.15, sat: 0.72, sh: [185, 0.1], hi: [45, 0.06], fade: 0.04 });
  add('camera', LC, 'leica-classic', 'Classic', { con: 0.14, sat: 0.85, hi: [40, 0.1], sh: [30, 0.04], roll: 0.97 });
  add('camera', LC, 'leica-mono-hc', 'Monochrome HC', { mono: BW.lum, con: 0.4, curve: S_HARD });
  add('camera', LC, 'leica-selenium', 'Selenium', { mono: BW.lum, con: 0.18, tone: [285, 0.14] });

  /* ---------- RICOH GR ---------- */
  const R = 'RICOH';
  add('camera', R, 'ricoh-posi', 'Positive Film', { con: 0.2, sat: 1.12, hi: [45, 0.08], sh: [210, 0.04], hsl: { yellow: [-4, 0.06, 0], blue: [-3, 0.1, -0.06] } });
  add('camera', R, 'ricoh-nega', 'Negative Film', { con: -0.12, sat: 0.82, fade: 0.04, sh: [185, 0.12], hi: [35, 0.06], roll: 0.96 });
  add('camera', R, 'ricoh-bleach', 'Bleach Bypass', { con: 0.5, sat: 0.38, curve: S_HARD, sh: [200, 0.04] });
  add('camera', R, 'ricoh-retro', 'Retro', { con: 0.05, sat: 0.6, hi: [45, 0.2], sh: [30, 0.1], fade: 0.06, roll: 0.94 });
  add('camera', R, 'ricoh-cross', 'Cross Processing', { con: 0.3, sat: 1.15, r: [[0, 0], [0.5, 0.56], [1, 1]], g: [[0, 0.03], [0.5, 0.52], [1, 0.95]], b: [[0, 0.12], [0.5, 0.42], [1, 0.82]] });
  add('camera', R, 'ricoh-hcbw', 'Hi-Contrast B&W', { mono: BW.lum, con: 0.75, curve: [[0, 0], [0.3, 0.1], [0.7, 0.92], [1, 1]] });

  /* ---------- 其他品牌 ---------- */
  add('camera', 'Hasselblad', 'hb-hncs', 'HNCS 自然色彩', { con: 0.06, sat: 1.0, hsl: { orange: [1, 0, 0.03], green: [-2, -0.04, 0] }, roll: 0.99 });
  add('camera', 'Panasonic LUMIX', 'lumix-lclassic', 'L.ClassicNeo', { con: 0.06, sat: 0.82, fade: 0.04, hi: [40, 0.1], sh: [190, 0.06] });
  add('camera', 'Panasonic LUMIX', 'lumix-lmono', 'L.Monochrome D', { mono: BW.orange, con: 0.42, curve: S_HARD });
  add('camera', 'OM SYSTEM', 'om-vintage', 'Vintage', { con: 0.02, sat: 0.78, hi: [45, 0.12], fade: 0.05, roll: 0.95 });
  add('camera', 'Apple', 'apple-rich', '濃郁對比', { con: 0.25, sat: 1.08, gamma: 1.06 });
  add('camera', 'Apple', 'apple-vibrant', '鮮明', { con: 0.06, sat: 1.25, vib: 0.2, gamma: 0.96 });
  add('camera', 'Apple', 'apple-warm', '暖色', { wb: [18, 3], sat: 1.04, con: 0.04 });
  add('camera', 'Apple', 'apple-cool', '冷色', { wb: [-18, -2], sat: 1.0, con: 0.04 });

  /* ---------- 底片 ---------- */
  const K = 'Kodak', FF = 'Fujifilm', IL = 'Ilford', CS = 'CineStill';
  add('film', K, 'portra160', 'Portra 160', { con: -0.06, sat: 0.88, roll: 0.98, fade: 0.015, hsl: { orange: [3, -0.06, 0.05], red: [2, -0.06, 0], green: [10, -0.15, 0], blue: [-4, -0.1, 0.02] }, hi: [40, 0.05], sh: [195, 0.03] });
  add('film', K, 'portra400', 'Portra 400', { con: 0, sat: 0.92, roll: 0.97, fade: 0.02, hsl: { orange: [3, -0.04, 0.06], green: [12, -0.15, 0], blue: [-6, -0.06, 0] }, hi: [42, 0.08], sh: [190, 0.05] });
  add('film', K, 'portra800', 'Portra 800', { con: 0.08, sat: 0.98, roll: 0.97, fade: 0.025, hsl: { orange: [4, 0, 0.04], green: [14, -0.1, 0] }, hi: [38, 0.1], sh: [200, 0.06] });
  add('film', K, 'ektar100', 'Ektar 100', { con: 0.24, sat: 1.3, hsl: { red: [-2, 0.15, -0.03], blue: [-6, 0.2, -0.08], orange: [0, 0.08, 0] }, sh: [220, 0.04] });
  add('film', K, 'gold200', 'Gold 200', { con: 0.1, sat: 1.08, wb: [12, 2], hi: [45, 0.12], fade: 0.02, hsl: { yellow: [-3, 0.1, 0.02], blue: [-6, -0.08, 0] } });
  add('film', K, 'colorplus', 'ColorPlus 200', { con: 0.06, sat: 1.02, wb: [14, 4], hi: [40, 0.14], sh: [30, 0.04], fade: 0.03, roll: 0.96 });
  add('film', K, 'ultramax', 'UltraMax 400', { con: 0.16, sat: 1.15, wb: [8, 0], hi: [45, 0.08], hsl: { red: [0, 0.1, 0], yellow: [-4, 0.1, 0] } });
  add('film', K, 'kodachrome', 'Kodachrome 64', { con: 0.3, sat: 1.18, curve: S_MED, hsl: { red: [-4, 0.15, -0.06], yellow: [-6, 0.1, -0.02], blue: [-10, 0.08, -0.12], green: [-6, -0.05, -0.06] }, sh: [20, 0.04], hi: [45, 0.05] });
  add('film', K, 'ektachrome', 'Ektachrome E100', { con: 0.22, sat: 1.15, wb: [-8, 0], hsl: { blue: [-4, 0.18, -0.04], aqua: [0, 0.15, 0] }, sh: [220, 0.06] });
  add('film', FF, 'superia400', 'Superia 400', { con: 0.12, sat: 1.05, g: [[0, 0.01], [0.5, 0.52], [1, 1]], hsl: { green: [10, 0.06, 0], blue: [-4, -0.04, 0] }, sh: [160, 0.06] });
  add('film', FF, 'pro400h', 'Pro 400H', { con: -0.1, sat: 0.86, roll: 0.98, fade: 0.025, hsl: { green: [16, -0.08, 0.04], blue: [-6, -0.04, 0.04], orange: [0, -0.06, 0.05] }, sh: [170, 0.06], hi: [190, 0.03] });
  add('film', FF, 'velvia50', 'Velvia 50', { con: 0.34, sat: 1.4, curve: S_HARD, hsl: { green: [-6, 0.2, -0.08], blue: [-8, 0.25, -0.14], red: [2, 0.12, -0.04] }, sh: [280, 0.06] });
  add('film', CS, 'cinestill800t', 'CineStill 800T', { con: 0.1, sat: 0.95, wb: [-22, 4], sh: [200, 0.1], hi: [15, 0.05], fade: 0.02, hsl: { red: [6, 0.1, 0], orange: [-4, -0.04, 0] } });
  add('film', CS, 'cinestill50d', 'CineStill 50D', { con: 0.06, sat: 1.0, hsl: { blue: [-4, 0.06, 0], green: [6, -0.08, 0] }, hi: [45, 0.04], sh: [200, 0.03] });
  add('film', 'Agfa', 'agfavista', 'Vista 200', { con: 0.16, sat: 1.12, hsl: { red: [0, 0.15, -0.02], green: [10, -0.05, 0], blue: [-6, 0.06, -0.04] }, sh: [180, 0.05], hi: [45, 0.04] });
  add('film', 'Lomography', 'lomo800', 'Color 800', { con: 0.22, sat: 1.25, hi: [40, 0.08], sh: [260, 0.08], fade: 0.02 });
  add('film', 'Polaroid', 'polaroid', 'Polaroid 600', { con: -0.1, sat: 0.8, roll: 0.93, fade: 0.06, hi: [50, 0.12], sh: [190, 0.12], hsl: { green: [16, -0.15, 0] } });
  add('film', K, 'trix400', 'Tri-X 400', { mono: BW.lum, con: 0.32, curve: S_MED, fade: 0.01 });
  add('film', K, 'tmax100', 'T-MAX 100', { mono: BW.lum, con: 0.12 });
  add('film', IL, 'hp5', 'HP5 Plus', { mono: BW.lum, con: 0.18, roll: 0.98, fade: 0.015 });
  add('film', IL, 'delta3200', 'Delta 3200', { mono: BW.lum, con: 0.42, fade: 0.04, gamma: 1.05 });

  /* ---------- 電影感 ---------- */
  add('cine', '', 'teal-orange', '青橙色調', { con: 0.18, sat: 1.05, sh: [190, 0.2], hi: [32, 0.14], hsl: { orange: [2, 0.08, 0.04], blue: [-12, 0, -0.04], green: [40, -0.25, -0.05] } });
  add('cine', '', 'blockbuster', '好萊塢大片', { con: 0.32, sat: 0.92, curve: S_MED, sh: [200, 0.24], hi: [35, 0.18] });
  add('cine', '', 'bleach-bypass', '漂白效果', { con: 0.55, sat: 0.35, curve: S_HARD });
  add('cine', '', 'moody', '沉鬱', { con: 0.14, sat: 0.7, gamma: 1.12, sh: [210, 0.14], fade: 0.04 });
  add('cine', '', 'matrix', '駭客綠', { con: 0.22, sat: 0.6, sh: [140, 0.18], mid: [120, 0.1], hi: [90, 0.06] });
  add('cine', '', 'day-for-night', '日拍夜景', { con: 0.15, sat: 0.45, gamma: 1.6, wb: [-45, 0], roll: 0.8, sh: [225, 0.15] });
  add('cine', '', 'summer', '盛夏暖陽', { con: 0.08, sat: 1.1, wb: [22, 5], hi: [45, 0.16], fade: 0.02 });
  add('cine', '', 'winter', '冷冽冬日', { con: 0.1, sat: 0.82, wb: [-24, 0], hi: [200, 0.06], sh: [220, 0.1] });
  add('cine', '', 'noir-color', '新黑色電影', { con: 0.35, sat: 0.45, gamma: 1.15, sh: [200, 0.12], hi: [40, 0.04] });
  add('cine', '', 'pastel', '粉彩童話', { con: -0.2, sat: 0.85, fade: 0.06, roll: 0.98, hi: [340, 0.1], sh: [190, 0.08], gamma: 0.9 });
  add('cine', '', 'cyberpunk', '賽博龐克', { con: 0.25, sat: 1.25, sh: [270, 0.26], hi: [185, 0.2], hsl: { red: [-20, 0.2, 0], orange: [-30, 0.1, 0], yellow: [40, -0.2, 0] } });
  add('cine', '', 'western', '西部荒漠', { con: 0.2, sat: 0.75, wb: [26, 6], hi: [40, 0.18], sh: [25, 0.1], fade: 0.03 });

  /* ---------- 黑白 ---------- */
  add('mono', '', 'bw-neutral', '中性黑白', { mono: BW.lum });
  add('mono', '', 'bw-contrast', '高反差', { mono: BW.lum, con: 0.55, curve: S_HARD });
  add('mono', '', 'bw-soft', '柔和灰階', { mono: BW.lum, con: -0.25, fade: 0.05, roll: 0.96 });
  add('mono', '', 'bw-red', '紅色濾鏡', { mono: BW.red, con: 0.25 });
  add('mono', '', 'bw-yellow', '黃色濾鏡', { mono: BW.yellow, con: 0.15 });
  add('mono', '', 'bw-green', '綠色濾鏡', { mono: BW.green, con: 0.12 });
  add('mono', '', 'bw-blue', '藍色濾鏡', { mono: BW.blue, con: 0.15 });
  add('mono', '', 'bw-sepia', '復古棕褐', { mono: BW.lum, tone: [34, 0.34], fade: 0.03, roll: 0.97 });
  add('mono', '', 'bw-cyano', '藍曬', { mono: BW.lum, tone: [205, 0.45], con: 0.1 });
  add('mono', '', 'bw-split', '雙色調', { mono: BW.lum, sh: [220, 0.18], hi: [40, 0.18], con: 0.1 });

  /* ---------- 創意 ---------- */
  add('creative', '', 'faded', '褪色記憶', { con: -0.15, sat: 0.72, curve: MATTE, hi: [45, 0.06] });
  add('creative', '', 'matte', '霧面', { curve: MATTE, sat: 0.92 });
  add('creative', '', 'airy', '空氣感', { con: -0.18, sat: 0.88, gamma: 0.85, roll: 0.99, fade: 0.03, hi: [200, 0.04] });
  add('creative', '', 'film-warm', '日系暖調', { con: -0.08, sat: 0.9, wb: [10, 2], gamma: 0.9, fade: 0.04, hsl: { green: [18, -0.18, 0.04], blue: [-8, -0.12, 0.04] }, hi: [40, 0.06] });
  add('creative', '', 'film-cool', '日系清新', { con: -0.1, sat: 0.88, wb: [-10, -2], gamma: 0.88, fade: 0.04, hsl: { green: [20, -0.2, 0.05], blue: [-6, -0.05, 0.06], orange: [0, -0.06, 0.06] } });
  add('creative', '', 'food', '美食', { con: 0.1, sat: 1.15, wb: [10, 0], hsl: { red: [0, 0.1, 0], orange: [0, 0.12, 0.03], yellow: [0, 0.1, 0.03], green: [-4, 0.1, 0] } });
  add('creative', '', 'golden', '黃金時刻', { wb: [30, 6], con: 0.08, sat: 1.08, hi: [38, 0.14], roll: 0.98 });
  add('creative', '', 'neon', '霓虹夜', { con: 0.2, sat: 1.3, sh: [250, 0.16], hsl: { red: [-10, 0.2, 0], purple: [0, 0.2, 0.05], blue: [5, 0.2, 0] } });
  add('creative', '', 'retro70', '70 年代', { con: 0.02, sat: 0.8, wb: [18, 8], hi: [40, 0.16], sh: [20, 0.08], fade: 0.06, roll: 0.94, hsl: { green: [-12, -0.2, 0] } });
  add('creative', '', 'infrared', '紅外線', { mat: [[0.1, 0.9, 0], [0.4, 0.3, 0.3], [0.6, 0.1, 0.3]], con: 0.2, sat: 0.9 });

  const byId = new Map(LOOKS.map((l) => [l.id, l]));
  window.Looks = { LOOKS, GROUPS, get: (id) => byId.get(id) };
})();
