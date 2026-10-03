/* =====================================================================
   Fortissima – riadenie výroby: dáta, technické pravidlá, generátory kódov
   Všetko beží v prehliadači; dáta sa ukladajú do localStorage tohto prehliadača.
   ===================================================================== */
'use strict';

const F = window.F = {};

/* ---------- pomocné ---------- */
F.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
F.pad = (n, l) => String(Math.round(n)).padStart(l, '0').slice(-l);
F.today = () => new Date().toISOString().slice(0, 10);
F.addDays = (iso, d) => { const t = new Date(iso + 'T12:00:00'); t.setDate(t.getDate() + d); return t.toISOString().slice(0, 10); };
F.addWorkDays = (iso, d) => {
  const t = new Date(iso + 'T12:00:00');
  while (d > 0) { t.setDate(t.getDate() + 1); if (t.getDay() !== 0 && t.getDay() !== 6) d--; }
  return t.toISOString().slice(0, 10);
};
F.nextWorkDay = iso => { const t = new Date(iso + 'T12:00:00'); while (t.getDay() === 0 || t.getDay() === 6) t.setDate(t.getDate() + 1); return t.toISOString().slice(0, 10); };
F.fmtD = iso => { if (!iso) return '–'; const [y, m, d] = iso.slice(0, 10).split('-'); return `${+d}. ${+m}. ${y}`; };
F.dayName = iso => ['ne', 'po', 'ut', 'st', 'št', 'pi', 'so'][new Date(iso + 'T12:00:00').getDay()];
F.eur = v => v == null || isNaN(v) ? '–' : new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR' }).format(v);
F.num = v => parseFloat(String(v == null ? '' : v).replace(/\s|€/g, '').replace(',', '.')) || 0;
F.uid = () => Math.random().toString(36).slice(2, 9);
F.sum = (a, f) => a.reduce((s, x) => s + (f ? f(x) : x), 0);
F.groupBy = (a, f) => a.reduce((m, x) => { const k = f(x); (m[k] = m[k] || []).push(x); return m; }, {});

/* ---------- číselníky (zhodné s kalkulačkou na webe) ---------- */
F.KOLEKCIE = {
  minimal:  { nazov: 'Minimal',  model: 'AK-1', ramove: false },
  vertikal: { nazov: 'Vertikal', model: 'XK-1', ramove: true },
  prestige: { nazov: 'Prestige', model: 'QK-1', ramove: true },
};
F.FARBY = { biela: { nazov: 'biela', kod: 'BIE', hex: '#F2F0EA' }, kasmirova: { nazov: 'kašmírová', kod: 'KAS', hex: '#B9AE9C' } };
F.PREVEDENIA = { falc: 'falcové', bez: 'bezfalcové' };
F.SIRKY = ['60', '65', '70', '80', '90'];
F.VYSKY = { '197': { mm: 1970, txt: '197', norma: 'STN', pismeno: 'S' }, '2055': { mm: 2055, txt: '205,5', norma: 'HU', pismeno: 'H' }, '210': { mm: 2100, txt: '210', norma: 'DIN', pismeno: 'D' } };
F.SMER = { lave: 'ľavé', prave: 'pravé', slepa: 'slepá' };
F.KOVANIE = {
  'bez': 'Bez spodného otvoru', 'bb-nikel': 'NIKEL zámok na kľúč (BB)', 'bb-cierna': 'ČIERNY zámok na kľúč (BB)',
  'pz-nikel': 'NIKEL zámok na vložku (PZ)', 'pz-cierna': 'ČIERNY zámok na vložku (PZ)', 'wc-nikel': 'NIKEL WC zámok', 'wc-cierna': 'ČIERNY WC zámok',
};
F.ZAVESY = { nikel: 'nikel', cierna: 'čierne' };
F.textZavesov = p => (p.prevedenie === 'bez' && !F.jeSlepa(p) ? 'skryté závesy ' : 'závesy ') + (F.ZAVESY[p.zavesy || 'nikel'] || p.zavesy);
F.MRIEZKY = { bez: 'bez mriežky', biela: 'mriežka biela', hlinik: 'mriežka hliníková', cierna: 'mriežka čierna' };
F.ZARUBNE = ['F80', 'F100', 'F130', 'F160'];

/* Stavy zákazky – os priebehu. Financie sú samostatná os. */
F.STAVY = [
  { k: 'dopyt',     n: 'Dopyt / CP',          c: '#8B8172' },
  { k: 'potvrdena', n: 'Potvrdená',           c: '#B08D57' },
  { k: 'zamerana',  n: 'Zameraná',            c: '#9C7A45' },
  { k: 'v_davke',   n: 'Zaradená do dávky',   c: '#8B5A2B' },
  { k: 'vyroba',    n: 'Vo výrobe',           c: '#6E2620' },
  { k: 'hotova',    n: 'Skompletizovaná',     c: '#3F6B4F' },
  { k: 'expedovana',n: 'Expedovaná',          c: '#2F5A6B' },
  { k: 'montaz',    n: 'Namontovaná',         c: '#2B4A5E' },
  { k: 'uzavreta',  n: 'Uzavretá',            c: '#1F1B16' },
];
F.stavIdx = k => F.STAVY.findIndex(s => s.k === k);
F.stav = k => F.STAVY.find(s => s.k === k) || F.STAVY[0];

/* ---------- nastavenia: všetky technické konštanty sú tu a dajú sa meniť v aplikácii ---------- */
F.DEFAULT_NASTAVENIA = {
  firma: { nazov: 'ATVYN, s.r.o. – Fortissima', adresa: 'Rastislavova 104, 040 01 Košice', ico: '36193071', dic: '2020059294', icdph: 'SK2020059294' },
  kapacitaKridiel: 60,          // krídel na jednu výrobnú dávku (≈ 1 pracovný deň)
  vyrobaDni: 2,                 // pracovné dni od dávky po expedíciu
  dodaciaLehotaDni: 14,         // ak materiál nie je ani na ceste
  dphSadzba: 23,
  dopravaB2B: 5,                // € bez DPH za krídlo a za zárubňu
  // krídlo
  falcPridavokSirka: 50, falcPridavokVyska: 15,     // falcové krídlo = otvor + 50 / + 15
  bezPridavokSirka: 22, bezPridavokVyska: 1,        // bezfalcové krídlo
  polotovarVyska: { '197': '2055', '2055': '2055', '210': '210' }, // STN sa reže z HU
  hrubkaKridla: 40,
  pocetZavesov: 3,          // závesov na 1 krídlo (falcové: horný diel do krídla, spodný do zárubne)
  sirkaKoduRamove: 290,          // rámové krídla nesú v kóde pevnú hodnotu namiesto šírky
  // zárubňa
  svetlostPridavok: 6,           // Š1 = nominál + 6 (napr. 80 → 806)
  falcPresah: 12,                // šírka vo falci = Š1 + 2 × 12, výška vo falci = V1 + 12
  ostenieHrubka: 25,             // ostenie = Š1 + 2 × 25, výška V1 + 25
  oblozkaSirka: 70,              // obložka 7 cm
  hlbkaKorekcia: 38,             // hĺbka v CNC kóde = šírka ostenia + 38 (ako doteraz)
  ostenieSirka: { F80: 85, F100: 105, F130: 135, F160: 165 },  // ⚠ na overenie
  dlzkaTyce: 2800,               // dĺžka tyče obložky / ostenia na prípravu
  rezPridavok: 5,                // prídavok na rez (mm) pri optimalizácii
  // kódovacie tabuľky CNC (Homag – krídla)
  kodZamok: { 'bez': '5', 'bb-nikel': '1', 'bb-cierna': '6', 'pz-nikel': '2', 'pz-cierna': '2', 'wc-nikel': '3', 'wc-cierna': '7' },
  kodMriezka: { bez: '0', biela: '1', hlinik: '2', cierna: '2' },   // ⚠ hliník/čierna na overenie
  kodVyrez: { minimal: '00', vertikal: '00', prestige: '00' },
  kodKonstrukcia: { minimal: 'F', vertikal: 'R', prestige: 'R' },
};

