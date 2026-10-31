/* 수면 파동 — WebGL2 2D 파동 방정식(높이장 핑퐁) + 굴절 + 물마루 흰 선
   입력: 클릭·탭 = 방울(반경 화면폭 4%), 마우스 끌기 = 손끝 잔물결
   복귀: 감쇠 0.991 x 120회/초 → 1.2초에 화면 폭 절반까지 번지고 2.5초 안에 잔잔
   가만히: 4~6초마다 자동 방울 하나 / 화면 밖이면 정지 */
(function () {
  'use strict';
  var VS = '#version 300 es\nin vec2 p;out vec2 uv;void main(){uv=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
  var SIM = '#version 300 es\nprecision highp float;uniform sampler2D s;uniform vec2 px;uniform float damp;uniform float asp;uniform vec4 d0;uniform vec4 d1;in vec2 uv;out vec4 o;\n' +
    'float drop(vec4 d){if(d.w==0.)return 0.;vec2 q=(uv-d.xy)*vec2(asp,1.);float r=length(q)/d.z;return r<1.?d.w*(.5+.5*cos(r*3.14159265)):0.;}\n' +
    'void main(){vec4 c=texture(s,uv);float l=texture(s,uv-vec2(px.x,0.)).r;float r=texture(s,uv+vec2(px.x,0.)).r;float b=texture(s,uv-vec2(0.,px.y)).r;float t=texture(s,uv+vec2(0.,px.y)).r;' +
    'float h=(l+r+b+t)*.5-c.g;h*=damp;h+=drop(d0)+drop(d1);o=vec4(h,c.r+drop(d0)*.5+drop(d1)*.5,0.,1.);}';
  var DRAW = '#version 300 es\nprecision highp float;uniform sampler2D hm;uniform sampler2D ph;uniform vec2 px;uniform vec4 cov;uniform float refr;uniform float lit;uniform float cre;uniform float gs;in vec2 uv;out vec4 o;\n' +
    'void main(){float hc=texture(hm,uv).r;float l=texture(hm,uv-vec2(px.x,0.)).r;float r=texture(hm,uv+vec2(px.x,0.)).r;float b=texture(hm,uv-vec2(0.,px.y)).r;float t=texture(hm,uv+vec2(0.,px.y)).r;' +
    'vec2 g=vec2(r-l,t-b)*gs;g*=2.4/(1.+length(g)*4.);vec2 q=uv*cov.xy+cov.zw+g*refr;vec3 c=texture(ph,q).rgb;' +
    'float s=dot(g,vec2(-.62,.78))*lit;c*=1.-clamp(-s,0.,1.)*.22;' +
    'float crest=clamp(-(l+r+b+t-4.*hc)*cre*gs*gs,0.,1.);c+=vec3(.9)*smoothstep(.2,1.,crest)*smoothstep(-.2,.6,s)*.26;' +
    'o=vec4(c,1.);}';

  function sh(gl, type, src) {
    var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { throw new Error(gl.getShaderInfoLog(s)); }
    return s;
  }
  function prog(gl, fs) {
    var p = gl.createProgram();
    gl.attachShader(p, sh(gl, gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl, gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { throw new Error(gl.getProgramInfoLog(p)); }
    var u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < n; i++) { var a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); }
    return { p: p, u: u };
  }

  function create(opt) {
    var host = opt.host, canvas = opt.canvas, img = opt.img;
    var gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: 'high-performance' });
    if (!gl) return null;
    if (!gl.getExtension('EXT_color_buffer_float') && !gl.getExtension('EXT_color_buffer_half_float')) return null;
    var sim, draw;
    try { sim = prog(gl, SIM); draw = prog(gl, DRAW); } catch (e) { return null; }

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    var isPhone = matchMedia('(max-width: 768px)').matches;
    var GX = isPhone ? 128 : 192, GY = 128, SUB = 2; // 60Hz 스텝마다 2회 계산 → 1.2초에 화면 폭 절반
    var tex = [], fbo = [], cur = 0;
    var photo = gl.createTexture(), photoReady = false, pw = 16, ph = 9;
    var W = 0, H = 0, asp = 1;
    var FX = isPhone ? 0.70 : 0.62, FY = 0.5; // 사진 초점(가로 62%, 폰 70%)

    function mkTarget() {
      var t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, GX, GY, 0, gl.RGBA, gl.HALF_FLOAT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      var f = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      return [t, f];
    }
    function grid() {
      tex.forEach(function (t) { gl.deleteTexture(t); }); fbo.forEach(function (f) { gl.deleteFramebuffer(f); });
      tex = []; fbo = [];
      GY = Math.max(64, Math.round(GX * H / W));
      for (var i = 0; i < 2; i++) { var r = mkTarget(); tex.push(r[0]); fbo.push(r[1]); }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) === 0) return false;
      return true;
    }
    function size() {
      var r = host.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = Math.max(2, Math.round(r.width)), h = Math.max(2, Math.round(r.height));
      var scale = dpr; if (w * h * dpr * dpr > 4.2e6) scale = Math.sqrt(4.2e6 / (w * h));
      canvas.width = Math.round(w * scale); canvas.height = Math.round(h * scale);
      var changedW = w !== W; W = w; H = h; asp = W / H;
      if (changedW || !tex.length) grid();
    }
    function loadPhoto() {
      var src = img.currentSrc || img.src;
      var im = new Image();
      im.decoding = 'async';
      im.onload = function () {
        pw = im.naturalWidth; ph = im.naturalHeight;
        gl.bindTexture(gl.TEXTURE_2D, photo);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        photoReady = true;
        host.classList.add('gl-on');
        api.auto = performance.now() - 2600; // 곧 첫 시범 방울
      };
      im.src = src;
    }

    var pending = []; // 이번 스텝에 넣을 방울
    function addDrop(nx, ny, radFrac, strength) {
      // nx, ny: 0..1 화면 좌표(위가 0) → 격자 uv(아래가 0)
      pending.push([nx, 1 - ny, radFrac * asp, strength]);
      if (pending.length > 6) pending.shift();
    }

    var acc = 0, STEP = 1 / 60;
    function stepOnce() {
      var d0 = pending.shift() || [0, 0, 1, 0];
      var d1 = pending.shift() || [0, 0, 1, 0];
      var src = cur, dst = 1 - cur;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[dst]);
      gl.viewport(0, 0, GX, GY);
      gl.useProgram(sim.p);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex[src]);
      gl.uniform1i(sim.u.s, 0);
      gl.uniform2f(sim.u.px, 1 / GX, 1 / GY);
      gl.uniform1f(sim.u.damp, api.damp);
      gl.uniform1f(sim.u.asp, asp);
      gl.uniform4f(sim.u.d0, d0[0], d0[1], d0[2], d0[3]);
      gl.uniform4f(sim.u.d1, d1[0], d1[1], d1[2], d1[3]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      cur = dst;
    }
    function render() {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(draw.p);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex[cur]);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, photo);
      gl.uniform1i(draw.u.hm, 0); gl.uniform1i(draw.u.ph, 1);
      gl.uniform2f(draw.u.px, 1 / GX, 1 / GY);
      // 표지 맞춤(cover) + 초점
      var ca = W / H, pa = pw / ph;
      var sx = Math.min(1, ca / pa), sy = Math.min(1, pa / ca);
      var fx = api.fx, fy = 1 - FY;
      var ox = Math.min(Math.max(fx - sx / 2, 0), 1 - sx), oy = Math.min(Math.max(fy - sy / 2, 0), 1 - sy);
      gl.uniform4f(draw.u.cov, sx, sy, ox, oy);
      gl.uniform1f(draw.u.refr, api.refr);
      gl.uniform1f(draw.u.lit, api.lit);
      gl.uniform1f(draw.u.cre, api.cre);
      gl.uniform1f(draw.u.gs, GX / 128);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    var visible = true, last = null, moved = 0;
    var io = new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }, { threshold: 0 });
    io.observe(host);

    // 입력
    function rel(e) { var r = host.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; }
    host.addEventListener('click', function (e) {
      if (e.target.closest('a,button')) return;
      var p = rel(e); addDrop(p[0], p[1], api.dropR, api.dropS); api.auto = performance.now() + 2000;
    });
    if (matchMedia('(hover:hover) and (pointer:fine)').matches) {
      host.addEventListener('pointermove', function (e) {
        var p = rel(e);
        if (last) {
          var dx = (p[0] - last[0]) * asp, dy = p[1] - last[1];
          var dist = Math.sqrt(dx * dx + dy * dy);
          moved += dist;
          if (moved > 0.014) { addDrop(p[0], p[1], api.trailR, -Math.min(api.trailS, moved * 7)); moved = 0; }
        }
        last = p; api.auto = performance.now();
      }, { passive: true });
      host.addEventListener('pointerleave', function () { last = null; }, { passive: true });
    }

    var api = {
      damp: 0.991, refr: 0.07, lit: 3, cre: 60, dropR: 0.04, dropS: -1.2, trailR: 0.016, trailS: 0.16, fx: FX,
      auto: performance.now(), nextGap: 4600,
      resize: size,
      drop: addDrop,
      frame: function (dt, now) {
        if (!visible || !photoReady) return;
        if (now - api.auto > api.nextGap) {
          api.auto = now; api.nextGap = 4000 + Math.random() * 2000;
          var ax = 0.42 + Math.random() * 0.48, ay = 0.18 + Math.random() * 0.42;
          addDrop(ax, ay, api.dropR * 0.9, api.dropS * 0.8);
        }
        acc += Math.min(dt, 0.1);
        var n = 0;
        while (acc >= STEP && n < 3) { for (var k = 0; k < SUB; k++) stepOnce(); acc -= STEP; n++; }
        if (n === 3) acc = 0;
        render();
      }
    };
    size();
    if (img.complete && img.naturalWidth) loadPhoto(); else img.addEventListener('load', loadPhoto, { once: true });
    return api;
  }

  window.HSWater = { create: create };
})();
