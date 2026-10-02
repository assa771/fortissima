// header shadow on scroll
const header = document.getElementById('siteHeader');
if (header) {
  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 20);
  });
}

// scroll reveal
const revealEls = document.querySelectorAll('.reveal');
const io = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      io.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });
revealEls.forEach(el => io.observe(el));

// color finish swatch picker
function selectFinish(btn, imgId) {
  const img = document.getElementById(imgId);
  if (img) img.src = btn.getAttribute('data-img');
  const name = btn.getAttribute('data-name');
  const wrap = document.querySelector('.color-picker');
  if (wrap) {
    wrap.querySelectorAll('.swatch').forEach(s => {
      s.classList.toggle('active', s.getAttribute('data-name') === name);
    });
    const nameEl = wrap.querySelector('.color-name');
    if (nameEl && name) nameEl.textContent = name;
  }
  updateGalleryThumbs(imgId, name);
}

// rebuild the small thumbnails so they always show the finishes
// that are NOT currently shown in the large preview
function updateGalleryThumbs(imgId, activeName) {
  const mainImg = document.getElementById(imgId);
  const wrap = document.querySelector('.color-picker');
  const thumbsWrap = document.querySelector('.coll-gallery-thumbs');
  if (!mainImg || !wrap || !thumbsWrap) return;

  const baseAlt = (mainImg.getAttribute('alt') || '').replace(/\s*v interiéri\s*$/i, '');
  const swatches = Array.from(wrap.querySelectorAll('.swatch'));

  thumbsWrap.innerHTML = swatches
    .filter(s => s.getAttribute('data-name') !== activeName)
    .map(s => {
      const src = s.getAttribute('data-img');
      const name = s.getAttribute('data-name');
      const alt = baseAlt ? `${baseAlt} — ${name}` : name;
      return `<div class="thumb"><img src="${src}" data-img="${src}" data-name="${name}" alt="${alt}" loading="lazy" onclick="selectFinish(this, '${imgId}')"></div>`;
    })
    .join('');
}

// keep thumbnails in sync with the swatch marked active in the HTML on load
document.querySelectorAll('.color-picker').forEach(wrap => {
  const activeSwatch = wrap.querySelector('.swatch.active') || wrap.querySelector('.swatch');
  if (!activeSwatch) return;
  const imgId = activeSwatch.getAttribute('onclick')?.match(/selectFinish\(this,\s*'([^']+)'\)/)?.[1];
  if (imgId) updateGalleryThumbs(imgId, activeSwatch.getAttribute('data-name'));
});

// ===== galéria „V interiéri“: posun, ťahanie myšou, zväčšenie =====
(function () {
  const carousel = document.querySelector('.scene-carousel');
  if (!carousel) return;
  const track = carousel.querySelector('.sc-track');
  const items = Array.from(track.querySelectorAll('.sc-item'));
  const prev = carousel.querySelector('.sc-prev');
  const next = carousel.querySelector('.sc-next');
  const bar = carousel.querySelector('.sc-progress span');

  // šípky — posun o jeden obrázok
  const step = dir => {
    const x = track.scrollLeft;
    const lefts = items.map(it => it.offsetLeft - track.offsetLeft);
    const target = dir > 0 ? lefts.find(l => l > x + 5) : [...lefts].reverse().find(l => l < x - 5);
    track.scrollTo({ left: target ?? (dir > 0 ? track.scrollWidth : 0), behavior: 'smooth' });
  };
  prev.addEventListener('click', () => step(-1));
  next.addEventListener('click', () => step(1));

  // indikátor polohy
  const update = () => {
    const max = track.scrollWidth - track.clientWidth;
    const ratio = track.clientWidth / track.scrollWidth;
    const p = max > 0 ? track.scrollLeft / max : 0;
    bar.style.width = (ratio * 100) + '%';
    bar.style.transform = `translateX(${p * (1 / ratio - 1) * 100}%)`;
    prev.disabled = track.scrollLeft < 5;
    next.disabled = track.scrollLeft > max - 5;
  };
  track.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  items.forEach(it => it.querySelector('img').addEventListener('load', update));
  update();

  // ťahanie myšou (na dotykových zariadeniach funguje prirodzený posun)
  let down = false, startX = 0, startLeft = 0, moved = 0;
  track.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse') return;
    down = true; moved = 0; startX = e.clientX; startLeft = track.scrollLeft;
  });
  window.addEventListener('pointermove', e => {
    if (!down) return;
    const dx = e.clientX - startX;
    moved = Math.max(moved, Math.abs(dx));
    if (moved > 5) track.classList.add('is-dragging');
    track.scrollLeft = startLeft - dx;
  });
  window.addEventListener('pointerup', () => {
    if (!down) return;
    down = false;
    if (track.classList.contains('is-dragging')) {
      track.classList.remove('is-dragging');
      // po ťahaní jemne dosadne na najbližší obrázok
      const lefts = items.map(it => it.offsetLeft - track.offsetLeft);
      const nearest = lefts.reduce((a, b) => Math.abs(b - track.scrollLeft) < Math.abs(a - track.scrollLeft) ? b : a);
      track.scrollTo({ left: nearest, behavior: 'smooth' });
    }
  });

  // ===== lightbox =====
  const lb = document.querySelector('.lightbox');
  if (!lb) return;
  const lbImg = lb.querySelector('.lb-stage img');
  const lbCap = lb.querySelector('.lb-caption');
  const lbCount = lb.querySelector('.lb-count');
  let idx = 0;

  const show = (i, dir = 0) => {
    idx = (i + items.length) % items.length;
    const img = items[idx].querySelector('img');
    const cap = items[idx].querySelector('figcaption');
    const apply = () => {
      lbImg.src = img.currentSrc || img.src;
      lbImg.alt = img.alt;
      lbCap.textContent = cap ? cap.textContent : '';
      lbCount.textContent = `${String(idx + 1).padStart(2, '0')} / ${String(items.length).padStart(2, '0')}`;
      requestAnimationFrame(() => { lbImg.style.setProperty('--lb-dir', '0px'); lbImg.classList.remove('is-swapping'); });
    };
    if (dir && lb.classList.contains('is-open')) {
      lbImg.style.setProperty('--lb-dir', (dir * -30) + 'px');
      lbImg.classList.add('is-swapping');
      setTimeout(() => { lbImg.style.setProperty('--lb-dir', (dir * 30) + 'px'); apply(); }, 280);
    } else apply();
  };
  const open = i => {
    show(i);
    lb.classList.add('is-open');
    lb.setAttribute('aria-hidden', 'false');
    document.body.classList.add('lb-lock');
  };
  const close = () => {
    lb.classList.remove('is-open');
    lb.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('lb-lock');
  };

  items.forEach((it, i) => {
    it.addEventListener('click', () => { if (moved <= 5) open(i); });
    it.addEventListener('keydown', e => { if (e.key === 'Enter') open(i); });
  });
  lb.querySelector('.lb-close').addEventListener('click', close);
  lb.querySelector('.lb-prev').addEventListener('click', () => show(idx - 1, -1));
  lb.querySelector('.lb-next').addEventListener('click', () => show(idx + 1, 1));
  lb.addEventListener('click', e => { if (e.target === lb) close(); });
  document.addEventListener('keydown', e => {
    if (!lb.classList.contains('is-open')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') show(idx - 1, -1);
    if (e.key === 'ArrowRight') show(idx + 1, 1);
  });
  // potiahnutie prstom v zväčšenom zobrazení
  let tx = null;
  lb.addEventListener('touchstart', e => { tx = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', e => {
    if (tx === null) return;
    const dx = e.changedTouches[0].clientX - tx;
    if (Math.abs(dx) > 50) show(idx + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
    tx = null;
  });
})();

// ===== ZÁRUBNE: anatómia — prepínač prevedenia, zvýraznenie dielov, popis pod schémou (mobil) =====
(function () {
  const list = document.querySelector('.anatomy-list');
  if (!list) return;
  const fig = document.querySelector('.anatomy-figure');
  const info = fig.querySelector('.anat-text');
  const chips = fig.querySelectorAll('.anat-chips button');
  const hint = info ? info.innerHTML : '';
  let selected = null;

  const paint = (n) => {
    list.querySelectorAll('li').forEach(li => li.classList.toggle('is-on', li.dataset.co === n));
    fig.querySelectorAll('.co').forEach(g => g.classList.toggle('is-on', g.dataset.co === n));
    fig.querySelectorAll('[data-part]').forEach(p => p.classList.toggle('is-on', p.dataset.part === n));
  };
  const show = (n) => {
    paint(n);
    chips.forEach(c => c.setAttribute('aria-pressed', c.dataset.co === selected ? 'true' : 'false'));
    if (!info) return;
    const li = n && list.querySelector('li[data-co="' + n + '"]');
    if (!li) { info.innerHTML = hint; return; }
    info.innerHTML = '<div class="anat-head"><span class="n">' + n + '</span>' + li.querySelector('h3').outerHTML + '</div>' +
                     li.querySelector('p').outerHTML;
  };
  const select = (n) => { selected = (selected === n) ? null : n; show(selected); };
  const hoverIn = (n) => paint(n);
  const hoverOut = () => paint(selected);

  // myš (počítač)
  list.querySelectorAll('li').forEach(li => {
    li.tabIndex = 0;
    li.addEventListener('mouseenter', () => hoverIn(li.dataset.co));
    li.addEventListener('mouseleave', hoverOut);
    li.addEventListener('focus', () => hoverIn(li.dataset.co));
    li.addEventListener('blur', hoverOut);
  });
  fig.querySelectorAll('.co, [data-part]').forEach(el => {
    const n = el.dataset.co || el.dataset.part;
    el.addEventListener('mouseenter', () => hoverIn(n));
    el.addEventListener('mouseleave', hoverOut);
    el.addEventListener('click', () => select(n));   // ťuknutie (mobil) aj klik
    el.style.cursor = 'pointer';
  });
  chips.forEach(c => c.addEventListener('click', () => select(c.dataset.co)));

  const toggle = document.getElementById('anatToggle');
  if (toggle) toggle.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    toggle.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
    fig.querySelectorAll('[data-anat]').forEach(v => { v.hidden = v.dataset.anat !== b.dataset.v; });
    paint(selected);
  });
})();