/* ---------- úložisko ---------- */
const KEY = 'fortissima.vyroba.v1';
let mem = null;
F.load = () => {
  if (mem) return mem;
  let d = null;
  try { d = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { d = null; }
  mem = d || F.prazdne();
  mem.nastavenia = F.merge(JSON.parse(JSON.stringify(F.DEFAULT_NASTAVENIA)), mem.nastavenia || {});
  ['zakazky', 'davky', 'trasy', 'pohyby', 'skeny', 'karty', 'partneri'].forEach(k => { if (!Array.isArray(mem[k])) mem[k] = []; });
  return mem;
};
F.save = () => { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) { console.warn('Úložisko nedostupné', e); } };
F.prazdne = () => ({ verzia: 1, zakazky: [], davky: [], trasy: [], karty: [], pohyby: [], skeny: [], partneri: [], citac: { zakazka: 0, davka: 0, trasa: 0 }, nastavenia: {} });
F.merge = (a, b) => { for (const k in b) { if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object') F.merge(a[k], b[k]); else a[k] = b[k]; } return a; };
F.N = () => F.load().nastavenia;
F.reset = (ponechatPartnerov) => { const pp = ponechatPartnerov && mem ? mem.partneri : []; mem = F.prazdne(); mem.partneri = pp || []; mem.nastavenia = JSON.parse(JSON.stringify(F.DEFAULT_NASTAVENIA)); F.save(); };

F.noveCisloZakazky = () => { const d = F.load(); d.citac.zakazka = (d.citac.zakazka || 0) + 1; return 'FP-' + String(new Date().getFullYear()).slice(2) + '-' + F.pad(d.citac.zakazka, 4); };
F.noveCisloDavky = () => { const d = F.load(); d.citac.davka = (d.citac.davka || 0) + 1; return 'VL-' + F.pad(d.citac.davka, 3); };
F.noveCisloTrasy = () => { const d = F.load(); d.citac.trasa = (d.citac.trasa || 0) + 1; return 'TR-' + F.pad(d.citac.trasa, 3); };
F.zakazka = id => F.load().zakazky.find(z => z.id === id);
F.davka = id => F.load().davky.find(z => z.id === id);
F.trasa = id => F.load().trasy.find(z => z.id === id);

/* ---------- výber zárubne podľa steny (zhodné s webom) ---------- */
F.zarubnaPreStenu = d => {
  const zak = [[80, 80, 100], [100, 100, 130], [130, 130, 160], [160, 160, 190]];
  const ext = d <= 190 ? 0 : 90 * Math.ceil((d - 190) / 90);
  const zv = d - ext;
  for (const [f, mn, mx] of zak) { if (ext > 0 && f === 80) continue; if (zv >= mn && zv <= mx) return { typ: 'F' + f, ext, r180: Math.floor(ext / 180), r90: (ext % 180) / 90, min: mn + ext, max: mx + ext }; }
  return { typ: 'F80', ext: 0, r180: 0, r90: 0, min: 80, max: 100, chyba: true };
};

/* =====================================================================
   POZÍCIA (riadok objednávky) → technické údaje
   pozícia = { poradie, nazov, druh: dvere|zarubna, kolekcia, prevedenie, farba, farba_zarubne,
               sirka, vyska, smer, so_zarubnou, stena, kovanie, zavesy, mriezka, prah, spoj, skratenie, skratenie_zar, ks }
   ===================================================================== */
F.jeSlepa = p => p.druh === 'zarubna';
F.maKridlo = p => !F.jeSlepa(p);
F.maZarubnu = p => F.jeSlepa(p) || p.so_zarubnou !== false;
F.popisPozicie = p => {
  if (F.jeSlepa(p)) return `Slepá zárubňa ${F.zarubnaPreStenu(+p.stena).typ}, ${F.FARBY[p.farba_zarubne]?.nazov || ''}, ${p.sirka}/${F.VYSKY[p.vyska]?.txt}`;
  const k = F.KOLEKCIE[p.kolekcia] || {};
  return `${k.nazov} ${k.model}, ${F.PREVEDENIA[p.prevedenie]}, ${F.FARBY[p.farba]?.nazov}, ${p.sirka}/${F.VYSKY[p.vyska]?.txt} ${p.smer === 'lave' ? 'L' : 'P'}`;
};

/** Rozmery krídla (mm) */
F.kridlo = p => {
  const n = F.N(), N = +p.sirka * 10, V1 = F.VYSKY[p.vyska].mm, sk = +p.skratenie || 0;
  const falc = p.prevedenie === 'falc';
  const w = N + (falc ? n.falcPridavokSirka : n.bezPridavokSirka);
  const h = V1 + (falc ? n.falcPridavokVyska : n.bezPridavokVyska) - sk;
  const polV = n.polotovarVyska[p.vyska] || p.vyska;
  const polH = F.VYSKY[polV].mm + (falc ? n.falcPridavokVyska : n.bezPridavokVyska);
  return { w, h, N, V1, sk, falc, polotovarVyska: polV, polotovarH: polH, prirez: polH - h, ramove: !!F.KOLEKCIE[p.kolekcia]?.ramove };
};

/** CNC kód krídla – formát ako doteraz (21 znakov): T súbor(3) výška(4) šírka(4) hrúbka(2) výrez(2) záves zámok mriežka prah konštrukcia */
F.kodKridla = p => {
  const n = F.N(), k = F.kridlo(p), L = p.smer === 'prave' ? 'P' : 'L';
  const subor = p.prevedenie === 'falc' ? 'xx' + L : 'beZ';
  const sirka = k.ramove ? n.sirkaKoduRamove : k.w;
  const polia = {
    subor, vyska: F.pad(k.h, 4), sirka: F.pad(sirka, 4), hrubka: F.pad(n.hrubkaKridla, 2),
    vyrez: (n.kodVyrez[p.kolekcia] || '00').padStart(2, '0').slice(-2), zaves: '0',
    zamok: n.kodZamok[p.kovanie || 'bez'] ?? '5', mriezka: n.kodMriezka[p.mriezka || 'bez'] ?? '0', prah: p.prah ? '1' : '0',
    konstrukcia: n.kodKonstrukcia[p.kolekcia] || 'F',
  };
  const kod = 'T' + polia.subor + polia.vyska + polia.sirka + polia.hrubka + polia.vyrez + polia.zaves + polia.zamok + polia.mriezka + polia.prah + polia.konstrukcia;
  return { kod, polia };
};
F.POLIA_KRIDLA = [
  ['T', 'krídlo', 1], ['subor', 'súbor / orientácia', 3], ['vyska', 'výška', 4], ['sirka', 'šírka', 4], ['hrubka', 'hrúbka', 2],
  ['vyrez', 'výrez', 2], ['zaves', 'záves', 1], ['zamok', 'zámok', 1], ['mriezka', 'mriežka', 1], ['prah', 'prah', 1], ['konstrukcia', 'konštrukcia', 1],
];

/** Zárubňa: rozmery a tri dielce s CNC kódmi */
F.zarubna = p => {
  const n = F.N(), N = +p.sirka * 10, V1 = F.VYSKY[p.vyska].mm, skz = +p.skratenie_zar || 0;
  const z = F.zarubnaPreStenu(+p.stena || 100);
  const S1 = N + n.svetlostPridavok;
  const tupo = p.spoj === 'tupo', slepa = F.jeSlepa(p), bez = !slepa && p.prevedenie === 'bez';
  const ob = n.oblozkaSirka, ost = n.ostenieSirka[z.typ] || 100;
  const falcW = S1 + 2 * n.falcPresah, falcH = V1 + n.falcPresah - skz;
  const ostW = S1 + 2 * n.ostenieHrubka, ostH = V1 + n.ostenieHrubka - skz;
  const oblW = falcW + 2 * ob, oblH = falcH + ob;
  const hlbka = ost + n.hlbkaKorekcia;
  const L = p.smer === 'prave' ? 'P' : 'L', norm = F.VYSKY[p.vyska].pismeno;
  const off = { z20: '020', z30: F.pad(ob + 30, 3), h20: F.pad(ob + 20, 3) };
  const pref = (strana, cast) => {
    const flag = (tupo ? 'T' : '') + (bez ? 'B' : '');
    if (cast === 'HORNE') return (strana + flag + 'HORNE').padEnd(7, 'x').slice(0, 7);
    return ((strana + flag + cast).padEnd(6, 'x') + norm).slice(0, 7);
  };
  // dĺžky obložky dielca: pokos = vonkajší rozmer, tupo = stojky celé, nadpražie medzi nimi
  const dlzStojky = oblH, dlzHorne = tupo ? falcW : oblW;
  const ostStojky = ostH, ostHorne = tupo ? S1 : ostW;
  const mk = (id, nazov, strana, cast, offset, dlzKod, dlzObl, dlzOst) => {
    const kod = pref(strana, cast) + (tupo ? '020' : offset) + F.pad(ob, 3) + F.pad(dlzKod, 4) + F.pad(hlbka, 3) + F.pad(ob, 3);
    return { id, nazov, kod, dlzKod, dlzObl, dlzOst, strana, cast };
  };
  let dielce;
  if (slepa) dielce = [
    mk('ZL', 'Ľavá stojka (slepá)', 'L', 'SLEPA', off.z20, falcH, dlzStojky, ostStojky),
    mk('ZP', 'Pravá stojka (slepá)', 'P', 'SLEPA', off.z30, falcH, dlzStojky, ostStojky),
    mk('ZH', 'Nadpražie (slepé)', 'D', 'HORNE', off.h20, falcW, dlzHorne, ostHorne),
  ];
  else {
    const zavOff = L === 'L' ? off.z20 : off.z30, proOff = L === 'L' ? off.z30 : off.z20;
    dielce = [
      mk('ZZ', 'Závesová stojka', L, 'ZAV', zavOff, falcH, dlzStojky, ostStojky),
      mk('ZR', 'Protiplechová stojka', L, 'PRO', proOff, falcH, dlzStojky, ostStojky),
      mk('ZH', 'Nadpražie', 'K', 'HORNE', off.h20, falcW, dlzHorne, ostHorne),
    ];
  }
  return { ...z, S1, V1, N, falcW, falcH, ostW, ostH, oblW, oblH, hlbka, ost, ob, tupo, slepa, bez, skz, dielce };
};
F.POLIA_ZARUBNE = [['pref', 'strana + dielec + norma', 7], ['off', 'odsadenie', 3], ['ob1', 'obložka', 3], ['dlz', 'dĺžka', 4], ['hlb', 'hĺbka', 3], ['ob2', 'obložka', 3]];

/* =====================================================================
   KUSY – každý fyzický kus vo výrobe má vlastné ID (čiarový kód na kompletáciu/expedíciu)
   ===================================================================== */
F.kusy = z => {
  const out = [], idz = z.id.replace(/-/g, '');
  (z.polozky || []).forEach(p => {
    const ks = Math.max(1, +p.ks || 1);
    for (let i = 1; i <= ks; i++) {
      const base = `${idz}-${p.poradie}-${i}`;
      if (F.maKridlo(p)) out.push({ id: base + 'K', typ: 'kridlo', z, p, i, nazov: 'Krídlo ' + F.KOLEKCIE[p.kolekcia].model });
      if (F.maZarubnu(p)) {
        const zr = F.zarubna(p);
        zr.dielce.forEach(d => out.push({ id: base + d.id, typ: 'dielec', z, p, i, dielec: d, zar: zr, nazov: d.nazov + ' ' + zr.typ }));
        for (let r = 0; r < zr.r180; r++) out.push({ id: base + 'R180' + (r + 1), typ: 'rozsirenie', z, p, i, nazov: 'Rozšírenie R180' });
        for (let r = 0; r < zr.r90; r++) out.push({ id: base + 'R90' + (r + 1), typ: 'rozsirenie', z, p, i, nazov: 'Rozšírenie R90' });
      }
    }
  });
  (z.prislusenstvo || []).forEach((a, j) => { for (let i = 1; i <= (+a.ks || 1); i++) out.push({ id: `${idz}-A${j + 1}-${i}`, typ: 'prislusenstvo', z, a, i, nazov: a.nazov }); });
  return out;
};
F.najdiKus = id => { for (const z of F.load().zakazky) { const k = F.kusy(z).find(x => x.id === id); if (k) return k; } return null; };
F.pocty = z => {
  let kr = 0, zar = 0;
  (z.polozky || []).forEach(p => { const ks = +p.ks || 1; if (F.maKridlo(p)) kr += ks; if (F.maZarubnu(p)) zar += ks; });
  return { kr, zar };
};

/* =====================================================================
   SKLAD – skladové karty a potreba materiálu
   ===================================================================== */
F.kartaKluc = {
  kridlo: p => { const k = F.kridlo(p); return `KR|${p.kolekcia}|${p.prevedenie}|${p.farba}|${p.sirka}|${k.polotovarVyska}`; },
};
F.kartaNazov = kluc => {
  const c = kluc.split('|');
  switch (c[0]) {
    case 'KR': return `Krídlo ${F.KOLEKCIE[c[1]]?.model} ${F.KOLEKCIE[c[1]]?.nazov} ${c[2] === 'falc' ? 'falc' : 'bezf.'} ${F.FARBY[c[3]]?.nazov} ${c[4]}/${F.VYSKY[c[5]]?.txt}`;
    case 'OB': return `Obložka ${F.N().oblozkaSirka} mm ${F.FARBY[c[1]]?.nazov}`;
    case 'OS': return `Ostenie ${c[1]} (${F.N().ostenieSirka[c[1]]} mm) ${F.FARBY[c[2]]?.nazov}`;
    case 'RZ': return `Rozšírenie ${c[1]} ${F.FARBY[c[2]]?.nazov}`;
    case 'ZM': return `Zámok – ${F.KOVANIE[c[1]] || c[1]}`;
    case 'ZV': return `Sada závesov ${F.ZAVESY[c[1]] || c[1]} (3 ks) – pôvodná karta`;
    case 'ZH': return `Záves ${F.ZAVESY[c[1]] || c[1]} – horný diel (do krídla)`;
    case 'ZD': return `Záves ${F.ZAVESY[c[1]] || c[1]} – spodný diel (do zárubne)`;
    case 'ZS': return `Sada skrytých závesov ${F.ZAVESY[c[1]] || c[1]} – bezfalc`;
    case 'PP': return 'Protiplech';
    case 'MR': return `Vetracia ${F.MRIEZKY[c[1]] || c[1]}`;
    case 'PR': return 'Výsuvný (padací) prah';
    case 'AC': return c[1];
  }
  return kluc;
};
F.kartaSkupina = kluc => ({ KR: 'Krídla – polotovar', OB: 'Profily zárubní', OS: 'Profily zárubní', RZ: 'Rozšírenia', ZM: 'Kovanie', ZV: 'Kovanie', ZH: 'Kovanie', ZD: 'Kovanie', ZS: 'Kovanie', PP: 'Kovanie', MR: 'Kovanie', PR: 'Kovanie', AC: 'Príslušenstvo' }[kluc.split('|')[0]] || 'Ostatné');
F.kartaJednotka = kluc => { const k = (F.load().karty || []).find(x => x.kluc === kluc); return (k && k.jednotka) || ({ OB: 'm', OS: 'm' }[kluc.split('|')[0]] || 'ks'); };

/** Potreba materiálu pre zákazku: { kluc: množstvo } (profily v metroch) */
F.potreba = z => {
  const m = {};
  const add = (k, q) => { m[k] = (m[k] || 0) + q; };
  (z.polozky || []).forEach(p => {
    const ks = +p.ks || 1;
    if (F.maKridlo(p)) {
      add(F.kartaKluc.kridlo(p), ks);
      if (p.kovanie && p.kovanie !== 'bez') add('ZM|' + p.kovanie, ks);
      // falcové krídlo: horné diely závesov idú do krídla
      if (p.prevedenie !== 'bez') add('ZH|' + (p.zavesy || 'nikel'), ks * (F.N().pocetZavesov || 3));
      if (p.mriezka && p.mriezka !== 'bez') add('MR|' + p.mriezka, ks);
      if (p.prah) add('PR|', ks);
    }
    if (F.maZarubnu(p)) {
      const zr = F.zarubna(p), fz = p.farba_zarubne;
      const oblM = zr.dielce.reduce((s, d) => s + d.dlzObl, 0) * 2 / 1000;      // dve obložky na dielec
      const ostM = zr.dielce.reduce((s, d) => s + d.dlzOst, 0) / 1000;
      add('OB|' + fz, +(oblM * ks).toFixed(2));
      add('OS|' + zr.typ + '|' + fz, +(ostM * ks).toFixed(2));
      if (zr.r180) add('RZ|R180|' + fz, zr.r180 * ks);
      if (zr.r90) add('RZ|R90|' + fz, zr.r90 * ks);
      // bezfalcové dvere majú skryté závesy, falcové bežné
      // falcová zárubňa: spodné diely závesov; bezfalcová: sada skrytých závesov
      if (!zr.slepa) { if (p.prevedenie === 'bez') add('ZS|' + (p.zavesy || 'nikel'), ks); else add('ZD|' + (p.zavesy || 'nikel'), ks * (F.N().pocetZavesov || 3)); add('PP|', ks); }
    }
  });
  (z.prislusenstvo || []).forEach(a => add('AC|' + a.nazov, +a.ks || 1));
  return m;
};
F.karta = kluc => F.load().karty.find(k => k.kluc === kluc);
F.zaistiKartu = kluc => {
  let k = F.karta(kluc);
  if (!k) { k = { kluc, stav: 0, min: 0, objednane: 0, prichod: '' }; F.load().karty.push(k); }
  return k;
};
const REZERVUJE = ['potvrdena', 'zamerana', 'v_davke', 'vyroba'];
/** Rezervácie: potreba zákaziek potvrdených a ešte nevydaných zo skladu */
F.rezervacie = (okrem) => {
  const r = {};
  F.load().zakazky.forEach(z => {
    if (z.id === okrem || z.vydane || !REZERVUJE.includes(z.stav)) return;
    const pt = F.potreba(z);
    for (const k in pt) r[k] = (r[k] || 0) + pt[k];
  });
  return r;
};
/** Dostupnosť pre zákazku: čo chýba a kedy najskôr bude materiál */
F.dostupnost = z => {
  const n = F.N(), pt = F.potreba(z), rez = F.rezervacie(z.id), dnes = F.today();
  const riadky = [];
  let datum = dnes;
  for (const k in pt) {
    const karta = F.karta(k) || { stav: 0, objednane: 0, prichod: '' };
    const volne = +(karta.stav - (rez[k] || 0)).toFixed(2);
    const chyba = Math.max(0, +(pt[k] - Math.max(0, volne)).toFixed(2));
    let kedy = dnes;
    if (chyba > 0) kedy = (karta.objednane >= chyba && karta.prichod) ? karta.prichod : F.addDays(dnes, n.dodaciaLehotaDni);
    if (kedy > datum) datum = kedy;
    riadky.push({ kluc: k, potreba: pt[k], volne, chyba, kedy, jednotka: F.kartaJednotka(k) });
  }
  return { riadky, materialOd: datum, ok: riadky.every(r => r.chyba === 0) };
};
/** Najbližší deň s voľnou kapacitou dávky od dátumu */
F.volnaKapacita = (od, krid) => {
  const n = F.N(), d = F.load();
  let den = F.nextWorkDay(od < F.today() ? F.today() : od);
  for (let i = 0; i < 120; i++) {
    const obsadene = F.sum(d.davky.filter(v => v.datum === den), v => F.sum(v.zakazky.map(F.zakazka).filter(Boolean), z => F.pocty(z).kr));
    if (obsadene + krid <= n.kapacitaKridiel) return den;
    den = F.addWorkDays(den, 1);
  }
  return den;
};
F.terminExpedicie = z => {
  const dost = F.dostupnost(z), den = F.volnaKapacita(dost.materialOd, F.pocty(z).kr);
  return { dost, davkaDen: den, expedicia: F.addWorkDays(den, F.N().vyrobaDni) };
};

F.pohyb = (kluc, mnozstvo, typ, doklad) => {
  const k = F.zaistiKartu(kluc);
  k.stav = +(k.stav + mnozstvo).toFixed(2);
  F.load().pohyby.unshift({ t: new Date().toISOString(), kluc, mnozstvo, typ, doklad });
};

/* =====================================================================
   STAVY, DÁVKY, TRASY
   ===================================================================== */
F.nastavStav = (z, stav) => {
  z.stav = stav;
  z.datumy = z.datumy || {};
  if (!z.datumy[stav]) z.datumy[stav] = F.today();
  z.historia = z.historia || [];
  z.historia.unshift({ t: new Date().toISOString(), stav });
};
F.vytvorDavku = (datum, zakazkyIds) => {
  const v = { id: F.noveCisloDavky(), datum, zakazky: [], vytvorena: new Date().toISOString(), vydane: false, hotove: false };
  F.load().davky.push(v);
  zakazkyIds.forEach(id => F.priradDoDavky(F.zakazka(id), v));
  return v;
};
F.priradDoDavky = (z, v) => {
  if (!z || !v) return;
  F.load().davky.forEach(o => { o.zakazky = o.zakazky.filter(x => x !== z.id); });
  v.zakazky.push(z.id); z.davka = v.id;
  if (F.stavIdx(z.stav) < F.stavIdx('v_davke')) F.nastavStav(z, 'v_davke');
};
F.zakazkyDavky = v => v.zakazky.map(F.zakazka).filter(Boolean);
F.kusyDavky = v => F.zakazkyDavky(v).flatMap(F.kusy);
F.vydajDavky = v => {
  if (v.vydane) return;
  F.zakazkyDavky(v).forEach(z => {
    const pt = F.potreba(z);
    for (const k in pt) F.pohyb(k, -pt[k], 'výdaj', v.id + ' / ' + z.id);
    z.vydane = true;
    if (F.stavIdx(z.stav) < F.stavIdx('vyroba')) F.nastavStav(z, 'vyroba');
  });
  v.vydane = new Date().toISOString();
};
/** Stav skenov kusu: { cnc, kompletacia, nakladka } → čas */
F.skenKusu = id => { const s = F.load().skeny.filter(x => x.kus === id); const o = {}; s.forEach(x => { o[x.op] = o[x.op] || x.t; }); return o; };
F.zaznamenajSken = (kusId, op) => {
  const d = F.load();
  if (d.skeny.some(x => x.kus === kusId && x.op === op)) return false;
  d.skeny.unshift({ t: new Date().toISOString(), kus: kusId, op });
  // automatické posuny stavov
  const k = F.najdiKus(kusId);
  if (k && op === 'kompletacia') {
    const vsetky = F.kusy(k.z).every(x => x.id === kusId || F.skenKusu(x.id).kompletacia);
    if (vsetky && F.stavIdx(k.z.stav) < F.stavIdx('hotova')) F.nastavStav(k.z, 'hotova');
  }
  return true;
};

/* =====================================================================
   IMPORT z webu Fortissima (kalkulačka) – rovnaký prehliadač alebo súbor
   ===================================================================== */
F.normPolozky = ponuka => (ponuka.polozky || []).map((p, i) => ({
    poradie: i + 1, nazov: p.nazov || '', druh: p.druh || 'dvere', kolekcia: p.kolekcia || 'minimal', prevedenie: p.prevedenie || 'falc',
    farba: p.farba || 'biela', farba_zarubne: p.farba_zarubne || p.farba || 'biela', sirka: String(p.sirka || '80'), vyska: String(p.vyska || '197'),
    smer: p.druh === 'zarubna' ? 'slepa' : (p.smer || 'lave'), so_zarubnou: p.so_zarubnou !== false, stena: +p.stena || 100,
    kovanie: p.kovanie || 'bez', zavesy: p.zavesy || 'nikel', mriezka: p.mriezka || 'bez', prah: !!p.prah, spoj: p.spoj || 'pokos',
    skratenie: +p.skratenie || 0, skratenie_zar: +p.skratenie_zar || 0, ks: +p.ks || 1,
    cena: p.cena ? { spolu: p.cena.spolu, riadky: p.cena.riadky } : null,
  }));
F.zPonuky = (ponuka, zakaznik) => {
  const pol = F.normPolozky(ponuka);
  const z = {
    id: F.noveCisloZakazky(), ponuka: ponuka.id || '', vytvorena: new Date().toISOString(), stav: 'dopyt', datumy: { dopyt: F.today() }, historia: [],
    zakaznik: Object.assign({ nazov: '', typ: ponuka.hladina && ponuka.hladina.partner ? 'b2b' : 'retail', hladina: ponuka.hladina ? ponuka.hladina.kod : 'moc', adresa: '', telefon: '', email: '', ico: '' }, zakaznik || {}),
    polozky: pol, prislusenstvo: [], montaz: !!ponuka.montaz, zameranie: !!ponuka.montaz, sluzby: ponuka.sluzby || [],
    spolu_bez_dph: ponuka.spolu_bez_dph ?? null, spolu_s_dph: ponuka.spolu_s_dph ?? null,
    financie: { zaloha: 'nie', faktura: '' }, poznamka: '',
  };
  const h = ponuka.hladina;
  if (h && h.partner) {
    const p = F.partnerZPonuky(ponuka);
    if (p && !(zakaznik && zakaznik.partnerId && zakaznik.partnerId !== p.id)) F.priradPartnera(z, p);
    else if (!z.zakaznik.nazov) z.zakaznik.nazov = h.partner;
    z.objednal = { kanal: ponuka.ukazka ? 'web (ukážka)' : 'web', partner: h.partner, login: h.partner_login || '', id: h.partner_id || '', ico: h.partner_ico || '', overeny: !!p, cas: ponuka.exportovana || '' };
  }
  return z;
};
F.ponukaZWebu = () => { try { return JSON.parse(localStorage.getItem('fortissima.ponuka.v1') || 'null'); } catch (e) { return null; } };
/** CSV z kalkulačky (stĺpce ako v exporte webu) → ponuka */
F.ponukaZCsv = text => {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
  const head = lines.shift().split(';');
  const rows = lines.map(l => { const c = []; let cur = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === ';' && !q) { c.push(cur); cur = ''; } else cur += ch; } c.push(cur); return Object.fromEntries(head.map((h, i) => [h, c[i] || ''])); });
  const pozicie = {};
  rows.forEach(r => {
    if (!r.pozicia) return;
    const p = pozicie[r.pozicia] = pozicie[r.pozicia] || { nazov: r.oznacenie_pozicie, ks: +r.mnozstvo || 1 };
    const kol = Object.keys(F.KOLEKCIE).find(k => F.KOLEKCIE[k].model === r.model);
    if (r.typ_polozky === 'KRIDLO') Object.assign(p, {
      kolekcia: kol || 'minimal', prevedenie: /bez/.test(r.otvaranie) ? 'bez' : 'falc', farba: /kaš/.test(r.farba) ? 'kasmirova' : 'biela',
      sirka: r.sirka, vyska: r.vyska === '205,5' ? '2055' : r.vyska, smer: /pra/.test(r.orientacia) ? 'prave' : 'lave',
      kovanie: r.zamok === 'bez otvoru' ? 'bez' : (r.zamok.toLowerCase() + '-' + (r.povrch_kovania === 'čierna' ? 'cierna' : 'nikel')),
      prah: r.vysuvny_prah === 'áno', mriezka: { biela: 'biela', 'hliníková': 'hlinik', 'čierna': 'cierna' }[r.vetracia_mriezka] || 'bez', skratenie: +r.skratenie_mm || 0, so_zarubnou: false,
    });
    if (r.typ_polozky === 'ZARUBNA') Object.assign(p, {
      so_zarubnou: true, farba_zarubne: /kaš/.test(r.farba) ? 'kasmirova' : 'biela', stena: +r.hrubka_steny_mm || 100, spoj: r.rohovy_spoj || 'pokos',
      zavesy: r.zavesy === 'čierna' ? 'cierna' : 'nikel', skratenie_zar: +r.skratenie_mm || 0, sirka: p.sirka || r.sirka, vyska: p.vyska || (r.vyska === '205,5' ? '2055' : r.vyska),
      druh: /slep/.test(r.otvaranie) ? 'zarubna' : 'dvere',
    });
  });
  return { id: rows[0]?.ponuka, polozky: Object.values(pozicie) };
};

