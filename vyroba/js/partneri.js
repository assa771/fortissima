/* =====================================================================
   PARTNERI – zoznam s kategóriami, filtrami a zoradením + karta partnera
   (údaje, kontaktné osoby, pobočky s mapou, zákazky, čo kupuje, denník, web prístup)
   ===================================================================== */
'use strict';
(function () {
  const e = F.esc, $ = s => document.querySelector(s), app = () => $('#view'), D = () => F.load();
  const DEN = 864e5;
  const opt = (obj, val) => Object.entries(obj).map(([k, v]) => `<option value="${e(k)}" ${String(k) === String(val ?? '') ? 'selected' : ''}>${e(v)}</option>`).join('');

  F.KATEGORIE_PARTNEROV = { predajca: 'Predajca / predajňa dverí', velkoobchod: 'Veľkoobchod / sieť', stavebna: 'Stavebná firma / developer', montaz: 'Montážna firma / stolár', architekt: 'Architekt / dizajnér', koncovy: 'Koncový zákazník', ine: 'Iné', '': 'Nezaradený' };
  F.KAT_FARBA = { predajca: '#B08D57', velkoobchod: '#6E2620', stavebna: '#5B6B7A', montaz: '#8B5A2B', architekt: '#7A5C8A', koncovy: '#3F6B4F', ine: '#8B8172', '': '#BDB6A8' };
  F.KRAJINY_N = { SK: 'Slovensko', CZ: 'Česko', HU: 'Maďarsko', AT: 'Rakúsko', PL: 'Poľsko' };
  F.AKTIVITA = { aktivny: 'Aktívny (do 12 mes.)', spiaci: 'Spiaci (12–24 mes.)', neaktivny: 'Neaktívny (nad 24 mes.)', nikdy: 'Bez objednávky' };
  F.TYPY_ZAZNAMU = { telefon: 'telefonát', email: 'e-mail', stretnutie: 'stretnutie', ponuka: 'cenová ponuka', reklamacia: 'reklamácia', ine: 'iné' };

  F.kategoriaPartnera = p => p.kategoria != null && p.kategoria !== 'auto' ? p.kategoria : (p.predajna ? 'predajca' : '');
  F.zakazkyPartnera = p => D().zakazky.filter(z => z.zakaznik.partnerId === p.id).sort((a, b) => (b.vytvorena || '').localeCompare(a.vytvorena || ''));
  const datumZ = z => (z.datumy && (z.datumy.potvrdena || z.datumy.dopyt)) || (z.vytvorena || '').slice(0, 10);
  F.hodnotaZakazky = z => z.spolu_bez_dph != null ? +z.spolu_bez_dph : F.sum(F.riadkyFaktury(z), r => (+r.mn || 0) * (+r.cena || 0));
  /** Súhrn partnera: evidencia 2024 (stat) + zákazky v systéme */
  F.suhrnPartnera = (p, zak) => {
    zak = zak || F.zakazkyPartnera(p);
    const st = p.stat || {}, sysPosl = zak.length ? zak.map(datumZ).sort().pop() : '';
    const posledna = [st.posledna || '', sysPosl].sort().pop();
    const dni = posledna ? (Date.now() - Date.parse(posledna + 'T12:00:00')) / DEN : Infinity;
    const aktivita = !posledna ? 'nikdy' : dni <= 365 ? 'aktivny' : dni <= 730 ? 'spiaci' : 'neaktivny';
    const otv = zak.filter(z => F.stavIdx(z.stav) < F.stavIdx('expedovana'));
    return { zak, otv, posledna, aktivita, dni, sysKr: F.sum(zak, z => F.pocty(z).kr), sysHodnota: F.sum(zak, F.hodnotaZakazky), obrat: +st.obrat || 0, zakazky: +st.zakazky || 0, dvere: +st.dvere || 0, zarubne: +st.zarubne || 0 };
  };

  /* =====================================================================
     ÚPRAVA ÚDAJOV PARTNERA (modálne okno – spoločné pre zoznam aj kartu)
     ===================================================================== */
  F.upravPartnera = (p, poUlozeni) => {
    const { modal, toast } = F.ui, d = D();
    let noveHeslo = null;
    const nov = !p; p = p || { nazov: '', hladina: 'voc', krajina: 'SK', aliasy: [], stat: {} };
    const fld = (k, l, w) => `<label class="${w ? 'w' : ''}">${l}<input name="${k}" value="${e(p[k] || '')}"></label>`;
    modal(nov ? 'Nový partner' : e(p.nazov), `<form id="pf" class="kf">${fld('nazov', 'Obchodné meno', 1)}${fld('ulica', 'Ulica', 1)}${fld('psc', 'PSČ')}${fld('mesto', 'Mesto')}${fld('ico', 'IČO')}${fld('dic', 'DIČ')}${fld('icdph', 'IČ DPH')}
      <label>Krajina<select name="krajina">${opt(F.KRAJINY_N, p.krajina)}</select></label>${fld('telefon', 'Telefón')}${fld('email', 'E-mail')}${fld('web_stranka', 'Webová stránka')}
      <label>Kategória<select name="kategoria">${opt(F.KATEGORIE_PARTNEROV, F.kategoriaPartnera(p))}</select></label>
      <label>Cenová hladina<select name="hladina">${opt(F.HLADINY, p.hladina)}</select></label><label>Úhrada<select name="uhrada">${opt({ '': '–', 'faktúra': 'faktúra', 'hotovosť': 'hotovosť', 'záloha': 'záloha' }, p.uhrada || '')}</select></label>
      <label>Splatnosť (dni)<input name="splatnost" inputmode="numeric" value="${e(p.splatnost || '')}"></label>${fld('obchodnik', 'Obchodník (kto sa stará)')}
      <label class="w">Štítky (oddeľte čiarkou)<input name="stitky" value="${e((p.stitky || []).join(', '))}" placeholder="napr. VIP, montáž, Východ"></label>
      <label class="chk w"><input type="checkbox" name="predajna" ${p.predajna ? 'checked' : ''}> má predajňu (cenník „s predajňou“)</label>
      <label class="w">Iné názvy (oddeľte bodkočiarkou)<input name="aliasy" value="${e((p.aliasy || []).join('; '))}"></label>
      <label class="w">Pobočky / miesta vykládky – jedna na riadok: názov; ulica; PSČ; mesto; krajina<textarea name="pobocky" rows="${Math.min(10, Math.max(2, (p.pobocky || []).length + 1))}" class="mono small">${e((p.pobocky || []).map(b => [b.nazov, b.ulica, b.psc, b.mesto, b.krajina].join('; ')).join('\n'))}</textarea></label>
      <label class="w">Poznámka<textarea name="poznamka" rows="2">${e(p.poznamka || '')}</textarea></label>
      <fieldset class="w web-acc"><legend>Prístup do kalkulačky na webe</legend>
        <label>Prihlasovacie meno<input name="web_login" value="${e(p.web?.login || F.loginZNazvu(p.nazov))}"></label>
        <label class="chk"><input type="checkbox" name="web_aktivny" ${p.web?.aktivny === false ? '' : 'checked'}> prístup povolený</label>
        <div class="w web-pw">${p.web?.hash ? `heslo nastavené ${p.web.vytvorene ? F.fmtD(p.web.vytvorene) : ''}` : 'zatiaľ bez prístupu'} <button type="button" class="btn sm ghost" id="genPw">${p.web?.hash ? 'Nové heslo' : 'Vytvoriť prístup'}</button><output id="pwOut"></output></div>
      </fieldset></form>`,
      [{ t: 'Uložiť', f: () => {
        const fd = new FormData($('#pf'));
        if (!fd.get('nazov').trim()) { toast('Zadajte obchodné meno', 'err'); return false; }
        ['nazov', 'ulica', 'psc', 'mesto', 'ico', 'dic', 'icdph', 'krajina', 'telefon', 'email', 'web_stranka', 'hladina', 'uhrada', 'poznamka', 'obchodnik', 'kategoria'].forEach(k => p[k] = (fd.get(k) || '').trim());
        p.splatnost = fd.get('splatnost') ? F.num(fd.get('splatnost')) : '';
        p.predajna = !!fd.get('predajna'); p.aliasy = fd.get('aliasy').split(';').map(s => s.trim()).filter(Boolean);
        p.stitky = [...new Set(fd.get('stitky').split(',').map(s => s.trim()).filter(Boolean))];
        p.pobocky = fd.get('pobocky').split('\n').map(l => l.split(';').map(s => s.trim())).filter(c => c[0]).map(([nazov, ulica, psc, mesto, krajina]) => ({ nazov, ulica: ulica || '', psc: psc || '', mesto: mesto || '', krajina: (krajina || p.krajina || 'SK').toUpperCase() }));
        const wl = (fd.get('web_login') || '').trim();
        if (p.web || noveHeslo) {
          if (wl && d.partneri.some(x => x !== p && x.web && x.web.login && x.web.login.toLowerCase() === wl.toLowerCase())) { toast('Login „' + wl + '“ už používa iný partner', 'err'); return false; }
          p.web = Object.assign(p.web || {}, { login: wl, aktivny: !!fd.get('web_aktivny') }, noveHeslo || {});
        }
        if (nov) { const r = F.importPartnerov([p]); if (!r.nove) { toast('Partner s týmto názvom/IČO už existuje – údaje boli doplnené k nemu', 'err'); } p = r.nove ? d.partneri[d.partneri.length - 1] : (d.partneri.find(x => (p.ico && x.ico === p.ico) || F.partnerNorm(x.nazov) === F.partnerNorm(p.nazov)) || p); if (r.nove) p.zalozeny = F.today(); }
        d.zakazky.filter(z => z.zakaznik.partnerId === p.id && F.stavIdx(z.stav) < F.stavIdx('expedovana')).forEach(z => F.priradPartnera(z, p));
        F.save(); toast('Partner uložený', 'ok');
        if (poUlozeni && !nov) poUlozeni(p, nov); else F.ui.go('#/partner/' + p.id);
      } }, ...(!nov ? [{ t: 'Zmazať partnera', cls: 'ghost neg', f: () => {
        const zz = d.zakazky.filter(z => z.zakaznik.partnerId === p.id);
        if (!confirm('Zmazať partnera ' + p.nazov + '?' + (zz.length ? `\n${zz.length} zákaziek ostane, len stratia prepojenie na partnera.` : ''))) return false;
        zz.forEach(z => { delete z.zakaznik.partnerId; }); d.partneri = d.partneri.filter(x => x !== p); F.save(); toast('Partner zmazaný', 'ok'); F.ui.go('#/partneri');
      } }] : [])]);
    const gb = $('#genPw');
    gb && gb.addEventListener('click', () => {
      const pw = F.noveHeslo(); noveHeslo = { hash: F.hashHesla(pw), vytvorene: new Date().toISOString() };
      $('#pwOut').innerHTML = `<div class="pw-box">Heslo: <b class="mono">${pw}</b> <button type="button" class="lnk" id="cpPw">kopírovať</button><br><small>Heslo sa zobrazí len teraz – pošlite ho partnerovi. Po uložení exportujte „Prístupy pre web“ a nahrajte na server.</small></div>`;
      $('#cpPw').onclick = () => { navigator.clipboard && navigator.clipboard.writeText(pw); toast('Skopírované', 'ok'); };
    });
  };

  /* =====================================================================
     ZOZNAM PARTNEROV
     ===================================================================== */
  const FILTRE = ['q', 'kat', 'kraj', 'hl', 'akt', 'stitok', 'web', 'ico', 'kontrola', 'otv', 'sort', 'dir'];
  F.vPartneri = q => {
    const { toast, commit } = F.ui, d = D();
    // spätná kompatibilita so starými odkazmi ?f=…
    const f0 = q.get('f'); if (f0 === 'hu') q.set('kraj', 'HU'); if (f0 === 'bezico') q.set('ico', 'bez'); if (f0 === 'zhoda') q.set('kontrola', '1'); if (f0 === 'obj') q.set('akt', 'objednal');
    const rows = d.partneri.map(p => ({ p, s: F.suhrnPartnera(p), kat: F.kategoriaPartnera(p) }));
    const pocet = fn => rows.filter(fn).length;
    const stitky = [...new Set(d.partneri.flatMap(p => p.stitky || []))].sort((a, b) => a.localeCompare(b, 'sk'));
    const krajiny = [...new Set(d.partneri.map(p => p.krajina || 'SK'))].sort();
    const th = (key, txt, cls = '') => `<th class="${cls} sortable" data-sort="${key}">${txt}<i></i></th>`;
    const katChip = k => `<span class="kchip" style="--c:${F.KAT_FARBA[k]}">${e(F.KATEGORIE_PARTNEROV[k].split(' / ')[0])}</span>`;
    const aktChip = a => `<span class="akt akt-${a}" title="${e(F.AKTIVITA[a])}"></span>`;

    app().innerHTML = `<div class="v-head"><div><h1>Obchodní partneri</h1><p class="muted">${d.partneri.length} partnerov · kliknite na riadok pre kartu partnera</p></div>
      <div class="v-act"><label class="btn ghost file">Importovať (JSON / CSV)<input type="file" id="pimp" accept=".json,.csv" hidden></label><button class="btn ghost" data-act="pexp">Exportovať</button><button class="btn ghost" data-act="pweb" title="partneri.csv pre server webu">Prístupy pre web (${d.partneri.filter(p => p.web && p.web.hash).length})</button><button class="btn" data-act="pnew">+ Nový partner</button></div></div>
      ${d.partneri.length ? `<section class="card filt no-print">
        <div class="f-druh">${['*', ...Object.keys(F.KATEGORIE_PARTNEROV)].map(k => { const n = k === '*' ? rows.length : pocet(r => r.kat === k); return n || k === '*' || k === '' ? `<button class="pill" data-kat="${k === '*' ? '' : k || '-'}">${k !== '*' ? `<i style="background:${F.KAT_FARBA[k]}"></i>` : ''}${k === '*' ? 'Všetci' : e(F.KATEGORIE_PARTNEROV[k].split(' / ')[0])} <small>${n}</small></button>` : ''; }).join('')}</div>
        <div class="f-row">
          <label class="f-q">Hľadať<input id="fq" type="search" placeholder="názov, mesto, IČO, pobočka, kontakt…"></label>
          <label>Krajina<select id="fkraj"><option value="">všetky</option>${krajiny.map(k => `<option value="${k}">${e(F.KRAJINY_N[k] || k)} (${pocet(r => (r.p.krajina || 'SK') === k)})</option>`).join('')}</select></label>
          <label>Aktivita<select id="fakt"><option value="">všetci</option><option value="objednal">s objednávkou</option>${opt(F.AKTIVITA)}</select></label>
          <label>Hladina<select id="fhl"><option value="">všetky</option>${opt(F.HLADINY)}</select></label>
          <label>Štítok<select id="fstitok"><option value="">všetky</option>${stitky.map(s => `<option>${e(s)}</option>`).join('')}</select></label>
          <label>Web prístup<select id="fweb"><option value="">všetci</option><option value="ano">má prístup</option><option value="nie">bez prístupu</option></select></label>
          <label>Zoradiť<select id="fsort"><option value="nazov">podľa názvu</option><option value="mesto">mesto</option><option value="obrat">obrat 2024</option><option value="zak">zákazky 2024</option><option value="dvere">dvere 2024</option><option value="posl">posledná objednávka</option><option value="sys">zákazky v systéme</option></select></label>
          <button class="btn ghost sm" id="fdir" title="smer zoradenia">↑</button>
        </div>
        <div class="f-row f-chk">
          <label class="chk-line"><input type="checkbox" id="fotv"> s otvorenou zákazkou <small>(${pocet(r => r.s.otv.length)})</small></label>
          <label class="chk-line"><input type="checkbox" id="fico" value="bez"> chýba IČO <small>(${pocet(r => !r.p.ico)})</small></label>
          <label class="chk-line"><input type="checkbox" id="fkontrola"> na kontrolu (možná zhoda) <small>(${pocet(r => /Možná zhoda/.test(r.p.poznamka || ''))})</small></label>
          <span class="grow"></span><span class="muted small" id="fcount"></span><button class="lnk" id="freset">zrušiť filtre</button>
        </div></section>
        <div class="bulk card no-print" id="bulk" hidden><b id="bulkN"></b>
          <label>Zaradiť do <select id="bkat"><option value="">– kategória –</option>${opt(F.KATEGORIE_PARTNEROV)}</select></label>
          <label>Pridať štítok <input id="bst" placeholder="štítok" list="stList"><datalist id="stList">${stitky.map(s => `<option>${e(s)}</option>`).join('')}</datalist></label>
          <button class="btn sm" data-act="bapply">Použiť</button><button class="btn sm ghost" data-act="bexp">Export CSV</button><button class="lnk" data-act="bnone">zrušiť výber</button></div>
        <section class="card tbl"><table class="t pt pz"><thead><tr><th class="chk"><input type="checkbox" id="ball" title="označiť zobrazené"></th>${th('nazov', 'Partner')}${th('mesto', 'Mesto')}<th>IČO</th><th>Hladina</th>${th('zak', 'Zákazky 2024', 'r')}${th('obrat', 'Obrat 2024', 'r')}${th('dvere', 'Dvere / zár.', 'r')}${th('posl', 'Posledná')}${th('sys', 'V systéme', 'r')}<th>Web</th></tr></thead><tbody>
        ${rows.map(({ p, s, kat }) => `<tr data-href="#/partner/${p.id}" data-id="${p.id}" data-kat="${kat}" data-kraj="${p.krajina || 'SK'}" data-hl="${p.hladina || ''}" data-akt="${s.aktivita}" data-obj="${s.posledna ? 1 : 0}" data-st="${e((p.stitky || []).join('|'))}" data-web="${p.web && p.web.hash ? 'ano' : 'nie'}" data-ico="${p.ico ? 'ano' : 'bez'}" data-kontrola="${/Možná zhoda/.test(p.poznamka || '') ? 1 : 0}" data-otv="${s.otv.length}"
            data-nazov="${e(p.nazov)}" data-mesto="${e(p.mesto || '')}" data-obrat="${s.obrat}" data-zak="${s.zakazky}" data-dvere="${s.dvere}" data-posl="${s.posledna || ''}" data-sys="${s.zak.length}"
            data-txt="${e(F.partnerNorm([p.nazov, ...(p.aliasy || []), p.mesto, p.ico, p.email, p.telefon, ...(p.stitky || []), ...(p.pobocky || []).map(b => b.nazov + ' ' + b.mesto), ...(p.kontakty || []).map(k => k.meno)].join(' ')))}">
          <td class="chk"><input type="checkbox" class="bsel"></td>
          <td>${aktChip(s.aktivita)}<a class="nm" href="#/partner/${p.id}"><b>${e(p.nazov)}</b></a> ${katChip(kat)}${(p.stitky || []).map(t => `<span class="stitok">${e(t)}</span>`).join('')}${(p.pobocky || []).length ? ` <span class="muted small">${p.pobocky.length} pobočiek</span>` : ''}${/Možná zhoda/.test(p.poznamka || '') ? '<br><small class="warnc">na kontrolu – možná zhoda</small>' : ''}</td>
          <td>${e(p.mesto || '')}${p.krajina && p.krajina !== 'SK' ? ` <span class="badge">${p.krajina}</span>` : ''}</td><td class="mono small">${e(p.ico || '')}${!p.ico ? '<span class="neg small">–</span>' : ''}</td>
          <td><span class="badge b2b">${F.HLADINY[p.hladina] || p.hladina || ''}</span></td><td class="r">${s.zakazky || ''}</td><td class="r">${s.obrat ? F.eur(s.obrat) : ''}</td><td class="r muted">${s.dvere || s.zarubne ? `${s.dvere} / ${s.zarubne}` : ''}</td>
          <td class="${s.aktivita === 'aktivny' ? '' : 'muted'}">${s.posledna ? F.fmtD(s.posledna) : ''}</td><td class="r">${s.zak.length ? `${s.zak.length}${s.otv.length ? ` <small class="ok">(${s.otv.length} otv.)</small>` : ''}` : ''}</td><td>${p.web && p.web.hash ? `<span class="badge ${p.web.aktivny === false ? '' : 'web'}">${e(p.web.login)}</span>` : ''}</td></tr>`).join('')}
        </tbody></table></section>` :
      `<section class="card empty-db"><h2>Databáza partnerov je prázdna</h2><p>Importujte súbor <b>partneri.json</b> (pripravený z evidencie, dodacích listov a zoznamu zákazníkov) alebo CSV so stĺpcami <span class="mono">nazov; ico; dic; icdph; ulica; psc; mesto; telefon; email; hladina</span>.</p><p class="muted">Databáza sa uloží len v tomto prehliadači – nie je súčasťou verejného webu.</p></section>`}`;

    $('#pimp').addEventListener('change', ev => {
      const fl2 = ev.target.files[0]; if (!fl2) return;
      fl2.text().then(t => { try { const data = /\.csv$/i.test(fl2.name) ? F.partneriZCsv(t) : JSON.parse(t); const r = F.importPartnerov(Array.isArray(data) ? data : data.partneri || []); commit(`Import: ${r.nove} nových, ${r.upd} aktualizovaných`); } catch (er) { toast('Súbor sa nepodarilo načítať', 'err'); } });
    });
    const vybrane = () => [...document.querySelectorAll('.bsel:checked')].map(c => c.closest('tr')).filter(tr => !tr.hidden).map(tr => F.partner(tr.dataset.id));
    const bulkUI = () => { const n = vybrane().length; $('#bulk').hidden = !n; $('#bulkN').textContent = `Vybraných ${n}`; };
    app().onclick = ev => {
      const b = ev.target.closest('[data-act]'); if (!b) return;
      const a = b.dataset.act;
      if (a === 'pnew') F.upravPartnera(null);
      if (a === 'pweb') { const n = d.partneri.filter(p => p.web && p.web.hash).length; if (!n) { toast('Žiadny partner zatiaľ nemá prístup – nastavte ho v karte partnera', 'err'); return; } F.stiahni('partneri.csv', F.webPristupyCsv(), 'text/csv;charset=utf-8'); toast(`Exportovaných ${n} prístupov – nahrajte súbor na server do priečinka _cennik`, 'ok'); }
      if (a === 'pexp') F.stiahni('partneri-' + F.today() + '.json', JSON.stringify(d.partneri, null, 1), 'application/json');
      if (a === 'bnone') { document.querySelectorAll('.bsel,#ball').forEach(c => c.checked = false); bulkUI(); }
      if (a === 'bapply') {
        const v = vybrane(), k = $('#bkat').value, s = $('#bst').value.trim();
        if (!k && !s) return toast('Vyberte kategóriu alebo napíšte štítok', 'err');
        v.forEach(p => { if (k) p.kategoria = k; if (s) p.stitky = [...new Set([...(p.stitky || []), s])]; });
        commit(`Upravených ${v.length} partnerov`);
      }
      if (a === 'bexp') F.stiahni('partneri-vyber-' + F.today() + '.csv', partneriCsv(vybrane()), 'text/csv;charset=utf-8');
    };
    if (!d.partneri.length) return;

    /* --- filtre a zoradenie v DOM --- */
    const st = {}; FILTRE.forEach(f => st[f] = q.get(f) || ''); if (!st.sort) st.sort = 'nazov';
    const sel = { q: '#fq', kraj: '#fkraj', akt: '#fakt', hl: '#fhl', stitok: '#fstitok', web: '#fweb', sort: '#fsort' }, chk = { otv: '#fotv', ico: '#fico', kontrola: '#fkontrola' };
    const tb = $('table.pz tbody'), all = [...tb.rows];
    const aplikuj = () => {
      const hl = F.partnerNorm(st.q), smer = st.dir === 'd' ? -1 : 1, tx = ['nazov', 'mesto', 'posl'].includes(st.sort);
      let n = 0;
      all.forEach(r => {
        const x = r.dataset;
        const ok = (!st.kat || x.kat === (st.kat === '-' ? '' : st.kat)) && (!hl || x.txt.includes(hl)) && (!st.kraj || x.kraj === st.kraj) && (!st.hl || x.hl === st.hl)
          && (!st.akt || (st.akt === 'objednal' ? x.obj === '1' : x.akt === st.akt)) && (!st.stitok || x.st.split('|').includes(st.stitok)) && (!st.web || x.web === st.web)
          && (!st.otv || +x.otv > 0) && (!st.ico || x.ico === 'bez') && (!st.kontrola || x.kontrola === '1');
        r.hidden = !ok; if (ok) n++;
      });
      all.sort((a, b) => { const x = a.dataset[st.sort], y = b.dataset[st.sort]; if (tx && (!x || !y) && x !== y) return x ? -1 : 1; return smer * (tx ? x.localeCompare(y, 'sk', { numeric: true }) : (+x - +y)) || a.dataset.nazov.localeCompare(b.dataset.nazov, 'sk'); }).forEach(r => tb.appendChild(r));
      document.querySelectorAll('.pill[data-kat]').forEach(b => b.classList.toggle('on', b.dataset.kat === st.kat));
      document.querySelectorAll('th[data-sort]').forEach(t => { t.classList.toggle('on', t.dataset.sort === st.sort); t.querySelector('i').textContent = t.dataset.sort === st.sort ? (smer > 0 ? ' ↑' : ' ↓') : ''; });
      $('#fcount').textContent = `zobrazených ${n} z ${all.length}`; $('#fdir').textContent = smer > 0 ? '↑' : '↓';
      const qs = new URLSearchParams(); FILTRE.forEach(f => { if (st[f] && !(f === 'sort' && st[f] === 'nazov')) qs.set(f, st[f]); });
      history.replaceState(null, '', '#/partneri' + (qs.toString() ? '?' + qs : ''));
      bulkUI();
    };
    Object.entries(sel).forEach(([f, s]) => { const el = $(s); el.value = st[f]; el.addEventListener('input', () => { st[f] = el.value; aplikuj(); }); });
    Object.entries(chk).forEach(([f, s]) => { const el = $(s); el.checked = !!st[f]; el.addEventListener('change', () => { st[f] = el.checked ? (el.value !== 'on' ? el.value : '1') : ''; aplikuj(); }); });
    document.querySelectorAll('.pill[data-kat]').forEach(b => b.addEventListener('click', () => { st.kat = b.dataset.kat; aplikuj(); }));
    $('#fdir').addEventListener('click', () => { st.dir = st.dir === 'd' ? '' : 'd'; aplikuj(); });
    $('#freset').addEventListener('click', () => { FILTRE.forEach(f => st[f] = ''); st.sort = 'nazov'; Object.entries(sel).forEach(([f, s]) => $(s).value = st[f]); Object.values(chk).forEach(s => $(s).checked = false); aplikuj(); });
    document.querySelectorAll('th[data-sort]').forEach(t => t.addEventListener('click', () => { if (st.sort === t.dataset.sort) st.dir = st.dir === 'd' ? '' : 'd'; else { st.sort = t.dataset.sort; st.dir = ['nazov', 'mesto'].includes(st.sort) ? '' : 'd'; } $('#fsort').value = st.sort; aplikuj(); }));
    $('#ball').addEventListener('change', ev => { all.filter(r => !r.hidden).forEach(r => r.querySelector('.bsel').checked = ev.target.checked); bulkUI(); });
    tb.addEventListener('change', ev => { if (ev.target.classList.contains('bsel')) bulkUI(); });
    aplikuj();
  };
  const partneriCsv = list => {
    const q = v => { const t = String(v == null ? '' : v); return /[;"\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
    const cols = ['id', 'nazov', 'kategoria', 'stitky', 'ulica', 'psc', 'mesto', 'krajina', 'ico', 'dic', 'icdph', 'telefon', 'email', 'hladina', 'obrat_2024', 'zakazky_2024', 'posledna'];
    return '﻿' + cols.join(';') + '\n' + list.map(p => { const s = F.suhrnPartnera(p); return [p.id, p.nazov, F.KATEGORIE_PARTNEROV[F.kategoriaPartnera(p)], (p.stitky || []).join(', '), p.ulica, p.psc, p.mesto, p.krajina, p.ico, p.dic, p.icdph, p.telefon, p.email, F.HLADINY[p.hladina] || p.hladina, s.obrat ? s.obrat.toFixed(2).replace('.', ',') : '', s.zakazky || '', s.posledna].map(q).join(';'); }).join('\n');
  };

  /* =====================================================================
     MAPA POBOČIEK (bez podkladovej mapy – body podľa súradníc, Košice ako orientačný bod)
     ===================================================================== */
  F.svgMapaPobociek = (body, o = {}) => {
    const dep = F.suradnice(F.N().depo || 'Košice');
    const pts = body.filter(b => b.xy);
    if (!pts.length) return '';
    const all = [...pts.map(b => b.xy), dep], W = o.w || 520, H = o.h || 300, pad = 26, padX = 70;
    const la0 = Math.min(...all.map(b => b[0])), la1 = Math.max(...all.map(b => b[0])), lo0 = Math.min(...all.map(b => b[1])), lo1 = Math.max(...all.map(b => b[1]));
    const kx = Math.cos((la0 + la1) / 2 * Math.PI / 180), sx = (lo1 - lo0) * kx || 1, sy = (la1 - la0) || 1, s = Math.min((W - 2 * padX) / sx, (H - 2 * pad) / sy);
    const X = b => padX + ((b[1] - lo0) * kx) * s + ((W - 2 * padX) - sx * s) / 2, Y = b => H - pad - (b[0] - la0) * s - ((H - 2 * pad) - sy * s) / 2;
    const mx = Math.max(1, ...pts.map(b => b.n || 0));
    let g = `<rect x="0" y="0" width="${W}" height="${H}" rx="8" fill="#F3F0E8"/>`;
    g += `<g><rect x="${X(dep) - 5}" y="${Y(dep) - 5}" width="10" height="10" fill="#1F1B16"/><text x="${X(dep) + 8}" y="${Y(dep) + 4}" class="t-ax b">${e(F.N().depo || 'Košice')} (sklad)</text></g>`;
    pts.forEach(b => { const r = 4 + 7 * Math.sqrt((b.n || 0) / mx); g += `<g><circle cx="${X(b.xy)}" cy="${Y(b.xy)}" r="${r}" fill="${b.n ? '#B08D57' : '#fff'}" stroke="#8B5A2B" stroke-width="1.2" opacity=".9"><title>${e(b.nazov)}${b.n ? ' – ' + b.n + ' zákaziek' : ''}</title></circle>${pts.length <= 14 ? `<text x="${X(b.xy) + r + 3}" y="${Y(b.xy) + 3}" class="t-ax">${e(b.kratko || b.nazov)}</text>` : ''}</g>`; });
    return `<svg class="v-graf" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Mapa pobočiek">${g}</svg>`;
  };

  /* =====================================================================
     KARTA PARTNERA
     ===================================================================== */
  F.vPartner = (id, q) => {
    const { toast } = F.ui, d = D(), p = F.partner(id);
    if (!p) { app().innerHTML = `<div class="v-head"><div><a class="back" href="#/partneri">← partneri</a><h1>Partner neexistuje</h1></div></div>`; return; }
    const s = F.suhrnPartnera(p), kat = F.kategoriaPartnera(p), zak = s.zak;
    const fmt = v => (+v || 0).toLocaleString('sk-SK', { maximumFractionDigits: 0 });
    const kpi = (lab, val, sub = '', cls = '') => `<div class="kpi ${cls}"><span>${lab}</span><b>${val}</b><small>${sub}</small></div>`;
    const zoz = d.partneri.slice().sort((a, b) => a.nazov.localeCompare(b.nazov, 'sk')), ix = zoz.indexOf(p), pred = zoz[ix - 1], dalsi = zoz[ix + 1];
    // pobočky + počet zákaziek doručených na pobočku
    const dodNa = F.groupBy(zak, z => F.partnerNorm((z.dodanie && (z.dodanie.nazov || z.dodanie.mesto)) || ''));
    const pob = (p.pobocky || []).map(b => ({ ...b, xy: F.suradnice(b.mesto), n: (dodNa[F.partnerNorm(b.nazov)] || []).length, kratko: b.mesto }));
    const sidlo = { nazov: p.nazov + ' – sídlo', mesto: p.mesto, xy: F.suradnice(p.mesto), n: zak.filter(z => !z.dodanie || F.partnerNorm(z.dodanie.nazov) === F.partnerNorm(p.nazov)).length, kratko: p.mesto };
    // čo kupuje (zo zákaziek v systéme)
    const mix = { kolekcia: {}, farba: {}, prevedenie: {}, sirka: {}, zarubna: {} };
    zak.forEach(z => (z.polozky || []).forEach(x => { const ks = +x.ks || 1; if (F.maKridlo(x)) { [['kolekcia', F.KOLEKCIE[x.kolekcia]?.nazov], ['farba', F.FARBY[x.farba]?.nazov], ['prevedenie', F.PREVEDENIA[x.prevedenie]], ['sirka', x.sirka]].forEach(([k, v]) => mix[k][v] = (mix[k][v] || 0) + ks); } if (F.maZarubnu(x)) { const t = F.zarubnaPreStenu(+x.stena).typ; mix.zarubna[t] = (mix.zarubna[t] || 0) + ks; } }));
    const mixBar = (tit, o) => { const en = Object.entries(o).sort((a, b) => b[1] - a[1]), t = F.sum(en, x => x[1]); return en.length ? `<div class="mix"><h4>${tit}</h4><div class="mixbar">${en.map(([k, v], i) => `<i style="flex:${v};background:${['#8B5A2B', '#B08D57', '#6E2620', '#5B6B7A', '#3F6B4F', '#BDB6A8'][i % 6]}" title="${e(k)}: ${v} ks"></i>`).join('')}</div><div class="mixlg">${en.map(([k, v], i) => `<span><i style="background:${['#8B5A2B', '#B08D57', '#6E2620', '#5B6B7A', '#3F6B4F', '#BDB6A8'][i % 6]}"></i>${e(k)} <b>${Math.round(100 * v / t)} %</b></span>`).join('')}</div></div>` : ''; };
    // krídla po mesiacoch (posledných 12)
    const mes = []; for (let i = 11; i >= 0; i--) { const t = new Date(); t.setDate(1); t.setMonth(t.getMonth() - i); mes.push({ k: t.toISOString().slice(0, 7), lab: ['jan', 'feb', 'mar', 'apr', 'máj', 'jún', 'júl', 'aug', 'sep', 'okt', 'nov', 'dec'][t.getMonth()], kr: 0, n: 0 }); }
    zak.forEach(z => { const m = mes.find(x => x.k === datumZ(z).slice(0, 7)); if (m) { m.kr += F.pocty(z).kr; m.n++; } });
    const mxKr = Math.max(1, ...mes.map(m => m.kr));
    const zaznamy = (p.zaznamy || []).slice().sort((a, b) => b.t.localeCompare(a.t));

    app().innerHTML = `<div class="v-head"><div><a class="back no-print" href="#/partneri">← partneri</a><h1>${e(p.nazov)}</h1>
        <p class="p-tags"><span class="kchip" style="--c:${F.KAT_FARBA[kat]}">${e(F.KATEGORIE_PARTNEROV[kat])}</span><span class="akt akt-${s.aktivita}"></span><span class="muted small">${e(F.AKTIVITA[s.aktivita])}</span>${(p.stitky || []).map(t => `<a class="stitok" href="#/partneri?stitok=${encodeURIComponent(t)}">${e(t)}</a>`).join('')}<span class="mono small muted">${p.id}</span></p></div>
      <div class="v-act no-print">${pred ? `<a class="btn ghost sm" href="#/partner/${pred.id}" title="${e(pred.nazov)}">‹</a>` : ''}${dalsi ? `<a class="btn ghost sm" href="#/partner/${dalsi.id}" title="${e(dalsi.nazov)}">›</a>` : ''}
        <button class="btn ghost" data-act="edit">Upraviť údaje</button><button class="btn ghost" onclick="print()">Tlačiť</button><a class="btn" href="#/nova?partner=${p.id}">+ Nová zákazka</a></div></div>

      <div class="kpis k6">
        ${kpi('Obrat 2024', s.obrat ? fmt(s.obrat) + ' <small>€</small>' : '–', 'bez DPH · z evidencie')}
        ${kpi('Zákazky 2024', s.zakazky || '–', s.zakazky && s.obrat ? 'priemer ' + F.eur(s.obrat / s.zakazky) : '')}
        ${kpi('Dvere / zárubne', s.dvere || s.zarubne ? `${fmt(s.dvere)} <small>/ ${fmt(s.zarubne)}</small>` : '–', '2024')}
        ${kpi('Posledná objednávka', s.posledna ? F.fmtD(s.posledna) : '–', s.posledna ? `pred ${Math.round(s.dni)} dňami` : 'zatiaľ nič', s.aktivita === 'neaktivny' ? 'warn' : '')}
        ${kpi('Zákazky v systéme', zak.length, s.otv.length ? `${s.otv.length} otvorených · ${s.sysKr} krídel` : `${s.sysKr} krídel`)}
        ${kpi('Hodnota v systéme', s.sysHodnota ? fmt(s.sysHodnota) + ' <small>€</small>' : '–', 'bez DPH')}
      </div>

      <div class="grid2">
        <section class="card"><h2>Firemné údaje</h2>
          <table class="t kvt"><tbody>
            <tr><th>Obchodné meno</th><td><b>${e(p.nazov)}</b></td></tr>
            <tr><th>Sídlo</th><td>${e(F.adresaPartnera(p) || '–')}${p.krajina && p.krajina !== 'SK' ? ` <span class="badge">${p.krajina}</span>` : ''}</td></tr>
            <tr><th>IČO / DIČ / IČ DPH</th><td class="mono">${e(p.ico || '–')} · ${e(p.dic || '–')} · ${e(p.icdph || '–')}</td></tr>
            <tr><th>Telefón</th><td>${p.telefon ? `<a href="tel:${e(p.telefon.replace(/\s/g, ''))}">${e(p.telefon)}</a>` : '–'}</td></tr>
            <tr><th>E-mail</th><td>${p.email ? `<a href="mailto:${e(p.email)}">${e(p.email)}</a>` : '–'}</td></tr>
            ${p.web_stranka ? `<tr><th>Web</th><td><a href="${e(/^https?:/.test(p.web_stranka) ? p.web_stranka : 'https://' + p.web_stranka)}" target="_blank" rel="noopener">${e(p.web_stranka)}</a></td></tr>` : ''}
            <tr><th>Cenová hladina</th><td><span class="badge b2b">${e(F.HLADINY[p.hladina] || p.hladina || '')}</span>${p.predajna ? ' · má predajňu' : ''}</td></tr>
            <tr><th>Úhrada / splatnosť</th><td>${e(p.uhrada || '–')}${p.splatnost ? ` · ${p.splatnost} dní` : ''}</td></tr>
            ${p.obchodnik ? `<tr><th>Obchodník</th><td>${e(p.obchodnik)}</td></tr>` : ''}
            ${(p.aliasy || []).length ? `<tr><th>Iné názvy</th><td class="small">${p.aliasy.slice(0, 12).map(e).join(' · ')}${p.aliasy.length > 12 ? ` <span class="muted">+${p.aliasy.length - 12}</span>` : ''}</td></tr>` : ''}
            <tr><th>Zdroj údajov</th><td class="muted small">${e((p.zdroje || []).join(', ') || 'zadané ručne')}</td></tr>
            ${p.poznamka ? `<tr><th>Poznámka</th><td class="${/Možná zhoda/.test(p.poznamka) ? 'warnc' : ''}">${e(p.poznamka)}</td></tr>` : ''}
          </tbody></table>
          <h3>Zaradenie <small class="muted">(zmena sa uloží hneď)</small></h3>
          <form class="kf" id="zarF">
            <label>Kategória<select name="kategoria">${opt(F.KATEGORIE_PARTNEROV, kat)}</select></label>
            <label>Cenová hladina<select name="hladina">${opt(F.HLADINY, p.hladina)}</select></label>
            <label class="w">Štítky (oddeľte čiarkou)<input name="stitky" value="${e((p.stitky || []).join(', '))}" placeholder="napr. VIP, montáž, Východ"></label>
          </form>
        </section>
        <section class="card"><div class="card-h"><h2>Kontaktné osoby</h2><button class="btn sm ghost no-print" data-act="kontakt">+ Pridať</button></div>
          ${(p.kontakty || []).length ? `<table class="t slim"><thead><tr><th>Meno</th><th>Funkcia</th><th>Telefón</th><th>E-mail</th><th></th></tr></thead><tbody>${p.kontakty.map((k, i) => `<tr><td><b>${e(k.meno)}</b>${k.hlavny ? ' <span class="badge web">hlavný</span>' : ''}</td><td>${e(k.funkcia || '')}</td><td>${k.telefon ? `<a href="tel:${e(k.telefon.replace(/\s/g, ''))}">${e(k.telefon)}</a>` : ''}</td><td>${k.email ? `<a href="mailto:${e(k.email)}">${e(k.email)}</a>` : ''}</td><td class="r nowrap no-print"><button class="lnk" data-act="kontakt" data-i="${i}">upraviť</button></td></tr>`).join('')}</tbody></table>` : '<p class="muted">Zatiaľ bez kontaktných osôb.</p>'}
          <h3 class="mt">Prístup do kalkulačky na webe</h3>
          ${p.web && p.web.hash ? `<p>Login <b class="mono">${e(p.web.login)}</b> · ${p.web.aktivny === false ? '<span class="neg">zablokovaný</span>' : '<span class="ok">aktívny</span>'} · heslo nastavené ${p.web.vytvorene ? F.fmtD(p.web.vytvorene) : ''}</p>` : '<p class="muted">Partner zatiaľ nemá prístup na web – vytvoríte ho v „Upraviť údaje“.</p>'}
          ${zak.filter(z => z.objednal && /web/.test(z.objednal.kanal)).length ? `<p class="small muted">Z webu prišlo ${zak.filter(z => z.objednal && /web/.test(z.objednal.kanal)).length} objednávok.</p>` : ''}
        </section>
      </div>

      ${pob.length || sidlo.xy ? `<section class="card"><div class="card-h"><h2>Pobočky a miesta vykládky <small class="muted">${pob.length}</small></h2></div>
        <div class="grid-prog"><div>${F.svgMapaPobociek(pob.length ? pob : [sidlo], { h: pob.length > 14 ? 360 : 280 })}${pob.some(b => !b.xy) ? `<p class="small warnc">${pob.filter(b => !b.xy).length} pobočiek nie je na mape (neznáme mesto).</p>` : ''}</div>
          <div class="pob-list">${pob.length ? `<table class="t slim"><thead><tr><th>Pobočka</th><th>Adresa</th><th class="r">Zák.</th></tr></thead><tbody>${pob.map(b => `<tr><td>${e(b.nazov)}</td><td class="small">${e([b.ulica, [b.psc, b.mesto].filter(Boolean).join(' ')].filter(Boolean).join(', '))} ${b.krajina && b.krajina !== 'SK' ? `<span class="badge">${b.krajina}</span>` : ''}</td><td class="r">${b.n || ''}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Partner nemá pobočky – vykladá sa v sídle. Pobočky pridáte v „Upraviť údaje“.</p>'}</div></div>
      </section>` : ''}

      <div class="grid2">
        <section class="card"><h2>Objednávky v systéme <small class="muted">krídla za posledných 12 mesiacov</small></h2>
          <div class="mbars">${mes.map(m => `<div title="${m.n} zákaziek, ${m.kr} krídel"><b>${m.kr || ''}</b><i style="height:${100 * m.kr / mxKr}%"></i><span>${m.lab}</span></div>`).join('')}</div>
          ${zak.length ? '' : '<p class="muted small">Zatiaľ žiadna zákazka v novom systéme – údaje za 2024 sú z evidencie.</p>'}</section>
        <section class="card"><h2>Čo partner kupuje</h2>${zak.length ? mixBar('Kolekcia', mix.kolekcia) + mixBar('Farba', mix.farba) + mixBar('Prevedenie', mix.prevedenie) + mixBar('Šírka', mix.sirka) + mixBar('Zárubne', mix.zarubna) : '<p class="muted">Rozpis sa zobrazí, keď budú v systéme zákazky partnera.</p>'}</section>
      </div>

      <section class="card"><div class="card-h"><h2>Zákazky <small class="muted">${zak.length}</small></h2><a class="btn sm ghost no-print" href="#/nova?partner=${p.id}">+ Nová zákazka</a></div>
        ${zak.length ? `<table class="t slim"><thead><tr><th>Zákazka</th><th>Dátum</th><th>Stav</th><th>Miesto vykládky</th><th class="r">Krídla / zár.</th><th class="r">Hmotnosť</th><th class="r">Hodnota bez DPH</th></tr></thead><tbody>${zak.map(z => { const pc = F.pocty(z), dd = F.dodanie ? F.dodanie(z) : {}, hm = F.hmotnostZakazky ? F.hmotnostZakazky(z) : null, h = F.hodnotaZakazky(z); return `<tr data-href="#/zakazka/${z.id}"><td><a href="#/zakazka/${z.id}">${z.id}</a>${z.objednal && /web/.test(z.objednal.kanal) ? ' <span class="badge web">web</span>' : ''}</td><td>${F.fmtD(datumZ(z))}</td><td>${F.chip(z.stav)}</td><td class="small">${e(dd.nazov && dd.nazov !== p.nazov ? dd.nazov : (dd.mesto || ''))}</td><td class="r">${pc.kr} / ${pc.zar}</td><td class="r muted">${hm && hm.brutto ? F.kg(hm.brutto) : ''}</td><td class="r">${h ? F.eur(h) : '–'}</td></tr>`; }).join('')}</tbody></table>` : '<p class="muted">Žiadne zákazky v systéme.</p>'}</section>

      <section class="card"><div class="card-h"><h2>Denník komunikácie <small class="muted">${zaznamy.length}</small></h2></div>
        <form id="zazF" class="zaz-f no-print"><select name="typ">${opt(F.TYPY_ZAZNAMU)}</select><input name="text" placeholder="čo sa dohodlo, reklamácia, požiadavka…" required><input name="kto" placeholder="kto" value="${e(p.obchodnik || '')}"><button class="btn sm">Zapísať</button></form>
        ${zaznamy.length ? `<ul class="zaz">${zaznamy.map(x => `<li><span class="zt">${F.fmtD(x.t)} ${x.t.slice(11, 16)}</span><span class="badge">${e(F.TYPY_ZAZNAMU[x.typ] || x.typ)}</span> ${e(x.text)}${x.kto ? ` <span class="muted small">– ${e(x.kto)}</span>` : ''} <button class="lnk no-print" data-act="zdel" data-t="${e(x.t)}">zmazať</button></li>`).join('')}</ul>` : '<p class="muted small">Sem si zapisujte telefonáty, dohody, reklamácie a požiadavky partnera.</p>'}
      </section>`;

    const prekresli = () => { const y = window.scrollY; F.vPartner(id, q); window.scrollTo(0, y); };
    $('#zarF').addEventListener('change', ev => {
      const n = ev.target.name;
      if (n === 'stitky') p.stitky = [...new Set(ev.target.value.split(',').map(x => x.trim()).filter(Boolean))];
      else p[n] = ev.target.value;
      if (n === 'hladina') d.zakazky.filter(z => z.zakaznik.partnerId === p.id && F.stavIdx(z.stav) < F.stavIdx('expedovana')).forEach(z => F.priradPartnera(z, p));
      F.save(); toast('Uložené', 'ok'); prekresli();
    });
    $('#zazF').addEventListener('submit', ev => {
      ev.preventDefault(); const fd = new FormData(ev.target); if (!fd.get('text').trim()) return;
      p.zaznamy = p.zaznamy || []; p.zaznamy.push({ t: new Date().toISOString(), typ: fd.get('typ'), text: fd.get('text').trim(), kto: fd.get('kto').trim() });
      F.save(); toast('Zapísané', 'ok'); prekresli();
    });
    app().onclick = ev => {
      const b = ev.target.closest('[data-act]'); if (!b) return;
      const a = b.dataset.act;
      if (a === 'edit') F.upravPartnera(p, () => prekresli());
      if (a === 'zdel') { if (!confirm('Zmazať záznam?')) return; p.zaznamy = (p.zaznamy || []).filter(x => x.t !== b.dataset.t); F.save(); prekresli(); }
      if (a === 'kontakt') {
        const i = b.dataset.i != null ? +b.dataset.i : -1, k = i >= 0 ? p.kontakty[i] : { meno: '', funkcia: '', telefon: '', email: '' };
        F.ui.modal(i >= 0 ? 'Kontaktná osoba' : 'Nová kontaktná osoba', `<form id="kf" class="kf"><label class="w">Meno a priezvisko<input name="meno" value="${e(k.meno)}" required></label><label>Funkcia<input name="funkcia" value="${e(k.funkcia || '')}" placeholder="konateľ, nákup, sklad…"></label><label>Telefón<input name="telefon" value="${e(k.telefon || '')}"></label><label class="w">E-mail<input name="email" value="${e(k.email || '')}"></label><label class="chk w"><input type="checkbox" name="hlavny" ${k.hlavny ? 'checked' : ''}> hlavný kontakt</label></form>`,
          [{ t: 'Uložiť', f: () => { const fd = new FormData($('#kf')); if (!fd.get('meno').trim()) return false; const n = { meno: fd.get('meno').trim(), funkcia: fd.get('funkcia').trim(), telefon: fd.get('telefon').trim(), email: fd.get('email').trim(), hlavny: !!fd.get('hlavny') };
            p.kontakty = p.kontakty || []; if (n.hlavny) p.kontakty.forEach(x => x.hlavny = false); if (i >= 0) p.kontakty[i] = n; else p.kontakty.push(n); F.save(); toast('Uložené', 'ok'); prekresli(); } },
          ...(i >= 0 ? [{ t: 'Odstrániť', cls: 'ghost neg', f: () => { p.kontakty.splice(i, 1); F.save(); prekresli(); } }] : [])]);
      }
    };
  };
})();
