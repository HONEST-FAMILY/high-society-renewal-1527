/* 하이소사이어티 3안 — 공통 동작 (rAF 루프 1개를 여기서 소유하고 halftone.js가 빌려 씀) */
(function () {
  'use strict';
  var d = document, W = window, root = d.documentElement;
  var reduce = W.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = W.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------- 루프 1개 ---------- */
  var tasks = [], running = false, last = 0;
  function kick() { if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); } }
  function frame(t) {
    var dt = Math.min(0.1, (t - last) / 1000); last = t;
    var keep = false;
    for (var i = 0; i < tasks.length; i++) if (tasks[i](dt, t)) keep = true;
    if (keep) requestAnimationFrame(frame); else running = false;
  }
  W.HS = { add: function (fn) { tasks.push(fn); kick(); }, kick: kick, reduce: reduce, fine: fine };

  function $(s, c) { return (c || d).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || d).querySelectorAll(s)); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  /* ---------- 자리 계산(스크롤·리사이즈 때만) ---------- */
  var vh = W.innerHeight, vw = W.innerWidth, sy = W.scrollY;
  var L = {};
  var secIds = ['top', 'about', 'services', 'types', 'before-after', 'portfolio', 'clients', 'contact'];
  var group = { top: 'top', about: 'about', services: 'services', types: 'services', 'before-after': 'services', portfolio: 'portfolio', clients: 'portfolio', contact: 'contact' };
  function pageTop(el) { return el.getBoundingClientRect().top + W.scrollY; }
  function measure() {
    vh = W.innerHeight; vw = W.innerWidth;
    L.secs = secIds.map(function (id) { var el = d.getElementById(id); return { id: id, top: el ? pageTop(el) : 0 }; });
    var q = $('#quote'); L.q = { top: pageTop(q), h: q.offsetHeight };
    var fr = $('.panel:not([hidden]) .frame'); L.fr = fr ? { el: fr, top: pageTop(fr), h: fr.offsetHeight } : null;
    var ba = $('#before-after'); L.ba = { top: pageTop(ba), bot: pageTop(ba) + ba.offsetHeight };
    measureBars();
    measureCar();
    if (W.HS.onMeasure) W.HS.onMeasure();
    dirty = true; kick();
  }
  var mt = 0;
  function remeasureSoon(ms) { clearTimeout(mt); mt = setTimeout(measure, ms || 60); }

  /* ---------- 머리글: 내리면 숨고 올리면 나타남 + 지금 위치 막대 ---------- */
  var hd = $('#hd'), navLinks = $$('.hd-nav a'), hdBar = $('.hd-bar');
  var abLinks = $$('.appbar a[data-ab]'), appbar = $('#appbar');
  var lastY = sy, hdUp = false, cur = '', sheetOpen = false;
  var navPos = {};
  function measureBars() {
    navLinks.forEach(function (a) { navPos[a.dataset.nav] = { x: a.offsetLeft, w: a.offsetWidth }; });
    setNav(cur, true);
  }
  function setNav(g, force) {
    if (g === cur && !force) return; cur = g;
    navLinks.forEach(function (a) { a.setAttribute('aria-current', a.dataset.nav === g ? 'true' : 'false'); });
    var p = navPos[g];
    if (p) { hdBar.style.setProperty('--bx', p.x + 'px'); hdBar.style.setProperty('--bw', (p.w / 100).toFixed(3)); }
    else hdBar.style.setProperty('--bw', '0');
    var idx = { top: 0, about: 0, services: 1, portfolio: 2, contact: 3 }[g] || 0;
    abLinks.forEach(function (a, i) { a.setAttribute('aria-current', i === idx ? 'true' : 'false'); });
    if (appbar) appbar.style.setProperty('--abi', idx);
  }

  /* ---------- 스크롤에 묶인 움직임 3곳: 회사 문장 채움 / 사례 화면 확대 풀림 / 검은 면 번짐 ---------- */
  var words = [];
  (function splitQuote() {
    var q = $('#quote'); if (!q) return;
    var parts = q.textContent.split(' ');
    q.textContent = '';
    parts.forEach(function (w, i) {
      var s = d.createElement('span'); s.className = 'w'; s.textContent = w; q.appendChild(s);
      if (i < parts.length - 1) q.appendChild(d.createTextNode(' '));
      words.push({ el: s, o: -1 });
    });
  })();
  var tint = $('#tint'), tintO = -1, dirty = true;
  function onScrollFrame() {
    if (!dirty) return false; dirty = false;
    var y = W.scrollY;
    // 머리글
    if (!sheetOpen) {
      if (y > lastY + 6 && y > 240) { if (!hdUp) { hdUp = true; hd.classList.add('is-up'); } }
      else if (y < lastY - 6 || y < 120) { if (hdUp) { hdUp = false; hd.classList.remove('is-up'); } }
    }
    lastY = y;
    // 지금 위치
    var g = 'top', mark = y + vh * 0.38;
    for (var i = 0; i < L.secs.length; i++) if (L.secs[i].top <= mark) g = group[L.secs[i].id];
    if (y + vh >= d.documentElement.scrollHeight - 4) g = 'contact';
    setNav(g);
    // 회사 문장 단어 채움
    if (L.q && words.length) {
      var top = L.q.top - y;
      var p = reduce ? 1 : clamp((vh * 0.86 - top) / (vh * 0.42 + L.q.h), 0, 1);
      var n = p * (words.length + 1.2);
      for (var k = 0; k < words.length; k++) {
        var o = 0.16 + 0.84 * clamp(n - k, 0, 1);
        o = Math.round(o * 50) / 50;
        if (o !== words[k].o) { words[k].o = o; words[k].el.style.opacity = o; }
      }
    }
    // 사례 화면 확대 풀림 1.12 → 1
    if (L.fr && !reduce) {
      var ft = L.fr.top - y;
      var pf = clamp((vh - ft) / (vh * 0.62), 0, 1);
      var e = 1 - Math.pow(1 - pf, 3);
      L.fr.el.style.setProperty('--fs', (1.12 - 0.12 * e).toFixed(4));
    }
    // 검은 면 번짐
    if (L.ba) {
      var bt = L.ba.top - y, bb = L.ba.bot - y;
      var p1 = clamp((vh * 0.62 - bt) / (vh * 0.32), 0, 1);
      var p2 = clamp((bb - vh * 0.52) / (vh * 0.3), 0, 1);
      var to = Math.round(Math.min(p1, p2) * 100) / 100;
      if (to !== tintO) { tintO = to; tint.style.opacity = to; }
    }
    // 사례 줄 액자 안 이동
    carFrame();
    return false;
  }
  W.HS.add(onScrollFrame);
  W.addEventListener('scroll', function () { dirty = true; kick(); }, { passive: true });

  var rz = 0;
  W.addEventListener('resize', function () {
    clearTimeout(rz);
    rz = setTimeout(function () {
      if (W.innerWidth === vw && Math.abs(W.innerHeight - vh) < 120) return; // 폭이 같으면 다시 계산 안 함
      measure();
    }, 200);
  });

  /* ---------- 전체 화면 메뉴(폰) ---------- */
  var sheet = $('#sheet'), menuBtn = $('.hd-menu');
  function openSheet(on) {
    sheetOpen = on;
    menuBtn.setAttribute('aria-expanded', on ? 'true' : 'false');
    menuBtn.setAttribute('aria-label', on ? '메뉴 닫기' : '메뉴 열기');
    if (on) { sheet.hidden = false; requestAnimationFrame(function () { sheet.classList.add('is-open'); }); d.body.style.overflow = 'hidden'; hd.classList.remove('is-up'); hdUp = false; }
    else { sheet.classList.remove('is-open'); d.body.style.overflow = ''; setTimeout(function () { if (!sheetOpen) sheet.hidden = true; }, 420); }
  }
  menuBtn.addEventListener('click', function () { openSheet(!sheetOpen); });
  $$('#sheet a').forEach(function (a) { a.addEventListener('click', function () { openSheet(false); }); });
  d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && sheetOpen) openSheet(false); });

  /* ---------- 서비스 탭 ---------- */
  var tabs = $$('.tab'), tabBar = $('.tab-bar'), panels = $$('.panel');
  function moveTabBar() {
    var t = $('.tab[aria-selected="true"]'); if (!t) return;
    tabBar.style.setProperty('--bx', t.offsetLeft + 'px');
    tabBar.style.setProperty('--bw', (t.offsetWidth / 100).toFixed(3));
  }
  function selectTab(key, focus) {
    tabs.forEach(function (t) {
      var on = t.dataset.tab === key;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    });
    panels.forEach(function (p) {
      var on = p.dataset.panel === key;
      if (on && p.hidden) { p.hidden = false; p.classList.remove('is-enter'); void p.offsetWidth; if (!reduce) p.classList.add('is-enter'); }
      else if (!on) p.hidden = true;
    });
    moveTabBar();
    remeasureSoon(30);
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { selectTab(t.dataset.tab); });
    t.addEventListener('keydown', function (e) {
      var k = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!k) return; e.preventDefault();
      selectTab(tabs[(i + k + tabs.length) % tabs.length].dataset.tab, true);
    });
  });
  $$('[data-tab-go]').forEach(function (a) { a.addEventListener('click', function () { selectTab(a.dataset.tabGo); }); });

  /* 바이럴 채널: 올리면(폰은 누르면) 오른쪽 화면이 그 채널의 실제 집행 화면으로 바뀜 */
  $$('[data-swap]').forEach(function (list) {
    var panel = list.closest('.panel'), frame = $('.frame', panel), base = $('img', frame), now = $('.frame-now', panel);
    base.classList.add('base');
    var alt = d.createElement('img'); alt.className = 'alt'; alt.alt = ''; alt.decoding = 'async'; frame.appendChild(alt);
    var baseText = now.textContent, pressed = null;
    var btns = $$('button', list);
    function show(b) {
      if (!b) { frame.classList.remove('show-alt'); now.textContent = baseText; return; }
      if (alt.getAttribute('src') !== b.dataset.img) alt.src = b.dataset.img;
      alt.alt = b.dataset.alt; frame.classList.add('show-alt'); now.textContent = $('b', b).textContent;
    }
    btns.forEach(function (b) {
      b.setAttribute('aria-pressed', 'false');
      if (fine) b.addEventListener('mouseenter', function () { show(b); });
      b.addEventListener('click', function () {
        var on = pressed !== b; pressed = on ? b : null;
        btns.forEach(function (x) { x.setAttribute('aria-pressed', x === pressed ? 'true' : 'false'); });
        show(pressed);
      });
    });
    if (fine) list.addEventListener('mouseleave', function () { show(pressed); });
    // 미리 받아 두기
    btns.forEach(function (b) { var im = new Image(); im.src = b.dataset.img; });
  });

  /* ---------- 펼치기 목록 ---------- */
  $$('.acc button').forEach(function (b) {
    b.addEventListener('click', function () {
      var li = b.parentElement, on = !li.classList.contains('open');
      li.classList.toggle('open', on); b.setAttribute('aria-expanded', on ? 'true' : 'false');
      remeasureSoon(480);
    });
  });

  /* ---------- 나타나기(한 번 나타나면 다시 숨지 않음) ---------- */
  $$('[data-stagger]').forEach(function (g) { Array.prototype.forEach.call(g.children, function (c, i) { c.style.setProperty('--i', i); }); });
  $$('.ba-list li').forEach(function (li, i) { var s = $('s', li); if (s) s.style.setProperty('--i', i); });
  var revealEls = $$('.rv, .sec-t, [data-stagger], #baList');
  if ('IntersectionObserver' in W && !reduce) {
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else revealEls.forEach(function (el) { el.classList.add('in'); });
  requestAnimationFrame(function () { $('.hero-t').classList.add('in'); $$('.hero .rv').forEach(function (el) { el.classList.add('in'); }); });

  /* ---------- 사례 줄: 버튼 넘기기 · 액자 안 이동 · '크게 보기' 꼬리표 · 크게 보기 상자 ---------- */
  var car = $('#car'), cards = $$('.card', car), cardPos = [], carW = 0, carDirty = true;
  function measureCar() {
    carW = car.clientWidth;
    cardPos = cards.map(function (c) { return { x: c.offsetLeft, w: c.offsetWidth, img: $('.card-img img', c), v: 99 }; });
    carDirty = true;
  }
  function carFrame() {
    if (!carDirty || reduce) return; carDirty = false;
    var sl = car.scrollLeft;
    for (var i = 0; i < cardPos.length; i++) {
      var c = cardPos[i];
      var off = (c.x - sl + c.w / 2) - carW / 2;
      var px = Math.round(clamp(-off * 0.035, -14, 14) * 10) / 10;
      if (px !== c.v) { c.v = px; c.img.style.setProperty('--px', px + 'px'); }
    }
  }
  car.addEventListener('scroll', function () { carDirty = true; dirty = true; kick(); }, { passive: true });
  $$('[data-car]').forEach(function (b) {
    b.addEventListener('click', function () {
      var step = (cardPos[0] ? cardPos[0].w : 320) + 24;
      car.scrollBy({ left: step * +b.dataset.car * (vw > 1100 ? 2 : 1), behavior: reduce ? 'auto' : 'smooth' });
    });
  });
  var peek = $('#peek');
  if (fine) {
    var pk = { x: -200, y: -200, tx: -200, ty: -200, on: false };
    car.addEventListener('pointerenter', function (e) { pk.on = true; pk.x = pk.tx = e.clientX; pk.y = pk.ty = e.clientY; peek.classList.add('on'); W.HS.kick(); });
    car.addEventListener('pointerleave', function () { pk.on = false; peek.classList.remove('on'); });
    car.addEventListener('pointermove', function (e) { pk.tx = e.clientX; pk.ty = e.clientY; W.HS.kick(); }, { passive: true });
    W.HS.add(function (dt) {
      if (!pk.on) return false;
      var a = 1 - Math.exp(-dt * 18);
      pk.x += (pk.tx - pk.x) * a; pk.y += (pk.ty - pk.y) * a;
      peek.style.setProperty('--x', (pk.x + 14).toFixed(1) + 'px');
      peek.style.setProperty('--y', (pk.y + 14).toFixed(1) + 'px');
      return Math.abs(pk.tx - pk.x) + Math.abs(pk.ty - pk.y) > 0.3;
    });
  }
  var lb = $('#lb'), lbImg = $('#lbImg');
  $$('.card-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      lbImg.src = b.dataset.full; lbImg.alt = $('img', b).alt;
      if (lb.showModal) lb.showModal(); else lb.setAttribute('open', '');
    });
  });
  $('#lbX').addEventListener('click', function () { lb.close(); });
  lb.addEventListener('click', function (e) { if (e.target === lb) lb.close(); });

  /* ---------- 문의: 화면 안에서만 '접수되었습니다' ---------- */
  var form = $('#form'), err = $('#fErr'), done = $('#fDone');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var bad = [];
    ['name', 'phone', 'msg'].forEach(function (n) {
      var f = form.elements[n], ok = f.value.trim().length > 0;
      f.closest('.fld').classList.toggle('bad', !ok); if (!ok) bad.push(f);
    });
    var agree = form.elements.agree;
    if (!agree.checked) bad.push(agree);
    if (bad.length) {
      err.textContent = !agree.checked && bad.length === 1 ? '개인정보 수집·이용 동의에 체크해 주세요.' : '이름, 연락처, 문의 내용과 동의 체크를 확인해 주세요.';
      bad[0].focus(); return;
    }
    err.textContent = ''; done.hidden = false; done.focus();
  });
  $('#fAgain').addEventListener('click', function () { form.reset(); done.hidden = true; $$('.fld.bad', form).forEach(function (f) { f.classList.remove('bad'); }); });

  /* 해시태그는 '#'과 글자 사이에서 줄바꿈되지 않게 */
  $$('.tags, .card-tags, .card-t, .quick span, .frame-now').forEach(function (el) {
    if (el.children.length || el.textContent.indexOf('#') < 0) return;
    el.innerHTML = el.textContent.replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }).replace(/#[^\s#]+/g, '<span class="ht">$&</span>');
  });

  /* ---------- 시작 ---------- */
  measure();
  W.addEventListener('load', measure);
  if (d.fonts && d.fonts.ready) d.fonts.ready.then(function () { measure(); moveTabBar(); });
  moveTabBar();
  W.__hsReady = true;
})();