/* =====================================================================
   OPTIMALIZÁCIA REZU – first-fit decreasing do tyčí
   ===================================================================== */
F.rezPlan = (kusy, dlzkaTyce, prid) => {
  const sorted = [...kusy].sort((a, b) => b.dlz - a.dlz), tyce = [];
  sorted.forEach(k => {
    const need = k.dlz + prid;
    let t = tyce.find(t => t.zvysok >= need);
    if (!t) { t = { kusy: [], zvysok: dlzkaTyce }; tyce.push(t); }
    t.kusy.push(k); t.zvysok -= need;
  });
  return tyce;
};

/* =====================================================================
   EXPORT pre MRP (fakturácia) – CSV
   ===================================================================== */
F.riadkyFaktury = z => {
  const n = F.N(), r = [];
  (z.polozky || []).forEach(p => {
    if (p.cena && p.cena.riadky && p.cena.riadky.length) p.cena.riadky.forEach(x => r.push({ kod: x.kod, nazov: x.nazov, mn: x.mnozstvo, cena: x.cena_ks_bez ?? (x.cena_ks ? x.cena_ks / (z.zakaznik.typ === 'b2b' ? 1 : 1 + n.dphSadzba / 100) : 0) }));
    else r.push({ kod: F.kodPolozky(p), nazov: F.popisPozicie(p), mn: +p.ks || 1, cena: F.num(p.cenaManual) });
  });
  (z.prislusenstvo || []).forEach(a => r.push({ kod: 'ACC', nazov: a.nazov, mn: +a.ks || 1, cena: F.num(a.cena) }));
  if (z.zakaznik.typ === 'b2b') {
    const c = F.pocty(z);
    if (c.kr) r.push({ kod: 'SL-DOPRAVA-KRIDLO', nazov: 'Doprava – krídlo', mn: c.kr, cena: n.dopravaB2B });
    if (c.zar) r.push({ kod: 'SL-DOPRAVA-ZARUBNA', nazov: 'Doprava – zárubňa', mn: c.zar, cena: n.dopravaB2B });
  } else (z.sluzby || []).forEach(s => r.push({ kod: s.kod, nazov: s.nazov, mn: s.mnozstvo, cena: s.cena_ks_bez ?? (s.cena_ks_s_dph ? s.cena_ks_s_dph / (1 + n.dphSadzba / 100) : 0) }));
  return r;
};
F.kodPolozky = p => F.jeSlepa(p) ? `${F.zarubnaPreStenu(+p.stena).typ}-S-${F.FARBY[p.farba_zarubne].kod}-${p.sirka}-${p.vyska}-S`
  : `${F.KOLEKCIE[p.kolekcia].model.replace('-', '')}-${p.prevedenie === 'falc' ? 'F' : 'B'}-${F.FARBY[p.farba].kod}-${p.sirka}-${p.vyska}-${p.smer === 'prave' ? 'P' : 'L'}`;
