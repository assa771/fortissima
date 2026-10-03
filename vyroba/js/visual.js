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

  /* ---------- krídlo – kreslené rovnako ako na webe Fortissima (rozmery v mm) ---------- */
  const FW = {
    biela:     { leaf: '#F4F3F0', edge: '#C9C5BE', frame: '#EFEEEA', line: 'rgba(60,52,44,.16)' },
    kasmirova: { leaf: '#D9CDBD', edge: '#ADA090', frame: '#D3C6B5', line: 'rgba(60,45,30,.22)' },
  };
  F.FW = FW;
  F.svgKridlo = (p, o = {}) => {
    const k = F.kridlo(p), L = FW[p.farba] || FW.biela;
    const lw = k.w, lh = k.h, sk = k.sk, falc = k.falc;
    const prir = k.prirez, hp = lh + Math.max(0, prir);
    const M = o.dim === false ? 30 : 150;                       // okraj na kóty
    const lx = M, ly = M * .8;
    const W = lw + M + 40, H = hp + M * .8 + 40;
    const hingeLeft = p.smer !== 'prave', lockX = hingeLeft ? lx + lw : lx, dir = hingeLeft ? -1 : 1;
    const kov = String(p.kovanie || ''), kc = /cierna/.test(kov) ? '#2B2826' : '#B8BBBF', kcs = /cierna/.test(kov) ? '#111' : '#8E9297';
    const g = [];
    // odrezok z polotovaru (STN z HU, skrátenie)
    if (prir > 0) {
      g.push(`<rect x="${lx}" y="${ly + lh}" width="${lw}" height="${prir}" fill="url(#hatchK)" stroke="${C.ox}" stroke-width="5" stroke-dasharray="22 16"/>`);
      if (prir > 40) g.push(`<text x="${lx + lw / 2}" y="${ly + lh + prir / 2 + 18}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="50" fill="${C.ox}">−${prir}</text>`);
    }
    g.push(`<rect x="${lx}" y="${ly}" width="${lw}" height="${lh}" fill="${L.leaf}" stroke="${L.edge}" stroke-width="5"/>`);
    // rámová konštrukcia: vlysy 145 mm, spodný vlys 340 (205,5/210) alebo 255 (STN), skrátenie ide zo spodného vlysu
    const st = 145, tr = 145, br = (p.vyska === '197' ? 255 : 340) - sk;
    const px = lx + st, pw = lw - 2 * st, py = ly + tr, ph = lh - tr - br;
    const glass = '#C7CFD8', gEdge = '#9EA8B3';
    if (p.kolekcia !== 'minimal' && pw > 120) {
      g.push(`<g fill="none" stroke="${L.line}" stroke-width="4"><line x1="${px}" y1="${ly + 4}" x2="${px}" y2="${ly + lh - 4}"/><line x1="${px + pw}" y1="${ly + 4}" x2="${px + pw}" y2="${ly + lh - 4}"/><line x1="${px}" y1="${py}" x2="${px + pw}" y2="${py}"/><line x1="${px}" y1="${py + ph}" x2="${px + pw}" y2="${py + ph}"/></g>`);
      if (p.kolekcia === 'vertikal') {
        const gw = 150, gx = hingeLeft ? px + pw - gw : px;
        g.push(`<rect x="${gx}" y="${py}" width="${gw}" height="${ph}" fill="${glass}" stroke="${gEdge}" stroke-width="3"/><rect x="${gx + 18}" y="${py + 20}" width="34" height="${ph - 40}" fill="#fff" opacity=".25"/>`);
      } else if (p.kolekcia === 'prestige') {
        for (let i = 1; i <= 4; i++) g.push(`<rect x="${px}" y="${py + ph * i / 5 - 10}" width="${pw}" height="20" fill="${glass}" stroke="${gEdge}" stroke-width="2"/>`);
      }
    }
    // závesy (len falcové – bezfalcové majú skryté)
    if (falc) {
      const hx = hingeLeft ? lx - 6 : lx + lw - 10, cz = p.zavesy === 'cierna';
      [ly + 200, ly + lh / 2 - 60, ly + lh - 320].forEach(hy => g.push(`<rect x="${hx}" y="${hy}" width="16" height="110" rx="7" fill="${cz ? '#2B2826' : '#B8BBBF'}" stroke="${cz ? '#111' : '#8E9297'}" stroke-width="2"/>`));
    }
    // vetracia mriežka v strede spodného vlysu
    if (p.mriezka && p.mriezka !== 'bez') {
      const MC = { biela: ['#F7F6F2', '#BDB8B0', '#D6D2CB'], hlinik: ['#C9CCD0', '#8E9297', '#9DA1A6'], cierna: ['#2E2B29', '#111', '#4A4643'] }[p.mriezka] || ['#C9CCD0', '#8E9297', '#9DA1A6'];
      const gw = Math.min(460, lw - 160), gh = 100, gx = lx + (lw - gw) / 2, gy = ly + lh - br / 2 - gh / 2;
      g.push(`<rect x="${gx}" y="${gy}" width="${gw}" height="${gh}" rx="6" fill="${MC[0]}" stroke="${MC[1]}" stroke-width="3"/>`);
      for (let i = 1; i <= 5; i++) g.push(`<rect x="${gx + 22}" y="${gy + i * gh / 6 - 4}" width="${gw - 44}" height="8" rx="3" fill="${MC[2]}"/>`);
    }
    if (p.prah) g.push(`<rect x="${lx + 40}" y="${ly + lh - 34}" width="${lw - 80}" height="22" rx="4" fill="#A9ADB2" stroke="#7E8287" stroke-width="2"/>`);
    // kľučka a zámok (os kľučky 1050 mm od podlahy ≈ 1042 od spodu krídla)
    const hy = ly + lh - 1042, rx = lockX + dir * 70;
    g.push(`<rect x="${rx - 26}" y="${hy - 26}" width="52" height="52" rx="6" fill="${kc}" stroke="${kcs}" stroke-width="2"/><rect x="${Math.min(rx, rx + dir * 150)}" y="${hy - 9}" width="150" height="18" rx="9" fill="${kc}" stroke="${kcs}" stroke-width="2"/>`);
    const typZ = (kov.match(/^(bb|pz|wc)/) || [])[1];
    if (typZ) {
      const ky = hy + 110, R0 = 34, sym = /cierna/.test(kov) ? '#EDE9E2' : '#26221F';
      g.push(`<rect x="${rx - R0 - 4}" y="${ky - R0 - 4}" width="${2 * R0 + 8}" height="${2 * R0 + 8}" rx="10" fill="#fff" opacity=".85"/><rect x="${rx - R0}" y="${ky - R0}" width="${2 * R0}" height="${2 * R0}" rx="8" fill="${kc}" stroke="${kcs}" stroke-width="3"/>`);
      if (typZ === 'bb') g.push(`<circle cx="${rx}" cy="${ky - 10}" r="10" fill="${sym}"/><polygon points="${rx - 5},${ky - 4} ${rx + 5},${ky - 4} ${rx + 11},${ky + 22} ${rx - 11},${ky + 22}" fill="${sym}"/>`);
      else if (typZ === 'pz') g.push(`<path d="M${rx - 8} ${ky - 4}A13 13 0 1 1 ${rx + 8} ${ky - 4}V${ky + 22}Q${rx} ${ky + 27} ${rx - 8} ${ky + 22}Z" fill="${sym}"/><rect x="${rx - 2.5}" y="${ky - 20}" width="5" height="22" rx="2" fill="${kc}"/>`);
      else g.push(`<circle cx="${rx}" cy="${ky}" r="19" fill="${sym}"/><rect x="${rx - 15}" y="${ky - 4}" width="30" height="8" rx="4" fill="${kc}"/><circle cx="${rx + dir * -28}" cy="${ky + 24}" r="6" fill="#C2342F"/>`);
      const ty = ky + R0 + 18;
      g.push(`<rect x="${rx - 44}" y="${ty}" width="88" height="46" rx="23" fill="#7A1F2B"/><text x="${rx}" y="${ty + 33}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="32" font-weight="700" fill="#fff">${typZ.toUpperCase()}</text>`);
    }
    // kóty v mm
    if (o.dim !== false) {
      const col = C.wood, t = 'font-family="JetBrains Mono, monospace" font-size="60" fill="' + col + '"';
      g.push(`<g stroke="${col}" stroke-width="4"><line x1="${lx}" y1="${ly - 45}" x2="${lx + lw}" y2="${ly - 45}"/><line x1="${lx}" y1="${ly - 70}" x2="${lx}" y2="${ly - 20}"/><line x1="${lx + lw}" y1="${ly - 70}" x2="${lx + lw}" y2="${ly - 20}"/>
        <line x1="${lx - 70}" y1="${ly}" x2="${lx - 70}" y2="${ly + lh}"/><line x1="${lx - 95}" y1="${ly}" x2="${lx - 45}" y2="${ly}"/><line x1="${lx - 95}" y1="${ly + lh}" x2="${lx - 45}" y2="${ly + lh}"/></g>
        <text x="${lx + lw / 2}" y="${ly - 62}" text-anchor="middle" ${t}>${lw}</text><text x="${lx - 85}" y="${ly + lh / 2}" text-anchor="middle" ${t} transform="rotate(-90 ${lx - 85} ${ly + lh / 2})">${lh}</text>`);
    }
    const hpx = o.h || 170, wpx = Math.round(hpx * W / H);
    return `<svg class="v-kridlo" viewBox="0 0 ${W} ${H}" width="${wpx}" height="${hpx}" role="img" aria-label="Krídlo ${lw} × ${lh}"><defs><pattern id="hatchK" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="40" stroke="${C.ox}" stroke-width="8" opacity=".45"/></pattern></defs>${g.join('')}</svg>`;
  };

  /* ---------- zárubňa – čelný pohľad, zvýraznený dielec ---------- */
  F.svgZarubna = (p, zr, o = {}) => {
    zr = zr || F.zarubna(p);
    const H = o.h || 170, s = H / zr.oblH, W0 = zr.oblW * s, ob = zr.ob * s, mx = 24, my = 16, W = W0 + mx + 12, HH = H + my + 10;
    const hl = o.hl || '', lave = p.smer !== 'prave';
    const fill = (FW[p.farba_zarubne] || FW.biela).frame, edge = (FW[p.farba_zarubne] || FW.biela).edge;
    const col = id => id === hl ? C.brass : fill;
    const x0 = mx, y0 = my, x1 = mx + W0, y1 = my + H;
    // ľavá a pravá stojka podľa smeru
    const idL = zr.slepa ? 'ZL' : (lave ? 'ZZ' : 'ZR'), idP = zr.slepa ? 'ZP' : (lave ? 'ZR' : 'ZZ');
    let g = '';
    if (zr.tupo) {
      g += `<rect x="${x0}" y="${y0}" width="${ob}" height="${H}" fill="${col(idL)}" stroke="${edge}" stroke-width="1"/>`;
      g += `<rect x="${x1 - ob}" y="${y0}" width="${ob}" height="${H}" fill="${col(idP)}" stroke="${edge}" stroke-width="1"/>`;
      g += `<rect x="${x0 + ob}" y="${y0}" width="${W0 - 2 * ob}" height="${ob}" fill="${col('ZH')}" stroke="${edge}" stroke-width="1"/>`;
    } else {
      g += `<polygon points="${x0},${y0} ${x0 + ob},${y0 + ob} ${x0 + ob},${y1} ${x0},${y1}" fill="${col(idL)}" stroke="${edge}" stroke-width="1"/>`;
      g += `<polygon points="${x1},${y0} ${x1 - ob},${y0 + ob} ${x1 - ob},${y1} ${x1},${y1}" fill="${col(idP)}" stroke="${edge}" stroke-width="1"/>`;
      g += `<polygon points="${x0},${y0} ${x1},${y0} ${x1 - ob},${y0 + ob} ${x0 + ob},${y0 + ob}" fill="${col('ZH')}" stroke="${edge}" stroke-width="1"/>`;
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