// ===== ZÁRUBNE: výber zárubne podľa hrúbky steny =====
// Základ F80 (80–100), F100 (100–130), F130 (130–160), F160 (160–190);
// každý rozširovací element pridá 90 mm (R90), R180 = 2 × 90 mm.
function frameForWall(d) {
  const bases = [[80, 80, 100], [100, 100, 130], [130, 130, 160], [160, 160, 190]];
  if (d <= 190) {
    const hits = bases.filter(b => d >= b[1] && d <= b[2]);
    return hits.map(b => ({ F: b[0], ext: 0, min: b[1], max: b[2] }));
  }
  const ext = 90 * Math.ceil((d - 190) / 90);
  const rest = d - ext;
  const hits = bases.slice(1).filter(b => rest >= b[1] && rest <= b[2]);
  return hits.map(b => ({ F: b[0], ext, min: b[1] + ext, max: b[2] + ext }));
}
function extLabel(ext) {
  const r180 = Math.floor(ext / 180), r90 = (ext % 180) / 90;
  const parts = [];
  if (r180) parts.push(r180 > 1 ? r180 + '× R180' : 'R180');
  if (r90) parts.push('R90');
  return parts.join(' + ');
}
(function () {
  const input = document.getElementById('wallInput');
  if (!input) return;
  const out = document.getElementById('calcOut');
  const res = out.querySelector('.res'), sub = out.querySelector('.sub'), alt = out.querySelector('.alt');
  const table = document.getElementById('rangeTable');
  const rows = Array.from(table.querySelectorAll('tbody tr[data-min]'));
  const MAX_WALL = 400;

  const update = () => {
    const d = parseInt(input.value, 10);
    rows.forEach(r => r.classList.remove('is-hit'));
    alt.textContent = '';
    if (isNaN(d)) { res.textContent = '–'; sub.textContent = 'Zadajte hrúbku steny v milimetroch.'; table.classList.remove('has-mark'); return; }
    // značka na osi 80–400 mm
    const pct = Math.min(100, Math.max(0, (d - 80) / 320 * 100));
    table.classList.toggle('has-mark', d >= 80 && d <= 400);
    rows.forEach(r => { r.querySelector('.mark').style.left = pct + '%'; });

    if (d < 80) { res.textContent = 'Na mieru'; sub.textContent = 'Pre steny tenšie ako 80 mm nás prosím kontaktujte.'; return; }
    if (d > MAX_WALL) { res.textContent = 'Na mieru'; sub.textContent = 'Nad 400 mm zostavíme zárubňu s ďalšími rozširovacími elementmi – ozvite sa nám.'; return; }
    const hits = frameForWall(d);
    const h = hits[0];
    const e = extLabel(h.ext);
    res.innerHTML = 'F' + h.F + (e ? ' <em>+ ' + e + '</em>' : '');
    sub.textContent = 'rozsah ' + h.min + '–' + h.max + ' mm';
    if (hits[1] && hits[1].max <= MAX_WALL) {
      const e2 = extLabel(hits[1].ext);
      alt.textContent = 'Na hranici rozsahov – vyhovuje aj F' + hits[1].F + (e2 ? ' + ' + e2 : '') + ' (' + hits[1].min + '–' + hits[1].max + ' mm).';
    }
    rows.forEach(r => {
      if (+r.dataset.min === h.min && +r.dataset.max === h.max) r.classList.add('is-hit');
    });
  };
  input.addEventListener('input', update);
  update();
})();

// ===== ROZMERY: konfigurátor =====
(function () {
  const tblW = document.getElementById('tblW'), tblH = document.getElementById('tblH');
  if (!tblW || !tblH) return;
  const state = { w: '80', h: '197', t: 'falc' };
  document.querySelectorAll('.seg[data-param]').forEach(seg => {
    const btn = seg.querySelector('[aria-pressed="true"]');
    if (btn) state[seg.dataset.param] = btn.dataset.v;
    seg.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      seg.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
      state[seg.dataset.param] = b.dataset.v;
      render();
    });
  });
  const txt = (id, s) => { const el = document.getElementById(id); if (el) el.textContent = s; };
  const out = (k, v) => { const el = document.querySelector('[data-out="' + k + '"]'); if (el) el.textContent = v; };
  function render() {
    const rw = tblW.querySelector('tr[data-w="' + state.w + '"]');
    const rh = tblH.querySelector('tr[data-h="' + state.h + '"]');
    if (!rw || !rh) return;
    const W = rw.dataset, H = rh.dataset, falc = state.t === 'falc';
    ['1', '2', '3', '4'].forEach(i => { txt('tS' + i, 'Š' + i + '  ' + W['s' + i]); txt('tV' + i, 'V' + i + '  ' + H['v' + i]); });
    txt('tSO', 'otvor  ' + W.o1 + '–' + W.o2);
    txt('tVO', 'otvor  ' + H.o1 + '–' + H.o2);
    out('pass', W.s1 + ' × ' + H.v1);
    out('open', W.o1 + '–' + W.o2 + ' × ' + H.o1 + '–' + H.o2);
    out('falc', W.s2 + ' × ' + H.v2);
    out('ost', W.s3 + ' × ' + H.v3);
    out('obl', W.s4 + ' × ' + H.v4);
    out('leaf', falc ? W.s5 + ' × ' + H.v5 : W.s7 + ' × ' + H.v7);
    out('leafcode', falc ? 'Š5 × V5' : 'Š7 × V7');
    out('leafdsc', falc ? 'Vrátane polodrážky (falcu).' : 'Bezfalcové krídlo nemá polodrážku – celkový rozmer je zároveň jediný.');
    out('leaffalc', W.s6 + ' × ' + H.v6);
    document.querySelectorAll('[data-plan]').forEach(v => { v.hidden = v.dataset.plan !== state.t; });
    out('plancap', falc ? 'falcová zárubňa' : 'bezfalcová zárubňa');
    document.querySelectorAll('[data-pk]').forEach(el => {
      const k = el.dataset.pk;
      el.textContent = k === 'O' ? 'otvor  ' + W.o1 + '–' + W.o2 : 'Š' + k + '  ' + W['s' + k];
    });
    document.querySelectorAll('[data-falc-only]').forEach(el => { el.hidden = !falc; });
    tblW.querySelectorAll('tbody tr').forEach(r => r.classList.toggle('is-sel', r === rw));
    tblH.querySelectorAll('tbody tr').forEach(r => r.classList.toggle('is-sel', r === rh));
  }
  render();
})();

// ===== mobilné menu =====
(function () {
  const header = document.getElementById('siteHeader');
  const btn = header && header.querySelector('.nav-toggle');
  if (!btn) return;
  const setOpen = (open) => {
    header.classList.toggle('nav-open', open);
    document.body.classList.toggle('nav-lock', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.setAttribute('aria-label', open ? 'Zavrieť menu' : 'Otvoriť menu');
  };
  btn.addEventListener('click', () => setOpen(!header.classList.contains('nav-open')));
  header.querySelectorAll('nav a').forEach(a => a.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setOpen(false); });
  window.addEventListener('resize', () => { if (window.innerWidth > 980) setOpen(false); });
})();

