/* =====================================================================
   Aplikácia: navigácia a obrazovky
   ===================================================================== */
'use strict';
(function () {
  const e = F.esc, $ = s => document.querySelector(s), app = () => $('#view');
  const D = () => F.load();
  let toastT;
  const toast = (msg, typ) => { const t = $('#toast'); t.textContent = msg; t.className = 'toast show ' + (typ || ''); clearTimeout(toastT); toastT = setTimeout(() => t.className = 'toast', 2600); };
  const go = h => { location.hash = h; };
  const commit = (msg) => { F.save(); if (msg) toast(msg, 'ok'); route(); };

  /* ---------- formulár pozície (spoločný pre novú zákazku aj úpravu) ---------- */
  const opt = (obj, val) => Object.entries(obj).map(([k, v]) => `<option value="${k}" ${String(k) === String(val) ? 'selected' : ''}>${e(typeof v === 'object' ? v.nazov || v.txt : v)}</option>`).join('');
  const NOVA_POZ = () => ({ poradie: 1, nazov: '', druh: 'dvere', kolekcia: 'minimal', prevedenie: 'falc', farba: 'biela', farba_zarubne: 'biela', sirka: '80', vyska: '197', smer: 'lave', so_zarubnou: true, stena: 120, kovanie: 'bb-nikel', zavesy: 'nikel', mriezka: 'bez', prah: false, spoj: 'pokos', skratenie: 0, skratenie_zar: 0, ks: 1 });
  function formPozicie(p) {
    const vys = Object.fromEntries(Object.entries(F.VYSKY).map(([k, v]) => [k, `${v.txt} (${v.norma})`]));
    const sir = Object.fromEntries(F.SIRKY.map(s => [s, s]));
    const kol = Object.fromEntries(Object.entries(F.KOLEKCIE).map(([k, v]) => [k, `${v.nazov} ${v.model}`]));
    return `<form class="poz-form" id="pozForm">
      <div class="pf-grid">
        <label>Druh<select name="druh"><option value="dvere" ${p.druh !== 'zarubna' ? 'selected' : ''}>Dvere (krídlo ± zárubňa)</option><option value="zarubna" ${p.druh === 'zarubna' ? 'selected' : ''}>Slepá (tunelová) zárubňa</option></select></label>
        <label>Označenie<input name="nazov" value="${e(p.nazov)}" placeholder="napr. Spálňa"></label>
        <label>Počet ks<input name="ks" type="number" min="1" max="99" value="${p.ks}"></label>
        <label class="k">Kolekcia<select name="kolekcia">${opt(kol, p.kolekcia)}</select></label>
        <label class="k">Prevedenie<select name="prevedenie">${opt(F.PREVEDENIA, p.prevedenie)}</select></label>
        <label class="k">Farba krídla<select name="farba">${opt(F.FARBY, p.farba)}</select></label>
        <label>Šírka<select name="sirka">${opt(sir, p.sirka)}</select></label>
        <label>Výška<select name="vyska">${opt(vys, p.vyska)}</select></label>
        <label class="k">Smer<select name="smer">${opt({ lave: 'ľavé', prave: 'pravé' }, p.smer)}</select></label>
        <label class="k">Zámok<select name="kovanie">${opt(F.KOVANIE, p.kovanie)}</select></label>
        <label class="k">Mriežka<select name="mriezka">${opt(F.MRIEZKY, p.mriezka)}</select></label>
        <label class="k chk"><input type="checkbox" name="prah" ${p.prah ? 'checked' : ''}> výsuvný prah</label>
        <label class="k">Skrátenie krídla (mm)<input name="skratenie" type="number" min="0" max="100" value="${p.skratenie || 0}"></label>
        <label class="k chk"><input type="checkbox" name="so_zarubnou" ${p.so_zarubnou !== false ? 'checked' : ''}> so zárubňou</label>
        <label class="z">Hrúbka steny (mm)<input name="stena" type="number" min="80" max="400" value="${p.stena}"></label>
        <label class="z">Farba zárubne<select name="farba_zarubne">${opt(F.FARBY, p.farba_zarubne)}</select></label>
        <label class="z">Rohový spoj<select name="spoj">${opt({ pokos: 'na pokos 45°', tupo: 'na tupo 90°' }, p.spoj)}</select></label>
        <label class="z k">Závesy<select name="zavesy">${opt(F.ZAVESY, p.zavesy)}</select></label>
        <label class="z">Skrátenie zárubne (mm)<input name="skratenie_zar" type="number" min="0" max="100" value="${p.skratenie_zar || 0}"></label>
      </div>
      <div class="pf-preview" id="pfPrev"></div>
    </form>`;
  }
  function citajPoziciu(form, base) {
    const fd = new FormData(form), p = Object.assign({}, base);
    ['druh', 'nazov', 'kolekcia', 'prevedenie', 'farba', 'sirka', 'vyska', 'smer', 'kovanie', 'mriezka', 'farba_zarubne', 'spoj', 'zavesy'].forEach(k => p[k] = fd.get(k));
    ['ks', 'stena', 'skratenie', 'skratenie_zar'].forEach(k => p[k] = +fd.get(k) || 0);
    p.ks = Math.max(1, p.ks); p.prah = !!fd.get('prah'); p.so_zarubnou = !!fd.get('so_zarubnou');
    if (p.druh === 'zarubna') { p.smer = 'slepa'; p.so_zarubnou = true; }
    return p;
  }
  function nahladPozicie(p) {
    const out = [];
    if (F.maKridlo(p)) {
      const kr = F.kridlo(p), c = F.kodKridla(p);
      out.push(`<div class="pv"><h4>Krídlo <span class="mono">${kr.w} × ${kr.h}</span></h4>${F.svgKridlo(p, { h: 190 })}<div class="pv-code">${F.barcode(c.kod, { h: 28, w: 1.1 })}${F.rozpisKodu(c.kod, F.POLIA_KRIDLA)}</div>
        <p class="muted">polotovar ${kr.polotovarH} mm${kr.prirez ? ` → prirezanie ${kr.prirez} mm` : ''}</p></div>`);
    }
    if (F.maZarubnu(p)) {
      const zr = F.zarubna(p);
      out.push(`<div class="pv"><h4>Zárubňa ${zr.typ}${zr.tupo ? ' tupo' : ''} <span class="mono">${zr.oblW} × ${zr.oblH}</span></h4>${F.svgZarubna(p, zr, { h: 190 })}
        <p class="muted">stena ${zr.min}–${zr.max} mm${zr.ext ? ` · rozšírenie ${zr.r180 ? zr.r180 + '× R180 ' : ''}${zr.r90 ? 'R90' : ''}` : ''}${zr.chyba ? ' · <b class="neg">mimo rozsahu</b>' : ''}</p>
        <div class="pv-parts">${zr.dielce.map(d => `<div><b>${d.nazov}</b> <span class="mono">${d.dlzObl}</span><div class="mono small">${d.kod}</div></div>`).join('')}</div>${F.svgProfil(zr, { w: 150 })}</div>`);
    }
    return out.join('');
  }
  function bindPozForm(base, onChange) {
    const f = $('#pozForm'), upd = () => {
      const p = citajPoziciu(f, base);
      f.classList.toggle('is-slepa', p.druh === 'zarubna');
      f.classList.toggle('no-zar', p.druh !== 'zarubna' && !p.so_zarubnou);
      $('#pfPrev').innerHTML = nahladPozicie(p);
      onChange && onChange(p);
    };
    f.addEventListener('input', upd); f.addEventListener('change', upd); upd();
    return () => citajPoziciu(f, base);
  }

  /* ---------- modálne okno ---------- */
  function modal(titul, html, akcie) {
    const m = $('#modal');
    m.innerHTML = `<div class="m-box"><header><h2>${titul}</h2><button class="x" data-close>×</button></header><div class="m-body">${html}</div><footer>${(akcie || []).map((a, i) => `<button class="btn ${a.cls || ''}" data-m="${i}">${a.t}</button>`).join('')}<button class="btn ghost" data-close>Zavrieť</button></footer></div>`;
    m.hidden = false;
    m.onclick = ev => {
      if (ev.target === m || ev.target.closest('[data-close]')) { m.hidden = true; return; }
      const b = ev.target.closest('[data-m]'); if (b) { const r = akcie[+b.dataset.m].f(); if (r !== false) m.hidden = true; }
    };
  }

  /* =====================================================================
     PREHĽAD
     ===================================================================== */
  function vPrehlad() {
    const d = D(), n = F.N();
    const podla = F.groupBy(d.zakazky, z => z.stav);
    const dni = []; let den = F.nextWorkDay(F.today());
    for (let i = 0; i < 10; i++) { dni.push(den); den = F.addWorkDays(den, 1); }
    const kap = dni.map(x => ({ d: x, v: d.davky.filter(v => v.datum === x), kr: F.sum(d.davky.filter(v => v.datum === x), v => F.sum(F.zakazkyDavky(v), z => F.pocty(z).kr)) }));
    const max = Math.max(n.kapacitaKridiel, ...kap.map(k => k.kr));
    const rez = F.rezervacie();
    const podMin = d.karty.filter(k => k.stav - (rez[k.kluc] || 0) < k.min).slice(0, 8);
    const caka = d.zakazky.filter(z => ['potvrdena', 'zamerana'].includes(z.stav) && !z.davka);
    const vyrobene = d.zakazky.filter(z => z.stav === 'hotova' && !z.trasa);
    const kusyVyroba = F.sum(d.zakazky.filter(z => ['v_davke', 'vyroba'].includes(z.stav)), z => F.pocty(z).kr);
    app().innerHTML = `
      <div class="v-head"><div><h1>Prehľad výroby</h1><p class="muted">${F.fmtD(F.today())} · kapacita ${n.kapacitaKridiel} krídel na dávku</p></div><div class="v-act"><a class="btn" href="#/nova">+ Nová zákazka</a><a class="btn ghost" href="#/sken">Skener</a></div></div>
      <div class="kpis">
        <a class="kpi" href="#/zakazky?stav=dopyt"><span>Dopyty / CP</span><b>${(podla.dopyt || []).length}</b></a>
        <a class="kpi" href="#/zakazky?stav=potvrdena"><span>Čaká na zaradenie</span><b>${caka.length}</b><small>${F.sum(caka, z => F.pocty(z).kr)} krídel</small></a>
        <a class="kpi" href="#/davky"><span>Krídla vo výrobe</span><b>${kusyVyroba}</b></a>
        <a class="kpi" href="#/expedicia"><span>Na expedíciu</span><b>${vyrobene.length}</b></a>
        <a class="kpi ${podMin.length ? 'warn' : ''}" href="#/sklad?min=1"><span>Sklad pod minimom</span><b>${d.karty.filter(k => k.stav - (rez[k.kluc] || 0) < k.min).length}</b></a>
      </div>
      <div class="grid2">
        <section class="card"><h2>Obsadenosť dávok – najbližších 10 pracovných dní</h2>
          <div class="capchart">${kap.map(k => `<a class="cap" href="${k.v[0] ? '#/davka/' + k.v[0].id : '#/davky?den=' + k.d}" title="${k.kr} / ${n.kapacitaKridiel} krídel">
            <div class="cap-bar"><i style="height:${100 * k.kr / max}%" class="${k.kr > n.kapacitaKridiel ? 'over' : ''}"></i><em style="bottom:${100 * n.kapacitaKridiel / max}%"></em></div>
            <b>${k.kr || ''}</b><span>${F.dayName(k.d)}<br>${k.d.slice(8)}.${k.d.slice(5, 7)}.</span></a>`).join('')}</div>
          <p class="muted small">Čiarka = kapacita dávky. Kliknutím otvoríte dávku alebo ju naplánujete.</p></section>
        <section class="card"><h2>Zákazky podľa stavu</h2>
          <div class="stavbars">${F.STAVY.map(s => { const c = (podla[s.k] || []).length; return `<a href="#/zakazky?stav=${s.k}" class="sb"><span>${s.n}</span><i style="--c:${s.c};width:${Math.max(c ? 6 : 0, 100 * c / Math.max(1, d.zakazky.length))}%"></i><b>${c}</b></a>`; }).join('')}</div></section>
      </div>
      <div class="grid2">
        <section class="card"><h2>Čaká na zaradenie do dávky</h2>${caka.length ? `<table class="t"><tbody>${caka.map(z => { const t = F.terminExpedicie(z); return `<tr><td><a href="#/zakazka/${z.id}">${z.id}</a></td><td>${e(z.zakaznik.nazov)}</td><td>${F.pocty(z).kr} kr.</td><td>${t.dost.ok ? '<span class="ok">materiál OK</span>' : `<span class="neg">chýba do ${F.fmtD(t.dost.materialOd)}</span>`}</td><td class="r">exp. ${F.fmtD(t.expedicia)}</td></tr>`; }).join('')}</tbody></table><a class="btn sm" href="#/davky?nova=1">Naplánovať dávku</a>` : '<p class="muted">Nič nečaká.</p>'}</section>
        <section class="card"><h2>Sklad – treba objednať</h2>${podMin.length ? `<table class="t"><tbody>${podMin.map(k => `<tr><td>${e(F.kartaNazov(k.kluc))}</td><td class="r neg">${+(k.stav - (rez[k.kluc] || 0)).toFixed(1)} ${F.kartaJednotka(k.kluc)}</td><td class="r muted">min ${k.min}</td><td class="r">${k.objednane ? `obj. ${k.objednane} · ${F.fmtD(k.prichod)}` : ''}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Všetko nad minimom.</p>'}</section>
      </div>`;
  }

  /* =====================================================================
     ZÁKAZKY
     ===================================================================== */
  function vZakazky(q) {
    const d = D(), st = q.get('stav') || '', hl = (q.get('q') || '').toLowerCase();
    let list = d.zakazky.slice().reverse();
    if (st) list = list.filter(z => z.stav === st);
    if (hl) list = list.filter(z => (z.id + ' ' + z.zakaznik.nazov + ' ' + (z.ponuka || '')).toLowerCase().includes(hl));
    app().innerHTML = `<div class="v-head"><div><h1>Zákazky</h1><p class="muted">${d.zakazky.length} zákaziek</p></div><div class="v-act"><a class="btn" href="#/nova">+ Nová zákazka</a></div></div>
      <div class="filters"><a href="#/zakazky" class="fchip ${!st ? 'on' : ''}">všetky</a>${F.STAVY.map(s => `<a href="#/zakazky?stav=${s.k}" class="fchip ${st === s.k ? 'on' : ''}" style="--c:${s.c}">${s.n} <i>${d.zakazky.filter(z => z.stav === s.k).length}</i></a>`).join('')}
        <input type="search" id="zq" placeholder="hľadať…" value="${e(q.get('q') || '')}"></div>
      <table class="t zt"><thead><tr><th>Zákazka</th><th>Zákazník</th><th>Položky</th><th class="r">Kr.</th><th class="r">Zár.</th><th>Stav</th><th>Dávka</th><th>Termín</th></tr></thead><tbody>
      ${list.map(z => { const c = F.pocty(z); return `<tr data-href="#/zakazka/${z.id}"><td><b>${z.id}</b>${z.ponuka ? `<br><small class="muted">${e(z.ponuka)}</small>` : ''}</td>
        <td>${e(z.zakaznik.nazov)} <span class="badge ${z.zakaznik.typ}">${z.zakaznik.typ === 'b2b' ? 'B2B ' + e(z.zakaznik.hladina || '') : 'retail'}</span></td>
        <td class="minis">${(z.polozky || []).slice(0, 5).map(F.mini).join('')}${z.polozky.length > 5 ? `<span>+${z.polozky.length - 5}</span>` : ''}</td>
        <td class="r">${c.kr}</td><td class="r">${c.zar}</td><td>${F.chip(z.stav)}</td><td>${z.davka ? `<a href="#/davka/${z.davka}">${z.davka}</a>` : '–'}</td><td>${z.terminDodania ? F.fmtD(z.terminDodania) : '–'}</td></tr>`; }).join('') || '<tr><td colspan="8" class="empty">Žiadne zákazky.</td></tr>'}
      </tbody></table>`;
    $('#zq').addEventListener('change', ev => go('#/zakazky?' + new URLSearchParams({ stav: st, q: ev.target.value })));
  }

  function vZakazka(id) {
    const z = F.zakazka(id);
    if (!z) { app().innerHTML = '<p class="empty">Zákazka neexistuje.</p>'; return; }
    const i = F.stavIdx(z.stav), dalsi = F.STAVY[i + 1], c = F.pocty(z), t = F.terminExpedicie(z);
    const zk = z.zakaznik;
    app().innerHTML = `
      <div class="v-head"><div><a href="#/zakazky" class="back">← zákazky</a><h1>${z.id} <span class="h-sub">${e(zk.nazov || 'bez mena')}</span></h1><p class="muted">${z.ponuka ? 'z ponuky ' + e(z.ponuka) + ' · ' : ''}${c.kr} krídel · ${c.zar} zárubní · vytvorená ${F.fmtD(z.vytvorena)}</p></div>
        <div class="v-act">${dalsi ? `<button class="btn" data-act="dalsi">→ ${dalsi.n}</button>` : ''}<select id="stavSel" class="btn ghost">${F.STAVY.map(s => `<option value="${s.k}" ${s.k === z.stav ? 'selected' : ''}>${s.n}</option>`).join('')}</select></div></div>
      ${F.pipeline(z)}
      <div class="grid3">
        <section class="card"><h2>Zákazník</h2><form id="zkForm" class="kf">
          <label>Názov / meno<input name="nazov" value="${e(zk.nazov)}"></label>
          <label>Typ<select name="typ"><option value="retail" ${zk.typ !== 'b2b' ? 'selected' : ''}>retail (Košice a okolie)</option><option value="b2b" ${zk.typ === 'b2b' ? 'selected' : ''}>B2B partner</option></select></label>
          <label>Cenová hladina<select name="hladina">${opt({ moc: 'MOC', voc: 'VOC', 'voc-10': 'VOC −10 %', 'voc+5': 'VOC +5 %' }, zk.hladina)}</select></label>
          <label>IČO<input name="ico" value="${e(zk.ico || '')}"></label>
          <label class="w">Adresa<input name="adresa" value="${e(zk.adresa || '')}"></label>
          <label>Telefón<input name="telefon" value="${e(zk.telefon || '')}"></label>
          <label>E-mail<input name="email" value="${e(zk.email || '')}"></label>
          <label>Dodať do<input type="date" name="terminDodania" value="${e(z.terminDodania || '')}"></label>
          <label class="chk"><input type="checkbox" name="montaz" ${z.montaz ? 'checked' : ''}> montáž</label>
          <label class="chk"><input type="checkbox" name="zameranie" ${z.zameranie ? 'checked' : ''}> zameranie</label>
          <label class="w">Poznámka<textarea name="poznamka" rows="2">${e(z.poznamka || '')}</textarea></label>
        </form></section>
        <section class="card"><h2>Materiál a termín</h2>
          <div class="term"><div><span>Materiál k dispozícii</span><b class="${t.dost.ok ? 'ok' : 'neg'}">${t.dost.ok ? 'teraz' : F.fmtD(t.dost.materialOd)}</b></div><div><span>Najbližšia voľná dávka</span><b>${F.fmtD(t.davkaDen)}</b></div><div><span>Najskoršia expedícia</span><b>${F.fmtD(t.expedicia)}</b></div></div>
          <table class="t slim"><tbody>${t.dost.riadky.map(r => `<tr class="${r.chyba ? 'warn' : ''}"><td>${e(F.kartaNazov(r.kluc))}</td><td class="r">${+r.potreba.toFixed(2)} ${r.jednotka}</td><td class="r ${r.chyba ? 'neg' : 'muted'}">${r.chyba ? 'chýba ' + r.chyba : 'voľné ' + r.volne}</td></tr>`).join('')}</tbody></table>
          <p class="muted small">${['potvrdena', 'zamerana', 'v_davke', 'vyroba'].includes(z.stav) && !z.vydane ? 'Materiál je pre túto zákazku rezervovaný.' : z.vydane ? 'Materiál vydaný zo skladu.' : 'Rezervácia vznikne potvrdením objednávky.'}</p>
          ${!z.davka && F.stavIdx(z.stav) >= 1 ? `<button class="btn sm" data-act="zaradit" data-den="${t.davkaDen}">Zaradiť do dávky ${F.fmtD(t.davkaDen)}</button>` : z.davka ? `<p>Dávka <a href="#/davka/${z.davka}">${z.davka}</a></p>` : ''}
        </section>
        <section class="card"><h2>Financie a dokumenty</h2><form id="finForm" class="kf">
          <label>Záloha<select name="zaloha">${opt({ nie: 'nežiada sa', ziadana: 'vyžiadaná', uhradena: 'uhradená' }, z.financie?.zaloha)}</select></label>
          <label>Faktúra (číslo z MRP)<input name="faktura" value="${e(z.financie?.faktura || '')}" placeholder="napr. 260412"></label>
          <label>Uhradené<select name="uhradene">${opt({ nie: 'nie', ano: 'áno' }, z.financie?.uhradene || 'nie')}</select></label></form>
          <div class="btns"><a class="btn sm ghost" href="#/doc/komp/${z.id}">Kompletačný list</a><a class="btn sm ghost" href="#/doc/dl/${z.id}">Dodací list</a><a class="btn sm ghost" href="#/doc/stitky-z/${z.id}">Štítky</a><button class="btn sm ghost" data-act="mrp">CSV pre MRP</button><button class="btn sm ghost" data-act="json">JSON</button></div>
          <p class="muted small">Faktúru vystaví MRP – sem sa len zapíše jej číslo.</p></section>
      </div>
      <section class="card"><div class="card-h"><h2>Položky</h2><button class="btn sm" data-act="pridat">+ Pozícia</button></div>
        <div class="pozicie">${(z.polozky || []).map((p, j) => pozKarta(z, p, j)).join('')}</div>
        <div class="acc"><h3>Príslušenstvo (kľučky a pod.)</h3>${(z.prislusenstvo || []).map((a, j) => `<div class="acc-row"><span>${e(a.nazov)}</span><span>${a.ks} ks</span><span>${a.cena ? F.eur(F.num(a.cena)) : ''}</span><button class="lnk" data-act="acc-del" data-j="${j}">odstrániť</button></div>`).join('')}
          <form id="accForm" class="acc-add"><input name="nazov" placeholder="napr. Kľučka MP FAN-R nikel" required><input name="ks" type="number" min="1" value="1"><input name="cena" placeholder="cena bez DPH"><button class="btn sm ghost">Pridať</button></form></div>
      </section>
      <section class="card"><h2>História</h2><ul class="hist">${(z.historia || []).map(h => `<li>${F.fmtD(h.t)} ${h.t.slice(11, 16)} – ${F.chip(h.stav)}</li>`).join('') || '<li class="muted">–</li>'}</ul>
        <button class="lnk neg" data-act="zmazat">Zmazať zákazku</button></section>`;

    const save = () => F.save();
    $('#zkForm').addEventListener('change', ev => {
      const fd = new FormData(ev.currentTarget);
      ['nazov', 'typ', 'hladina', 'ico', 'adresa', 'telefon', 'email'].forEach(k => z.zakaznik[k] = fd.get(k));
      z.terminDodania = fd.get('terminDodania'); z.poznamka = fd.get('poznamka'); z.montaz = !!fd.get('montaz'); z.zameranie = !!fd.get('zameranie');
      save(); toast('Uložené', 'ok');
    });
    $('#finForm').addEventListener('change', ev => { const fd = new FormData(ev.currentTarget); z.financie = { zaloha: fd.get('zaloha'), faktura: fd.get('faktura'), uhradene: fd.get('uhradene') }; save(); toast('Uložené', 'ok'); });
    $('#stavSel').addEventListener('change', ev => { F.nastavStav(z, ev.target.value); commit('Stav zmenený'); });
    $('#accForm').addEventListener('submit', ev => { ev.preventDefault(); const fd = new FormData(ev.target); (z.prislusenstvo = z.prislusenstvo || []).push({ nazov: fd.get('nazov'), ks: +fd.get('ks') || 1, cena: fd.get('cena') }); commit('Pridané'); });
    app().onclick = ev => {
      const b = ev.target.closest('[data-act]'); if (!b) return;
      const a = b.dataset.act, j = +b.dataset.j;
      if (a === 'dalsi') { let n = F.STAVY[i + 1]; if (n.k === 'zamerana' && !z.zameranie) n = F.STAVY[i + 2]; if (n.k === 'v_davke' && !z.davka) { toast('Zaraďte zákazku do dávky', 'err'); return; } F.nastavStav(z, n.k); commit('Stav: ' + n.n); }
      if (a === 'zaradit') { const den = b.dataset.den; let v = D().davky.find(x => x.datum === den && !x.vydane); if (!v) v = F.vytvorDavku(den, []); F.priradDoDavky(z, v); commit('Zaradené do ' + v.id); }
      if (a === 'mrp') F.stiahni(z.id + '-MRP.csv', F.csvMRP([z]), 'text/csv;charset=utf-8');
      if (a === 'json') F.stiahni(z.id + '.json', JSON.stringify(z, null, 2), 'application/json');
      if (a === 'acc-del') { z.prislusenstvo.splice(j, 1); commit(); }
      if (a === 'zmazat') { if (confirm('Naozaj zmazať zákazku ' + z.id + '?')) { const d = D(); d.zakazky = d.zakazky.filter(x => x !== z); d.davky.forEach(v => v.zakazky = v.zakazky.filter(x => x !== z.id)); d.trasy.forEach(v => v.zastavky = v.zastavky.filter(x => x !== z.id)); F.save(); go('#/zakazky'); } }
      if (a === 'poz-del') { if (confirm('Odstrániť pozíciu?')) { z.polozky.splice(j, 1); z.polozky.forEach((p, k) => p.poradie = k + 1); commit(); } }
      if (a === 'poz-edit' || a === 'pridat') {
        const zamknute = F.stavIdx(z.stav) >= F.stavIdx('vyroba');
        if (zamknute && !confirm('Zákazka je už vo výrobe. Zmena položiek mení výrobnú dokumentáciu. Pokračovať?')) return;
        const base = a === 'pridat' ? Object.assign(NOVA_POZ(), { poradie: z.polozky.length + 1 }) : z.polozky[j];
        modal(a === 'pridat' ? 'Nová pozícia' : `Pozícia ${base.poradie}`, formPozicie(base), [{ t: 'Uložiť', f: () => {
          const p = read(); if (a === 'pridat') z.polozky.push(p); else z.polozky[j] = Object.assign(p, { cena: null });
          commit('Pozícia uložená');
        } }]);
        const read = bindPozForm(base);
      }
    };
  }
  function pozKarta(z, p, j) {
    const kr = F.maKridlo(p) ? F.kridlo(p) : null, zr = F.maZarubnu(p) ? F.zarubna(p) : null;
    return `<article class="poz">
      <div class="poz-vis">${kr ? F.svgKridlo(p, { h: 150 }) : ''}${zr ? F.svgZarubna(p, zr, { h: 150 }) : ''}</div>
      <div class="poz-b"><h3>${p.poradie}. ${e(p.nazov || 'Pozícia')} <span class="qty">${p.ks} ks</span></h3><p>${e(F.popisPozicie(p))}</p>
        <dl>${kr ? `<dt>Krídlo</dt><dd class="mono">${kr.w} × ${kr.h}${kr.prirez ? ` <small>(z ${kr.polotovarH}, −${kr.prirez})</small>` : ''}</dd><dt>Zámok</dt><dd>${e(F.KOVANIE[p.kovanie] || '–')}</dd>${p.mriezka !== 'bez' ? `<dt>Mriežka</dt><dd>${F.MRIEZKY[p.mriezka]}</dd>` : ''}${p.prah ? '<dt>Prah</dt><dd>výsuvný</dd>' : ''}` : ''}
        ${zr ? `<dt>Zárubňa</dt><dd>${zr.typ}${zr.tupo ? ' tupo' : ' pokos'}${zr.ext ? ` + ${zr.r180 ? zr.r180 + '×R180 ' : ''}${zr.r90 ? 'R90' : ''}` : ''}, stena ${p.stena}</dd><dt>Obložka</dt><dd class="mono">${zr.oblW} × ${zr.oblH}</dd>${!zr.slepa ? `<dt>Závesy</dt><dd>${F.ZAVESY[p.zavesy]}</dd>` : ''}` : ''}</dl>
        <div class="codes">${kr ? `<div><small>CNC krídlo</small><code>${F.kodKridla(p).kod}</code></div>` : ''}${zr ? zr.dielce.map(d => `<div><small>${d.nazov}</small><code>${d.kod}</code></div>`).join('') : ''}</div>
        ${p.cena && p.cena.spolu ? `<p class="price">${F.eur(p.cena.spolu)}</p>` : ''}
        <div class="poz-a"><button class="lnk" data-act="poz-edit" data-j="${j}">upraviť</button><button class="lnk neg" data-act="poz-del" data-j="${j}">odstrániť</button></div></div>
    </article>`;
  }

  /* ---------- nová zákazka ---------- */
  function vNova() {
    const web = F.ponukaZWebu(), maWeb = web && web.polozky && web.polozky.length;
    let polozky = [];
    app().innerHTML = `<div class="v-head"><div><a href="#/zakazky" class="back">← zákazky</a><h1>Nová zákazka</h1></div></div>
      <div class="grid3 src">
        <section class="card src-card ${maWeb ? 'hi' : ''}"><h2>Z kalkulačky na webe</h2>
          ${maWeb ? `<p>V tomto prehliadači je rozpracovaná ponuka <b>${e(web.id)}</b> (${web.polozky.length} pozícií).</p><div class="minis">${web.polozky.slice(0, 6).map(p => F.mini(F.normPolozky({ polozky: [p] })[0])).join('')}</div><button class="btn" data-act="web">Načítať ponuku</button>` : `<p class="muted">V tomto prehliadači nie je rozpracovaná ponuka. Otvorte <a href="../kalkulacka.html" target="_blank">kalkulačku</a>, zostavte ponuku a vráťte sa sem – načíta sa automaticky.</p>`}
          ${maWeb ? '' : ''}<p class="muted small">Funguje, keď výroba beží na tej istej doméne ako web (GitHub Pages / fortissima.sk).</p></section>
        <section class="card src-card"><h2>Zo súboru</h2><p>Súbor <b>JSON</b> alebo <b>CSV</b> exportovaný z kalkulačky (tlačidlá „JSON“ / „CSV pre import“), napr. z e-mailu od zákazníka alebo partnera.</p>
          <label class="btn ghost file">Vybrať súbor<input type="file" id="file" accept=".json,.csv" hidden></label></section>
        <section class="card src-card"><h2>Ručne</h2><p>Zadajte pozície priamo – s okamžitým náhľadom krídla, zárubne a CNC kódov.</p><button class="btn ghost" data-act="rucne">Pridať pozíciu</button></section>
      </div>
      <section class="card"><h2>Zákazník</h2><form id="zkNew" class="kf">
        <label>Názov / meno<input name="nazov" required></label><label>Typ<select name="typ"><option value="retail">retail (Košice a okolie)</option><option value="b2b">B2B partner</option></select></label>
        <label>Hladina<select name="hladina">${opt({ moc: 'MOC', voc: 'VOC', 'voc-10': 'VOC −10 %', 'voc+5': 'VOC +5 %' }, 'moc')}</select></label><label>IČO<input name="ico"></label>
        <label class="w">Adresa<input name="adresa"></label><label>Telefón<input name="telefon"></label><label>E-mail<input name="email"></label>
        <label class="chk"><input type="checkbox" name="montaz"> montáž</label><label class="chk"><input type="checkbox" name="zameranie"> zameranie</label></form></section>
      <section class="card"><div class="card-h"><h2>Pozície <span id="pocet" class="muted"></span></h2><button class="btn" data-act="vytvorit">Vytvoriť zákazku</button></div><div id="nPoz" class="pozicie"></div></section>`;
    let ponuka = null;
    const render = () => {
      $('#nPoz').innerHTML = polozky.map((p, j) => `<article class="poz"><div class="poz-vis">${F.maKridlo(p) ? F.svgKridlo(p, { h: 120 }) : ''}${F.maZarubnu(p) ? F.svgZarubna(p, null, { h: 120 }) : ''}</div><div class="poz-b"><h3>${j + 1}. ${e(p.nazov || 'Pozícia')} <span class="qty">${p.ks} ks</span></h3><p>${e(F.popisPozicie(p))}</p><button class="lnk neg" data-act="ndel" data-j="${j}">odstrániť</button></div></article>`).join('') || '<p class="muted">Zatiaľ žiadne pozície.</p>';
      $('#pocet').textContent = polozky.length ? `· ${polozky.length}` : '';
    };
    const nacitaj = pon => {
      ponuka = pon; polozky = F.normPolozky(pon);
      const f = $('#zkNew');
      if (pon.hladina && pon.hladina.partner) { f.nazov.value = pon.hladina.partner; f.typ.value = 'b2b'; f.hladina.value = pon.hladina.kod; }
      if (pon.montaz) f.montaz.checked = f.zameranie.checked = true;
      render(); toast(`Načítaných ${polozky.length} pozícií`, 'ok');
    };
    render();
    $('#file').addEventListener('change', ev => {
      const fl = ev.target.files[0]; if (!fl) return;
      fl.text().then(txt => { try { nacitaj(/\.csv$/i.test(fl.name) ? F.ponukaZCsv(txt) : JSON.parse(txt)); } catch (er) { toast('Súbor sa nepodarilo načítať', 'err'); } });
    });
    app().onclick = ev => {
      const b = ev.target.closest('[data-act]'); if (!b) return;
      const a = b.dataset.act;
      if (a === 'web') nacitaj(web);
      if (a === 'ndel') { polozky.splice(+b.dataset.j, 1); render(); }
      if (a === 'rucne') {
        const base = Object.assign(NOVA_POZ(), { poradie: polozky.length + 1 });
        modal('Nová pozícia', formPozicie(base), [{ t: 'Pridať', f: () => { polozky.push(read()); render(); } }]);
        const read = bindPozForm(base);
      }
      if (a === 'vytvorit') {
        const f = $('#zkNew');
        if (!f.nazov.value.trim()) { f.nazov.focus(); toast('Vyplňte zákazníka', 'err'); return; }
        if (!polozky.length) { toast('Pridajte aspoň jednu pozíciu', 'err'); return; }
        const fd = new FormData(f);
        const z = F.zPonuky(Object.assign({}, ponuka || {}, { polozky }), { nazov: fd.get('nazov'), typ: fd.get('typ'), hladina: fd.get('hladina'), ico: fd.get('ico'), adresa: fd.get('adresa'), telefon: fd.get('telefon'), email: fd.get('email') });
        z.polozky = polozky.map((p, j) => Object.assign(p, { poradie: j + 1 }));
        z.montaz = !!fd.get('montaz'); z.zameranie = !!fd.get('zameranie');
        D().zakazky.push(z); F.save(); toast('Zákazka ' + z.id + ' vytvorená', 'ok'); go('#/zakazka/' + z.id);
      }
    };
  }

  /* =====================================================================
     DÁVKY
     ===================================================================== */
  function vDavky(q) {
    const d = D(), n = F.N();
    const volne = d.zakazky.filter(z => ['potvrdena', 'zamerana'].includes(z.stav) && !z.davka);
    const davky = d.davky.slice().sort((a, b) => b.datum.localeCompare(a.datum));
    app().innerHTML = `<div class="v-head"><div><h1>Výrobné dávky</h1><p class="muted">balík zákaziek do výroby · kapacita ${n.kapacitaKridiel} krídel</p></div></div>
      <section class="card plan"><h2>Naplánovať novú dávku</h2>
        <div class="plan-top"><label>Deň výroby<input type="date" id="pDen" value="${q.get('den') || F.volnaKapacita(F.today(), 0)}"></label><button class="btn ghost sm" data-act="auto">Auto-naplniť podľa termínu</button>
          <div class="meter"><div><i id="pBar"></i></div><span id="pTxt"></span></div><button class="btn" data-act="vytvor">Vytvoriť dávku</button></div>
        ${volne.length ? `<table class="t"><thead><tr><th></th><th>Zákazka</th><th>Zákazník</th><th>Položky</th><th class="r">Krídla</th><th class="r">Zárubne</th><th>Materiál</th><th>Dodať do</th></tr></thead><tbody>
        ${volne.map(z => { const c = F.pocty(z), ds = F.dostupnost(z); return `<tr><td><input type="checkbox" class="pz" value="${z.id}" data-kr="${c.kr}"></td><td><a href="#/zakazka/${z.id}">${z.id}</a></td><td>${e(z.zakaznik.nazov)}</td><td class="minis">${z.polozky.slice(0, 4).map(F.mini).join('')}</td><td class="r">${c.kr}</td><td class="r">${c.zar}</td><td>${ds.ok ? '<span class="ok">OK</span>' : `<span class="neg">od ${F.fmtD(ds.materialOd)}</span>`}</td><td>${F.fmtD(z.terminDodania)}</td></tr>`; }).join('')}</tbody></table>` : '<p class="muted">Žiadne potvrdené zákazky nečakajú na zaradenie.</p>'}
      </section>
      <section class="card"><h2>Dávky</h2><table class="t"><thead><tr><th>Dávka</th><th>Deň</th><th>Zákazky</th><th>Obsadenosť</th><th>Výdaj</th><th>Stav</th><th></th></tr></thead><tbody>
      ${davky.map(v => { const z = F.zakazkyDavky(v), kr = F.sum(z, x => F.pocty(x).kr); return `<tr data-href="#/davka/${v.id}"><td><b>${v.id}</b></td><td>${F.dayName(v.datum)} ${F.fmtD(v.datum)}</td><td>${z.map(x => e(x.zakaznik.nazov.split(' ')[0])).join(', ')}</td>
        <td><div class="meter sm"><div><i style="width:${Math.min(100, 100 * kr / n.kapacitaKridiel)}%" class="${kr > n.kapacitaKridiel ? 'over' : ''}"></i></div><span>${kr}/${n.kapacitaKridiel}</span></div></td><td>${v.vydane ? '<span class="ok">vydané</span>' : 'čaká'}</td><td>${v.hotove ? '<span class="ok">hotová</span>' : v.vydane ? 'vo výrobe' : 'plánovaná'}</td><td><a href="#/davka/${v.id}">otvoriť →</a></td></tr>`; }).join('') || '<tr><td colspan="7" class="empty">Zatiaľ žiadne dávky.</td></tr>'}</tbody></table></section>`;
    const upd = () => { const kr = F.sum([...document.querySelectorAll('.pz:checked')], x => +x.dataset.kr); $('#pBar').style.width = Math.min(100, 100 * kr / n.kapacitaKridiel) + '%'; $('#pBar').className = kr > n.kapacitaKridiel ? 'over' : ''; $('#pTxt').textContent = `${kr} / ${n.kapacitaKridiel} krídel`; };
    app().onchange = upd; upd();
    app().onclick = ev => {
      const b = ev.target.closest('[data-act]'); if (!b) return;
      if (b.dataset.act === 'auto') {
        let kr = 0; const rows = [...document.querySelectorAll('.pz')].map(x => ({ x, z: F.zakazka(x.value) })).sort((a, c) => (a.z.terminDodania || '9').localeCompare(c.z.terminDodania || '9') || a.z.id.localeCompare(c.z.id));
        rows.forEach(r => { const k = +r.x.dataset.kr; r.x.checked = kr + k <= n.kapacitaKridiel && F.dostupnost(r.z).ok; if (r.x.checked) kr += k; });
        upd();
      }
      if (b.dataset.act === 'vytvor') {
        const ids = [...document.querySelectorAll('.pz:checked')].map(x => x.value);
        if (!ids.length) { toast('Vyberte zákazky', 'err'); return; }
        const v = F.vytvorDavku($('#pDen').value || F.today(), ids); F.save(); toast('Dávka ' + v.id + ' vytvorená', 'ok'); go('#/davka/' + v.id);
      }
    };
  }

  const DOCS_DAVKY = [['vydajka', 'Výdajka'], ['cnc-kridla', 'CNC krídla'], ['priprava', 'Príprava zárubní'], ['cnc-zarubne', 'CNC zárubne'], ['komp', 'Kompletačné listy'], ['stitky', 'Štítky']];
  function vDavka(id, doc) {
    const v = F.davka(id); if (!v) { app().innerHTML = '<p class="empty">Dávka neexistuje.</p>'; return; }
    const n = F.N(), zak = F.zakazkyDavky(v), kr = F.sum(zak, z => F.pocty(z).kr), kusy = F.kusyDavky(v);
    const cnc = kusy.filter(k => (k.typ === 'kridlo' || k.typ === 'dielec') && F.skenKusu(k.id).cnc).length, cncAll = kusy.filter(k => k.typ === 'kridlo' || k.typ === 'dielec').length;
    doc = doc || 'vydajka';
    let html = '';
    if (doc === 'vydajka') html = F.docVydajka(v);
    if (doc === 'cnc-kridla') html = F.docCncKridla(v);
    if (doc === 'priprava') html = F.docPripravaZarubni(v);
    if (doc === 'cnc-zarubne') html = F.docCncZarubne(v);
    if (doc === 'komp') html = zak.map(F.docKompletacia).join('');
    if (doc === 'stitky') html = F.docStitky(kusy);
    app().innerHTML = `<div class="v-head no-print"><div><a href="#/davky" class="back">← dávky</a><h1>${v.id} <span class="h-sub">${F.dayName(v.datum)} ${F.fmtD(v.datum)}</span></h1>
        <p class="muted">${zak.length} zákaziek · ${kr}/${n.kapacitaKridiel} krídel · CNC ${cnc}/${cncAll} kusov</p></div>
        <div class="v-act">${!v.vydane ? '<button class="btn" data-act="vydat">Vydať materiál zo skladu</button>' : `<span class="ok">✓ vydané ${F.fmtD(v.vydane)}</span>`}${v.vydane && !v.hotove ? '<button class="btn ghost" data-act="hotova">Označiť dávku hotovú</button>' : ''}<button class="btn ghost" data-act="tlac">Tlačiť</button></div></div>
      <div class="davka-z no-print">${zak.map(z => `<span class="dz"><a href="#/zakazka/${z.id}">${z.id}</a> ${e(z.zakaznik.nazov)} · ${F.pocty(z).kr} kr. ${F.chip(z.stav)}<button class="x" data-act="odobrat" data-id="${z.id}" title="vyradiť z dávky">×</button></span>`).join('')}</div>
      <nav class="tabs no-print">${DOCS_DAVKY.map(([k, t]) => `<a href="#/davka/${v.id}/${k}" class="${k === doc ? 'on' : ''}">${t}</a>`).join('')}</nav>
      <div class="docs">${html}</div>`;
    app().onclick = ev => {
      const b = ev.target.closest('[data-act]'); if (!b) return;
      const a = b.dataset.act;
      if (a === 'tlac') window.print();
      if (a === 'vydat') {
        const chyb = [];
        zak.forEach(z => { const pt = F.potreba(z); for (const k in pt) { const kk = F.karta(k); if (!kk || kk.stav < pt[k]) chyb.push(F.kartaNazov(k)); } });
        if (chyb.length && !confirm('Na sklade chýba:\n' + [...new Set(chyb)].slice(0, 10).join('\n') + '\n\nVydať aj tak (stav pôjde do mínusu)?')) return;
        F.vydajDavky(v); commit('Materiál vydaný – zákazky sú vo výrobe');
      }
      if (a === 'hotova') { v.hotove = true; commit('Dávka označená ako hotová'); }
      if (a === 'odobrat') { const z = F.zakazka(b.dataset.id); if (v.vydane && !confirm('Materiál už bol vydaný. Vyradiť aj tak?')) return; v.zakazky = v.zakazky.filter(x => x !== z.id); z.davka = null; if (z.stav === 'v_davke') F.nastavStav(z, 'potvrdena'); commit('Vyradené'); }
    };
  }

  /* =====================================================================
     SKLAD
     ===================================================================== */
  function vSklad(q) {
    const d = D(), rez = F.rezervacie(), lenMin = q.get('min') === '1', tab = q.get('tab') || 'karty';
    // doplniť karty, ktoré vyžadujú zákazky
    d.zakazky.forEach(z => Object.keys(F.potreba(z)).forEach(k => F.zaistiKartu(k)));
    let karty = d.karty.slice().sort((a, b) => a.kluc.localeCompare(b.kluc));
    if (lenMin) karty = karty.filter(k => k.stav - (rez[k.kluc] || 0) < k.min);
    const skup = F.groupBy(karty, k => F.kartaSkupina(k.kluc));
    app().innerHTML = `<div class="v-head"><div><h1>Sklad</h1><p class="muted">polotovary, profily a kovanie · rezervované = potvrdené zákazky ešte nevydané</p></div>
      <div class="v-act"><a class="btn ghost ${lenMin ? 'on' : ''}" href="#/sklad${lenMin ? '' : '?min=1'}">${lenMin ? 'Zobraziť všetko' : 'Len pod minimom'}</a><a class="btn ghost" href="#/sklad?tab=pohyby">Pohyby</a><button class="btn" data-act="prijem">+ Príjem</button></div></div>
      ${tab === 'pohyby' ? `<section class="card"><h2>Pohyby</h2><table class="t"><thead><tr><th>Čas</th><th>Položka</th><th class="r">Množstvo</th><th>Typ</th><th>Doklad</th></tr></thead><tbody>${d.pohyby.slice(0, 300).map(p => `<tr><td>${F.fmtD(p.t)} ${p.t.slice(11, 16)}</td><td>${e(F.kartaNazov(p.kluc))}</td><td class="r ${p.mnozstvo < 0 ? 'neg' : 'ok'}">${p.mnozstvo > 0 ? '+' : ''}${+p.mnozstvo.toFixed(2)}</td><td>${e(p.typ)}</td><td>${e(p.doklad || '')}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">Žiadne pohyby.</td></tr>'}</tbody></table></section>` :
      Object.keys(skup).map(s => `<section class="card"><h2>${s}</h2><table class="t sklad"><thead><tr><th>Položka</th><th class="r">Na sklade</th><th class="r">Rezerv.</th><th class="r">Voľné</th><th class="r">Min.</th><th class="r">Objednané</th><th>Príchod</th><th></th></tr></thead><tbody>
        ${skup[s].map(k => { const r = +(rez[k.kluc] || 0).toFixed(2), vol = +(k.stav - r).toFixed(2), j = F.kartaJednotka(k.kluc); return `<tr class="${vol < k.min ? 'warn' : ''}" data-k="${e(k.kluc)}">
          <td>${e(F.kartaNazov(k.kluc))}</td><td class="r"><b>${+k.stav.toFixed(2)}</b> ${j}</td><td class="r muted">${r || ''}</td><td class="r ${vol < 0 ? 'neg' : vol < k.min ? 'warnc' : ''}">${vol}</td>
          <td class="r"><input class="num" data-f="min" value="${k.min}"></td><td class="r"><input class="num" data-f="objednane" value="${k.objednane || 0}"></td><td><input type="date" data-f="prichod" value="${k.prichod || ''}"></td>
          <td class="r"><button class="lnk" data-act="inv">inventúra</button>${k.objednane ? ' <button class="lnk" data-act="naskladnit">naskladniť</button>' : ''}</td></tr>`; }).join('')}</tbody></table></section>`).join('')}`;
    app().onchange = ev => {
      const tr = ev.target.closest('[data-k]'), f = ev.target.dataset.f; if (!tr || !f) return;
      const k = F.karta(tr.dataset.k); k[f] = f === 'prichod' ? ev.target.value : F.num(ev.target.value); F.save(); toast('Uložené', 'ok');
    };
    app().onclick = ev => {
      const b = ev.target.closest('[data-act]'); if (!b) return;
      const a = b.dataset.act, tr = b.closest('[data-k]'), k = tr && F.karta(tr.dataset.k);
      if (a === 'inv') { const v = prompt('Inventúra – skutočný stav:\n' + F.kartaNazov(k.kluc), k.stav); if (v == null) return; F.pohyb(k.kluc, F.num(v) - k.stav, 'inventúra', 'INV ' + F.today()); commit('Inventúra zapísaná'); }
      if (a === 'naskladnit') { F.pohyb(k.kluc, k.objednane, 'príjem', 'objednávka ' + (k.prichod || '')); k.objednane = 0; k.prichod = ''; commit('Naskladnené'); }
      if (a === 'prijem') {
        const kl = D().karty.slice().sort((x, y) => x.kluc.localeCompare(y.kluc));
        modal('Príjem na sklad', `<form id="pr" class="kf"><label class="w">Položka<select name="k">${kl.map(x => `<option value="${e(x.kluc)}">${e(F.kartaNazov(x.kluc))}</option>`).join('')}</select></label><label>Množstvo<input name="m" type="number" step="0.01" required></label><label>Doklad<input name="d" placeholder="DL dodávateľa"></label></form>`,
          [{ t: 'Prijať', f: () => { const fd = new FormData($('#pr')); const m = F.num(fd.get('m')); if (!m) return false; F.pohyb(fd.get('k'), m, 'príjem', fd.get('d')); commit('Prijaté'); } }]);
      }
    };
  }

  /* =====================================================================
     EXPEDÍCIA – trasy, nakládka, dodacie listy, export pre MRP
     ===================================================================== */
  function vExpedicia() {
    const d = D(), pripravene = d.zakazky.filter(z => z.stav === 'hotova' && !z.trasa);
    app().innerHTML = `<div class="v-head"><div><h1>Expedícia</h1><p class="muted">trasy rozvozu · nakládka v opačnom poradí ako vykládka</p></div><div class="v-act"><button class="btn" data-act="nova">+ Nová trasa</button></div></div>
      <section class="card"><h2>Pripravené na expedíciu</h2>${pripravene.length ? `<table class="t"><tbody>${pripravene.map(z => `<tr><td><a href="#/zakazka/${z.id}">${z.id}</a></td><td>${e(z.zakaznik.nazov)}</td><td>${e(z.zakaznik.adresa || '')}</td><td>${F.pocty(z).kr} kr. / ${F.pocty(z).zar} zár.</td><td class="r"><select data-z="${z.id}" class="btn ghost sm"><option value="">pridať do trasy…</option>${d.trasy.filter(t => t.stav !== 'expedovana').map(t => `<option value="${t.id}">${t.id} · ${F.fmtD(t.datum)}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table>` : '<p class="muted">Nič nie je pripravené.</p>'}</section>
      ${d.trasy.slice().reverse().map(t => { const zak = t.zastavky.map(F.zakazka).filter(Boolean); return `<section class="card trasa"><div class="card-h"><h2>${t.id} · ${F.dayName(t.datum)} ${F.fmtD(t.datum)} <span class="muted">${e(t.vozidlo || '')} · ${e(t.vodic || '')}</span></h2>
        <div class="btns"><a class="btn sm ghost" href="#/doc/nakladka/${t.id}">Nákladkový list</a><a class="btn sm ghost" href="#/doc/dl-trasa/${t.id}">Dodacie listy</a><button class="btn sm ghost" data-act="mrp" data-t="${t.id}">CSV pre MRP</button>${t.stav !== 'expedovana' ? `<button class="btn sm" data-act="exp" data-t="${t.id}">Expedovať</button>` : '<span class="ok">✓ expedovaná</span>'}</div></div>
        ${F.svgNakladka(zak)}
        <ol class="stops">${zak.map((z, i) => `<li><b>${i + 1}.</b> <a href="#/zakazka/${z.id}">${z.id}</a> ${e(z.zakaznik.nazov)} <span class="muted">${e(z.zakaznik.adresa || '')}</span> ${F.chip(z.stav)}
          ${t.stav !== 'expedovana' ? `<span class="ord"><button class="lnk" data-act="up" data-t="${t.id}" data-i="${i}">↑</button><button class="lnk" data-act="down" data-t="${t.id}" data-i="${i}">↓</button><button class="lnk neg" data-act="rm" data-t="${t.id}" data-i="${i}">odobrať</button></span>` : ''}</li>`).join('') || '<li class="muted">Bez zastávok.</li>'}</ol></section>`; }).join('')}`;
    app().onchange = ev => { const s = ev.target.closest('[data-z]'); if (!s || !s.value) return; const t = F.trasa(s.value), z = F.zakazka(s.dataset.z); t.zastavky.push(z.id); z.trasa = t.id; commit('Pridané do ' + t.id); };
    app().onclick = ev => {
      const b = ev.target.closest('[data-act]'); if (!b) return;
      const a = b.dataset.act, t = b.dataset.t && F.trasa(b.dataset.t), i = +b.dataset.i;
      if (a === 'nova') modal('Nová trasa', `<form id="tf" class="kf"><label>Dátum<input type="date" name="datum" value="${F.nextWorkDay(F.addDays(F.today(), 1))}"></label><label>Vozidlo<input name="vozidlo" placeholder="ŠPZ / typ"></label><label>Vodič<input name="vodic"></label></form>`,
        [{ t: 'Vytvoriť', f: () => { const fd = new FormData($('#tf')); D().trasy.push({ id: F.noveCisloTrasy(), datum: fd.get('datum'), vozidlo: fd.get('vozidlo'), vodic: fd.get('vodic'), zastavky: [], stav: 'planovana' }); commit('Trasa vytvorená'); } }]);
      if (a === 'up' && i > 0) { [t.zastavky[i - 1], t.zastavky[i]] = [t.zastavky[i], t.zastavky[i - 1]]; commit(); }
      if (a === 'down' && i < t.zastavky.length - 1) { [t.zastavky[i + 1], t.zastavky[i]] = [t.zastavky[i], t.zastavky[i + 1]]; commit(); }
      if (a === 'rm') { const z = F.zakazka(t.zastavky[i]); if (z) z.trasa = null; t.zastavky.splice(i, 1); commit(); }
      if (a === 'mrp') F.stiahni(t.id + '-MRP.csv', F.csvMRP(t.zastavky.map(F.zakazka).filter(Boolean)), 'text/csv;charset=utf-8');
      if (a === 'exp') {
        const zak = t.zastavky.map(F.zakazka).filter(Boolean), nen = zak.filter(z => F.stavIdx(z.stav) < F.stavIdx('hotova'));
        if (nen.length && !confirm('Niektoré zákazky nie sú skompletizované:\n' + nen.map(z => z.id).join(', ') + '\nExpedovať aj tak?')) return;
        zak.forEach(z => { F.nastavStav(z, 'expedovana'); z.datumy.expedovana = t.datum; }); t.stav = 'expedovana'; commit('Trasa expedovaná – podklady pre MRP sú pripravené');
      }
    };
  }

  /* =====================================================================
     SKENER – čítačka čiarových kódov funguje ako klávesnica (kód + Enter)
     ===================================================================== */
  const OPS = { cnc: 'CNC opracované', kompletacia: 'Kompletácia', nakladka: 'Nakládka' };
  let skenOp = 'cnc', skenLog = [];
  function vSken() {
    app().innerHTML = `<div class="v-head"><div><h1>Skener</h1><p class="muted">Čítačka čiarových kódov píše ako klávesnica – stačí mať kurzor v poli. Funguje kód kusu aj CNC kód.</p></div></div>
      <div class="scan-ops">${Object.entries(OPS).map(([k, t]) => `<button class="sop ${k === skenOp ? 'on' : ''}" data-op="${k}">${t}</button>`).join('')}</div>
      <form id="sf" class="scan"><input id="si" autocomplete="off" autofocus placeholder="naskenujte alebo napíšte kód a Enter"><button class="btn">OK</button></form>
      <div id="sres"></div>
      <section class="card"><h2>Posledné skeny</h2><ul class="slog">${skenLog.map(x => `<li class="${x.ok ? 'ok' : 'neg'}">${x.t} · ${e(x.msg)}</li>`).join('') || '<li class="muted">–</li>'}</ul></section>`;
    const si = $('#si'); si.focus();
    app().onclick = ev => { const b = ev.target.closest('[data-op]'); if (b) { skenOp = b.dataset.op; vSken(); } };
    $('#sf').addEventListener('submit', ev => {
      ev.preventDefault();
      const kod = si.value.trim(), KU = kod.toUpperCase(); si.value = ''; if (!kod) return;
      let kus = F.najdiKus(KU);
      if (!kus) { // CNC kód → prvý neopracovaný kus s týmto kódom v otvorených dávkach
        const kand = D().davky.filter(v => !v.hotove).flatMap(F.kusyDavky).filter(k => (k.typ === 'kridlo' && F.kodKridla(k.p).kod.toUpperCase() === KU) || (k.typ === 'dielec' && k.dielec.kod.toUpperCase() === KU));
        kus = kand.find(k => !F.skenKusu(k.id)[skenOp]) || kand[0];
      }
      const cas = new Date().toTimeString().slice(0, 8);
      if (!kus) { beep(false); skenLog.unshift({ t: cas, ok: false, msg: kod + ' – neznámy kód' }); $('#sres').innerHTML = `<div class="sres bad"><b>Neznámy kód</b><span class="mono">${e(kod)}</span></div>`; return renderLog(); }
      const nove = F.zaznamenajSken(kus.id, skenOp); F.save();
      const z = kus.z, kusy = F.kusy(z), hotovo = kusy.filter(k => F.skenKusu(k.id)[skenOp]).length;
      beep(nove);
      skenLog.unshift({ t: cas, ok: nove, msg: `${kus.id} · ${kus.nazov} · ${nove ? OPS[skenOp] : 'už zaznamenané'}` });
      $('#sres').innerHTML = `<div class="sres ${nove ? 'good' : 'dup'}"><div class="sres-v">${kus.p ? (kus.typ === 'dielec' ? F.svgZarubna(kus.p, kus.zar, { h: 140, hl: kus.dielec.id }) : F.svgKridlo(kus.p, { h: 140 })) : ''}</div>
        <div><b>${nove ? '✓ ' + OPS[skenOp] : 'Už zaznamenané'}</b><h3>${e(kus.nazov)}</h3><p>${e(z.id)} · ${e(z.zakaznik.nazov)}${kus.p ? ` · poz. ${kus.p.poradie} ${e(kus.p.nazov || '')}` : ''}</p>
        <div class="prog big"><i style="width:${100 * hotovo / kusy.length}%"></i></div><p>${hotovo} / ${kusy.length} kusov zákazky – ${OPS[skenOp].toLowerCase()}${hotovo === kusy.length ? ' · <b class="ok">zákazka kompletná</b>' : ''}</p></div></div>`;
      renderLog();
    });
    function renderLog() { skenLog = skenLog.slice(0, 30); document.querySelector('.slog').innerHTML = skenLog.map(x => `<li class="${x.ok ? 'ok' : 'neg'}">${x.t} · ${e(x.msg)}</li>`).join(''); }
  }
  function beep(ok) { try { const a = new (window.AudioContext || window.webkitAudioContext)(), o = a.createOscillator(), g = a.createGain(); o.frequency.value = ok ? 1200 : 300; g.gain.value = .08; o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + (ok ? .09 : .35)); } catch (er) { /* bez zvuku */ } }

  /* =====================================================================
     NASTAVENIA
     ===================================================================== */
  function vNastavenia() {
    const n = F.N();
    const num = (k, l, pozn) => `<label>${l}<input type="number" step="any" data-k="${k}" value="${n[k]}">${pozn ? `<small>${pozn}</small>` : ''}</label>`;
    const tab = (k, l) => `<label class="w">${l}<textarea data-json="${k}" rows="3" class="mono">${e(JSON.stringify(n[k]))}</textarea></label>`;
    app().innerHTML = `<div class="v-head"><div><h1>Nastavenia</h1><p class="muted">Technické pravidlá sú parametre – zmena sa hneď prejaví vo všetkých výstupoch a kódoch.</p></div></div>
      <div class="grid2">
        <section class="card"><h2>Výroba a plánovanie</h2><div class="kf">${num('kapacitaKridiel', 'Kapacita dávky (krídla)')}${num('vyrobaDni', 'Dni od dávky po expedíciu')}${num('dodaciaLehotaDni', 'Dodacia lehota materiálu (dni)')}${num('dlzkaTyce', 'Dĺžka tyče profilov (mm)')}${num('rezPridavok', 'Prídavok na rez (mm)')}${num('dphSadzba', 'DPH %')}${num('dopravaB2B', 'Doprava B2B € / kus')}</div></section>
        <section class="card"><h2>Krídlo</h2><div class="kf">${num('falcPridavokSirka', 'Falc: + šírka')}${num('falcPridavokVyska', 'Falc: + výška')}${num('bezPridavokSirka', 'Bezfalc: + šírka')}${num('bezPridavokVyska', 'Bezfalc: + výška')}${num('hrubkaKridla', 'Hrúbka')}${num('sirkaKoduRamove', 'Rámové: hodnota šírky v kóde')}${tab('polotovarVyska', 'Z akej výšky polotovaru sa robí výška (STN z HU)')}</div></section>
        <section class="card"><h2>Zárubňa</h2><div class="kf">${num('svetlostPridavok', 'Š1 = nominál +')}${num('falcPresah', 'Presah falcu')}${num('ostenieHrubka', 'Hrúbka ostenia')}${num('oblozkaSirka', 'Šírka obložky')}${num('hlbkaKorekcia', 'Hĺbka v kóde = ostenie +')}${tab('ostenieSirka', 'Šírka ostenia podľa typu ⚠ overiť')}</div></section>
        <section class="card"><h2>Kódovacie tabuľky CNC</h2><div class="kf">${tab('kodZamok', 'Zámok → číslica')}${tab('kodMriezka', 'Mriežka → číslica ⚠ overiť')}${tab('kodVyrez', 'Výrez podľa kolekcie')}${tab('kodKonstrukcia', 'Konštrukcia F / M / R')}</div></section>
        <section class="card"><h2>Firma</h2><div class="kf">${Object.keys(n.firma).map(k => `<label>${k}<input data-firma="${k}" value="${e(n.firma[k])}"></label>`).join('')}</div></section>
        <section class="card"><h2>Dáta</h2><p>Dáta sa ukladajú <b>len v tomto prehliadači</b>. Pre zdieľanie medzi počítačmi exportujte zálohu alebo nasaďte serverové úložisko.</p>
          <div class="btns"><button class="btn ghost" data-act="exp">Exportovať zálohu (JSON)</button><label class="btn ghost file">Importovať zálohu<input type="file" id="imp" accept=".json" hidden></label><button class="btn ghost" data-act="demo">Načítať ukážkové dáta</button><button class="btn ghost neg" data-act="clear">Vymazať všetko</button><button class="btn ghost" data-act="def">Obnoviť predvolené pravidlá</button></div></section>
      </div>`;
    app().onchange = ev => {
      const t = ev.target;
      try {
        if (t.dataset.k) n[t.dataset.k] = F.num(t.value);
        if (t.dataset.json) n[t.dataset.json] = JSON.parse(t.value);
        if (t.dataset.firma) n.firma[t.dataset.firma] = t.value;
        F.save(); toast('Uložené', 'ok');
      } catch (er) { toast('Neplatný zápis tabuľky', 'err'); }
    };
    $('#imp').addEventListener('change', ev => { ev.target.files[0].text().then(x => { try { const d = JSON.parse(x); localStorage.setItem('fortissima.vyroba.v1', JSON.stringify(d)); location.reload(); } catch (er) { toast('Neplatný súbor', 'err'); } }); });
    app().onclick = ev => {
      const b = ev.target.closest('[data-act]'); if (!b) return;
      const a = b.dataset.act;
      if (a === 'exp') F.stiahni('fortissima-vyroba-' + F.today() + '.json', JSON.stringify(D(), null, 1), 'application/json');
      if (a === 'demo' && confirm('Nahradiť všetky dáta ukážkovými?')) { F.ukazka(); toast('Ukážkové dáta načítané', 'ok'); go('#/prehlad'); }
      if (a === 'clear' && confirm('Vymazať všetky zákazky, dávky, sklad a trasy?')) { F.reset(); go('#/prehlad'); }
      if (a === 'def' && confirm('Obnoviť predvolené technické pravidlá?')) { const f = n.firma; D().nastavenia = Object.assign(JSON.parse(JSON.stringify(F.DEFAULT_NASTAVENIA)), { firma: f }); F.save(); route(); }
    };
  }

  /* ---------- samostatné dokumenty (zákazka / trasa) ---------- */
  function vDoc(typ, id) {
    let html = '', back = '#/prehlad';
    if (typ === 'komp') { html = F.docKompletacia(F.zakazka(id)); back = '#/zakazka/' + id; }
    if (typ === 'dl') { const z = F.zakazka(id); html = F.docDodaciList(z, z.trasa && F.trasa(z.trasa)); back = '#/zakazka/' + id; }
    if (typ === 'stitky-z') { html = F.docStitky(F.kusy(F.zakazka(id))); back = '#/zakazka/' + id; }
    if (typ === 'nakladka') { html = F.docNakladka(F.trasa(id)); back = '#/expedicia'; }
    if (typ === 'dl-trasa') { const t = F.trasa(id); html = t.zastavky.map(F.zakazka).filter(Boolean).map(z => F.docDodaciList(z, t)).join(''); back = '#/expedicia'; }
    app().innerHTML = `<div class="v-head no-print"><div><a class="back" href="${back}">← späť</a><h1>${e(id)}</h1></div><div class="v-act"><button class="btn" onclick="print()">Tlačiť</button></div></div><div class="docs">${html}</div>`;
  }

  /* =====================================================================
     ROUTER
     ===================================================================== */
  function route() {
    const h = location.hash.slice(1) || '/prehlad', [path, qs] = h.split('?'), q = new URLSearchParams(qs || ''), c = path.split('/').filter(Boolean);
    document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', ('#/' + c[0]).startsWith(a.getAttribute('href')) || (c[0] === 'zakazka' && a.getAttribute('href') === '#/zakazky') || (c[0] === 'davka' && a.getAttribute('href') === '#/davky')));
    app().onclick = null; app().onchange = null;
    const v = { prehlad: vPrehlad, zakazky: () => vZakazky(q), zakazka: () => vZakazka(c[1]), nova: vNova, davky: () => vDavky(q), davka: () => vDavka(c[1], c[2]), sklad: () => vSklad(q), expedicia: vExpedicia, sken: vSken, nastavenia: vNastavenia, doc: () => vDoc(c[1], c[2]) }[c[0]] || vPrehlad;
    v();
    if (q.get('nova') === '1') { const el = document.querySelector('.plan'); el && el.scrollIntoView(); }
    window.scrollTo(0, 0);
  }
  document.addEventListener('click', ev => { const tr = ev.target.closest('tr[data-href]'); if (tr && !ev.target.closest('a,button,input,select')) go(tr.dataset.href); });
  window.addEventListener('hashchange', route);
  window.addEventListener('storage', ev => { if (ev.key === 'fortissima.vyroba.v1') { location.reload(); } });
  document.addEventListener('DOMContentLoaded', () => {
    let first = false;
    try { first = !localStorage.getItem('fortissima.vyroba.v1'); } catch (er) { first = true; }
    if (first) F.ukazka(); else F.load();
    route();
  });
})();
