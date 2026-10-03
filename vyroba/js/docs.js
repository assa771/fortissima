/* =====================================================================
   Výrobná dokumentácia – každý výstup je HTML „hárok“ A4 pripravený na tlač
   ===================================================================== */
'use strict';
(function () {
  const e = F.esc;
  const hlav = (titul, cislo, podtitul, extra = '') => {
    const n = F.N();
    return `<header class="doc-h">
      <div><div class="doc-brand">FORTISSIMA <span>· ${e(n.firma.nazov)}</span></div><h1>${titul}</h1><div class="doc-sub">${podtitul || ''}</div></div>
      <div class="doc-id">${F.barcode(cislo, { h: 30, w: 1.2 })}<div>vytlačené ${F.fmtD(F.today())}</div>${extra}</div>
    </header>`;
  };
  F.docHlav = hlav;
  const hodnota = (l, v) => `<div class="kv"><span>${l}</span><b>${v}</b></div>`;
  const zamokTxt = p => !p.kovanie || p.kovanie === 'bez' ? 'bez zámku' : F.KOVANIE[p.kovanie];

  /* ---------- 1. VÝDAJKA zo skladu polotovarov ---------- */
  F.docVydajka = v => {
    const zak = F.zakazkyDavky(v), sum = {}, vzor = {}, podla = {};
    zak.forEach(z => {
      const pt = F.potreba(z);
      for (const k in pt) { sum[k] = (sum[k] || 0) + pt[k]; (podla[k] = podla[k] || []).push([z.id, pt[k]]); }
      (z.polozky || []).forEach(p => { if (F.maKridlo(p)) vzor[F.kartaKluc.kridlo(p)] = vzor[F.kartaKluc.kridlo(p)] || p; });
    });
    const plan = F.planProfilov(v);
    const skup = F.groupBy(Object.keys(sum).sort(), F.kartaSkupina);
    const poradie = ['Krídla – polotovar', 'Profily zárubní', 'Rozšírenia', 'Kovanie', 'Príslušenstvo'];
    let body = '';
    poradie.filter(s => skup[s]).forEach(s => {
      body += `<h2 class="doc-sec">${s}</h2><table class="doc-t"><thead><tr><th></th><th>Položka</th><th class="r">Množstvo</th><th>Pre zákazky</th><th class="r">Sklad</th><th class="chk">✓</th></tr></thead><tbody>`;
      skup[s].forEach(k => {
        const karta = F.karta(k) || { stav: 0 }, j = F.kartaJednotka(k);
        let mn = `${+sum[k].toFixed(2)} ${j}`;
        if (plan[k]) mn = `<b>${plan[k].tyce.length} tyčí</b><small>${+sum[k].toFixed(1)} m · ${F.N().dlzkaTyce} mm</small>`;
        const ikon = vzor[k] ? F.svgKridlo(vzor[k], { h: 44, dim: false }) : '';
        const nedost = karta.stav < sum[k] && !v.vydane;
        body += `<tr class="${nedost ? 'warn' : ''}"><td class="ic">${ikon}</td><td>${e(F.kartaNazov(k))}${k.startsWith('KR|') && vzor[k] && F.kridlo(vzor[k]).prirez > 0 ? `<small>polotovar ${F.kridlo(vzor[k]).polotovarH} mm – reže sa na STN</small>` : ''}</td>
          <td class="r big">${mn}</td><td class="mini-list">${podla[k].map(([id, q]) => `${id} <i>${+q.toFixed(2)}</i>`).join('<br>')}</td>
          <td class="r ${nedost ? 'neg' : ''}">${+(karta.stav).toFixed(2)}</td><td class="chk"><span class="box"></span></td></tr>`;
      });
      body += '</tbody></table>';
    });
    return `<section class="sheet">${hlav('Výdajka zo skladu polotovarov', v.id, `Výrobná dávka ${v.id} · ${F.fmtD(v.datum)} · ${zak.length} zákaziek`)}
      <div class="doc-kpi">${hodnota('Krídla', F.sum(zak, z => F.pocty(z).kr) + ' ks')}${hodnota('Zárubne', F.sum(zak, z => F.pocty(z).zar) + ' ks')}${hodnota('Stav výdaja', v.vydane ? 'vydané ' + F.fmtD(v.vydane) : 'nevydané')}</div>
      ${body}<footer class="doc-f"><span>Vydal: ____________________</span><span>Prevzal: ____________________</span></footer></section>`;
  };

  /* plán rezu pre profily dávky: { 'OB|biela': {tyce, kusy}, 'OS|F100|biela': … } */
  F.planProfilov = v => {
    const n = F.N(), sk = {};
    F.kusyDavky(v).filter(k => k.typ === 'dielec').forEach(k => {
      const fz = k.p.farba_zarubne, lab = k.z.id.slice(-4) + '/' + k.p.poradie + '.' + k.i + ' ' + k.dielec.id;
      (sk['OB|' + fz] = sk['OB|' + fz] || []).push({ dlz: k.dielec.dlzObl, typ: k.dielec.id, lab }, { dlz: k.dielec.dlzObl, typ: k.dielec.id, lab });
      const ko = 'OS|' + k.zar.typ + '|' + fz;
      (sk[ko] = sk[ko] || []).push({ dlz: k.dielec.dlzOst, typ: k.dielec.id, lab });
    });
    const out = {};
    for (const key in sk) out[key] = { kusy: sk[key], tyce: F.rezPlan(sk[key], n.dlzkaTyce, n.rezPridavok) };
    return out;
  };

  /* ---------- 2. CNC LIST KRÍDEL (Homag) ---------- */
  F.docCncKridla = (v, o = {}) => {
    let kusy = F.kusyDavky(v).filter(k => k.typ === 'kridlo').map(k => Object.assign(k, { cnc: F.kodKridla(k.p) }));
    if (o.zoradit !== false) kusy.sort((a, b) => a.cnc.kod.localeCompare(b.cnc.kod));
    const rows = kusy.map((k, i) => {
      const p = k.p, kr = F.kridlo(p), sken = F.skenKusu(k.id);
      return `<article class="cnc-row ${sken.cnc ? 'is-done' : ''}">
        <div class="cnc-n">${i + 1}</div>
        <div class="cnc-v">${F.svgKridlo(p, { h: 150 })}</div>
        <div class="cnc-p">
          <div class="cnc-title">${e(F.KOLEKCIE[p.kolekcia].model)} <span>${e(F.KOLEKCIE[p.kolekcia].nazov)}</span> <em class="tag ${p.smer === 'prave' ? 'tag-p' : 'tag-l'}">${p.smer === 'prave' ? 'P' : 'L'}</em></div>
          <div class="cnc-grid">
            ${hodnota('Zákazka', `${e(k.z.id)} · poz. ${p.poradie}${+p.ks > 1 ? ` · ${k.i}/${p.ks}` : ''}`)}
            ${hodnota('Zákazník', e((k.z.zakaznik.nazov || '').slice(0, 26)))}
            ${hodnota('Rozmer', `<span class="mono">${kr.w} × ${kr.h}</span>`)}
            ${hodnota('Prevedenie', `${F.PREVEDENIA[p.prevedenie]}, ${F.FARBY[p.farba].nazov}`)}
            ${hodnota('Zámok', e(zamokTxt(p)))}
            ${hodnota('Mriežka / prah', `${p.mriezka && p.mriezka !== 'bez' ? F.MRIEZKY[p.mriezka] : '–'} / ${p.prah ? 'výsuvný' : '–'}`)}
            ${hodnota('Polotovar', `${kr.polotovarH} mm${kr.prirez ? ` → <b class="ox">rezať ${kr.prirez} mm</b>` : ''}`)}
            ${hodnota('Pozícia', e(p.nazov || '–'))}
          </div>
        </div>
        <div class="cnc-bc">${F.barcode(k.cnc.kod, { h: 46, w: 1.45, fs: 13 })}${F.rozpisKodu(k.cnc.kod, F.POLIA_KRIDLA)}<div class="cnc-kus">${F.barcode(k.id, { h: 18, w: 1, fs: 9 })}</div></div>
      </article>`;
    }).join('');
    return `<section class="sheet">${hlav('CNC list krídel', v.id, `Homag · dávka ${v.id} · ${F.fmtD(v.datum)} · ${kusy.length} krídel${o.zoradit !== false ? ' · zoradené podľa programu' : ''}`)}${rows || '<p class="empty">V dávke nie sú krídla.</p>'}</section>`;
  };

  /* ---------- 3. PRÍPRAVNÝ LIST ZÁRUBNÍ (zbíjanie obložiek s osteniami, rez na dĺžku) ---------- */
  F.docPripravaZarubni = v => {
    const n = F.N(), kusy = F.kusyDavky(v).filter(k => k.typ === 'dielec');
    const sk = F.groupBy(kusy, k => k.p.farba_zarubne + '|' + k.zar.typ);
    let body = '';
    Object.keys(sk).sort().forEach(key => {
      const [fz, typ] = key.split('|'), arr = sk[key], zr = arr[0].zar;
      const agg = F.groupBy(arr, k => [k.dielec.id === 'ZH' ? 'nadpražie' : 'stojka', k.dielec.dlzObl, k.dielec.dlzOst, k.zar.tupo ? 'tupo' : 'pokos'].join('|'));
      body += `<div class="prep-grp"><div class="prep-head"><div><h2 class="doc-sec">${typ} · ${F.FARBY[fz].nazov}</h2><p>${arr.length} dielcov · obložka ${n.oblozkaSirka} mm · ostenie ${zr.ost} mm</p></div>${F.svgProfil(zr, { w: 150 })}</div>
        <table class="doc-t"><thead><tr><th>Dielec</th><th>Spoj</th><th class="r">Obložka (2×)</th><th class="r">Ostenie</th><th class="r">Ks</th><th>Zákazky</th><th class="chk">✓</th></tr></thead><tbody>
        ${Object.keys(agg).sort((a, b) => b.split('|')[1] - a.split('|')[1]).map(g => { const [d, o, s, sp] = g.split('|'), x = agg[g];
          return `<tr><td><b>${d}</b></td><td>${sp === 'tupo' ? '<span class="tag tag-t">90° tupo</span>' : '45° pokos'}</td><td class="r big mono">${o}</td><td class="r big mono">${s}</td><td class="r big">${x.length}</td><td class="mini-list">${[...new Set(x.map(k => k.z.id))].join(', ')}</td><td class="chk"><span class="box"></span></td></tr>`; }).join('')}
        </tbody></table></div>`;
    });
    const plan = F.planProfilov(v);
    let rez = '';
    Object.keys(plan).sort().forEach(k => {
      const p = plan[k];
      rez += `<div class="rez-grp"><h3>${e(F.kartaNazov(k))} <small>${p.tyce.length} tyčí × ${n.dlzkaTyce} mm · využitie ${Math.round(100 * F.sum(p.kusy, x => x.dlz) / (p.tyce.length * n.dlzkaTyce))} %</small></h3>
        ${p.tyce.map((t, i) => `<div class="rez-row"><span>${i + 1}</span>${F.svgTyc(t, n.dlzkaTyce)}</div>`).join('')}</div>`;
    });
    const leg = `<div class="legend"><span style="--c:#B08D57">ZZ závesová</span><span style="--c:#8B5A2B">ZR protiplechová</span><span style="--c:#6E2620">ZH nadpražie</span><span style="--c:#9C7A45">ZL/ZP slepá</span></div>`;
    return `<section class="sheet">${hlav('Príprava zárubní', v.id, `Zbíjanie obložiek s osteniami a rez na dĺžku · dávka ${v.id} · ${kusy.length} dielcov`)}${body || '<p class="empty">V dávke nie sú zárubne.</p>'}</section>
      ${rez ? `<section class="sheet">${hlav('Rezný plán profilov', v.id + '-R', `Optimalizácia rezu z tyčí ${n.dlzkaTyce} mm, prídavok na rez ${n.rezPridavok} mm`)}${leg}${rez}</section>` : ''}`;
  };

  /* ---------- 4. CNC LIST ZÁRUBNÍ (Comec) ---------- */
  F.docCncZarubne = v => {
    const kusy = F.kusyDavky(v).filter(k => k.typ === 'dielec');
    const zar = F.groupBy(kusy, k => `${k.z.id}|${k.p.poradie}|${k.i}`);
    const rows = Object.keys(zar).map((key, i) => {
      const arr = zar[key], k0 = arr[0], p = k0.p, zr = k0.zar;
      return `<article class="zar-row">
        <div class="zar-left"><div class="cnc-n">${i + 1}</div>${F.svgZarubna(p, zr, { h: 150 })}
          <div class="zar-info"><b>${zr.typ}${zr.tupo ? ' T' : ''}</b> ${zr.slepa ? 'slepá' : F.PREVEDENIA[p.prevedenie]} · ${F.FARBY[p.farba_zarubne].nazov}<br>${p.sirka}/${F.VYSKY[p.vyska].txt} ${zr.slepa ? '' : (p.smer === 'prave' ? 'P' : 'L')} · stena ${p.stena} mm${zr.ext ? ` · +${zr.r180 ? 'R180 ' : ''}${zr.r90 ? 'R90' : ''}` : ''}<br><span class="muted">${e(k0.z.id)} · poz. ${p.poradie} · ${e((k0.z.zakaznik.nazov || '').slice(0, 22))}</span></div></div>
        <div class="zar-parts">${arr.map(k => { const d = k.dielec, sken = F.skenKusu(k.id);
          return `<div class="part ${sken.cnc ? 'is-done' : ''}"><div class="part-v">${F.svgZarubna(p, zr, { h: 62, hl: d.id, dim: false })}</div>
            <div class="part-t"><b>${d.nazov}</b><span class="mono">obl. ${d.dlzObl} · ost. ${d.dlzOst}</span>${F.barcode(d.kod, { h: 30, w: 1.25, fs: 11 })}${F.rozpisKodu(d.kod, F.POLIA_ZARUBNE)}</div>
            <div class="part-id">${F.barcode(k.id, { h: 16, w: .95, fs: 8 })}</div></div>`; }).join('')}</div>
      </article>`;
    }).join('');
    return `<section class="sheet">${hlav('CNC list zárubní', v.id, `Comec · dávka ${v.id} · ${Object.keys(zar).length} zárubní · ${kusy.length} dielcov`)}${rows || '<p class="empty">V dávke nie sú zárubne.</p>'}</section>`;
  };

  /* ---------- 5. KOMPLETAČNÝ LIST (sklad, po zákazkách) ---------- */
  F.docKompletacia = z => {
    const kusy = F.kusy(z), hotovo = kusy.filter(k => F.skenKusu(k.id).kompletacia).length;
    const pos = (z.polozky || []).map(p => {
      const kk = kusy.filter(k => k.p === p);
      return `<div class="komp-pos"><div class="komp-vis">${F.maKridlo(p) ? F.svgKridlo(p, { h: 110 }) : ''}${F.maZarubnu(p) ? F.svgZarubna(p, null, { h: 110 }) : ''}</div>
        <div class="komp-body"><h3>${p.poradie}. ${e(p.nazov || 'Pozícia')} <small>${e(F.popisPozicie(p))} · ${p.ks} ks</small></h3>
        <table class="doc-t slim"><tbody>${kk.map(k => { const s = F.skenKusu(k.id);
          return `<tr class="${s.kompletacia ? 'ok' : ''}"><td class="chk"><span class="box ${s.kompletacia ? 'on' : ''}"></span></td><td>${e(k.nazov)}${k.typ === 'dielec' ? ` <span class="muted">${k.dielec.dlzObl} mm</span>` : ''}</td><td class="r">${F.barcode(k.id, { h: 18, w: 1, fs: 9 })}</td></tr>`; }).join('')}</tbody></table></div></div>`;
    }).join('');
    const acc = (z.prislusenstvo || []).length ? `<h2 class="doc-sec">Príslušenstvo</h2><table class="doc-t">${z.prislusenstvo.map(a => `<tr><td class="chk"><span class="box"></span></td><td>${e(a.nazov)}</td><td class="r">${a.ks} ks</td></tr>`).join('')}</table>` : '';
    return `<section class="sheet">${hlav('Kompletačný list', z.id, `${e(z.zakaznik.nazov)} · ${z.davka ? 'dávka ' + z.davka : 'bez dávky'} · ${kusy.length} kusov`, `<div class="prog"><i style="width:${kusy.length ? 100 * hotovo / kusy.length : 0}%"></i></div><div>${hotovo}/${kusy.length} skompletizované</div>`)}${pos}${acc}
      <footer class="doc-f"><span>Skompletizoval: ____________________</span><span>Kontrola: ____________________</span></footer></section>`;
  };

  /* ---------- 6. DODACÍ LIST (bez cien) ---------- */
  F.docDodaciList = (z, tr) => {
    const n = F.N(), kusy = F.kusy(z), dod = F.dodanie(z), stop = tr ? F.zastavkyTrasy(tr).findIndex(s => s.zakazky.includes(z)) + 1 : null;
    const rows = (z.polozky || []).map(p => `<tr><td>${p.poradie}</td><td class="ic">${F.mini(p)}</td><td><b>${e(p.nazov || '')}</b><br>${e(F.popisPozicie(p))}${F.maZarubnu(p) && !F.jeSlepa(p) ? `<br><span class="muted">zárubňa ${F.zarubna(p).typ}${p.spoj === 'tupo' ? ' tupo' : ''}, ${F.FARBY[p.farba_zarubne].nazov}, závesy ${F.ZAVESY[p.zavesy || 'nikel']}</span>` : ''}</td><td class="r big">${p.ks}</td></tr>`).join('');
    const acc = (z.prislusenstvo || []).map(a => `<tr><td></td><td></td><td>${e(a.nazov)}</td><td class="r big">${a.ks}</td></tr>`).join('');
    return `<section class="sheet">${hlav('Dodací list', 'DL-' + z.id, `k zákazke ${z.id}${z.ponuka ? ' · ponuka ' + e(z.ponuka) : ''}`, tr ? `<div class="stop">zastávka <b>${stop}</b> · ${e(tr.id)}</div>` : '')}
      <div class="parties"><div><span>Dodávateľ</span><b>${e(n.firma.nazov)}</b><br>${e(n.firma.adresa)}<br>IČO ${e(n.firma.ico)} · IČ DPH ${e(n.firma.icdph)}</div>
        <div><span>Odberateľ</span><b>${e(z.zakaznik.nazov)}</b><br>${e(z.zakaznik.adresa || '')}<br>${z.zakaznik.ico ? 'IČO ' + e(z.zakaznik.ico) : ''}${z.zakaznik.icdph ? ' · IČ DPH ' + e(z.zakaznik.icdph) : z.zakaznik.dic ? ' · DIČ ' + e(z.zakaznik.dic) : ''}<br>${e(z.zakaznik.telefon || '')}${F.textPobockyZakazky && F.textPobockyZakazky(z) ? `<br><b>Objednala pobočka: ${e(F.textPobockyZakazky(z))}</b>` : ''}</div>
        <div><span>Miesto vykládky</span><b>${e(dod.nazov || '')}</b><br>${e(F.dodanieText(dod))}<br>${dod.kontakt ? e(dod.kontakt) + ' · ' : ''}${tr ? F.fmtD(tr.datum) : 'termín –'}${z.montaz ? ' · s montážou' : ''}${dod.pozn ? `<br><i>${e(dod.pozn)}</i>` : ''}</div></div>
      ${z.objednal ? `<p class="muted">Objednávka cez web: ${e(z.objednal.partner)}${z.objednal.login ? ' (' + e(z.objednal.login) + ')' : ''}${z.objednal.cas ? ', ' + F.fmtD(z.objednal.cas) : ''}${z.ponuka ? ', ponuka ' + e(z.ponuka) : ''}</p>` : ''}
      <table class="doc-t"><thead><tr><th>#</th><th></th><th>Položka</th><th class="r">Ks</th></tr></thead><tbody>${rows}${acc}</tbody></table>
      <p class="muted">Hmotnosť ≈ <b>${F.hmotnostZakazky ? F.kg(F.hmotnostZakazky(z).brutto) : '–'}</b> brutto · Počet balíkov / kusov na nakládku: <b>${kusy.length}</b> (krídla ${kusy.filter(k => k.typ === 'kridlo').length}, dielce zárubní ${kusy.filter(k => k.typ === 'dielec').length}, rozšírenia ${kusy.filter(k => k.typ === 'rozsirenie').length})</p>
      <footer class="doc-f"><span>Odovzdal: ____________________</span><span>Prevzal (meno, podpis, dátum): ______________________________</span></footer></section>`;
  };

  /* 7. nákladkový list – v rozvoz.js */

  /* ---------- 8. ŠTÍTKY na balenie ---------- */
  F.docStitky = kusy => {
    const lab = kusy.map(k => `<div class="label"><div class="l-top"><b>${e(k.z.id)}</b><span>${e((k.z.zakaznik.nazov || '').slice(0, 24))}</span></div>
      <div class="l-mid">${e(k.nazov)}<small>${k.p ? e((k.p.nazov ? k.p.nazov + ' · ' : '') + F.popisPozicie(k.p)) : ''}</small></div>${F.barcode(k.id, { h: 26, w: 1.1, fs: 9 })}</div>`).join('');
    return `<section class="sheet sheet-labels">${lab}</section>`;
  };
})();
