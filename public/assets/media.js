/* 影片／GIF：瀏覽器播放預覽；無法播放的格式先用 ffmpeg.wasm 轉成預覽檔；
   輸出時把整組調色烘焙成 .cube，交給 ffmpeg 的 lut3d 濾鏡，暈影／顆粒／銳利化用對應濾鏡處理。 */
(function () {
  'use strict';

  /** 用瀏覽器原生播放器載入；無法播放（AVI、WMV、部分 MKV）時 reject */
  function loadVideo(url) {
    return new Promise((resolve, reject) => {
      const v = document.createElement('video');
      v.muted = true; v.playsInline = true; v.loop = true; v.preload = 'auto';
      v.crossOrigin = 'anonymous';
      const timer = setTimeout(() => fail('video load timeout'), 12000);
      function fail(msg) { clearTimeout(timer); v.removeAttribute('src'); v.load(); reject(new Error(msg)); }
      v.onloadeddata = () => {
        v.onloadeddata = null;
        if (!v.videoWidth) { fail('no decodable video track'); return; }
        v.currentTime = Math.min(0.1, (v.duration || 1) / 2);
        v.onseeked = () => { v.onseeked = null; clearTimeout(timer); resolve(v); };
      };
      v.onerror = () => fail('video decode failed');
      v.src = url;
    });
  }

  /* ---------- ffmpeg.wasm（第一次使用才下載，約 32MB，之後由瀏覽器快取） ---------- */

  const CORE_BASE = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd';
  let ffmpegPromise = null, ffmpeg = null;

  async function fetchToBlobURL(url, type, onProgress) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`下載失敗 ${res.status}`);
    const total = Number(res.headers.get('content-length')) || 0;
    if (!res.body || !total || !onProgress) return URL.createObjectURL(new Blob([await res.arrayBuffer()], { type }));
    const reader = res.body.getReader();
    const chunks = [];
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value); got += value.length;
      onProgress(got / total);
    }
    return URL.createObjectURL(new Blob(chunks, { type }));
  }

  function getFFmpeg(onDownload) {
    if (!ffmpegPromise) {
      ffmpegPromise = (async () => {
        if (!window.FFmpegWASM) await Decode.loadScript('vendor/ffmpeg/ffmpeg.js');
        const inst = new FFmpegWASM.FFmpeg();
        const coreURL = await fetchToBlobURL(`${CORE_BASE}/ffmpeg-core.js`, 'text/javascript');
        const wasmURL = await fetchToBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm', onDownload);
        await inst.load({ coreURL, wasmURL });
        ffmpeg = inst;
        return inst;
      })();
      ffmpegPromise.catch(() => { ffmpegPromise = null; });
    }
    return ffmpegPromise;
  }

  function cancel() {
    if (ffmpeg) { ffmpeg.terminate(); ffmpeg = null; ffmpegPromise = null; }
  }

  const extOf = (name, def) => ((name.match(/\.([a-z0-9]+)$/i) || [, def])[1]).toLowerCase();

  async function run(ff, args, onProgress) {
    const logs = [];
    const onLog = ({ message }) => { logs.push(message); if (logs.length > 80) logs.shift(); };
    const onProg = ({ progress }) => onProgress && onProgress(Math.max(0, Math.min(1, progress)));
    ff.on('log', onLog); ff.on('progress', onProg);
    try {
      const code = await ff.exec(args);
      if (code !== 0) throw new Error('ffmpeg 失敗：\n' + logs.slice(-15).join('\n'));
      return logs;
    } catch (e) {
      // wasm 當掉後同一個實例無法再用，下次重新載入
      cancel();
      throw e instanceof Error ? e : new Error(String(e) + '\n' + logs.slice(-15).join('\n'));
    } finally { ff.off('log', onLog); ff.off('progress', onProg); }
  }

  /** 瀏覽器無法播放的影片：轉一份預覽用 MP4（長邊 ≤1920、無聲） */
  async function transcodePreview(file, onProgress) {
    const ff = await getFFmpeg((r) => onProgress('download', r));
    const input = `preview-in.${extOf(file.name, 'bin')}`;
    await ff.writeFile(input, new Uint8Array(await file.arrayBuffer()));
    try {
      await run(ff, ['-i', input, '-map', '0:v:0', '-an',
        '-vf', "scale='if(gt(iw,ih),min(1920,iw),-2)':'if(gt(iw,ih),-2,min(1920,ih))'",
        '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '24', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', 'preview.mp4'],
      (r) => onProgress('transcode', r));
      const data = await ff.readFile('preview.mp4');
      return URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }));
    } finally {
      if (ffmpeg === ff) for (const n of [input, 'preview.mp4']) { try { await ff.deleteFile(n); } catch (e) { /* 不存在 */ } }
    }
  }

  /**
   * 輸出影片／GIF
   * job: { file, cube（.cube 文字）, fx（暈影等）, mask（暈影遮罩 Blob，可省略）, width, height,
   *        format: 'mp4'|'mov'|'webm'|'gif', mute, fps, maxWidth, crf }
   */
  async function exportVideo(job, onProgress) {
    const ff = await getFFmpeg((r) => onProgress('download', r));
    const input = `in.${extOf(job.file.name, 'mp4')}`;
    const out = `out.${job.format}`;
    await ff.writeFile(input, new Uint8Array(await job.file.arrayBuffer()));
    await ff.writeFile('grade.cube', new TextEncoder().encode(job.cube));
    if (job.mask) await ff.writeFile('mask.png', new Uint8Array(await job.mask.arrayBuffer()));

    const gif = job.format === 'gif';
    const fx = job.fx || {};
    const chain = [];
    // 與瀏覽器相同：依影片標記的色彩矩陣轉成 RGB
    if (fx.sharpen > 0) { const a = (fx.sharpen / 100 * 1.6 * 1.4).toFixed(2); chain.push(`unsharp=3:3:${a}:3:3:${a}`); }
    chain.push('scale=in_range=auto:in_color_matrix=auto,format=gbrp', 'lut3d=file=grade.cube:interp=tetrahedral');
    let f = `[0:v]${chain.join(',')}[g]`;
    let label = 'g';
    if (job.mask) {
      f += `;[1:v]format=gbrp,scale=${job.width}:${job.height}[m];[g][m]blend=all_mode=${fx.vignette < 0 ? 'multiply' : 'screen'}[v]`;
      label = 'v';
    }
    const post = [];
    if (fx.grain > 0) post.push(`noise=alls=${Math.round(fx.grain / 100 * 38)}:allf=t`);
    if (job.maxWidth && job.maxWidth < job.width) post.push(`scale=${job.maxWidth}:-2:flags=lanczos`);
    if (gif) {
      post.push(`fps=${job.fps || 15}`);
      f += `;[${label}]${post.join(',')}${post.length ? ',' : ''}split[s0][s1];[s0]palettegen=stats_mode=diff[pal];[s1][pal]paletteuse=dither=bayer:bayer_scale=4[out]`;
    } else {
      post.push('scale=trunc(iw/2)*2:trunc(ih/2)*2:out_color_matrix=bt709:out_range=tv', 'format=yuv420p');
      f += `;[${label}]${post.join(',')}[out]`;
    }

    const args = ['-i', input];
    if (job.mask) args.push('-i', 'mask.png');
    args.push('-filter_complex', f, '-map', '[out]');
    if (gif) {
      args.push('-loop', '0');
    } else if (job.format === 'webm') {
      if (job.mute) args.push('-an'); else args.push('-map', '0:a?', '-c:a', 'libopus', '-b:a', '128k');
      // VP9 在單執行緒 wasm 中會卡住，改用 VP8
      args.push('-c:v', 'libvpx', '-crf', '8', '-b:v', '12M', '-deadline', 'realtime', '-cpu-used', '6');
    } else {
      if (job.mute) args.push('-an'); else args.push('-map', '0:a?', '-c:a', 'aac', '-b:a', '160k');
      args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(job.crf || 20),
        '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709');
      if (job.format === 'mp4') args.push('-movflags', '+faststart');
    }
    args.push(out);

    try {
      await run(ff, args, (r) => onProgress('encode', r));
      const data = await ff.readFile(out);
      const type = gif ? 'image/gif' : job.format === 'mov' ? 'video/quicktime' : job.format === 'webm' ? 'video/webm' : 'video/mp4';
      return new Blob([data.buffer], { type });
    } finally {
      if (ffmpeg === ff) for (const n of [input, 'grade.cube', 'mask.png', out]) { try { await ff.deleteFile(n); } catch (e) { /* 不存在 */ } }
    }
  }

  /**
   * 多張相片合成動畫：frames 為依序的 JPEG Blob，fps 為影格率
   * format: 'gif' | 'mp4'
   */
  async function encodeFrames({ frames, fps, format }, onProgress) {
    const ff = await getFFmpeg((r) => onProgress('download', r));
    const names = [];
    try {
      for (let i = 0; i < frames.length; i++) {
        const n = `f${String(i).padStart(5, '0')}.jpg`;
        await ff.writeFile(n, new Uint8Array(await frames[i].arrayBuffer()));
        names.push(n);
      }
      const out = `slides.${format}`;
      const args = ['-framerate', String(fps), '-i', 'f%05d.jpg'];
      if (format === 'gif') {
        args.push('-filter_complex', 'split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4', '-loop', '0');
      } else {
        // 每張停留很久時影格率會很低，提高到 30fps 讓播放器相容
        args.push('-vf', `fps=${Math.max(fps, 30)},format=yuv420p`, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-movflags', '+faststart');
      }
      args.push(out);
      names.push(out);
      await run(ff, args, (r) => onProgress('encode', r));
      const data = await ff.readFile(out);
      return new Blob([data.buffer], { type: format === 'gif' ? 'image/gif' : 'video/mp4' });
    } finally {
      if (ffmpeg === ff) for (const n of names) { try { await ff.deleteFile(n); } catch (e) { /* 不存在 */ } }
    }
  }

  window.Media = { loadVideo, transcodePreview, exportVideo, encodeFrames, getFFmpeg, cancel };
})();