F.csvMRP = zakazky => {
  const n = F.N(), q = v => { const t = String(v == null ? '' : v); return /[;"\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
  const d2 = v => (Math.round(v * 100) / 100).toFixed(2).replace('.', ',');
  const cols = ['cislo_zakazky', 'datum_dodania', 'odberatel', 'ico', 'dic', 'ic_dph', 'adresa', 'kod_polozky', 'nazov', 'mnozstvo', 'mj', 'cena_bez_dph', 'sadzba_dph', 'spolu_bez_dph'];
  const rows = [cols.join(';')];
  zakazky.forEach(z => F.riadkyFaktury(z).forEach(r => rows.push([z.id, z.datumy?.expedovana || F.today(), z.zakaznik.nazov, z.zakaznik.ico, z.zakaznik.dic || '', z.zakaznik.icdph || '', z.zakaznik.adresa, r.kod, r.nazov, r.mn, 'ks', d2(r.cena), n.dphSadzba, d2(r.cena * r.mn)].map(q).join(';'))));
  return '﻿' + rows.join('\r\n');
};
F.stiahni = (meno, text, typ) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: typ || 'text/plain;charset=utf-8' })); a.download = meno;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
};

/* =====================================================================
   UKÁŽKOVÉ DÁTA (fiktívne)
   ===================================================================== */
