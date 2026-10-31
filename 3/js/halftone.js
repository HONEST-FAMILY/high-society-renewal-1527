/* 대표 장면 — 점묘·하프톤 (쇠라 / 신문 망점)
   입력: 커서·손가락 / 반응: 손 자리의 망점이 밀려나고 줄어들며 그 아래 실제 컬러 사진이 부드러운 가장자리로 드러남
   복귀: 손을 떼면 드러난 자리가 서서히 닫히고 점이 스프링으로 돌아옴
   가만히 있을 때: 5초마다 한 줄이 쓸고 지나가는 자동 시범 */
(function () {
  'use strict';
  var HS = window.HS; if (!HS) return;
  var fig = document.getElementById('heroArt'), cv = document.getElementById('heroCv');
  var img = fig && fig.querySelector('.hero-img'), cnt = document.getElementById('dotCount');
  if (!fig || !cv || !cv.getContext) return;
  var ctx = cv.getContext('2d', { alpha: false }); if (!ctx) return;

  var P = {
    gapPC: 8, gapM: 10,          // 망점 격자 간격(px, 45° 망)
    rMax: 0.64,                   // 가장 어두운 점 반지름 = 간격 × rMax
    k: 0.06, damp: 0.85,          // 스프링, 감쇠
    R: 140, Rm: 110,               // 반응 반경(PC/폰)
    push: 20,                     // 점이 밀려나는 최대 거리
    decay: 0.972,                 // 드러난 자리가 닫히는 속도(60Hz 한 스텝당)
    sweepEvery: 5000, sweepDur: 1900
  };
  var reduce = HS.reduce;
  var DPR = Math.min(2, window.devicePixelRatio || 1);
  var W = 0, H = 0, gap = 8, h = 5.66;
  var N = 0, X, Y, R0, DX, DY, VX, VY, FI;
  var fcell = 8, fw = 0, fh = 0, field, fimg, fcv = document.createElement('canvas'), fctx = fcv.getContext('2d');
  var rev = document.createElement('canvas'), rctx = rev.getContext('2d');
  var photo = new Image(), ready = false, cover = null;
  var ptr = { on: false, x: 0, y: 0, sx: 0, sy: 0, until: 0 };
  var sweep = null, lastTouch = -1e9, sweepTimer = 0, visible = true, alive = false, acc = 0, sweepRow = 0;
  var figTop = 0, figLeft = 0;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function setup() {
    var w = fig.clientWidth, hh = fig.clientHeight;
    if (!w || !hh) return;
    W = w; H = hh;
    var mobile = window.innerWidth <= 768;
    gap = mobile ? P.gapM : P.gapPC; h = gap / Math.SQRT2;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    rev.width = cv.width; rev.height = cv.height;
    // 사진 덮어 맞추기
    var s = Math.max(W / photo.naturalWidth, H / photo.naturalHeight);
    cover = { w: photo.naturalWidth * s, h: photo.naturalHeight * s };
    cover.x = (W - cover.w) / 2; cover.y = (H - cover.h) / 2;
    // 밝기 표본: 격자 해상도로 줄여 그린 뒤 한 번만 읽음
    var gc = Math.ceil(W / h) + 2, gr = Math.ceil(H / h) + 2;
    var sc = document.createElement('canvas'); sc.width = gc; sc.height = gr;
    var sx = sc.getContext('2d', { willReadFrequently: true });
    sx.imageSmoothingEnabled = true; sx.imageSmoothingQuality = 'high';
    sx.drawImage(photo, cover.x / h, cover.y / h, cover.w / h, cover.h / h);
    var data = sx.getImageData(0, 0, gc, gr).data;
    var xs = [], ys = [], rs = [];
    for (var r = 0; r < gr; r++) {
      for (var c = r & 1; c < gc; c += 2) {
        var i = (r * gc + c) * 4;
        var lum = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
        var dk = clamp((1 - lum - 0.2) / 0.72, 0, 1);
        dk = Math.pow(dk, 0.95);
        var rad = gap * P.rMax * Math.sqrt(dk);
        if (rad < 0.45) continue;
        xs.push(c * h); ys.push(r * h); rs.push(rad);
      }
    }
    N = xs.length;
    X = new Float32Array(xs); Y = new Float32Array(ys); R0 = new Float32Array(rs);
    DX = new Float32Array(N); DY = new Float32Array(N); VX = new Float32Array(N); VY = new Float32Array(N);
    fw = Math.ceil(W / fcell) + 1; fh = Math.ceil(H / fcell) + 1;
    field = new Float32Array(fw * fh);
    fcv.width = fw; fcv.height = fh; fimg = fctx.createImageData(fw, fh);
    FI = new Int32Array(N);
    for (var j = 0; j < N; j++) FI[j] = Math.min(fh - 1, Math.round(Y[j] / fcell)) * fw + Math.min(fw - 1, Math.round(X[j] / fcell));
    if (cnt) cnt.textContent = '점 ' + N.toLocaleString('ko-KR') + '개';
    measurePos();
    draw(true);
    cv.classList.add('on');
  }
  function measurePos() { var r = fig.getBoundingClientRect(); figTop = r.top + window.scrollY; figLeft = r.left + window.scrollX; }
  HS.onMeasure = function () {
    var w = fig.clientWidth, hh = fig.clientHeight;
    if (ready && (w !== W || Math.abs(hh - H) > 2)) setup(); else if (ready) measurePos();
  };

  /* 손 자리에 '드러남' 붓 찍기 */
  function stamp(x, y, R, str) {
    var cr = Math.ceil(R / fcell), cx = Math.round(x / fcell), cy = Math.round(y / fcell);
    for (var j = Math.max(0, cy - cr); j <= Math.min(fh - 1, cy + cr); j++) {
      for (var i = Math.max(0, cx - cr); i <= Math.min(fw - 1, cx + cr); i++) {
        var dx = i * fcell - x, dy = j * fcell - y, dd = Math.sqrt(dx * dx + dy * dy) / R;
        if (dd >= 1) continue;
        var v = clamp((1 - dd) / 0.45, 0, 1); v = v * v * (3 - 2 * v) * str;
        var k = j * fw + i; if (v > field[k]) field[k] = v;
      }
    }
  }

  function step() {
    var R = window.innerWidth <= 768 ? P.Rm : P.R;
    var hasP = false, px = 0, py = 0, str = 1;
    var now = performance.now();
    if (ptr.on || now < ptr.until) {
      ptr.sx += (ptr.x - ptr.sx) * 0.35; ptr.sy += (ptr.y - ptr.sy) * 0.35;
      hasP = true; px = ptr.sx; py = ptr.sy;
    } else if (sweep) {
      var t = (now - sweep.t0) / P.sweepDur;
      if (t >= 1) { sweep = null; }
      else {
        var e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        px = -R + (W + 2 * R) * e; py = sweep.y + Math.sin(e * Math.PI * 2) * H * 0.05;
        hasP = true; str = 0.92;
      }
    }
    // 드러난 자리 닫기
    var fmax = 0;
    for (var f = 0; f < field.length; f++) { var fv = field[f] * P.decay; if (fv < 0.004) fv = 0; field[f] = fv; if (fv > fmax) fmax = fv; }
    if (hasP) { stamp(px, py, R, str); fmax = 1; }
    // 점 스프링
    var vmax = 0, Rp = R * 1.15, Rp2 = Rp * Rp;
    for (var n = 0; n < N; n++) {
      var tx = 0, ty = 0;
      if (hasP) {
        var ddx = X[n] - px, ddy = Y[n] - py, d2 = ddx * ddx + ddy * ddy;
        if (d2 < Rp2 && d2 > 0.01) {
          var dist = Math.sqrt(d2), q = 1 - dist / Rp, m = P.push * q * q;
          tx = ddx / dist * m; ty = ddy / dist * m;
        }
      }
      var vx = (VX[n] + (tx - DX[n]) * P.k) * P.damp, vy = (VY[n] + (ty - DY[n]) * P.k) * P.damp;
      VX[n] = vx; VY[n] = vy; DX[n] += vx; DY[n] += vy;
      var a = (vx < 0 ? -vx : vx) + (vy < 0 ? -vy : vy) + (DX[n] < 0 ? -DX[n] : DX[n]) * 0.05 + (DY[n] < 0 ? -DY[n] : DY[n]) * 0.05;
      if (a > vmax) vmax = a;
    }
    return hasP || fmax > 0 || vmax > 0.01;
  }

  function draw(full) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    var any = false;
    for (var f = 0; f < field.length; f++) if (field[f] > 0) { any = true; break; }
    if (any) {
      var a = fimg.data;
      for (var g = 0, p = 3; g < field.length; g++, p += 4) a[p] = field[g] * 255;
      fctx.putImageData(fimg, 0, 0);
      rctx.setTransform(1, 0, 0, 1, 0, 0);
      rctx.globalCompositeOperation = 'source-over';
      rctx.clearRect(0, 0, rev.width, rev.height);
      rctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      rctx.drawImage(photo, cover.x, cover.y, cover.w, cover.h);
      rctx.globalCompositeOperation = 'destination-in';
      rctx.imageSmoothingEnabled = true;
      rctx.drawImage(fcv, -fcell / 2, -fcell / 2, fw * fcell, fh * fcell);
      rctx.globalCompositeOperation = 'source-over';
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(rev, 0, 0);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    ctx.fillStyle = '#111';
    ctx.beginPath();
    for (var n = 0; n < N; n++) {
      var rr = R0[n] * (1 - field[FI[n]]);
      if (rr < 0.35) continue;
      var x = X[n] + DX[n], y = Y[n] + DY[n];
      ctx.moveTo(x + rr, y); ctx.arc(x, y, rr, 0, 6.2832);
    }
    ctx.fill();
  }

  /* 고정 60Hz 스텝(밀리면 최대 3스텝) */
  function tick(dt) {
    if (!ready || !visible) { alive = false; return false; }
    acc += dt; var steps = 0, more = false;
    while (acc >= 1 / 60 && steps < 3) { more = step(); acc -= 1 / 60; steps++; }
    if (steps === 3) acc = 0;
    if (steps) draw();
    if (!more && steps) { alive = false; scheduleSweep(); return false; }
    return true;
  }
  function wake() { if (!alive && ready && visible) { alive = true; acc = 0; HS.add(tick); } }
  // 루프 등록은 한 번만 — 깨울 때는 kick
  var registered = false;
  function wakeOnce() {
    if (!ready || !visible) return;
    if (!registered) { registered = true; HS.add(tick); }
    alive = true; HS.kick();
  }
  wake = wakeOnce;

  function scheduleSweep() {
    clearTimeout(sweepTimer);
    if (reduce || !visible) return;
    sweepTimer = setTimeout(function () {
      if (!visible || ptr.on || performance.now() - lastTouch < 3500) { scheduleSweep(); return; }
      sweepRow = (sweepRow + 1) % 3;
      sweep = { t0: performance.now(), y: H * [0.3, 0.62, 0.46][sweepRow] };
      wake();
    }, P.sweepEvery);
  }

  /* 입력 — 터치는 passive, 세로 스크롤은 막지 않음(touch-action: pan-y), 탭은 click */
  function local(e) { ptr.x = e.clientX + window.scrollX - figLeft; ptr.y = e.clientY + window.scrollY - figTop; }
  cv.addEventListener('pointerenter', function (e) { local(e); ptr.sx = ptr.x; ptr.sy = ptr.y; ptr.on = true; lastTouch = performance.now(); sweep = null; wake(); }, { passive: true });
  cv.addEventListener('pointermove', function (e) {
    local(e);
    if (!ptr.on) { ptr.on = true; ptr.sx = ptr.x; ptr.sy = ptr.y; }
    lastTouch = performance.now(); sweep = null; wake();
  }, { passive: true });
  function off() { ptr.on = false; ptr.until = performance.now() + 120; lastTouch = performance.now(); }
  cv.addEventListener('pointerleave', off, { passive: true });
  cv.addEventListener('pointercancel', off, { passive: true });
  cv.addEventListener('pointerup', function (e) { if (e.pointerType !== 'mouse') off(); }, { passive: true });
  cv.addEventListener('click', function (e) {
    local(e); ptr.sx = ptr.x; ptr.sy = ptr.y; ptr.until = performance.now() + 700; lastTouch = performance.now(); sweep = null; wake();
  });
  window.addEventListener('scroll', function () { if (ready) { /* 위치는 pageTop 기준이라 다시 읽지 않음 */ } }, { passive: true });

  /* 화면 밖이면 멈춤 */
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) {
      visible = en[0].isIntersecting;
      if (visible) { wake(); scheduleSweep(); } else { clearTimeout(sweepTimer); }
    }, { threshold: 0 }).observe(fig);
  }

  var hint = fig.querySelector('.hero-hint');
  if (hint && !HS.fine) hint.textContent = '손가락으로 눌러 보세요';
  photo.decoding = 'async';
  photo.src = img ? (img.currentSrc || img.src) : 'img/hero.jpg';
  (photo.decode ? photo.decode() : new Promise(function (r) { photo.onload = r; })).then(function () {
    ready = true; setup(); wake();
    // 첫 시범은 조금 빨리
    if (!reduce) setTimeout(function () { if (!ptr.on && performance.now() - lastTouch > 1500) { sweep = { t0: performance.now(), y: H * 0.46 }; wake(); } }, 1200);
  }).catch(function () { /* 그림을 못 읽으면 정지 사진이 그대로 보임 */ });

  window.__hsHalftone = { P: P, count: function () { return N; }, poke: function (x, y, ms) { ptr.x = ptr.sx = x; ptr.y = ptr.sy = y; ptr.until = performance.now() + (ms || 600); wake(); } };
})();
