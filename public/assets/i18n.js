/* 多語系：繁體中文 / English / 日本語，依瀏覽器語言自動選擇（與光印 Lumark 相同做法） */
(function () {
  'use strict';

  const DICT = {
    'zh-Hant': {
      'app.tagline': '相片與影片 LUT 濾鏡・調色工具',
      'meta.description': '在瀏覽器裡為相片與影片套用相機風格、底片與電影感 LUT，並手動調整白平衡、曲線、HSL 與色彩分級。支援 JPG、HEIC、RAW、GIF、MP4、MOV 等格式，檔案不會上傳。',
      'splash.sub': 'Lumi · LUT 調色',
      'kofi': '請我喝咖啡',
      'ui.theme': '外觀', 'ui.theme.auto': '跟隨系統', 'ui.theme.light': '淺色', 'ui.theme.dark': '深色', 'ui.language': '語言',
      'btn.add': '＋ 加入相片／影片', 'btn.saveShort': '儲存', 'btn.choose': '選擇檔案', 'btn.urlAdd': '加入',
      'btn.reset': '重設', 'btn.resetAll': '全部重設', 'btn.play': '播放／暫停',
      'list.title': '檔案', 'list.removeAll': '全部移除', 'list.remove': '移除',
      'url.placeholder': '貼上相片或影片網址', 'url.hint': '網址需允許跨網域讀取（CORS）。',
      'drop.title': '拖曳相片或影片到這裡',
      'drop.desc': '支援 JPG、PNG、WebP、SVG、HEIC、RAW（DNG、NEF、CR2、CR3、ARW、RAF…）、GIF、MP4、MOV、MKV、AVI、WMV、WebM，也可以貼上網址。檔案只在你的瀏覽器中處理，不會上傳。',
      'view.after': '調整後', 'view.split': '前後對比', 'view.before': '原圖', 'view.scrub': '播放位置',
      'tab.label': '設定分頁', 'tab.look': '濾鏡', 'tab.adjust': '調整', 'tab.curve': '曲線', 'tab.color': '色彩', 'tab.fx': '效果', 'tab.export': '輸出',
      'look.input': '輸入色彩', 'look.input.hint': '拍攝 Log 影片時選擇對應的相機，會先轉換成一般色彩再套用濾鏡。',
      'look.title': '濾鏡', 'look.remove': '移除濾鏡', 's.lutAmount': '濾鏡強度',
      'look.search': '搜尋濾鏡（例如 Classic Chrome、Portra）', 'look.import': '匯入 LUT', 'look.import.title': '匯入 .cube、.3dl 或 HaldCLUT PNG',
      'look.disclaimer': '相機與底片風格為依公開樣張調出的近似效果，並非原廠 LUT；品牌名稱為各公司商標。',
      'look.none': '原始', 'look.none.sub': '不套用濾鏡', 'look.all': '全部', 'look.mine': '我的 LUT',
      'look.mine.empty': '還沒有匯入 LUT。點「匯入 LUT」加入 .cube、.3dl 或 HaldCLUT PNG（會記在這個瀏覽器）。',
      'look.delete': '刪除這個 LUT', 'look.custom': '自訂 LUT',
      'group.camera': '相機', 'group.film': '底片', 'group.cine': '電影感', 'group.mono': '黑白', 'group.creative': '創意',
      'adj.histogram': '直方圖', 'sec.wb': '白平衡', 'sec.light': '光線', 'sec.presence': '色彩',
      's.temp': '色溫', 's.tint': '色調', 's.exposure': '曝光', 's.contrast': '對比', 's.highlights': '亮部', 's.shadows': '陰影',
      's.whites': '白色', 's.blacks': '黑色', 's.vibrance': '自然飽和度', 's.saturation': '飽和度',
      'adj.hint': '雙擊滑桿名稱可以歸零。',
      'curve.title': '色調曲線', 'curve.reset': '重設這條曲線', 'curve.r': '紅', 'curve.g': '綠', 'curve.b': '藍',
      'curve.hint': '點一下新增控制點、拖曳調整；雙擊或拖出框外可刪除。', 'curve.presets': '快速套用',
      'preset.linear': '線性', 'preset.soft': '柔和 S', 'preset.strong': '強烈 S', 'preset.matte': '霧面', 'preset.fade': '褪色', 'preset.invert': '負片',
      'color.hsl': 'HSL／顏色', 's.hue': '色相', 's.sat': '飽和度', 's.lum': '明亮度',
      'band.red': '紅', 'band.orange': '橙', 'band.yellow': '黃', 'band.green': '綠', 'band.aqua': '青', 'band.blue': '藍', 'band.purple': '紫', 'band.magenta': '洋紅',
      'color.grading': '色彩分級', 'wheel.sh': '陰影', 'wheel.mid': '中間調', 'wheel.hi': '亮部', 's.balance': '平衡',
      'color.hint': '在色輪上拖曳選擇色相與強度，雙擊色輪歸零。',
      'fx.vignette': '暈影', 's.amount': '強度', 's.midpoint': '中點', 's.feather': '羽化', 'fx.grain': '顆粒', 's.size': '大小',
      'fx.detail': '細節與質感', 's.sharpen': '銳利化', 's.fade': '褪色',
      'exp.scope': '套用範圍', 'exp.copy': '複製調整', 'exp.paste': '貼上調整', 'exp.applyAll': '套用到全部檔案',
      'exp.photo': '相片', 'exp.format': '格式', 's.quality': '品質', 'exp.size': '尺寸', 'size.orig': '原始尺寸', 'size.long': '長邊 {n} px',
      'exp.keepExif': '保留拍攝資訊（JPEG 原檔輸出成 JPEG 時）',
      'exp.video': '影片／GIF', 'exp.width': '寬度', 's.fps': 'GIF 影格率', 'exp.mute': '移除聲音',
      'exp.videoHint': '影片使用 ffmpeg.wasm 在瀏覽器中編碼，第一次需下載約 32MB，長影片會比較久。',
      'exp.lut': 'LUT 檔案', 'cube.33': '33³（通用）', 'cube.65': '65³（高精度）', 'cube.17': '17³（相機／螢幕）', 'exp.cube': '下載 .cube',
      'exp.cubeHint': '把目前的濾鏡與調整（不含暈影、顆粒、銳利化）匯出成 .cube，可用在 Premiere、DaVinci Resolve、Final Cut、LumaFusion 或支援自訂 LUT 的相機。',
      'more.appearance': '外觀', 'about.rights': '版權所有',
      'footer.credit': '相機與底片風格為近似模擬，品牌名稱為各公司商標。',
      'dock.one': '下載這張', 'dock.share': '儲存至裝置', 'dock.cube': '下載 LUT', 'dock.all': '全部下載 (ZIP)',
      'slide.title': '多張相片合成動畫', 'slide.hint': '依檔案列表順序，把每張相片（含各自的濾鏡與調整）合成 GIF 或 MP4。',
      'slide.hold': '每張停留', 'slide.motion': '轉場', 'slide.none': '直接切換', 'slide.fade': '淡入淡出', 'slide.zoom': '淡入淡出＋推近',
      'slide.trans': '轉場長度', 'slide.fit': '構圖', 'slide.cover': '填滿裁切', 'slide.contain': '完整顯示', 'slide.size': '長邊尺寸',
      'slide.make': '合成 {n} 張相片', 'slide.need2': '至少需要 2 張相片才能合成', 'slide.rendering': '處理相片 {i}/{n}', 'slide.frames': '產生影格 {i}/{n}',
      'kind.video': '影片',
      'st.noFiles': '沒有可以讀取的檔案。', 'st.reading': '讀取中：{name}…', 'st.readFail': '無法讀取 {name}：{err}',
      'st.transcodePrev': '轉換預覽：{name}', 'st.ffDownload': '下載影片元件', 'st.transcoding': '轉換中', 'st.encoding': '編碼中',
      'note.transcoded': '這個格式瀏覽器無法直接播放，預覽使用轉檔版本；輸出會使用原始檔。',
      'st.noWebgl': '這個瀏覽器不支援 WebGL2，無法預覽調色。請改用最新版 Chrome、Safari、Edge 或 Firefox。',
      'st.addFirst': '請先加入相片或影片。', 'st.lookRemoved': '已移除濾鏡', 'st.look': '濾鏡：{name}',
      'st.lutImported': '已匯入 {n} 個 LUT', 'st.lutOnly': '只支援 .cube、.3dl、HaldCLUT .png',
      'st.undo': '復原', 'st.redo': '重做', 'st.copied': '已複製調整', 'st.pasted': '已貼上調整',
      'st.appliedAll': '已套用到全部 {n} 個檔案', 'st.reset': '已重設這個檔案的所有調整',
      'st.exporting': '輸出中…', 'st.exportingN': '輸出中 {label}', 'st.exported': '已輸出 {name}（{mb} MB）', 'st.exportFail': '輸出失敗：{err}',
      'st.shareOpened': '已開啟分享選單', 'st.shareFallback': '這個瀏覽器不支援分享，已改為下載 {name}',
      'st.zipLoading': '壓縮元件尚未載入，請稍後再試', 'st.zipping': '壓縮中…', 'st.zipDone': '已下載 {n} 個檔案', 'st.cubeDone': '已下載 {n}³ LUT',
      'st.downloading': '下載中…', 'st.urlFail': '無法讀取這個網址（可能不允許跨網域讀取）：{err}',
      'st.decodingRaw': '正在解碼 RAW：{name}…', 'st.decodingHeic': '正在解碼 HEIC：{name}…', 'note.rawPreview': '無法完整解碼，使用相機內嵌預覽（{w}×{h}）',
      'st.avifNo': '這個瀏覽器不支援 AVIF 輸出', 'err.format': '瀏覽器無法輸出這個格式',
      'profile.none': '一般影像（sRGB／Rec.709）', 'profile.clog3709': 'Canon Log 3 · BT.709 色域', 'profile.hlg': 'HLG · BT.2020（平面解碼）',
    },

    en: {
      'app.tagline': 'LUT filters & color grading for photos and video',
      'meta.description': 'Apply camera, film and cinematic LUT looks to photos and videos in your browser, then fine-tune white balance, curves, HSL and color grading. Supports JPG, HEIC, RAW, GIF, MP4, MOV and more — nothing is uploaded.',
      'splash.sub': 'LUT Color Grading',
      'kofi': 'Buy me a coffee',
      'ui.theme': 'Appearance', 'ui.theme.auto': 'System', 'ui.theme.light': 'Light', 'ui.theme.dark': 'Dark', 'ui.language': 'Language',
      'btn.add': '+ Add photos / videos', 'btn.saveShort': 'Save', 'btn.choose': 'Choose files', 'btn.urlAdd': 'Add',
      'btn.reset': 'Reset', 'btn.resetAll': 'Reset all', 'btn.play': 'Play / pause',
      'list.title': 'Files', 'list.removeAll': 'Remove all', 'list.remove': 'Remove',
      'url.placeholder': 'Paste a photo or video URL', 'url.hint': 'The URL must allow cross-origin access (CORS).',
      'drop.title': 'Drop photos or videos here',
      'drop.desc': 'Supports JPG, PNG, WebP, SVG, HEIC, RAW (DNG, NEF, CR2, CR3, ARW, RAF…), GIF, MP4, MOV, MKV, AVI, WMV and WebM, or paste a URL. Files are processed in your browser and never uploaded.',
      'view.after': 'Edited', 'view.split': 'Compare', 'view.before': 'Original', 'view.scrub': 'Playback position',
      'tab.label': 'Settings', 'tab.look': 'Filters', 'tab.adjust': 'Adjust', 'tab.curve': 'Curves', 'tab.color': 'Color', 'tab.fx': 'Effects', 'tab.export': 'Export',
      'look.input': 'Input color', 'look.input.hint': 'For Log footage, choose your camera — it is converted to standard color before the filter is applied.',
      'look.title': 'Filter', 'look.remove': 'Remove filter', 's.lutAmount': 'Filter strength',
      'look.search': 'Search filters (e.g. Classic Chrome, Portra)', 'look.import': 'Import LUT', 'look.import.title': 'Import .cube, .3dl or HaldCLUT PNG',
      'look.disclaimer': 'Camera and film looks are approximations based on public samples, not official manufacturer LUTs. Brand names are trademarks of their owners.',
      'look.none': 'Original', 'look.none.sub': 'No filter', 'look.all': 'All', 'look.mine': 'My LUTs',
      'look.mine.empty': 'No LUTs yet. Use “Import LUT” to add .cube, .3dl or HaldCLUT PNG files (saved in this browser).',
      'look.delete': 'Delete this LUT', 'look.custom': 'Custom LUT',
      'group.camera': 'Camera', 'group.film': 'Film', 'group.cine': 'Cinematic', 'group.mono': 'B&W', 'group.creative': 'Creative',
      'adj.histogram': 'Histogram', 'sec.wb': 'White balance', 'sec.light': 'Light', 'sec.presence': 'Color',
      's.temp': 'Temp', 's.tint': 'Tint', 's.exposure': 'Exposure', 's.contrast': 'Contrast', 's.highlights': 'Highlights', 's.shadows': 'Shadows',
      's.whites': 'Whites', 's.blacks': 'Blacks', 's.vibrance': 'Vibrance', 's.saturation': 'Saturation',
      'adj.hint': 'Double-click a slider label to reset it.',
      'curve.title': 'Tone curve', 'curve.reset': 'Reset this curve', 'curve.r': 'Red', 'curve.g': 'Green', 'curve.b': 'Blue',
      'curve.hint': 'Click to add a point and drag to adjust; double-click or drag it out to remove.', 'curve.presets': 'Presets',
      'preset.linear': 'Linear', 'preset.soft': 'Soft S', 'preset.strong': 'Strong S', 'preset.matte': 'Matte', 'preset.fade': 'Faded', 'preset.invert': 'Negative',
      'color.hsl': 'HSL / Color', 's.hue': 'Hue', 's.sat': 'Saturation', 's.lum': 'Luminance',
      'band.red': 'Red', 'band.orange': 'Orange', 'band.yellow': 'Yellow', 'band.green': 'Green', 'band.aqua': 'Aqua', 'band.blue': 'Blue', 'band.purple': 'Purple', 'band.magenta': 'Magenta',
      'color.grading': 'Color grading', 'wheel.sh': 'Shadows', 'wheel.mid': 'Midtones', 'wheel.hi': 'Highlights', 's.balance': 'Balance',
      'color.hint': 'Drag on a wheel to pick hue and strength; double-click to reset.',
      'fx.vignette': 'Vignette', 's.amount': 'Amount', 's.midpoint': 'Midpoint', 's.feather': 'Feather', 'fx.grain': 'Grain', 's.size': 'Size',
      'fx.detail': 'Detail & texture', 's.sharpen': 'Sharpen', 's.fade': 'Fade',
      'exp.scope': 'Apply to', 'exp.copy': 'Copy settings', 'exp.paste': 'Paste settings', 'exp.applyAll': 'Apply to all files',
      'exp.photo': 'Photos', 'exp.format': 'Format', 's.quality': 'Quality', 'exp.size': 'Size', 'size.orig': 'Original size', 'size.long': 'Long edge {n} px',
      'exp.keepExif': 'Keep camera info (JPEG to JPEG)',
      'exp.video': 'Video / GIF', 'exp.width': 'Width', 's.fps': 'GIF frame rate', 'exp.mute': 'Remove audio',
      'exp.videoHint': 'Videos are encoded in your browser with ffmpeg.wasm. The first export downloads about 32 MB; long videos take a while.',
      'exp.lut': 'LUT file', 'cube.33': '33³ (standard)', 'cube.65': '65³ (high precision)', 'cube.17': '17³ (cameras / monitors)', 'exp.cube': 'Download .cube',
      'exp.cubeHint': 'Exports the current filter and adjustments (without vignette, grain and sharpening) as a .cube for Premiere, DaVinci Resolve, Final Cut, LumaFusion or cameras that accept custom LUTs.',
      'more.appearance': 'Appearance', 'about.rights': 'All rights reserved.',
      'footer.credit': 'Camera and film looks are approximations; brand names are trademarks of their owners.',
      'dock.one': 'Download', 'dock.share': 'Save to device', 'dock.cube': 'Download LUT', 'dock.all': 'Download all (ZIP)',
      'slide.title': 'Photos to animation', 'slide.hint': 'Combines your photos in list order — each with its own filter and adjustments — into a GIF or MP4.',
      'slide.hold': 'Time per photo', 'slide.motion': 'Transition', 'slide.none': 'Cut', 'slide.fade': 'Crossfade', 'slide.zoom': 'Fade + zoom',
      'slide.trans': 'Transition length', 'slide.fit': 'Framing', 'slide.cover': 'Fill (crop)', 'slide.contain': 'Fit (letterbox)', 'slide.size': 'Long edge',
      'slide.make': 'Combine {n} photos', 'slide.need2': 'Add at least 2 photos to combine', 'slide.rendering': 'Processing photo {i}/{n}', 'slide.frames': 'Building frames {i}/{n}',
      'kind.video': 'Video',
      'st.noFiles': 'No readable files.', 'st.reading': 'Reading {name}…', 'st.readFail': 'Could not read {name}: {err}',
      'st.transcodePrev': 'Converting preview: {name}', 'st.ffDownload': 'Downloading video engine', 'st.transcoding': 'Converting', 'st.encoding': 'Encoding',
      'note.transcoded': 'This format can’t be played directly, so the preview uses a converted copy. Export uses the original file.',
      'st.noWebgl': 'This browser doesn’t support WebGL2, so previews are unavailable. Please use the latest Chrome, Safari, Edge or Firefox.',
      'st.addFirst': 'Add a photo or video first.', 'st.lookRemoved': 'Filter removed', 'st.look': 'Filter: {name}',
      'st.lutImported': 'Imported {n} LUT(s)', 'st.lutOnly': 'Only .cube, .3dl and HaldCLUT .png are supported',
      'st.undo': 'Undo', 'st.redo': 'Redo', 'st.copied': 'Settings copied', 'st.pasted': 'Settings pasted',
      'st.appliedAll': 'Applied to all {n} files', 'st.reset': 'All adjustments for this file were reset',
      'st.exporting': 'Exporting…', 'st.exportingN': 'Exporting {label}', 'st.exported': 'Exported {name} ({mb} MB)', 'st.exportFail': 'Export failed: {err}',
      'st.shareOpened': 'Share sheet opened', 'st.shareFallback': 'Sharing isn’t supported here, so {name} was downloaded instead',
      'st.zipLoading': 'The ZIP library is still loading — please try again', 'st.zipping': 'Compressing…', 'st.zipDone': 'Downloaded {n} files', 'st.cubeDone': 'Downloaded {n}³ LUT',
      'st.downloading': 'Downloading…', 'st.urlFail': 'Could not load this URL (it may block cross-origin access): {err}',
      'st.decodingRaw': 'Decoding RAW: {name}…', 'st.decodingHeic': 'Decoding HEIC: {name}…', 'note.rawPreview': 'Full decode failed; using the embedded camera preview ({w}×{h})',
      'st.avifNo': 'This browser can’t export AVIF', 'err.format': 'The browser can’t export this format',
      'profile.none': 'Standard (sRGB / Rec.709)', 'profile.clog3709': 'Canon Log 3 · BT.709 gamut', 'profile.hlg': 'HLG · BT.2020 (flat decode)',

      'look.fuji-provia': 'PROVIA / Standard', 'look.fuji-velvia': 'Velvia / Vivid', 'look.fuji-astia': 'ASTIA / Soft', 'look.fuji-eterna': 'ETERNA / Cinema',
      'look.fuji-bleach': 'ETERNA Bleach Bypass', 'look.fuji-acros-r': 'ACROS + R Filter', 'look.fuji-acros-g': 'ACROS + G Filter', 'look.fuji-sepia': 'Sepia',
      'look.canon-std': 'Standard', 'look.canon-portrait': 'Portrait', 'look.canon-landscape': 'Landscape', 'look.canon-neutral': 'Neutral', 'look.canon-faithful': 'Faithful',
      'look.nikon-std': 'Standard', 'look.nikon-vivid': 'Vivid', 'look.nikon-portrait': 'Portrait', 'look.nikon-landscape': 'Landscape', 'look.nikon-flat': 'Flat',
      'look.sony-st': 'ST Standard', 'look.sony-pt': 'PT Portrait', 'look.sony-nt': 'NT Neutral', 'look.sony-vv': 'VV Vivid', 'look.sony-vv2': 'VV2 Vivid 2',
      'look.sony-fl': 'FL Film', 'look.sony-in': 'IN Instant', 'look.sony-sh': 'SH Soft Highkey', 'look.sony-bw': 'BW Black & White', 'look.sony-se': 'SE Sepia',
      'look.hb-hncs': 'HNCS Natural Colour',
      'look.apple-rich': 'Rich Contrast', 'look.apple-vibrant': 'Vibrant', 'look.apple-warm': 'Warm', 'look.apple-cool': 'Cool',
      'look.teal-orange': 'Teal & Orange', 'look.blockbuster': 'Blockbuster', 'look.bleach-bypass': 'Bleach Bypass', 'look.moody': 'Moody',
      'look.matrix': 'Matrix Green', 'look.day-for-night': 'Day for Night', 'look.summer': 'Summer Glow', 'look.winter': 'Cold Winter',
      'look.noir-color': 'Neo Noir', 'look.pastel': 'Pastel Dream', 'look.cyberpunk': 'Cyberpunk', 'look.western': 'Desert Western',
      'look.bw-neutral': 'Neutral B&W', 'look.bw-contrast': 'High Contrast', 'look.bw-soft': 'Soft Gray', 'look.bw-red': 'Red Filter',
      'look.bw-yellow': 'Yellow Filter', 'look.bw-green': 'Green Filter', 'look.bw-blue': 'Blue Filter', 'look.bw-sepia': 'Vintage Sepia',
      'look.bw-cyano': 'Cyanotype', 'look.bw-split': 'Split Tone',
      'look.faded': 'Faded Memory', 'look.matte': 'Matte', 'look.airy': 'Airy', 'look.film-warm': 'Warm Film', 'look.film-cool': 'Fresh Film',
      'look.food': 'Food', 'look.golden': 'Golden Hour', 'look.neon': 'Neon Night', 'look.retro70': '70s Retro', 'look.infrared': 'Infrared',
    },

    ja: {
      'app.tagline': '写真・動画の LUT フィルター＆カラー調整',
      'meta.description': 'ブラウザだけで写真や動画にカメラ風・フィルム風・シネマ風の LUT を適用し、ホワイトバランス、トーンカーブ、HSL、カラーグレーディングを細かく調整できます。JPG、HEIC、RAW、GIF、MP4、MOV などに対応。ファイルはアップロードされません。',
      'splash.sub': 'Lumi · LUT カラー',
      'kofi': 'コーヒーをおごる',
      'ui.theme': '外観', 'ui.theme.auto': 'システム', 'ui.theme.light': 'ライト', 'ui.theme.dark': 'ダーク', 'ui.language': '言語',
      'btn.add': '＋ 写真・動画を追加', 'btn.saveShort': '保存', 'btn.choose': 'ファイルを選択', 'btn.urlAdd': '追加',
      'btn.reset': 'リセット', 'btn.resetAll': 'すべてリセット', 'btn.play': '再生／一時停止',
      'list.title': 'ファイル', 'list.removeAll': 'すべて削除', 'list.remove': '削除',
      'url.placeholder': '写真・動画の URL を貼り付け', 'url.hint': 'URL はクロスオリジン読み込み（CORS）を許可している必要があります。',
      'drop.title': '写真や動画をここにドロップ',
      'drop.desc': 'JPG、PNG、WebP、SVG、HEIC、RAW（DNG、NEF、CR2、CR3、ARW、RAF…）、GIF、MP4、MOV、MKV、AVI、WMV、WebM に対応。URL の貼り付けも可能です。ファイルはブラウザ内で処理され、アップロードされません。',
      'view.after': '補正後', 'view.split': '比較', 'view.before': '元画像', 'view.scrub': '再生位置',
      'tab.label': '設定', 'tab.look': 'フィルター', 'tab.adjust': '調整', 'tab.curve': 'カーブ', 'tab.color': 'カラー', 'tab.fx': '効果', 'tab.export': '書き出し',
      'look.input': '入力カラー', 'look.input.hint': 'Log 撮影した動画は使用カメラを選ぶと、標準の色に変換してからフィルターを適用します。',
      'look.title': 'フィルター', 'look.remove': 'フィルターを解除', 's.lutAmount': 'フィルターの強さ',
      'look.search': 'フィルターを検索（例：Classic Chrome、Portra）', 'look.import': 'LUT を読み込む', 'look.import.title': '.cube、.3dl、HaldCLUT PNG を読み込む',
      'look.disclaimer': 'カメラ・フィルムの風合いは公開作例をもとにした近似表現で、メーカー純正 LUT ではありません。ブランド名は各社の商標です。',
      'look.none': 'オリジナル', 'look.none.sub': 'フィルターなし', 'look.all': 'すべて', 'look.mine': 'マイ LUT',
      'look.mine.empty': 'LUT はまだありません。「LUT を読み込む」から .cube、.3dl、HaldCLUT PNG を追加できます（このブラウザに保存されます）。',
      'look.delete': 'この LUT を削除', 'look.custom': 'カスタム LUT',
      'group.camera': 'カメラ', 'group.film': 'フィルム', 'group.cine': 'シネマ', 'group.mono': 'モノクロ', 'group.creative': 'クリエイティブ',
      'adj.histogram': 'ヒストグラム', 'sec.wb': 'ホワイトバランス', 'sec.light': 'ライト', 'sec.presence': 'カラー',
      's.temp': '色温度', 's.tint': '色かぶり補正', 's.exposure': '露光量', 's.contrast': 'コントラスト', 's.highlights': 'ハイライト', 's.shadows': 'シャドウ',
      's.whites': '白レベル', 's.blacks': '黒レベル', 's.vibrance': '自然な彩度', 's.saturation': '彩度',
      'adj.hint': 'スライダー名をダブルクリックするとリセットします。',
      'curve.title': 'トーンカーブ', 'curve.reset': 'このカーブをリセット', 'curve.r': '赤', 'curve.g': '緑', 'curve.b': '青',
      'curve.hint': 'クリックでポイント追加、ドラッグで調整。ダブルクリックまたは枠外へドラッグで削除。', 'curve.presets': 'プリセット',
      'preset.linear': 'リニア', 'preset.soft': 'ソフト S', 'preset.strong': '強い S', 'preset.matte': 'マット', 'preset.fade': 'フェード', 'preset.invert': 'ネガ',
      'color.hsl': 'HSL／カラー', 's.hue': '色相', 's.sat': '彩度', 's.lum': '輝度',
      'band.red': 'レッド', 'band.orange': 'オレンジ', 'band.yellow': 'イエロー', 'band.green': 'グリーン', 'band.aqua': 'アクア', 'band.blue': 'ブルー', 'band.purple': 'パープル', 'band.magenta': 'マゼンタ',
      'color.grading': 'カラーグレーディング', 'wheel.sh': 'シャドウ', 'wheel.mid': '中間調', 'wheel.hi': 'ハイライト', 's.balance': 'バランス',
      'color.hint': 'カラーホイール上をドラッグして色相と強さを選択。ダブルクリックでリセット。',
      'fx.vignette': '周辺光量', 's.amount': '適用量', 's.midpoint': '中心点', 's.feather': 'ぼかし', 'fx.grain': '粒子', 's.size': 'サイズ',
      'fx.detail': 'ディテール', 's.sharpen': 'シャープ', 's.fade': 'フェード',
      'exp.scope': '適用範囲', 'exp.copy': '設定をコピー', 'exp.paste': '設定を貼り付け', 'exp.applyAll': 'すべてのファイルに適用',
      'exp.photo': '写真', 'exp.format': '形式', 's.quality': '画質', 'exp.size': 'サイズ', 'size.orig': '元のサイズ', 'size.long': '長辺 {n} px',
      'exp.keepExif': '撮影情報を残す（JPEG から JPEG へ書き出す場合）',
      'exp.video': '動画・GIF', 'exp.width': '幅', 's.fps': 'GIF フレームレート', 'exp.mute': '音声を削除',
      'exp.videoHint': '動画はブラウザ内の ffmpeg.wasm でエンコードします。初回は約 32MB をダウンロードし、長い動画は時間がかかります。',
      'exp.lut': 'LUT ファイル', 'cube.33': '33³（標準）', 'cube.65': '65³（高精度）', 'cube.17': '17³（カメラ・モニター）', 'exp.cube': '.cube をダウンロード',
      'exp.cubeHint': '現在のフィルターと調整（周辺光量・粒子・シャープを除く）を .cube として書き出し、Premiere、DaVinci Resolve、Final Cut、LumaFusion やカスタム LUT 対応カメラで使えます。',
      'more.appearance': '外観', 'about.rights': 'All rights reserved.',
      'footer.credit': 'カメラ・フィルムの風合いは近似表現です。ブランド名は各社の商標です。',
      'dock.one': 'この写真を保存', 'dock.share': 'デバイスに保存', 'dock.cube': 'LUT を保存', 'dock.all': 'すべて保存 (ZIP)',
      'slide.title': '写真からアニメーション', 'slide.hint': 'リストの順番で、各写真のフィルターと調整を反映した GIF または MP4 を作成します。',
      'slide.hold': '1枚の表示時間', 'slide.motion': 'トランジション', 'slide.none': 'なし', 'slide.fade': 'クロスフェード', 'slide.zoom': 'フェード＋ズーム',
      'slide.trans': 'トランジションの長さ', 'slide.fit': 'フレーミング', 'slide.cover': 'トリミングして全面', 'slide.contain': '全体を表示', 'slide.size': '長辺サイズ',
      'slide.make': '{n} 枚を合成', 'slide.need2': '合成するには写真が 2 枚以上必要です', 'slide.rendering': '写真を処理中 {i}/{n}', 'slide.frames': 'フレーム作成中 {i}/{n}',
      'kind.video': '動画',
      'st.noFiles': '読み込めるファイルがありません。', 'st.reading': '読み込み中：{name}…', 'st.readFail': '{name} を読み込めません：{err}',
      'st.transcodePrev': 'プレビューを変換中：{name}', 'st.ffDownload': '動画エンジンをダウンロード中', 'st.transcoding': '変換中', 'st.encoding': 'エンコード中',
      'note.transcoded': 'この形式はブラウザで直接再生できないため、変換したプレビューを表示しています。書き出しには元のファイルを使います。',
      'st.noWebgl': 'このブラウザは WebGL2 に対応していないためプレビューできません。最新の Chrome、Safari、Edge、Firefox をご利用ください。',
      'st.addFirst': '先に写真か動画を追加してください。', 'st.lookRemoved': 'フィルターを解除しました', 'st.look': 'フィルター：{name}',
      'st.lutImported': '{n} 個の LUT を読み込みました', 'st.lutOnly': '.cube、.3dl、HaldCLUT .png のみ対応しています',
      'st.undo': '取り消し', 'st.redo': 'やり直し', 'st.copied': '設定をコピーしました', 'st.pasted': '設定を貼り付けました',
      'st.appliedAll': '{n} 個すべてのファイルに適用しました', 'st.reset': 'このファイルの調整をすべてリセットしました',
      'st.exporting': '書き出し中…', 'st.exportingN': '書き出し中 {label}', 'st.exported': '{name} を書き出しました（{mb} MB）', 'st.exportFail': '書き出しに失敗しました：{err}',
      'st.shareOpened': '共有メニューを開きました', 'st.shareFallback': '共有に対応していないため、{name} をダウンロードしました',
      'st.zipLoading': 'ZIP 機能を読み込み中です。少し待ってから再度お試しください', 'st.zipping': '圧縮中…', 'st.zipDone': '{n} 個のファイルをダウンロードしました', 'st.cubeDone': '{n}³ LUT をダウンロードしました',
      'st.downloading': 'ダウンロード中…', 'st.urlFail': 'この URL を読み込めません（クロスオリジンが許可されていない可能性があります）：{err}',
      'st.decodingRaw': 'RAW をデコード中：{name}…', 'st.decodingHeic': 'HEIC をデコード中：{name}…', 'note.rawPreview': '完全にデコードできなかったため、内蔵プレビューを使用しています（{w}×{h}）',
      'st.avifNo': 'このブラウザは AVIF の書き出しに対応していません', 'err.format': 'ブラウザがこの形式で書き出せません',
      'profile.none': '標準（sRGB／Rec.709）', 'profile.clog3709': 'Canon Log 3 · BT.709 色域', 'profile.hlg': 'HLG · BT.2020（フラット）',

      'look.fuji-provia': 'PROVIA／スタンダード', 'look.fuji-velvia': 'Velvia／ビビッド', 'look.fuji-astia': 'ASTIA／ソフト', 'look.fuji-eterna': 'ETERNA／シネマ',
      'look.fuji-bleach': 'ETERNA ブリーチバイパス', 'look.fuji-acros-r': 'ACROS＋Rフィルター', 'look.fuji-acros-g': 'ACROS＋Gフィルター', 'look.fuji-sepia': 'セピア',
      'look.canon-std': 'スタンダード', 'look.canon-portrait': 'ポートレート', 'look.canon-landscape': '風景', 'look.canon-neutral': 'ニュートラル', 'look.canon-faithful': '忠実設定',
      'look.nikon-std': 'スタンダード', 'look.nikon-vivid': 'ビビッド', 'look.nikon-portrait': 'ポートレート', 'look.nikon-landscape': '風景', 'look.nikon-flat': 'フラット',
      'look.sony-st': 'ST スタンダード', 'look.sony-pt': 'PT ポートレート', 'look.sony-nt': 'NT ニュートラル', 'look.sony-vv': 'VV ビビッド', 'look.sony-vv2': 'VV2 ビビッド2',
      'look.sony-fl': 'FL フィルム', 'look.sony-in': 'IN インスタント', 'look.sony-sh': 'SH ソフトハイキー', 'look.sony-bw': 'BW モノクロ', 'look.sony-se': 'SE セピア',
      'look.hb-hncs': 'HNCS ナチュラルカラー',
      'look.apple-rich': 'リッチなコントラスト', 'look.apple-vibrant': '鮮やか', 'look.apple-warm': '暖かい', 'look.apple-cool': '冷たい',
      'look.teal-orange': 'ティール＆オレンジ', 'look.blockbuster': 'ブロックバスター', 'look.bleach-bypass': 'ブリーチバイパス', 'look.moody': 'ムーディー',
      'look.matrix': 'マトリックス', 'look.day-for-night': '擬似夜景', 'look.summer': '夏の陽だまり', 'look.winter': '冬の冷気',
      'look.noir-color': 'ネオノワール', 'look.pastel': 'パステル', 'look.cyberpunk': 'サイバーパンク', 'look.western': 'ウエスタン',
      'look.bw-neutral': 'ニュートラル', 'look.bw-contrast': 'ハイコントラスト', 'look.bw-soft': 'ソフトグレー', 'look.bw-red': 'レッドフィルター',
      'look.bw-yellow': 'イエローフィルター', 'look.bw-green': 'グリーンフィルター', 'look.bw-blue': 'ブルーフィルター', 'look.bw-sepia': 'ヴィンテージセピア',
      'look.bw-cyano': 'サイアノタイプ', 'look.bw-split': 'スプリットトーン',
      'look.faded': '色あせた記憶', 'look.matte': 'マット', 'look.airy': '空気感', 'look.film-warm': '暖かいフィルム調', 'look.film-cool': '爽やかフィルム調',
      'look.food': 'フード', 'look.golden': 'ゴールデンアワー', 'look.neon': 'ネオンナイト', 'look.retro70': '70年代', 'look.infrared': '赤外線',
    },
  };

  const SUPPORTED = [
    { code: 'zh-Hant', label: '繁體中文', html: 'zh-Hant' },
    { code: 'en', label: 'English', html: 'en' },
    { code: 'ja', label: '日本語', html: 'ja' },
  ];
  const STORE_KEY = 'lumi.lang';

  function match(tag) {
    const t = String(tag || '').toLowerCase();
    if (t.startsWith('zh')) return 'zh-Hant';
    if (t.startsWith('ja')) return 'ja';
    if (t.startsWith('en')) return 'en';
    return null;
  }
  function detect() {
    const prefs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
    for (const p of prefs) { const m = match(p); if (m) return m; }
    return null;
  }
  const stored = (() => { try { return localStorage.getItem(STORE_KEY); } catch (e) { return null; } })();
  let lang = DICT[stored] ? stored : (detect() || 'en');

  /** 找不到翻譯時依序退回英文、fallback（例如濾鏡原名）、key */
  function t(key, vars, fallback) {
    let s = (DICT[lang] && DICT[lang][key]) ?? (lang !== 'zh-Hant' ? DICT.en[key] : undefined) ?? fallback ?? DICT['zh-Hant'][key] ?? key;
    if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
    return s;
  }

  // 品牌名稱：中文「光色」、英文「Lumi」、日文「光色（こうしょく）」
  const BRAND = { 'zh-Hant': '光色', en: 'Lumi', ja: '光色' };

  function apply(root) {
    const r = root || document;
    document.documentElement.lang = SUPPORTED.find((l) => l.code === lang).html;
    r.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    r.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
    r.querySelectorAll('[data-i18n-placeholder]').forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
    r.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
    const meta = document.querySelector('meta[name=description]');
    if (meta) meta.content = t('meta.description');
    const h1 = document.getElementById('brand-name');
    if (h1) {
      h1.innerHTML = lang === 'ja' ? '<ruby>光色<rt>こうしょく</rt></ruby>'
        : lang === 'en' ? 'Lumi' : '光色 <span class="muted brand-latin">Lumi</span>';
    }
    document.querySelectorAll('.brand-text').forEach((el) => { el.textContent = lang === 'en' ? 'Lumi' : `${BRAND[lang]} · Lumi`; });
    document.title = `${BRAND[lang]}${lang === 'en' ? '' : ' Lumi'} — ${t('app.tagline')}`;
  }

  function setLang(code) {
    if (!DICT[code]) return;
    lang = code;
    try { localStorage.setItem(STORE_KEY, code); } catch (e) { /* 無痕模式 */ }
    apply();
    window.dispatchEvent(new CustomEvent('langchange', { detail: code }));
  }

  window.I18n = { t, apply, setLang, SUPPORTED, get lang() { return lang; }, brand: () => BRAND[lang] };
})();