F.ukazka = () => {
  F.reset(true);
  const d = F.load();
  // sklad
  const karty = [];
  ['minimal', 'vertikal', 'prestige'].forEach(kol => ['falc', 'bez'].forEach(pr => ['biela', 'kasmirova'].forEach(fa => F.SIRKY.forEach(s => ['2055', '210'].forEach(v => {
    const base = kol === 'minimal' ? (pr === 'falc' ? 16 : 6) : (pr === 'falc' ? 8 : 3);
    const mn = kol === 'minimal' ? (pr === 'falc' ? 4 : 2) : 1;
    const st = s === '65' ? Math.ceil(base / 4) : base - (v === '210' ? Math.floor(base / 3) : 0) - (fa === 'kasmirova' ? Math.floor(base / 4) : 0);
    karty.push({ kluc: `KR|${kol}|${pr}|${fa}|${s}|${v}`, stav: st, min: s === '65' ? 1 : mn, objednane: 0, prichod: '' });
  })))));
  ['biela', 'kasmirova'].forEach(fa => {
    karty.push({ kluc: 'OB|' + fa, stav: fa === 'biela' ? 420 : 160, min: 120, objednane: fa === 'kasmirova' ? 200 : 0, prichod: fa === 'kasmirova' ? F.addDays(F.today(), 6) : '' });
    F.ZARUBNE.forEach(t => karty.push({ kluc: `OS|${t}|${fa}`, stav: t === 'F160' ? 12 : (fa === 'biela' ? 140 : 60), min: 40, objednane: 0, prichod: '' }));
    karty.push({ kluc: `RZ|R90|${fa}`, stav: 14, min: 6, objednane: 0, prichod: '' }, { kluc: `RZ|R180|${fa}`, stav: 6, min: 4, objednane: 0, prichod: '' });
  });
  Object.keys(F.KOVANIE).filter(k => k !== 'bez').forEach(k => karty.push({ kluc: 'ZM|' + k, stav: /cierna/.test(k) ? 12 : 60, min: 15, objednane: 0, prichod: '' }));
  karty.push({ kluc: 'ZH|nikel', stav: 270, min: 90 }, { kluc: 'ZD|nikel', stav: 240, min: 90 }, { kluc: 'ZH|cierna', stav: 54, min: 30, objednane: 90, prichod: F.addDays(F.today(), 4) }, { kluc: 'ZD|cierna', stav: 60, min: 30, objednane: 90, prichod: F.addDays(F.today(), 4) }, { kluc: 'ZS|nikel', stav: 24, min: 8 }, { kluc: 'ZS|cierna', stav: 10, min: 4 }, { kluc: 'PP|', stav: 110, min: 30 },
    { kluc: 'MR|biela', stav: 20, min: 5 }, { kluc: 'MR|hlinik', stav: 8, min: 5 }, { kluc: 'MR|cierna', stav: 0, min: 4, objednane: 10, prichod: F.addDays(F.today(), 5) }, { kluc: 'PR|', stav: 9, min: 4 });
  karty.forEach(k => { k.objednane = k.objednane || 0; k.prichod = k.prichod || ''; });
  d.karty = karty;

  const zak = [
    { z: { nazov: 'Novák Peter', typ: 'retail', hladina: 'moc', adresa: 'Moldavská 12, 040 11 Košice', telefon: '0905 111 222', email: 'novak@example.sk' }, montaz: true, pol: [
      { nazov: 'Spálňa', kolekcia: 'minimal', prevedenie: 'falc', farba: 'biela', farba_zarubne: 'biela', sirka: '80', vyska: '197', smer: 'lave', stena: 120, kovanie: 'bb-nikel', ks: 1 },
      { nazov: 'Kúpeľňa', kolekcia: 'minimal', prevedenie: 'falc', farba: 'biela', farba_zarubne: 'biela', sirka: '70', vyska: '197', smer: 'prave', stena: 120, kovanie: 'wc-nikel', mriezka: 'biela', ks: 1 },
      { nazov: 'Detská', kolekcia: 'minimal', prevedenie: 'falc', farba: 'biela', farba_zarubne: 'biela', sirka: '80', vyska: '197', smer: 'prave', stena: 120, kovanie: 'bb-nikel', ks: 2 },
    ], stav: 'v_davke' },
    { z: { nazov: 'Interiéry Dvorský s.r.o.', typ: 'b2b', hladina: 'voc-10', adresa: 'Hlavná 22, 080 01 Prešov', telefon: '0911 333 444', ico: '50123456' }, pol: [
      { nazov: 'Byt 3A', kolekcia: 'vertikal', prevedenie: 'falc', farba: 'kasmirova', farba_zarubne: 'kasmirova', sirka: '80', vyska: '2055', smer: 'lave', stena: 150, kovanie: 'bb-cierna', zavesy: 'cierna', ks: 4, spoj: 'tupo' },
      { nazov: 'Byt 3A – WC', kolekcia: 'vertikal', prevedenie: 'falc', farba: 'kasmirova', farba_zarubne: 'kasmirova', sirka: '60', vyska: '2055', smer: 'prave', stena: 110, kovanie: 'wc-cierna', zavesy: 'cierna', mriezka: 'cierna', ks: 2, spoj: 'tupo' },
      { nazov: 'Chodba', druh: 'zarubna', farba_zarubne: 'kasmirova', sirka: '90', vyska: '2055', stena: 280, ks: 1 },
    ], stav: 'v_davke' },
    { z: { nazov: 'Kováčová Jana', typ: 'retail', hladina: 'moc', adresa: 'Jantárová 5, 040 01 Košice', telefon: '0907 555 666' }, montaz: true, pol: [
      { nazov: 'Obývačka', kolekcia: 'prestige', prevedenie: 'bez', farba: 'biela', farba_zarubne: 'biela', sirka: '90', vyska: '210', smer: 'prave', stena: 160, kovanie: 'pz-nikel', prah: true, ks: 1 },
      { nazov: 'Pracovňa', kolekcia: 'prestige', prevedenie: 'bez', farba: 'biela', farba_zarubne: 'biela', sirka: '80', vyska: '210', smer: 'lave', stena: 140, kovanie: 'bb-nikel', ks: 1, skratenie: 20, skratenie_zar: 20 },
    ], stav: 'potvrdena' },
    { z: { nazov: 'Stavby Šariš s.r.o.', typ: 'b2b', hladina: 'voc', adresa: 'Priemyselná 8, 085 01 Bardejov', telefon: '0915 777 888', ico: '47888999' }, pol: [
      { nazov: 'Bytovka – izby', kolekcia: 'minimal', prevedenie: 'falc', farba: 'biela', farba_zarubne: 'biela', sirka: '80', vyska: '197', smer: 'lave', stena: 100, kovanie: 'bb-nikel', ks: 6 },
      { nazov: 'Bytovka – izby P', kolekcia: 'minimal', prevedenie: 'falc', farba: 'biela', farba_zarubne: 'biela', sirka: '80', vyska: '197', smer: 'prave', stena: 100, kovanie: 'bb-nikel', ks: 6 },
      { nazov: 'Bytovka – kúpeľne', kolekcia: 'minimal', prevedenie: 'falc', farba: 'biela', farba_zarubne: 'biela', sirka: '70', vyska: '197', smer: 'lave', stena: 100, kovanie: 'wc-nikel', mriezka: 'biela', ks: 6 },
    ], stav: 'potvrdena' },
    { z: { nazov: 'Horváth Martin', typ: 'retail', hladina: 'moc', adresa: 'Lesná 40, 044 15 Nižná Myšľa', telefon: '0918 999 000' }, montaz: true, pol: [
      { nazov: 'Spálňa', kolekcia: 'vertikal', prevedenie: 'bez', farba: 'kasmirova', farba_zarubne: 'kasmirova', sirka: '80', vyska: '197', smer: 'lave', stena: 125, kovanie: 'bb-cierna', zavesy: 'cierna', ks: 1 },
    ], stav: 'dopyt' },
    { z: { nazov: 'Dverové centrum Michalovce', typ: 'b2b', hladina: 'voc+5', adresa: 'Sama Chalupku 3, 071 01 Michalovce', telefon: '0944 123 321', ico: '36555111' }, pol: [
      { nazov: 'Sklad – Minimal', kolekcia: 'minimal', prevedenie: 'falc', farba: 'kasmirova', farba_zarubne: 'kasmirova', sirka: '90', vyska: '2055', smer: 'lave', stena: 130, kovanie: 'bb-nikel', ks: 3 },
    ], stav: 'hotova' },
  ];
  zak.forEach((x, i) => {
    const z = F.zPonuky({ id: 'FP-2610' + (10 + i) + '-DEMO', polozky: x.pol, montaz: !!x.montaz }, x.z);
    z.datumy = { dopyt: F.addDays(F.today(), -12 + i) };
    d.zakazky.push(z);
    const idx = F.stavIdx(x.stav);
    for (let s = 1; s <= idx; s++) { if (F.STAVY[s].k === 'zamerana' && !x.montaz) continue; if (F.STAVY[s].k === 'v_davke') continue; F.nastavStav(z, F.STAVY[s].k); }
  });
  // dávka na najbližší pracovný deň s dvoma zákazkami
  const den = F.nextWorkDay(F.addDays(F.today(), 1));
  F.vytvorDavku(den, [d.zakazky[0].id, d.zakazky[1].id]);
  // hotové zákazky na expedíciu: Maďarsko (pobočky Jola) a Slovensko + Česko (JAF HOLZ Vyškov)
  const M = (n, s, k, kr) => ({ nazov: n, kolekcia: k || 'minimal', prevedenie: 'falc', farba: 'biela', farba_zarubne: 'biela', sirka: s, vyska: '2055', smer: kr || 'lave', stena: 120, kovanie: 'bb-nikel', ks: 2 });
  const exp = [
    { z: { nazov: 'Jola', typ: 'b2b', hladina: 'voc-10', krajina: 'HU' }, dod: { nazov: 'Jola -C- Sopron', ulica: 'Ipar krt. 2', psc: '9400', mesto: 'Sopron', krajina: 'HU' }, pol: [M('Főző', '80'), M('Főző WC', '60', 'minimal', 'prave')] },
    { z: { nazov: 'Jola', typ: 'b2b', hladina: 'voc-10', krajina: 'HU' }, dod: { nazov: 'Jola -C- Győr', ulica: 'Fehérvári út 75', psc: '9028', mesto: 'Győr', krajina: 'HU' }, pol: [M('Szollár', '90', 'vertikal')] },
    { z: { nazov: 'Jola', typ: 'b2b', hladina: 'voc-10', krajina: 'HU' }, dod: { nazov: 'Jola -D- Újpest', ulica: 'Váci út 64', psc: '1044', mesto: 'Újpest', krajina: 'HU' }, pol: [M('Mayer', '80'), M('Mayer 2', '70')] },
    { z: { nazov: 'Jola', typ: 'b2b', hladina: 'voc-10', krajina: 'HU' }, dod: { nazov: 'Jola -D- Újpest', ulica: 'Váci út 64', psc: '1044', mesto: 'Újpest', krajina: 'HU' }, pol: [M('Minta', '90', 'prestige')] },
    { z: { nazov: 'JAF HOLZ Vyškov', typ: 'b2b', hladina: 'voc', krajina: 'CZ' }, dod: { nazov: 'JAFHOLZ Vyškov', ulica: 'Hybešova 50', psc: '682 01', mesto: 'Vyškov', krajina: 'CZ' }, pol: [M('Sklad', '80'), M('Sklad P', '80', 'minimal', 'prave')] },
    { z: { nazov: 'PARKETT MANN, s.r.o.', typ: 'b2b', hladina: 'voc-10', ico: '35853816', adresa: 'Mikovíniho 11, 917 01 Trnava' }, dod: { nazov: 'PARKETT MANN, s.r.o.', ulica: 'Mikovíniho 11', psc: '917 01', mesto: 'Trnava', krajina: 'SK' }, pol: [M('Byt 12', '80', 'vertikal')] },
  ];
  const hotove = [d.zakazky[5]];
  d.zakazky[5].dodanie = { nazov: 'Dverové centrum Michalovce', ulica: 'Sama Chalupku 3', psc: '071 01', mesto: 'Michalovce', krajina: 'SK' };
  exp.forEach((x, i) => {
    const z = F.zPonuky({ id: 'FP-2610' + (30 + i) + '-DEMO', polozky: x.pol }, x.z);
    z.dodanie = x.dod; z.datumy = { dopyt: F.addDays(F.today(), -20 + i) };
    ['potvrdena', 'vyroba', 'hotova'].forEach(s => F.nastavStav(z, s));
    d.zakazky.push(z); hotove.push(z);
  });
  const v2 = F.vytvorDavku(F.nextWorkDay(F.addDays(F.today(), -3)), hotove.map(z => z.id));
  F.vydajDavky(v2); v2.hotove = true;
  hotove.forEach(z => { if (z.stav !== 'hotova') F.nastavStav(z, 'hotova'); F.kusy(z).forEach(k => d.skeny.push({ t: new Date().toISOString(), kus: k.id, op: 'cnc' }, { t: new Date().toISOString(), kus: k.id, op: 'kompletacia' })); });
  if (F.navrhniRozvoz) F.navrhniRozvoz(F.nextWorkDay(F.addDays(F.today(), 2)));
  F.save();
};

