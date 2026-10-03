/* =====================================================================
   EXPEDÍCIA – prehľad trás (filtre, hľadanie, zoradenie) a štatistiky rozvozu
   Pri expedovaní sa na trasu uloží súhrn (snapshot), aby štatistika ostala
   správna aj keď sa zákazky neskôr zmenia alebo zmažú.
   ===================================================================== */
'use strict';
(function () {
  const e = F.esc, $ = s => document.querySelector(s), app = () => $('#view'), D = () => F.load();
  const DEN = 864e5;
  const fmt = (v, d = 0) => (+v || 0).toLocaleString('sk-SK', { maximumFractionDigits: d });

  /** Súhrn trasy – pri expedovanej z uloženého snapshotu, inak živý výpočet */
  F.suhrnTrasy = t => {
    if (t.suhrn) return t.suhrn;
    const st = F.zastavkyTrasy(t), dl = F.dlzkaTrasy(t), v = F.vozidlo(t.vozidloId);
    const zast = st.map(s => ({ nazov: s.dodanie.nazov || '', mesto: s.dodanie.mesto || '', krajina: s.dodanie.krajina || 'SK',
      zakazky: s.zakazky.map(z => { const p = z.zakaznik.partnerId && F.partner(z.zakaznik.partnerId), g = p && F.skupinaPartnera && F.skupinaPartnera(p), c = F.pocty(z), h = F.hmotnostZakazky ? F.hmotnostZakazky(z) : { brutto: 0 };
        return { id: z.id, partner: z.zakaznik.nazov, partnerId: p ? p.id : '', skupina: g ? g.nazov : (p ? p.nazov : z.zakaznik.nazov), pobocka: (F.textPobockyZakazky && F.textPobockyZakazky(z)) || '', kr: c.kr, zar: c.zar, kg: h.brutto || 0 }; }) }));
    const zak = zast.flatMap(s => s.zakazky);
    return { km: dl.km, nezname: dl.nezname, zastavok: zast.length, zakaziek: zak.length, kr: F.sum(zak, z => z.kr), zar: F.sum(zak, z => z.zar), kg: Math.round(F.sum(zak, z => z.kg)),
      kapacita: v ? v.kapacita || 0 : 0, nosnost: v ? v.nosnost || 0 : 0, vozidlo: v ? v.nazov : (t.vozidlo || ''), krajiny: [...new Set(zast.map(s => s.krajina))], zastavky: zast };
  };
  F.zamrazSuhrnTrasy = t => { delete t.suhrn; t.suhrn = F.suhrnTrasy(t); t.expedovana = new Date().toISOString(); };
  const vytazenie = s => s.kapacita ? Math.round(100 * s.kr / s.kapacita) : null;

  const tabs = tab => `<nav class="tabs no-print"><a href="#/expedicia" class="${tab === 'plan' ? 'on' : ''}">Plánovanie</a><a href="#/expedicia?tab=trasy" class="${tab === 'trasy' ? 'on' : ''}">Prehľad trás (${D().trasy.length})</a><a href="#/expedicia?tab=stat" class="${tab === 'stat' ? 'on' : ''}">Štatistiky</a></nav>`;
  F.expTabs = tabs;

  /* ---------- obdobie ---------- */
  const OBD = { '7': 'posledných 7 dní', '30': 'posledných 30 dní', '90': 'posledné 3 mesiace', '365': 'posledných 12 mesiacov', 'mes': 'tento mesiac', 'rok': 'tento rok', 'bud': 'budúce (plánované)', '': 'všetko' };
  const rozsah = (k, od, do_) => {
    const dnes = F.today();
    if (od || do_) return [od || '0000', do_ || '9999'];
    if (k === 'mes') return [dnes.slice(0, 8) + '01', dnes];
    if (k === 'rok') return [dnes.slice(0, 5) + '01-01', dnes];
    if (k === 'bud') return [F.addDays(dnes, 1), '9999'];
    if (+k) return [F.addDays(dnes, -(+k)), dnes];
    return ['0000', '9999'];
  };

  /* =====================================================================
     PREHĽAD TRÁS
     ===================================================================== */
  const FILTRE = ['q', 'stav', 'voz', 'kraj', 'vodic', 'obd', 'od', 'do', 'sort', 'dir'];
  F.vTrasyPrehlad = q => {
    const d = D(), rows = d.trasy.map(t => ({ t, s: F.suhrnTrasy(t) }));
    const vodici = [...new Set(d.trasy.map(t => t.vodic).filter(Boolean))].sort();
    const th = (key, txt, cls = '') => `<th class="${cls} sortable" data-sort="${key}">${txt}<i></i></th>`;
    app().innerHTML = `<div class="v-head"><div><h1>Expedícia</h1><p class="muted">prehľad všetkých trás · kliknite na riadok pre detail trasy</p></div>
      <div class="v-act"><button class="btn ghost" data-act="csv">Export CSV</button></div></div>${tabs('trasy')}
      <section class="card filt no-print">
        <div class="f-druh">${[['', 'Všetky'], ['planovana', 'Plánované'], ['expedovana', 'Expedované']].map(([k, n]) => `<button class="pill" data-stav="${k}">${n} <small>${k ? rows.filter(r => (r.t.stav === 'expedovana') === (k === 'expedovana')).length : rows.length}</small></button>`).join('')}</div>
        <div class="f-row">
          <label class="f-q">Hľadať<input id="fq" type="search" placeholder="trasa, mesto, zákazka, partner, vodič…"></label>
          <label>Obdobie<select id="fobd">${Object.entries(OBD).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
          <label>Od<input type="date" id="fod"></label><label>Do<input type="date" id="fdo"></label>
          <label>Auto<select id="fvoz"><option value="">všetky</option>${F.vozidla().map(v => `<option value="${v.id}">${e(v.nazov)}</option>`).join('')}</select></label>
          <label>Krajina<select id="fkraj"><option value="">všetky</option>${Object.entries(F.KRAJINY).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
          <label>Vodič<select id="fvodic"><option value="">všetci</option>${vodici.map(v => `<option>${e(v)}</option>`).join('')}</select></label>
          <label>Zoradiť<select id="fsort"><option value="datum">dátum</option><option value="km">km</option><option value="kr">krídla</option><option value="kg">hmotnosť</option><option value="zast">zastávky</option><option value="vyt">vyťaženie</option></select></label>
          <button class="btn ghost sm" id="fdir">↓</button>
        </div>
        <div class="f-row f-chk"><span class="grow"></span><span class="muted small" id="fcount"></span><button class="lnk" id="freset">zrušiť filtre</button></div>
      </section>
      <section class="card sum-bar" id="sumBar"></section>
      <section class="card tbl"><table class="t trt"><thead><tr>${th('datum', 'Dátum')}<th>Trasa</th><th>Auto / vodič</th><th>Zastávky</th>${th('zast', 'Zast.', 'r')}${th('kr', 'Krídla / zár.', 'r')}${th('kg', 'Brutto', 'r')}${th('km', 'km', 'r')}${th('vyt', 'Vyťaženie', 'r')}<th>Stav</th></tr></thead><tbody>
      ${rows.map(({ t, s }) => { const vy = vytazenie(s), voz = F.vozidlo(t.vozidloId); return `<tr data-href="#/expedicia?trasa=${t.id}" data-stav="${t.stav === 'expedovana' ? 'expedovana' : 'planovana'}" data-voz="${t.vozidloId || ''}" data-kraj="${s.krajiny.join('|')}" data-vodic="${e(t.vodic || '')}"
          data-datum="${t.datum}" data-km="${s.km}" data-kr="${s.kr}" data-kg="${s.kg}" data-zast="${s.zastavok}" data-vyt="${vy == null ? -1 : vy}" data-kg2="${s.kg}" data-zak="${s.zakaziek}"
          data-txt="${e(F.partnerNorm([t.id, t.vodic, t.vozidlo, ...s.zastavky.flatMap(z => [z.nazov, z.mesto, ...z.zakazky.flatMap(x => [x.id, x.partner, x.skupina, x.pobocka])])].join(' ')))}">
        <td class="nowrap">${F.dayName(t.datum)} ${F.fmtD(t.datum)}</td><td><b>${t.id}</b></td>
        <td class="small">${e(s.vozidlo || t.vozidlo || '')}${voz && voz.spz ? ` <span class="mono muted">${e(voz.spz)}</span>` : ''}${t.vodic ? `<br><span class="muted">${e(t.vodic)}</span>` : ''}</td>
        <td class="small">${s.zastavky.map((z, i) => `<span class="zst">${i + 1}. ${e(z.mesto || z.nazov)}${z.krajina !== 'SK' ? ` <span class="badge">${z.krajina}</span>` : ''}</span>`).join(' ')}</td>
        <td class="r">${s.zastavok}</td><td class="r">${s.kr} / ${s.zar}</td><td class="r">${s.kg ? F.kg(s.kg) : '–'}</td><td class="r">${fmt(s.km)}</td>
        <td class="r">${vy == null ? '–' : `<span class="vyt"><i style="width:${Math.min(100, vy)}%" class="${vy > 100 ? 'over' : ''}"></i></span> ${vy} %`}</td>
        <td>${t.stav === 'expedovana' ? '<span class="ok small">✓ expedovaná</span>' : '<span class="small">plánovaná</span>'}</td></tr>`; }).join('') || '<tr><td colspan="10" class="empty">Zatiaľ žiadne trasy.</td></tr>'}
      </tbody></table></section>`;
    const st = {}; FILTRE.forEach(f => st[f] = q.get(f) || ''); if (!st.sort) st.sort = 'datum'; if (!q.has('dir')) st.dir = 'd';
    const sel = { q: '#fq', obd: '#fobd', od: '#fod', do: '#fdo', voz: '#fvoz', kraj: '#fkraj', vodic: '#fvodic', sort: '#fsort' };
    const tb = $('table.trt tbody'), all = [...tb.rows].filter(r => r.dataset.datum);
    const aplikuj = () => {
      const hl = F.partnerNorm(st.q), smer = st.dir === 'd' ? -1 : 1, [od, do_] = rozsah(st.obd, st.od, st.do);
      const vid = [];
      all.forEach(r => { const x = r.dataset;
        const ok = (!st.stav || x.stav === st.stav) && (!hl || x.txt.includes(hl)) && x.datum >= od && x.datum <= do_ && (!st.voz || x.voz === st.voz) && (!st.kraj || x.kraj.split('|').includes(st.kraj)) && (!st.vodic || x.vodic === st.vodic);
        r.hidden = !ok; if (ok) vid.push(x); });
      all.sort((a, b) => { const x = a.dataset[st.sort], y = b.dataset[st.sort]; return smer * (st.sort === 'datum' ? x.localeCompare(y) : (+x - +y)) || b.dataset.datum.localeCompare(a.dataset.datum); }).forEach(r => tb.appendChild(r));
      document.querySelectorAll('.pill[data-stav]').forEach(b => b.classList.toggle('on', b.dataset.stav === st.stav));
      document.querySelectorAll('th[data-sort]').forEach(t => { t.classList.toggle('on', t.dataset.sort === st.sort); t.querySelector('i').textContent = t.dataset.sort === st.sort ? (smer > 0 ? ' ↑' : ' ↓') : ''; });
      $('#fcount').textContent = `zobrazených ${vid.length} z ${all.length} trás`; $('#fdir').textContent = smer > 0 ? '↑' : '↓';
      const S = k => F.sum(vid, x => +x[k]), vyt = vid.filter(x => +x.vyt >= 0);
      $('#sumBar').innerHTML = `<div><span>Trasy</span><b>${vid.length}</b></div><div><span>Zastávky</span><b>${fmt(S('zast'))}</b></div><div><span>Zákazky</span><b>${fmt(S('zak'))}</b></div><div><span>Krídla</span><b>${fmt(S('kr'))}</b></div><div><span>Brutto</span><b>${fmt(S('kg') / 1000, 1)} t</b></div><div><span>Najazdené</span><b>${fmt(S('km'))} km</b></div><div><span>Ø vyťaženie</span><b>${vyt.length ? Math.round(F.sum(vyt, x => +x.vyt) / vyt.length) + ' %' : '–'}</b></div>`;
      const qs = new URLSearchParams({ tab: 'trasy' }); FILTRE.forEach(f => { if (st[f] && !(f === 'sort' && st[f] === 'datum') && !(f === 'dir' && st[f] === 'd')) qs.set(f, st[f]); }); if (st.dir !== 'd') qs.set('dir', 'a');
      history.replaceState(null, '', '#/expedicia?' + qs);
    };
    if (q.get('dir') === 'a') st.dir = '';
    Object.entries(sel).forEach(([f, s]) => { const el = $(s); el.value = st[f]; el.addEventListener('input', () => { st[f] = el.value; if (f === 'obd') { st.od = st.do = ''; $('#fod').value = $('#fdo').value = ''; } if ((f === 'od' || f === 'do') && el.value) { st.obd = ''; $('#fobd').value = ''; } aplikuj(); }); });
    document.querySelectorAll('.pill[data-stav]').forEach(b => b.addEventListener('click', () => { st.stav = b.dataset.stav; aplikuj(); }));
    $('#fdir').addEventListener('click', () => { st.dir = st.dir === 'd' ? '' : 'd'; aplikuj(); });
    $('#freset').addEventListener('click', () => { FILTRE.forEach(f => st[f] = ''); st.sort = 'datum'; st.dir = 'd'; Object.entries(sel).forEach(([f, s]) => $(s).value = st[f]); aplikuj(); });
    document.querySelectorAll('th[data-sort]').forEach(t => t.addEventListener('click', () => { if (st.sort === t.dataset.sort) st.dir = st.dir === 'd' ? '' : 'd'; else { st.sort = t.dataset.sort; st.dir = 'd'; } $('#fsort').value = st.sort; aplikuj(); }));
    app().onclick = ev => {
      if (!ev.target.closest('[data-act="csv"]')) return;
      const vid = all.filter(r => !r.hidden).map(r => F.trasa(r.dataset.href.split('=')[1])).filter(Boolean), qq = v => { const t = String(v == null ? '' : v); return /[;"\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
      const csv = '﻿' + ['trasa', 'datum', 'stav', 'auto', 'vodic', 'zastavky', 'zakazky', 'kridla', 'zarubne', 'brutto_kg', 'km', 'vytazenie_pct', 'mesta'].join(';') + '\n' + vid.map(t => { const s = F.suhrnTrasy(t); return [t.id, t.datum, t.stav, s.vozidlo, t.vodic, s.zastavok, s.zakaziek, s.kr, s.zar, s.kg, s.km, vytazenie(s) ?? '', s.zastavky.map(z => z.mesto).join(' – ')].map(qq).join(';'); }).join('\n');
      F.stiahni('trasy-' + F.today() + '.csv', csv, 'text/csv;charset=utf-8');
    };
    aplikuj();
  };

  /* =====================================================================
     ŠTATISTIKY ROZVOZU
     ===================================================================== */
  F.vTrasyStat = q => {
    const d = D(), obd = q.has('obd') ? q.get('obd') : '365', kr = q.get('kr') || (['7', '30', 'mes'].includes(obd) ? 't' : 'm'), voz = q.get('voz') || '';
    const [od, do_] = rozsah(obd, q.get('od'), q.get('do'));
    const vsetky = d.trasy.filter(t => t.stav === 'expedovana' && t.datum >= od && t.datum <= do_ && (!voz || t.vozidloId === voz)).map(t => ({ t, s: F.suhrnTrasy(t) }));
    const Z = vsetky.flatMap(({ t, s }) => s.zastavky.map(z => ({ ...z, t, s })));
    const ZK = Z.flatMap(z => z.zakazky.map(x => ({ ...x, z })));
    const S = (L, f) => F.sum(L, f);
    const tot = { tr: vsetky.length, zast: S(vsetky, x => x.s.zastavok), zak: S(vsetky, x => x.s.zakaziek), kr: S(vsetky, x => x.s.kr), zar: S(vsetky, x => x.s.zar), kg: S(vsetky, x => x.s.kg), km: S(vsetky, x => x.s.km) };
    const vyt = vsetky.map(x => vytazenie(x.s)).filter(v => v != null), vytP = vyt.length ? Math.round(vyt.reduce((a, b) => a + b, 0) / vyt.length) : null;
    const kpi = (lab, val, sub = '') => `<div class="kpi"><span>${lab}</span><b>${val}</b><small>${sub}</small></div>`;
    // časový rad
    const kluc = dt => { if (kr === 'm') return dt.slice(0, 7); const x = new Date(dt + 'T12:00:00'); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x.toISOString().slice(0, 10); };
    const zac = vsetky.length ? vsetky.map(x => x.t.datum).sort()[0] : F.today();
    const buck = []; { let x = kluc(od > '0000' ? od : zac); const kon = kluc(do_ < '9999' ? do_ : F.today()); let n = 0; while (x <= kon && n++ < 120) { buck.push({ k: x, kr: {}, km: 0, n: 0 }); const y = new Date((x.length === 7 ? x + '-01' : x) + 'T12:00:00'); if (kr === 'm') y.setMonth(y.getMonth() + 1); else y.setDate(y.getDate() + 7); x = kr === 'm' ? y.toISOString().slice(0, 7) : y.toISOString().slice(0, 10); } }
    vsetky.forEach(({ t, s }) => { const b = buck.find(y => y.k === kluc(t.datum)); if (!b) return; b.kr[t.vozidloId || '?'] = (b.kr[t.vozidloId || '?'] || 0) + s.kr; b.km += s.km; b.n++; });
    const VOZ = F.vozidla(), FV = ['#8B5A2B', '#5B6B7A', '#B08D57', '#3F6B4F', '#6E2620'], fv = id => FV[Math.max(0, VOZ.findIndex(v => v.id === id)) % FV.length];
    const W = 680, H = 210, pl = 38, pr = 38, pt = 14, pb = 28, bw = (W - pl - pr) / Math.max(1, buck.length);
    const mxK = Math.max(1, ...buck.map(b => F.sum(Object.values(b.kr), v => v))), mxKm = Math.max(1, ...buck.map(b => b.km)), sy = (H - pt - pb) / mxK;
    let g = '';
    [0, .5, 1].forEach(f => { const y = H - pb - f * (H - pt - pb); g += `<line x1="${pl}" y1="${y}" x2="${W - pr}" y2="${y}" stroke="#E2DCCF"/><text x="${pl - 4}" y="${y + 3}" text-anchor="end" class="t-ax">${Math.round(f * mxK)}</text><text x="${W - pr + 4}" y="${y + 3}" class="t-ax" fill="#6E2620">${fmt(f * mxKm)}</text>`; });
    buck.forEach((b, i) => { let y = H - pb; const x = pl + i * bw + bw * .15, w = bw * .7;
      VOZ.forEach(v => { const val = b.kr[v.id] || 0; if (!val) return; const h = val * sy; y -= h; g += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fv(v.id)}"><title>${e(v.nazov)}: ${val} krídel</title></rect>`; });
      const dt = new Date((b.k.length === 7 ? b.k + '-01' : b.k) + 'T12:00:00'), lab = kr === 'm' ? ['jan', 'feb', 'mar', 'apr', 'máj', 'jún', 'júl', 'aug', 'sep', 'okt', 'nov', 'dec'][dt.getMonth()] : (i % Math.ceil(buck.length / 14) === 0 ? `${dt.getDate()}.${dt.getMonth() + 1}.` : '');
      if (lab) g += `<text x="${pl + i * bw + bw / 2}" y="${H - pb + 13}" text-anchor="middle" class="t-ax">${lab}</text>`; });
    g += `<polyline points="${buck.map((b, i) => `${pl + i * bw + bw / 2},${H - pb - (b.km / mxKm) * (H - pt - pb)}`).join(' ')}" fill="none" stroke="#6E2620" stroke-width="1.6" stroke-dasharray="4 3"/>`;
    const graf = `<svg class="v-graf" viewBox="0 0 ${W} ${H}" width="100%" role="img">${g}</svg><div class="lg">${VOZ.map(v => `<span><i style="background:${fv(v.id)}"></i>${e(v.nazov)} – krídla</span>`).join('')}<span><i class="dash" style="border-color:#6E2620"></i>najazdené km (pravá os)</span></div>`;
    // tabuľky
    const tab = (nadpis, kluce, riadky, cols) => `<section class="card"><h2>${nadpis}</h2>${riadky.length ? `<table class="t slim"><thead><tr>${cols.map(c => `<th class="${c[2] || ''}">${c[0]}</th>`).join('')}</tr></thead><tbody>${riadky.map(r => `<tr>${cols.map(c => `<td class="${c[2] || ''}">${c[1](r)}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '<p class="muted">Žiadne údaje za obdobie.</p>'}</section>`;
    const podla = (L, kf) => Object.values(L.reduce((o, x) => { const k = kf(x); (o[k] = o[k] || { k, L: [] }).L.push(x); return o; }, {}));
    const poAutach = podla(vsetky, x => x.t.vozidloId || x.s.vozidlo).map(g2 => { const v = F.vozidlo(g2.L[0].t.vozidloId), vv = g2.L.map(x => vytazenie(x.s)).filter(x => x != null); return { naz: v ? v.nazov : g2.L[0].s.vozidlo, tr: g2.L.length, km: S(g2.L, x => x.s.km), kr: S(g2.L, x => x.s.kr), kg: S(g2.L, x => x.s.kg), zast: S(g2.L, x => x.s.zastavok), vyt: vv.length ? Math.round(vv.reduce((a, b) => a + b, 0) / vv.length) : null, farba: fv(g2.L[0].t.vozidloId) }; }).sort((a, b) => b.kr - a.kr);
    const poKraj = podla(Z, z => z.krajina).map(g2 => ({ k: g2.k, zast: g2.L.length, kr: S(g2.L, z => S(z.zakazky, x => x.kr)), kg: S(g2.L, z => S(z.zakazky, x => x.kg)) })).sort((a, b) => b.kr - a.kr);
    const poMeste = podla(Z, z => (z.mesto || z.nazov) + '|' + z.krajina).map(g2 => ({ m: g2.L[0].mesto || g2.L[0].nazov, kraj: g2.L[0].krajina, zast: g2.L.length, kr: S(g2.L, z => S(z.zakazky, x => x.kr)), kg: S(g2.L, z => S(z.zakazky, x => x.kg)) })).sort((a, b) => b.kr - a.kr).slice(0, 15);
    const poPartner = podla(ZK, x => x.skupina || x.partner).map(g2 => ({ p: g2.k, id: (g2.L.find(x => x.partnerId) || {}).partnerId, zak: g2.L.length, vyl: new Set(g2.L.map(x => x.z.t.id + x.z.mesto)).size, kr: S(g2.L, x => x.kr), kg: S(g2.L, x => x.kg) })).sort((a, b) => b.kr - a.kr).slice(0, 15);
    const poVodic = podla(vsetky.filter(x => x.t.vodic), x => x.t.vodic).map(g2 => ({ v: g2.k, tr: g2.L.length, km: S(g2.L, x => x.s.km), kr: S(g2.L, x => x.s.kr), zast: S(g2.L, x => x.s.zastavok) })).sort((a, b) => b.tr - a.tr);
    const mxP = Math.max(1, ...poPartner.map(x => x.kr)), mxM = Math.max(1, ...poMeste.map(x => x.kr));
    const qsx = o => '#/expedicia?' + new URLSearchParams(Object.assign({ tab: 'stat', obd, kr, voz }, o));
    app().innerHTML = `<div class="v-head"><div><h1>Expedícia</h1><p class="muted">štatistiky expedovaných trás · ${e(OBD[obd] || 'vlastné obdobie')}${q.get('od') || q.get('do') ? ` (${F.fmtD(od)} – ${F.fmtD(do_)})` : ''}</p></div></div>${tabs('stat')}
      <div class="stat-pick no-print"><div class="seg">${['30', '90', '365', 'mes', 'rok', ''].map(k => `<a class="${k === obd && !q.get('od') ? 'on' : ''}" href="${qsx({ obd: k })}">${OBD[k].replace('posledných ', '').replace('posledné ', '')}</a>`).join('')}<span class="sep"></span><a class="${kr === 't' ? 'on' : ''}" href="${qsx({ kr: 't' })}">týždne</a><a class="${kr === 'm' ? 'on' : ''}" href="${qsx({ kr: 'm' })}">mesiace</a></div>
        <label>Auto <select id="svoz"><option value="">všetky</option>${VOZ.map(v => `<option value="${v.id}" ${v.id === voz ? 'selected' : ''}>${e(v.nazov)}</option>`).join('')}</select></label></div>
      <div class="kpis k6">
        ${kpi('Trasy', tot.tr, `${tot.zast} zastávok · ${tot.zak} zákaziek`)}
        ${kpi('Krídla', fmt(tot.kr), `${fmt(tot.zar)} zárubní`)}
        ${kpi('Odvezené', fmt(tot.kg / 1000, 1) + ' <small>t</small>', 'brutto')}
        ${kpi('Najazdené', fmt(tot.km) + ' <small>km</small>', tot.tr ? `Ø ${fmt(tot.km / tot.tr)} km na trasu` : '')}
        ${kpi('Ø vyťaženie', vytP == null ? '–' : vytP + ' <small>%</small>', tot.tr ? `Ø ${fmt(tot.kr / tot.tr, 1)} krídel na trasu` : '')}
        ${kpi('Efektivita', tot.kr ? fmt(tot.km / tot.kr, 1) + ' <small>km/krídlo</small>' : '–', tot.zast ? `Ø ${fmt(tot.km / tot.zast)} km na zastávku` : '')}
      </div>
      <section class="card"><h2>Expedované krídla a kilometre <small class="muted">po ${kr === 'm' ? 'mesiacoch' : 'týždňoch'}</small></h2>${vsetky.length ? graf : '<p class="muted">Za obdobie nie je žiadna expedovaná trasa.</p>'}</section>
      <div class="grid2">
        ${tab('Podľa auta', 0, poAutach, [['Auto', r => `<span class="fdot" style="--c:${r.farba}"></span>${e(r.naz)}`], ['Trasy', r => r.tr, 'r'], ['Zastávky', r => r.zast, 'r'], ['Krídla', r => fmt(r.kr), 'r'], ['Brutto', r => fmt(r.kg / 1000, 1) + ' t', 'r'], ['km', r => fmt(r.km), 'r'], ['Ø vyťaž.', r => r.vyt == null ? '–' : r.vyt + ' %', 'r']])}
        ${tab('Podľa krajiny', 0, poKraj, [['Krajina', r => e(F.KRAJINY[r.k] || r.k)], ['Zastávky', r => r.zast, 'r'], ['Krídla', r => fmt(r.kr), 'r'], ['Brutto', r => fmt(r.kg / 1000, 1) + ' t', 'r'], ['Podiel', r => tot.kr ? Math.round(100 * r.kr / tot.kr) + ' %' : '', 'r']])}
      </div>
      <div class="grid2">
        <section class="card"><h2>Najčastejšie miesta vykládky</h2>${poMeste.length ? `<div class="hbars wide">${poMeste.map(r => `<div><span>${e(r.m)}${r.kraj !== 'SK' ? ` <small class="muted">${r.kraj}</small>` : ''}</span><i style="width:${Math.max(2, 100 * r.kr / mxM)}%"></i><b>${fmt(r.kr)} kr.</b><em>${r.zast}× </em></div>`).join('')}</div>` : '<p class="muted">Žiadne údaje.</p>'}</section>
        <section class="card"><h2>Partneri podľa odvezených krídel <small class="muted">skupiny spolu</small></h2>${poPartner.length ? `<div class="hbars wide">${poPartner.map(r => `<div><span>${r.id ? `<a href="#/partner/${F.skupinaPartnera && F.partner(r.id) && F.skupinaPartnera(F.partner(r.id)) ? F.skupinaPartnera(F.partner(r.id)).id : r.id}">${e(r.p)}</a>` : e(r.p)}</span><i style="width:${Math.max(2, 100 * r.kr / mxP)}%"></i><b>${fmt(r.kr)} kr.</b><em>${r.vyl}× </em></div>`).join('')}</div><p class="muted small">číslo vpravo = počet vykládok</p>` : '<p class="muted">Žiadne údaje.</p>'}</section>
      </div>
      ${poVodic.length ? tab('Podľa vodiča', 0, poVodic, [['Vodič', r => e(r.v)], ['Trasy', r => r.tr, 'r'], ['Zastávky', r => r.zast, 'r'], ['Krídla', r => fmt(r.kr), 'r'], ['km', r => fmt(r.km), 'r']]) : ''}`;
    $('#svoz').addEventListener('change', ev => F.ui.go(qsx({ voz: ev.target.value })));
  };

  /* =====================================================================
     UKÁŽKOVÉ DÁTA – história expedovaných trás za pol roka (len súhrny)
     ===================================================================== */
  F.ukazkaTrasy = (tyzdne = 26) => {
    const d = D(); let seed = 77; const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
    const SK = [['Dverové centrum Michalovce', 'Michalovce'], ['Stavby Šariš s.r.o.', 'Bardejov'], ['Interiéry Dvorský s.r.o.', 'Prešov'], ['PARKETT MANN, s.r.o.', 'Trnava'], ['PARKETT MANN, s.r.o.', 'Bratislava'], ['K-Parket', 'Holíč'], ['WOODLAND', 'Topoľčany'], ['EURO PARKET, s.r.o.', 'Žilina'], ['Balart', 'Trenčín'], ['Kováč Erik-Guru', 'Banská Bystrica'], ['Kováč Erik-Guru', 'Zvolen'], ['Assoprogress, s.r.o.', 'Ľubotín'], ['maloobchod', 'Poprad'], ['maloobchod', 'Košice']];
    const CZ = [['JAF HOLZ Vyškov', 'Vyškov']], HU = ['Sopron', 'Győr', 'Újpest', 'Debrecen', 'Miskolc', 'Szeged', 'Pécs', 'Székesfehérvár', 'Kecskemét', 'Nyíregyháza', 'Veszprém', 'Gödöllő'].map(m => ['Jola', m]);
    const vozy = F.vozidla(), vodici = ['Marek H.', 'Peter K.', 'Tomáš B.'];
    const dep = F.suradnice(F.N().depo || 'Košice'); let c = 0;
    const nova = [];
    for (let w = tyzdne; w >= 1; w--) [[vozy[0], 1 + (rnd() < .5)], [vozy[1], 1]].forEach(([v, n]) => {
      if (!v) return;
      for (let i = 0; i < n; i++) {
        const dt = F.addDays(F.today(), -(w * 7) + 1 + Math.floor(rnd() * 4) + i * 2), hu = (v.krajiny || []).includes('HU');
        const pool = hu ? HU : [...SK, ...(rnd() < .35 ? CZ : [])], k = 2 + Math.floor(rnd() * (hu ? 4 : 5));
        const vyber = [...new Set(Array.from({ length: k }, () => pool[Math.floor(rnd() * pool.length)]))];
        if (!hu && rnd() < .35) vyber.push(CZ[0]);
        // poradie zastávok: najbližší sused
        let pos = dep, zost = [...new Set(vyber)], por = [], km = 0;
        while (zost.length) { zost.sort((a, b) => F.vzdialenost(pos, F.suradnice(a[1]) || pos) - F.vzdialenost(pos, F.suradnice(b[1]) || pos)); const x = zost.shift(), xy = F.suradnice(x[1]) || pos; km += F.vzdialenost(pos, xy); pos = xy; por.push(x); }
        km = Math.round(km + F.vzdialenost(pos, dep));
        const zast = por.map(([naz, m]) => { const nz = 1 + (rnd() < .3); return { nazov: naz === 'Jola' ? 'Jola – ' + m : naz, mesto: m, krajina: hu ? 'HU' : (m === 'Vyškov' ? 'CZ' : 'SK'),
          zakazky: Array.from({ length: nz }, () => { const kr = 1 + Math.floor(rnd() * (naz === 'Jola' ? 8 : 6)), zar = Math.max(0, kr - Math.floor(rnd() * 2)); return { id: `FP-25${String(++c).padStart(4, '0')}-H`, partner: naz, skupina: naz, partnerId: '', pobocka: naz === 'Jola' ? 'Jola – ' + m : '', kr, zar, kg: Math.round(kr * 31 + zar * 12) }; }) }; });
        const zk = zast.flatMap(z => z.zakazky);
        nova.push({ id: 'TR-H' + String(nova.length + 1).padStart(3, '0'), datum: dt, vozidloId: v.id, vozidlo: `${v.nazov} ${v.spz || ''}`.trim(), vodic: hu ? vodici[2] : vodici[Math.floor(rnd() * 2)], zastavky: [], stav: 'expedovana', historia: true,
          suhrn: { km, nezname: 0, zastavok: zast.length, zakaziek: zk.length, kr: F.sum(zk, z => z.kr), zar: F.sum(zk, z => z.zar), kg: F.sum(zk, z => z.kg), kapacita: v.kapacita || 0, nosnost: v.nosnost || 0, vozidlo: v.nazov, krajiny: [...new Set(zast.map(z => z.krajina))], zastavky: zast } });
      }
    });
    d.trasy = [...nova.filter(t => t.datum < F.today()), ...d.trasy];
  };
  const povodna = F.ukazka;
  F.ukazka = () => { povodna(); F.ukazkaTrasy(); F.save(); };
})();

/** Detail staršej trasy len zo súhrnu (zákazky už nemusia existovať) */
F.trasaSuhrnKarta = t => {
  const e = F.esc, s = F.suhrnTrasy(t), vy = s.kapacita ? Math.round(100 * s.kr / s.kapacita) : null;
  return `<section class="card trasa done"><div class="card-h"><h2>${t.id} · ${F.dayName(t.datum)} ${F.fmtD(t.datum)} <span class="ok small">✓ expedovaná</span></h2><span class="muted">${e(t.vozidlo || s.vozidlo)} · vodič ${e(t.vodic || '–')} · ${s.zastavok} zastávok · ${s.zakaziek} zákaziek · ${s.kr} krídel · ${F.kg(s.kg)} · ≈ ${s.km} km${vy != null ? ` · vyťaženie ${vy} %` : ''}</span></div>
    <table class="t slim"><thead><tr><th>#</th><th>Miesto vykládky</th><th>Zákazky</th><th class="r">Krídla / zár.</th><th class="r">Brutto</th></tr></thead><tbody>${s.zastavky.map((z, i) => `<tr><td>${i + 1}.</td><td><b>${e(z.nazov)}</b><br><span class="muted">${e(z.mesto)}${z.krajina !== 'SK' ? ' (' + z.krajina + ')' : ''}</span></td><td class="small">${z.zakazky.map(x => (F.zakazka(x.id) ? `<a href="#/zakazka/${x.id}">${x.id}</a>` : e(x.id)) + ' ' + e(x.partner)).join('<br>')}</td><td class="r">${F.sum(z.zakazky, x => x.kr)} / ${F.sum(z.zakazky, x => x.zar)}</td><td class="r">${F.kg(F.sum(z.zakazky, x => x.kg))}</td></tr>`).join('')}</tbody></table>
    ${t.historia ? '<p class="muted small">Ukážková história – trasa je uložená len ako súhrn.</p>' : ''}</section>`;
};
