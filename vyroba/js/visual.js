/* =====================================================================
   Vizuály: krídlo, zárubňa, profil, rezný plán, čiarový kód, nákladka
   Všetko ako inline SVG – tlačí sa ostro a nepotrebuje obrázky.
   ===================================================================== */
'use strict';
(function () {
  const C = { ink: '#1F1B16', soft: '#5B5147', faint: '#8B8172', wood: '#8B5A2B', brass: '#B08D57', ox: '#6E2620', line: '#CFC8BA', paper: '#F6F4EE', ok: '#3F6B4F' };
  F.C = C;

  /* ---------- čiarový kód (Code128) ---------- */
  F.barcode = (text, o = {}) => {
    try {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      JsBarcode(svg, text, { format: 'CODE128', width: o.w || 1.3, height: o.h || 34, displayValue: o.text !== false, fontSize: o.fs || 11, font: 'JetBrains Mono', margin: 0, textMargin: 2, background: 'transparent', lineColor: C.ink });
      svg.setAttribute('class', 'bc');
      return svg.outerHTML;
    } catch (e) { return `<span class="bc-err">${F.esc(text)}</span>`; }
  };

  const dimH = (x1, x2, y, txt, col = C.wood) => `<g class="dim"><line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${col}" stroke-width=".7"/><line x1="${x1}" y1="${y - 3}" x2="${x1}" y2="${y + 3}" stroke="${col}" stroke-width=".7"/><line x1="${x2}" y1="${y - 3}" x2="${x2}" y2="${y + 3}" stroke="${col}" stroke-width=".7"/><text x="${(x1 + x2) / 2}" y="${y - 3}" text-anchor="middle" fill="${col}">${txt}</text></g>`;
  const dimV = (x, y1, y2, txt, col = C.wood) => `<g class="dim"><line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="${col}" stroke-width=".7"/><line x1="${x - 3}" y1="${y1}" x2="${x + 3}" y2="${y1}" stroke="${col}" stroke-width=".7"/><line x1="${x - 3}" y1="${y2}" x2="${x + 3}" y2="${y2}" stroke="${col}" stroke-width=".7"/><text x="${x - 4}" y="${(y1 + y2) / 2}" text-anchor="middle" fill="${col}" transform="rotate(-90 ${x - 4} ${(y1 + y2) / 2})">${txt}</text></g>`;

  /* ---------- krídlo (pohľad zo strany otvárania) ---------- */
  F.svgKridlo = (p, o = {}) => {
    const k = F.kridlo(p), H = o.h || 170, s = H / k.polotovarH;
    const w = k.w * s, h = k.h * s, hp = k.polotovarH * s, mx = 26, my = 16;
    const W = w + mx + 14, HH = hp + my + 14;
    const fill = F.FARBY[p.farba]?.hex || '#eee';
    const lave = p.smer !== 'prave';
    const hx = lave ? mx : mx + w;                 // strana závesov
    const lx = lave ? mx + w - 9 : mx + 9;         // strana zámku
    let g = '';
    // polotovar (prerušovane) a prirezanie (šrafované)
    if (k.prirez > 0) {
      g += `<rect x="${mx}" y="${my + h}" width="${w}" height="${hp - h}" fill="url(#hatch)" stroke="${C.ox}" stroke-dasharray="2 2" stroke-width=".7"/>`;
      g += `<text x="${mx + w / 2}" y="${my + h + (hp - h) / 2 + 3}" text-anchor="middle" class="t-ox">−${k.prirez}</text>`;
    }
    g += `<rect x="${mx}" y="${my}" width="${w}" height="${h}" fill="${fill}" stroke="${C.ink}" stroke-width="1"/>`;
    if (k.falc) g += `<rect x="${mx + 3}" y="${my + 3}" width="${w - 6}" height="${h - 3}" fill="none" stroke="${C.faint}" stroke-width=".5" stroke-dasharray="3 2"/>`;
    // rámové krídla – vlysy
    if (p.kolekcia === 'vertikal') {
      const st = 120 * s, tr = 120 * s, br = 145 * s;
      g += `<rect x="${mx + st}" y="${my + tr}" width="${w - 2 * st}" height="${h - tr - br}" fill="none" stroke="${C.soft}" stroke-width=".6"/>`;
      for (let i = 1; i < 4; i++) { const x = mx + st + (w - 2 * st) * i / 4; g += `<line x1="${x}" y1="${my + tr}" x2="${x}" y2="${my + h - br}" stroke="${C.soft}" stroke-width=".5"/>`; }
    } else if (p.kolekcia === 'prestige') {
      const st = 120 * s, tr = 120 * s, br = 145 * s, mid = 110 * s, ih = (h - tr - br - 2 * mid) / 3;
      for (let i = 0; i < 3; i++) g += `<rect x="${mx + st}" y="${my + tr + i * (ih + mid)}" width="${w - 2 * st}" height="${ih}" fill="none" stroke="${C.soft}" stroke-width=".6"/>`;
    }
    // závesy
    [250, k.h / 2 + 100, k.h - 250].forEach(d => { const y = my + h - d * s; g += `<rect x="${hx - (lave ? 3 : 0)}" y="${y - 6}" width="3" height="12" fill="${p.zavesy === 'cierna' ? C.ink : '#9A9A9A'}"/>`; });
    // zámok (1000 mm od spodu krídla)
    if (p.kovanie && p.kovanie !== 'bez') {
      const y = my + h - 1000 * s, cz = /cierna/.test(p.kovanie) ? C.ink : '#9A9A9A';
      g += `<circle cx="${lx}" cy="${y}" r="3" fill="none" stroke="${cz}" stroke-width="1.2"/><line x1="${lx}" y1="${y}" x2="${lx + (lave ? -11 : 11)}" y2="${y}" stroke="${cz}" stroke-width="1.6" stroke-linecap="round"/>`;
      if (/^wc/.test(p.kovanie)) g += `<circle cx="${lx}" cy="${y + 9}" r="1.8" fill="${cz}"/>`; else g += `<rect x="${lx - 1}" y="${y + 7}" width="2" height="4" fill="${cz}"/>`;
    }
    // mriežka
    if (p.mriezka && p.mriezka !== 'bez') {
      const mw = Math.min(400 * s, w * 0.6), y = my + h - (k.ramove ? 72 : 120) * s - 30 * s;
      const cm = { biela: '#fff', hlinik: '#B8B8B8', cierna: C.ink }[p.mriezka];
      g += `<rect x="${mx + (w - mw) / 2}" y="${y}" width="${mw}" height="${60 * s}" fill="${cm}" stroke="${C.soft}" stroke-width=".5"/>`;
      for (let i = 1; i < 6; i++) g += `<line x1="${mx + (w - mw) / 2 + 3}" y1="${y + 60 * s * i / 6}" x2="${mx + (w + mw) / 2 - 3}" y2="${y + 60 * s * i / 6}" stroke="${C.soft}" stroke-width=".3"/>`;
    }
    // prah
    if (p.prah) g += `<rect x="${mx + 6}" y="${my + h - 5}" width="${w - 12}" height="4" fill="${C.brass}"/>`;
    // šípka otvárania
    g += `<path d="M${hx} ${my + 6} L${lx} ${my + h / 2} L${hx} ${my + h - 6}" fill="none" stroke="${C.faint}" stroke-width=".5" stroke-dasharray="3 3"/>`;
    if (o.dim !== false) { g += dimH(mx, mx + w, my - 5, k.w); g += dimV(mx - 9, my, my + h, k.h); }
    return `<svg class="v-kridlo" viewBox="0 0 ${W} ${HH}" width="${W}" height="${HH}" role="img" aria-label="Krídlo ${k.w} × ${k.h}"><defs><pattern id="hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="4" stroke="${C.ox}" stroke-width=".8" opacity=".55"/></pattern></defs>${g}</svg>`;
  };

  /* ---------- zárubňa – čelný pohľad, zvýraznený dielec ---------- */
  F.svgZarubna = (p, zr, o = {}) => {
    zr = zr || F.zarubna(p);
    const H = o.h || 170, s = H / zr.oblH, W0 = zr.oblW * s, ob = zr.ob * s, mx = 24, my = 16, W = W0 + mx + 12, HH = H + my + 10;
    const hl = o.hl || '', lave = p.smer !== 'prave';
    const fill = F.FARBY[p.farba_zarubne]?.hex || '#eee';
    const col = id => id === hl ? C.brass : fill;
    const x0 = mx, y0 = my, x1 = mx + W0, y1 = my + H;
    // ľavá a pravá stojka podľa smeru
    const idL = zr.slepa ? 'ZL' : (lave ? 'ZZ' : 'ZR'), idP = zr.slepa ? 'ZP' : (lave ? 'ZR' : 'ZZ');
    let g = '';
    if (zr.tupo) {
      g += `<rect x="${x0}" y="${y0}" width="${ob}" height="${H}" fill="${col(idL)}" stroke="${C.ink}" stroke-width=".8"/>`;
      g += `<rect x="${x1 - ob}" y="${y0}" width="${ob}" height="${H}" fill="${col(idP)}" stroke="${C.ink}" stroke-width=".8"/>`;
      g += `<rect x="${x0 + ob}" y="${y0}" width="${W0 - 2 * ob}" height="${ob}" fill="${col('ZH')}" stroke="${C.ink}" stroke-width=".8"/>`;
    } else {
      g += `<polygon points="${x0},${y0} ${x0 + ob},${y0 + ob} ${x0 + ob},${y1} ${x0},${y1}" fill="${col(idL)}" stroke="${C.ink}" stroke-width=".8"/>`;
      g += `<polygon points="${x1},${y0} ${x1 - ob},${y0 + ob} ${x1 - ob},${y1} ${x1},${y1}" fill="${col(idP)}" stroke="${C.ink}" stroke-width=".8"/>`;
      g += `<polygon points="${x0},${y0} ${x1},${y0} ${x1 - ob},${y0 + ob} ${x0 + ob},${y0 + ob}" fill="${col('ZH')}" stroke="${C.ink}" stroke-width=".8"/>`;
    }
    // otvor
    g += `<rect x="${x0 + ob}" y="${y0 + ob}" width="${W0 - 2 * ob}" height="${H - ob}" fill="none" stroke="${C.line}" stroke-dasharray="2 2" stroke-width=".5"/>`;
    if (!zr.slepa) {
      const hx = lave ? x0 + ob : x1 - ob;
      [250, zr.falcH / 2, zr.falcH - 250].forEach(d => { const y = y1 - d * s; g += `<rect x="${hx - (lave ? 0 : 4)}" y="${y - 6}" width="4" height="12" fill="${p.zavesy === 'cierna' ? C.ink : '#9A9A9A'}"/>`; });
      const px = lave ? x1 - ob - 3 : x0 + ob, py = y1 - 1000 * s;
      g += `<rect x="${px}" y="${py - 8}" width="3" height="16" fill="#9A9A9A" stroke="${C.ink}" stroke-width=".3"/>`;
    }
    const lab = (x, y, t, id) => `<text x="${x}" y="${y}" text-anchor="middle" class="${id === hl ? 't-hl' : 't-lab'}">${t}</text>`;
    g += lab(x0 + ob / 2, y0 + H * .55, zr.slepa ? 'L' : (lave ? 'ZÁV' : 'PRO'), idL);
    g += lab(x1 - ob / 2, y0 + H * .55, zr.slepa ? 'P' : (lave ? 'PRO' : 'ZÁV'), idP);
    g += lab(x0 + W0 / 2, y0 + ob * .7, 'NADPRAŽIE', 'ZH');
    if (o.dim !== false) { g += dimH(x0, x1, y0 - 5, zr.oblW); g += dimV(x0 - 8, y0, y1, zr.oblH); }
    return `<svg class="v-zarubna" viewBox="0 0 ${W} ${HH}" width="${W}" height="${HH}" role="img" aria-label="Zárubňa">${g}</svg>`;
  };

  /* ---------- profil zárubne – rez obložka / ostenie / obložka ---------- */
  F.svgProfil = (zr, o = {}) => {
    const s = (o.w || 200) / (zr.ost + 40), ob = zr.ob * s, ost = zr.ost * s, t = F.N().ostenieHrubka * s, to = 10 * s;
    const mx = 18, my = 22, W = ost + mx * 2, H = ob + my + 22;
    let g = `<rect x="${mx}" y="${my}" width="${ost}" height="${t}" fill="${C.wood}" opacity=".55" stroke="${C.ink}" stroke-width=".7"/>`;
    g += `<rect x="${mx - to}" y="${my}" width="${to}" height="${ob}" fill="${C.wood}" opacity=".8" stroke="${C.ink}" stroke-width=".7"/>`;
    g += `<rect x="${mx + ost}" y="${my}" width="${to}" height="${ob}" fill="${C.wood}" opacity=".8" stroke="${C.ink}" stroke-width=".7"/>`;
    g += dimH(mx, mx + ost, my - 5, 'ostenie ' + zr.ost);
    g += `<text x="${mx + ost / 2}" y="${my + t + 12}" text-anchor="middle" class="t-lab">hr. ${F.N().ostenieHrubka}</text>`;
    g += `<text x="${mx - to - 3}" y="${my + ob + 12}" class="t-lab" text-anchor="start">obl. ${zr.ob}</text>`;
    g += `<text x="${mx + ost + to + 3}" y="${my + ob + 12}" class="t-lab" text-anchor="end">obl. ${zr.ob}</text>`;
    return `<svg class="v-profil" viewBox="${-6} 0 ${W + 12} ${H}" width="${W + 12}" height="${H}" role="img" aria-label="Profil zárubne">${g}</svg>`;
  };

  /* ---------- rezný plán tyče ---------- */
  const FARBY_DIELCOV = { ZZ: '#B08D57', ZR: '#8B5A2B', ZH: '#6E2620', ZL: '#9C7A45', ZP: '#7A5A35' };
  F.svgTyc = (t, L, o = {}) => {
    const W = o.w || 620, s = W / L, h = 20;
    let x = 0, g = `<rect x="0" y="0" width="${W}" height="${h}" fill="url(#odpad)" stroke="${C.ink}" stroke-width=".6"/>`;
    const prid = F.N().rezPridavok;
    t.kusy.forEach(k => {
      const w = k.dlz * s;
      g += `<rect x="${x}" y="0" width="${w}" height="${h}" fill="${FARBY_DIELCOV[k.typ] || C.brass}" stroke="${C.paper}" stroke-width="1"/>`;
      if (w > 34) g += `<text x="${x + w / 2}" y="${h / 2 + 3.5}" text-anchor="middle" class="t-bar">${k.dlz}${w > 80 ? ' · ' + F.esc(k.lab) : ''}</text>`;
      x += (k.dlz + prid) * s;
    });
    g += `<text x="${W - 4}" y="${h / 2 + 3.5}" text-anchor="end" class="t-waste">${t.zvysok * s > 60 ? 'zvyšok ' + Math.round(t.zvysok) : ''}</text>`;
    return `<svg class="v-tyc" viewBox="0 0 ${W} ${h}" width="${W}" height="${h}" preserveAspectRatio="none"><defs><pattern id="odpad" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" stroke="${C.faint}" stroke-width=".7" opacity=".5"/></pattern></defs>${g}</svg>`;
  };

  /* ---------- malá ikona položky (pre zoznamy) ---------- */
  F.mini = p => F.jeSlepa(p) ? F.svgZarubna(p, null, { h: 54, dim: false }) : F.svgKridlo(p, { h: 54, dim: false });

  /* ---------- nákladka: poradie zastávok a vrstvy v aute ---------- */
  F.svgNakladka = zastavky => {
    const n = zastavky.length, W = 520, H = 120, bw = (W - 80) / Math.max(n, 1);
    let g = `<rect x="20" y="20" width="${W - 60}" height="${H - 40}" fill="none" stroke="${C.ink}" stroke-width="1.2" rx="3"/>`;
    g += `<rect x="${W - 40}" y="40" width="30" height="${H - 60}" fill="none" stroke="${C.ink}" stroke-width="1.2" rx="6"/><text x="${W - 25}" y="${H / 2 + 3}" text-anchor="middle" class="t-lab">kabína</text>`;
    // naložené od zadu: posledná zastávka najhlbšie (pri kabíne)
    zastavky.slice().reverse().forEach((z, i) => {
      const x = W - 40 - (i + 1) * bw;
      const col = ['#B08D57', '#8B5A2B', '#6E2620', '#3F6B4F', '#2F5A6B', '#9C7A45'][(n - 1 - i) % 6];
      g += `<rect x="${x + 2}" y="24" width="${bw - 4}" height="${H - 48}" fill="${col}" opacity=".85" rx="2"/>`;
      g += `<text x="${x + bw / 2}" y="${H / 2 - 4}" text-anchor="middle" class="t-in">${n - i}.</text><text x="${x + bw / 2}" y="${H / 2 + 10}" text-anchor="middle" class="t-in-s">${F.esc((z.zakaznik.nazov || '').slice(0, 14))}</text>`;
    });
    g += `<text x="22" y="14" class="t-lab" text-anchor="start">← dvere auta (vykladá sa od 1.)</text>`;
    return `<svg class="v-nakladka" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Nákladka">${g}</svg>`;
  };

  /* ---------- rozpis CNC kódu po poliach ---------- */
  F.rozpisKodu = (kod, polia) => {
    let i = 0;
    return `<div class="kod-rozpis">${polia.map(([, n, l]) => { const t = kod.slice(i, i + l); i += l; return `<span><b>${F.esc(t)}</b><i>${n}</i></span>`; }).join('')}</div>`;
  };

  /* ---------- pipeline stavov ---------- */
  F.pipeline = z => {
    const i = F.stavIdx(z.stav);
    return `<ol class="pipe">${F.STAVY.map((s, j) => `<li class="${j < i ? 'done' : j === i ? 'now' : ''}" style="--c:${s.c}"><span>${s.n}</span>${z.datumy && z.datumy[s.k] ? `<small>${F.fmtD(z.datumy[s.k])}</small>` : ''}</li>`).join('')}</ol>`;
  };
  F.chip = k => { const s = F.stav(k); return `<span class="chip" style="--c:${s.c}">${s.n}</span>`; };
})();
