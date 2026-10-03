/* =====================================================================
   SKLAD – zoznam s filtrami/zoradením a skladová karta položky
   (parametre, rozmery, váha, cena, rezervácie, spotreba na zákazky,
    štatistika spotreby, prognóza, nákres)
   ===================================================================== */
'use strict';
(function () {
  const e = F.esc, $ = s => document.querySelector(s), app = () => $('#view'), D = () => F.load();
  const DEN = 864e5, REZERVUJE = ['potvrdena', 'zamerana', 'v_davke', 'vyroba'];
  const r2 = v => +(+v || 0).toFixed(2);

  /* ---------- číselníky pre filtre ---------- */
  F.DRUHY_SKLADU = { kridla: 'Krídla (dvere)', zarubne: 'Zárubne – obložky a ostenia', rozsirenia: 'Rozšírenia zárubní', kovanie: 'Kovanie', prislusenstvo: 'Príslušenstvo' };
  F.FARBY_KOV = { nikel: 'nikel', cierna: 'čierna', biela: 'biela', hlinik: 'hliník' };
  F.PODTYPY = { oblozka: 'Obložka', ostenie: 'Ostenie', R90: 'Rozšírenie R90', R180: 'Rozšírenie R180', 'zamok-bb': 'Zámok BB (na kľúč)', 'zamok-pz': 'Zámok PZ (na vložku)', 'zamok-wc': 'Zámok WC', zavesy: 'Závesy', protiplech: 'Protiplech', mriezka: 'Vetracia mriežka', prah: 'Padací prah', ine: 'Iné' };
  const farbaNazov = f => F.FARBY[f]?.nazov || F.FARBY_KOV[f] || f || '';

  /** Rozloží kľúč skladovej karty na parametre (pre filtre, nákres a rozmery) */
  F.kartaParam = kluc => {
    const c = kluc.split('|'), t = c[0];
    const druh = { KR: 'kridla', OB: 'zarubne', OS: 'zarubne', RZ: 'rozsirenia', ZM: 'kovanie', ZV: 'kovanie', PP: 'kovanie', MR: 'kovanie', PR: 'kovanie' }[t] || 'prislusenstvo';
    const o = { kluc, typ: t, druh, jednotka: F.kartaJednotka(kluc), farba: '', podtyp: 'ine' };
    if (t === 'AC') { const k = F.karta(kluc); if (k && k.druh && F.DRUHY_SKLADU[k.druh]) o.druh = k.druh; if (k && k.farba) o.farba = k.farba; }
    if (t === 'KR') Object.assign(o, { kolekcia: c[1], prevedenie: c[2], farba: c[3], sirka: c[4], vyska: c[5], podtyp: '' });
    if (t === 'OB') Object.assign(o, { farba: c[1], podtyp: 'oblozka' });
    if (t === 'OS') Object.assign(o, { zarubna: c[1], farba: c[2], podtyp: 'ostenie' });
    if (t === 'RZ') Object.assign(o, { zarubna: c[1], farba: c[2], podtyp: c[1] });
    if (t === 'ZM') Object.assign(o, { kovanie: c[1], farba: /cierna/.test(c[1]) ? 'cierna' : /nikel/.test(c[1]) ? 'nikel' : '', podtyp: 'zamok-' + c[1].split('-')[0] });
    if (t === 'ZV') Object.assign(o, { farba: c[1], podtyp: 'zavesy' });
    if (t === 'PP') o.podtyp = 'protiplech';
    if (t === 'MR') Object.assign(o, { farba: c[1], podtyp: 'mriezka' });
    if (t === 'PR') o.podtyp = 'prah';
    return o;
  };
  /** Vzorová pozícia pre výpočet rozmerov a nákres */
  const STENA = { F80: 90, F100: 115, F130: 145, F160: 175 };
  F.kartaPozicia = o => {
    if (o.typ === 'KR') return { druh: 'dvere', kolekcia: o.kolekcia, prevedenie: o.prevedenie, farba: o.farba, farba_zarubne: o.farba, sirka: o.sirka, vyska: o.vyska, smer: 'lave', kovanie: 'bez', zavesy: 'nikel', mriezka: 'bez', ks: 1 };
    if (['OB', 'OS', 'RZ'].includes(o.typ)) {
      const typ = o.typ === 'OS' ? o.zarubna : 'F100', ext = o.typ === 'RZ' ? (o.zarubna === 'R180' ? 180 : 90) : 0;
      return { druh: 'dvere', kolekcia: 'minimal', prevedenie: 'falc', farba: o.farba, farba_zarubne: o.farba, sirka: '80', vyska: '197', smer: 'lave', stena: (ext ? 175 : STENA[typ]) + ext, kovanie: 'bez', ks: 1 };
    }
    return null;
  };

  /* ---------- údaje z pohybov ---------- */
  const zakazkaZDokladu = dok => { const m = String(dok || '').match(/\/\s*(\S+)\s*$/); return m ? m[1] : ''; };
  const davkaZDokladu = dok => { const m = String(dok || '').match(/^(\S+)\s*\//); return m ? m[1] : ''; };
  /** Spotreba (výdaje) za posledných `dni` dní po kľúčoch */
  F.spotrebaZaDni = (dni) => {
    const od = Date.now() - dni * DEN, o = {};
    D().pohyby.forEach(p => { if (p.typ === 'výdaj' && Date.parse(p.t) >= od) o[p.kluc] = (o[p.kluc] || 0) - p.mnozstvo; });
    return o;
  };
  /** Rezervácie a dopyty jednej položky po zákazkách */
  F.rezervacieKarty = kluc => {
    const rez = [], dop = [], d = D();
    d.zakazky.forEach(z => {
      if (z.vydane) return;
      const m = F.potreba(z)[kluc]; if (!m) return;
      const v = d.davky.find(x => x.zakazky.includes(z.id));
      const r = { z, mnozstvo: r2(m), davka: v };
      if (REZERVUJE.includes(z.stav)) rez.push(r); else if (z.stav === 'dopyt') dop.push(r);
    });
    rez.sort((a, b) => ((a.davka && a.davka.datum) || '9').localeCompare((b.davka && b.davka.datum) || '9'));
    return { rez, dop };
  };

  /** Prognóza: priemerná spotreba za obdobie → kedy klesne pod minimum, návrh objednávky */
  F.prognozaKarty = (k, dni = 180) => {
    const n = F.N(), rez = F.rezervacieKarty(k.kluc), rezM = F.sum(rez.rez, r => r.mnozstvo);
    const pohyby = D().pohyby.filter(p => p.kluc === k.kluc && p.typ === 'výdaj');
    const od = Date.now() - dni * DEN, od30 = Date.now() - 30 * DEN;
    const prvy = pohyby.length ? Math.min(...pohyby.map(p => Date.parse(p.t))) : Date.now();
    const efDni = Math.max(14, Math.min(dni, (Date.now() - prvy) / DEN));       // ak história kratšia než obdobie
    const spotr = -F.sum(pohyby.filter(p => Date.parse(p.t) >= od), p => p.mnozstvo);
    const spotr30 = -F.sum(pohyby.filter(p => Date.parse(p.t) >= od30), p => p.mnozstvo);
    const denna = spotr / efDni, denna30 = spotr30 / 30;
    const volne = r2(k.stav - rezM), kryt = +k.kryt || 30, lehota = +k.lehota || n.dodaciaLehotaDni;
    const out = { denna, tyzden: denna * 7, mesiac: denna * 30, spotr, efDni, trend: denna ? (denna30 - denna) / denna : 0, volne, rezM, kryt, lehota };
    // projekcia dopredu po dňoch (s príchodom objednaného tovaru)
    let s = volne; out.kedyMin = null; out.kedyNula = null;
    const dnes = F.today();
    for (let i = 1; i <= 365 && denna > 0; i++) {
      const dt = F.addDays(dnes, i);
      if (k.objednane && k.prichod && dt === k.prichod) s += +k.objednane;
      s -= denna;
      if (out.kedyMin == null && s < k.min) out.kedyMin = dt;
      if (out.kedyNula == null && s < 0) { out.kedyNula = dt; break; }
    }
    if (volne < k.min) out.kedyMin = dnes;
    if (volne < 0) out.kedyNula = dnes;
    const ciel = k.min + denna * (lehota + kryt);
    out.navrh = Math.max(0, Math.ceil(ciel - volne - (+k.objednane || 0)));
    out.objednatDo = out.kedyMin ? F.addDays(out.kedyMin, -lehota) : null;
    return out;
  };

  /* =====================================================================
     NÁKRESY
     ===================================================================== */
  const C = { ink: '#1F1B16', soft: '#5B5147', faint: '#8B8172', wood: '#8B5A2B', brass: '#B08D57', ox: '#6E2620', line: '#CFC8BA', paper: '#F6F4EE', ok: '#3F6B4F' };
  const KOV = { nikel: ['#D9DBDD', '#9A9EA3'], cierna: ['#34302D', '#111'], biela: ['#F7F6F2', '#BDB8B0'], hlinik: ['#C9CCD0', '#8E9297'], '': ['#D9DBDD', '#9A9EA3'] };
  const svg = (w, h, g, cls = 'v-ikon', vb) => `<svg class="${cls}" viewBox="${vb || `0 0 ${w} ${h}`}" width="${w}" height="${h}" role="img">${g}</svg>`;
  /** Ikona/nákres kovania a príslušenstva (mierka približná) */
  F.svgKovanie = (o, H = 120) => {
    const [f, s] = KOV[o.farba] || KOV[''], sw = 'stroke-width="1.2"';
    let g = '', W = 100, HH = 120;
    switch (o.podtyp) {
      case 'zamok-bb': case 'zamok-pz': case 'zamok-wc': {
        g = `<rect x="38" y="4" width="10" height="112" rx="2" fill="${f}" stroke="${s}" ${sw}/>
          <rect x="48" y="18" width="44" height="78" rx="3" fill="#E9E5DC" stroke="${C.soft}" ${sw}/>
          <rect x="34" y="40" width="8" height="12" rx="2" fill="${f}" stroke="${s}" ${sw}/><rect x="34" y="58" width="8" height="8" fill="${f}" stroke="${s}" ${sw}/>
          <circle cx="76" cy="44" r="5" fill="#fff" stroke="${C.soft}" ${sw}/>`;
        if (o.podtyp === 'zamok-bb') g += `<circle cx="76" cy="78" r="4" fill="#fff" stroke="${C.soft}" ${sw}/><path d="M74 81 L73 89 L79 89 L78 81Z" fill="#fff" stroke="${C.soft}" ${sw}/>`;
        if (o.podtyp === 'zamok-pz') g += `<circle cx="76" cy="77" r="5" fill="#fff" stroke="${C.soft}" ${sw}/><rect x="73" y="77" width="6" height="12" rx="2" fill="#fff" stroke="${C.soft}" ${sw}/>`;
        if (o.podtyp === 'zamok-wc') g += `<rect x="70" y="74" width="12" height="12" fill="#fff" stroke="${C.soft}" ${sw}/><line x1="76" y1="74" x2="76" y2="86" stroke="${C.soft}" ${sw}/>`;
        g += `<text x="70" y="112" text-anchor="middle" class="t-lab">${o.podtyp.slice(6).toUpperCase()}</text>`;
        break;
      }
      case 'zavesy':
        g = [0, 1, 2].map(i => { const y = 8 + i * 38; return `<rect x="22" y="${y}" width="22" height="30" rx="3" fill="${f}" stroke="${s}" ${sw}/><rect x="56" y="${y}" width="22" height="30" rx="3" fill="${f}" stroke="${s}" ${sw}/><rect x="44" y="${y - 3}" width="12" height="36" rx="6" fill="${f}" stroke="${s}" ${sw}/>`; }).join('') + `<text x="50" y="119" text-anchor="middle" class="t-lab">3 ks</text>`;
        break;
      case 'protiplech':
        g = `<rect x="38" y="6" width="24" height="108" rx="3" fill="${f}" stroke="${s}" ${sw}/><rect x="44" y="40" width="12" height="16" rx="2" fill="#fff" stroke="${s}" ${sw}/><rect x="44" y="62" width="12" height="10" rx="2" fill="#fff" stroke="${s}" ${sw}/><circle cx="50" cy="16" r="2.5" fill="#fff" stroke="${s}"/><circle cx="50" cy="104" r="2.5" fill="#fff" stroke="${s}"/>`;
        break;
      case 'mriezka':
        W = 140; HH = 70;
        g = `<rect x="6" y="10" width="128" height="50" rx="4" fill="${f}" stroke="${s}" ${sw}/>` + Array.from({ length: 9 }, (_, i) => `<rect x="${16 + i * 12.4}" y="18" width="6" height="34" rx="2" fill="${s}" opacity=".55"/>`).join('');
        break;
      case 'prah':
        W = 160; HH = 60;
        g = `<rect x="6" y="12" width="148" height="22" rx="2" fill="#C9CCD0" stroke="#8E9297" ${sw}/><rect x="10" y="34" width="140" height="10" fill="#555" opacity=".8"/><circle cx="148" cy="23" r="4" fill="#fff" stroke="#8E9297"/><text x="80" y="56" text-anchor="middle" class="t-lab">výsuvný prah – zapúšťa sa do spodnej hrany</text>`;
        break;
      default:
        g = `<rect x="18" y="30" width="64" height="64" rx="4" fill="${C.paper}" stroke="${C.soft}" ${sw}/><path d="M18 46 H82 M50 30 V46" stroke="${C.soft}" ${sw}/>`;
    }
    const sc = H / HH;
    return svg(Math.round(W * sc), Math.round(HH * sc), g, 'v-ikon', `0 0 ${W} ${HH}`);
  };
  /** Rozširovací element – rez */
  F.svgRozsirenie = (o, H = 120) => {
    const sir = o.zarubna === 'R180' ? 180 : 90, fc = F.FW && F.FW[o.farba] ? F.FW[o.farba] : null;
    const fill = fc ? (fc.frame || fc[2] || '#EFEEEA') : '#EFEEEA', W = 240, HH = 90, s = 180 / 180, w = sir * s;
    const x0 = 30, y0 = 34, t = 18;
    let g = `<rect x="${x0}" y="${y0}" width="${w}" height="${t}" fill="${fill}" stroke="${C.ink}" stroke-width=".8"/>`;
    g += `<rect x="${x0 + w}" y="${y0 + 5}" width="8" height="${t - 10}" fill="${fill}" stroke="${C.ink}" stroke-width=".8"/>`;
    g += `<path d="M${x0} ${y0 + 5} h-6 v${t - 10} h6" fill="none" stroke="${C.ink}" stroke-width=".8"/>`;
    g += `<g class="dim"><line x1="${x0}" y1="${y0 - 10}" x2="${x0 + w}" y2="${y0 - 10}" stroke="${C.wood}" stroke-width=".7"/><line x1="${x0}" y1="${y0 - 14}" x2="${x0}" y2="${y0 - 6}" stroke="${C.wood}" stroke-width=".7"/><line x1="${x0 + w}" y1="${y0 - 14}" x2="${x0 + w}" y2="${y0 - 6}" stroke="${C.wood}" stroke-width=".7"/><text x="${x0 + w / 2}" y="${y0 - 13}" text-anchor="middle" fill="${C.wood}">${sir}</text></g>`;
    g += `<text x="${x0}" y="${y0 + t + 22}" class="t-lab">pero ↔ drážka · nasúva sa za ostenie</text>`;
    const sc = H / HH;
    return svg(Math.round(W * sc), Math.round(HH * sc), g, 'v-ikon', `0 0 ${W} ${HH}`);
  };
  /** Malá ikona do zoznamu */
  F.kartaIkona = (o, h = 34) => {
    if (o.typ === 'KR') return F.svgKridlo(F.kartaPozicia(o), { h, dim: false });
    if (o.typ === 'OB' || o.typ === 'OS') { const p = F.kartaPozicia(o); return F.svgProfil(F.zarubna(p), { w: h * 1.6 }).replace(/<text[^>]*>[^<]*<\/text>|<g class="dim">.*?<\/g>/g, ''); }
    if (o.typ === 'RZ') return F.svgRozsirenie(o, h);
    return F.svgKovanie(o, h);
  };
  /** Veľký nákres na skladovej karte */
  F.kartaNakres = o => {
    const p = F.kartaPozicia(o);
    if (o.typ === 'KR') return `<div class="nk-row"><figure>${F.svgKridlo(p, { h: 400 })}<figcaption>polotovar krídla – bez orientácie, zámku a závesov (frézuje sa na CNC)</figcaption></figure></div>`;
    if (o.typ === 'OB' || o.typ === 'OS') {
      const zr = F.zarubna(p);
      return `<div class="nk-row"><figure>${F.svgProfil(zr, { w: 260 })}<figcaption>rez profilom zárubne ${zr.typ}: obložka + ostenie + obložka${o.typ === 'OB' ? ' – <b>obložka</b> je bočná lišta' : ' – <b>ostenie</b> je stredný diel'}</figcaption></figure>
        <figure>${F.svgZarubna(p, zr, { h: 240, dim: true })}<figcaption>príklad: zárubňa ${zr.typ} 80/197</figcaption></figure></div>`;
    }
    if (o.typ === 'RZ') return `<div class="nk-row"><figure>${F.svgRozsirenie(o, 150)}<figcaption>rozširovací element ${o.zarubna} – predĺži hĺbku zárubne o ${o.zarubna.slice(1)} mm</figcaption></figure></div>`;
    return `<div class="nk-row"><figure>${F.svgKovanie(o, 200)}<figcaption>${e(F.PODTYPY[o.podtyp] || '')} · ilustračný nákres</figcaption></figure></div>`;
  };

  /** Rozmery a technické parametre podľa druhu položky: [[popis, hodnota], …] */
  F.kartaRozmery = o => {
    const n = F.N(), p = F.kartaPozicia(o), R = [];
    if (o.typ === 'KR') {
      const k = F.kridlo(p);
      R.push(['Kolekcia / model', `${F.KOLEKCIE[o.kolekcia]?.nazov} ${F.KOLEKCIE[o.kolekcia]?.model}`], ['Prevedenie', F.PREVEDENIA[o.prevedenie]], ['Farba', farbaNazov(o.farba)],
        ['Konštrukcia', k.ramove ? 'rámová (rámik + výplň)' : 'hladké krídlo'],
        ['Rozmer polotovaru (š × v × hr.)', `${k.w} × ${k.polotovarH} × ${n.hrubkaKridla} mm`],
        ['Nominálna šírka', `${o.sirka} (${+o.sirka * 10} mm svetlosť dverí)`], ['Výška polotovaru', `${F.VYSKY[o.vyska]?.txt} – ${F.VYSKY[o.vyska]?.norma}`]);
      const pouz = Object.keys(F.VYSKY).map(v => ({ v, k: F.kridlo({ ...p, vyska: v }) })).filter(x => x.k.polotovarVyska === o.vyska);
      R.push(['Použije sa pre výšky', pouz.map(x => `${F.VYSKY[x.v].txt} ${F.VYSKY[x.v].norma}${x.k.prirez > 0 ? ` (prirezať ${x.k.prirez} mm)` : ''}`).join(', ')]);
      R.push(['Opracovanie na CNC', 'orientácia (ľavé/pravé), zámok, závesy, mriežka a prah podľa zákazky'])
    } else if (o.typ === 'OB' || o.typ === 'OS') {
      const zr = F.zarubna(p), m = (o.typ === 'OB' ? zr.dielce.reduce((s, d) => s + d.dlzObl, 0) * 2 : zr.dielce.reduce((s, d) => s + d.dlzOst, 0)) / 1000;
      if (o.typ === 'OB') R.push(['Šírka obložky', n.oblozkaSirka + ' mm']);
      else {
        const rng = { F80: '80–100', F100: '100–130', F130: '130–160', F160: '160–190' }[o.zarubna];
        R.push(['Typ zárubne', o.zarubna], ['Šírka ostenia', (n.ostenieSirka[o.zarubna] || '–') + ' mm'], ['Hrúbka ostenia', n.ostenieHrubka + ' mm'], ['Pre hrúbku steny', rng + ' mm'], ['Hĺbka zárubne', zr.hlbka + ' mm']);
      }
      R.push(['Farba', farbaNazov(o.farba)], ['Dĺžka tyče', n.dlzkaTyce + ' mm'], ['Spotreba na 1 zárubňu 80/197', m.toFixed(2) + ' m' + (o.typ === 'OB' ? ' (2 obložky na dielec)' : '')]);
    } else if (o.typ === 'RZ') {
      R.push(['Rozšírenie hĺbky', o.zarubna.slice(1) + ' mm'], ['Farba', farbaNazov(o.farba)], ['Použitie', 'steny nad 190 mm, v krokoch po 90 mm']);
    } else {
      R.push(['Druh', F.PODTYPY[o.podtyp] || 'príslušenstvo']);
      if (o.farba) R.push(['Farba / povrch', farbaNazov(o.farba)]);
      if (o.typ === 'ZM') R.push(['Popis', F.KOVANIE[o.kovanie] || o.kovanie]);
      if (o.typ === 'ZV') R.push(['Balenie', 'sada 3 ks na 1 krídlo']);
    }
    return R;
  };
  /** Hmotnosť jednotky: krídla z packing listu, ostatné z karty */
  F.kartaHmotnost = (k, o) => {
    if (o.typ === 'KR') { const h = F.hmotnostKridla(F.kartaPozicia(o)); return h ? { net: h.net, brutto: h.brutto, zdroj: (h.odhad ? 'odhad – dopočítané z iných šírok' : F.hmotnostiTab().zdroj || 'tabuľka hmotností'), auto: true } : null; }
    if (k.hmotnost) return { net: +k.hmotnost, brutto: +k.hmotnost, zdroj: 'zadané na karte', auto: false };
    return null;
  };

  /* =====================================================================
     GRAF: stav v čase (minulosť) + projekcia, spotreba po obdobiach
     ===================================================================== */
  const zaciatokObd = (t, kr) => { const d = new Date(t); d.setHours(12, 0, 0, 0); if (kr === 'm') d.setDate(1); else d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
  F.statistikaKarty = (k, mesiace = 6, kr = 'm') => {
    const pohyby = D().pohyby.filter(p => p.kluc === k.kluc), od = new Date(); od.setMonth(od.getMonth() - mesiace);
    const buck = []; let x = zaciatokObd(od.getTime(), kr);
    const koniec = F.today();
    while (x <= koniec) { buck.push({ od: x, vydaj: 0, prijem: 0, ine: 0 }); const d = new Date(x + 'T12:00:00'); if (kr === 'm') d.setMonth(d.getMonth() + 1); else d.setDate(d.getDate() + 7); x = d.toISOString().slice(0, 10); }
    pohyby.forEach(p => {
      const b = zaciatokObd(Date.parse(p.t), kr), i = buck.findIndex(z => z.od === b); if (i < 0) return;
      if (p.typ === 'výdaj') buck[i].vydaj -= p.mnozstvo; else if (p.typ === 'príjem') buck[i].prijem += p.mnozstvo; else buck[i].ine += p.mnozstvo;
    });
    // stav na konci obdobia = súčasný stav − pohyby po konci obdobia
    buck.forEach((b, i) => { const dalsi = buck[i + 1] ? Date.parse(buck[i + 1].od + 'T00:00:00') : Infinity; b.stav = r2(k.stav - F.sum(pohyby.filter(p => Date.parse(p.t) >= dalsi), p => p.mnozstvo)); b.vydaj = r2(b.vydaj); b.prijem = r2(b.prijem); });
    return buck;
  };
  const MES = ['jan', 'feb', 'mar', 'apr', 'máj', 'jún', 'júl', 'aug', 'sep', 'okt', 'nov', 'dec'];
  F.svgSpotreba = (buck, kr, j) => {
    const W = 640, H = 200, pl = 36, pr = 10, pt = 14, pb = 30, n = buck.length || 1, bw = (W - pl - pr) / n;
    const mx = Math.max(1, ...buck.map(b => Math.max(b.vydaj, b.prijem))), sy = (H - pt - pb) / mx;
    const step = mx > 10 ? Math.pow(10, Math.floor(Math.log10(mx))) * (mx / Math.pow(10, Math.floor(Math.log10(mx))) > 5 ? 2 : 1) : (mx > 5 ? 2 : 1);
    let g = '';
    for (let v = 0; v <= mx; v += step) { const y = H - pb - v * sy; g += `<line x1="${pl}" y1="${y}" x2="${W - pr}" y2="${y}" stroke="${C.line}" stroke-width=".6"/><text x="${pl - 4}" y="${y + 3}" text-anchor="end" class="t-ax">${+v.toFixed(1)}</text>`; }
    buck.forEach((b, i) => {
      const x = pl + i * bw, w = Math.max(2, bw * .38);
      if (b.vydaj) g += `<rect x="${x + bw * .12}" y="${H - pb - b.vydaj * sy}" width="${w}" height="${b.vydaj * sy}" fill="${C.wood}" rx="1.5"><title>výdaj ${b.vydaj} ${j}</title></rect>`;
      if (b.prijem) g += `<rect x="${x + bw * .12 + w + 1}" y="${H - pb - b.prijem * sy}" width="${w * .7}" height="${b.prijem * sy}" fill="${C.ok}" opacity=".55" rx="1.5"><title>príjem ${b.prijem} ${j}</title></rect>`;
      if (b.vydaj && bw > 26) g += `<text x="${x + bw * .12 + w / 2}" y="${H - pb - b.vydaj * sy - 3}" text-anchor="middle" class="t-ax b">${+b.vydaj.toFixed(1)}</text>`;
      const d = new Date(b.od + 'T12:00:00'), lab = kr === 'm' ? MES[d.getMonth()] + (d.getMonth() === 0 || i === 0 ? ' ' + String(d.getFullYear()).slice(2) : '') : (i % Math.ceil(n / 13) === 0 ? `${d.getDate()}.${d.getMonth() + 1}.` : '');
      if (lab) g += `<text x="${x + bw / 2}" y="${H - pb + 13}" text-anchor="middle" class="t-ax">${lab}</text>`;
    });
    g += `<line x1="${pl}" y1="${H - pb}" x2="${W - pr}" y2="${H - pb}" stroke="${C.soft}" stroke-width=".8"/>`;
    return `<svg class="v-graf" viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Spotreba">${g}</svg>
      <div class="lg"><span><i style="background:${C.wood}"></i>výdaj do výroby</span><span><i style="background:${C.ok};opacity:.55"></i>príjem</span></div>`;
  };
  /** Stav v minulosti + projekcia voľného množstva do budúcnosti */
  F.svgStavPrognoza = (k, buck, pg, j) => {
    const W = 640, H = 200, pl = 36, pr = 10, pt = 14, pb = 30, dopredu = 90;
    const hist = buck.map(b => ({ d: b.od, v: b.stav }));
    const t0 = Date.parse((hist[0] ? hist[0].d : F.today()) + 'T12:00:00'), tN = Date.parse(F.addDays(F.today(), dopredu) + 'T12:00:00');
    const proj = []; let s = pg.volne;
    for (let i = 0; i <= dopredu; i++) { const dt = F.addDays(F.today(), i); if (i && k.objednane && dt === k.prichod) s += +k.objednane; if (i) s -= pg.denna; if (i % 3 === 0 || dt === k.prichod) proj.push({ d: dt, v: s }); }
    const vals = [...hist.map(h => h.v), ...proj.map(p => p.v), k.min, 0];
    const mx = Math.max(1, ...vals), mn = Math.min(0, ...vals), sy = (H - pt - pb) / (mx - mn);
    const X = d => pl + (Date.parse(d + 'T12:00:00') - t0) / (tN - t0) * (W - pl - pr), Y = v => H - pb - (v - mn) * sy;
    let g = `<rect x="${X(F.today())}" y="${pt}" width="${W - pr - X(F.today())}" height="${H - pt - pb}" fill="${C.paper}"/>`;
    g += `<line x1="${pl}" y1="${Y(0)}" x2="${W - pr}" y2="${Y(0)}" stroke="${C.soft}" stroke-width=".8"/>`;
    if (k.min) g += `<line x1="${pl}" y1="${Y(k.min)}" x2="${W - pr}" y2="${Y(k.min)}" stroke="${C.ox}" stroke-dasharray="5 4" stroke-width="1"/><text x="${W - pr - 2}" y="${Y(k.min) - 4}" text-anchor="end" class="t-ax" fill="${C.ox}">min ${k.min}</text>`;
    g += `<text x="${pl - 4}" y="${Y(mx) + 3}" text-anchor="end" class="t-ax">${+mx.toFixed(0)}</text><text x="${pl - 4}" y="${Y(0) + 3}" text-anchor="end" class="t-ax">0</text>`;
    if (hist.length) g += `<polyline points="${[...hist, { d: F.today(), v: k.stav }].map(h => `${X(h.d)},${Y(h.v)}`).join(' ')}" fill="none" stroke="${C.ink}" stroke-width="1.8"/>`;
    g += `<polyline points="${proj.map(h => `${X(h.d)},${Y(h.v)}`).join(' ')}" fill="none" stroke="${C.brass}" stroke-width="1.8" stroke-dasharray="6 4"/>`;
    g += `<line x1="${X(F.today())}" y1="${pt}" x2="${X(F.today())}" y2="${H - pb}" stroke="${C.soft}" stroke-width=".8"/><text x="${X(F.today())}" y="${pt - 3}" text-anchor="middle" class="t-ax b">dnes</text>`;
    if (pg.rezM) g += `<line x1="${X(F.today())}" y1="${Y(k.stav)}" x2="${X(F.today())}" y2="${Y(pg.volne)}" stroke="${C.ox}" stroke-width="3" opacity=".5"><title>rezervované ${pg.rezM} ${j}</title></line>`;
    if (pg.kedyMin && pg.kedyMin > F.today() && pg.kedyMin <= F.addDays(F.today(), dopredu)) g += `<circle cx="${X(pg.kedyMin)}" cy="${Y(k.min)}" r="4" fill="${C.ox}"/><text x="${X(pg.kedyMin)}" y="${Y(k.min) + 14}" text-anchor="middle" class="t-ax" fill="${C.ox}">${F.fmtD(pg.kedyMin).slice(0, -5)}</text>`;
    if (k.objednane && k.prichod && k.prichod > F.today()) g += `<text x="${X(k.prichod)}" y="${pt + 10}" text-anchor="middle" class="t-ax" fill="${C.ok}">+${k.objednane} príchod</text>`;
    [0, .25, .5, .75, 1].forEach(f => { const t = new Date(t0 + f * (tN - t0)); g += `<text x="${pl + f * (W - pl - pr)}" y="${H - pb + 13}" text-anchor="${f === 0 ? 'start' : f === 1 ? 'end' : 'middle'}" class="t-ax">${t.getDate()}. ${t.getMonth() + 1}.</text>`; });
    return `<svg class="v-graf" viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Stav a prognóza">${g}</svg>
      <div class="lg"><span><i style="background:${C.ink}"></i>stav na sklade (história)</span><span><i class="dash" style="border-color:${C.brass}"></i>voľné množstvo – prognóza pri priemernej spotrebe</span><span><i class="dash" style="border-color:${C.ox}"></i>minimálna zásoba</span></div>`;
  };

  /* =====================================================================
     ZOZNAM SKLADU – filtre, zoradenie
     ===================================================================== */
  const FILTRE = ['q', 'druh', 'kol', 'farba', 'prev', 'vys', 'sir', 'pod', 'zar', 'min', 'rez', 'nasklade', 'sort', 'dir'];
  F.vSklad = q => {
    const { modal, toast, commit } = F.ui, d = D(), rez = F.rezervacie(), tab = q.get('tab') || 'karty';
    d.zakazky.forEach(z => Object.keys(F.potreba(z)).forEach(k => F.zaistiKartu(k)));
    const sp30 = F.spotrebaZaDni(30), sp180 = F.spotrebaZaDni(180);
    const karty = d.karty.map(k => {
      const o = F.kartaParam(k.kluc), r = r2(rez[k.kluc] || 0), vol = r2(k.stav - r), den = (sp180[k.kluc] || 0) / 180;
      return { k, o, nazov: F.kartaNazov(k.kluc), r, vol, sp: r2(sp30[k.kluc] || 0), vydrzi: den > 0 ? Math.max(0, Math.floor((vol - k.min) / den)) : null };
    });
    const hodnota = F.sum(karty, x => x.k.stav * (+x.k.cena || 0)), bezCeny = karty.filter(x => !x.k.cena).length;
    const pocet = (f) => karty.filter(f).length;
    const vals = (key, fn) => [...new Set(karty.map(x => x.o[key]).filter(Boolean))].sort().map(v => `<option value="${e(v)}">${e(fn(v))}</option>`).join('');
    const th = (key, txt, cls = '') => `<th class="${cls} sortable" data-sort="${key}">${txt}<i></i></th>`;

    const toolbar = `<section class="card filt no-print">
      <div class="f-druh">${['', ...Object.keys(F.DRUHY_SKLADU)].map(k => `<button class="pill" data-druh="${k}">${k ? F.DRUHY_SKLADU[k].split(' – ')[0].replace(' (dvere)', '') : 'Všetko'} <small>${k ? pocet(x => x.o.druh === k) : karty.length}</small></button>`).join('')}</div>
      <div class="f-row">
        <label class="f-q">Hľadať<input id="fq" type="search" placeholder="názov, model, farba, F100…"></label>
        <label data-pre="kridla">Kolekcia<select id="fkol"><option value="">všetky</option>${Object.entries(F.KOLEKCIE).map(([k, v]) => `<option value="${k}">${v.nazov} ${v.model}</option>`).join('')}</select></label>
        <label data-pre="kridla">Falc<select id="fprev"><option value="">falc aj bezfalc</option>${Object.entries(F.PREVEDENIA).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
        <label data-pre="kridla">Šírka<select id="fsir"><option value="">všetky</option>${F.SIRKY.map(s => `<option>${s}</option>`).join('')}</select></label>
        <label data-pre="kridla">Výška<select id="fvys"><option value="">všetky</option>${Object.entries(F.VYSKY).map(([k, v]) => `<option value="${k}">${v.txt} ${v.norma}</option>`).join('')}</select></label>
        <label data-pre="zarubne rozsirenia">Zárubňa<select id="fzar"><option value="">všetky</option>${vals('zarubna', v => v)}</select></label>
        <label data-pre="kovanie zarubne rozsirenia">Druh dielu<select id="fpod"><option value="">všetky</option>${vals('podtyp', v => F.PODTYPY[v] || v)}</select></label>
        <label>Farba<select id="ffarba"><option value="">všetky</option>${vals('farba', farbaNazov)}</select></label>
        <label>Zoradiť<select id="fsort"><option value="nazov">podľa názvu</option><option value="stav">na sklade</option><option value="rez">rezervované</option><option value="vol">voľné</option><option value="min">minimum</option><option value="chyba">chýba do minima</option><option value="sp">spotreba 30 dní</option><option value="vydrzi">vydrží (dni)</option></select></label>
        <button class="btn ghost sm" id="fdir" title="smer zoradenia">↑</button>
      </div>
      <div class="f-row f-chk">
        <label class="chk-line"><input type="checkbox" id="fmin"> len pod minimom <small>(${pocet(x => x.vol < x.k.min)})</small></label>
        <label class="chk-line"><input type="checkbox" id="frez"> len s rezerváciou <small>(${pocet(x => x.r > 0)})</small></label>
        <label class="chk-line"><input type="checkbox" id="fnasklade"> len na sklade &gt; 0</label>
        <span class="grow"></span><span class="muted small" id="fcount"></span><button class="lnk" id="freset">zrušiť filtre</button>
      </div></section>`;

    const tabs = `<nav class="tabs no-print"><a href="#/sklad" class="${tab === 'karty' ? 'on' : ''}">Skladové karty</a><a href="#/sklad?tab=pohyby" class="${tab === 'pohyby' ? 'on' : ''}">Pohyby</a><a href="#/sklad?tab=dodavky" class="${tab === 'dodavky' ? 'on' : ''}">Dodávky (${(d.dodavky || []).length})</a></nav>`;
    let body;
    if (tab === 'dodavky') body = `<section class="card"><h2>Prijaté dodávky</h2>${(d.dodavky || []).map(x => `<details class="dod"><summary><b>${e(x.cislo)}</b> · ${e(x.dodavatel)} · ${F.fmtD(x.datum)} · ${F.sum(x.polozky, y => +y.ks)} ks · brutto ${F.kg(F.sum(x.polozky, y => +y.brutto || 0))} <span class="muted small">prijaté ${F.fmtD(x.prijate)}</span></summary>${F.nahladDodavky(x)}</details>`).join('') || '<p class="muted">Zatiaľ žiadne dodávky.</p>'}</section>`;
    else if (tab === 'pohyby') body = `<section class="card"><h2>Pohyby <small class="muted">posledných 300 · kliknutím otvoríte skladovú kartu</small></h2><table class="t"><thead><tr><th>Čas</th><th>Položka</th><th class="r">Množstvo</th><th>Typ</th><th>Doklad</th></tr></thead><tbody>${d.pohyby.slice(0, 300).map(p => `<tr data-href="#/karta/${encodeURIComponent(p.kluc)}"><td>${F.fmtD(p.t)} ${p.t.slice(11, 16)}</td><td>${e(F.kartaNazov(p.kluc))}</td><td class="r ${p.mnozstvo < 0 ? 'neg' : 'ok'}">${p.mnozstvo > 0 ? '+' : ''}${+p.mnozstvo.toFixed(2)}</td><td>${e(p.typ)}</td><td>${e(p.doklad || '')}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">Žiadne pohyby.</td></tr>'}</tbody></table></section>`;
    else {
      const skup = F.groupBy(karty, x => x.o.druh);
      body = toolbar + Object.keys(F.DRUHY_SKLADU).filter(s => skup[s]).map(s => `<section class="card sk-grp" data-grp="${s}"><h2>${F.DRUHY_SKLADU[s]} <small class="muted" data-cnt></small></h2><table class="t sklad"><thead><tr><th></th>${th('nazov', 'Položka')}${th('stav', 'Na sklade', 'r')}${th('rez', 'Rezerv.', 'r')}${th('vol', 'Voľné', 'r')}${th('min', 'Min.', 'r')}<th class="r">Objednané</th><th>Príchod</th>${th('sp', 'Spotr. 30 d', 'r')}${th('vydrzi', 'Vydrží', 'r')}<th></th></tr></thead><tbody>
        ${skup[s].map(x => { const k = x.k, j = x.o.jednotka; return `<tr class="${x.vol < k.min ? 'warn' : ''}" data-k="${e(k.kluc)}" data-href="#/karta/${encodeURIComponent(k.kluc)}"
            data-druh="${x.o.druh}" data-kol="${x.o.kolekcia || ''}" data-prev="${x.o.prevedenie || ''}" data-sir="${x.o.sirka || ''}" data-vys="${x.o.vyska || ''}" data-zar="${x.o.zarubna || ''}" data-pod="${x.o.podtyp || ''}" data-farba="${x.o.farba || ''}"
            data-nazov="${e(x.nazov)}" data-hl="${e(F.partnerNorm(x.nazov + ' ' + k.kluc + ' ' + farbaNazov(x.o.farba)))}" data-stav="${k.stav}" data-rez="${x.r}" data-vol="${x.vol}" data-min="${k.min}" data-chyba="${r2(k.min - x.vol)}" data-sp="${x.sp}" data-vydrzi="${x.vydrzi == null ? 99999 : x.vydrzi}">
          <td class="ic">${F.kartaIkona(x.o, 44)}</td><td><a href="#/karta/${encodeURIComponent(k.kluc)}" class="nm">${e(x.nazov)}</a></td><td class="r"><b>${+k.stav.toFixed(2)}</b> ${j}</td><td class="r muted">${x.r || ''}</td><td class="r ${x.vol < 0 ? 'neg' : x.vol < k.min ? 'warnc' : ''}">${x.vol}</td>
          <td class="r"><input class="num" data-f="min" value="${k.min}"></td><td class="r"><input class="num" data-f="objednane" value="${k.objednane || 0}"></td><td><input type="date" data-f="prichod" value="${k.prichod || ''}"></td>
          <td class="r muted">${x.sp || ''}</td><td class="r ${x.vydrzi != null && x.vydrzi < 14 ? 'warnc' : 'muted'}">${x.vydrzi == null ? '–' : x.vydrzi > 365 ? '> rok' : x.vydrzi + ' d'}</td>
          <td class="r nowrap"><button class="lnk" data-act="inv">inventúra</button>${k.objednane ? ' <button class="lnk" data-act="naskladnit">naskladniť</button>' : ''}</td></tr>`; }).join('')}</tbody></table></section>`).join('');
    }
    app().innerHTML = `<div class="v-head"><div><h1>Sklad</h1><p class="muted">polotovary, profily a kovanie · rezervované = potvrdené zákazky ešte nevydané · kliknite na riadok pre skladovú kartu${hodnota ? ` · hodnota zásob ${F.eur(hodnota)}${bezCeny ? ` <small>(${bezCeny} položiek bez ceny)</small>` : ''}` : ''}</p></div>
      <div class="v-act"><label class="btn ghost file">Príjem dodávky (packing list)<input type="file" id="dodFile" accept=".json" hidden></label><button class="btn" data-act="prijem">+ Príjem</button><button class="btn" data-act="nova">+ Nová položka</button></div></div>${tabs}${body}`;

    /* --- filtre a zoradenie priamo v DOM (bez prekresľovania, kurzor zostane vo vyhľadávaní) --- */
    const st = {}; FILTRE.forEach(f => st[f] = q.get(f) || '');
    if (!st.sort) st.sort = 'nazov';
    const sel = { q: '#fq', kol: '#fkol', prev: '#fprev', sir: '#fsir', vys: '#fvys', zar: '#fzar', pod: '#fpod', farba: '#ffarba', sort: '#fsort' }, chk = { min: '#fmin', rez: '#frez', nasklade: '#fnasklade' };
    const aplikuj = () => {
      if (tab !== 'karty') return;
      const hl = F.partnerNorm(st.q), smer = st.dir === 'd' ? -1 : 1;
      document.querySelectorAll('[data-pre]').forEach(l => { const ok = !st.druh || l.dataset.pre.split(' ').includes(st.druh); l.hidden = !ok; });
      document.querySelectorAll('.pill[data-druh]').forEach(b => b.classList.toggle('on', b.dataset.druh === st.druh));
      let vid = 0;
      document.querySelectorAll('.sk-grp').forEach(sec => {
        const tb = sec.querySelector('tbody'), rows = [...tb.rows];
        let n = 0;
        rows.forEach(r => {
          const D_ = r.dataset;
          const ok = (!st.druh || D_.druh === st.druh) && (!hl || hl.split(/\s+/).every(w => D_.hl.includes(w))) && (!st.kol || D_.kol === st.kol) && (!st.prev || D_.prev === st.prev) && (!st.sir || D_.sir === st.sir) && (!st.vys || D_.vys === st.vys)
            && (!st.zar || D_.zar === st.zar) && (!st.pod || D_.pod === st.pod) && (!st.farba || D_.farba === st.farba)
            && (!st.min || +D_.vol < +D_.min) && (!st.rez || +D_.rez > 0) && (!st.nasklade || +D_.stav > 0);
          r.hidden = !ok; if (ok) n++;
        });
        rows.sort((a, b) => { const x = a.dataset[st.sort], y = b.dataset[st.sort]; return smer * (st.sort === 'nazov' ? x.localeCompare(y, 'sk', { numeric: true }) : (+x - +y)) || a.dataset.nazov.localeCompare(b.dataset.nazov, 'sk', { numeric: true }); }).forEach(r => tb.appendChild(r));
        sec.hidden = !n; sec.querySelector('[data-cnt]').textContent = n === rows.length ? `${n}` : `${n} z ${rows.length}`; vid += n;
        sec.querySelectorAll('th[data-sort]').forEach(t => { t.classList.toggle('on', t.dataset.sort === st.sort); t.querySelector('i').textContent = t.dataset.sort === st.sort ? (smer > 0 ? ' ↑' : ' ↓') : ''; });
      });
      $('#fcount').textContent = `zobrazené ${vid} z ${karty.length} položiek`;
      $('#fdir').textContent = smer > 0 ? '↑' : '↓';
      const qs = new URLSearchParams(); FILTRE.forEach(f => { if (st[f] && !(f === 'sort' && st[f] === 'nazov')) qs.set(f, st[f]); });
      history.replaceState(null, '', '#/sklad' + (qs.toString() ? '?' + qs : ''));
    };
    if (tab === 'karty') {
      Object.entries(sel).forEach(([f, s]) => { const el = $(s); el.value = st[f]; el.addEventListener('input', () => { st[f] = el.value; aplikuj(); }); });
      Object.entries(chk).forEach(([f, s]) => { const el = $(s); el.checked = st[f] === '1'; el.addEventListener('change', () => { st[f] = el.checked ? '1' : ''; aplikuj(); }); });
      document.querySelectorAll('.pill[data-druh]').forEach(b => b.addEventListener('click', () => {
        st.druh = b.dataset.druh;
        // filtre, ktoré nepatria k zvolenému druhu, sa vynulujú
        document.querySelectorAll('[data-pre]').forEach(l => { if (st.druh && !l.dataset.pre.split(' ').includes(st.druh)) { const s = l.querySelector('select'); s.value = ''; const f = Object.keys(sel).find(k => sel[k] === '#' + s.id); st[f] = ''; } });
        aplikuj();
      }));
      $('#fdir').addEventListener('click', () => { st.dir = st.dir === 'd' ? '' : 'd'; aplikuj(); });
      $('#freset').addEventListener('click', () => { FILTRE.forEach(f => st[f] = ''); st.sort = 'nazov'; Object.entries(sel).forEach(([f, s]) => $(s).value = st[f]); Object.values(chk).forEach(s => $(s).checked = false); aplikuj(); });
      document.querySelectorAll('th[data-sort]').forEach(t => t.addEventListener('click', () => { if (st.sort === t.dataset.sort) st.dir = st.dir === 'd' ? '' : 'd'; else { st.sort = t.dataset.sort; st.dir = ['nazov', 'vydrzi'].includes(st.sort) ? '' : 'd'; } $('#fsort').value = st.sort; aplikuj(); }));
      aplikuj();
    }

    $('#dodFile').addEventListener('change', ev => {
      const fl = ev.target.files[0]; if (!fl) return;
      fl.text().then(t => {
        let dod; try { dod = JSON.parse(t); if (dod.format !== 'fortissima-dodavka' || !Array.isArray(dod.polozky)) throw 0; } catch (er) { return toast('Súbor nie je dodávka vo formáte fortissima-dodavka', 'err'); }
        modal('Príjem dodávky ' + e(dod.cislo), F.nahladDodavky(dod) + `<label class="chk-line"><input type="checkbox" id="dodHm" checked> prevziať hmotnosti krídel z tejto dodávky do plánovania rozvozu</label>`,
          [{ t: 'Prijať na sklad', f: () => { try { F.prijmiDodavku(dod, { hmotnosti: $('#dodHm').checked }); commit(`Prijaté: ${F.sum(dod.polozky, x => +x.ks)} ks`); } catch (er) { toast(er.message, 'err'); return false; } } }]);
      });
    });
    app().onchange = ev => {
      const tr = ev.target.closest('[data-k]'), f = ev.target.dataset.f; if (!tr || !f) return;
      const k = F.karta(tr.dataset.k); k[f] = f === 'prichod' ? ev.target.value : F.num(ev.target.value); F.save(); toast('Uložené', 'ok');
      if (f === 'min') { tr.dataset.min = k.min; tr.dataset.chyba = r2(k.min - +tr.dataset.vol); tr.classList.toggle('warn', +tr.dataset.vol < k.min); }
    };
    app().onclick = ev => {
      const b = ev.target.closest('[data-act]'); if (!b) return;
      const a = b.dataset.act, tr = b.closest('[data-k]'), k = tr && F.karta(tr.dataset.k);
      if (a === 'inv') inventura(k);
      if (a === 'naskladnit') naskladnit(k);
      if (a === 'prijem') prijem();
      if (a === 'nova') novaKarta();
    };
  };

  /* ---------- spoločné akcie ---------- */
  const inventura = k => { const v = prompt('Inventúra – skutočný stav:\n' + F.kartaNazov(k.kluc), k.stav); if (v == null) return; F.pohyb(k.kluc, r2(F.num(v) - k.stav), 'inventúra', 'INV ' + F.today()); F.ui.commit('Inventúra zapísaná'); };
  const naskladnit = k => { F.pohyb(k.kluc, k.objednane, 'príjem', 'objednávka ' + (k.prichod || '')); k.objednane = 0; k.prichod = ''; F.ui.commit('Naskladnené'); };
  const prijem = (kluc, typ = 'príjem') => {
    const kl = D().karty.slice().sort((x, y) => F.kartaNazov(x.kluc).localeCompare(F.kartaNazov(y.kluc), 'sk', { numeric: true }));
    F.ui.modal(typ === 'príjem' ? 'Príjem na sklad' : 'Ručný výdaj zo skladu', `<form id="pr" class="kf"><label class="w">Položka<select name="k">${kl.map(x => `<option value="${e(x.kluc)}" ${x.kluc === kluc ? 'selected' : ''}>${e(F.kartaNazov(x.kluc))}</option>`).join('')}</select></label><label>Množstvo<input name="m" type="number" step="0.01" min="0" required></label><label>Doklad<input name="d" placeholder="${typ === 'príjem' ? 'DL dodávateľa' : 'napr. reklamácia FP-…'}"></label></form>`,
      [{ t: typ === 'príjem' ? 'Prijať' : 'Vydať', f: () => { const fd = new FormData($('#pr')); const m = F.num(fd.get('m')); if (!m) return false; F.pohyb(fd.get('k'), typ === 'príjem' ? m : -m, typ, fd.get('d') || (typ === 'príjem' ? '' : 'ručný výdaj')); F.ui.commit(typ === 'príjem' ? 'Prijaté' : 'Vydané'); } }]);
  };


  /* ---------- založenie novej skladovej karty ---------- */
  const novaKarta = () => {
    const op = (obj, fn = v => v) => Object.entries(obj).map(([k, v]) => `<option value="${e(k)}">${e(fn(v))}</option>`).join('');
    const kol = Object.fromEntries(Object.entries(F.KOLEKCIE).map(([k, v]) => [k, `${v.nazov} ${v.model}`]));
    const vys = Object.fromEntries(Object.entries(F.VYSKY).map(([k, v]) => [k, `${v.txt} ${v.norma}`]));
    const far = Object.fromEntries(Object.entries(F.FARBY).map(([k, v]) => [k, v.nazov]));
    const kov = Object.fromEntries(Object.entries(F.KOVANIE).filter(([k]) => k !== 'bez'));
    const mr = Object.fromEntries(Object.entries(F.MRIEZKY).filter(([k]) => k !== 'bez'));
    const DR = { KR: 'Krídlo – polotovar', OB: 'Obložka (profil zárubne)', OS: 'Ostenie (profil zárubne)', RZ: 'Rozšírenie zárubne R90/R180', ZM: 'Zámok', ZV: 'Sada závesov', MR: 'Vetracia mriežka', PP: 'Protiplech', PR: 'Padací prah', AC: 'Iná položka (voľný názov)' };
    F.ui.modal('Nová skladová karta', `<form id="nk" class="kf kf4">
      <label class="w">Druh položky<select name="t">${op(DR)}</select></label>
      <label data-t="KR">Kolekcia<select name="kol">${op(kol)}</select></label>
      <label data-t="KR">Prevedenie<select name="prev">${op(F.PREVEDENIA)}</select></label>
      <label data-t="KR">Šírka<select name="sir">${F.SIRKY.map(s => `<option ${s === '80' ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
      <label data-t="KR">Výška polotovaru<select name="vys">${op(vys)}</select></label>
      <label data-t="OS">Typ zárubne<select name="zar">${F.ZARUBNE.map(z => `<option>${z}</option>`).join('')}</select></label>
      <label data-t="RZ">Rozšírenie<select name="rz"><option>R90</option><option>R180</option></select></label>
      <label data-t="KR OB OS RZ">Farba (dekor)<select name="farba">${op(far)}</select></label>
      <label data-t="ZM">Zámok<select name="zm">${op(kov)}</select></label>
      <label data-t="ZV">Závesy<select name="zv">${op(F.ZAVESY)}</select></label>
      <label data-t="MR">Mriežka<select name="mr">${op(mr)}</select></label>
      <label data-t="AC" class="w">Názov položky<input name="naz" placeholder="napr. Kľučka Lucia R nikel"></label>
      <label data-t="AC">Zaradiť do<select name="druh">${op(F.DRUHY_SKLADU)}</select></label>
      <label data-t="AC">Merná jednotka<select name="mj"><option>ks</option><option>m</option><option>bal</option><option>sada</option><option>kg</option><option>l</option><option>m²</option></select></label>
      <label data-t="AC">Farba / povrch<input name="afarba" placeholder="nepovinné"></label>
      <label>Počiatočný stav<input name="stav" inputmode="decimal" value="0"></label>
      <label>Minimálna zásoba<input name="min" inputmode="decimal" value="0"></label>
      <label>Nákupná cena €<input name="cena" inputmode="decimal" placeholder="bez DPH"></label>
      <label>Dodávateľ<input name="dod"></label>
      <label>Umiestnenie<input name="um" placeholder="regál / pozícia"></label>
      <p class="w muted small" id="nkInfo"></p></form>`,
      [{ t: 'Založiť kartu', f: () => {
        const fd = Object.fromEntries(new FormData($('#nk'))), t = fd.t;
        const kluc = { KR: `KR|${fd.kol}|${fd.prev}|${fd.farba}|${fd.sir}|${fd.vys}`, OB: 'OB|' + fd.farba, OS: `OS|${fd.zar}|${fd.farba}`, RZ: `RZ|${fd.rz}|${fd.farba}`, ZM: 'ZM|' + fd.zm, ZV: 'ZV|' + fd.zv, MR: 'MR|' + fd.mr, PP: 'PP|', PR: 'PR|', AC: 'AC|' + (fd.naz || '').trim().replace(/\|/g, '/') }[t];
        if (t === 'AC' && !fd.naz.trim()) { F.ui.toast('Zadajte názov položky', 'err'); return false; }
        if (F.karta(kluc)) { F.ui.toast('Táto položka už má kartu – otváram ju', 'err'); F.ui.go('#/karta/' + encodeURIComponent(kluc)); return; }
        const k = F.zaistiKartu(kluc);
        Object.assign(k, { min: F.num(fd.min), cena: fd.cena ? F.num(fd.cena) : '', dodavatel: fd.dod.trim(), umiestnenie: fd.um.trim(), zalozena: F.today() });
        if (t === 'AC') Object.assign(k, { druh: fd.druh, jednotka: fd.mj, farba: fd.afarba.trim() });
        const st = F.num(fd.stav); if (st) F.pohyb(kluc, st, 'príjem', 'počiatočný stav');
        F.save(); F.ui.toast('Karta založená', 'ok'); F.ui.go('#/karta/' + encodeURIComponent(kluc));
      } }]);
    const f = $('#nk');
    const prepni = () => {
      const t = f.t.value;
      f.querySelectorAll('[data-t]').forEach(l => l.hidden = !l.dataset.t.split(' ').includes(t));
      const kl = { KR: `KR|${f.kol.value}|${f.prev.value}|${f.farba.value}|${f.sir.value}|${f.vys.value}`, OB: 'OB|' + f.farba.value, OS: `OS|${f.zar.value}|${f.farba.value}`, RZ: `RZ|${f.rz.value}|${f.farba.value}`, ZM: 'ZM|' + f.zm.value, ZV: 'ZV|' + f.zv.value, MR: 'MR|' + f.mr.value, PP: 'PP|', PR: 'PR|', AC: 'AC|' + f.naz.value.trim() }[t];
      const ex = t !== 'AC' || f.naz.value.trim() ? F.karta(kl) : null;
      $('#nkInfo').innerHTML = ex ? `<span class="warnc">⚠ Karta „${e(F.kartaNazov(kl))}“ už existuje (stav ${ex.stav} ${F.kartaJednotka(kl)}).</span>` : (t === 'AC' ? 'Voľná položka – napr. kľučky, tesnenia, lepidlo, obalový materiál. Do zákaziek sa dostane ako príslušenstvo s rovnakým názvom.' : 'Položka z katalógu – systém ju bude automaticky rezervovať a vydávať podľa zákaziek.');
    };
    f.addEventListener('input', prepni); prepni();
  };

  /* =====================================================================
     SKLADOVÁ KARTA
     ===================================================================== */
  F.vKarta = (kluc, q) => {
    const k = F.karta(kluc);
    if (!k) { app().innerHTML = `<div class="v-head"><div><a class="back" href="#/sklad">← sklad</a><h1>Položka neexistuje</h1></div></div><p class="muted">${e(kluc)}</p>`; return; }
    const o = F.kartaParam(kluc), j = o.jednotka, n = F.N();
    const mes = +(q.get('obd') || 6), kr = q.get('kr') || (mes <= 3 ? 't' : 'm');
    const rz = F.rezervacieKarty(kluc), pg = F.prognozaKarty(k, Math.round(mes * 30.4)), buck = F.statistikaKarty(k, mes, kr);
    const hm = F.kartaHmotnost(k, o), cena = +k.cena || 0;
    const pohyby = D().pohyby.filter(p => p.kluc === kluc);
    const vydaje = pohyby.filter(p => p.typ === 'výdaj');
    const odObd = Date.now() - mes * 30.4 * DEN, vydObd = vydaje.filter(p => Date.parse(p.t) >= odObd);
    // spotreba podľa zákazníka za obdobie
    const odb = {}; vydObd.forEach(p => { const z = F.zakazka(zakazkaZDokladu(p.doklad)), m = (z && z.zakaznik.nazov) || p.odberatel || 'neznámy'; odb[m] = (odb[m] || 0) - p.mnozstvo; });
    const odbS = Object.entries(odb).sort((a, b) => b[1] - a[1]), odbMax = odbS.length ? odbS[0][1] : 1;
    const fmt = v => (+v || 0).toLocaleString('sk-SK', { maximumFractionDigits: 2 });
    const kpi = (lab, val, sub = '', cls = '') => `<div class="kpi ${cls}"><span>${lab}</span><b>${val}</b><small>${sub}</small></div>`;
    const qsObd = (m, g) => `#/karta/${encodeURIComponent(kluc)}?obd=${m}${g ? '&kr=' + g : ''}`;
    const zdroje = [...new Set(D().karty.map(x => x.kluc))].sort((a, b) => F.kartaNazov(a).localeCompare(F.kartaNazov(b), 'sk', { numeric: true }));
    const idx = zdroje.indexOf(kluc), pred = zdroje[idx - 1], dalsi = zdroje[idx + 1];

    app().innerHTML = `<div class="v-head"><div><a class="back no-print" href="#/sklad">← sklad</a><h1>${e(F.kartaNazov(kluc))}</h1>
        <p class="muted"><span class="badge">${e(F.DRUHY_SKLADU[o.druh])}</span> <span class="mono small">${e(kluc)}</span>${k.umiestnenie ? ` · umiestnenie <b>${e(k.umiestnenie)}</b>` : ''}</p></div>
      <div class="v-act no-print">${pred ? `<a class="btn ghost sm" href="#/karta/${encodeURIComponent(pred)}" title="${e(F.kartaNazov(pred))}">‹</a>` : ''}${dalsi ? `<a class="btn ghost sm" href="#/karta/${encodeURIComponent(dalsi)}" title="${e(F.kartaNazov(dalsi))}">›</a>` : ''}
        <button class="btn ghost" data-act="vydaj">− Výdaj</button><button class="btn ghost" data-act="inv">Inventúra</button>${k.objednane ? '<button class="btn ghost" data-act="naskladnit">Naskladniť objednané</button>' : ''}<button class="btn" data-act="prijem">+ Príjem</button><button class="btn ghost" onclick="print()">Tlačiť kartu</button><button class="btn ghost" data-act="zrus" title="zrušiť skladovú kartu">Zrušiť kartu</button></div></div>

      <div class="kpis k6">
        ${kpi('Na sklade', fmt(k.stav) + ' <small>' + j + '</small>', cena ? 'hodnota ' + F.eur(k.stav * cena) : '')}
        ${kpi('Rezervované', fmt(pg.rezM), rz.rez.length ? `${rz.rez.length} zákaziek` : 'žiadne zákazky')}
        ${kpi('Voľné', fmt(pg.volne), `minimum ${fmt(k.min)} ${j}`, pg.volne < k.min ? 'warn' : '')}
        ${kpi('Objednané', fmt(k.objednane || 0), k.objednane && k.prichod ? 'príchod ' + F.fmtD(k.prichod) : '–')}
        ${kpi('Spotreba / mesiac', fmt(pg.mesiac.toFixed(1)), `priemer za ${mes} mes.${pg.trend && Math.abs(pg.trend) > .15 ? ` · posledných 30 d ${pg.trend > 0 ? '▲' : '▼'} ${Math.round(Math.abs(pg.trend) * 100)} %` : ''}`)}
        ${kpi('Pod minimum', pg.kedyMin ? (pg.kedyMin <= F.today() ? 'už teraz' : F.fmtD(pg.kedyMin).slice(0, -5)) : '–', pg.kedyMin ? (pg.kedyMin <= F.today() ? 'treba objednať' : `o ${Math.round((Date.parse(pg.kedyMin) - Date.parse(F.today())) / DEN)} dní`) : pg.denna ? 'viac ako rok' : 'bez spotreby', pg.kedyMin && pg.kedyMin <= F.addDays(F.today(), pg.lehota) ? 'warn' : '')}
      </div>

      <div class="grid2 karta-top">
        <section class="card"><h2>Základné parametre a rozmery</h2>
          <table class="t kvt"><tbody>${F.kartaRozmery(o).map(([a, b]) => `<tr><th>${e(a)}</th><td>${e(b)}</td></tr>`).join('')}
            <tr><th>Merná jednotka</th><td>${j}</td></tr>
            <tr><th>Hmotnosť</th><td>${hm ? `netto <b>${fmt(hm.net)} kg</b> · brutto ${fmt(hm.brutto)} kg / ${j}<br><small class="muted">${e(hm.zdroj)}</small>` : '<span class="warnc">nezadaná</span>'}</td></tr>
            <tr><th>Hmotnosť zásoby</th><td>${hm ? F.kg(hm.brutto * k.stav) + ' brutto' : '–'}</td></tr>
          </tbody></table>
          <h3>Údaje karty <small class="muted">(zmena sa uloží hneď)</small></h3>
          <form class="kf kf4" id="kartaF">
            <label>Nákupná cena € / ${j}<input name="cena" inputmode="decimal" value="${k.cena || ''}" placeholder="bez DPH"></label>
            <label>Minimálna zásoba<input name="min" inputmode="decimal" value="${k.min}"></label>
            <label>Objednané<input name="objednane" inputmode="decimal" value="${k.objednane || 0}"></label>
            <label>Príchod<input name="prichod" type="date" value="${k.prichod || ''}"></label>
            ${o.typ === 'KR' ? '' : `<label>Hmotnosť kg / ${j}<input name="hmotnost" inputmode="decimal" value="${k.hmotnost || ''}"></label>`}
            <label>Dodávateľ<input name="dodavatel" value="${e(k.dodavatel || (o.typ === 'KR' ? 'Le Porte M' : ''))}"></label>
            <label>Umiestnenie<input name="umiestnenie" value="${e(k.umiestnenie || '')}" placeholder="regál / pozícia"></label>
            <label>Dodacia lehota (dni)<input name="lehota" inputmode="numeric" value="${k.lehota || ''}" placeholder="${n.dodaciaLehotaDni}"></label>
            <label>Objednávať na (dni)<input name="kryt" inputmode="numeric" value="${k.kryt || ''}" placeholder="30"></label>
            <label class="w">Poznámka<input name="poznamka" value="${e(k.poznamka || '')}"></label>
          </form>
        </section>
        <section class="card nakres"><h2>Nákres</h2>${F.kartaNakres(o)}</section>
      </div>

      <section class="card"><div class="card-h"><h2>Prognóza</h2><span class="muted small">priemer za ${mes} mes. ${pg.efDni < mes * 30 ? `(história len ${Math.round(pg.efDni)} dní)` : ''} · dodacia lehota ${pg.lehota} dní · objednáva sa na ${pg.kryt} dní</span></div>
        <div class="grid-prog">
          <div>${F.svgStavPrognoza(k, buck, pg, j)}</div>
          <div class="prog-box">
            <p>Priemerná spotreba <b>${fmt(pg.tyzden.toFixed(1))} ${j}</b> týždenne, <b>${fmt(pg.mesiac.toFixed(1))} ${j}</b> mesačne.</p>
            ${pg.denna ? `<p>Voľné množstvo klesne pod minimum <b>${pg.kedyMin ? (pg.kedyMin <= F.today() ? 'už teraz' : F.fmtD(pg.kedyMin)) : 'v najbližšom roku nie'}</b>${pg.kedyNula ? `, minie sa <b>${pg.kedyNula <= F.today() ? 'už teraz' : F.fmtD(pg.kedyNula)}</b>` : ''}.</p>` : '<p class="muted">Za obdobie nebola žiadna spotreba – prognóza sa nedá určiť.</p>'}
            ${pg.objednatDo ? `<p>Pri dodacej lehote ${pg.lehota} dní treba objednať najneskôr <b class="${pg.objednatDo <= F.today() ? 'neg' : ''}">${pg.objednatDo <= F.today() ? 'hneď' : F.fmtD(pg.objednatDo)}</b>.</p>` : ''}
            <div class="navrh ${pg.navrh ? 'on' : ''}"><span>Návrh objednávky</span><b>${pg.navrh ? fmt(pg.navrh) + ' ' + j : 'netreba'}</b>
              <small>= minimum ${fmt(k.min)} + spotreba na ${pg.lehota + pg.kryt} dní (${fmt((pg.denna * (pg.lehota + pg.kryt)).toFixed(1))}) − voľné ${fmt(pg.volne)} − objednané ${fmt(k.objednane || 0)}</small>
              ${pg.navrh ? `<button class="btn sm" data-act="objednat" data-m="${pg.navrh}">Zapísať ako objednané</button>` : ''}</div>
            ${rz.dop.length ? `<p class="muted small">V nepotvrdených dopytoch je ďalších ${fmt(F.sum(rz.dop, r => r.mnozstvo))} ${j} (${rz.dop.length} CP) – nie sú v rezerváciách.</p>` : ''}
          </div>
        </div>
      </section>

      <section class="card"><div class="card-h"><h2>Štatistika spotreby</h2>
          <div class="seg no-print">${[3, 6, 12, 24].map(m => `<a class="${m === mes ? 'on' : ''}" href="${qsObd(m, q.get('kr'))}">${m} mes.</a>`).join('')}<span class="sep"></span><a class="${kr === 't' ? 'on' : ''}" href="${qsObd(mes, 't')}">týždne</a><a class="${kr === 'm' ? 'on' : ''}" href="${qsObd(mes, 'm')}">mesiace</a></div></div>
        <div class="grid-stat"><div>${F.svgSpotreba(buck, kr, j)}</div>
          <div><table class="t slim kvt"><tbody>
            <tr><th>Spotreba za obdobie</th><td class="r"><b>${fmt(-F.sum(vydObd, p => p.mnozstvo))}</b> ${j}</td></tr>
            <tr><th>Počet výdajov / zákaziek</th><td class="r">${vydObd.length} / ${new Set(vydObd.map(p => zakazkaZDokladu(p.doklad))).size}</td></tr>
            <tr><th>Max. ${kr === 'm' ? 'mesiac' : 'týždeň'}</th><td class="r">${fmt(Math.max(0, ...buck.map(b => b.vydaj)))} ${j}</td></tr>
            <tr><th>Príjmy za obdobie</th><td class="r">${fmt(F.sum(buck, b => b.prijem))} ${j}</td></tr>
            ${cena ? `<tr><th>Hodnota spotreby</th><td class="r">${F.eur(-F.sum(vydObd, p => p.mnozstvo) * cena)}</td></tr>` : ''}
          </tbody></table>
          <h3>Odberatelia za obdobie</h3>${odbS.length ? `<div class="hbars">${odbS.slice(0, 8).map(([m, v]) => `<div><span>${e(m)}</span><i style="width:${Math.max(3, 100 * v / odbMax)}%"></i><b>${fmt(v)}</b></div>`).join('')}</div>` : '<p class="muted small">Žiadna spotreba.</p>'}</div></div>
      </section>

      <div class="grid2">
        <section class="card"><h2>Rezervácie <small class="muted">${fmt(pg.rezM)} ${j}</small></h2>${rz.rez.length ? `<table class="t slim"><thead><tr><th>Zákazka</th><th>Odberateľ</th><th>Stav</th><th>Dávka</th><th class="r">Množstvo</th></tr></thead><tbody>${rz.rez.map(r => `<tr data-href="#/zakazka/${r.z.id}"><td><a href="#/zakazka/${r.z.id}">${r.z.id}</a></td><td>${e(r.z.zakaznik.nazov)}</td><td>${F.chip(r.z.stav)}</td><td>${r.davka ? `<a href="#/davka/${r.davka.id}">${r.davka.id}</a> <small class="muted">${F.fmtD(r.davka.datum)}</small>` : '<span class="muted">–</span>'}</td><td class="r"><b>${fmt(r.mnozstvo)}</b> ${j}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Žiadna potvrdená zákazka túto položku zatiaľ neblokuje.</p>'}
          ${rz.dop.length ? `<h3>V dopytoch (nepotvrdené)</h3><table class="t slim"><tbody>${rz.dop.map(r => `<tr data-href="#/zakazka/${r.z.id}"><td><a href="#/zakazka/${r.z.id}">${r.z.id}</a></td><td>${e(r.z.zakaznik.nazov)}</td><td class="r muted">${fmt(r.mnozstvo)} ${j}</td></tr>`).join('')}</tbody></table>` : ''}</section>
        <section class="card"><h2>Spotreba na jednotlivé zákazky <small class="muted">posledných 40</small></h2>${vydaje.length ? `<table class="t slim"><thead><tr><th>Dátum</th><th>Zákazka</th><th>Odberateľ</th><th>Dávka</th><th class="r">Množstvo</th></tr></thead><tbody>${vydaje.slice(0, 40).map(p => { const id = zakazkaZDokladu(p.doklad), z = F.zakazka(id), dv = davkaZDokladu(p.doklad); return `<tr ${z ? `data-href="#/zakazka/${z.id}"` : ''}><td>${F.fmtD(p.t)}</td><td>${z ? `<a href="#/zakazka/${z.id}">${z.id}</a>` : e(id || p.doklad || '–')}</td><td>${e((z && z.zakaznik.nazov) || p.odberatel || '')}</td><td class="muted">${e(dv)}</td><td class="r">${fmt(-p.mnozstvo)} ${j}</td></tr>`; }).join('')}</tbody></table>` : '<p class="muted">Z tejto položky sa ešte nevydávalo.</p>'}</section>
      </div>

      <section class="card"><h2>Pohyby na karte <small class="muted">${pohyby.length}</small></h2>${pohyby.length ? `<table class="t slim"><thead><tr><th>Čas</th><th>Typ</th><th>Doklad</th><th class="r">Množstvo</th><th class="r">Stav po pohybe</th></tr></thead><tbody>${(() => { let s = k.stav; return pohyby.slice(0, 60).map(p => { const r = `<tr><td>${F.fmtD(p.t)} <small class="muted">${p.t.slice(11, 16)}</small></td><td>${e(p.typ)}</td><td>${e(p.doklad || '')}</td><td class="r ${p.mnozstvo < 0 ? 'neg' : 'ok'}">${p.mnozstvo > 0 ? '+' : ''}${fmt(p.mnozstvo)}</td><td class="r mono">${fmt(s)}</td></tr>`; s = r2(s - p.mnozstvo); return r; }).join(''); })()}</tbody></table>` : '<p class="muted">Bez pohybov.</p>'}</section>`;

    $('#kartaF').addEventListener('change', ev => {
      const f = ev.target.name, txt = ['prichod', 'dodavatel', 'umiestnenie', 'poznamka'];
      k[f] = txt.includes(f) ? ev.target.value.trim() : (ev.target.value === '' ? (f === 'min' || f === 'objednane' ? 0 : '') : F.num(ev.target.value));
      F.save(); F.ui.toast('Karta uložená', 'ok');
      const y = window.scrollY; F.vKarta(kluc, q); window.scrollTo(0, y);
    });
    app().onclick = ev => {
      const b = ev.target.closest('[data-act]'); if (!b) return;
      const a = b.dataset.act;
      if (a === 'inv') inventura(k);
      if (a === 'naskladnit') naskladnit(k);
      if (a === 'prijem') prijem(kluc, 'príjem');
      if (a === 'vydaj') prijem(kluc, 'výdaj');
      if (a === 'zrus') {
        const pouz = D().zakazky.filter(z => !z.vydane && F.potreba(z)[kluc]);
        if (k.stav) return F.ui.toast('Kartu so stavom ' + k.stav + ' nemožno zrušiť – najprv inventúrou nastavte stav na 0.', 'err');
        if (pouz.length) return F.ui.toast('Položku potrebujú zákazky: ' + pouz.map(z => z.id).join(', '), 'err');
        if (!confirm('Zrušiť skladovú kartu „' + F.kartaNazov(kluc) + '“? História pohybov ostane zachovaná.')) return;
        D().karty = D().karty.filter(x => x.kluc !== kluc); F.save(); F.ui.toast('Karta zrušená', 'ok'); F.ui.go('#/sklad');
      }
      if (a === 'objednat') { const d = prompt('Dátum príchodu (RRRR-MM-DD):', F.addDays(F.today(), pg.lehota)); if (d == null) return; k.objednane = r2((+k.objednane || 0) + +b.dataset.m); k.prichod = d; F.ui.commit('Zapísané ako objednané'); }
    };
  };

  /* =====================================================================
     UKÁŽKOVÉ DÁTA – história výdajov a príjmov za pol roka (pre štatistiku a prognózu)
     ===================================================================== */
  F.ukazkaHistoria = (tyzdne = 26) => {
    const d = D();
    let seed = 20261003; const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
    const vyber = obj => { let r = rnd(), s = 0; for (const [k, w] of Object.entries(obj)) { s += w; if (r <= s) return k; } return Object.keys(obj)[0]; };
    const odb = { 'Interiéry Dvorský s.r.o.': .14, 'Stavby Šariš s.r.o.': .12, 'Dverové centrum Michalovce': .12, Jola: .2, 'JAF HOLZ Vyškov': .1, 'PARKETT MANN, s.r.o.': .1, 'maloobchod (MOC)': .22 };
    const nove = [], mesacne = {};
    let cZ = 0, cV = 0;
    for (let w = tyzdne; w >= 1; w--) {
      const zakaziek = 2 + Math.floor(rnd() * 3);
      for (let i = 0; i < zakaziek; i++) {
        const den = new Date(Date.now() - (w * 7 - Math.floor(rnd() * 5)) * DEN); den.setHours(7 + Math.floor(rnd() * 3), Math.floor(rnd() * 60));
        const polozky = Array.from({ length: 1 + Math.floor(rnd() * 4) }, () => {
          const kol = vyber({ minimal: .6, vertikal: .25, prestige: .15 }), sir = vyber({ '60': .18, '65': .04, '70': .2, '80': .4, '90': .18 });
          return { druh: 'dvere', kolekcia: kol, prevedenie: vyber({ falc: .75, bez: .25 }), farba: vyber({ biela: .7, kasmirova: .3 }), farba_zarubne: vyber({ biela: .7, kasmirova: .3 }), sirka: sir, vyska: vyber({ '197': .5, '2055': .3, '210': .2 }), smer: rnd() < .5 ? 'lave' : 'prave',
            stena: 90 + Math.floor(rnd() * 120), kovanie: +sir <= 70 && rnd() < .5 ? vyber({ 'wc-nikel': .8, 'wc-cierna': .2 }) : vyber({ 'bb-nikel': .55, 'pz-nikel': .2, 'bb-cierna': .15, 'pz-cierna': .1 }), zavesy: rnd() < .8 ? 'nikel' : 'cierna',
            mriezka: rnd() < .15 ? vyber({ biela: .6, hlinik: .3, cierna: .1 }) : 'bez', prah: rnd() < .06, ks: 1 + Math.floor(rnd() * (rnd() < .3 ? 6 : 2)) };
        });
        const pt = F.potreba({ polozky }), idZ = `FP-25${F.pad(++cZ, 4)}-H`, idV = `V-H${F.pad(++cV, 3)}`, t = den.toISOString(), m = t.slice(0, 7);
        const nazov = vyber(odb);
        for (const k in pt) { nove.push({ t, kluc: k, mnozstvo: -pt[k], typ: 'výdaj', doklad: `${idV} / ${idZ}`, odberatel: nazov, historia: true }); mesacne[m] = mesacne[m] || {}; mesacne[m][k] = (mesacne[m][k] || 0) + pt[k]; }
      }
    }
    // príjmy: začiatkom mesiaca dovoz zhruba toho, čo sa v mesiaci minulo
    Object.keys(mesacne).forEach(m => {
      const t = new Date(m + '-03T09:00:00').toISOString(); if (Date.parse(t) > Date.now()) return;
      for (const k in mesacne[m]) { const mn = F.kartaJednotka(k) === 'm' ? Math.ceil(mesacne[m][k] / 10) * 10 : Math.ceil(mesacne[m][k] * (0.9 + rnd() * .3)); nove.push({ t, kluc: k, mnozstvo: mn, typ: 'príjem', doklad: 'DL ' + m.replace('-', '') + (k.startsWith('KR|') ? ' Le Porte M' : ''), historia: true }); }
    });
    nove.forEach(p => F.zaistiKartu(p.kluc));
    d.pohyby = [...d.pohyby, ...nove].sort((a, b) => b.t.localeCompare(a.t));
  };
  const povodnaUkazka = F.ukazka;
  F.ukazka = () => { povodnaUkazka(); F.ukazkaHistoria(); F.save(); };
})();
