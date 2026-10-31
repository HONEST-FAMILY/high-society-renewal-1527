/* 대표 장면 — 칼리그람(아폴리네르): 이 회사 해시태그가 줄지어 '1%' → '알게' → '믿게' 모양을 쓴다.
   입력: 마우스 휘젓기·손가락 끌기(흩어짐), 클릭·탭(파동), 스크롤(다음 모양). 가만히 있으면 몇 초마다 한 귀퉁이를 휘젓는 시범. */
(function () {
  'use strict';
  /* 루프는 하나만: 다른 스크립트도 여기에 붙는다 */
  if (!window.HSLoop) {
    window.HSLoop = (function () {
      var fns = [], last = 0;
      function frame(t) {
        var dt = last ? Math.min(0.1, (t - last) / 1000) : 1 / 60;
        last = t;
        for (var i = 0; i < fns.length; i++) fns[i](dt, t);
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
      return { add: function (f) { fns.push(f); } };
    })();
  }

  var hero = document.querySelector('.hero');
  if (!hero) return;
  var stick = hero.querySelector('.hero-stick');
  var cv = hero.querySelector('.hero-cv');
  var ctx = cv.getContext && cv.getContext('2d', { alpha: false });
  if (!ctx) return;
  var stages = hero.querySelectorAll('.hero-stage');
  var progI = hero.querySelector('.hero-prog i');
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  var TAGS = ['#블로그체험단', '#맛집', '#체험', '#프렌차이즈', '#바이럴마케팅', '#인스타그램체험단', '#인플루언서', '#체험단', '#홍보', '#언론보도', '#브랜드', '#프로모션', '#이벤트', '#신제품출시', '#SNS체험단', '#상품'];
  var WORDS = ['1%', '알게', '믿게'];
  var FONT = '"Pretendard Variable", Pretendard, "Noto Sans KR", "Malgun Gothic", sans-serif';
  var INK = '#0a0a0a', GRAY = '#8c8c8c', BG = '#ffffff';

  /* 숫자(튜닝값) */
  var SPRING = 0.05, FRICTION = 0.87, PUSH = 4.2, DRAG = 0.24;
  var WAVE_SPEED = 12, WAVE_W = 64, WAVE_LIFE = 84;
  var MORPH_SWEEP = 0.7, TURB_TIME = 1.2;

  var W = 0, H = 0, dpr = 1, mobile = false, R = 100;
  var sizes, LH, GAP;
  var atlas = null, spr = [];
  var N = 0, px, py, vx, vy, hx, hy, tx, ty, sw, cur, nxt, seed, pend;
  var layouts = [], counts = [], sils = [];
  var stage = 0, clock = 0, acc = 0, sleeping = false, built = false, visible = true, dirtyDraw = true;
  var ptr = { x: -1e5, y: -1e5, px: 0, py: 0, vx: 0, vy: 0, on: false, lastT: -10 };
  var demo = null, nextDemo = 2.6;
  var waves = [];
  var rectTop = 0, rectLeft = 0, rectDirty = true;
  var heroTop = 0, heroSpan = 1;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  var rs = 1234567;
  function rnd() { rs = (rs * 1103515245 + 12345) & 0x7fffffff; return rs / 0x7fffffff; }

  function buildAtlas() {
    spr = [];
    var m = document.createElement('canvas').getContext('2d');
    var items = [];
    for (var t = 0; t < TAGS.length; t++) for (var s = 0; s < sizes.length; s++) for (var c = 0; c < 2; c++) {
      var fs = sizes[s];
      var font = (c ? 500 : 700) + ' ' + fs + 'px ' + FONT;
      m.font = font;
      items.push({ t: t, c: c, font: font, w: Math.ceil(m.measureText(TAGS[t]).width) + 2, h: Math.ceil(fs * 1.35) });
    }
    var maxW = 1024, x = 0, y = 0, rowH = 0;
    items.forEach(function (it) {
      if (x + it.w > maxW) { x = 0; y += rowH + 2; rowH = 0; }
      it.x = x; it.y = y; x += it.w + 2; rowH = Math.max(rowH, it.h);
    });
    atlas = document.createElement('canvas');
    atlas.width = Math.ceil(maxW * dpr);
    atlas.height = Math.ceil((y + rowH + 2) * dpr);
    var a = atlas.getContext('2d');
    a.scale(dpr, dpr);
    a.textBaseline = 'middle';
    items.forEach(function (it) {
      a.font = it.font;
      a.fillStyle = it.c ? GRAY : INK;
      a.fillText(TAGS[it.t], it.x + 1, it.y + it.h / 2);
      spr.push({ sx: it.x * dpr, sy: it.y * dpr, sw: Math.ceil(it.w * dpr), sh: Math.ceil(it.h * dpr), w: it.w, h: it.h });
    });
  }
  function sprIndex(t, s, c) { return (t * sizes.length + s) * 2 + c; }

  function region() {
    if (!mobile) {
      var top = Math.max(84, H * 0.1);
      return { x: W * 0.3, y: top, w: W * 0.685, h: H * 0.95 - top };
    }
    var t2 = Math.max(104, H * 0.13);
    return { x: W * 0.015, y: t2, w: W * 0.97, h: Math.min(H * 0.64, H - 300) - t2 };
  }

  function mask(text, Rg) {
    var c = document.createElement('canvas');
    var cw = Math.max(10, Math.ceil(Rg.w)), ch = Math.max(10, Math.ceil(Rg.h));
    c.width = cw; c.height = ch;
    var g = c.getContext('2d', { willReadFrequently: true });
    var fs = 400;
    g.font = '900 ' + fs + 'px ' + FONT;
    if ('letterSpacing' in g) g.letterSpacing = '-28px';
    var m = g.measureText(text);
    var iw = m.actualBoundingBoxLeft + m.actualBoundingBoxRight, ih = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
    fs = fs * Math.min(cw / iw, ch / ih);
    g.font = '900 ' + fs + 'px ' + FONT;
    if ('letterSpacing' in g) g.letterSpacing = (-fs * 0.07).toFixed(1) + 'px';
    m = g.measureText(text);
    iw = m.actualBoundingBoxLeft + m.actualBoundingBoxRight; ih = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
    var ox = (cw - iw) / 2;
    var bx = ox + m.actualBoundingBoxLeft, by = (ch - ih) / 2 + m.actualBoundingBoxAscent;
    g.fillStyle = '#000';
    g.fillText(text, bx, by);
    /* 모양 뒤 옅은 실루엣(선 색) — 처음 보는 순간부터 '1%'로 읽히게 */
    var sil = document.createElement('canvas');
    sil.width = Math.ceil(cw * dpr); sil.height = Math.ceil(ch * dpr);
    var g2 = sil.getContext('2d');
    g2.scale(dpr, dpr);
    g2.font = g.font;
    if ('letterSpacing' in g2) g2.letterSpacing = g.letterSpacing;
    g2.fillStyle = '#e4e4e1';
    g2.fillText(text, bx, by);
    sils.push({ c: sil, x: Rg.x, y: Rg.y, a: 0 });
    return { d: g.getImageData(0, 0, cw, ch).data, cw: cw, ch: ch };
  }

  /* 모양 안을 해시태그로 한 줄씩 채운다(칼리그람) */
  function layoutShape(text) {
    var Rg = region();
    var M = mask(text, Rg), d = M.d, cw = M.cw, ch = M.ch;
    function inside(x, y) {
      x = x | 0; y = y | 0;
      if (x < 0 || y < 0 || x >= cw || y >= ch) return false;
      return d[(y * cw + x) * 4 + 3] > 140;
    }
    var out = [];
    rs = 98765 + text.charCodeAt(0);
    for (var y = LH * 0.6; y < ch; y += LH) {
      var x = 0;
      while (x < cw) {
        if (!inside(x, y)) { x += 2; continue; }
        var placed = false;
        for (var k = 0; k < 10; k++) {
          var r = rnd();
          var s = r < 0.36 ? 0 : r < 0.78 ? 1 : 2;
          var t = (rnd() * TAGS.length) | 0;
          if (k > 5 && TAGS[t].length > 4) t = [1, 2, 8, 15, 7, 10][(rnd() * 6) | 0];
          var c = rnd() < 0.3 ? 1 : 0;
          var si = sprIndex(t, s, c), w = spr[si].w, hh = spr[si].h * 0.3;
          if (inside(x + w, y) && inside(x + w * 0.5, y) && inside(x + w * 0.25, y) && inside(x + w * 0.75, y) && inside(x + w * 0.5, y - hh) && inside(x + w * 0.5, y + hh)) {
            out.push(Rg.x + x + w / 2, Rg.y + y, si);
            x += w + GAP;
            placed = true;
            break;
          }
        }
        if (!placed) x += 3;
      }
    }
    return out;
  }

  function park(i, n) {
    var a = (i * 2.399963) % (Math.PI * 2);
    var rr = Math.max(W, H) * (0.7 + (i % 7) * 0.04);
    return [W / 2 + Math.cos(a) * rr, H / 2 + Math.sin(a) * rr];
  }

  function build() {
    var rect = stick.getBoundingClientRect();
    var w = Math.round(rect.width), h = Math.round(rect.height);
    if (built && w === W) return;
    W = w; H = h;
    mobile = W <= 768;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    sizes = mobile ? [9, 9.5, 10.5] : [9.5, 11, 12.5];
    LH = mobile ? 9.8 : 12.5;
    GAP = mobile ? 2 : 3;
    R = clamp(W * 0.085, 70, 150);
    buildAtlas();
    sils = [];
    layouts = WORDS.map(layoutShape);
    counts = layouts.map(function (l) { return l.length / 3; });
    var n = Math.max.apply(null, counts);
    var old = px, oldN = N;
    N = n;
    px = new Float32Array(N); py = new Float32Array(N); vx = new Float32Array(N); vy = new Float32Array(N);
    hx = new Float32Array(N); hy = new Float32Array(N); tx = new Float32Array(N); ty = new Float32Array(N);
    sw = new Float32Array(N); cur = new Uint16Array(N); nxt = new Uint16Array(N); seed = new Float32Array(N); pend = new Uint8Array(N);
    for (var i = 0; i < N; i++) { seed[i] = Math.random(); cur[i] = (i * 7) % spr.length; }
    built = true;
    assign(stage, false, true);
    settle();
    sils[stage].a = 1;
    if (!reduce && !old) {
      /* 첫 등장: 제자리 근처(±70px)에서 1초 안에 모인다 — 모양은 처음부터 읽힌다 */
      for (var j = 0; j < counts[stage]; j++) {
        px[j] += (Math.random() - 0.5) * 140; py[j] += (Math.random() - 0.5) * 90;
      }
      sils[stage].a = 0.35;
    }
    document.documentElement.classList.add('cv-ok');
    window.__heroInfo = { N: N, counts: counts, W: W, H: H };
    dirtyDraw = true; sleeping = false;
  }

  function assign(s, sweep, first) {
    var L = layouts[s], K = counts[s];
    for (var i = 0; i < N; i++) {
      if (i < K) { tx[i] = L[i * 3]; ty[i] = L[i * 3 + 1]; nxt[i] = L[i * 3 + 2]; }
      else { var p = park(i, N); tx[i] = p[0]; ty[i] = p[1]; nxt[i] = cur[i]; }
      var base = 0;
      sw[i] = clock + base + (sweep ? (tx[i] / Math.max(1, W)) * MORPH_SWEEP + seed[i] * 0.2 : 0);
      pend[i] = 1;
    }
    sleeping = false;
  }
  function settle() {
    for (var i = 0; i < N; i++) { px[i] = hx[i] = tx[i]; py[i] = hy[i] = ty[i]; cur[i] = nxt[i]; pend[i] = 0; vx[i] = vy[i] = 0; }
    dirtyDraw = true;
  }

  function setStage(s) {
    if (s === stage) return;
    stage = s;
    for (var i = 0; i < stages.length; i++) {
      var on = +stages[i].getAttribute('data-stage') === s;
      stages[i].classList.toggle('is-on', on);
      if (on) stages[i].removeAttribute('aria-hidden'); else stages[i].setAttribute('aria-hidden', 'true');
    }
    if (!built) return;
    assign(s, true, false);
    if (reduce) settle();
  }

  function wave(x, y) {
    if (reduce) return;
    waves.push({ x: x, y: y, age: 0 });
    if (waves.length > 4) waves.shift();
    sleeping = false;
  }

  function step() {
    clock += 1 / 60;
    var t = clock;
    if (ptr.on) {
      ptr.vx = ptr.vx * 0.4 + (ptr.x - ptr.px) * 0.6;
      ptr.vy = ptr.vy * 0.4 + (ptr.y - ptr.py) * 0.6;
      ptr.px = ptr.x; ptr.py = ptr.y;
    } else { ptr.vx *= 0.8; ptr.vy *= 0.8; }
    var sp = Math.hypot(ptr.vx, ptr.vy);
    if (sp > 50) { ptr.vx *= 50 / sp; ptr.vy *= 50 / sp; }

    /* 자동 시범: 손이 2.5초 이상 없으면 한 귀퉁이를 살짝 휘젓는다 */
    if (!demo && !ptr.on && t > nextDemo && t - ptr.lastT > 2.5 && counts[stage] > 0) {
      var j = (Math.random() * counts[stage]) | 0, L = layouts[stage];
      var cx = L[j * 3], cy = L[j * 3 + 1], dir = Math.random() < 0.5 ? -1 : 1;
      demo = { x0: cx - 120 * dir, y0: cy - 50, x1: cx + 120 * dir, y1: cy + 40, t: 0, x: cx, y: cy, vx: 0, vy: 0 };
    }
    var mx = -1e5, my = -1e5, r = R, mvx = ptr.vx, mvy = ptr.vy, push = PUSH;
    if (ptr.on) { mx = ptr.x; my = ptr.y; }
    else if (demo) {
      demo.t += 1 / 60 / 1.1;
      var e = demo.t < 0.5 ? 2 * demo.t * demo.t : 1 - Math.pow(-2 * demo.t + 2, 2) / 2;
      var nx = demo.x0 + (demo.x1 - demo.x0) * e, ny = demo.y0 + (demo.y1 - demo.y0) * e;
      demo.vx = nx - demo.x; demo.vy = ny - demo.y; demo.x = nx; demo.y = ny;
      mx = nx; my = ny; mvx = demo.vx; mvy = demo.vy; r = R * 0.8; push = PUSH * 0.75;
      if (demo.t >= 1) { demo = null; nextDemo = t + 3.2 + Math.random() * 1.6; }
    }
    var r2 = r * r;
    for (var w = waves.length - 1; w >= 0; w--) { waves[w].age++; if (waves[w].age > WAVE_LIFE) waves.splice(w, 1); }
    var wc = waves.length, energy = 0, anyPend = 0;

    for (var i = 0; i < N; i++) {
      var x = px[i], y = py[i], ux = vx[i], uy = vy[i], s = seed[i], k = SPRING;
      var ph = t - sw[i];
      if (pend[i]) {
        anyPend = 1;
        if (ph >= 0) { hx[i] = tx[i]; hy[i] = ty[i]; cur[i] = nxt[i]; pend[i] = 0; }
      }
      if (ph >= 0 && ph < TURB_TIME) {
        var q = smooth(0, TURB_TIME, ph), turb = (1 - q) * 0.9;
        k = 0.012 + (SPRING - 0.012) * q;
        ux += Math.sin(y * 0.012 + t * 2.3 + s * 9.1) * turb;
        uy += Math.cos(x * 0.011 + t * 1.9 + s * 7.3) * turb;
        anyPend = 1;
      }
      ux += (hx[i] - x) * k;
      uy += (hy[i] - y) * k;
      var dx = x - mx, dy = y - my, d2 = dx * dx + dy * dy;
      if (d2 < r2) {
        var dd = Math.sqrt(d2) + 0.0001, f = 1 - dd / r, f2 = f * f;
        ux += (dx / dd) * f2 * push + mvx * f2 * DRAG;
        uy += (dy / dd) * f2 * push + mvy * f2 * DRAG;
      }
      for (var wv = 0; wv < wc; wv++) {
        var W0 = waves[wv], wx = x - W0.x, wy = y - W0.y, wd = Math.sqrt(wx * wx + wy * wy) + 0.0001;
        var band = Math.abs(wd - W0.age * WAVE_SPEED);
        if (band < WAVE_W) {
          var life = 1 - W0.age / WAVE_LIFE, ff = (1 - band / WAVE_W) * life * life * 2.4;
          ux += (wx / wd) * ff; uy += (wy / wd) * ff;
        }
      }
      ux *= FRICTION; uy *= FRICTION;
      px[i] = x + ux; py[i] = y + uy; vx[i] = ux; vy[i] = uy;
      energy += (ux < 0 ? -ux : ux) + (uy < 0 ? -uy : uy);
    }
    sleeping = !ptr.on && !demo && wc === 0 && !anyPend && energy < N * 0.004;
  }

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, cv.width, cv.height);
    var cwid = cv.width, chei = cv.height;
    for (var q = 0; q < sils.length; q++) {
      if (sils[q].a < 0.01) continue;
      ctx.globalAlpha = sils[q].a * 0.62;
      ctx.drawImage(sils[q].c, Math.round(sils[q].x * dpr), Math.round(sils[q].y * dpr));
    }
    ctx.globalAlpha = 1;
    var ga = 1;
    for (var i = 0; i < N; i++) {
      var S = spr[cur[i]];
      var dx = px[i] * dpr - S.sw / 2, dy = py[i] * dpr - S.sh / 2;
      if (dx > cwid || dy > chei || dx + S.sw < 0 || dy + S.sh < 0) continue;
      var ox = px[i] - hx[i], oy = py[i] - hy[i], o2 = ox * ox + oy * oy;
      var al = o2 < 144 ? 1 : Math.max(0.3, 1 - (Math.sqrt(o2) - 12) / 170);
      if (al !== ga) { ctx.globalAlpha = al; ga = al; }
      ctx.drawImage(atlas, S.sx, S.sy, S.sw, S.sh, Math.round(dx), Math.round(dy), S.sw, S.sh);
    }
    ctx.globalAlpha = 1;
  }

  function tick(dt) {
    if (!built || !visible) return;
    if (reduce) { for (var z = 0; z < sils.length; z++) sils[z].a = z === stage ? 1 : 0; if (dirtyDraw) { draw(); dirtyDraw = false; } return; }
    var silMoving = false;
    for (var z2 = 0; z2 < sils.length; z2++) {
      var goal = z2 === stage ? 1 : 0, sa = sils[z2].a;
      if (Math.abs(goal - sa) > 0.005) { sils[z2].a = sa + (goal - sa) * (1 - Math.exp(-dt * 3.2)); silMoving = true; } else sils[z2].a = goal;
    }
    if (silMoving) sleeping = false;
    if (sleeping && !dirtyDraw) { if (clock > nextDemo || ptr.on || waves.length) sleeping = false; else { clock += dt; return; } }
    acc += dt;
    var n = 0;
    while (acc >= 1 / 60 && n < 3) { step(); acc -= 1 / 60; n++; }
    if (n === 3) acc = 0;
    draw();
    dirtyDraw = false;
  }

  /* 손 입력 — 위치는 스크롤마다 한 번만 읽는다 */
  function readRect() { if (!rectDirty) return; var r = cv.getBoundingClientRect(); rectTop = r.top; rectLeft = r.left; rectDirty = false; }
  function setPtr(cx, cy) {
    readRect();
    var x = cx - rectLeft, y = cy - rectTop;
    if (!ptr.on) { ptr.px = x; ptr.py = y; }
    ptr.x = x; ptr.y = y; ptr.on = true; ptr.lastT = clock; sleeping = false;
  }
  stick.addEventListener('pointermove', function (e) { if (e.pointerType === 'touch' || reduce) return; setPtr(e.clientX, e.clientY); }, { passive: true });
  stick.addEventListener('pointerleave', function (e) { if (e.pointerType !== 'touch') ptr.on = false; }, { passive: true });
  stick.addEventListener('touchstart', function (e) { if (reduce) return; var p = e.touches[0]; setPtr(p.clientX, p.clientY); }, { passive: true });
  stick.addEventListener('touchmove', function (e) { if (reduce) return; var p = e.touches[0]; setPtr(p.clientX, p.clientY); }, { passive: true });
  stick.addEventListener('touchend', function () { ptr.on = false; ptr.lastT = clock; }, { passive: true });
  stick.addEventListener('click', function (e) {
    if (e.target.closest('a,button')) return;
    readRect();
    wave(e.clientX - rectLeft, e.clientY - rectTop);
    ptr.lastT = clock;
  });

  /* 스크롤 → 다음 모양 */
  function measure() {
    var r = hero.getBoundingClientRect();
    heroTop = r.top + window.scrollY;
    heroSpan = Math.max(1, hero.offsetHeight - window.innerHeight);
  }
  function onScroll() {
    rectDirty = true;
    var p = clamp((window.scrollY - heroTop) / heroSpan, 0, 1);
    if (progI) progI.style.transform = 'scaleX(' + (0.333 + p * 0.667).toFixed(4) + ')';
    if (reduce || heroSpan < 80) return;
    setStage(p < 0.3 ? 0 : p < 0.66 ? 1 : 2);
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) dirtyDraw = true; }).observe(stick);
  }

  var rt = 0, lastW = window.innerWidth;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () {
      measure(); rectDirty = true;
      if (window.innerWidth === lastW) return;
      lastW = window.innerWidth;
      build();
    }, 200);
  });

  var fontsReady = document.fonts && document.fonts.load ? Promise.all([
    document.fonts.load('900 100px "Pretendard Variable"', '1%알게믿게'),
    document.fonts.load('700 12px "Pretendard Variable"', TAGS.join('')),
    document.fonts.load('500 12px "Pretendard Variable"', TAGS.join(''))
  ]) : Promise.resolve();
  Promise.race([fontsReady, new Promise(function (r) { setTimeout(r, 2200); })]).catch(function () {}).then(function () {
    measure();
    build();
    onScroll();
    window.HSLoop.add(tick);
  });
})();
