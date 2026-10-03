/* =====================================================================
   HMOTNOSTI a PRÍJEM DODÁVOK (packing list od dodávateľa)
   Hmotnosti krídel pochádzajú z packing listu Le Porte M #0000002 (20. 8. 2026):
   netto / brutto na 1 ks, krídlo 2070 mm (polotovar HU 205,5, falc), matné sklo.
   ===================================================================== */
'use strict';
(function () {
  const e = F.esc;
  F.DEFAULT_NASTAVENIA.hmotnosti = {
    zdroj: 'Packing list Le Porte M #0000002, 20. 8. 2026',
    // kolekcia → nominálna šírka → [netto kg, brutto kg] na 1 ks (výška 2070)
    kridla: {
      prestige: { '60': [25.0, 27.002], '70': [27.7, 29.702], '80': [31.0, 33.002], '90': [33.3, 35.402] },
      vertikal: { '60': [28.2, 30.202], '70': [29.1, 31.102], '80': [30.0, 32.002] },
      minimal: {},
    },
    zarubne: { F80: null, F100: null, F130: null, F160: null },   // kg na 1 zárubňu (3 dielce) – doplniť
    rozsirenia: { R90: null, R180: null },
  };
  F.DEFAULT_NASTAVENIA.vozidla.forEach(v => { if (v.nosnost == null) v.nosnost = 1200; });

  const H = () => { const n = F.N(); if (!n.hmotnosti) n.hmotnosti = JSON.parse(JSON.stringify(F.DEFAULT_NASTAVENIA.hmotnosti)); return n.hmotnosti; };
  F.hmotnostiTab = H;

  /** Hmotnosť jedného krídla – z tabuľky; ak šírka chýba, dopočíta sa lineárne zo susedných šírok */
  F.hmotnostKridla = p => {
    const t = (H().kridla || {})[p.kolekcia] || {};
    let v = t[p.sirka];
    if (!v) {
      const s = Object.keys(t).map(Number).sort((a, b) => a - b), x = +p.sirka;
      const lo = s.filter(a => a < x).pop(), hi = s.find(a => a > x);
      if (lo != null && hi != null) { const k = (x - lo) / (hi - lo); v = [0, 1].map(i => t[lo][i] + (t[hi][i] - t[lo][i]) * k); }
      else if (s.length >= 2) { const a = s[s.length - 2], b = s[s.length - 1], k = (x - b) / (b - a); v = [0, 1].map(i => t[b][i] + (t[b][i] - t[a][i]) * k); }
      if (v) v = v.map(y => +y.toFixed(2)), v.odhad = true;
    }
    if (!v) return null;
    const kr = F.kridlo(p), sc = kr.polotovarH / 2070;           // tabuľka je pre výšku 2070
    return { net: +(v[0] * sc).toFixed(2), brutto: +(v[1] * sc).toFixed(2), odhad: !!v.odhad };
  };
  F.hmotnostZakazky = z => {
    const o = { net: 0, brutto: 0, chyba: new Set(), odhad: false };
    (z.polozky || []).forEach(p => {
      const ks = +p.ks || 1;
      if (F.maKridlo(p)) { const h = F.hmotnostKridla(p); if (h) { o.net += h.net * ks; o.brutto += h.brutto * ks; o.odhad = o.odhad || h.odhad; } else o.chyba.add(`krídlo ${F.KOLEKCIE[p.kolekcia].model} ${p.sirka}`); }
      if (F.maZarubnu(p)) {
        const zr = F.zarubna(p), kz = (H().zarubne || {})[zr.typ];
        if (kz) { o.net += kz * ks; o.brutto += kz * ks; } else o.chyba.add('zárubňa ' + zr.typ);
        [['R180', zr.r180], ['R90', zr.r90]].forEach(([r, n]) => { if (!n) return; const kr = (H().rozsirenia || {})[r]; if (kr) { o.net += kr * n * ks; o.brutto += kr * n * ks; } else o.chyba.add('rozšírenie ' + r); });
      }
    });
    o.net = Math.round(o.net); o.brutto = Math.round(o.brutto); o.chyba = [...o.chyba];
    return o;
  };
  F.hmotnostTrasy = t => {
    const o = { net: 0, brutto: 0, chyba: new Set() };
    t.zastavky.map(F.zakazka).filter(Boolean).forEach(z => { const h = F.hmotnostZakazky(z); o.net += h.net; o.brutto += h.brutto; h.chyba.forEach(c => o.chyba.add(c)); });
    o.chyba = [...o.chyba];
    return o;
  };
  F.kg = v => new Intl.NumberFormat('sk-SK', { maximumFractionDigits: 0 }).format(v) + ' kg';

  /* ---------- príjem dodávky zo súboru (packing list) ---------- */
  /** Zapíše príjem: pohyby na sklad, zníži „objednané“, voliteľne prevezme hmotnosti z dodávky */
  F.prijmiDodavku = (dod, opt = {}) => {
    const d = F.load();
    d.dodavky = d.dodavky || [];
    if (d.dodavky.some(x => x.cislo === dod.cislo && x.dodavatel === dod.dodavatel)) throw new Error('Dodávka ' + dod.cislo + ' už bola prijatá.');
    const doklad = `${dod.cislo} ${dod.dodavatel_skratka || ''}`.trim();
    dod.polozky.forEach(x => {
      F.pohyb(x.kluc, +x.ks, 'príjem', doklad);
      const k = F.karta(x.kluc); if (k && k.objednane) k.objednane = Math.max(0, k.objednane - x.ks);
      if (opt.hmotnosti && x.kluc.startsWith('KR|') && x.ks) {
        const [, kol, , , sir] = x.kluc.split('|'), t = H().kridla[kol] = H().kridla[kol] || {};
        t[sir] = [+(x.netto / x.ks).toFixed(3), +(x.brutto / x.ks).toFixed(3)];
      }
    });
    if (opt.hmotnosti) H().zdroj = `Packing list ${dod.dodavatel_skratka || dod.dodavatel} ${dod.cislo}, ${F.fmtD(dod.datum)}`;
    d.dodavky.unshift(Object.assign({ prijate: new Date().toISOString() }, dod));
    return d.dodavky[0];
  };
  F.nahladDodavky = dod => {
    const ks = F.sum(dod.polozky, x => +x.ks), net = F.sum(dod.polozky, x => +x.netto || 0), br = F.sum(dod.polozky, x => +x.brutto || 0);
    const ok = Math.abs(net - (dod.netto || net)) < 0.5 && Math.abs(br - (dod.brutto || br)) < 0.5;
    return `<div class="dod-h"><div><b>${e(dod.dodavatel)}</b><br><span class="muted">${e(dod.cislo)} · ${F.fmtD(dod.datum)} · ${e(dod.dodacie_podmienky || '')} · ${dod.miest || '–'} miest · colný kód ${e(dod.colny_kod || '–')}</span></div>
      <div class="dod-sum"><span>${ks} ks</span><span>netto ${F.kg(net)}</span><span>brutto ${F.kg(br)}</span>${ok ? '<span class="ok">✓ súčty sedia s hlavičkou</span>' : '<span class="neg">⚠ súčty nesedia s hlavičkou</span>'}</div></div>
      <table class="t slim"><thead><tr><th></th><th>Položka (sklad)</th><th>Popis dodávateľa</th><th class="r">Ks</th><th class="r">Netto</th><th class="r">Brutto</th><th class="r">kg/ks</th></tr></thead><tbody>
      ${dod.polozky.map(x => { const c = x.kluc.split('|'), p = c[0] === 'KR' ? { kolekcia: c[1], prevedenie: c[2], farba: c[3], sirka: c[4], vyska: c[5], smer: 'lave', kovanie: 'bez', mriezka: 'bez' } : null;
        return `<tr><td class="ic">${p ? F.svgKridlo(p, { h: 40, dim: false }) : ''}</td><td>${e(F.kartaNazov(x.kluc))}</td><td class="muted small">${e(x.popis || '')}</td><td class="r"><b>${x.ks}</b></td><td class="r">${F.kg(x.netto || 0)}</td><td class="r">${F.kg(x.brutto || 0)}</td><td class="r mono small">${x.ks ? (x.netto / x.ks).toFixed(1) + ' / ' + (x.brutto / x.ks).toFixed(1) : ''}</td></tr>`; }).join('')}</tbody></table>`;
  };
})();