/* =====================================================================
   PARTNERI (B2B odberatelia) – databáza sa importuje zo súboru, nie je súčasťou webu
   ===================================================================== */
F.HLADINY = { moc: 'MOC', voc: 'VOC', 'voc-10': 'VOC −10 %', 'voc+5': 'VOC +5 %' };
F.partner = id => F.load().partneri.find(p => p.id === id);
F.adresaPartnera = p => [p.ulica, [p.psc, p.mesto].filter(Boolean).join(' ')].filter(Boolean).join(', ');
F.partnerNorm = s => String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
F.najdiPartnera = text => {
  const n = F.partnerNorm(text); if (!n) return null;
  const P = F.load().partneri;
  return P.find(p => p.id === text) || P.find(p => F.partnerNorm(p.nazov) === n) || P.find(p => (p.aliasy || []).some(a => F.partnerNorm(a) === n)) || P.find(p => p.ico && p.ico === String(text).trim()) || null;
};
/** Vyplní údaje zákazníka zákazky z partnera */
F.priradPartnera = (z, p) => {
  Object.assign(z.zakaznik, { partnerId: p.id, nazov: p.nazov, typ: 'b2b', hladina: p.hladina || 'voc', ico: p.ico || '', dic: p.dic || '', icdph: p.icdph || '',
    adresa: F.adresaPartnera(p), telefon: p.telefon || z.zakaznik.telefon || '', email: p.email || z.zakaznik.email || '' });
};
/** Import: zlúči podľa id, IČO alebo názvu; vráti počty */
F.importPartnerov = zoznam => {
  const P = F.load().partneri; let nove = 0, upd = 0;
  zoznam.forEach(x => {
    if (!x || !x.nazov) return;
    const ex = (x.id && P.find(p => p.id === x.id)) || (x.ico && P.find(p => p.ico === x.ico)) || (!x.id && P.find(p => F.partnerNorm(p.nazov) === F.partnerNorm(x.nazov)));
    if (ex) {
      if (Array.isArray(x.pobocky) && ex.pobocky) x = Object.assign({}, x, { pobocky: x.pobocky.map(b => { const o = ex.pobocky.find(y => F.partnerNorm(y.nazov) === F.partnerNorm(b.nazov)); return o ? Object.assign({}, o, b, { id: o.id, typ: b.typ || o.typ }) : b; }) });
      Object.assign(ex, x, { id: ex.id }); upd++;
    }
    else { P.push(Object.assign({ id: 'P' + String(P.length + 1).padStart(3, '0'), hladina: 'voc', krajina: 'SK', aliasy: [], stat: {} }, x)); nove++; }
  });
  return { nove, upd };
};
F.partneriZCsv = text => {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean), sep = lines[0].includes(';') ? ';' : ',';
  const head = lines.shift().split(sep).map(h => F.partnerNorm(h));
  const map = { nazov: ['nazov', 'firma', 'odberatel', 'meno'], ico: ['ico'], dic: ['dic'], icdph: ['icdph'], ulica: ['ulica', 'adresa'], psc: ['psc'], mesto: ['mesto', 'obec'], telefon: ['telefon', 'tel'], email: ['email', 'mail'], hladina: ['hladina'] };
  return lines.map(l => { const c = l.split(sep), o = {}; for (const k in map) { const i = head.findIndex(h => map[k].includes(h)); if (i >= 0) o[k] = (c[i] || '').replace(/^"|"$/g, '').trim(); } return o; });
};

