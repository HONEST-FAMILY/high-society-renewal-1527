(function () {
  'use strict';
  window.__hsReady = true;
  var doc = document.documentElement;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = matchMedia('(hover:hover) and (pointer:fine)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- 대표 장면: 수면 ---------- */
  var hero = $('#top'), water = null;
  if (!reduce && window.HSWater) {
    try { water = window.HSWater.create({ host: hero, canvas: $('.hero__gl'), img: $('.hero__img') }); } catch (e) { water = null; }
  }
  window.__hsWater = water;

  /* ---------- 등장 (화면에 12% 들어오면, 한 번만) ---------- */
  $$('.rv-group').forEach(function (g) { Array.prototype.forEach.call(g.children, function (c, i) { c.style.setProperty('--i', Math.min(i, 6)); }); });
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.12, rootMargin: '0px 0px -4% 0px' });
  $$('.rv-mask,.rv-fade,.rv-group').forEach(function (el) { io.observe(el); });
  // 첫 화면 제목은 바로
  requestAnimationFrame(function () { $$('.hero .rv-mask,.hero .rv-fade').forEach(function (el) { el.classList.add('in'); }); });

  /* ---------- 회사소개 문장: 스크롤만큼 글자가 채워짐 ---------- */
  var lead = $('[data-fill]'), words = [];
  if (lead) {
    var txt = lead.textContent.trim().split(/\s+/);
    lead.innerHTML = txt.map(function (w) { return '<span class="w">' + w + '</span>'; }).join(' ');
    words = $$('.w', lead);
  }
  var filled = -1;

  /* ---------- 측정(스크롤·리사이즈 때만) ---------- */
  var hd = $('#hd'), navBar = $('.hd__bar'), navLinks = $$('.hd__nav a'), abLinks = $$('.appbar a[data-ab]'), ab = $('.appbar');
  var M = { vh: innerHeight, heroH: 0, secs: [], zooms: [], rows: [], lead: null, links: [] };
  var zoomEls = $$('[data-zoom]'), baRows = $$('.ba__row');
  function top(el) { var r = el.getBoundingClientRect(); return r.top + scrollY; }
  function measure() {
    M.vh = innerHeight;
    M.heroH = hero.offsetHeight;
    M.secs = ['top', 'about', 'service', 'portfolio', 'contact'].map(function (id) { var el = document.getElementById(id); return { id: id, top: top(el) }; });
    M.zooms = zoomEls.map(function (el) { var f = el.parentNode; return { el: el, top: top(f), h: f.offsetHeight }; });
    M.rows = baRows.map(function (el, i) { return { el: el, top: top(el), h: el.offsetHeight, i: i }; });
    if (lead) M.lead = { top: top(lead), h: lead.offsetHeight };
    var nr = navBar.parentNode.getBoundingClientRect();
    M.links = navLinks.map(function (a) { var r = a.getBoundingClientRect(); return { x: r.left - nr.left, w: r.width, id: a.dataset.nav }; });
    if (water) water.resize();
    dirty = true;
  }

  /* ---------- 스크롤 반영 (rAF 안에서) ---------- */
  var lastY = scrollY, dirty = true, active = '';
  function onScroll() {
    var y = scrollY, vh = M.vh;
    // 머리글: 내리면 숨고 올리면 나타남
    var dy = y - lastY;
    if (!doc.classList.contains('menu-open')) {
      if (dy > 6 && y > 140) hd.classList.add('is-hide');
      else if (dy < -6 || y < 140) hd.classList.remove('is-hide');
    }
    hd.classList.toggle('is-over', y < M.heroH - 70);
    lastY = y;
    // 지금 위치
    var cur = 'top';
    for (var i = 0; i < M.secs.length; i++) if (y + vh * 0.4 >= M.secs[i].top) cur = M.secs[i].id;
    if (cur !== active) {
      active = cur;
      var hit = null;
      M.links.forEach(function (l, k) { var on = l.id === cur; navLinks[k].classList.toggle('on', on); if (on) hit = l; });
      if (hit) { navBar.style.opacity = 1; navBar.style.transform = 'translateX(' + hit.x + 'px) scaleX(' + (hit.w / 100) + ')'; }
      else navBar.style.opacity = 0;
      var idx = 0;
      abLinks.forEach(function (a, k) { var on = a.dataset.ab === cur; a.classList.toggle('on', on); if (on) idx = k; });
      if (ab) ab.style.setProperty('--ab', idx);
    }
    if (reduce) return;
    // 회사소개 글자 채움
    if (M.lead && words.length) {
      var p = (y + vh * 0.78 - M.lead.top) / (M.lead.h + vh * 0.3);
      var n = Math.round(Math.max(0, Math.min(1, p)) * words.length);
      if (n > filled) { words.forEach(function (w, k) { if (k < n) w.classList.add('on'); }); filled = n; } // 한 번 채운 글자는 다시 옅어지지 않음
    }
    // 사진: 스크롤에 묶인 확대 풀림 1.12 → 1
    M.zooms.forEach(function (z) {
      if (y + vh < z.top - 50 || y > z.top + z.h + 50) return;
      var q = (y + vh - z.top) / (vh + z.h * 0.25);
      q = Math.max(0, Math.min(1, q));
      z.el.style.transform = 'scale(' + (1.12 - 0.12 * q).toFixed(4) + ')';
    });
    // 비포·애프터: BEFORE 줄이 그어지고 AFTER가 진해짐
    M.rows.forEach(function (r) {
      if (y + vh < r.top - 40 || y > r.top + r.h) return;
      var q = (y + vh * 0.82 - r.top) / (vh * 0.26);
      q = Math.max(baMax[r.i] || 0, Math.min(1, q));
      if (q > (baMax[r.i] || 0)) { baMax[r.i] = q; r.el.style.setProperty('--p', q.toFixed(3)); }
    });
  }
  var baMax = [];
  if (!reduce) baRows.forEach(function (r) { r.style.setProperty('--p', 0); });
  addEventListener('scroll', function () { dirty = true; }, { passive: true });

  /* ---------- 커서 꼬리표 '크게 보기' ---------- */
  var cur = $('.cur'), cx = -100, cy = -100, tx = -100, ty = -100, curOn = false;
  if (fine && cur) {
    $$('.case__btn').forEach(function (b) {
      b.addEventListener('pointerenter', function (e) { curOn = true; cx = tx = e.clientX; cy = ty = e.clientY; cur.classList.add('on'); });
      b.addEventListener('pointerleave', function () { curOn = false; cur.classList.remove('on'); });
      b.addEventListener('pointermove', function (e) { tx = e.clientX; ty = e.clientY; }, { passive: true });
    });
  }

  /* ---------- rAF 루프 1개 ---------- */
  var prev = performance.now();
  function loop(now) {
    var dt = Math.min((now - prev) / 1000, 0.1); prev = now;
    if (water) water.frame(dt, now);
    if (dirty) { dirty = false; onScroll(); }
    if (curOn) {
      var k = 1 - Math.exp(-dt * 18);
      cx += (tx - cx) * k; cy += (ty - cy) * k;
      cur.style.transform = 'translate3d(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px,0)';
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  /* ---------- 리사이즈: 200ms 디바운스, 폭이 같으면 다시 안 잼 ---------- */
  var rw = innerWidth, rt = 0;
  addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () { if (innerWidth === rw) return; rw = innerWidth; measure(); }, 200);
  });
  measure();
  addEventListener('load', measure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);

  /* ---------- 폰 전체 메뉴 ---------- */
  var menuBtn = $('.hd__menu'), mnav = $('#mnav');
  function setMenu(open) {
    doc.classList.toggle('menu-open', open);
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    menuBtn.setAttribute('aria-label', open ? '전체 메뉴 닫기' : '전체 메뉴 열기');
    mnav.setAttribute('aria-hidden', open ? 'false' : 'true');
  }
  menuBtn.addEventListener('click', function () { setMenu(!doc.classList.contains('menu-open')); });
  $$('#mnav a').forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });

  /* ---------- 폰: 표 행은 누르면 바탕이 채워짐 ---------- */
  if (!fine) {
    $$('.rows li').forEach(function (li) {
      li.addEventListener('click', function () {
        var on = !li.classList.contains('tap');
        $$('.rows li.tap').forEach(function (x) { x.classList.remove('tap'); });
        if (on) li.classList.add('tap');
      });
    });
  }

  /* ---------- 사례 크게 보기 ---------- */
  var lb = $('#lb'), lbImg = $('#lbImg');
  $$('.case__btn').forEach(function (b) {
    b.addEventListener('click', function () {
      lbImg.src = b.dataset.full; lbImg.alt = b.querySelector('img').alt;
      if (lb.showModal) lb.showModal(); else lb.setAttribute('open', '');
    });
  });
  $('.lb__x').addEventListener('click', function () { lb.close(); });
  lb.addEventListener('click', function (e) { if (e.target === lb) lb.close(); });

  /* ---------- 문의: 화면 안에서만 접수 표시 ---------- */
  var form = $('#form');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = form.elements; var ok = f.namedItem('name').value.trim() && f.namedItem('phone').value.trim() && f.namedItem('msg').value.trim() && f.namedItem('agree').checked;
    var err = $('.form__err', form);
    if (!ok) { err.hidden = false; return; }
    err.hidden = true;
    $('.form__body', form).hidden = true;
    $('.form__done', form).hidden = false;
  });
})();
