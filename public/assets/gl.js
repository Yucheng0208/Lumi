/* WebGL2 算圖：銳利化 → 3D LUT → 暈影 → 顆粒。預覽與高解析輸出共用。 */
(function () {
  'use strict';

  const VS = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5); // 影像第一列在上方，不需要 FLIP_Y
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

  const FS = `#version 300 es
precision highp float;
precision highp sampler3D;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uImg;
uniform sampler3D uLut;
uniform float uN;
uniform vec2 uPx;          // 一個輸出像素在貼圖座標的大小（銳利化取樣用）
uniform float uSharp;
uniform float uVig, uVigMid, uVigFeather;
uniform float uGrain, uGrainSize, uSeed;
uniform vec2 uImgSize;     // 原始影像尺寸，讓顆粒大小與輸出解析度無關
uniform float uSplit;      // 0–1：左側顯示原圖；-1 不分割
uniform int uOrig;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32 + uSeed);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
vec3 lut(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return texture(uLut, c * ((uN - 1.0) / uN) + 0.5 / uN).rgb;
}
void main() {
  vec4 src = texture(uImg, vUv);
  vec3 c = src.rgb;
  bool orig = uOrig == 1 || (uSplit >= 0.0 && vUv.x < uSplit);
  if (!orig) {
    if (uSharp > 0.0) {
      vec3 n = texture(uImg, vUv + vec2(uPx.x, 0.0)).rgb + texture(uImg, vUv - vec2(uPx.x, 0.0)).rgb
             + texture(uImg, vUv + vec2(0.0, uPx.y)).rgb + texture(uImg, vUv - vec2(0.0, uPx.y)).rgb;
      c = clamp(c + uSharp * (c - n * 0.25), 0.0, 1.0);
    }
    c = lut(c);
    if (uVig != 0.0) {
      float r = length((vUv - 0.5) * 2.0) / 1.41421356;
      float v = smoothstep(uVigMid, uVigMid + uVigFeather, r);
      if (uVig < 0.0) c *= 1.0 + uVig * v;
      else c = mix(c, vec3(1.0), uVig * v);
    }
    if (uGrain > 0.0) {
      vec2 p = vUv * uImgSize / (max(uImgSize.x, uImgSize.y) / 1600.0) / uGrainSize;
      float n = (vnoise(p) + 0.5 * vnoise(p * 2.13 + 17.0)) / 1.5 - 0.5;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c += n * uGrain * 0.3 * (1.0 - abs(l * 2.0 - 1.0) * 0.7);
    }
  }
  outColor = vec4(clamp(c, 0.0, 1.0), src.a);
}`;

  class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, premultipliedAlpha: false, antialias: false, alpha: true });
      if (!gl) throw new Error('這個瀏覽器不支援 WebGL2');
      this.gl = gl;
      this.maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      const sh = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
      };
      const prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      this.prog = prog;
      gl.useProgram(prog);
      this.u = {};
      for (const n of ['uImg', 'uLut', 'uN', 'uPx', 'uSharp', 'uVig', 'uVigMid', 'uVigFeather', 'uGrain', 'uGrainSize', 'uSeed', 'uImgSize', 'uSplit', 'uOrig']) {
        this.u[n] = gl.getUniformLocation(prog, n);
      }
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'aPos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

      this.imgTex = gl.createTexture();
      this.lutTex = gl.createTexture();
      gl.uniform1i(this.u.uImg, 0);
      gl.uniform1i(this.u.uLut, 1);
      this.lutN = 2;
      this.setLut(new Float32Array([0, 0, 0, 1, 1, 0, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1]), 2);
      this.imgW = 1; this.imgH = 1;
    }

    /** 上傳影像（img / canvas / ImageBitmap / video）。mip=true 時產生 mipmap，縮小預覽比較不會有鋸齒 */
    setImage(src, w, h, mip = true) {
      const gl = this.gl;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.imgTex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.BROWSER_DEFAULT_WEBGL);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      if (mip) {
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      } else {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      }
      this.imgW = w; this.imgH = h;
    }

    setLut(rgba, N) {
      const gl = this.gl;
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_3D, this.lutTex);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA16F, N, N, N, 0, gl.RGBA, gl.FLOAT, rgba);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      for (const p of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R]) gl.texParameteri(gl.TEXTURE_3D, p, gl.CLAMP_TO_EDGE);
      gl.activeTexture(gl.TEXTURE0);
      this.lutN = N;
    }

    /** fx：{ sharpen, vignette, vigMid, vigFeather, grain, grainSize }（與 Color.defaultGrade 相同單位） */
    render(width, height, fx, opts = {}) {
      const gl = this.gl, u = this.u;
      if (this.canvas.width !== width) this.canvas.width = width;
      if (this.canvas.height !== height) this.canvas.height = height;
      gl.viewport(0, 0, width, height);
      gl.useProgram(this.prog);
      gl.uniform1f(u.uN, this.lutN);
      // 銳利化以原始解析度為準：縮小預覽時改用輸出像素間距，看起來接近
      gl.uniform2f(u.uPx, 1 / Math.min(width, this.imgW), 1 / Math.min(height, this.imgH));
      gl.uniform1f(u.uSharp, (fx.sharpen || 0) / 100 * 1.6);
      gl.uniform1f(u.uVig, (fx.vignette || 0) / 100);
      const mid = (fx.vigMid == null ? 50 : fx.vigMid) / 100, feather = (fx.vigFeather == null ? 50 : fx.vigFeather) / 100;
      gl.uniform1f(u.uVigMid, 0.15 + mid * 0.7 - feather * 0.25);
      gl.uniform1f(u.uVigFeather, 0.05 + feather * 0.7);
      gl.uniform1f(u.uGrain, (fx.grain || 0) / 100);
      gl.uniform1f(u.uGrainSize, 0.5 + (fx.grainSize == null ? 25 : fx.grainSize) / 100 * 3);
      gl.uniform1f(u.uSeed, opts.seed || 0);
      gl.uniform2f(u.uImgSize, this.imgW, this.imgH);
      gl.uniform1f(u.uSplit, opts.split == null ? -1 : opts.split);
      gl.uniform1i(u.uOrig, opts.original ? 1 : 0);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    /** 以 CPU 計算的暈影遮罩（與 shader 相同公式），給 ffmpeg 影片輸出使用 */
    static vignetteMask(w, h, fx) {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      const img = ctx.createImageData(w, h);
      const amt = (fx.vignette || 0) / 100;
      const mid = (fx.vigMid == null ? 50 : fx.vigMid) / 100, feather = (fx.vigFeather == null ? 50 : fx.vigFeather) / 100;
      const e0 = 0.15 + mid * 0.7 - feather * 0.25, e1 = e0 + 0.05 + feather * 0.7;
      const d = img.data;
      for (let y = 0; y < h; y++) {
        const vy = ((y + 0.5) / h - 0.5) * 2;
        for (let x = 0; x < w; x++) {
          const vx = ((x + 0.5) / w - 0.5) * 2;
          const r = Math.sqrt(vx * vx + vy * vy) / Math.SQRT2;
          let t = Math.min(1, Math.max(0, (r - e0) / (e1 - e0)));
          t = t * t * (3 - 2 * t);
          // 變暗：乘上 (1 + amt·v)；變亮：screen 混合 amt·v
          const v = amt < 0 ? 1 + amt * t : amt * t;
          const o = (y * w + x) * 4;
          d[o] = d[o + 1] = d[o + 2] = Math.round(v * 255); d[o + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
      return c;
    }

    dispose() {
      const ext = this.gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
    }
  }

  window.Renderer = Renderer;
})();
