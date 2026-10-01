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

// ===== KALKULÁCIA =====
(function () {
  const form = document.getElementById('calcForm');
  if (!form) return;
  const API = 'api/cena.php';
  const $ = id => document.getElementById(id);
  const sum = $('sum'), items = $('sumItems'), total = $('sumTotal'), barTotal = $('sumBarTotal');
  const errBox = $('sumErr'), btn = $('sumSend');
  const eur = new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR' });
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const NAMES = { minimal: 'Minimal', vertikal: 'Vertikal', prestige: 'Prestige', falc: 'falcové', bez: 'bezfalcové',
                  biela: 'biela', kasmirova: 'kašmírová', lave: 'ľavé', prave: 'pravé' };
  const H = { '197': 1970, '2055': 2055, '210': 2100 }, HTXT = { '197': '197', '2055': '205,5', '210': '210' };
  let last = null, ctrl = null, timer = null;

  // predvoľba kolekcie z odkazu (kalkulacka.html?kolekcia=prestige)
  try {
    const k = new URLSearchParams(location.search).get('kolekcia');
    const r = k && form.querySelector('input[name="kolekcia"][value="' + CSS.escape(k) + '"]');
    if (r) r.checked = true;
  } catch (e) {}

  const val = n => { const el = form.querySelector('[name="' + n + '"]:checked') || form.elements[n]; return el ? el.value : ''; };
  const state = () => ({
    kolekcia: val('kolekcia'), prevedenie: val('prevedenie'), farba: val('farba'), sirka: val('sirka'), vyska: val('vyska'),
    smer: val('smer'), stena: form.elements.stena.value, kovanie: form.elements.kovanie.value,
    ks: form.elements.ks.value, montaz: form.elements.montaz.checked ? '1' : '0', doprava: form.elements.doprava.checked ? '1' : '0'
  });

  function hints(s) {
    const N = +s.sirka * 10, V1 = H[s.vyska];
    $('calcDims').innerHTML = 'Priechod <b>' + (N + 6) + ' × ' + V1 + ' mm</b> · stavebný otvor <b>' + (N + 80) + '–' + (N + 110) +
      ' × ' + (V1 + 40) + '–' + (V1 + 60) + ' mm</b>';
    const d = parseInt(s.stena, 10);
    let t = 'Zadajte hrúbku steny od 80 do 400 mm.';
    if (!isNaN(d) && d >= 80 && d <= 400 && typeof frameForWall === 'function') {
      const h = frameForWall(d)[0], e = extLabel(h.ext);
      t = 'Zárubňa <b>F' + h.F + (e ? ' + ' + e : '') + '</b> · rozsah ' + h.min + '–' + h.max + ' mm';
    }
    $('stenaOut').innerHTML = t;
  }

  function showError(msg) {
    errBox.textContent = msg; errBox.hidden = false;
    items.innerHTML = ''; total.textContent = '–'; barTotal.textContent = '–';
    $('sumDod').textContent = '–'; $('sumZar').textContent = '–';
  }

  function calc() {
    const s = state();
    hints(s);
    if (location.protocol === 'file:') {
      showError('Cena sa počíta na serveri. Kalkulácia funguje po nahratí webu na hosting s PHP.');
      return;
    }
    if (ctrl) ctrl.abort();
    ctrl = new AbortController();
    sum.classList.add('is-loading');
    const q = new URLSearchParams(s); q.delete('smer');
    fetch(API + '?' + q.toString(), { signal: ctrl.signal, headers: { 'Accept': 'application/json' } })
      .then(r => r.json().catch(() => ({ ok: false, chyba: 'Server nevrátil platnú odpoveď.' })))
      .then(j => {
        sum.classList.remove('is-loading');
        if (!j.ok) { last = null; showError(j.chyba || 'Cenu sa nepodarilo vypočítať.'); return; }
        errBox.hidden = true;
        last = { s, j };
        items.innerHTML = j.polozky.map(p =>
          '<li><span>' + esc(p.nazov) + '</span><span class="p">' + eur.format(p.spolu) + '</span>' +
          '<span class="q">' + p.mnozstvo + ' × ' + eur.format(p.cena_ks) + '</span></li>').join('');
        total.textContent = eur.format(j.spolu);
        barTotal.textContent = eur.format(j.spolu);
        $('sumDod').textContent = j.dodanie;
        $('sumZar').textContent = j.zarubna + ' (' + j.rozsah_steny + ')';
      })
      .catch(e => {
        if (e.name === 'AbortError') return;
        sum.classList.remove('is-loading');
        showError('Cenu sa nepodarilo načítať. Skúste to prosím znova alebo nám pošlite dopyt.');
      });
  }
  const schedule = () => { clearTimeout(timer); timer = setTimeout(calc, 180); };

  // zoznam kovania zo servera (bez cien)
  if (location.protocol !== 'file:') {
    fetch(API + '?moznosti=1').then(r => r.json()).then(j => {
      if (!j.ok) return;
      const sel = form.elements.kovanie, cur = sel.value;
      sel.innerHTML = j.kovanie.map(k => '<option value="' + esc(k.kod) + '">' + esc(k.nazov) + '</option>').join('');
      if ([...sel.options].some(o => o.value === cur)) sel.value = cur;
      schedule();
    }).catch(() => {});
  }

  form.addEventListener('input', schedule);
  form.addEventListener('change', schedule);
  form.querySelectorAll('.qty button').forEach(b => b.addEventListener('click', () => {
    const i = form.elements.ks, v = Math.min(50, Math.max(1, (parseInt(i.value, 10) || 1) + +b.dataset.q));
    i.value = v; schedule();
  }));

  // odoslanie dopytu → kontaktný formulár s vyplnenou správou
  btn.addEventListener('click', () => {
    const s = state();
    const lines = [
      'Dopyt z kalkulačky',
      'Kolekcia: ' + NAMES[s.kolekcia] + ', ' + NAMES[s.prevedenie] + ', ' + NAMES[s.farba],
      'Rozmer: ' + s.sirka + '/' + HTXT[s.vyska] + ', ' + NAMES[s.smer],
      'Hrúbka steny: ' + s.stena + ' mm' + (last ? ' (zárubňa ' + last.j.zarubna + ')' : ''),
      'Kovanie: ' + form.elements.kovanie.options[form.elements.kovanie.selectedIndex].text,
      'Počet: ' + s.ks + ' ks · montáž: ' + (s.montaz === '1' ? 'áno' : 'nie') + ' · doprava: ' + (s.doprava === '1' ? 'áno' : 'nie')
    ];
    if (last) lines.push('Orientačná cena: ' + eur.format(last.j.spolu) + ' s DPH');
    try { sessionStorage.setItem('fortissimaDopyt', JSON.stringify({ kolekcia: NAMES[s.kolekcia], text: lines.join('\n') })); } catch (e) {}
    location.href = 'kontakt.html#formular';
  });

  // mobil: spodná lišta s cenou sa skryje, keď je súhrn na obrazovke
  const bar = $('sumBar');
  if (bar && 'IntersectionObserver' in window) {
    new IntersectionObserver(es => es.forEach(e => bar.classList.toggle('is-hidden', e.isIntersecting))).observe(sum);
  }
  calc();
})();

// ===== KONTAKT: predvyplnenie z kalkulačky =====
(function () {
  const msg = document.getElementById('msg');
  if (!msg) return;
  let d = null;
  try { d = JSON.parse(sessionStorage.getItem('fortissimaDopyt') || 'null'); sessionStorage.removeItem('fortissimaDopyt'); } catch (e) {}
  if (!d) return;
  msg.value = d.text + '\n\n';
  msg.rows = 9;
  const col = document.getElementById('collection');
  if (col && d.kolekcia) col.value = d.kolekcia;
  const note = document.getElementById('prefillNote');
  if (note) note.hidden = false;
})();
