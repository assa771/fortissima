/* =====================================================================
   KRESLENIE – jednoduchý vektorový editor nákresov (SVG)
   Nákres sa ukladá ako zoznam tvarov (čiara, obdĺžnik, elipsa, kóta, text)
   a z neho sa skladá SVG – pár stoviek bajtov, ostrý pri každej veľkosti.
   ===================================================================== */
'use strict';
(function () {
  const e = F.esc;
  const W = 400, H = 300, MRIEZKA = 10;
  const FARBY = { '#1F1B16': 'čierna', '#8B5A2B': 'drevo', '#6E2620': 'bordová', '#5B6B7A': 'oceľ', '#9A9EA3': 'nikel', '#B08D57': 'mosadz', '#3F6B4F': 'zelená' };
  const VYPLNE = { none: 'bez výplne', '#FFFFFF': 'biela', '#F4F3F0': 'biela (krídlo)', '#D9CDBD': 'kašmír', '#E9E5DC': 'svetlá', '#D9DBDD': 'nikel', '#34302D': 'čierna', '#C9A97A': 'drevo', '#B9D3E8': 'sklo' };

  /** Tvary → SVG */
  F.tvaryNaSvg = (tvary, o = {}) => {
    const dash = t => t.d ? ` stroke-dasharray="${t.w * 3} ${t.w * 2}"` : '';
    const g = tvary.map((t, i) => {
      const id = o.edit ? ` data-i="${i}"` : '', st = `stroke="${t.s || '#1F1B16'}" stroke-width="${t.w || 1.5}"${dash(t)}`;
      if (t.t === 'l') return `<line${id} x1="${t.x1}" y1="${t.y1}" x2="${t.x2}" y2="${t.y2}" ${st} stroke-linecap="round"/>`;
      if (t.t === 'r') return `<rect${id} x="${Math.min(t.x1, t.x2)}" y="${Math.min(t.y1, t.y2)}" width="${Math.abs(t.x2 - t.x1)}" height="${Math.abs(t.y2 - t.y1)}" rx="${t.rx || 0}" fill="${t.f || 'none'}" ${st}/>`;
      if (t.t === 'e') return `<ellipse${id} cx="${(t.x1 + t.x2) / 2}" cy="${(t.y1 + t.y2) / 2}" rx="${Math.abs(t.x2 - t.x1) / 2}" ry="${Math.abs(t.y2 - t.y1) / 2}" fill="${t.f || 'none'}" ${st}/>`;
      if (t.t === 'x') return `<text${id} x="${t.x1}" y="${t.y1}" font-family="Work Sans, Arial, sans-serif" font-size="${t.fs || 12}" fill="${t.s || '#1F1B16'}">${e(t.txt || '')}</text>`;
      if (t.t === 'k') {   // kóta: čiara s koncovými značkami a textom v strede
        const dx = t.x2 - t.x1, dy = t.y2 - t.y1, L = Math.hypot(dx, dy) || 1, nx = -dy / L * 5, ny = dx / L * 5, mx = (t.x1 + t.x2) / 2, my = (t.y1 + t.y2) / 2;
        const uh = Math.atan2(dy, dx) * 180 / Math.PI, rot = uh > 90 || uh < -90 ? uh + 180 : uh, c = t.s || '#8B5A2B';
        return `<g${id}><line x1="${t.x1}" y1="${t.y1}" x2="${t.x2}" y2="${t.y2}" stroke="${c}" stroke-width="1"/><line x1="${t.x1 - nx}" y1="${t.y1 - ny}" x2="${t.x1 + nx}" y2="${t.y1 + ny}" stroke="${c}" stroke-width="1"/><line x1="${t.x2 - nx}" y1="${t.y2 - ny}" x2="${t.x2 + nx}" y2="${t.y2 + ny}" stroke="${c}" stroke-width="1"/><text x="${mx}" y="${my - 3}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10" fill="${c}" transform="rotate(${rot} ${mx} ${my})">${e(t.txt || '')}</text><line x1="${t.x1}" y1="${t.y1}" x2="${t.x2}" y2="${t.y2}" stroke="transparent" stroke-width="8"/></g>`;
      }
      return '';
    }).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${o.w || W}" height="${o.h || H}">${o.pozadie || ''}${g}</svg>`;
  };
  F.svgDataUrl = svg => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);

  /** Otvorí editor. vstup = { tvary, podklad (SVG reťazec ilustračného nákresu), titul }, ulozit(tvary, svg) */
  F.editorNakresu = (vstup, ulozit) => {
    let tvary = JSON.parse(JSON.stringify(vstup.tvary || [])), hist = [], nastroj = 'l', vyber = -1, kreslim = null, posun = null;
    const st = { s: '#1F1B16', f: 'none', w: 1.5, d: false, prichytit: true, podklad: !!vstup.podklad };
    const box = document.createElement('div'); box.className = 'kr-wrap no-print';
    const nb = (k, txt, tip) => `<button type="button" class="kr-n" data-n="${k}" title="${tip}">${txt}</button>`;
    box.innerHTML = `<div class="kr-box"><header><h2>${e(vstup.titul || 'Nákres')}</h2><span class="muted small">kreslite myšou · Shift = vodorovne/zvislo · Delete = zmazať · Ctrl+Z = späť</span><button class="x" data-k="zavriet">×</button></header>
      <div class="kr-main"><aside class="kr-tools">
        <div class="kr-grp">${nb('v', '⬚ výber', 'Vybrať a posunúť tvar')}${nb('l', '╱ čiara', 'Čiara')}${nb('r', '▭ obdĺžnik', 'Obdĺžnik')}${nb('e', '◯ elipsa', 'Elipsa / kruh')}${nb('k', '↔ kóta', 'Kóta s rozmerom')}${nb('x', 'T text', 'Text')}</div>
        <label>Čiara<select id="krS">${Object.entries(FARBY).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
        <label>Výplň<select id="krF">${Object.entries(VYPLNE).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
        <label>Hrúbka<select id="krW"><option value="0.75">tenká</option><option value="1.5" selected>stredná</option><option value="3">hrubá</option><option value="5">veľmi hrubá</option></select></label>
        <label class="chk-line"><input type="checkbox" id="krD"> prerušovaná</label>
        <label class="chk-line"><input type="checkbox" id="krP" checked> prichytiť k mriežke</label>
        ${vstup.podklad ? '<label class="chk-line"><input type="checkbox" id="krB" checked> podklad – ilustračný nákres</label>' : ''}
        <div class="kr-grp"><button type="button" class="btn sm ghost" data-k="spat">↶ Späť</button><button type="button" class="btn sm ghost" data-k="zmaz">Zmazať vybraný</button><button type="button" class="btn sm ghost" data-k="dopredu">Dať dopredu</button><button type="button" class="btn sm ghost neg" data-k="vsetko">Vymazať všetko</button></div>
        <p class="muted small" id="krInfo"></p>
      </aside>
      <div class="kr-plocha"><svg id="krSvg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet"></svg></div></div>
      <footer><span class="muted small" id="krVel"></span><button type="button" class="btn ghost" data-k="zavriet">Zrušiť</button><button type="button" class="btn" data-k="ulozit">Uložiť nákres</button></footer></div>`;
    document.body.appendChild(box);
    const svg = box.querySelector('#krSvg'), info = box.querySelector('#krInfo');
    const zaloz = () => { hist.push(JSON.stringify(tvary)); if (hist.length > 60) hist.shift(); };
    const mriezka = () => { let g = `<defs><pattern id="krM" width="${MRIEZKA}" height="${MRIEZKA}" patternUnits="userSpaceOnUse"><path d="M${MRIEZKA} 0H0V${MRIEZKA}" fill="none" stroke="#E6E1D6" stroke-width=".5"/></pattern></defs><rect width="${W}" height="${H}" fill="#fff"/><rect width="${W}" height="${H}" fill="url(#krM)"/>`;
      if (st.podklad && vstup.podklad) g += `<image href="${F.svgDataUrl(vstup.podklad)}" x="0" y="0" width="${W}" height="${H}" opacity=".28" preserveAspectRatio="xMidYMid meet"/>`; return g; };
    const kresli = () => {
      const inner = F.tvaryNaSvg(tvary, { edit: true }).replace(/^<svg[^>]*>|<\/svg>$/g, '');
      let sel = '';
      if (vyber >= 0 && tvary[vyber]) { const t = tvary[vyber], x = Math.min(t.x1, t.x2 ?? t.x1), y = Math.min(t.y1, t.y2 ?? t.y1) - (t.t === 'x' ? (t.fs || 12) : 0), w = Math.abs((t.x2 ?? t.x1 + 40) - t.x1), h = Math.abs((t.y2 ?? t.y1) - t.y1) + (t.t === 'x' ? (t.fs || 12) : 0);
        sel = `<rect x="${x - 4}" y="${y - 4}" width="${w + 8}" height="${h + 8}" fill="none" stroke="#2F7DE1" stroke-dasharray="4 3" pointer-events="none"/>`; }
      svg.innerHTML = mriezka() + inner + sel;
      const vel = new Blob([F.tvaryNaSvg(tvary)]).size;
      box.querySelector('#krVel').textContent = `${tvary.length} tvarov · ${vel < 1024 ? vel + ' B' : (vel / 1024).toFixed(1) + ' kB'} (fotka by mala desiatky až stovky kB)`;
      box.querySelectorAll('.kr-n').forEach(b => b.classList.toggle('on', b.dataset.n === nastroj));
      info.textContent = vyber >= 0 ? 'Vybraný tvar: zmena farby/hrúbky sa použije naň · dvojklik na text/kótu = upraviť text' : ({ v: 'Kliknite na tvar a ťahajte ho.', l: 'Ťahajte od začiatku po koniec čiary.', r: 'Ťahajte po uhlopriečke.', e: 'Ťahajte po uhlopriečke (Shift = kruh).', k: 'Ťahajte medzi dvoma bodmi, potom zadajte rozmer.', x: 'Kliknite tam, kde má byť text.' }[nastroj]);
    };
    const bod = ev => { const p = svg.createSVGPoint(); p.x = ev.clientX; p.y = ev.clientY; const q = p.matrixTransform(svg.getScreenCTM().inverse()); const r = v => st.prichytit ? Math.round(v / (MRIEZKA / 2)) * (MRIEZKA / 2) : Math.round(v * 2) / 2; return { x: Math.max(0, Math.min(W, r(q.x))), y: Math.max(0, Math.min(H, r(q.y))) }; };
    svg.addEventListener('pointerdown', ev => {
      const b = bod(ev), hit = ev.target.closest('[data-i]');
      if (nastroj === 'v') { vyber = hit ? +hit.dataset.i : -1; if (vyber >= 0) { zaloz(); posun = { b, t: JSON.parse(JSON.stringify(tvary[vyber])) }; svg.setPointerCapture(ev.pointerId); } kresli(); return; }
      if (nastroj === 'x') { const txt = prompt('Text:'); if (txt) { zaloz(); tvary.push({ t: 'x', x1: b.x, y1: b.y, txt, s: st.s, fs: 12 }); vyber = tvary.length - 1; } kresli(); return; }
      zaloz(); kreslim = { t: nastroj, x1: b.x, y1: b.y, x2: b.x, y2: b.y, s: nastroj === 'k' ? '#8B5A2B' : st.s, f: st.f, w: st.w, d: st.d }; tvary.push(kreslim); vyber = -1; svg.setPointerCapture(ev.pointerId); kresli();
    });
    svg.addEventListener('pointermove', ev => {
      if (!kreslim && !posun) return;
      const b = bod(ev);
      if (posun) { const dx = b.x - posun.b.x, dy = b.y - posun.b.y, t = tvary[vyber], o = posun.t; t.x1 = o.x1 + dx; t.y1 = o.y1 + dy; if (o.x2 != null) { t.x2 = o.x2 + dx; t.y2 = o.y2 + dy; } kresli(); return; }
      let x = b.x, y = b.y;
      if (ev.shiftKey && (kreslim.t === 'l' || kreslim.t === 'k')) { if (Math.abs(x - kreslim.x1) > Math.abs(y - kreslim.y1)) y = kreslim.y1; else x = kreslim.x1; }
      if (ev.shiftKey && (kreslim.t === 'r' || kreslim.t === 'e')) { const d = Math.max(Math.abs(x - kreslim.x1), Math.abs(y - kreslim.y1)); x = kreslim.x1 + Math.sign(x - kreslim.x1 || 1) * d; y = kreslim.y1 + Math.sign(y - kreslim.y1 || 1) * d; }
      kreslim.x2 = x; kreslim.y2 = y; kresli();
    });
    svg.addEventListener('pointerup', () => {
      if (posun) { posun = null; return; }
      if (!kreslim) return;
      const t = kreslim; kreslim = null;
      if (Math.hypot(t.x2 - t.x1, t.y2 - t.y1) < 3) { tvary.pop(); hist.pop(); kresli(); return; }
      if (t.t === 'k') { const odhad = Math.round(Math.hypot(t.x2 - t.x1, t.y2 - t.y1)); const txt = prompt('Rozmer (napr. 850 alebo 2055 mm):', String(odhad)); if (txt == null) { tvary.pop(); hist.pop(); } else t.txt = txt; }
      vyber = tvary.indexOf(t); kresli();
    });
    svg.addEventListener('dblclick', ev => { const hit = ev.target.closest('[data-i]'); if (!hit) return; const t = tvary[+hit.dataset.i]; if (t.t !== 'x' && t.t !== 'k') return; const v = prompt(t.t === 'k' ? 'Rozmer:' : 'Text:', t.txt || ''); if (v != null) { zaloz(); t.txt = v; kresli(); } });
    const pouziNaVyber = (k, v) => { st[k] = v; if (vyber >= 0 && tvary[vyber]) { zaloz(); tvary[vyber][k] = v; kresli(); } };
    box.querySelector('#krS').onchange = ev => pouziNaVyber('s', ev.target.value);
    box.querySelector('#krF').onchange = ev => pouziNaVyber('f', ev.target.value);
    box.querySelector('#krW').onchange = ev => pouziNaVyber('w', +ev.target.value);
    box.querySelector('#krD').onchange = ev => pouziNaVyber('d', ev.target.checked);
    box.querySelector('#krP').onchange = ev => { st.prichytit = ev.target.checked; };
    const kb = box.querySelector('#krB'); if (kb) kb.onchange = ev => { st.podklad = ev.target.checked; kresli(); };
    const zavri = () => { document.removeEventListener('keydown', klavesy); box.remove(); };
    const klavesy = ev => {
      if (ev.target.closest('input,select,textarea')) return;
      if ((ev.key === 'Delete' || ev.key === 'Backspace') && vyber >= 0) { ev.preventDefault(); zaloz(); tvary.splice(vyber, 1); vyber = -1; kresli(); }
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') { ev.preventDefault(); if (hist.length) { tvary = JSON.parse(hist.pop()); vyber = -1; kresli(); } }
      if (ev.key === 'Escape') { vyber = -1; kresli(); }
      const n = { v: 'v', l: 'l', r: 'r', e: 'e', k: 'k', t: 'x' }[ev.key.toLowerCase()]; if (n && !ev.ctrlKey && !ev.metaKey) { nastroj = n; vyber = -1; kresli(); }
    };
    document.addEventListener('keydown', klavesy);
    box.addEventListener('click', ev => {
      const n = ev.target.closest('[data-n]'); if (n) { nastroj = n.dataset.n; if (nastroj !== 'v') vyber = -1; kresli(); return; }
      const k = ev.target.closest('[data-k]'); if (!k) return;
      const a = k.dataset.k;
      if (a === 'zavriet') { if (JSON.stringify(tvary) === JSON.stringify(vstup.tvary || []) || confirm('Zahodiť zmeny v nákrese?')) zavri(); }
      if (a === 'spat' && hist.length) { tvary = JSON.parse(hist.pop()); vyber = -1; kresli(); }
      if (a === 'zmaz' && vyber >= 0) { zaloz(); tvary.splice(vyber, 1); vyber = -1; kresli(); }
      if (a === 'dopredu' && vyber >= 0) { zaloz(); tvary.push(tvary.splice(vyber, 1)[0]); vyber = tvary.length - 1; kresli(); }
      if (a === 'vsetko' && tvary.length && confirm('Vymazať celý nákres?')) { zaloz(); tvary = []; vyber = -1; kresli(); }
      if (a === 'ulozit') { if (!tvary.length) return F.ui.toast('Nákres je prázdny', 'err'); zavri(); ulozit(tvary, F.tvaryNaSvg(tvary)); }
    });
    kresli();
  };
})();
