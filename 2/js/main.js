/* 하이소사이어티 2안 — 페이지 움직임. 위치는 스크롤·리사이즈 때만 계산하고, 프레임마다 읽지 않는다. */
(function () {
  'use strict';
  window.__hsReady = true;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = matchMedia('(hover:hover) and (pointer:fine)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function absTop(el) { return el.getBoundingClientRect().top + window.scrollY; }
  var loop = window.HSLoop || { add: function (f) { (function fr(t) { f(1 / 60, t); requestAnimationFrame(fr); })(0); } };

  /* ---------- 리빌: 화면에 12%만 들어와도 시작, 한 번 나온 건 다시 숨지 않는다 ---------- */
  $$('[data-rv-group]').forEach(function (g) { $$(':scope > *', g).forEach(function (c, i) { c.style.setProperty('--i', i); }); });
  var rvEls = $$('[data-rv],[data-rv-group],[data-line]');
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    rvEls.forEach(function (el) { io.observe(el); });
  } else rvEls.forEach(function (el) { el.classList.add('in'); });

  /* ---------- 회사소개 문장: 스크롤만큼 글자 색이 채워진다 ---------- */
  var st = $('.about-st');
  var words = [];
  if (st) {
    var nodes = Array.prototype.slice.call(st.childNodes);
    nodes.forEach(function (n) {
      if (n.nodeType === 3) {
        var frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(function (p) {
          if (!p) return;
          if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(p)); return; }
          var s = document.createElement('span'); s.className = 'w'; s.textContent = p; frag.appendChild(s); words.push(s);
        });
        st.replaceChild(frag, n);
      } else if (n.nodeType === 1) { n.classList.add('w'); words.push(n); }
    });
  }

  /* ---------- 캐시 ---------- */
  var vh = window.innerHeight, vw = window.innerWidth;
  var hd = $('#hd');
  var navLinks = $$('.hd-nav a'), bar = $('.hd-bar');
  var abLinks = $$('.appbar a[data-ab]'), abOn = $('.appbar-on');
  var navIds = ['about', 'service', 'portfolio', 'contact'];
  var abIds = ['top', 'service', 'portfolio', 'contact'];
  var secTop = {};
  var linkBox = [];
  var stTop = 0, stH = 1;
  var zooms = $$('[data-z]').map(function (img) { return { el: img, fr: img.parentElement, top: 0, h: 1, last: -1 }; });
  var proc = $('.proc'), procNum = $('.proc-num-in'), procProg = $('.proc-prog');
  var procLists = $$('.proc-list');
  var procTop = 0, procSpan = 1, procPinned = false, procK = -1;
  var baRows = $$('.ba-row').map(function (r) { return { el: r, top: 0, last: -1 }; });

  function measure() {
    vh = window.innerHeight; vw = window.innerWidth;
    ['top'].concat(navIds).forEach(function (id) { var el = document.getElementById(id); if (el) secTop[id] = absTop(el); });
    var navBox = bar ? bar.parentElement.getBoundingClientRect() : null;
    linkBox = navLinks.map(function (a) { var r = a.getBoundingClientRect(); return { x: r.left - (navBox ? navBox.left : 0) + 14, w: r.width - 28 }; });
    if (st) { stTop = absTop(st); stH = st.offsetHeight; }
    zooms.forEach(function (z) { z.top = absTop(z.fr); z.h = z.fr.offsetHeight || 1; });
    if (proc) { procTop = absTop(proc); procSpan = Math.max(1, proc.offsetHeight - vh); procPinned = getComputedStyle($('.proc-stick')).position === 'sticky'; }
    baRows.forEach(function (b) { b.top = absTop(b.el); });
    need = true;
  }

  /* ---------- 머리글: 내리면 숨고 올리면 나타남 + 지금 위치 표시 ---------- */
  var lastY = window.scrollY, curNav = -2, curAb = -2;
  function header(y) {
    if (!document.body.classList.contains('menu-open')) {
      if (y > 160 && y > lastY + 4) hd.classList.add('is-hidden');
      else if (y < lastY - 4 || y < 160) hd.classList.remove('is-hidden');
    }
    hd.classList.toggle('is-scrolled', y > 8);
    lastY = y;
    var probe = y + vh * 0.4, n = -1, a = 0;
    navIds.forEach(function (id, i) { if (secTop[id] !== undefined && probe >= secTop[id]) n = i; });
    abIds.forEach(function (id, i) { if (secTop[id] !== undefined && probe >= secTop[id]) a = i; });
    if (n !== curNav) {
      curNav = n;
      navLinks.forEach(function (l, i) { l.classList.toggle('is-on', i === n); });
      if (bar) bar.style.transform = n < 0 ? 'translateX(' + (linkBox[0] ? linkBox[0].x : 0) + 'px) scaleX(0)' : 'translateX(' + linkBox[n].x + 'px) scaleX(' + (linkBox[n].w / 100).toFixed(3) + ')';
    }
    if (a !== curAb) {
      curAb = a;
      abLinks.forEach(function (l, i) { l.classList.toggle('is-on', i === a); if (i === a) l.setAttribute('aria-current', 'true'); else l.removeAttribute('aria-current'); });
      if (abOn) abOn.style.setProperty('--ab', a);
    }
  }

  /* ---------- 스크롤에 묶인 움직임 (회사소개 글자 채움 / 사진 확대 풀림 / 순서 무대 / 비포→애프터 줄긋기) ---------- */
  function scrollFx(y) {
    if (words.length && !reduce) {
      var p = clamp((y + vh * 0.82 - stTop) / (stH + vh * 0.35), 0, 1), n = words.length;
      for (var i = 0; i < n; i++) {
        var o = 0.16 + 0.84 * clamp(p * (n + 3) - i, 0, 1);
        if (words[i]._o !== o) { words[i]._o = o; words[i].style.setProperty('--o', o.toFixed(3)); }
      }
    }
    if (!reduce) zooms.forEach(function (z) {
      var q = (y + vh - z.top) / (vh + z.h);
      if (q < -0.05 || q > 1.05) return;
      var e = clamp(q / 0.62, 0, 1);
      e = 1 - Math.pow(1 - e, 3);
      var s = +(1.12 - 0.12 * e).toFixed(4);
      if (s !== z.last) { z.last = s; z.el.style.setProperty('--z', s); }
    });
    if (proc && procPinned) {
      var pp = clamp((y - procTop) / procSpan, 0, 1);
      procProg.style.setProperty('--p', pp.toFixed(4));
      setStep(Math.min(3, Math.floor(pp * 4)));
    }
    baRows.forEach(function (b) {
      var q = clamp((y + vh * 0.86 - b.top) / (vh * 0.3), 0, 1);
      if (reduce) q = 1;
      var r = Math.round(q * 100) / 100;
      if (r !== b.last) { b.last = r; b.el.style.setProperty('--s', r); b.el.style.setProperty('--a', (0.32 + 0.68 * r).toFixed(3)); }
    });
  }
  function setStep(k) {
    if (k === procK) return;
    procK = k;
    if (procNum) procNum.style.setProperty('--k', k);
    procLists.forEach(function (ol) { $$('li', ol).forEach(function (li, i) { li.classList.toggle('is-on', i === k); }); });
  }
  $$('.proc-list button').forEach(function (b) {
    b.addEventListener('click', function () {
      var k = +b.getAttribute('data-step');
      if (procPinned) window.scrollTo({ top: procTop + procSpan * ((k + 0.5) / 4), behavior: reduce ? 'auto' : 'smooth' });
      else setStep(k);
    });
  });

  var need = true;
  window.addEventListener('scroll', function () { need = true; }, { passive: true });

  /* ---------- 사례: 커서 옆 '크게 보기' 꼬리표 (마우스에서만) ---------- */
  var cur = $('.case-cursor'), cx = 0, cy = 0, tx = 0, ty = 0, cOn = false;
  if (fine && cur) {
    $$('.case-fr').forEach(function (f) {
      f.addEventListener('pointerenter', function (e) { cOn = true; tx = cx = e.clientX; ty = cy = e.clientY; cur.classList.add('on'); });
      f.addEventListener('pointerleave', function () { cOn = false; cur.classList.remove('on'); });
      f.addEventListener('pointermove', function (e) { tx = e.clientX; ty = e.clientY; }, { passive: true });
    });
  }

  loop.add(function (dt) {
    if (need) { need = false; var y = window.scrollY; header(y); scrollFx(y); }
    if (cOn) {
      var k = 1 - Math.exp(-dt * 18);
      cx += (tx - cx) * k; cy += (ty - cy) * k;
      cur.style.transform = 'translate3d(' + (cx + 16).toFixed(1) + 'px,' + (cy + 16).toFixed(1) + 'px,0)';
    }
  });

  /* ---------- 사례 원본 크게 보기 ---------- */
  var lb = $('.lb');
  $$('.case-fr').forEach(function (f) {
    f.addEventListener('click', function () {
      if (!lb || !lb.showModal) { window.open(f.getAttribute('data-full'), '_blank'); return; }
      var im = $('img', lb); im.src = f.getAttribute('data-full'); im.alt = $('img', f).alt;
      lb.showModal();
    });
  });
  if (lb) {
    $('.lb-x', lb).addEventListener('click', function () { lb.close(); });
    lb.addEventListener('click', function (e) { if (e.target === lb) lb.close(); });
  }

  /* ---------- 서비스 사진: 누르면 실제 화면으로 바뀜(폰), 마우스는 올리면 ---------- */
  $$('.svc-ph').forEach(function (b) { b.addEventListener('click', function () { b.classList.toggle('alt'); }); });

  /* ---------- 비포·애프터: 폰은 누름 반응 ---------- */
  if (!fine) baRows.forEach(function (b) { b.el.addEventListener('click', function () { b.el.classList.toggle('tap'); }); });

  /* ---------- 폰 전체 화면 메뉴 ---------- */
  var mb = $('.hd-menu'), sheet = $('#sheet');
  function menu(open) {
    sheet.classList.toggle('is-open', open);
    document.body.classList.toggle('menu-open', open);
    mb.setAttribute('aria-expanded', open ? 'true' : 'false');
    $('.hd-menu-t').textContent = open ? '닫기' : '메뉴';
    hd.classList.remove('is-hidden');
  }
  if (mb && sheet) {
    mb.addEventListener('click', function () { menu(!sheet.classList.contains('is-open')); });
    $$('a', sheet).forEach(function (a) { a.addEventListener('click', function () { menu(false); }); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && sheet.classList.contains('is-open')) menu(false); });
  }

  /* ---------- 문의: 화면 안에서만 '접수되었습니다' (어디에도 보내지 않음) ---------- */
  var form = $('.ct-form');
  if (form) {
    var err = $('.ct-err', form);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var miss = [];
      [['name', '이름'], ['phone', '연락처'], ['email', '이메일'], ['msg', '문의 내용']].forEach(function (f) { if (!form.elements[f[0]].value.trim()) miss.push(f[1]); });
      if (form.elements.email.value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.elements.email.value.trim())) miss.push('이메일 형식');
      if (!form.elements.agree.checked) miss.push('개인정보 수집 동의');
      if (miss.length) { err.textContent = miss.join(', ') + '을(를) 확인해 주세요.'; return; }
      err.textContent = '';
      form.classList.add('sent');
      $('.ct-done', form).focus({ preventScroll: true });
    });
    $('.ct-again', form).addEventListener('click', function () { form.reset(); form.classList.remove('sent'); });
  }

  /* ---------- 리사이즈: 200ms 디바운스, 폭이 같으면 높이만 다시 ---------- */
  var rt = 0;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(measure, 200); });
  measure();
  window.addEventListener('load', measure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  if ('ResizeObserver' in window) { var ro = new ResizeObserver(function () { clearTimeout(rt); rt = setTimeout(measure, 200); }); ro.observe(document.body); }
})();
