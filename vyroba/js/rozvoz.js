/* =====================================================================
   ROZVOZ – vozidlá s okruhmi, miesta vykládky, zastávky, poradie, mapka
   ===================================================================== */
'use strict';
(function () {
  const e = F.esc;

  /* ---------- približné súradnice miest (na poradie zastávok a mapku) ---------- */
  F.MESTA = {
    // Slovensko
    'kosice': [48.716, 21.261], 'babina': [48.44, 19.19], 'banska bystrica': [48.736, 19.146], 'bardejov': [49.293, 21.276], 'bela nad cirochou': [48.98, 22.13],
    'biel': [48.40, 22.04], 'bratislava': [48.148, 17.107], 'brezno': [48.804, 19.638], 'dobra niva': [48.47, 19.10], 'dolny kubin': [49.21, 19.30],
    'dunajska streda': [47.99, 17.62], 'gelnica': [48.855, 20.94], 'gotovany': [49.07, 19.43], 'handlova': [48.73, 18.76], 'hencovce': [48.90, 21.70],
    'hlohovec': [48.43, 17.80], 'holic': [48.81, 17.16], 'humenne': [48.93, 21.91], 'ilava': [48.99, 18.23], 'kezmarok': [49.14, 20.43], 'komarno': [47.76, 18.13],
    'levice': [48.21, 18.60], 'lipany': [49.15, 20.96], 'licartovce': [48.89, 21.24], 'lucenec': [48.33, 19.67], 'luzianky': [48.35, 18.05], 'mala ida': [48.66, 21.18],
    'maly saris': [49.03, 21.19], 'martin': [49.07, 18.92], 'michalovce': [48.75, 21.92], 'moravske lieskove': [48.83, 17.78], 'nitra': [48.31, 18.09],
    'nizny hrusov': [48.80, 21.73], 'nizna mysla': [48.63, 21.37], 'nove mesto nad vahom': [48.76, 17.83], 'nove zamky': [47.99, 18.16], 'namestovo': [49.41, 19.48],
    'partizanske': [48.63, 18.38], 'pezinok': [48.29, 17.27], 'piestany': [48.59, 17.83], 'polomka': [48.85, 19.85], 'prasnik': [48.66, 17.69], 'presov': [49.00, 21.24],
    'prievidza': [48.77, 18.62], 'puchov': [49.12, 18.33], 'poprad': [49.06, 20.30], 'rimavska sobota': [48.38, 20.02], 'ruzomberok': [49.08, 19.31], 'sedliska': [48.82, 21.69],
    'senec': [48.22, 17.40], 'senica': [48.68, 17.37], 'sered': [48.29, 17.73], 'sladkovicovo': [48.20, 17.64], 'snina': [48.99, 22.15], 'spisska bela': [49.19, 20.46],
    'spisska nova ves': [48.94, 20.56], 'stupava': [48.27, 17.03], 'sucany': [49.10, 18.99], 'svidnik': [49.31, 21.57], 'sielnica': [48.62, 19.08], 'teplicka nad vahom': [49.22, 18.79],
    'topolcany': [48.56, 18.18], 'topolovka': [48.92, 21.85], 'trebatice': [48.61, 17.81], 'trebisov': [48.63, 21.72], 'trencin': [48.89, 18.04], 'trnava': [48.38, 17.59],
    'turany': [49.11, 19.05], 'turcianske teplice': [48.86, 18.86], 'tvrdosin': [49.34, 19.55], 'vajkovce': [48.82, 21.19], 'valaliky': [48.64, 21.29], 'velaty': [48.52, 21.65],
    'velke zaluzie': [48.27, 17.92], 'vranov nad toplou': [48.89, 21.68], 'vrbove': [48.62, 17.72], 'vrable': [48.24, 18.31], 'vcelince': [48.38, 20.33],
    'zemplinske hradiste': [48.57, 21.72], 'zvolen': [48.58, 19.12], 'lubica': [49.12, 20.45], 'lubotin': [49.26, 20.89], 'sahy': [48.07, 18.95], 'samorin': [48.03, 17.31],
    'sala': [48.15, 17.88], 'spacince': [48.44, 17.61], 'stola': [49.10, 20.13], 'zilina': [49.22, 18.74], 'zitavany': [48.42, 18.36], 'spisske podhradie': [49.00, 20.75],
    // Maďarsko (pobočky Jola)
    'budapest': [47.50, 19.04], 'ujpest': [47.56, 19.09], 'ujbuda': [47.47, 19.04], 'rakos': [47.48, 19.25], 'pestszentlorinc': [47.43, 19.19], 'zuglo': [47.52, 19.11],
    'angyalfold': [47.54, 19.07], 'sopron': [47.68, 16.59], 'erd': [47.38, 18.92], 'gyor': [47.69, 17.63], 'siofok': [46.91, 18.05], 'szekesfehervar': [47.19, 18.41],
    'godollo': [47.60, 19.36], 'keszthely': [46.77, 17.25], 'veszprem': [47.09, 17.91], 'pecs': [46.07, 18.23], 'movar': [47.87, 17.27], 'mosonmagyarovar': [47.87, 17.27],
    'nyiregyhaza': [47.96, 21.72], 'eger': [47.90, 20.38], 'debrecen': [47.53, 21.63], 'szigetszentmiklos': [47.34, 19.04], 'kecskemet': [46.91, 19.69],
    'dunaujvaros': [46.96, 18.94], 'tatabanya': [47.58, 18.39], 'szekszard': [46.35, 18.71], 'zalaegerszeg': [46.84, 16.84], 'papa': [47.33, 17.47],
    'nagykanizsa': [46.45, 16.99], 'paks': [46.62, 18.86], 'kaposvar': [46.36, 17.80], 'baja': [46.18, 18.95], 'szombathely': [47.23, 16.62], 'miskolc': [48.10, 20.78],
    'bekescsaba': [46.68, 21.09], 'szeged': [46.25, 20.15], 'sarvar': [47.25, 16.94], 'szolnok': [47.17, 20.18], 'gyula': [46.65, 21.28], 'kiskunhalas': [46.43, 19.49],
    'gyomro': [47.43, 19.40], 'unterwart': [47.25, 16.23],
    // Česko (JAF HOLZ)
    'vyskov': [49.28, 17.00], 'ceska trebova': [49.90, 16.44], 'vodnany': [49.15, 14.17], 'ostrava': [49.82, 18.26], 'rokycany': [49.74, 13.59], 'domasin': [49.63, 14.95],
    'brandys': [50.19, 14.66], 'brandys nad labem': [50.19, 14.66], 'brno': [49.19, 16.61], 'praha': [50.08, 14.43],
  };
  F.normMesto = s => {
    let n = String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    if (/^bp\b/.test(n)) return 'budapest';
    n = n.replace(/cr\s*-\s*/g, '').replace(/madarsko|hungary|slovensko/g, '').replace(/\s+-\s+.*$/, '').replace(/[0-9,./]/g, ' ').replace(/\s+/g, ' ').trim();
    return n;
  };
  F.suradnice = mesto => {
    const n = F.normMesto(mesto); if (!n) return null;
    if (F.MESTA[n]) return F.MESTA[n];
    const k = Object.keys(F.MESTA).sort((a, b) => b.length - a.length).find(m => n.startsWith(m) || n.includes(' ' + m) || m.startsWith(n));
    return k ? F.MESTA[k] : null;
  };
  const rad = x => x * Math.PI / 180;
  F.vzdialenost = (a, b) => { if (!a || !b) return null; const R = 6371, dl = rad(b[0] - a[0]), dn = rad(b[1] - a[1]); const h = Math.sin(dl / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)) * 1.3; }; // × 1,3 ≈ po cestách

  /* ---------- vozidlá (v nastaveniach) ---------- */
  F.KRAJINY = { SK: 'Slovensko', CZ: 'Česko', HU: 'Maďarsko', AT: 'Rakúsko', PL: 'Poľsko' };
  F.DEFAULT_NASTAVENIA.depo = 'Košice';
  F.DEFAULT_NASTAVENIA.vozidla = [
    { id: 'V1', nazov: 'Dodávka Slovensko + Česko', spz: 'KE-123AB', krajiny: ['SK', 'CZ'], kapacita: 45 },
    { id: 'V2', nazov: 'Dodávka Maďarsko', spz: 'KE-456CD', krajiny: ['HU', 'AT'], kapacita: 45 },
  ];
  F.vozidla = () => { const n = F.N(); if (!Array.isArray(n.vozidla) || !n.vozidla.length) n.vozidla = JSON.parse(JSON.stringify(F.DEFAULT_NASTAVENIA.vozidla)); if (!n.depo) n.depo = 'Košice'; return n.vozidla; };
  F.vozidlo = id => F.vozidla().find(v => v.id === id);
  F.vozidloPreKrajinu = k => F.vozidla().find(v => (v.krajiny || []).includes(k)) || F.vozidla()[0];

  /* ---------- miesto vykládky zákazky ---------- */
  F.krajinaZMesta = m => /maďar|madar|hungary|budapest|\bbp\b/i.test(m || '') ? 'HU' : /čr|cr -|česk|cesk/i.test(m || '') ? 'CZ' : null;
  F.dodanie = z => {
    if (z.dodanie && (z.dodanie.mesto || z.dodanie.ulica)) return z.dodanie;
    const p = z.zakaznik.partnerId && F.partner(z.zakaznik.partnerId);
    if (p) return { nazov: p.nazov, ulica: p.ulica || '', psc: p.psc || '', mesto: p.mesto || '', krajina: p.krajina || 'SK', kontakt: p.telefon || '' };
    const a = String(z.zakaznik.adresa || ''), m = a.match(/(\d{3}\s?\d{2})\s+(.+)$/);
    return { nazov: z.zakaznik.nazov, ulica: a.split(',')[0] || '', psc: m ? m[1] : '', mesto: m ? m[2] : (a.split(',').pop() || '').trim(), krajina: z.zakaznik.krajina || F.krajinaZMesta(a) || 'SK', kontakt: z.zakaznik.telefon || '' };
  };
  F.dodanieText = d => [d.ulica, [d.psc, d.mesto].filter(Boolean).join(' ')].filter(Boolean).join(', ') + (d.krajina && d.krajina !== 'SK' ? ' (' + d.krajina + ')' : '');
  F.dodanieKluc = d => F.partnerNorm([d.nazov, d.ulica, d.mesto].join('|'));

  /* ---------- zastávky trasy: zákazky na rovnakom mieste = jedna zastávka ---------- */
  F.zastavkyTrasy = t => {
    const out = [], idx = {};
    t.zastavky.map(F.zakazka).filter(Boolean).forEach(z => {
      const d = F.dodanie(z), k = F.dodanieKluc(d);
      if (idx[k] == null) { idx[k] = out.length; out.push({ kluc: k, dodanie: d, zakazky: [], xy: F.suradnice(d.mesto) }); }
      out[idx[k]].zakazky.push(z);
    });
    return out;
  };
  F.dlzkaTrasy = t => {
    const st = F.zastavkyTrasy(t), dep = F.suradnice(F.N().depo || 'Košice');
    let km = 0, prev = dep, nezname = 0;
    st.forEach(s => { if (!s.xy) { nezname++; return; } km += F.vzdialenost(prev, s.xy); prev = s.xy; });
    km += F.vzdialenost(prev, dep) || 0;
    return { km: Math.round(km), nezname };
  };
  F.zaplnenie = t => { const z = t.zastavky.map(F.zakazka).filter(Boolean); return { kr: F.sum(z, x => F.pocty(x).kr), zar: F.sum(z, x => F.pocty(x).zar) }; };

  /** Poradie zastávok: najbližší sused z depa + zlepšenie 2-opt (okružná jazda tam a späť) */
  F.optimalizujTrasu = t => {
    const st = F.zastavkyTrasy(t), dep = F.suradnice(F.N().depo || 'Košice');
    const zname = st.filter(s => s.xy), nezn = st.filter(s => !s.xy);
    let poradie = [], zvysok = zname.slice(), cur = dep;
    while (zvysok.length) { zvysok.sort((a, b) => F.vzdialenost(cur, a.xy) - F.vzdialenost(cur, b.xy)); const n = zvysok.shift(); poradie.push(n); cur = n.xy; }
    const dlz = r => { let s = 0, p = dep; r.forEach(x => { s += F.vzdialenost(p, x.xy); p = x.xy; }); return s + F.vzdialenost(p, dep); };
    let lepsie = true;
    while (lepsie) {
      lepsie = false;
      for (let i = 0; i < poradie.length - 1; i++) for (let j = i + 1; j < poradie.length; j++) {
        const r = poradie.slice(0, i).concat(poradie.slice(i, j + 1).reverse(), poradie.slice(j + 1));
        if (dlz(r) + 0.5 < dlz(poradie)) { poradie = r; lepsie = true; }
      }
    }
    t.zastavky = poradie.concat(nezn).flatMap(s => s.zakazky.map(z => z.id));
  };

  /** Návrh rozvozu: hotové zákazky bez trasy sa rozdelia podľa krajiny do vozidiel a zoradia */
  F.navrhniRozvoz = datum => {
    const d = F.load(), hotove = d.zakazky.filter(z => z.stav === 'hotova' && !z.trasa);
    const podla = F.groupBy(hotove, z => F.vozidloPreKrajinu(F.dodanie(z).krajina || 'SK').id);
    const zmenene = [];
    Object.keys(podla).forEach(vid => {
      const v = F.vozidlo(vid);
      let t = d.trasy.find(x => x.vozidloId === vid && x.datum === datum && x.stav !== 'expedovana');
      if (!t) { t = { id: F.noveCisloTrasy(), datum, vozidloId: vid, vozidlo: `${v.nazov} ${v.spz || ''}`.trim(), vodic: '', zastavky: [], stav: 'planovana' }; d.trasy.push(t); }
      podla[vid].forEach(z => { t.zastavky.push(z.id); z.trasa = t.id; });
      F.optimalizujTrasu(t); zmenene.push(t);
    });
    return { trasy: zmenene, pocet: hotove.length };
  };

  /* ---------- schematická mapka trasy ---------- */
  F.svgMapaTrasy = (t, o = {}) => {
    const st = F.zastavkyTrasy(t), dep = F.suradnice(F.N().depo || 'Košice');
    const body = [dep, ...st.filter(s => s.xy).map(s => s.xy)];
    const W = o.w || 560, H = o.h || 260, pad = 34, padX = Math.min(80, W * 0.16);
    let la0 = Math.min(...body.map(b => b[0])), la1 = Math.max(...body.map(b => b[0])), lo0 = Math.min(...body.map(b => b[1])), lo1 = Math.max(...body.map(b => b[1]));
    if (la1 - la0 < .8) { const c = (la0 + la1) / 2; la0 = c - .4; la1 = c + .4; }          // aby bolo vidieť okolie a hranice
    if (lo1 - lo0 < 1.2) { const c = (lo0 + lo1) / 2; lo0 = c - .6; lo1 = c + .6; }
    const kx = Math.cos(rad((la0 + la1) / 2));
    let sx = (lo1 - lo0) * kx || 1, sy = (la1 - la0) || 1;
    const s = Math.min((W - 2 * padX) / sx, (H - 2 * pad) / sy, 260);
    const cx = (lo0 + lo1) / 2, cy = (la0 + la1) / 2;
    const P = b => [W / 2 + (b[1] - cx) * kx * s, H / 2 - (b[0] - cy) * s];
    const C = F.C || {};
    let g = F.svgHranice ? F.svgHranice(P, W, H) : `<rect x="0" y="0" width="${W}" height="${H}" rx="8" fill="#F4F1EA"/>`;
    // body všetkých známych miest v okolí (orientačné)
    Object.entries(F.MESTA).forEach(([, b]) => { const [x, y] = P(b); if (x > 6 && x < W - 6 && y > 6 && y < H - 6) g += `<circle cx="${x}" cy="${y}" r="1.4" fill="#C9C1B3"/>`; });
    const pts = [dep, ...st.filter(s => s.xy).map(s => s.xy), dep].map(P);
    g += `<polyline points="${pts.map(p => p.join(',')).join(' ')}" fill="none" stroke="#8B5A2B" stroke-width="2" stroke-dasharray="6 4" stroke-linejoin="round"/>`;
    const [dx, dy] = P(dep);
    g += `<rect x="${dx - 7}" y="${dy - 7}" width="14" height="14" rx="2" fill="#1F1B16"/><text x="${dx + 10}" y="${dy + 4}" font-family="JetBrains Mono, monospace" font-size="10" fill="#1F1B16">${e(F.N().depo || 'Košice')}</text>`;
    let i = 0;
    st.forEach(z => {
      i++; if (!z.xy) return;
      const [x, y] = P(z.xy);
      g += `<circle cx="${x}" cy="${y}" r="10" fill="#6E2620"/><text x="${x}" y="${y + 3.5}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10" font-weight="600" fill="#fff">${i}</text>`;
      g += `<text x="${x + 13}" y="${y + 4}" font-family="Work Sans, sans-serif" font-size="10" fill="#5B5147">${e((z.dodanie.mesto || '').slice(0, 18))}${z.zakazky.length > 1 ? ' ·' + z.zakazky.length : ''}</text>`;
    });
    return `<svg class="v-mapa" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Mapka trasy ${e(t.id)}">${g}</svg>`;
  };

  /* ---------- nákladka podľa zastávok ---------- */
  F.svgNakladka = zastavky => {
    // zastavky: pole zastávok (F.zastavkyTrasy) alebo zákaziek (spätná kompatibilita)
    const st = zastavky.length && zastavky[0].zakazky ? zastavky : zastavky.map(z => ({ dodanie: F.dodanie(z), zakazky: [z] }));
    const n = st.length, W = 560, H = 124;
    const vahy = st.map(s => Math.max(1, F.sum(s.zakazky, z => F.pocty(z).kr + F.pocty(z).zar)));
    const spolu = F.sum(vahy), dlzka = W - 80;
    let g = `<rect x="20" y="20" width="${W - 60}" height="${H - 40}" fill="none" stroke="#1F1B16" stroke-width="1.2" rx="3"/>`;
    g += `<rect x="${W - 40}" y="40" width="30" height="${H - 60}" fill="none" stroke="#1F1B16" stroke-width="1.2" rx="6"/><text x="${W - 25}" y="${H / 2 + 3}" text-anchor="middle" class="t-lab">kabína</text>`;
    let x = W - 40;
    st.slice().reverse().forEach((s, i) => {
      const cislo = n - i, bw = Math.max(26, dlzka * vahy[cislo - 1] / spolu);
      x -= bw;
      const col = ['#B08D57', '#8B5A2B', '#6E2620', '#3F6B4F', '#2F5A6B', '#9C7A45'][(cislo - 1) % 6];
      g += `<rect x="${x + 2}" y="24" width="${bw - 4}" height="${H - 48}" fill="${col}" opacity=".88" rx="2"/>`;
      g += `<text x="${x + bw / 2}" y="${H / 2 - 4}" text-anchor="middle" class="t-in">${cislo}.</text>`;
      if (bw > 44) g += `<text x="${x + bw / 2}" y="${H / 2 + 10}" text-anchor="middle" class="t-in-s">${e((s.dodanie.mesto || s.zakazky[0].zakaznik.nazov || '').slice(0, Math.floor(bw / 6)))}</text>`;
    });
    g += `<text x="22" y="14" class="t-lab" text-anchor="start">← dvere auta · vykladá sa od 1. · šírka ≈ počet kusov</text>`;
    return `<svg class="v-nakladka" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Nákladka">${g}</svg>`;
  };

  /* ---------- nákladkový list podľa zastávok ---------- */
  F.docNakladka = tr => {
    const st = F.zastavkyTrasy(tr), v = F.vozidlo(tr.vozidloId), dl = F.dlzkaTrasy(tr), zap = F.zaplnenie(tr);
    const rows = st.map((s, i) => s.zakazky.map((z, j) => {
      const c = F.pocty(z), kusy = F.kusy(z), nal = kusy.filter(k => F.skenKusu(k.id).nakladka).length;
      return `<tr class="${j ? 'sub' : 'stop-first'}">${j ? '<td></td><td></td><td></td>' : `<td class="big" rowspan="1">${i + 1}.</td><td class="big">${st.length - i}.</td><td><b>${e(s.dodanie.nazov)}</b><br><span class="muted">${e(F.dodanieText(s.dodanie))}${s.dodanie.kontakt ? ' · ' + e(s.dodanie.kontakt) : ''}</span></td>`}
        <td>${e(z.id)}<br><span class="muted small">${e(z.zakaznik.nazov)}</span></td><td class="r">${c.kr}</td><td class="r">${c.zar}</td><td class="r">${kusy.length}</td><td class="r">${F.hmotnostZakazky ? F.kg(F.hmotnostZakazky(z).brutto) : ''}</td><td class="r">${nal}/${kusy.length}</td><td class="chk"><span class="box"></span></td></tr>`;
    }).join('')).join('');
    return `<section class="sheet">${(F.docHlav || (() => ''))('Nákladkový list', tr.id, `${F.fmtD(tr.datum)} · ${e(tr.vozidlo || (v ? v.nazov : ''))} · vodič ${e(tr.vodic || '–')} · ${st.length} zastávok · ≈ ${dl.km} km`)}
      <div class="nak-top">${F.svgNakladka(st)}${F.svgMapaTrasy(tr, { w: 300, h: 150 })}</div>
      <p class="muted">Nakladá sa v opačnom poradí ako sa vykladá: posledná zastávka ide do auta prvá (ku kabíne). Krídla ${zap.kr} · zárubne ${zap.zar}${v && v.kapacita ? ` · kapacita auta ${v.kapacita} krídel` : ''}.</p>
      <table class="doc-t"><thead><tr><th>Vykl.</th><th>Nakl.</th><th>Miesto vykládky</th><th>Zákazka</th><th class="r">Krídla</th><th class="r">Zárubne</th><th class="r">Kusov</th><th class="r">Brutto</th><th class="r">Naložené</th><th class="chk">✓</th></tr></thead><tbody>${rows}</tbody></table>
      ${F.hmotnostTrasy ? (() => { const h = F.hmotnostTrasy(tr); return `<p><b>Spolu brutto ${F.kg(h.brutto)}</b> · netto ${F.kg(h.net)}${v && v.nosnost ? ` · nosnosť auta ${F.kg(v.nosnost)}` : ''}${h.chyba.length ? ` <span class="muted">(bez: ${e(h.chyba.join(', '))})</span>` : ''}</p>`; })() : ''}</section>`;
  };
})();