/** Partner, ktorý bol prihlásený na webe pri tvorbe ponuky: podľa ID, IČO, loginu, potom názvu */
F.partnerZPonuky = pon => {
  const h = pon && pon.hladina; if (!h || !h.partner) return null;
  const P = F.load().partneri;
  return (h.partner_id && F.partner(h.partner_id)) || (h.partner_ico && P.find(p => p.ico === String(h.partner_ico))) ||
    (h.partner_login && P.find(p => p.web && p.web.login && p.web.login.toLowerCase() === String(h.partner_login).toLowerCase())) || F.najdiPartnera(h.partner);
};
F.loginZNazvu = n => F.partnerNorm(String(n || '').replace(/,?\s*(s\.?\s?r\.?\s?o\.?|spol\..*|a\.\s?s\.|kft\.?)$/i, '')).slice(0, 20) || 'partner';
/** partneri.csv pre server webu (prihlasovanie do kalkulačky) – len partneri s nastaveným prístupom */
F.webPristupyCsv = () => {
  const q = v => { const t = String(v == null ? '' : v); return /[;"\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
  const rows = ['login;heslo;hladina;nazov;aktivny;id;ico'];
  F.load().partneri.filter(p => p.web && p.web.login && p.web.hash).forEach(p => rows.push([p.web.login, p.web.hash, p.hladina || 'voc', p.nazov, p.web.aktivny === false ? 0 : 1, p.id, p.ico || ''].map(q).join(';')));
  return '\uFEFF' + rows.join('\r\n') + '\r\n';
};
F.noveHeslo = () => { const a = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789', r = new Uint32Array(12); crypto.getRandomValues(r); return Array.from(r, x => a[x % a.length]).join(''); };
F.hashHesla = heslo => dcodeIO.bcrypt.hashSync(heslo, 10).replace(/^\$2[ab]\$/, '$2y$');