// =====================================================================
// CENOVÁ PONUKA – spoločné (všetky stránky): uloženie položiek, ikona v hlavičke, výpočet ceny
// =====================================================================
const Ponuka = (function () {
  const KEY = 'fortissima.ponuka.v1';
  const API = 'api/cena.php';
  // ukážkový režim: GitHub Pages alebo otvorenie zo súboru (bez PHP). Na ostrom webe sa nepoužije nikdy.
  const DEMO = location.protocol === 'file:' || /\.github\.io$/i.test(location.hostname);

  const NAMES = { minimal: 'Minimal', vertikal: 'Vertikal', prestige: 'Prestige', falc: 'falcové', bez: 'bezfalcové',
                  biela: 'biela', kasmirova: 'kašmírová', lave: 'ľavé', prave: 'pravé', slepa: 'slepá', nikel: 'nikel', cierna: 'čierne' };
  const KODY = { minimal: 'AK1', vertikal: 'XK1', prestige: 'QK1', falc: 'F', bez: 'B', biela: 'BIE', kasmirova: 'KAS', lave: 'L', prave: 'P' };
  const jeSlepa = p => !!p && p.druh === 'zarubna';
  const jeRamove = p => !!p && !jeSlepa(p) && (p.kolekcia === 'vertikal' || p.kolekcia === 'prestige');
  const MRIEZKA = { bez: 'bez', biela: 'biela', hlinik: 'hliníková', cierna: 'čierna' };
  const H = { '197': 1970, '2055': 2055, '210': 2100 }, HTXT = { '197': '197', '2055': '205,5', '210': '210' };
  const eur = new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR' });
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  let mem = null; // záloha, keď prehliadač nepovolí úložisko
  const novaPonuka = () => {
    const d = new Date(), p = n => String(n).padStart(2, '0');
    const id = 'FP-' + String(d.getFullYear()).slice(2) + p(d.getMonth() + 1) + p(d.getDate()) + '-' +
               Math.random().toString(36).slice(2, 6).toUpperCase();
    return { id, vytvorena: d.toISOString(), polozky: [], montaz: true, doprava: true };
  };
  function load() {
    let o = null;
    try { o = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { o = mem; }
    if (!o || !Array.isArray(o.polozky)) o = mem || novaPonuka();
    return o;
  }
  function save(o) {
    mem = o;
    try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {}
    badge();
  }
  const uid = () => Math.random().toString(36).slice(2, 10);
  const pocetKusov = o => o.polozky.reduce((a, p) => a + (parseInt(p.ks, 10) || 0), 0);

  function badge() {
    const o = load(), n = pocetKusov(o);
    document.querySelectorAll('.nav-quote-n').forEach(b => { b.textContent = n; b.hidden = n === 0; });
    document.querySelectorAll('.nav-quote').forEach(a => a.setAttribute('aria-label', 'Cenová ponuka' + (n ? ' – ' + n + ' ks' : '')));
  }

  /* ---------- ukážkový cenník a výpočet (zhodný s api/cena.php) ---------- */
  let demoP = null;
  const loadDemo = () => demoP || (demoP = new Promise((res, rej) => {
    if (window.FORTISSIMA_DEMO) return res(window.FORTISSIMA_DEMO);
    const sc = document.createElement('script');
    sc.src = 'assets/demo-cennik.js';
    sc.onload = () => window.FORTISSIMA_DEMO ? res(window.FORTISSIMA_DEMO) : rej();
    sc.onerror = rej;
    document.head.appendChild(sc);
  }));
  const num = v => parseFloat(String(v || '0').replace(/[\s€]/g, '').replace(',', '.')) || 0;
  const best = (rows, crit) => {
    let b = null, sc = -1;
    rows.forEach(r => {
      let s = 0, ok = true;
      for (const k in crit) {
        const h = String(r[k] == null ? '*' : r[k]).toLowerCase();
        if (h === '*' || h === '') continue;
        if (h !== String(crit[k]).toLowerCase()) { ok = false; break; }
        s++;
      }
      if (ok && s > sc) { b = r; sc = s; }
    });
    return b;
  };
  const surcharge = (rows, pol, w, h) => rows.reduce((a, r) =>
    a + ((r.polozka || '').toLowerCase() === pol && ['*', '', w].includes(r.sirka) && ['*', '', h].includes(r.vyska) ? num(r.priplatok_s_dph) : 0), 0);
  const r2 = x => Math.round(x * 100) / 100;

  function demoPolozka(p, D) {
    const err = m => ({ uid: p.uid, ok: false, chyba: m });
    const druh = p.druh || 'dvere', slepa = druh === 'zarubna';
    if (!['dvere', 'zarubna'].includes(druh)) return err('Neplatný druh položky.');
    for (const k of slepa ? ['farba_zarubne'] : ['kolekcia', 'prevedenie', 'farba', 'farba_zarubne', 'smer']) if (!(p[k] in KODY)) return err('Neplatná hodnota: ' + k);
    if (!['60', '65', '70', '80', '90'].includes(p.sirka) || !(p.vyska in H)) return err('Neplatný rozmer.');
    const prev = slepa ? 'slepa' : p.prevedenie, kPrev = slepa ? 'S' : KODY[p.prevedenie], kSmer = slepa ? 'S' : KODY[p.smer];
    const soZar = slepa || p.so_zarubnou !== false, d = parseInt(p.stena, 10), ks = parseInt(p.ks, 10);
    if (soZar && (isNaN(d) || d < 80 || d > 400)) return err('Hrúbka steny musí byť od 80 do 400 mm. Pre iné hrúbky nám pošlite dopyt.');
    if (isNaN(ks) || ks < 1 || ks > 50) return err('Počet kusov musí byť od 1 do 50.');
    const z = soZar ? frameForWall(d)[0] : { F: 0, ext: 0, min: 0, max: 0 }, r180 = Math.floor(z.ext / 180), r90 = (z.ext % 180) / 90;
    const N = +p.sirka * 10, V1 = H[p.vyska], falc = prev === 'falc', rozm = p.sirka + '-' + p.vyska;
    const R = [], add = (typ, kod, nazov, c, m, dd, x) => R.push(Object.assign({ typ, kod, nazov, mnozstvo: m, cena_ks: r2(c), spolu: r2(c * m), d: dd || 0 }, x || {}));
    const miss = err('Pre túto zostavu zatiaľ nemáme cenu v cenníku. Pošlite nám prosím dopyt.');
    // závesy sú súčasťou zárubne; slepá zárubňa závesy ani protiplech nemá
    let zav = null;
    if (soZar && !slepa) {
      zav = (D.zavesy || []).find(k => k.kod.toLowerCase() === String(p.zavesy || 'nikel').toLowerCase());
      if (!zav) return err('Neplatná farba závesov.');
    }
    let r;
    if (!slepa) {
    const kov = D.kovanie.find(k => k.kod.toLowerCase() === String(p.kovanie || 'bez').toLowerCase());
    if (!kov) return err('Neplatný zámok.');
    r = best(D.kridla, { kolekcia: p.kolekcia, prevedenie: p.prevedenie, farba: p.farba, sirka: p.sirka, vyska: p.vyska });
    if (!r) return miss;
    const prah = !!p.prah, cPrah = prah ? surcharge(D.priplatky, 'prah', p.sirka, p.vyska) : 0;
    if (prah && cPrah <= 0) return miss;
    // vetracia mriežka (všetky kolekcie; pri rámových dverách v spodnom vlysu)
    const mrKod = String(p.mriezka || 'bez').toLowerCase();
    let mr = null;
    if (mrKod !== 'bez') { mr = (D.mriezky || []).find(k => k.kod.toLowerCase() === mrKod); if (!mr) return err('Neplatná vetracia mriežka.'); }
    add('KRIDLO', KODY[p.kolekcia] + '-' + KODY[p.prevedenie] + '-' + KODY[p.farba] + '-' + rozm + '-' + KODY[p.smer],
        'Krídlo ' + NAMES[p.kolekcia] + ', ' + NAMES[p.prevedenie] + ', ' + NAMES[p.farba] + ', ' + p.sirka + '/' + HTXT[p.vyska] + ', ' + NAMES[p.smer] +
        ' (' + (falc ? (N + 50) + ' × ' + (V1 + 15) : (N + 22) + ' × ' + (V1 + 1)) + ' mm), ' + kov.nazov + (prah ? ', výsuvný prah' : '') + (mr ? ', ' + mr.nazov.charAt(0).toLowerCase() + mr.nazov.slice(1) : ''),
        num(r.cena_s_dph) + surcharge(D.priplatky, 'kridlo', p.sirka, p.vyska) + num(kov.cena_s_dph) + cPrah + (mr ? num(mr.cena_s_dph) : 0), ks,
        Math.max(num(r.dodanie_dni), num(kov.dodanie_dni), mr ? num(mr.dodanie_dni) : 0), { prah, mriezka: mr ? mrKod : 'bez' });
    }
    if (soZar) {
    const kz = { prevedenie: prev, farba: p.farba_zarubne, sirka: p.sirka, vyska: p.vyska };
    r = best(D.zarubne, Object.assign({ typ: 'F' + z.F }, kz)); if (!r) return miss;
    const zn = zav ? zav.nazov.charAt(0).toLowerCase() + zav.nazov.slice(1) : '';
    add('ZARUBNA', 'F' + z.F + '-' + kPrev + '-' + KODY[p.farba_zarubne] + '-' + rozm + '-' + kSmer,
        slepa ? 'Slepá (tunelová) zárubňa F' + z.F + ', ' + NAMES[p.farba_zarubne] + ', ' + p.sirka + '/' + HTXT[p.vyska] + ' – bez závesov a protiplechu'
              : 'Obložková zárubňa F' + z.F + ', ' + (falc ? 'falcová' : 'bezfalcová') + ', ' + NAMES[p.farba_zarubne] + ', ' + zn,
        num(r.cena_s_dph) + surcharge(D.priplatky, 'zarubna', p.sirka, p.vyska) + (zav ? num(zav.cena_s_dph) : 0), ks,
        Math.max(num(r.dodanie_dni), zav ? num(zav.dodanie_dni) : 0), { zavesy: zav ? zav.kod.toLowerCase() : '' });
    if (z.ext) {
      const k2 = { farba: p.farba_zarubne, sirka: p.sirka, vyska: p.vyska }, fz = KODY[p.farba_zarubne];
      const e90 = best(D.rozsirenia, Object.assign({ typ: 'R90' }, k2)), e180 = best(D.rozsirenia, Object.assign({ typ: 'R180' }, k2));
      if (r180) {
        if (e180) add('ROZSIRENIE', 'R180-' + fz + '-' + rozm, 'Rozširovací element R180', num(e180.cena_s_dph), ks * r180, num(e180.dodanie_dni));
        else if (e90) add('ROZSIRENIE', 'R90-' + fz + '-' + rozm, 'Rozširovací element R90', num(e90.cena_s_dph), ks * r180 * 2, num(e90.dodanie_dni));
        else return miss;
      }
      if (r90) { if (!e90) return miss; add('ROZSIRENIE', 'R90-' + fz + '-' + rozm, 'Rozširovací element R90', num(e90.cena_s_dph), ks * r90, num(e90.dodanie_dni)); }
    }
    }
    const e = extLabel(z.ext);
    return { uid: p.uid, ok: true, riadky: R.map(({ d, ...x }) => x), spolu: r2(R.reduce((a, x) => a + x.spolu, 0)), ks,
             druh, so_zarubnou: soZar, prevedenie: prev, zavesy: zav ? zav.kod.toLowerCase() : '', zarubna: soZar ? 'F' + z.F + (e ? ' + ' + e : '') : 'bez zárubne', rozsah_steny: soZar ? z.min + '–' + z.max + ' mm' : '', dodanie_dni: Math.max(0, ...R.map(x => x.d)) };
  }
  function demoPonuka(o, D) {
    const pol = o.polozky.map(p => demoPolozka(p, D));
    const okP = pol.filter(p => p.ok), kusov = okP.reduce((a, p) => a + p.ks, 0);
    const medz = r2(okP.reduce((a, p) => a + p.spolu, 0)), dni = Math.max(0, ...okP.map(p => p.dodanie_dni));
    const sl = {}; D.sluzby.forEach(x => { sl[x.kod.toLowerCase()] = x; });
    const sluzby = [], upozornenia = [];
    const sluzba = (kod, nazov, c, mn, jedn) => sluzby.push({ typ: 'SLUZBA', kod, nazov, mnozstvo: mn, jednotka: jedn, cena_ks: r2(c), spolu: r2(c * mn) });
    if (o.montaz && kusov) {
      // montuje sa len zárubňa – samostatné krídla (bez zárubne) sa nemontujú
      const podla = {}; let bezM = 0;
      okP.forEach(p => { if (!p.so_zarubnou) { bezM += p.ks; return; } podla[p.prevedenie] = (podla[p.prevedenie] || 0) + p.ks; });
      if (bezM) upozornenia.push('Montáž sa počíta len k zárubniam – samostatné krídla bez zárubne (' + bezM + ' ks) nemontujeme.');
      Object.keys(podla).forEach(t => {
        const r = sl['montaz-' + t] || sl.montaz;
        if (!r) { upozornenia.push('V cenníku chýba cena montáže pre typ „' + t + '“.'); return; }
        sluzba('SL-MONTAZ-' + t.toUpperCase(), r.nazov, num(r.cena_s_dph), podla[t], 'ks');
      });
      if (Object.keys(podla).length && sl.zameranie) sluzba('SL-ZAMERANIE', sl.zameranie.nazov, num(sl.zameranie.cena_s_dph), 1, 'zákazka');
    }
    if (o.doprava && kusov && sl.doprava) {
      const km = parseFloat(String(o.doprava_km || '').replace(',', '.'));
      if (!(km > 0 && km <= 2000)) upozornenia.push('Pre výpočet dopravy zadajte vzdialenosť v kilometroch.');
      else { const k = Math.round(km); sluzba('SL-DOPRAVA', sl.doprava.nazov + ' (' + k + ' km × 2)', num(sl.doprava.cena_s_dph), k * 2, 'km'); }
    }
    return { ok: true, polozky: pol, sluzby, upozornenia, medzisucet: medz, spolu: r2(medz + sluzby.reduce((a, s) => a + s.spolu, 0)), kusov,
             chyby: pol.length - okP.length, dodanie_dni: dni, dodanie: dni === 0 ? 'Skladom' : 'do ' + dni + ' pracovných dní' };
  }

  /* ---------- ocenenie (server alebo ukážka) ---------- */
  let ctrl = null;
  function ocen(o) {
    if (!o.polozky.length) return Promise.resolve({ ok: true, polozky: [], sluzby: [], medzisucet: 0, spolu: 0, kusov: 0, chyby: 0, dodanie: '–' });
    if (DEMO) return loadDemo().then(D => demoPonuka(o, D));
    if (ctrl) ctrl.abort();
    ctrl = new AbortController();
    const body = JSON.stringify({ polozky: o.polozky, montaz: !!o.montaz, doprava: !!o.doprava, doprava_km: o.doprava_km || 0 });
    return fetch(API, { method: 'POST', body, signal: ctrl.signal, headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' } })
      .then(r => r.json().catch(() => ({ ok: false, chyba: 'Server nevrátil platnú odpoveď.' })));
  }
  function moznosti() {
    return DEMO ? loadDemo().then(D => ({ kovanie: D.kovanie, mriezky: D.mriezky || [] }))
                : fetch(API + '?moznosti=1').then(r => r.json()).then(j => j.ok ? j : { kovanie: [], mriezky: [] });
  }
  function kovanie() {
    return DEMO ? loadDemo().then(D => D.kovanie.map(k => ({ kod: k.kod, nazov: k.nazov })))
                : fetch(API + '?moznosti=1').then(r => r.json()).then(j => j.ok ? j.kovanie : []);
  }

  /** Ľudsky čitateľný popis položky (bez cien). */
  function popis(p) {
    if (jeSlepa(p)) return 'Slepá zárubňa · ' + p.sirka + '/' + HTXT[p.vyska] + ' · ' + NAMES[p.farba_zarubne];
    return NAMES[p.kolekcia] + ' · ' + NAMES[p.prevedenie] + ' · ' + p.sirka + '/' + HTXT[p.vyska] + ' · ' + NAMES[p.smer];
  }

  /* ---------- schematický obrázok položky (SVG v mierke, rozmery v mm) ---------- */
  const FARBY = {
    biela:     { leaf: '#F4F3F0', edge: '#C9C5BE', frame: '#EFEEEA', line: 'rgba(60,52,44,.16)' },
    kasmirova: { leaf: '#D9CDBD', edge: '#ADA090', frame: '#D3C6B5', line: 'rgba(60,45,30,.22)' }
  };
  function obrazok(p, opt) {
    opt = opt || {};
    const N = +p.sirka * 10, V1 = H[p.vyska] || 1970, falc = p.prevedenie !== 'bez', slepa = jeSlepa(p);
    const L = FARBY[p.farba] || FARBY.biela, Z = FARBY[p.farba_zarubne] || FARBY.biela;
    const VW = 1400, VH = 2330, floor = 2250, cx = VW / 2;           // spoločná mierka pre všetky veľkosti
    const S4 = N + 170, V4 = V1 + 82, S2 = N + 30, V2 = V1 + 12;       // obložky, rozmer vo falci
    const lw = falc ? N + 50 : N + 22, lh = falc ? V1 + 15 : V1 + 1;   // krídlo
    const ox = cx - S4 / 2, oy = floor - V4, ix = cx - S2 / 2, iy = floor - V2;
    const lx = cx - lw / 2, ly = floor - 8 - lh;
    const hingeLeft = p.smer === 'lave';                                 // pri pohľade zo strany závesov
    const lockX = hingeLeft ? lx + lw : lx;                              // hrana na strane zámku
    const dir = hingeLeft ? -1 : 1;                                      // smer do stredu krídla od zámku
    const kov = String(p.kovanie || ''), kc = /cierna/.test(kov) ? '#2B2826' : '#B8BBBF', kcs = /cierna/.test(kov) ? '#111' : '#8E9297';
    const o = [];
    // výrez je pevný (podľa najväčších dverí 90/210), takže menšie dvere vyzerajú v správnom pomere menšie
    o.push('<svg viewBox="140 20 1120 2300" class="door-svg" role="img" aria-label="' +
      esc(slepa ? 'Slepá zárubňa, ' + p.sirka + '/' + HTXT[p.vyska] + ', ' + NAMES[p.farba_zarubne]
                : NAMES[p.kolekcia] + ', ' + NAMES[p.prevedenie] + ', ' + p.sirka + '/' + HTXT[p.vyska] + ', ' + NAMES[p.smer]) + '">');
    o.push('<rect x="0" y="0" width="' + VW + '" height="' + floor + '" fill="#ECE8E1"/>');
    o.push('<rect x="0" y="' + floor + '" width="' + VW + '" height="' + (VH - floor) + '" fill="#D9D6D1"/>');
    // obložky (farba zárubne); bez zárubne len obrys otvoru
    if (p.so_zarubnou === false) {
      o.push('<rect x="' + ix + '" y="' + iy + '" width="' + S2 + '" height="' + V2 + '" fill="#D8D3CB" stroke="#9A9188" stroke-width="5" stroke-dasharray="26 18"/>');
    } else {
    o.push('<rect x="' + ox + '" y="' + oy + '" width="' + S4 + '" height="' + V4 + '" fill="' + Z.frame + '" stroke="' + Z.edge + '" stroke-width="5"/>');
    if (!slepa) o.push('<rect x="' + ix + '" y="' + iy + '" width="' + S2 + '" height="' + V2 + '" fill="' + (falc ? Z.frame : '#5E5850') + '" stroke="' + Z.edge + '" stroke-width="4"/>');
    }
    if (slepa) {
      // slepá (tunelová) zárubňa: len čistý priechod – bez krídla, závesov a protiplechu
      const S1 = N + 6, px0 = cx - S1 / 2, py0 = floor - V1;
      o.push('<rect x="' + px0 + '" y="' + py0 + '" width="' + S1 + '" height="' + V1 + '" fill="#C9C2B8" stroke="' + Z.edge + '" stroke-width="4"/>');
      o.push('<rect x="' + px0 + '" y="' + (floor - 220) + '" width="' + S1 + '" height="220" fill="#B9B2A7"/>');
      o.push('<polygon points="' + px0 + ',' + py0 + ' ' + (px0 + 60) + ',' + (py0 + 60) + ' ' + (px0 + S1 - 60) + ',' + (py0 + 60) + ' ' + (px0 + S1) + ',' + py0 + '" fill="' + Z.leaf + '" opacity=".55"/>');
      o.push('<rect x="' + px0 + '" y="' + py0 + '" width="60" height="' + V1 + '" fill="' + Z.leaf + '" opacity=".45"/>');
      o.push('<rect x="' + (px0 + S1 - 60) + '" y="' + py0 + '" width="60" height="' + V1 + '" fill="' + Z.leaf + '" opacity=".3"/>');
      if (opt.rozmer !== false) o.push('<text x="' + cx + '" y="' + (VH - 34) + '" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="54" fill="#7D756B">' +
        esc(p.sirka + '/' + HTXT[p.vyska] + ' · slepá') + '</text>');
      o.push('</svg>');
      return o.join('');
    }
    // krídlo (farba krídla)
    o.push('<rect x="' + lx + '" y="' + ly + '" width="' + lw + '" height="' + lh + '" fill="' + L.leaf + '" stroke="' + L.edge + '" stroke-width="5"/>');
    // rámová konštrukcia a presklenie
    // vlysy: horný 145 mm; spodný je širší (miesto pre vetraciu mriežku) – 340 mm pri 205,5/210,
    // STN 197 sa vyrába skrátením 205,5 zo spodu o 85 mm → spodný vlys 255 mm
    const st = 145, tr = 145, br = p.vyska === '197' ? 255 : 340;
    const px = lx + st, pw = lw - 2 * st, py = ly + tr, ph = lh - tr - br;
    const glass = '#C7CFD8', gEdge = '#9EA8B3';
    if (p.kolekcia !== 'minimal' && pw > 120) {
      o.push('<g fill="none" stroke="' + L.line + '" stroke-width="4">' +
        '<line x1="' + px + '" y1="' + (ly + 4) + '" x2="' + px + '" y2="' + (ly + lh - 4) + '"/>' +
        '<line x1="' + (px + pw) + '" y1="' + (ly + 4) + '" x2="' + (px + pw) + '" y2="' + (ly + lh - 4) + '"/>' +
        '<line x1="' + px + '" y1="' + py + '" x2="' + (px + pw) + '" y2="' + py + '"/>' +
        '<line x1="' + px + '" y1="' + (py + ph) + '" x2="' + (px + pw) + '" y2="' + (py + ph) + '"/></g>');
      if (p.kolekcia === 'vertikal') {
        const gw = 150, gx = hingeLeft ? px + pw - gw : px;               // sklo pri strane zámku
        o.push('<rect x="' + gx + '" y="' + py + '" width="' + gw + '" height="' + ph + '" fill="' + glass + '" stroke="' + gEdge + '" stroke-width="3"/>');
        o.push('<rect x="' + (gx + 18) + '" y="' + (py + 20) + '" width="34" height="' + (ph - 40) + '" fill="#fff" opacity=".25"/>');
      } else if (p.kolekcia === 'prestige') {
        for (let k = 1; k <= 4; k++) {
          const gy = py + ph * k / 5 - 10;
          o.push('<rect x="' + px + '" y="' + gy + '" width="' + pw + '" height="20" fill="' + glass + '" stroke="' + gEdge + '" stroke-width="2"/>');
        }
      }
    }
    // závesy (len falcové – bezfalcové majú skryté)
    if (falc) {
      const hx = hingeLeft ? lx - 6 : lx + lw - 10, cz = p.zavesy === 'cierna';
      [ly + 200, ly + lh / 2 - 60, ly + lh - 320].forEach(hy =>
        o.push('<rect x="' + hx + '" y="' + hy + '" width="16" height="110" rx="7" fill="' + (cz ? '#2B2826' : '#B8BBBF') + '" stroke="' + (cz ? '#111' : '#8E9297') + '" stroke-width="2"/>'));
    }
    // vetracia mriežka v strede spodného vlysu
    if (!slepa && p.mriezka && p.mriezka !== 'bez') {
      const MC = { biela: ['#F7F6F2', '#BDB8B0', '#D6D2CB'], hlinik: ['#C9CCD0', '#8E9297', '#9DA1A6'], cierna: ['#2E2B29', '#111', '#4A4643'] }[p.mriezka] || ['#C9CCD0', '#8E9297', '#9DA1A6'];
      const gw = Math.min(460, lw - 160), gh = 100, gx = lx + (lw - gw) / 2, gy = ly + lh - br / 2 - gh / 2;
      o.push('<rect x="' + gx + '" y="' + gy + '" width="' + gw + '" height="' + gh + '" rx="6" fill="' + MC[0] + '" stroke="' + MC[1] + '" stroke-width="3"/>');
      for (let k = 1; k <= 5; k++) o.push('<rect x="' + (gx + 22) + '" y="' + (gy + k * gh / 6 - 4) + '" width="' + (gw - 44) + '" height="8" rx="3" fill="' + MC[2] + '"/>');
    }
    // výsuvný prah v spodku krídla
    if (p.prah) o.push('<rect x="' + (lx + 40) + '" y="' + (ly + lh - 34) + '" width="' + (lw - 80) + '" height="22" rx="4" fill="#A9ADB2" stroke="#7E8287" stroke-width="2"/>');
    // kľučka a zámok (výška kľučky 1050 mm od podlahy) – kľučka je len ilustračná, nie je súčasťou ponuky
    const hy = floor - 1050, rx = lockX + dir * 70;
    o.push('<rect x="' + (rx - 26) + '" y="' + (hy - 26) + '" width="52" height="52" rx="6" fill="' + kc + '" stroke="' + kcs + '" stroke-width="2"/>');
    o.push('<rect x="' + Math.min(rx, rx + dir * 150) + '" y="' + (hy - 9) + '" width="150" height="18" rx="9" fill="' + kc + '" stroke="' + kcs + '" stroke-width="2"/>');
    if (kov && kov !== 'bez') {
      const ky = hy + 90;
      o.push('<rect x="' + (rx - 22) + '" y="' + (ky - 22) + '" width="44" height="44" rx="6" fill="' + kc + '" stroke="' + kcs + '" stroke-width="2"/>');
      if (/^wc/.test(kov)) o.push('<circle cx="' + rx + '" cy="' + ky + '" r="11" fill="none" stroke="' + kcs + '" stroke-width="5"/>');
      else if (/^pz/.test(kov)) o.push('<circle cx="' + rx + '" cy="' + (ky - 5) + '" r="8" fill="' + kcs + '"/><rect x="' + (rx - 4) + '" y="' + (ky - 2) + '" width="8" height="14" fill="' + kcs + '"/>');
      else o.push('<rect x="' + (rx - 4) + '" y="' + (ky - 12) + '" width="8" height="24" rx="3" fill="' + kcs + '"/>');
    }
    if (opt.rozmer !== false) {
      o.push('<text x="' + cx + '" y="' + (VH - 34) + '" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="54" fill="#7D756B">' +
        esc(p.sirka + '/' + HTXT[p.vyska] + ' · ' + NAMES[p.smer]) + '</text>');
    }
    o.push('</svg>');
    return o.join('');
  }

  badge();
  window.addEventListener('storage', e => { if (e.key === KEY) badge(); });
  return { jeSlepa, jeRamove, MRIEZKA, moznosti, obrazok, load, save, novaPonuka, uid, ocen, kovanie, popis, badge, pocetKusov, DEMO, NAMES, H, HTXT, eur, esc };
})();


// ===== KALKULÁCIA (jedna položka → pridať do ponuky) =====
(function () {
  const form = document.getElementById('calcForm');
  if (!form) return;
  const P = Ponuka, $ = id => document.getElementById(id);
  const sum = $('sum'), items = $('sumItems'), total = $('sumTotal'), barTotal = $('sumBarTotal');
  const errBox = $('sumErr'), addBtn = $('sumAdd');
  let editUid = null, timer = null, last = null, zarDotknuta = false;

  if (P.DEMO) { const b = $('sumDemo'); if (b) b.hidden = false; }

  const val = n => { const el = form.querySelector('[name="' + n + '"]:checked') || form.elements[n]; return el ? el.value : ''; };
  const setRadio = (n, v) => { const r = form.querySelector('input[name="' + n + '"][value="' + v + '"]'); if (r) r.checked = true; };
  const polozka = () => val('druh') === 'zarubna' ? ({
    uid: editUid || 'n', druh: 'zarubna', prevedenie: 'slepa', smer: 'slepa', farba_zarubne: val('farba_zarubne'),
    sirka: val('sirka'), vyska: val('vyska'), so_zarubnou: true, stena: parseInt(form.elements.stena.value, 10) || 0,
    ks: Math.min(50, Math.max(1, parseInt(form.elements.ks.value, 10) || 1)), nazov: form.elements.nazov.value.trim().slice(0, 40)
  }) : ({
    uid: editUid || 'n', druh: 'dvere', kolekcia: val('kolekcia'), prevedenie: val('prevedenie'), farba: val('farba'), farba_zarubne: val('farba_zarubne'),
    sirka: val('sirka'), vyska: val('vyska'), smer: val('smer'), so_zarubnou: form.elements.so_zarubnou.checked, zavesy: val('zavesy') || 'nikel',
    stena: parseInt(form.elements.stena.value, 10) || 0,
    kovanie: form.elements.kovanie.value, prah: form.elements.prah.checked,
    mriezka: form.elements.mriezka.value || 'bez', ks: Math.min(50, Math.max(1, parseInt(form.elements.ks.value, 10) || 1)),
    nazov: form.elements.nazov.value.trim().slice(0, 40)
  });

  // predvoľba z odkazu (?kolekcia=...) alebo úprava existujúcej položky (?upravit=uid)
  const qs = new URLSearchParams(location.search);
  if (qs.get('kolekcia')) setRadio('kolekcia', qs.get('kolekcia'));
  if (qs.get('druh')) setRadio('druh', qs.get('druh'));
  if (qs.get('upravit')) {
    const p = P.load().polozky.find(x => x.uid === qs.get('upravit'));
    if (p) {
      editUid = p.uid; zarDotknuta = true;
      setRadio('druh', p.druh || 'dvere'); setRadio('zavesy', p.zavesy || 'nikel');
      ['kolekcia', 'prevedenie', 'farba', 'farba_zarubne', 'sirka', 'vyska', 'smer'].forEach(k => setRadio(k, p[k]));
      form.elements.so_zarubnou.checked = p.so_zarubnou !== false;
      form.elements.prah.checked = !!p.prah;
      form.dataset.mriezka = p.mriezka || 'bez';
      form.elements.stena.value = p.stena; form.elements.ks.value = p.ks; form.elements.nazov.value = p.nazov || '';
      form.dataset.kovanie = p.kovanie;
      addBtn.textContent = 'Uložiť zmeny v ponuke';
      const h = $('calcEditNote'); if (h) h.hidden = false;
    }
  }

  // farba zárubne nasleduje farbu krídla, kým ju zákazník sám nezmení
  form.querySelectorAll('input[name="farba"]').forEach(r => r.addEventListener('change', () => { if (!zarDotknuta) setRadio('farba_zarubne', r.value); }));
  form.querySelectorAll('input[name="farba_zarubne"]').forEach(r => r.addEventListener('change', () => { zarDotknuta = true; }));

  function hints(p) {
    const N = +p.sirka * 10, V1 = P.H[p.vyska], slepa = P.jeSlepa(p);
    form.querySelectorAll('[data-dvere]').forEach(el => { el.hidden = slepa; });
    $('zavesyWrap').hidden = slepa || !p.so_zarubnou;
    $('druhNote').textContent = slepa ? 'Slepá (tunelová) zárubňa je čistý priechod bez krídla – bez závesov a protiplechu.'
                                      : 'Dvere = krídlo so zámkom, voliteľne aj so zárubňou.';
    if (!p.so_zarubnou) {
      const f = p.prevedenie === 'falc';
      $('calcDims').innerHTML = 'Krídlo <b>' + (f ? (N + 50) + ' × ' + (V1 + 15) : (N + 22) + ' × ' + (V1 + 1)) + ' mm</b> · zárubňa vo falci <b>' +
        (N + 30) + ' × ' + (V1 + 12) + ' mm</b>';
    } else
    $('calcDims').innerHTML = 'Priechod <b>' + (N + 6) + ' × ' + V1 + ' mm</b> · stavebný otvor <b>' + (N + 80) + '–' + (N + 110) +
      ' × ' + (V1 + 40) + '–' + (V1 + 60) + ' mm</b>';
    const d = p.stena;
    $('stenaWrap').hidden = !p.so_zarubnou;
    form.querySelectorAll('[data-zar]').forEach(el => { el.classList.toggle('is-off', !p.so_zarubnou); });
    if (!p.so_zarubnou) { $('stenaOut').innerHTML = 'Bez zárubne – krídlo osadíte do existujúcej zárubne. Skontrolujte, či jej rozmer vo falci zodpovedá zvolenej veľkosti. Samostatné krídla nemontujeme.'; return; }
    let t = 'Zadajte hrúbku steny od 80 do 400 mm.';
    if (d >= 80 && d <= 400) { const h = frameForWall(d)[0], e = extLabel(h.ext); t = (slepa ? 'Slepá zárubňa' : 'Zárubňa') + ' <b>F' + h.F + (e ? ' + ' + e : '') + '</b> · rozsah ' + h.min + '–' + h.max + ' mm'; }
    $('stenaOut').innerHTML = t;
  }
  function showError(msg) {
    errBox.textContent = msg; errBox.hidden = false; last = null;
    items.innerHTML = ''; total.textContent = '–'; barTotal.textContent = '–';
    $('sumDod').textContent = '–'; $('sumZar').textContent = '–';
  }
  function calc() {
    const p = polozka();
    hints(p);
    const prev = $('doorPrev'); if (prev) prev.innerHTML = P.obrazok(p);
    sum.classList.add('is-loading');
    P.ocen({ polozky: [p], montaz: false, doprava: false }).then(j => {
      sum.classList.remove('is-loading');
      if (!j.ok) return showError(j.chyba || 'Cenu sa nepodarilo vypočítať.');
      const r = j.polozky[0];
      if (!r.ok) return showError(r.chyba);
      errBox.hidden = true; last = r;
      items.innerHTML = r.riadky.map(x => '<li><span>' + P.esc(x.nazov) + '</span><span class="p">' + P.eur.format(x.spolu) + '</span>' +
        '<span class="q">' + x.mnozstvo + ' × ' + P.eur.format(x.cena_ks) + '</span></li>').join('');
      total.textContent = P.eur.format(r.spolu); barTotal.textContent = P.eur.format(r.spolu);
      $('sumDod').textContent = j.dodanie; $('sumZar').textContent = r.zarubna + (r.rozsah_steny ? ' (' + r.rozsah_steny + ')' : '');
    }).catch(e => {
      if (e && e.name === 'AbortError') return;
      sum.classList.remove('is-loading');
      showError('Cenu sa nepodarilo načítať. Skúste to prosím znova alebo nám pošlite dopyt.');
    });
  }
  const schedule = () => { clearTimeout(timer); timer = setTimeout(calc, 180); };

  const naplnSelect = (sel, list, want) => {
    if (!list || !list.length) return;
    sel.innerHTML = list.map(k => '<option value="' + P.esc(k.kod) + '">' + P.esc(k.nazov) + '</option>').join('');
    if ([...sel.options].some(o => o.value === want)) sel.value = want;
  };
  P.moznosti().then(m => {
    naplnSelect(form.elements.kovanie, m.kovanie, form.dataset.kovanie || form.elements.kovanie.value);
    naplnSelect(form.elements.mriezka, m.mriezky, form.dataset.mriezka || 'bez');
    schedule();
  }).catch(() => {});

  form.addEventListener('input', schedule);
  form.addEventListener('change', schedule);
  form.querySelectorAll('.qty button').forEach(b => b.addEventListener('click', () => {
    const i = form.elements.ks; i.value = Math.min(50, Math.max(1, (parseInt(i.value, 10) || 1) + +b.dataset.q)); schedule();
  }));

  function refreshLink() {
    const n = P.pocetKusov(P.load()), a = $('sumView');
    if (a) { a.hidden = n === 0; a.textContent = 'Zobraziť ponuku (' + n + ' ks) →'; }
  }
  addBtn.addEventListener('click', () => {
    if (!last) { errBox.textContent = errBox.textContent || 'Najprv opravte zadanie položky.'; errBox.hidden = false; return; }
    const o = P.load(), p = polozka();
    if (editUid) {
      const i = o.polozky.findIndex(x => x.uid === editUid);
      if (i >= 0) o.polozky[i] = p; else o.polozky.push(p);
      P.save(o);
      location.href = 'zostava.html';
      return;
    }
    p.uid = P.uid();
    o.polozky.push(p);
    P.save(o);
    refreshLink();
    const t = $('calcToast');
    t.innerHTML = '<b>Pridané do ponuky:</b> ' + P.esc((p.nazov ? p.nazov + ' – ' : '') + P.popis(p)) + ', ' + p.ks + ' ks. ' +
                  'Môžete pridať ďalšiu položku alebo <a href="zostava.html">otvoriť ponuku</a>.';
    t.hidden = false; t.classList.remove('is-in'); void t.offsetWidth; t.classList.add('is-in');
    form.elements.nazov.value = ''; form.elements.ks.value = 1; schedule();
  });

  const bar = $('sumBar');
  if (bar && 'IntersectionObserver' in window) new IntersectionObserver(es => es.forEach(e => bar.classList.toggle('is-hidden', e.isIntersecting))).observe(sum);
  refreshLink();
  calc();
})();


// ===== CENOVÁ PONUKA (zostava.html) =====
(function () {
  const root = document.getElementById('quote');
  if (!root) return;
  const P = Ponuka, $ = id => document.getElementById(id);
  let o = P.load(), res = null, timer = null;

  if (P.DEMO) $('qDemo').hidden = false;
  const datum = d => new Date(d).toLocaleDateString('sk-SK', { day: 'numeric', month: 'long', year: 'numeric' });

  function head() {
    $('qId').textContent = o.id;
    $('qDate').textContent = datum(o.vytvorena);
    $('qMontaz').checked = !!o.montaz; $('qDoprava').checked = !!o.doprava;
    $('qKm').value = o.doprava_km || ''; $('qKmWrap').hidden = !o.doprava;
  }
  function detail(p, r) {
    const bez = p.so_zarubnou === false;
    const z = r && r.ok ? r.zarubna + (r.rozsah_steny ? ' (' + r.rozsah_steny + ')' : '') : '–';
    if (P.jeSlepa(p)) return '<dl class="qi-dl">' +
      '<div><dt>Rozmer</dt><dd>' + p.sirka + '/' + P.HTXT[p.vyska] + ', slepá</dd></div>' +
      '<div><dt>Farba zárubne</dt><dd>' + P.NAMES[p.farba_zarubne] + '</dd></div>' +
      '<div><dt>Závesy</dt><dd>bez závesov a protiplechu</dd></div>' +
      '<div><dt>Zárubňa</dt><dd>' + p.stena + ' mm → ' + P.esc(z) + '</dd></div></dl>';
    return '<dl class="qi-dl">' +
      '<div><dt>Rozmer</dt><dd>' + p.sirka + '/' + P.HTXT[p.vyska] + ', ' + P.NAMES[p.smer] + '</dd></div>' +
      '<div><dt>Farba krídla</dt><dd>' + P.NAMES[p.farba] + '</dd></div>' +
      '<div><dt>Farba zárubne</dt><dd>' + (bez ? '–' : P.NAMES[p.farba_zarubne]) + '</dd></div>' +
      '<div><dt>Závesy</dt><dd>' + (bez ? '–' : P.NAMES[p.zavesy || 'nikel']) + '</dd></div>' +
      '<div><dt>Výsuvný prah</dt><dd>' + (p.prah ? 'áno' : 'nie') + '</dd></div>' +
      '<div><dt>Vetracia mriežka</dt><dd>' + (P.MRIEZKA[p.mriezka || 'bez'] || p.mriezka) + '</dd></div>' +
      '<div><dt>Zárubňa</dt><dd>' + (bez ? 'bez zárubne' : p.stena + ' mm → ' + P.esc(z)) + '</dd></div></dl>';
  }
  function render() {
    const empty = !o.polozky.length;
    $('qEmpty').hidden = !empty; $('qBody').hidden = empty;
    if (empty) { $('qTotal').textContent = P.eur.format(0); return; }
    const byUid = {}; (res && res.polozky || []).forEach(r => { byUid[r.uid] = r; });
    $('qList').innerHTML = o.polozky.map((p, i) => {
      const r = byUid[p.uid];
      const lines = r && r.ok ? r.riadky.map(x => '<tr><td class="qk">' + P.esc(x.kod) + '</td><td>' + P.esc(x.nazov) + '</td><td class="n">' + x.mnozstvo +
        '</td><td class="n">' + P.eur.format(x.cena_ks) + '</td><td class="n">' + P.eur.format(x.spolu) + '</td></tr>').join('') : '';
      return '<article class="qi" data-uid="' + p.uid + '">' +
        '<div class="qi-img">' + P.obrazok(p, { rozmer: false }) + '</div><div class="qi-main">' +
        '<div class="qi-head"><span class="qi-n mono">' + String(i + 1).padStart(2, '0') + '</span>' +
        '<div class="qi-t"><h3>' + P.esc(p.nazov || (P.jeSlepa(p) ? 'Slepá zárubňa' : P.NAMES[p.kolekcia])) + '</h3><p>' +
          P.esc(P.jeSlepa(p) ? (p.nazov ? 'Slepá zárubňa · ' : '') + 'tunelová, bez závesov a protiplechu' : (p.nazov ? P.NAMES[p.kolekcia] + ' · ' : '') + P.NAMES[p.prevedenie] + ' dvere') + '</p></div>' +
        '<div class="qi-price">' + (r ? (r.ok ? P.eur.format(r.spolu) : '<span class="qi-err">bez ceny</span>') : '…') + '</div></div>' +
        detail(p, r) +
        (r && !r.ok ? '<p class="qi-msg">' + P.esc(r.chyba) + '</p>' : '') +
        (lines ? '<details class="qi-lines"><summary>Rozpis položky</summary><table><thead><tr><th>Kód</th><th>Položka</th><th class="n">Ks</th><th class="n">Cena/ks</th><th class="n">Spolu</th></tr></thead><tbody>' + lines + '</tbody></table></details>' : '') +
        '<div class="qi-actions">' +
          '<div class="qty qty-sm"><button type="button" data-a="minus" aria-label="Menej">−</button><input type="number" min="1" max="50" value="' + p.ks + '" aria-label="Počet kusov" data-a="ks"><span>ks</span><button type="button" data-a="plus" aria-label="Viac">+</button></div>' +
          '<a href="kalkulacka.html?upravit=' + encodeURIComponent(p.uid) + '" class="qi-btn">Upraviť</a>' +
          '<button type="button" class="qi-btn" data-a="dup">Duplikovať</button>' +
          '<button type="button" class="qi-btn qi-del" data-a="del">Odstrániť</button>' +
        '</div></div></article>';
    }).join('');
    // služby + súčty
    const sl = res && res.ok ? res.sluzby : [];
    $('qSluzby').innerHTML = sl.map(s => '<li><span>' + P.esc(s.nazov) + ' <small>' + s.mnozstvo + ' ' + (s.jednotka || 'ks') + ' × ' + P.eur.format(s.cena_ks) + '</small></span><span>' + P.eur.format(s.spolu) + '</span></li>').join('');
    $('qMedz').textContent = res && res.ok ? P.eur.format(res.medzisucet) : '–';
    $('qTotal').textContent = res && res.ok ? P.eur.format(res.spolu) : '–';
    $('qKs').textContent = P.pocetKusov(o) + ' ks';
    $('qDod').textContent = res && res.ok ? res.dodanie : '–';
    const ch = res && res.ok ? res.chyby : 0, up = res && res.ok && res.upozornenia ? res.upozornenia : [];
    const warn = (ch ? [ch === 1 ? '1 položka nemá cenu – v súčte nie je zahrnutá.' : ch + ' položky nemajú cenu – v súčte nie sú zahrnuté.'] : []).concat(up);
    $('qWarn').hidden = !warn.length;
    $('qWarn').textContent = warn.join(' ');
    $('qErr').hidden = !(res && !res.ok);
    if (res && !res.ok) $('qErr').textContent = res.chyba;
  }
  function recalc() {
    root.classList.add('is-loading');
    P.ocen(o).then(j => { res = j; root.classList.remove('is-loading'); render(); })
      .catch(e => { if (e && e.name === 'AbortError') return; res = { ok: false, chyba: 'Cenu sa nepodarilo načítať. Skúste to prosím znova.' }; root.classList.remove('is-loading'); render(); });
  }
  const change = () => { P.save(o); render(); clearTimeout(timer); timer = setTimeout(recalc, 200); };

  $('qList').addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b || b.tagName === 'INPUT') return;
    const art = b.closest('.qi'), i = o.polozky.findIndex(x => x.uid === art.dataset.uid), p = o.polozky[i];
    if (!p) return;
    const a = b.dataset.a;
    if (a === 'plus' || a === 'minus') p.ks = Math.min(50, Math.max(1, p.ks + (a === 'plus' ? 1 : -1)));
    if (a === 'dup') o.polozky.splice(i + 1, 0, Object.assign({}, p, { uid: P.uid() }));
    if (a === 'del') o.polozky.splice(i, 1);
    change();
  });
  $('qList').addEventListener('change', e => {
    if (e.target.dataset.a !== 'ks') return;
    const p = o.polozky.find(x => x.uid === e.target.closest('.qi').dataset.uid);
    if (p) { p.ks = Math.min(50, Math.max(1, parseInt(e.target.value, 10) || 1)); change(); }
  });
  $('qMontaz').addEventListener('change', e => { o.montaz = e.target.checked; change(); });
  $('qDoprava').addEventListener('change', e => { o.doprava = e.target.checked; $('qKmWrap').hidden = !o.doprava; change(); if (o.doprava) $('qKm').focus(); });
  $('qKm').addEventListener('input', e => { o.doprava_km = e.target.value; change(); });
  $('qClear').addEventListener('click', () => {
    if (!o.polozky.length) return;
    if (!confirm('Naozaj vymazať celú ponuku?')) return;
    o = P.novaPonuka(); P.save(o); res = null; head(); render();
  });
  const openAll = () => root.querySelectorAll('details').forEach(d => { d.dataset.was = d.open ? '1' : ''; d.open = true; });
  const restore = () => root.querySelectorAll('details').forEach(d => { d.open = d.dataset.was === '1'; });
  window.addEventListener('beforeprint', openAll);
  window.addEventListener('afterprint', restore);
  $('qPrint').addEventListener('click', () => { openAll(); window.print(); });

  // export pre objednávkový systém
  function exportData() {
    return {
      format: 'fortissima-ponuka', verzia: 1, id: o.id, vytvorena: o.vytvorena, exportovana: new Date().toISOString(),
      ukazka: P.DEMO, montaz: !!o.montaz, doprava: !!o.doprava,
      polozky: o.polozky.map((p, i) => {
        const r = (res && res.polozky || []).find(x => x.uid === p.uid);
        return Object.assign({ poradie: i + 1 }, p, { cena: r && r.ok ? { spolu: r.spolu, zarubna: r.zarubna, riadky: r.riadky } : null });
      }),
      doprava_km: o.doprava ? (parseFloat(o.doprava_km) || null) : null,
      sluzby: res && res.ok ? res.sluzby : [], spolu_s_dph: res && res.ok ? res.spolu : null, mena: 'EUR',
      poznamka: 'Kľučky nie sú súčasťou cenovej ponuky.'
    };
  }
  const download = (name, text, type) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
  // CSV pre import: kód výrobku rozložený do stĺpcov (otváranie, model, šírka, výška, orientácia, zámok…)
  const OTVARANIE = { falc: 'otváravé falcové', bez: 'otváravé bezfalcové', slepa: 'slepá (tunelová)' };
  const ZAVESY = { nikel: 'nikel', cierna: 'čierna' };
  const MODEL = { minimal: 'AK-1', vertikal: 'XK-1', prestige: 'QK-1' };
  function zamok(kod) {
    const k = String(kod || 'bez').toLowerCase(), m = k.match(/^(bb|pz|wc)-?(.*)$/);
    if (!m) return { zamok: 'bez otvoru', povrch: '' };
    return { zamok: m[1].toUpperCase(), povrch: m[2] === 'cierna' ? 'čierna' : m[2] };
  }
  $('qCsv').addEventListener('click', () => {
    const d = exportData(), q = v => {
      const t = String(v == null ? '' : v);
      return /[;"\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
    }, n = v => v == null || v === '' ? '' : String(v).replace('.', ',');
    // riadok = pozícia.poradie (1.1 krídlo, 1.2 zárubňa, 1.3 rozšírenie…) – drží súvislosť dverí, zárubne a elementov
    const COLS = ['ponuka', 'datum', 'pozicia', 'riadok', 'oznacenie_pozicie', 'typ_polozky', 'kod',
                  'otvaranie', 'model', 'kolekcia', 'sirka', 'vyska', 'orientacia', 'farba',
                  'zamok', 'povrch_kovania', 'vysuvny_prah', 'vetracia_mriezka', 'typ_zarubne', 'zavesy', 'rozsirenie', 'hrubka_steny_mm',
                  'mnozstvo', 'jednotka', 'cena_ks_s_dph', 'spolu_s_dph', 'nazov'];
    const rows = [COLS.join(';')];
    const datum = d.vytvorena.slice(0, 10);
    d.polozky.forEach(p => {
      const slepa = P.jeSlepa(p), soZar = slepa || p.so_zarubnou !== false, zm = zamok(p.kovanie);
      (p.cena ? p.cena.riadky : []).forEach((x, i) => {
        const typ = x.typ || '';
        const casti = x.kod.split('-'), kr = typ === 'KRIDLO', zar = typ === 'ZARUBNA' || typ === 'ROZSIRENIE';
        const r = {
          ponuka: d.id, datum, pozicia: p.poradie, riadok: p.poradie + '.' + (i + 1), oznacenie_pozicie: p.nazov, typ_polozky: typ, kod: x.kod,
          otvaranie: OTVARANIE[slepa ? 'slepa' : p.prevedenie], model: kr ? MODEL[p.kolekcia] : '', kolekcia: kr ? P.NAMES[p.kolekcia] : '',
          sirka: p.sirka, vyska: P.HTXT[p.vyska], orientacia: typ === 'ROZSIRENIE' ? '' : slepa ? 'slepá' : P.NAMES[p.smer],
          farba: kr ? P.NAMES[p.farba] : zar ? P.NAMES[p.farba_zarubne] : '',
          zamok: kr ? zm.zamok : '', povrch_kovania: kr ? zm.povrch : '', vysuvny_prah: kr ? (p.prah ? 'áno' : 'nie') : '',
          vetracia_mriezka: kr ? P.MRIEZKA[x.mriezka || p.mriezka || 'bez'] || 'bez' : '',
          typ_zarubne: typ === 'ZARUBNA' ? casti[0] : '',
          zavesy: typ === 'ZARUBNA' ? (slepa ? 'bez' : ZAVESY[x.zavesy || p.zavesy || 'nikel']) : '', rozsirenie: typ === 'ROZSIRENIE' ? casti[0] : '',
          hrubka_steny_mm: typ === 'ZARUBNA' && soZar ? p.stena : '',
          mnozstvo: x.mnozstvo, jednotka: 'ks', cena_ks_s_dph: n(x.cena_ks), spolu_s_dph: n(x.spolu), nazov: x.nazov
        };
        rows.push(COLS.map(c => q(r[c])).join(';'));
      });
    });
    d.sluzby.forEach(sv => {
      const r = { ponuka: d.id, datum, typ_polozky: 'SLUZBA', kod: sv.kod, mnozstvo: sv.mnozstvo, jednotka: sv.jednotka || '',
                  cena_ks_s_dph: n(sv.cena_ks), spolu_s_dph: n(sv.spolu), nazov: sv.nazov };
      rows.push(COLS.map(c => q(r[c])).join(';'));
    });
    download(d.id + '.csv', '﻿' + rows.join('\r\n'), 'text/csv;charset=utf-8');
  });
  $('qJson').addEventListener('click', () => { const d = exportData(); download(d.id + '.json', JSON.stringify(d, null, 2), 'application/json'); });

  // odoslať ako dopyt → kontaktný formulár s textom aj strojovými dátami
  $('qSend').addEventListener('click', () => {
    const d = exportData();
    const lines = ['Cenová ponuka ' + d.id + (P.DEMO ? ' (ukážka, ilustračné ceny)' : ''), ''];
    d.polozky.forEach(p => {
      lines.push(p.poradie + '. ' + (p.nazov ? p.nazov + ' – ' : '') + P.popis(p) + ', ' + p.ks + ' ks');
      const zarTxt = 'zárubňa ' + P.NAMES[p.farba_zarubne] + ', stena ' + p.stena + ' mm' + (p.cena ? ' (' + p.cena.zarubna + ')' : '');
      lines.push('   ' + (P.jeSlepa(p) ? 'slepá ' + zarTxt + ', bez závesov a protiplechu' :
                 'krídlo ' + P.NAMES[p.farba] + (p.prah ? ' s výsuvným prahom' : '') +
                 (p.mriezka && p.mriezka !== 'bez' ? ', vetracia mriežka ' + P.MRIEZKA[p.mriezka] : '') + (p.so_zarubnou === false ? ', bez zárubne' : ', ' + zarTxt + ', závesy ' + P.NAMES[p.zavesy || 'nikel'])) +
                 (p.cena ? ' – ' + P.eur.format(p.cena.spolu) : ' – bez ceny'));
    });
    if (d.sluzby.length) lines.push('', 'Služby: ' + d.sluzby.map(s => s.nazov + ' ' + P.eur.format(s.spolu)).join(', '));
    if (d.doprava_km) lines.push('Vzdialenosť pre dopravu: ' + d.doprava_km + ' km');
    if (d.spolu_s_dph != null) lines.push('Orientačná cena spolu: ' + P.eur.format(d.spolu_s_dph) + ' s DPH');
    lines.push('Kľučky nie sú súčasťou cenovej ponuky.');
    const kol = [...new Set(o.polozky.map(p => P.jeSlepa(p) ? 'Slepá zárubňa' : P.NAMES[p.kolekcia]))].join(', ');
    try { sessionStorage.setItem('fortissimaDopyt', JSON.stringify({ kolekcia: kol, text: lines.join('\n'), data: d })); } catch (e) {}
    location.href = 'kontakt.html#formular';
  });

  window.addEventListener('storage', () => { o = P.load(); head(); render(); recalc(); });
  head(); render(); recalc();
})();


// ===== KONTAKT: predvyplnenie z kalkulácie / ponuky =====
(function () {
  const msg = document.getElementById('msg');
  if (!msg) return;
  let d = null;
  try { d = JSON.parse(sessionStorage.getItem('fortissimaDopyt') || 'null'); sessionStorage.removeItem('fortissimaDopyt'); } catch (e) {}
  if (!d) return;
  msg.value = d.text + '\n\n';
  msg.rows = 12;
  const col = document.getElementById('collection');
  if (col && d.kolekcia) col.value = d.kolekcia;
  const data = document.getElementById('ponukaJson');
  if (data && d.data) data.value = JSON.stringify(d.data);
  const note = document.getElementById('prefillNote');
  if (note) note.hidden = false;
})();
