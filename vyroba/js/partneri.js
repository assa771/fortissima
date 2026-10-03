/* =====================================================================
   PARTNERI – zoznam s kategóriami, filtrami a zoradením + karta partnera
   Štruktúra:  SKUPINA (holding, nefakturuje sa)  →  FIRMY (fakturujú sa)  →  POBOČKY / DODACIE ADRESY
     • pobočka / predajňa = objednáva sama (autonómne), má vlastnú adresu dodania
     • dodacia adresa     = len kam sa vykladá (stavba, sklad) – objednáva firma
   Štatistika sa sleduje za skupinu, za každú firmu aj za každú pobočku.
   ===================================================================== */
'use strict';
(function () {
  const e = F.esc, $ = s => document.querySelector(s), app = () => $('#view'), D = () => F.load();
  const DEN = 864e5;
  const opt = (obj, val) => Object.entries(obj).map(([k, v]) => `<option value="${e(k)}" ${String(k) === String(val ?? '') ? 'selected' : ''}>${e(v)}</option>`).join('');

  F.KATEGORIE_PARTNEROV = { predajca: 'Predajca / predajňa dverí', velkoobchod: 'Veľkoobchod / sieť', stavebna: 'Stavebná firma / developer', montaz: 'Montážna firma / stolár', architekt: 'Architekt / dizajnér', koncovy: 'Koncový zákazník', ine: 'Iné', '': 'Nezaradený' };
  F.KAT_FARBA = { predajca: '#B08D57', velkoobchod: '#6E2620', stavebna: '#5B6B7A', montaz: '#8B5A2B', architekt: '#7A5C8A', koncovy: '#3F6B4F', ine: '#8B8172', '': '#BDB6A8' };
  F.KRAJINY_N = { SK: 'Slovensko', CZ: 'Česko', HU: 'Maďarsko', AT: 'Rakúsko', PL: 'Poľsko' };
  F.AKTIVITA = { aktivny: 'Aktívny (do 12 mes.)', spiaci: 'Spiaci (12–24 mes.)', neaktivny: 'Neaktívny (nad 24 mes.)', nikdy: 'Zatiaľ bez objednávky' };
  F.TYPY_ZAZNAMU = { telefon: 'telefonát', email: 'e-mail', stretnutie: 'stretnutie', ponuka: 'cenová ponuka', reklamacia: 'reklamácia', ine: 'iné' };
  F.TYPY_PARTNERA = { firma: 'Firma (fakturuje sa)', skupina: 'Skupina / holding (nefakturuje sa)' };
  F.TYPY_POBOCKY = { predajna: 'Pobočka / predajňa – objednáva sama', dodacia: 'Dodacia adresa – len vykládka' };
  const POB_KRATKO = { predajna: 'pobočka', dodacia: 'dodacia adresa' };

  /* ---------- štruktúra ---------- */
  F.kategoriaPartnera = p => p.kategoria != null && p.kategoria !== 'auto' ? p.kategoria : (p.predajna ? 'predajca' : '');
  F.jeSkupina = p => !!p && p.typ === 'skupina';
  F.skupinaPartnera = p => (p && p.skupina && F.partner(p.skupina)) || null;
  F.clenoviaSkupiny = p => D().partneri.filter(x => x.skupina === p.id).sort((a, b) => a.nazov.localeCompare(b.nazov, 'sk'));
  F.firmySkupiny = p => F.jeSkupina(p) ? [p, ...F.clenoviaSkupiny(p)] : [p];
  /** Pobočky partnera – doplní stabilné ID a typ (staré záznamy boli bez nich) */
  F.pobockyP = p => {
    const L = p.pobocky = p.pobocky || [];
    L.forEach(b => {
      if (!b.typ) b.typ = 'predajna';
      if (!b.id) { let n = 1; const id = () => `${p.id}-B${String(n).padStart(2, '0')}`; while (D().partneri.some(x => (x.pobocky || []).some(y => y.id === id()))) n++; b.id = id(); }
    });
    return L;
  };
  F.vsetkyPobocky = p => F.firmySkupiny(p).flatMap(f => F.pobockyP(f).map(b => ({ b, firma: f })));
  F.najdiPobocku = id => { if (!id) return null; for (const f of D().partneri) { const b = (f.pobocky || []).find(x => x.id === id); if (b) return { b, firma: f }; } return null; };
  /** Objednávajúca pobočka zákazky (podľa ID, staršie zákazky podľa názvu miesta vykládky) */
  F.pobockaZakazky = z => {
    const r = F.najdiPobocku(z.zakaznik.pobockaId) || F.najdiPobocku(z.dodanie && z.dodanie.pobockaId);
    if (r) return r;
    const p = z.zakaznik.partnerId && F.partner(z.zakaznik.partnerId), n = z.dodanie && F.partnerNorm(z.dodanie.pobocka || z.dodanie.nazov);
    if (!p || !n) return null;
    for (const x of F.vsetkyPobocky(F.skupinaPartnera(p) || p)) if (F.partnerNorm(x.b.nazov) === n) return x;
    return null;
  };
  /** Na koho sa fakturuje zákazka objednaná pobočkou: vlastné údaje pobočky, inak firma */
  F.fakturaciaPobocky = (b, firma) => b && b.fakturacia && b.fakturacia.nazov ? Object.assign({ krajina: b.krajina || firma.krajina || 'SK' }, b.fakturacia, { vlastna: true }) :
    { nazov: firma.nazov, ulica: firma.ulica || '', psc: firma.psc || '', mesto: firma.mesto || '', krajina: firma.krajina || 'SK', ico: firma.ico || '', dic: firma.dic || '', icdph: firma.icdph || '', email: firma.email || '', vlastna: false };
  /** Prepíše odberateľa zákazky fakturačnými údajmi objednávajúcej pobočky (ak ich má) */
  F.aplikujFakturaciu = z => {
    const r = F.najdiPobocku(z.zakaznik.pobockaId);
    if (!r || !r.b.fakturacia || !r.b.fakturacia.nazov) { delete z.zakaznik.fakturaPobocky; return; }
    const f = r.b.fakturacia;
    Object.assign(z.zakaznik, { nazov: f.nazov, adresa: [f.ulica, [f.psc, f.mesto].filter(Boolean).join(' ')].filter(Boolean).join(', ') + (f.krajina && f.krajina !== 'SK' ? ', ' + (F.KRAJINY_N[f.krajina] || f.krajina) : ''),
      ico: f.ico || '', dic: f.dic || '', icdph: f.icdph || '', email: f.email || z.zakaznik.email || '', fakturaPobocky: r.b.id });
  };
  // každé priradenie partnera k zákazke rešpektuje fakturačné údaje pobočky
  const povodnePrirad = F.priradPartnera;
  F.priradPartnera = (z, p) => {
    povodnePrirad(z, p);
    const r = F.najdiPobocku(z.zakaznik.pobockaId);
    if (r && r.firma !== p && !F.jeSkupina(r.firma) && (F.skupinaPartnera(p) || p) !== (F.skupinaPartnera(r.firma) || r.firma)) { z.zakaznik.pobockaId = ''; z.zakaznik.pobockaNazov = ''; }
    F.aplikujFakturaciu(z);
  };
  /** Zákazky partnera; pri skupine aj zákazky všetkých firiem skupiny */
  F.zakazkyPartnera = p => { const ids = new Set(F.firmySkupiny(p).map(f => f.id)); return D().zakazky.filter(z => ids.has(z.zakaznik.partnerId)).sort((a, b) => (b.vytvorena || '').localeCompare(a.vytvorena || '')); };
  const datumZ = z => (z.datumy && (z.datumy.potvrdena || z.datumy.dopyt)) || (z.vytvorena || '').slice(0, 10);
  F.datumZakazky = datumZ;
  F.hodnotaZakazky = z => z.spolu_bez_dph != null ? +z.spolu_bez_dph : F.sum(F.riadkyFaktury(z), r => (+r.mn || 0) * (+r.cena || 0));
  /** Súhrn zo zákaziek v systéme */
  F.suhrnZakaziek = zak => {
    const posledna = zak.length ? zak.map(datumZ).sort().pop() : '';
    const dni = posledna ? (Date.now() - Date.parse(posledna + 'T12:00:00')) / DEN : Infinity;
    const od12 = F.addDays(F.today(), -365), z12 = zak.filter(z => datumZ(z) >= od12);
    return { zak, otv: zak.filter(z => F.stavIdx(z.stav) < F.stavIdx('expedovana')), posledna, dni, aktivita: !posledna ? 'nikdy' : dni <= 365 ? 'aktivny' : dni <= 730 ? 'spiaci' : 'neaktivny',
      kr: F.sum(zak, z => F.pocty(z).kr), zar: F.sum(zak, z => F.pocty(z).zar), kr12: F.sum(z12, z => F.pocty(z).kr), hodnota: F.sum(zak, F.hodnotaZakazky), hodnota12: F.sum(z12, F.hodnotaZakazky), z12: z12.length };
  };
  F.suhrnPartnera = p => F.suhrnZakaziek(F.zakazkyPartnera(p));

  /* =====================================================================
     ÚPRAVA ÚDAJOV PARTNERA (modálne okno)
     ===================================================================== */
  F.upravPartnera = (p, poUlozeni, preset) => {
    const { modal, toast } = F.ui, d = D();
    let noveHeslo = null;
    const nov = !p; p = p || Object.assign({ nazov: '', hladina: 'voc', krajina: 'SK', aliasy: [], typ: 'firma' }, preset || {});
    const fld = (k, l, w) => `<label class="${w ? 'w' : ''}">${l}<input name="${k}" value="${e(p[k] || '')}"></label>`;
    const skupiny = Object.fromEntries([['', '– samostatná firma –'], ...d.partneri.filter(x => F.jeSkupina(x) && x !== p).map(x => [x.id, x.nazov])]);
    modal(nov ? (preset && preset.skupina ? 'Nová firma v skupine ' + e(F.partner(preset.skupina).nazov) : 'Nový partner') : e(p.nazov), `<form id="pf" class="kf">${fld('nazov', 'Obchodné meno', 1)}
      <label>Typ<select name="typ">${opt(F.TYPY_PARTNERA, p.typ || 'firma')}</select></label>
      <label data-firma>Patrí do skupiny<select name="skupina">${opt(skupiny, p.skupina || '')}</select></label>
      ${fld('ulica', 'Ulica (fakturačná adresa)', 1)}${fld('psc', 'PSČ')}${fld('mesto', 'Mesto')}${fld('ico', 'IČO')}${fld('dic', 'DIČ')}${fld('icdph', 'IČ DPH')}
      <label>Krajina<select name="krajina">${opt(F.KRAJINY_N, p.krajina)}</select></label>${fld('telefon', 'Telefón')}${fld('email', 'E-mail')}${fld('web_stranka', 'Webová stránka')}
      <label>Kategória<select name="kategoria">${opt(F.KATEGORIE_PARTNEROV, F.kategoriaPartnera(p))}</select></label>
      <label>Cenová hladina<select name="hladina">${opt(F.HLADINY, p.hladina)}</select></label><label>Úhrada<select name="uhrada">${opt({ '': '–', 'faktúra': 'faktúra', 'hotovosť': 'hotovosť', 'záloha': 'záloha' }, p.uhrada || '')}</select></label>
      <label>Splatnosť (dni)<input name="splatnost" inputmode="numeric" value="${e(p.splatnost || '')}"></label>${fld('obchodnik', 'Obchodník (kto sa stará)')}
      <label class="w">Štítky (oddeľte čiarkou)<input name="stitky" value="${e((p.stitky || []).join(', '))}" placeholder="napr. VIP, montáž, Východ"></label>
      <label class="chk w"><input type="checkbox" name="predajna" ${p.predajna ? 'checked' : ''}> má predajňu (cenník „s predajňou“)</label>
      <label class="w">Iné názvy (oddeľte bodkočiarkou) – podľa nich sa partner nájde v objednávkach<input name="aliasy" value="${e((p.aliasy || []).join('; '))}"></label>
      <label class="w">Poznámka<textarea name="poznamka" rows="2">${e(p.poznamka || '')}</textarea></label>
      <p class="w muted small">Pobočky a dodacie adresy spravujete priamo na karte partnera.</p>
      <fieldset class="w web-acc"><legend>Prístup do kalkulačky na webe</legend>
        <label>Prihlasovacie meno<input name="web_login" value="${e(p.web?.login || F.loginZNazvu(p.nazov))}"></label>
        <label class="chk"><input type="checkbox" name="web_aktivny" ${p.web?.aktivny === false ? '' : 'checked'}> prístup povolený</label>
        <div class="w web-pw">${p.web?.hash ? `heslo nastavené ${p.web.vytvorene ? F.fmtD(p.web.vytvorene) : ''}` : 'zatiaľ bez prístupu'} <button type="button" class="btn sm ghost" id="genPw">${p.web?.hash ? 'Nové heslo' : 'Vytvoriť prístup'}</button><output id="pwOut"></output></div>
      </fieldset></form>`,
      [{ t: 'Uložiť', f: () => {
        const fd = new FormData($('#pf'));
        if (!fd.get('nazov').trim()) { toast('Zadajte obchodné meno', 'err'); return false; }
        if (fd.get('typ') !== 'skupina' && !nov && F.jeSkupina(p) && F.clenoviaSkupiny(p).length) { toast('Skupina má firmy – najprv ich zo skupiny vyraďte', 'err'); return false; }
        ['nazov', 'ulica', 'psc', 'mesto', 'ico', 'dic', 'icdph', 'krajina', 'telefon', 'email', 'web_stranka', 'hladina', 'uhrada', 'poznamka', 'obchodnik', 'kategoria', 'typ'].forEach(k => p[k] = (fd.get(k) || '').trim());
        p.skupina = p.typ === 'skupina' ? '' : (fd.get('skupina') || '');
        p.splatnost = fd.get('splatnost') ? F.num(fd.get('splatnost')) : '';
        p.predajna = !!fd.get('predajna'); p.aliasy = fd.get('aliasy').split(';').map(s => s.trim()).filter(Boolean);
        p.stitky = [...new Set(fd.get('stitky').split(',').map(s => s.trim()).filter(Boolean))];
        const wl = (fd.get('web_login') || '').trim();
        if (p.web || noveHeslo) {
          if (wl && d.partneri.some(x => x !== p && x.web && x.web.login && x.web.login.toLowerCase() === wl.toLowerCase())) { toast('Login „' + wl + '“ už používa iný partner', 'err'); return false; }
          p.web = Object.assign(p.web || {}, { login: wl, aktivny: !!fd.get('web_aktivny') }, noveHeslo || {});
        }
        if (nov) {
          const r = F.importPartnerov([p]);
          if (!r.nove) toast('Partner s týmto názvom/IČO už existuje – údaje boli doplnené k nemu', 'err');
          p = r.nove ? d.partneri[d.partneri.length - 1] : (d.partneri.find(x => (p.ico && x.ico === p.ico) || F.partnerNorm(x.nazov) === F.partnerNorm(p.nazov)) || p);
          if (r.nove) p.zalozeny = F.today();
        }
        d.zakazky.filter(z => z.zakaznik.partnerId === p.id && F.stavIdx(z.stav) < F.stavIdx('expedovana')).forEach(z => { const pb = z.zakaznik.pobockaId; F.priradPartnera(z, p); if (pb) z.zakaznik.pobockaId = pb; });
        F.save(); toast('Partner uložený', 'ok');
        if (poUlozeni && !nov) poUlozeni(p, nov); else F.ui.go('#/partner/' + p.id);
      } }, ...(!nov ? [{ t: 'Zmazať partnera', cls: 'ghost neg', f: () => {
        const zz = d.zakazky.filter(z => z.zakaznik.partnerId === p.id), cl = F.clenoviaSkupiny(p);
        if (!confirm('Zmazať partnera ' + p.nazov + '?' + (zz.length ? `\n${zz.length} zákaziek ostane, len stratia prepojenie na partnera.` : '') + (cl.length ? `\n${cl.length} firiem skupiny sa stane samostatnými.` : ''))) return false;
        zz.forEach(z => { delete z.zakaznik.partnerId; }); cl.forEach(x => x.skupina = ''); d.partneri = d.partneri.filter(x => x !== p); F.save(); toast('Partner zmazaný', 'ok'); F.ui.go('#/partneri');
      } }] : [])]);
    const pf = $('#pf'), sync = () => { pf.querySelector('[data-firma]').hidden = pf.typ.value === 'skupina'; };
    pf.typ.addEventListener('change', sync); sync();
    const gb = $('#genPw');
    gb && gb.addEventListener('click', () => {
      const pw = F.noveHeslo(); noveHeslo = { hash: F.hashHesla(pw), vytvorene: new Date().toISOString() };
      $('#pwOut').innerHTML = `<div class="pw-box">Heslo: <b class="mono">${pw}</b> <button type="button" class="lnk" id="cpPw">kopírovať</button><br><small>Heslo sa zobrazí len teraz – pošlite ho partnerovi. Po uložení exportujte „Prístupy pre web“ a nahrajte na server.</small></div>`;
      $('#cpPw').onclick = () => { navigator.clipboard && navigator.clipboard.writeText(pw); toast('Skopírované', 'ok'); };
    });
  };

  /** Úprava / nová pobočka alebo dodacia adresa */
  F.upravPobocku = (vlastnik, b, typ, poUlozeni) => {
    const nova = !b, grp = F.skupinaPartnera(vlastnik) || vlastnik, firmy = F.firmySkupiny(grp);
    b = b || { nazov: '', typ: typ || 'predajna', ulica: '', psc: '', mesto: '', krajina: vlastnik.krajina || 'SK', aktivna: true };
    const fld = (k, l, w) => `<label class="${w ? 'w' : ''}">${l}<input name="${k}" value="${e(b[k] || '')}"></label>`;
    F.ui.modal(nova ? (b.typ === 'dodacia' ? 'Nová dodacia adresa' : 'Nová pobočka / predajňa') : e(b.nazov), `<form id="bf" class="kf">
      ${fld('nazov', 'Názov (ako ho používa partner)', 1)}
      <label class="w">Typ<select name="typ">${opt(F.TYPY_POBOCKY, b.typ)}</select></label>
      ${firmy.length > 1 ? `<label class="w">Patrí firme (fakturuje sa na ňu)<select name="firma">${firmy.map(f => `<option value="${f.id}" ${f === vlastnik ? 'selected' : ''}>${e(f.nazov)}${F.jeSkupina(f) ? ' (skupina – zatiaľ nepriradené)' : ''}</option>`).join('')}</select></label>` : ''}
      ${fld('ulica', 'Ulica', 1)}${fld('psc', 'PSČ')}${fld('mesto', 'Mesto')}<label>Krajina<select name="krajina">${opt(F.KRAJINY_N, b.krajina)}</select></label>
      ${fld('kontakt', 'Kontaktná osoba')}${fld('telefon', 'Telefón')}${fld('email', 'E-mail')}
      <label class="w">Poznámka pre vodiča / vykládku<input name="pozn" value="${e(b.pozn || '')}" placeholder="napr. vykládka len do 14:00, rampa vzadu"></label>
      <fieldset class="w fakt" data-pred><legend>Fakturácia zákaziek tejto pobočky</legend>
        <label class="w">Fakturuje sa na<select name="fak">${opt({ firma: 'firmu, ktorej pobočka patrí', vlastna: 'vlastné fakturačné údaje pobočky' }, b.fakturacia && b.fakturacia.nazov ? 'vlastna' : 'firma')}</select></label>
        <div class="w fak-f kf">
          <label class="w">Obchodné meno<input name="f_nazov" value="${e((b.fakturacia || {}).nazov || '')}"></label>
          <label class="w">Ulica<input name="f_ulica" value="${e((b.fakturacia || {}).ulica || '')}"></label>
          <label>PSČ<input name="f_psc" value="${e((b.fakturacia || {}).psc || '')}"></label><label>Mesto<input name="f_mesto" value="${e((b.fakturacia || {}).mesto || '')}"></label>
          <label>Krajina<select name="f_krajina">${opt(F.KRAJINY_N, (b.fakturacia || {}).krajina || b.krajina || vlastnik.krajina || 'SK')}</select></label><label>IČO<input name="f_ico" value="${e((b.fakturacia || {}).ico || '')}"></label>
          <label>DIČ<input name="f_dic" value="${e((b.fakturacia || {}).dic || '')}"></label><label>IČ DPH<input name="f_icdph" value="${e((b.fakturacia || {}).icdph || '')}"></label>
          <label class="w">E-mail pre faktúry<input name="f_email" value="${e((b.fakturacia || {}).email || '')}"></label>
          <p class="w"><button type="button" class="btn sm ghost" id="fakCopy">skopírovať údaje firmy</button> <button type="button" class="btn sm ghost" id="fakAdr">adresa = adresa pobočky</button></p>
        </div>
        <p class="w muted small fak-info"></p>
      </fieldset>
      <label class="chk w"><input type="checkbox" name="aktivna" ${b.aktivna === false ? '' : 'checked'}> aktívna</label></form>`,
      [{ t: 'Uložiť', f: () => {
        const fd = new FormData($('#bf')); if (!fd.get('nazov').trim()) { F.ui.toast('Zadajte názov', 'err'); return false; }
        ['nazov', 'typ', 'ulica', 'psc', 'mesto', 'krajina', 'kontakt', 'telefon', 'email', 'pozn'].forEach(k => b[k] = (fd.get(k) || '').trim());
        b.aktivna = !!fd.get('aktivna');
        if (b.typ === 'predajna' && fd.get('fak') === 'vlastna') {
          if (!fd.get('f_nazov').trim()) { F.ui.toast('Zadajte obchodné meno pre fakturáciu', 'err'); return false; }
          b.fakturacia = Object.fromEntries(['nazov', 'ulica', 'psc', 'mesto', 'krajina', 'ico', 'dic', 'icdph', 'email'].map(k => [k, (fd.get('f_' + k) || '').trim()]));
        } else delete b.fakturacia;
        // otvorené zákazky pobočky dostanú aktuálne fakturačné údaje
        D().zakazky.filter(z => z.zakaznik.pobockaId === b.id && F.stavIdx(z.stav) < F.stavIdx('expedovana')).forEach(z => { const f = F.partner(z.zakaznik.partnerId); if (f) F.priradPartnera(z, f); });
        const ciel = (fd.get('firma') && F.partner(fd.get('firma'))) || vlastnik;
        if (nova) { F.pobockyP(ciel).push(b); F.pobockyP(ciel); }
        else if (ciel !== vlastnik) { vlastnik.pobocky = vlastnik.pobocky.filter(x => x !== b); F.pobockyP(ciel).push(b); }
        F.save(); F.ui.toast('Uložené', 'ok'); poUlozeni && poUlozeni();
      } }, ...(!nova ? [{ t: 'Odstrániť', cls: 'ghost neg', f: () => {
        const n = D().zakazky.filter(z => z.zakaznik.pobockaId === b.id || (z.dodanie && z.dodanie.pobockaId === b.id)).length;
        if (!confirm(`Odstrániť ${POB_KRATKO[b.typ]} „${b.nazov}“?${n ? `\n${n} zákaziek si ponechá adresu, stratí len prepojenie.` : ''}`)) return false;
        vlastnik.pobocky = vlastnik.pobocky.filter(x => x !== b); F.save(); poUlozeni && poUlozeni();
      } }] : [])]);
    const bf = $('#bf'), firmaVyb = () => (bf.firma && F.partner(bf.firma.value)) || vlastnik;
    const sync = () => {
      bf.querySelector('[data-pred]').hidden = bf.typ.value !== 'predajna';
      const vl = bf.fak.value === 'vlastna'; bf.querySelector('.fak-f').hidden = !vl;
      const f = firmaVyb();
      bf.querySelector('.fak-info').innerHTML = vl ? 'Zákazky tejto pobočky sa fakturujú na údaje vyššie (dodací list aj CSV pre MRP). Cenová hladina a štatistika ostávajú pri firme.' : `Faktúra ide na <b>${e(f.nazov)}</b>${f.ico ? ', IČO ' + e(f.ico) : ''}${F.jeSkupina(f) ? ' – <span class="warnc">pobočka ešte nie je priradená firme</span>' : ''}.`;
    };
    bf.addEventListener('change', sync); sync();
    $('#fakCopy').onclick = () => { const f = firmaVyb(); [['nazov', f.nazov], ['ulica', f.ulica], ['psc', f.psc], ['mesto', f.mesto], ['ico', f.ico], ['dic', f.dic], ['icdph', f.icdph], ['email', f.email]].forEach(([k, v]) => bf['f_' + k].value = v || ''); bf.f_krajina.value = f.krajina || 'SK'; };
    $('#fakAdr').onclick = () => { ['ulica', 'psc', 'mesto'].forEach(k => bf['f_' + k].value = bf[k].value); bf.f_krajina.value = bf.krajina.value; };
  };

  /* =====================================================================
     ZOZNAM PARTNEROV
     ===================================================================== */
  const FILTRE = ['q', 'kat', 'kraj', 'hl', 'akt', 'stitok', 'web', 'str', 'ico', 'kontrola', 'otv', 'sort', 'dir'];
  F.vPartneri = q => {
    const { toast, commit } = F.ui, d = D();
    const f0 = q.get('f'); if (f0 === 'hu') q.set('kraj', 'HU'); if (f0 === 'bezico') q.set('ico', 'bez'); if (f0 === 'zhoda') q.set('kontrola', '1');
    d.partneri.forEach(F.pobockyP);
    const rows = d.partneri.map(p => {
      const s = F.suhrnPartnera(p), grp = F.skupinaPartnera(p), pob = p.pobocky || [];
      const str = F.jeSkupina(p) ? 'skupina' : grp ? 'clen' : pob.some(b => b.typ === 'predajna') ? 'pobocky' : pob.length ? 'dodacie' : 'jedna';
      return { p, s, grp, kat: F.kategoriaPartnera(p), str, nPred: pob.filter(b => b.typ === 'predajna').length, nDod: pob.filter(b => b.typ === 'dodacia').length };
    });
    const pocet = fn => rows.filter(fn).length;
    const stitky = [...new Set(d.partneri.flatMap(p => p.stitky || []))].sort((a, b) => a.localeCompare(b, 'sk'));
    const krajiny = [...new Set(d.partneri.map(p => p.krajina || 'SK'))].sort();
    const th = (key, txt, cls = '') => `<th class="${cls} sortable" data-sort="${key}">${txt}<i></i></th>`;
    const katChip = k => `<span class="kchip" style="--c:${F.KAT_FARBA[k]}">${e(F.KATEGORIE_PARTNEROV[k].split(' / ')[0])}</span>`;
    const STR = { skupina: 'skupiny (holdingy)', clen: 'firmy v skupine', pobocky: 's pobočkami', dodacie: 's dodacími adresami', jedna: 'jedna adresa' };

    app().innerHTML = `<div class="v-head"><div><h1>Obchodní partneri</h1><p class="muted">${d.partneri.length} partnerov · štatistika zo zákaziek v systéme · kliknite na riadok pre kartu partnera</p></div>
      <div class="v-act"><label class="btn ghost file">Importovať (JSON / CSV)<input type="file" id="pimp" accept=".json,.csv" hidden></label><button class="btn ghost" data-act="pexp">Exportovať</button><button class="btn ghost" data-act="pweb" title="partneri.csv pre server webu">Prístupy pre web (${d.partneri.filter(p => p.web && p.web.hash).length})</button><button class="btn" data-act="pnew">+ Nový partner</button></div></div>
      ${d.partneri.length ? `<section class="card filt no-print">
        <div class="f-druh">${['*', ...Object.keys(F.KATEGORIE_PARTNEROV)].map(k => { const n = k === '*' ? rows.length : pocet(r => r.kat === k); return n || k === '*' || k === '' ? `<button class="pill" data-kat="${k === '*' ? '' : k || '-'}">${k !== '*' ? `<i style="background:${F.KAT_FARBA[k]}"></i>` : ''}${k === '*' ? 'Všetci' : e(F.KATEGORIE_PARTNEROV[k].split(' / ')[0])} <small>${n}</small></button>` : ''; }).join('')}</div>
        <div class="f-row">
          <label class="f-q">Hľadať<input id="fq" type="search" placeholder="názov, mesto, IČO, pobočka, kontakt…"></label>
          <label>Štruktúra<select id="fstr"><option value="">všetci</option>${Object.entries(STR).map(([k, v]) => `<option value="${k}">${v} (${pocet(r => r.str === k)})</option>`).join('')}</select></label>
          <label>Krajina<select id="fkraj"><option value="">všetky</option>${krajiny.map(k => `<option value="${k}">${e(F.KRAJINY_N[k] || k)} (${pocet(r => (r.p.krajina || 'SK') === k)})</option>`).join('')}</select></label>
          <label>Aktivita<select id="fakt"><option value="">všetci</option>${opt(F.AKTIVITA)}</select></label>
          <label>Hladina<select id="fhl"><option value="">všetky</option>${opt(F.HLADINY)}</select></label>
          <label>Štítok<select id="fstitok"><option value="">všetky</option>${stitky.map(s => `<option>${e(s)}</option>`).join('')}</select></label>
          <label>Web prístup<select id="fweb"><option value="">všetci</option><option value="ano">má prístup</option><option value="nie">bez prístupu</option></select></label>
          <label>Zoradiť<select id="fsort"><option value="nazov">podľa názvu</option><option value="mesto">mesto</option><option value="zak">zákazky</option><option value="kr12">krídla 12 mes.</option><option value="hod">hodnota</option><option value="posl">posledná objednávka</option><option value="pob">počet pobočiek</option></select></label>
          <button class="btn ghost sm" id="fdir" title="smer zoradenia">↑</button>
        </div>
        <div class="f-row f-chk">
          <label class="chk-line"><input type="checkbox" id="fotv"> s otvorenou zákazkou <small>(${pocet(r => r.s.otv.length)})</small></label>
          <label class="chk-line"><input type="checkbox" id="fico" value="bez"> chýba IČO <small>(${pocet(r => !r.p.ico && !F.jeSkupina(r.p))})</small></label>
          <label class="chk-line"><input type="checkbox" id="fkontrola"> na kontrolu (možná zhoda) <small>(${pocet(r => /Možná zhoda/.test(r.p.poznamka || ''))})</small></label>
          <span class="grow"></span><span class="muted small" id="fcount"></span><button class="lnk" id="freset">zrušiť filtre</button>
        </div></section>
        <div class="bulk card no-print" id="bulk" hidden><b id="bulkN"></b>
          <label>Zaradiť do <select id="bkat"><option value="">– kategória –</option>${opt(F.KATEGORIE_PARTNEROV)}</select></label>
          <label>Pridať štítok <input id="bst" placeholder="štítok" list="stList"><datalist id="stList">${stitky.map(s => `<option>${e(s)}</option>`).join('')}</datalist></label>
          <label>Do skupiny <select id="bskup"><option value="">–</option>${d.partneri.filter(F.jeSkupina).map(x => `<option value="${x.id}">${e(x.nazov)}</option>`).join('')}</select></label>
          <button class="btn sm" data-act="bapply">Použiť</button><button class="btn sm ghost" data-act="bexp">Export CSV</button><button class="lnk" data-act="bnone">zrušiť výber</button></div>
        <section class="card tbl"><table class="t pt pz"><thead><tr><th class="chk"><input type="checkbox" id="ball" title="označiť zobrazené"></th>${th('nazov', 'Partner')}${th('mesto', 'Mesto')}<th>IČO</th><th>Hladina</th>${th('pob', 'Pobočky', 'r')}${th('zak', 'Zákazky', 'r')}${th('kr12', 'Krídla 12 m.', 'r')}${th('hod', 'Hodnota', 'r')}${th('posl', 'Posledná')}<th>Web</th></tr></thead><tbody>
        ${rows.map(({ p, s, grp, kat, str, nPred, nDod }) => { const cl = str === 'skupina' ? F.clenoviaSkupiny(p) : []; return `<tr data-href="#/partner/${p.id}" data-id="${p.id}" data-kat="${kat}" data-kraj="${p.krajina || 'SK'}" data-hl="${p.hladina || ''}" data-akt="${s.aktivita}" data-st="${e((p.stitky || []).join('|'))}" data-web="${p.web && p.web.hash ? 'ano' : 'nie'}" data-ico="${p.ico || F.jeSkupina(p) ? 'ano' : 'bez'}" data-kontrola="${/Možná zhoda/.test(p.poznamka || '') ? 1 : 0}" data-otv="${s.otv.length}" data-str="${str}"
            data-nazov="${e(grp ? grp.nazov + '\u0001' + p.nazov : p.nazov + (str === 'skupina' ? '\u0000' : ''))}" data-mesto="${e(p.mesto || '')}" data-zak="${s.zak.length}" data-kr12="${s.kr12}" data-hod="${s.hodnota}" data-posl="${s.posledna || ''}" data-pob="${nPred + nDod}"
            data-txt="${e(F.partnerNorm([p.nazov, grp ? grp.nazov : '', ...(p.aliasy || []), p.mesto, p.ico, p.email, p.telefon, ...(p.stitky || []), ...(p.pobocky || []).map(b => b.nazov + ' ' + b.mesto + ' ' + (b.fakturacia ? b.fakturacia.nazov + ' ' + (b.fakturacia.ico || '') : '')), ...(p.kontakty || []).map(k => k.meno)].join(' ')))}"
            class="${grp ? 'clen' : ''} ${str === 'skupina' ? 'skup' : ''}">
          <td class="chk"><input type="checkbox" class="bsel"></td>
          <td><span class="akt akt-${s.aktivita}" title="${e(F.AKTIVITA[s.aktivita])}"></span><a class="nm" href="#/partner/${p.id}"><b>${grp ? '<span class="muted">↳ </span>' : ''}${e(p.nazov)}</b></a> ${str === 'skupina' ? '<span class="kchip skupina">skupina</span>' : katChip(kat)}${(p.stitky || []).map(t => `<span class="stitok">${e(t)}</span>`).join('')}
            ${str === 'skupina' ? `<br><small class="muted">${cl.length} firiem · ${F.vsetkyPobocky(p).length} pobočiek/adries</small>` : grp ? `<br><small class="muted">firma skupiny ${e(grp.nazov)}</small>` : ''}${/Možná zhoda/.test(p.poznamka || '') ? '<br><small class="warnc">na kontrolu – možná zhoda</small>' : ''}</td>
          <td>${e(p.mesto || '')}${p.krajina && p.krajina !== 'SK' ? ` <span class="badge">${p.krajina}</span>` : ''}</td><td class="mono small">${e(p.ico || '')}${!p.ico && !F.jeSkupina(p) ? '<span class="neg small">–</span>' : ''}</td>
          <td><span class="badge b2b">${F.HLADINY[p.hladina] || p.hladina || ''}</span></td>
          <td class="r small">${nPred ? `<span title="pobočky / predajne">${nPred} pob.</span>` : ''}${nPred && nDod ? ' · ' : ''}${nDod ? `<span class="muted" title="dodacie adresy">${nDod} dod.</span>` : ''}</td>
          <td class="r">${s.zak.length ? `${s.zak.length}${s.otv.length ? ` <small class="ok">(${s.otv.length} otv.)</small>` : ''}` : ''}</td><td class="r">${s.kr12 || ''}</td><td class="r">${s.hodnota ? F.eur(s.hodnota) : ''}</td>
          <td class="${s.aktivita === 'aktivny' ? '' : 'muted'}">${s.posledna ? F.fmtD(s.posledna) : ''}</td><td>${p.web && p.web.hash ? `<span class="badge ${p.web.aktivny === false ? '' : 'web'}">${e(p.web.login)}</span>` : ''}</td></tr>`; }).join('')}
        </tbody></table></section>` :
      `<section class="card empty-db"><h2>Databáza partnerov je prázdna</h2><p>Importujte súbor <b>partneri.json</b> alebo CSV so stĺpcami <span class="mono">nazov; ico; dic; icdph; ulica; psc; mesto; telefon; email; hladina</span>.</p><p class="muted">Databáza sa uloží len v tomto prehliadači – nie je súčasťou verejného webu.</p></section>`}`;

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
        const v = vybrane(), k = $('#bkat').value, s = $('#bst').value.trim(), g = $('#bskup').value;
        if (!k && !s && !g) return toast('Vyberte kategóriu, štítok alebo skupinu', 'err');
        v.forEach(p => { if (k) p.kategoria = k; if (s) p.stitky = [...new Set([...(p.stitky || []), s])]; if (g && p.id !== g && !F.jeSkupina(p)) p.skupina = g; });
        commit(`Upravených ${v.length} partnerov`);
      }
      if (a === 'bexp') F.stiahni('partneri-vyber-' + F.today() + '.csv', partneriCsv(vybrane()), 'text/csv;charset=utf-8');
    };
    if (!d.partneri.length) return;

    /* --- filtre a zoradenie v DOM --- */
    const st = {}; FILTRE.forEach(f => st[f] = q.get(f) || ''); if (!st.sort) st.sort = 'nazov';
    const sel = { q: '#fq', str: '#fstr', kraj: '#fkraj', akt: '#fakt', hl: '#fhl', stitok: '#fstitok', web: '#fweb', sort: '#fsort' }, chk = { otv: '#fotv', ico: '#fico', kontrola: '#fkontrola' };
    const tb = $('table.pz tbody'), all = [...tb.rows];
    const aplikuj = () => {
      const hl = F.partnerNorm(st.q), smer = st.dir === 'd' ? -1 : 1, tx = ['nazov', 'mesto', 'posl'].includes(st.sort);
      let n = 0;
      all.forEach(r => {
        const x = r.dataset;
        const ok = (!st.kat || x.kat === (st.kat === '-' ? '' : st.kat)) && (!hl || x.txt.includes(hl)) && (!st.str || x.str === st.str) && (!st.kraj || x.kraj === st.kraj) && (!st.hl || x.hl === st.hl)
          && (!st.akt || x.akt === st.akt) && (!st.stitok || x.st.split('|').includes(st.stitok)) && (!st.web || x.web === st.web)
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
    const cols = ['id', 'nazov', 'typ', 'skupina', 'kategoria', 'stitky', 'ulica', 'psc', 'mesto', 'krajina', 'ico', 'dic', 'icdph', 'telefon', 'email', 'hladina', 'pobocky', 'zakazky', 'hodnota', 'posledna'];
    return '﻿' + cols.join(';') + '\n' + list.map(p => { const s = F.suhrnPartnera(p), g = F.skupinaPartnera(p); return [p.id, p.nazov, F.jeSkupina(p) ? 'skupina' : 'firma', g ? g.nazov : '', F.KATEGORIE_PARTNEROV[F.kategoriaPartnera(p)], (p.stitky || []).join(', '), p.ulica, p.psc, p.mesto, p.krajina, p.ico, p.dic, p.icdph, p.telefon, p.email, F.HLADINY[p.hladina] || p.hladina, (p.pobocky || []).length, s.zak.length, s.hodnota ? s.hodnota.toFixed(2).replace('.', ',') : '', s.posledna].map(q).join(';'); }).join('\n');
  };

  /* =====================================================================
     MAPA POBOČIEK s hranicami štátov
     ===================================================================== */
  F.svgMapaPobociek = (body, o = {}) => {
    const dep = F.suradnice(F.N().depo || 'Košice');
    const pts = body.filter(b => b.xy);
    if (!pts.length) return '';
    const all = [...pts.map(b => b.xy), dep], W = o.w || 520, H = o.h || 300, pad = 22;
    let la0 = Math.min(...all.map(b => b[0])), la1 = Math.max(...all.map(b => b[0])), lo0 = Math.min(...all.map(b => b[1])), lo1 = Math.max(...all.map(b => b[1]));
    if (la1 - la0 < 1) { const c = (la0 + la1) / 2; la0 = c - .5; la1 = c + .5; }
    if (lo1 - lo0 < 1.6) { const c = (lo0 + lo1) / 2; lo0 = c - .8; lo1 = c + .8; }
    const kx = Math.cos((la0 + la1) / 2 * Math.PI / 180), sx = (lo1 - lo0) * kx, sy = la1 - la0, s = Math.min((W - 2 * pad - 60) / sx, (H - 2 * pad) / sy);
    const cx = (lo0 + lo1) / 2, cy = (la0 + la1) / 2, P = b => [W / 2 + (b[1] - cx) * kx * s, H / 2 - (b[0] - cy) * s];
    const mx = Math.max(1, ...pts.map(b => b.n || 0));
    let g = F.svgHranice ? F.svgHranice(P, W, H) : `<rect x="0" y="0" width="${W}" height="${H}" rx="8" fill="#F3F0E8"/>`;
    const [dx, dy] = P(dep);
    g += `<g><rect x="${dx - 5}" y="${dy - 5}" width="10" height="10" fill="#1F1B16"/><text x="${dx + 8}" y="${dy + 4}" class="t-ax b">${e(F.N().depo || 'Košice')}</text></g>`;
    pts.forEach(b => { const r = 4 + 7 * Math.sqrt((b.n || 0) / mx), [x, y] = P(b.xy), farba = b.farba || '#B08D57', tvar = b.typ === 'dodacia' ? 'rect' : 'circle';
      g += `<g><${tvar} ${tvar === 'rect' ? `x="${x - r}" y="${y - r}" width="${2 * r}" height="${2 * r}" rx="2"` : `cx="${x}" cy="${y}" r="${r}"`} fill="${b.n ? farba : '#fff'}" stroke="${b.n ? '#5B5147' : farba}" stroke-width="1.4" opacity=".92"><title>${e(b.nazov)}${b.n ? ' – ' + b.n + ' zákaziek' : ''}</title></${tvar}>${pts.length <= 14 ? `<text x="${x + r + 3}" y="${y + 3}" class="t-ax">${e(b.kratko || b.nazov)}</text>` : ''}</g>`; });
    return `<svg class="v-graf" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Mapa pobočiek">${g}</svg>`;
  };

  /* =====================================================================
     KARTA PARTNERA
     ===================================================================== */
  const FARBY_FIRIEM = ['#B08D57', '#6E2620', '#5B6B7A', '#3F6B4F', '#8B5A2B', '#7A5C8A', '#C2703D', '#2F5D62', '#9C7A45', '#4E4A7A', '#7D8B3A', '#A0525E'];
  F.vPartner = (id, q) => {
    const { toast } = F.ui, d = D(), p = F.partner(id);
    if (!p) { app().innerHTML = `<div class="v-head"><div><a class="back" href="#/partneri">← partneri</a><h1>Partner neexistuje</h1></div></div>`; return; }
    F.pobockyP(p);
    const grp = F.skupinaPartnera(p), skup = F.jeSkupina(p), kat = F.kategoriaPartnera(p);
    const firmy = F.firmySkupiny(p), farbaFirmy = Object.fromEntries(firmy.map((f, i) => [f.id, i ? FARBY_FIRIEM[(i - 1) % FARBY_FIRIEM.length] : '#BDB6A8']));
    const zakAll = F.zakazkyPartnera(p), sAll = F.suhrnZakaziek(zakAll);
    const pobAll = F.vsetkyPobocky(p).map(x => ({ ...x, zak: zakAll.filter(z => { const r = F.pobockaZakazky(z); return r && r.b === x.b; }) }));
    // pohľad štatistiky: celý partner / firma skupiny / pobočka
    const poh = q.get('pohlad') || '';
    let zak = zakAll, pohNazov = skup ? 'celá skupina' : 'celá firma';
    if (poh.startsWith('f:')) { const f = F.partner(poh.slice(2)); if (f) { zak = zakAll.filter(z => z.zakaznik.partnerId === f.id); pohNazov = f.nazov; } }
    if (poh.startsWith('b:')) { const x = pobAll.find(y => y.b.id === poh.slice(2)); if (x) { zak = x.zak; pohNazov = x.b.nazov; } }
    const s = F.suhrnZakaziek(zak);
    const fmt = v => (+v || 0).toLocaleString('sk-SK', { maximumFractionDigits: 0 });
    const kpi = (lab, val, sub = '', cls = '') => `<div class="kpi ${cls}"><span>${lab}</span><b>${val}</b><small>${sub}</small></div>`;
    const zoz = d.partneri.slice().sort((a, b) => a.nazov.localeCompare(b.nazov, 'sk')), ix = zoz.indexOf(p), pred = zoz[ix - 1], dalsi = zoz[ix + 1];
    const sidlo = { nazov: p.nazov, mesto: p.mesto, xy: F.suradnice(p.mesto), n: zakAll.filter(z => !F.pobockaZakazky(z)).length, kratko: p.mesto };
    const mapBody = pobAll.length ? pobAll.map(x => ({ nazov: x.b.nazov, xy: F.suradnice(x.b.mesto), n: x.zak.length, kratko: x.b.mesto, typ: x.b.typ, farba: skup ? farbaFirmy[x.firma.id] : undefined })) : [sidlo];
    // čo kupuje
    const mix = { kolekcia: {}, farba: {}, prevedenie: {}, sirka: {}, zarubna: {} };
    zak.forEach(z => (z.polozky || []).forEach(x => { const ks = +x.ks || 1; if (F.maKridlo(x)) { [['kolekcia', F.KOLEKCIE[x.kolekcia]?.nazov], ['farba', F.FARBY[x.farba]?.nazov], ['prevedenie', F.PREVEDENIA[x.prevedenie]], ['sirka', x.sirka]].forEach(([k, v]) => mix[k][v] = (mix[k][v] || 0) + ks); } if (F.maZarubnu(x)) { const t = F.zarubnaPreStenu(+x.stena).typ; mix.zarubna[t] = (mix.zarubna[t] || 0) + ks; } }));
    const PAL = ['#8B5A2B', '#B08D57', '#6E2620', '#5B6B7A', '#3F6B4F', '#BDB6A8'];
    const mixBar = (tit, o) => { const en = Object.entries(o).sort((a, b) => b[1] - a[1]), t = F.sum(en, x => x[1]); return en.length ? `<div class="mix"><h4>${tit}</h4><div class="mixbar">${en.map(([k, v], i) => `<i style="flex:${v};background:${PAL[i % 6]}" title="${e(k)}: ${v} ks"></i>`).join('')}</div><div class="mixlg">${en.map(([k, v], i) => `<span><i style="background:${PAL[i % 6]}"></i>${e(k)} <b>${Math.round(100 * v / t)} %</b></span>`).join('')}</div></div>` : ''; };
    const mes = []; for (let i = 11; i >= 0; i--) { const t = new Date(); t.setDate(1); t.setMonth(t.getMonth() - i); mes.push({ k: t.toISOString().slice(0, 7), lab: ['jan', 'feb', 'mar', 'apr', 'máj', 'jún', 'júl', 'aug', 'sep', 'okt', 'nov', 'dec'][t.getMonth()], kr: 0, n: 0 }); }
    zak.forEach(z => { const m = mes.find(x => x.k === datumZ(z).slice(0, 7)); if (m) { m.kr += F.pocty(z).kr; m.n++; } });
    const mxKr = Math.max(1, ...mes.map(m => m.kr));
    const zaznamy = (p.zaznamy || []).slice().sort((a, b) => b.t.localeCompare(a.t));
    const pohOpt = `<option value="">${skup ? 'celá skupina' : 'celá firma'}</option>${skup && firmy.length > 1 ? `<optgroup label="Firmy">${firmy.slice(1).map(f => `<option value="f:${f.id}" ${poh === 'f:' + f.id ? 'selected' : ''}>${e(f.nazov)}</option>`).join('')}</optgroup>` : ''}${pobAll.length ? `<optgroup label="Pobočky a adresy">${pobAll.map(x => `<option value="b:${x.b.id}" ${poh === 'b:' + x.b.id ? 'selected' : ''}>${e(x.b.nazov)}</option>`).join('')}</optgroup>` : ''}`;
    const pobRiadok = x => { const ss = F.suhrnZakaziek(x.zak); return `<tr data-b="${x.b.id}" class="${x.b.aktivna === false ? 'off' : ''}"><td class="chk no-print">${skup ? '<input type="checkbox" class="psel">' : ''}</td>
      <td><a class="lnk-b" href="#/partner/${p.id}?pohlad=b:${x.b.id}"><b>${e(x.b.nazov)}</b></a>${x.b.aktivna === false ? ' <span class="badge">neaktívna</span>' : ''}<br><span class="tpob tpob-${x.b.typ}">${POB_KRATKO[x.b.typ]}</span>${x.b.fakturacia && x.b.fakturacia.nazov ? ` <span class="tpob tpob-fak" title="${e(x.b.fakturacia.nazov)}${x.b.fakturacia.ico ? ', IČO ' + e(x.b.fakturacia.ico) : ''}">vlastná fakturácia${x.b.fakturacia.ico ? ' · IČO ' + e(x.b.fakturacia.ico) : ''}</span>` : ''}${skup ? ` <span class="fdot" style="--c:${farbaFirmy[x.firma.id]}"></span><span class="small ${F.jeSkupina(x.firma) ? 'warnc' : 'muted'}">${F.jeSkupina(x.firma) ? 'nepriradená firme' : e(x.firma.nazov)}</span>` : ''}</td>
      <td class="small">${e([x.b.ulica, [x.b.psc, x.b.mesto].filter(Boolean).join(' ')].filter(Boolean).join(', '))} ${x.b.krajina && x.b.krajina !== 'SK' ? `<span class="badge">${x.b.krajina}</span>` : ''}${x.b.kontakt || x.b.telefon ? `<br><span class="muted">${e([x.b.kontakt, x.b.telefon].filter(Boolean).join(' · '))}</span>` : ''}</td>
      <td class="r">${ss.zak.length || ''}</td><td class="r">${ss.kr12 || ''}</td><td class="small ${ss.aktivita === 'aktivny' ? '' : 'muted'}">${ss.posledna ? F.fmtD(ss.posledna) : ''}</td><td class="r no-print"><button class="lnk" data-act="pob" data-b="${x.b.id}">upraviť</button></td></tr>`; };

    app().innerHTML = `<div class="v-head"><div><a class="back no-print" href="#/partneri">← partneri</a>${grp ? ` <a class="back no-print" href="#/partner/${grp.id}">· skupina ${e(grp.nazov)}</a>` : ''}<h1>${e(p.nazov)}</h1>
        <p class="p-tags">${skup ? `<span class="kchip skupina">skupina · ${firmy.length - 1} firiem</span>` : grp ? `<a class="kchip skupina" href="#/partner/${grp.id}">firma skupiny ${e(grp.nazov)}</a>` : ''}<span class="kchip" style="--c:${F.KAT_FARBA[kat]}">${e(F.KATEGORIE_PARTNEROV[kat])}</span><span class="akt akt-${sAll.aktivita}"></span><span class="muted small">${e(F.AKTIVITA[sAll.aktivita])}</span>${(p.stitky || []).map(t => `<a class="stitok" href="#/partneri?stitok=${encodeURIComponent(t)}">${e(t)}</a>`).join('')}<span class="mono small muted">${p.id}</span></p></div>
      <div class="v-act no-print">${pred ? `<a class="btn ghost sm" href="#/partner/${pred.id}" title="${e(pred.nazov)}">‹</a>` : ''}${dalsi ? `<a class="btn ghost sm" href="#/partner/${dalsi.id}" title="${e(dalsi.nazov)}">›</a>` : ''}
        <button class="btn ghost" data-act="edit">Upraviť údaje</button><button class="btn ghost" onclick="print()">Tlačiť</button>${skup ? '' : `<a class="btn" href="#/nova?partner=${p.id}">+ Nová zákazka</a>`}</div></div>

      <div class="stat-pick no-print"><label>Štatistika za <select id="pohlad">${pohOpt}</select></label>${poh ? `<a class="lnk" href="#/partner/${p.id}">zobraziť celkovo</a>` : ''}</div>
      <div class="kpis k6">
        ${kpi('Zákazky', s.zak.length || '–', s.otv.length ? `${s.otv.length} otvorených` : 'v systéme')}
        ${kpi('Krídla za 12 mes.', s.kr12 || '–', `spolu ${s.kr} krídel · ${s.zar} zárubní`)}
        ${kpi('Hodnota za 12 mes.', s.hodnota12 ? fmt(s.hodnota12) + ' <small>€</small>' : '–', 'bez DPH')}
        ${kpi('Priemerná zákazka', s.zak.length && s.hodnota ? fmt(s.hodnota / s.zak.length) + ' <small>€</small>' : '–', s.zak.length ? `${(s.kr / s.zak.length).toFixed(1)} krídla / zákazku` : '')}
        ${kpi('Posledná objednávka', s.posledna ? F.fmtD(s.posledna) : '–', s.posledna ? `pred ${Math.round(s.dni)} dňami` : 'zatiaľ nič', s.aktivita === 'neaktivny' ? 'warn' : '')}
        ${kpi(skup ? 'Firmy / pobočky' : 'Pobočky / adresy', skup ? `${firmy.length - 1} <small>/ ${pobAll.filter(x => x.b.typ === 'predajna').length}</small>` : `${pobAll.filter(x => x.b.typ === 'predajna').length} <small>/ ${pobAll.filter(x => x.b.typ === 'dodacia').length}</small>`, skup ? 'firmy / pobočky' : 'pobočky / dodacie adresy')}
      </div>

      ${skup ? `<section class="card"><div class="card-h"><h2>Firmy v skupine <small class="muted">fakturuje sa na firmu, nie na skupinu</small></h2><div class="no-print"><button class="btn sm ghost" data-act="clen-add">+ Pridať existujúceho partnera</button> <button class="btn sm" data-act="clen-new">+ Nová firma v skupine</button></div></div>
        ${firmy.length > 1 ? `<table class="t slim"><thead><tr><th>Firma</th><th>IČO</th><th>Sídlo</th><th class="r">Pobočky</th><th class="r">Zákazky</th><th class="r">Krídla 12 m.</th><th class="r">Hodnota</th><th>Posledná</th><th class="no-print"></th></tr></thead><tbody>${firmy.slice(1).map(f => { const ss = F.suhrnPartnera(f); return `<tr data-href="#/partner/${f.id}"><td><span class="fdot" style="--c:${farbaFirmy[f.id]}"></span><a href="#/partner/${f.id}"><b>${e(f.nazov)}</b></a></td><td class="mono small">${e(f.ico || '–')}</td><td class="small">${e(F.adresaPartnera(f))}</td><td class="r">${(f.pobocky || []).length || ''}</td><td class="r">${ss.zak.length || ''}</td><td class="r">${ss.kr12 || ''}</td><td class="r">${ss.hodnota ? F.eur(ss.hodnota) : ''}</td><td class="small">${ss.posledna ? F.fmtD(ss.posledna) : ''}</td><td class="r no-print"><button class="lnk" data-act="clen-rm" data-id="${f.id}">vyradiť</button></td></tr>`; }).join('')}</tbody></table>`
          : '<p class="muted">Skupina zatiaľ nemá firmy. Pridajte ich – pobočky potom priradíte firmám (zaškrtnete ich nižšie a zvolíte „Presunúť do firmy“).</p>'}</section>` : ''}

      <div class="grid2">
        <section class="card"><h2>${skup ? 'Údaje skupiny' : 'Firemné a fakturačné údaje'}</h2>
          <table class="t kvt"><tbody>
            <tr><th>Obchodné meno</th><td><b>${e(p.nazov)}</b></td></tr>
            <tr><th>${skup ? 'Centrála' : 'Fakturačná adresa'}</th><td>${e(F.adresaPartnera(p) || '–')}${p.krajina && p.krajina !== 'SK' ? ` <span class="badge">${p.krajina}</span>` : ''}</td></tr>
            ${skup ? '' : `<tr><th>IČO / DIČ / IČ DPH</th><td class="mono">${e(p.ico || '–')} · ${e(p.dic || '–')} · ${e(p.icdph || '–')}</td></tr>`}
            <tr><th>Telefón</th><td>${p.telefon ? `<a href="tel:${e(p.telefon.replace(/\s/g, ''))}">${e(p.telefon)}</a>` : '–'}</td></tr>
            <tr><th>E-mail</th><td>${p.email ? `<a href="mailto:${e(p.email)}">${e(p.email)}</a>` : '–'}</td></tr>
            ${p.web_stranka ? `<tr><th>Web</th><td><a href="${e(/^https?:/.test(p.web_stranka) ? p.web_stranka : 'https://' + p.web_stranka)}" target="_blank" rel="noopener">${e(p.web_stranka)}</a></td></tr>` : ''}
            <tr><th>Cenová hladina</th><td><span class="badge b2b">${e(F.HLADINY[p.hladina] || p.hladina || '')}</span>${p.predajna ? ' · má predajňu' : ''}</td></tr>
            ${skup ? '' : `<tr><th>Úhrada / splatnosť</th><td>${e(p.uhrada || '–')}${p.splatnost ? ` · ${p.splatnost} dní` : ''}</td></tr>`}
            ${p.obchodnik ? `<tr><th>Obchodník</th><td>${e(p.obchodnik)}</td></tr>` : ''}
            ${(p.aliasy || []).length ? `<tr><th>Iné názvy</th><td class="small">${p.aliasy.slice(0, 12).map(e).join(' · ')}${p.aliasy.length > 12 ? ` <span class="muted">+${p.aliasy.length - 12}</span>` : ''}</td></tr>` : ''}
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
          ${p.web && p.web.hash ? `<p>Login <b class="mono">${e(p.web.login)}</b> · ${p.web.aktivny === false ? '<span class="neg">zablokovaný</span>' : '<span class="ok">aktívny</span>'} · heslo nastavené ${p.web.vytvorene ? F.fmtD(p.web.vytvorene) : ''}</p>` : '<p class="muted">Bez prístupu na web – vytvoríte ho v „Upraviť údaje“.</p>'}
          ${zakAll.filter(z => z.objednal && /web/.test(z.objednal.kanal)).length ? `<p class="small muted">Z webu prišlo ${zakAll.filter(z => z.objednal && /web/.test(z.objednal.kanal)).length} objednávok.</p>` : ''}
        </section>
      </div>

      <section class="card"><div class="card-h"><h2>Pobočky a dodacie adresy <small class="muted">${pobAll.filter(x => x.b.typ === 'predajna').length} pobočiek · ${pobAll.filter(x => x.b.typ === 'dodacia').length} dodacích adries</small></h2>
          <div class="no-print"><button class="btn sm ghost" data-act="pob-new" data-typ="dodacia">+ Dodacia adresa</button> <button class="btn sm" data-act="pob-new" data-typ="predajna">+ Pobočka / predajňa</button></div></div>
        <p class="muted small">${skup ? 'Každá pobočka objednáva samostatne a patrí jednej firme skupiny (na tú sa fakturuje). ' : ''}<b>Pobočka</b> objednáva sama – pri zákazke sa vyberá „Objednala pobočka“ a tovar ide na jej adresu. <b>Dodacia adresa</b> je len miesto vykládky (stavba, sklad) – objednáva a platí firma.</p>
        ${skup && firmy.length > 1 ? `<div class="bulk-p no-print" id="pbulk" hidden><b id="pbulkN"></b> <label>Presunúť do firmy <select id="pfirma">${firmy.slice(1).map(f => `<option value="${f.id}">${e(f.nazov)}</option>`).join('')}</select></label> <button class="btn sm" data-act="pob-move">Presunúť</button></div>` : ''}
        <div class="grid-pob"><div>${F.svgMapaPobociek(mapBody, { h: mapBody.length > 14 ? 380 : 300 })}${skup && firmy.length > 1 ? `<div class="lg">${firmy.slice(1).map(f => `<span><i style="background:${farbaFirmy[f.id]}"></i>${e(f.nazov)}</span>`).join('')}<span><i style="background:#BDB6A8"></i>nepriradené</span></div>` : ''}<div class="lg"><span>● pobočka</span><span>■ dodacia adresa</span><span>plný bod = má zákazky</span></div>${pobAll.some(x => !F.suradnice(x.b.mesto)) ? `<p class="small warnc">${pobAll.filter(x => !F.suradnice(x.b.mesto)).length} adries nie je na mape (neznáme mesto).</p>` : ''}</div>
          <div class="pob-list">${pobAll.length ? `<table class="t slim pobt"><thead><tr><th class="chk no-print">${skup ? '<input type="checkbox" id="pall">' : ''}</th><th>Názov</th><th>Adresa / kontakt</th><th class="r">Zák.</th><th class="r">Kr. 12 m.</th><th>Posledná</th><th class="no-print"></th></tr></thead><tbody>${pobAll.map(pobRiadok).join('')}</tbody></table>` : '<p class="muted">Bez pobočiek – vykladá sa na fakturačnej adrese.</p>'}</div></div>
      </section>

      <div class="grid2">
        <section class="card"><h2>Objednávky <small class="muted">krídla za posledných 12 mesiacov · ${e(pohNazov)}</small></h2>
          <div class="mbars">${mes.map(m => `<div title="${m.n} zákaziek, ${m.kr} krídel"><b>${m.kr || ''}</b><i style="height:${100 * m.kr / mxKr}%"></i><span>${m.lab}</span></div>`).join('')}</div>
          ${zak.length ? '' : '<p class="muted small">Zatiaľ žiadna zákazka v systéme.</p>'}</section>
        <section class="card"><h2>Čo kupuje <small class="muted">${e(pohNazov)}</small></h2>${zak.length ? mixBar('Kolekcia', mix.kolekcia) + mixBar('Farba', mix.farba) + mixBar('Prevedenie', mix.prevedenie) + mixBar('Šírka', mix.sirka) + mixBar('Zárubne', mix.zarubna) : '<p class="muted">Rozpis sa zobrazí, keď budú v systéme zákazky.</p>'}</section>
      </div>

      <section class="card"><div class="card-h"><h2>Zákazky <small class="muted">${zak.length} · ${e(pohNazov)}</small></h2>${skup ? '' : `<a class="btn sm ghost no-print" href="#/nova?partner=${p.id}">+ Nová zákazka</a>`}</div>
        ${zak.length ? `<table class="t slim"><thead><tr><th>Zákazka</th><th>Dátum</th><th>Stav</th>${skup ? '<th>Firma</th>' : ''}<th>Objednala pobočka</th><th>Miesto vykládky</th><th class="r">Krídla / zár.</th><th class="r">Hmotnosť</th><th class="r">Hodnota bez DPH</th></tr></thead><tbody>${zak.map(z => { const pc = F.pocty(z), dd = F.dodanie ? F.dodanie(z) : {}, hm = F.hmotnostZakazky ? F.hmotnostZakazky(z) : null, h = F.hodnotaZakazky(z), pb = F.pobockaZakazky(z), f = F.partner(z.zakaznik.partnerId); return `<tr data-href="#/zakazka/${z.id}"><td><a href="#/zakazka/${z.id}">${z.id}</a>${z.objednal && /web/.test(z.objednal.kanal) ? ' <span class="badge web">web</span>' : ''}</td><td>${F.fmtD(datumZ(z))}</td><td>${F.chip(z.stav)}</td>${skup ? `<td class="small">${e(f ? f.nazov : '')}</td>` : ''}<td class="small">${pb && pb.b.typ === 'predajna' ? e(pb.b.nazov) : '<span class="muted">firma</span>'}</td><td class="small">${e(dd.nazov && dd.nazov !== (f || p).nazov ? dd.nazov : (dd.mesto || ''))}</td><td class="r">${pc.kr} / ${pc.zar}</td><td class="r muted">${hm && hm.brutto ? F.kg(hm.brutto) : ''}</td><td class="r">${h ? F.eur(h) : '–'}</td></tr>`; }).join('')}</tbody></table>` : '<p class="muted">Žiadne zákazky.</p>'}</section>

      <section class="card"><div class="card-h"><h2>Denník komunikácie <small class="muted">${zaznamy.length}</small></h2></div>
        <form id="zazF" class="zaz-f no-print"><select name="typ">${opt(F.TYPY_ZAZNAMU)}</select><input name="text" placeholder="čo sa dohodlo, reklamácia, požiadavka…" required><input name="kto" placeholder="kto" value="${e(p.obchodnik || '')}"><button class="btn sm">Zapísať</button></form>
        ${zaznamy.length ? `<ul class="zaz">${zaznamy.map(x => `<li><span class="zt">${F.fmtD(x.t)} ${x.t.slice(11, 16)}</span><span class="badge">${e(F.TYPY_ZAZNAMU[x.typ] || x.typ)}</span> ${e(x.text)}${x.kto ? ` <span class="muted small">– ${e(x.kto)}</span>` : ''} <button class="lnk no-print" data-act="zdel" data-t="${e(x.t)}">zmazať</button></li>`).join('')}</ul>` : '<p class="muted small">Sem si zapisujte telefonáty, dohody, reklamácie a požiadavky partnera.</p>'}
      </section>`;

    const prekresli = () => { const y = window.scrollY; F.vPartner(id, new URLSearchParams(location.hash.split('?')[1] || '')); window.scrollTo(0, y); };
    $('#pohlad').addEventListener('change', ev => F.ui.go(`#/partner/${p.id}${ev.target.value ? '?pohlad=' + ev.target.value : ''}`));
    $('#zarF').addEventListener('change', ev => {
      const n = ev.target.name;
      if (n === 'stitky') p.stitky = [...new Set(ev.target.value.split(',').map(x => x.trim()).filter(Boolean))];
      else p[n] = ev.target.value;
      if (n === 'hladina') d.zakazky.filter(z => z.zakaznik.partnerId === p.id && F.stavIdx(z.stav) < F.stavIdx('expedovana')).forEach(z => { const pb = z.zakaznik.pobockaId; F.priradPartnera(z, p); if (pb) z.zakaznik.pobockaId = pb; });
      F.save(); toast('Uložené', 'ok'); prekresli();
    });
    $('#zazF').addEventListener('submit', ev => {
      ev.preventDefault(); const fd = new FormData(ev.target); if (!fd.get('text').trim()) return;
      p.zaznamy = p.zaznamy || []; p.zaznamy.push({ t: new Date().toISOString(), typ: fd.get('typ'), text: fd.get('text').trim(), kto: fd.get('kto').trim() });
      F.save(); toast('Zapísané', 'ok'); prekresli();
    });
    const pbulk = () => { const n = document.querySelectorAll('.psel:checked').length, el = $('#pbulk'); if (el) { el.hidden = !n; $('#pbulkN').textContent = `Vybraných ${n}`; } };
    app().onchange = ev => { if (ev.target.classList.contains('psel')) pbulk(); if (ev.target.id === 'pall') { document.querySelectorAll('.psel').forEach(c => c.checked = ev.target.checked); pbulk(); } };
    app().onclick = ev => {
      const b = ev.target.closest('[data-act]'); if (!b) return;
      const a = b.dataset.act;
      if (a === 'edit') F.upravPartnera(p, () => prekresli());
      if (a === 'zdel') { if (!confirm('Zmazať záznam?')) return; p.zaznamy = (p.zaznamy || []).filter(x => x.t !== b.dataset.t); F.save(); prekresli(); }
      if (a === 'pob-new') F.upravPobocku(p, null, b.dataset.typ, prekresli);
      if (a === 'pob') { const r = F.najdiPobocku(b.dataset.b); if (r) F.upravPobocku(r.firma, r.b, null, prekresli); }
      if (a === 'pob-move') {
        const ciel = F.partner($('#pfirma').value), ids = [...document.querySelectorAll('.psel:checked')].map(c => c.closest('tr').dataset.b);
        ids.forEach(i => { const r = F.najdiPobocku(i); if (r && r.firma !== ciel) { r.firma.pobocky = r.firma.pobocky.filter(x => x !== r.b); F.pobockyP(ciel).push(r.b); } });
        F.save(); toast(`Presunuté ${ids.length} pobočiek do ${ciel.nazov}`, 'ok'); prekresli();
      }
      if (a === 'clen-new') F.upravPartnera(null, null, { skupina: p.id, typ: 'firma', hladina: p.hladina, krajina: p.krajina, kategoria: kat });
      if (a === 'clen-rm') { const f = F.partner(b.dataset.id); if (!confirm(`Vyradiť ${f.nazov} zo skupiny? Firma ostane ako samostatný partner aj so svojimi pobočkami.`)) return; f.skupina = ''; F.save(); prekresli(); }
      if (a === 'clen-add') {
        F.ui.modal('Pridať firmu do skupiny ' + e(p.nazov), `<form id="caf" class="kf"><label class="w">Partner (začnite písať názov alebo IČO)<input name="x" list="caDL" autofocus><datalist id="caDL">${d.partneri.filter(x => x !== p && !F.jeSkupina(x) && x.skupina !== p.id).map(x => `<option value="${e(x.nazov)}">${e(x.ico || '')} ${e(x.mesto || '')}</option>`).join('')}</datalist></label></form>`,
          [{ t: 'Pridať', f: () => { const x = F.najdiPartnera($('#caf').x.value); if (!x || x === p || F.jeSkupina(x)) { toast('Partner sa nenašiel', 'err'); return false; } x.skupina = p.id; F.save(); toast(x.nazov + ' pridaná do skupiny', 'ok'); prekresli(); } }]);
      }
      if (a === 'kontakt') {
        const i = b.dataset.i != null ? +b.dataset.i : -1, k = i >= 0 ? p.kontakty[i] : { meno: '', funkcia: '', telefon: '', email: '' };
        F.ui.modal(i >= 0 ? 'Kontaktná osoba' : 'Nová kontaktná osoba', `<form id="kf" class="kf"><label class="w">Meno a priezvisko<input name="meno" value="${e(k.meno)}" required></label><label>Funkcia<input name="funkcia" value="${e(k.funkcia || '')}" placeholder="konateľ, nákup, sklad…"></label><label>Telefón<input name="telefon" value="${e(k.telefon || '')}"></label><label class="w">E-mail<input name="email" value="${e(k.email || '')}"></label><label class="chk w"><input type="checkbox" name="hlavny" ${k.hlavny ? 'checked' : ''}> hlavný kontakt</label></form>`,
          [{ t: 'Uložiť', f: () => { const fd = new FormData($('#kf')); if (!fd.get('meno').trim()) return false; const n = { meno: fd.get('meno').trim(), funkcia: fd.get('funkcia').trim(), telefon: fd.get('telefon').trim(), email: fd.get('email').trim(), hlavny: !!fd.get('hlavny') };
            p.kontakty = p.kontakty || []; if (n.hlavny) p.kontakty.forEach(x => x.hlavny = false); if (i >= 0) p.kontakty[i] = n; else p.kontakty.push(n); F.save(); toast('Uložené', 'ok'); prekresli(); } },
          ...(i >= 0 ? [{ t: 'Odstrániť', cls: 'ghost neg', f: () => { p.kontakty.splice(i, 1); F.save(); prekresli(); } }] : [])]);
      }
    };
  };

  /* =====================================================================
     ZÁKAZKA – výber objednávajúcej pobočky a miesta vykládky
     ===================================================================== */
  F.polePobockyZakazky = z => {
    const p = z.zakaznik.partnerId && F.partner(z.zakaznik.partnerId);
    if (!p) return '';
    const grp = F.skupinaPartnera(p) || p, firmy = F.firmySkupiny(grp), vsetky = F.vsetkyPobocky(grp);
    const pred = vsetky.filter(x => x.b.typ === 'predajna' && x.b.aktivna !== false);
    const vlastne = F.vsetkyPobocky(p).filter(x => x.b.aktivna !== false || x.b.id === (z.dodanie || {}).pobockaId);
    const obj = F.pobockaZakazky(z), objId = obj && obj.b.typ === 'predajna' ? obj.b.id : '';
    const dodId = (z.dodanie && z.dodanie.pobockaId) || (obj && z.dodanie && F.partnerNorm(z.dodanie.nazov) === F.partnerNorm(obj.b.nazov) ? obj.b.id : '');
    const o1 = (x, sel) => `<option value="${x.b.id}" ${x.b.id === sel ? 'selected' : ''}>${e(x.b.nazov)}${x.b.mesto ? ' · ' + e(x.b.mesto) : ''}</option>`;
    const grpOpt = list => firmy.length > 1 ? [...firmy.slice(1), firmy[0]].map(f => { const l = list.filter(x => x.firma === f); return l.length ? `<optgroup label="${e(F.jeSkupina(f) ? f.nazov + ' – nepriradené firme' : f.nazov)}">${l.map(x => o1(x, objId)).join('')}</optgroup>` : ''; }).join('') : list.map(x => o1(x, objId)).join('');
    return `${pred.length ? `<label class="w">Objednala pobočka<select name="objPobocka"><option value="">– objednáva firma (centrála) –</option>${grpOpt(pred)}</select></label>` : ''}
      ${vlastne.length ? `<label class="w">Miesto vykládky<select name="dodPobocka"><option value="">fakturačná adresa – ${e(p.nazov)}</option>${['predajna', 'dodacia'].map(t => { const l = vlastne.filter(x => x.b.typ === t); return l.length ? `<optgroup label="${t === 'predajna' ? 'Pobočky' : 'Dodacie adresy'}">${l.map(x => o1(x, dodId)).join('')}</optgroup>` : ''; }).join('')}<option value="ine" ${z.dodanie && !dodId && (z.dodanie.mesto || z.dodanie.ulica) ? 'selected' : ''}>iná adresa (vyplniť nižšie)…</option></select></label>` : ''}
      ${obj && obj.b.typ === 'predajna' ? `<p class="w small muted">Fakturuje sa na: <b>${e(z.zakaznik.nazov)}</b>${z.zakaznik.ico ? ', IČO ' + e(z.zakaznik.ico) : ''}${z.zakaznik.fakturaPobocky ? ' <span class="badge web">vlastné údaje pobočky</span>' : ''}</p>` : ''}
      ${F.jeSkupina(p) && F.clenoviaSkupiny(p).length ? '<p class="w warnc small">Zákazka je priradená skupine – vyberte pobočku, aby sa fakturovalo na správnu firmu.</p>' : ''}`;
  };
  const adresaPobocky = (b, firma) => ({ nazov: b.nazov, ulica: b.ulica || '', psc: b.psc || '', mesto: b.mesto || '', krajina: b.krajina || firma.krajina || 'SK', kontakt: [b.kontakt, b.telefon].filter(Boolean).join(' '), pozn: b.pozn || '', pobocka: b.nazov, pobockaId: b.id });
  /** Spracuje zmenu výberu; vráti text pre hlášku alebo null */
  F.zmenaPobockyZakazky = (z, pole, hodnota) => {
    if (pole === 'objPobocka') {
      const firma = F.partner(z.zakaznik.partnerId);
      if (!hodnota) { z.zakaznik.pobockaId = ''; z.zakaznik.pobockaNazov = ''; if (firma) F.priradPartnera(z, firma); return 'Objednáva firma – fakturuje sa na ' + (firma ? firma.nazov : '–'); }
      const r = F.najdiPobocku(hodnota); if (!r) return null;
      z.zakaznik.pobockaId = r.b.id; z.zakaznik.pobockaNazov = r.b.nazov;
      F.priradPartnera(z, F.jeSkupina(r.firma) ? (firma || r.firma) : r.firma);     // fakturuje sa na firmu pobočky, prípadne na vlastné údaje pobočky
      z.dodanie = adresaPobocky(r.b, r.firma);
      return `Objednala ${r.b.nazov} – fakturuje sa na ${z.zakaznik.nazov}, vykládka na adrese pobočky`;
    }
    if (pole === 'dodPobocka') {
      if (hodnota === 'ine') { z.dodanie = Object.assign({}, F.dodanie(z), { pobockaId: '', pobocka: '' }); return 'Doplňte adresu vykládky'; }
      if (!hodnota) { z.dodanie = null; return 'Vykládka na fakturačnej adrese'; }
      const r = F.najdiPobocku(hodnota); if (!r) return null;
      z.dodanie = adresaPobocky(r.b, r.firma); return 'Miesto vykládky: ' + r.b.nazov;
    }
    return null;
  };
  /** Pobočka podľa textu (napr. názov z objednávky „Jola -C- Sopron“) */
  F.najdiPobockuPodlaNazvu = (text, p) => { const n = F.partnerNorm(text); if (!n) return null; const zoz = p ? F.vsetkyPobocky(F.skupinaPartnera(p) || p) : D().partneri.flatMap(f => (f.pobocky || []).map(b => ({ b, firma: f }))); return zoz.find(x => F.partnerNorm(x.b.nazov) === n) || zoz.find(x => x.b.fakturacia && (F.partnerNorm(x.b.fakturacia.nazov) === n || (x.b.fakturacia.ico && x.b.fakturacia.ico === String(text).trim()))) || null; };
  /** Text „objednala pobočka“ pre doklady */
  F.textPobockyZakazky = z => { const r = F.pobockaZakazky(z); return r && r.b.typ === 'predajna' ? r.b.nazov : ''; };
})();
