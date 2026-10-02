<?php
/**
 * Kalkulácia Fortissima – ocení cenovú ponuku (jednu alebo viac položiek).
 * Cenník (CSV) sa nikdy neposiela do prehliadača; ten dostane len výsledok výpočtu.
 *
 *   GET  cena.php?moznosti=1   → zoznam možností (zámky, mriežky, limity skrátenia – bez cien)
 *   Ceny: cenník je VOC bez DPH; podľa prihláseného partnera (partner.php) sa použije jeho hladina, inak MOC.
 *   POST cena.php              → telo JSON:
 *        { "polozky": [ { "uid":"a1", "kolekcia":"minimal", "prevedenie":"falc", "farba":"biela",
 *                         "farba_zarubne":"kasmirova", "sirka":"80", "vyska":"197", "smer":"lave",
 *                         "so_zarubnou":true, "stena":120, "kovanie":"bb-nikel", "zavesy":"nikel", "ks":2 },
 *                       { "uid":"a2", "druh":"zarubna", "farba_zarubne":"biela", "sirka":"80", "vyska":"197",
 *                         "stena":130, "ks":1 }, ... ],
 *          "montaz": true, "doprava": true, "doprava_km": 35 }
 *
 * Každý riadok výsledku má aj "kod" – stabilný kód položky pripravený na import do objednávkového systému.
 */

declare(strict_types=1);
require __DIR__ . '/lib.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

skontroluj_limit((int)$CFG['limit_dopytov'], (int)$CFG['limit_okno_s']);

/** Chyba jednej položky – nezastaví ocenenie ostatných. */
final class ChybaPolozky extends Exception {}


/** VOC cena riadku cenníka (bez DPH); staršie názvy stĺpcov sa berú ako VOC. */
function voc(array $r): float {
    return cislo($r['cena_voc'] ?? $r['cena'] ?? $r['cena_s_dph'] ?? 0);
}
/** Všetky príplatky, ktoré sedia (pre rozpis ceny). */
function priplatky_zoznam(array $riadky, string $polozka, string $sirka, string $vyska, string $predpona = 'Príplatok'): array {
    $out = [];
    foreach ($riadky as $r) {
        if (strtolower($r['polozka'] ?? '') !== $polozka) continue;
        $sOk = in_array($r['sirka'] ?? '*', ['*', '', $sirka], true);
        $vOk = in_array($r['vyska'] ?? '*', ['*', '', $vyska], true);
        // pri vlastných príplatkoch (prah, spoj…) sa popis z cenníka pridá len pri riadku pre konkrétny rozmer
        $spec = !in_array($r['sirka'] ?? '*', ['*', ''], true) || !in_array($r['vyska'] ?? '*', ['*', ''], true);
        $popis = (($r['popis'] ?? '') !== '' && (strpos($predpona, 'Príplatok') === 0 || $spec)) ? ': ' . $r['popis'] : '';
        if ($sOk && $vOk) $out[] = zlozka($predpona . $popis, cislo($r['priplatok_voc'] ?? $r['priplatok_s_dph'] ?? 0),
                                          'priplatky.csv: ' . $polozka . ';' . ($r['sirka'] ?: '*') . ';' . ($r['vyska'] ?: '*'));
    }
    return $out;
}
function priplatky(array $riadky, string $polozka, string $sirka, string $vyska): float {
    return array_sum(array_column(priplatky_zoznam($riadky, $polozka, $sirka, $vyska), 'cena'));
}
/** Jedna zložka ceny pre rozpis: čo, koľko a z ktorého riadku cenníka. */
function zlozka(string $nazov, float $cena, string $zdroj): array {
    return ['zlozka' => $nazov, 'cena' => round($cena, 2), 'zdroj' => $zdroj];
}
function zdroj(string $subor, array $r, array $kluce): string {
    return $subor . ': ' . implode(';', array_map(fn($k) => ($r[$k] ?? '') === '' ? '*' : $r[$k], $kluce));
}
/** Zárubňa podľa hrúbky steny: F80–F160 + rozširovacie elementy po 90 mm. */
function zarubna_pre_stenu(int $d): array {
    $zaklad = [[80, 80, 100], [100, 100, 130], [130, 130, 160], [160, 160, 190]];
    $ext = $d <= 190 ? 0 : 90 * (int)ceil(($d - 190) / 90);
    $zvysok = $d - $ext;
    foreach ($zaklad as [$F, $min, $max]) {
        if ($ext > 0 && $F === 80) continue;
        if ($zvysok >= $min && $zvysok <= $max) return ['F' => $F, 'ext' => $ext, 'min' => $min + $ext, 'max' => $max + $ext];
    }
    throw new ChybaPolozky('Pre túto hrúbku steny nevieme zárubňu určiť.');
}

/* ---------- zoznam kovania pre formulár ---------- */
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    if (isset($_GET['moznosti'])) {
        $kov = array_map(fn($r) => ['kod' => $r['kod'], 'nazov' => $r['nazov']], nacitaj_csv('kovanie.csv'));
        $zav = array_map(fn($r) => ['kod' => $r['kod'], 'nazov' => $r['nazov']], nacitaj_csv('zavesy.csv'));
        $mr = array_map(fn($r) => ['kod' => $r['kod'], 'nazov' => $r['nazov']], nacitaj_csv('mriezky.csv'));
        $sk = array_map(fn($r) => ['kolekcia' => $r['kolekcia'], 'vyska' => $r['vyska'], 'max_mm' => (int)cislo($r['max_mm']),
                                   'max_mm_mriezka' => (int)cislo(($r['max_mm_mriezka'] ?? '') !== '' ? $r['max_mm_mriezka'] : $r['max_mm'])], nacitaj_csv('skratenie.csv'));
        odpoved(['ok' => true, 'kovanie' => array_values($kov), 'zavesy' => array_values($zav), 'mriezky' => array_values($mr), 'skratenie' => array_values($sk)]);
    }
    chyba('Použite POST s položkami ponuky.', 405);
}

/* ---------- vstup ---------- */
$telo = file_get_contents('php://input', false, null, 0, 65536);
$vstup = json_decode((string)$telo, true);
if (!is_array($vstup) || !isset($vstup['polozky']) || !is_array($vstup['polozky'])) chyba('Neplatná požiadavka.');
if (count($vstup['polozky']) < 1 || count($vstup['polozky']) > 40) chyba('Ponuka môže mať 1 až 40 položiek.');

$POVOLENE = [
    'kolekcia'      => ['minimal' => ['Minimal', 'AK1'], 'vertikal' => ['Vertikal', 'XK1'], 'prestige' => ['Prestige', 'QK1']],
    'prevedenie'    => ['falc' => ['falcové', 'F'], 'bez' => ['bezfalcové', 'B']],
    'farba'         => ['biela' => ['biela', 'BIE'], 'kasmirova' => ['kašmírová', 'KAS']],
    'farba_zarubne' => ['biela' => ['biela', 'BIE'], 'kasmirova' => ['kašmírová', 'KAS']],
    'sirka'         => ['60' => [600, '60'], '65' => [650, '65'], '70' => [700, '70'], '80' => [800, '80'], '90' => [900, '90']],
    'vyska'         => ['197' => [1970, '197'], '2055' => [2055, '205,5'], '210' => [2100, '210']],
    'smer'          => ['lave' => ['ľavé', 'L'], 'prave' => ['pravé', 'P']],
];

function ocen_polozku(array $p, array $CFG, array $POV): array {
    // druh položky: "dvere" (krídlo + voliteľne zárubňa) alebo "zarubna" (samostatná slepá/tunelová zárubňa)
    $druh = (string)($p['druh'] ?? 'dvere');
    if (!in_array($druh, ['dvere', 'zarubna'], true)) throw new ChybaPolozky('Neplatný druh položky.');
    $slepa = $druh === 'zarubna';
    $kluce = $slepa ? ['farba_zarubne', 'sirka', 'vyska'] : array_keys($POV);
    $in = [];
    foreach ($kluce as $k) {
        $v = (string)($p[$k] ?? '');
        if (!array_key_exists($v, $POV[$k])) throw new ChybaPolozky("Neplatná hodnota: $k");
        $in[$k] = $v;
    }
    if ($slepa) { $in['prevedenie'] = 'slepa'; $in['smer'] = 'slepa'; }
    // dvere môžu byť aj bez zárubne (napr. do existujúcej zárubne); chýbajúci údaj = so zárubňou
    $soZar = $slepa || !array_key_exists('so_zarubnou', $p) || filter_var($p['so_zarubnou'], FILTER_VALIDATE_BOOLEAN);
    $stena = filter_var($p['stena'] ?? '', FILTER_VALIDATE_INT);
    if ($soZar && ($stena === false || $stena < 80 || $stena > (int)$CFG['max_stena'])) {
        throw new ChybaPolozky('Hrúbka steny musí byť od 80 do ' . (int)$CFG['max_stena'] . ' mm. Pre iné hrúbky nám pošlite dopyt.');
    }
    $ks = filter_var($p['ks'] ?? 1, FILTER_VALIDATE_INT);
    if ($ks === false || $ks < 1 || $ks > 50) throw new ChybaPolozky('Počet kusov musí byť od 1 do 50.');

    $z = $soZar ? zarubna_pre_stenu((int)$stena) : ['F' => 0, 'ext' => 0, 'min' => 0, 'max' => 0];
    $r180 = intdiv($z['ext'], 180);
    $r90 = intdiv($z['ext'] % 180, 90);

    [$N] = $POV['sirka'][$in['sirka']];
    [$V1, $vyskaTxt] = $POV['vyska'][$in['vyska']];
    $falc = $in['prevedenie'] === 'falc';
    $kodPrev = $slepa ? 'S' : $POV['prevedenie'][$in['prevedenie']][1];
    $kodSmer = $slepa ? 'S' : $POV['smer'][$in['smer']][1];
    $c = fn($k) => $POV[$k][$in[$k]][1];                                  // kód hodnoty
    $rozm = $in['sirka'] . '-' . $in['vyska'];
    $nemame = 'Pre túto zostavu zatiaľ nemáme cenu v cenníku. Pošlite nám prosím dopyt.';
    $prip = nacitaj_csv('priplatky.csv');
    $riadky = []; $dni = 0;
    // cena za kus = súčet zložiek rozpisu (základ + všetky príplatky)
    $pridaj = function (string $typ, string $kod, string $nazov, array $rozpis, int $mn, int $d = 0, array $extra = []) use (&$riadky, &$dni) {
        $cenaKs = array_sum(array_column($rozpis, 'cena'));
        $riadky[] = ['typ' => $typ, 'kod' => $kod, 'nazov' => $nazov, 'mnozstvo' => $mn, 'cena_ks' => round($cenaKs, 2), 'spolu' => round($cenaKs * $mn, 2),
                     'rozpis' => $rozpis] + $extra;
        $dni = max($dni, $d);
    };

    // rohový spoj obložky zárubne: pokos (45°, základ) alebo tupo (90°, príplatok)
    $spoj = strtolower((string)($p['spoj'] ?? 'pokos'));
    if (!in_array($spoj, ['pokos', 'tupo'], true)) throw new ChybaPolozky('Neplatný rohový spoj zárubne.');
    $rozSpoj = ($soZar && $spoj === 'tupo') ? priplatky_zoznam($prip, 'spoj-tupo', $in['sirka'], $in['vyska'], 'Rohový spoj na tupo') : [];
    $spojTxt = $spoj === 'tupo' ? 'spoj na tupo' : 'spoj na pokos';

    // skrátenie (prirezanie zo spodu) – krídlo a zárubňa nezávisle; limity v skratenie.csv
    $limSk = function (string $kol, bool $sMr) use ($in): int {
        $lim = najdi(nacitaj_csv('skratenie.csv'), ['kolekcia' => $kol, 'vyska' => $in['vyska']]);
        if (!$lim) return 0;
        return (int)cislo($sMr && ($lim['max_mm_mriezka'] ?? '') !== '' ? $lim['max_mm_mriezka'] : $lim['max_mm']);
    };
    $sk = $slepa ? 0 : filter_var($p['skratenie'] ?? 0, FILTER_VALIDATE_INT);          // krídlo
    $skz = $soZar ? filter_var($p['skratenie_zar'] ?? 0, FILTER_VALIDATE_INT) : 0;     // zárubňa
    if ($sk === false || $sk < 0 || $skz === false || $skz < 0) throw new ChybaPolozky('Neplatné skrátenie.');
    if ($sk > 0) {
        $sMr = strtolower((string)($p['mriezka'] ?? 'bez')) !== 'bez';
        $max = $limSk($in['kolekcia'], $sMr);
        if ($max <= 0) throw new ChybaPolozky('Pre toto krídlo skrátenie neponúkame. Pošlite nám prosím dopyt.');
        if ($sk > $max) throw new ChybaPolozky("Krídlo sa pri tejto výške dá skrátiť najviac o $max mm" . ($sMr ? ' (s vetracou mriežkou)' : '') . '.');
    }
    if ($skz > 0) {
        $max = $limSk('zarubna', false);
        if ($max <= 0) throw new ChybaPolozky('Pre túto zárubňu skrátenie neponúkame. Pošlite nám prosím dopyt.');
        if ($skz > $max) throw new ChybaPolozky("Zárubňa sa pri tejto výške dá skrátiť najviac o $max mm.");
    }
    if (!$slepa && $soZar && $sk < $skz) throw new ChybaPolozky('Krídlo musí byť skrátené aspoň o toľko ako zárubňa (inak sa do nej nezmestí).');
    $skTxt = $sk > 0 ? "skrátené o $sk mm" : '';

    // závesy sú súčasťou zárubne (nie samostatná položka); slepá zárubňa závesy ani protiplech nemá
    $zav = null;
    if ($soZar && !$slepa) {
        $zavKod = (string)($p['zavesy'] ?? 'nikel');
        foreach (nacitaj_csv('zavesy.csv') as $r) if (strtolower($r['kod']) === strtolower($zavKod)) $zav = $r;
        if (!$zav) throw new ChybaPolozky('Neplatná farba závesov.');
    }

    if (!$slepa) {
        // zámok je súčasťou krídla (cena sa pripočíta ku krídlu, v exporte je v samostatnom stĺpci)
        $kovKod = (string)($p['kovanie'] ?? 'bez');
        $kov = null;
        foreach (nacitaj_csv('kovanie.csv') as $r) if (strtolower($r['kod']) === strtolower($kovKod)) $kov = $r;
        if (!$kov) throw new ChybaPolozky('Neplatný zámok.');

        // výsuvný (padací) prah – voliteľný príplatok, súčasť krídla
        $prah = filter_var($p['prah'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $rozPrah = $prah ? priplatky_zoznam($prip, 'prah', $in['sirka'], $in['vyska'], 'Výsuvný prah') : [];
        if ($prah && array_sum(array_column($rozPrah, 'cena')) <= 0) throw new ChybaPolozky($nemame);

        // vetracia mriežka – všetky kolekcie (pri rámových dverách v spodnom vlysu)
        $mrKod = strtolower((string)($p['mriezka'] ?? 'bez'));
        $mr = null;
        if ($mrKod !== 'bez') {
            foreach (nacitaj_csv('mriezky.csv') as $r) if (strtolower($r['kod']) === $mrKod) $mr = $r;
            if (!$mr) throw new ChybaPolozky('Neplatná vetracia mriežka.');
        }

        $rozmerKridla = $falc ? ($N + 50) . ' × ' . ($V1 + 15 - $sk) : ($N + 22) . ' × ' . ($V1 + 1 - $sk);
        $r = najdi(nacitaj_csv('kridla.csv'), ['kolekcia' => $in['kolekcia'], 'prevedenie' => $in['prevedenie'], 'farba' => $in['farba'],
                                               'sirka' => $in['sirka'], 'vyska' => $in['vyska']]);
        if (!$r) throw new ChybaPolozky($nemame);
        $pridaj('KRIDLO', "{$c('kolekcia')}-{$c('prevedenie')}-{$c('farba')}-$rozm-{$c('smer')}",
            sprintf('Krídlo %s, %s, %s, %s/%s, %s (%s mm), %s%s%s', $POV['kolekcia'][$in['kolekcia']][0], $POV['prevedenie'][$in['prevedenie']][0],
                    $POV['farba'][$in['farba']][0], $in['sirka'], $vyskaTxt, $POV['smer'][$in['smer']][0], $rozmerKridla, $kov['nazov'],
                    ($sk ? ", $skTxt" : '') . ($prah ? ', výsuvný prah' : ''), $mr ? ', ' . lcfirst($mr['nazov']) : ''),
            array_merge(
                [zlozka('Krídlo – základná cena', voc($r), zdroj('kridla.csv', $r, ['kolekcia', 'prevedenie', 'farba', 'sirka', 'vyska']))],
                priplatky_zoznam($prip, 'kridlo', $in['sirka'], $in['vyska'], 'Príplatok krídla'),
                [zlozka('Zámok: ' . $kov['nazov'], voc($kov), 'kovanie.csv: ' . $kov['kod'])],
                $rozPrah,
                $mr ? [zlozka($mr['nazov'], voc($mr), 'mriezky.csv: ' . $mr['kod'])] : [],
                $sk ? priplatky_zoznam($prip, 'skratenie-kridlo', $in['sirka'], $in['vyska'], "Skrátenie krídla o $sk mm") : []
            ), $ks,
            max((int)cislo($r['dodanie_dni'] ?? 0), (int)cislo($kov['dodanie_dni'] ?? 0), $mr ? (int)cislo($mr['dodanie_dni'] ?? 0) : 0),
            ['prah' => $prah, 'mriezka' => $mr ? $mrKod : 'bez', 'skratenie' => $sk]);
    }

    if ($soZar) {
        $kz = ['prevedenie' => $in['prevedenie'], 'farba' => $in['farba_zarubne'], 'sirka' => $in['sirka'], 'vyska' => $in['vyska']];
        $r = najdi(nacitaj_csv('zarubne.csv'), ['typ' => 'F' . $z['F']] + $kz);
        if (!$r) throw new ChybaPolozky($nemame);
        $farbaZ = $POV['farba_zarubne'][$in['farba_zarubne']][0];
        if ($slepa) {
            $nazovZ = sprintf('Slepá (tunelová) zárubňa F%d, %s, %s/%s, %s%s – bez závesov a protiplechu', $z['F'], $farbaZ, $in['sirka'], $vyskaTxt, $spojTxt, $skz ? ", skrátená o $skz mm" : '');
        } else {
            $nazovZ = sprintf('Obložková zárubňa F%d, %s, %s, %s, %s%s', $z['F'], $falc ? 'falcová' : 'bezfalcová', $farbaZ, lcfirst($zav['nazov']), $spojTxt,
                              $skz ? ", skrátená o $skz mm" : '');
        }
        $pridaj('ZARUBNA', "F{$z['F']}-$kodPrev-{$c('farba_zarubne')}-$rozm-$kodSmer", $nazovZ,
            array_merge(
                [zlozka(($slepa ? 'Slepá zárubňa F' : 'Zárubňa F') . $z['F'] . ' – základná cena', voc($r),
                        zdroj('zarubne.csv', $r, ['typ', 'prevedenie', 'farba', 'sirka', 'vyska']))],
                priplatky_zoznam($prip, 'zarubna', $in['sirka'], $in['vyska'], 'Príplatok zárubne'),
                $zav ? [zlozka($zav['nazov'], voc($zav), 'zavesy.csv: ' . $zav['kod'])] : [],
                $rozSpoj,
                $skz ? priplatky_zoznam($prip, 'skratenie-zarubna', $in['sirka'], $in['vyska'], "Skrátenie zárubne o $skz mm") : []
            ), $ks,
            max((int)cislo($r['dodanie_dni'] ?? 0), $zav ? (int)cislo($zav['dodanie_dni'] ?? 0) : 0),
            ['zavesy' => $zav ? strtolower($zav['kod']) : '', 'spoj' => $spoj, 'skratenie' => $skz]);

        // rozširovacie elementy (vo farbe zárubne)
        if ($z['ext'] > 0) {
            $roz = nacitaj_csv('rozsirenia.csv');
            $k2 = ['farba' => $in['farba_zarubne'], 'sirka' => $in['sirka'], 'vyska' => $in['vyska']];
            $e90 = najdi($roz, ['typ' => 'R90'] + $k2);
            $e180 = najdi($roz, ['typ' => 'R180'] + $k2);
            $fz = $c('farba_zarubne');
            if ($r180) {
                if ($e180) $pridaj('ROZSIRENIE', "R180-$fz-$rozm", 'Rozširovací element R180',
                    [zlozka('Element R180', voc($e180), zdroj('rozsirenia.csv', $e180, ['typ', 'farba', 'sirka', 'vyska']))], $ks * $r180, (int)cislo($e180['dodanie_dni'] ?? 0));
                elseif ($e90) $pridaj('ROZSIRENIE', "R90-$fz-$rozm", 'Rozširovací element R90',
                    [zlozka('Element R90 (R180 nemá cenu → 2 × R90)', voc($e90), zdroj('rozsirenia.csv', $e90, ['typ', 'farba', 'sirka', 'vyska']))], $ks * $r180 * 2, (int)cislo($e90['dodanie_dni'] ?? 0));
                else throw new ChybaPolozky($nemame);
            }
            if ($r90) {
                if (!$e90) throw new ChybaPolozky($nemame);
                $pridaj('ROZSIRENIE', "R90-$fz-$rozm", 'Rozširovací element R90',
                    [zlozka('Element R90', voc($e90), zdroj('rozsirenia.csv', $e90, ['typ', 'farba', 'sirka', 'vyska']))], $ks * $r90, (int)cislo($e90['dodanie_dni'] ?? 0));
            }
        }
    }

    return [
        'ok' => true,
        'riadky' => $riadky,
        'spolu' => round(array_sum(array_column($riadky, 'spolu')), 2),
        'ks' => $ks,
        'druh' => $druh,
        'so_zarubnou' => $soZar,
        'prevedenie' => $in['prevedenie'],
        'zavesy' => $zav ? strtolower($zav['kod']) : '',
        'skratenie' => $sk,
        'skratenie_zar' => $skz,
        'zarubna' => $soZar ? 'F' . $z['F'] . ($r180 ? ' + ' . ($r180 > 1 ? $r180 . '× ' : '') . 'R180' : '') . ($r90 ? ' + R90' : '') : 'bez zárubne',
        'rozsah_steny' => $soZar ? $z['min'] . '–' . $z['max'] . ' mm' : '',
        'dodanie_dni' => $dni,
    ];
}

/**
 * Cenová hladina: z VOC zložiek sa vypočíta cena bez DPH (× koeficient) a s DPH.
 * Každá zložka sa zaokrúhli zvlášť, takže súčet rozpisu vždy presne sedí s cenou za kus.
 */
function aplikuj_hladinu(array $v, array $H, float $dph): array {
    $k = (float)$H['koeficient'];
    $v['spolu'] = $v['spolu_bez'] = $v['spolu_s_dph'] = 0.0;
    foreach ($v['riadky'] as &$r) {
        $bez = 0.0; $sd = 0.0;
        foreach ($r['rozpis'] as &$z) {
            $zb = round($z['cena'] * $k, 2); $zs = round($zb * (1 + $dph), 2);
            $z['cena_bez'] = $zb; $z['cena_s_dph'] = $zs; $z['cena'] = $H['s_dph'] ? $zs : $zb;
            $bez += $zb; $sd += $zs;
        }
        unset($z);
        $r['cena_ks_bez'] = round($bez, 2); $r['cena_ks_s_dph'] = round($sd, 2);
        $r['spolu_bez'] = round($bez * $r['mnozstvo'], 2); $r['spolu_s_dph'] = round($sd * $r['mnozstvo'], 2);
        $r['cena_ks'] = $H['s_dph'] ? $r['cena_ks_s_dph'] : $r['cena_ks_bez'];
        $r['spolu'] = $H['s_dph'] ? $r['spolu_s_dph'] : $r['spolu_bez'];
        $v['spolu'] += $r['spolu']; $v['spolu_bez'] += $r['spolu_bez']; $v['spolu_s_dph'] += $r['spolu_s_dph'];
    }
    unset($r);
    foreach (['spolu', 'spolu_bez', 'spolu_s_dph'] as $kk) $v[$kk] = round($v[$kk], 2);
    return $v;
}

$H = aktualna_hladina();
$DPH = (float)($CFG['dph'] ?? 0.23);
$b2b = $H['partner'] !== null;

$vysledky = [];
$spolu = 0.0; $dni = 0; $kusov = 0; $chyby = 0;
foreach ($vstup['polozky'] as $p) {
    if (!is_array($p)) chyba('Neplatná položka.');
    $uid = preg_replace('/[^A-Za-z0-9_-]/', '', (string)($p['uid'] ?? ''));
    $uid = substr($uid, 0, 24);
    try {
        $v = aplikuj_hladinu(ocen_polozku($p, $CFG, $POVOLENE), $H, $DPH);
        $dni = max($dni, $v['dodanie_dni']); $kusov += $v['ks'];
        $vysledky[] = ['uid' => $uid] + $v;
    } catch (ChybaPolozky $e) {
        $chyby++;
        $vysledky[] = ['uid' => $uid, 'ok' => false, 'chyba' => $e->getMessage()];
    }
}

// služby na úrovni celej ponuky
//  MALOOBCHOD (sluzby.csv, ceny s DPH):
//  - montáž: cena za kus podľa typu (montaz-falc, montaz-bez, montaz-slepa, neskôr montaz-posuvne);
//    montuje sa len zárubňa – samostatné krídla (bez zárubne) sa nemontujú
//  - zameranie: automaticky pri montáži (paušál za zákazku)
//  - doprava: sadzba za km × vzdialenosť × 2 (tam aj späť)
//  PARTNERI (sluzby_b2b.csv, ceny bez DPH): doprava za každé krídlo a každú zárubňu; montáž nie
$sluzby = [];
$sluzba = function (string $kod, string $nazov, float $c, float $mn, string $jedn, string $zdroj, bool $cenaSDph) use (&$sluzby, $H, $DPH) {
    $bez = $cenaSDph ? round($c / (1 + $DPH), 2) : round($c, 2);
    $sd = $cenaSDph ? round($c, 2) : round($c * (1 + $DPH), 2);
    $s = ['typ' => 'SLUZBA', 'kod' => $kod, 'nazov' => $nazov, 'mnozstvo' => $mn, 'jednotka' => $jedn, 'zdroj' => $zdroj,
          'cena_ks_bez' => $bez, 'cena_ks_s_dph' => $sd, 'spolu_bez' => round($bez * $mn, 2), 'spolu_s_dph' => round($sd * $mn, 2)];
    $s['cena_ks'] = $H['s_dph'] ? $sd : $bez;
    $s['spolu'] = $H['s_dph'] ? $s['spolu_s_dph'] : $s['spolu_bez'];
    $sluzby[] = $s;
};
$upozornenia = [];
if ($b2b) {
    if (!empty($vstup['doprava']) && $kusov > 0) {
        $sl = [];
        foreach (nacitaj_csv('sluzby_b2b.csv') as $r) $sl[strtolower($r['kod'])] = $r;
        $nK = 0; $nZ = 0;
        foreach ($vysledky as $v) {
            if (empty($v['ok'])) continue;
            foreach ($v['riadky'] as $r) {
                if ($r['typ'] === 'KRIDLO') $nK += $r['mnozstvo'];
                if ($r['typ'] === 'ZARUBNA') $nZ += $r['mnozstvo'];
            }
        }
        $cenaB2b = fn($r) => cislo($r['cena_bez_dph'] ?? $r['cena'] ?? 0);
        if ($nK && isset($sl['doprava-kridlo'])) $sluzba('SL-DOPRAVA-KRIDLO', $sl['doprava-kridlo']['nazov'], $cenaB2b($sl['doprava-kridlo']), $nK, 'ks', 'sluzby_b2b.csv: doprava-kridlo', false);
        if ($nZ && isset($sl['doprava-zarubna'])) $sluzba('SL-DOPRAVA-ZARUBNA', $sl['doprava-zarubna']['nazov'], $cenaB2b($sl['doprava-zarubna']), $nZ, 'ks', 'sluzby_b2b.csv: doprava-zarubna', false);
    }
} else {
    $sl = [];
    foreach (nacitaj_csv('sluzby.csv') as $r) $sl[strtolower($r['kod'])] = $r;
    $cenaSl = fn($r) => cislo($r['cena_s_dph'] ?? $r['cena'] ?? 0);
    if (!empty($vstup['montaz']) && $kusov > 0) {
        $podlaTypu = [];
        $bezMontaze = 0;
        foreach ($vysledky as $v) {
            if (empty($v['ok'])) continue;
            if (empty($v['so_zarubnou'])) { $bezMontaze += $v['ks']; continue; }
            $podlaTypu[$v['prevedenie']] = ($podlaTypu[$v['prevedenie']] ?? 0) + $v['ks'];
        }
        if ($bezMontaze) $upozornenia[] = 'Montáž sa počíta len k zárubniam – samostatné krídla bez zárubne (' . $bezMontaze . ' ks) nemontujeme.';
        foreach ($podlaTypu as $typ => $n) {
            $r = $sl['montaz-' . $typ] ?? $sl['montaz'] ?? null;
            if (!$r) { $upozornenia[] = "V cenníku chýba cena montáže pre typ „$typ“."; continue; }
            $sluzba('SL-MONTAZ-' . strtoupper($typ), $r['nazov'], $cenaSl($r), $n, 'ks', 'sluzby.csv: ' . $r['kod'], true);
        }
        if ($podlaTypu && isset($sl['zameranie'])) $sluzba('SL-ZAMERANIE', $sl['zameranie']['nazov'], $cenaSl($sl['zameranie']), 1, 'zákazka', 'sluzby.csv: zameranie', true);
    }
    if (!empty($vstup['doprava']) && $kusov > 0 && isset($sl['doprava'])) {
        $km = filter_var($vstup['doprava_km'] ?? '', FILTER_VALIDATE_FLOAT);
        if ($km === false || $km <= 0 || $km > 2000) {
            $upozornenia[] = 'Pre výpočet dopravy zadajte vzdialenosť v kilometroch.';
        } else {
            $km = round($km);
            $sluzba('SL-DOPRAVA', $sl['doprava']['nazov'] . " ($km km × 2)", $cenaSl($sl['doprava']), $km * 2, 'km', 'sluzby.csv: doprava', true);
        }
    }
}
$ok = array_filter($vysledky, fn($v) => !empty($v['ok']));
$sum = fn(array $rows, string $k) => round(array_sum(array_column($rows, $k)), 2);
$medz = $sum($ok, 'spolu');
$spoluBez = round($sum($ok, 'spolu_bez') + $sum($sluzby, 'spolu_bez'), 2);
$spoluSDph = round($sum($ok, 'spolu_s_dph') + $sum($sluzby, 'spolu_s_dph'), 2);

odpoved([
    'ok' => true,
    'hladina' => ['kod' => $H['kod'], 'nazov' => $H['nazov'], 's_dph' => $H['s_dph'], 'partner' => $H['partner']],
    'polozky' => $vysledky,
    'sluzby' => $sluzby,
    'medzisucet' => $medz,
    'spolu' => round($medz + $sum($sluzby, 'spolu'), 2),
    'spolu_bez' => $spoluBez,
    'dph' => round($spoluSDph - $spoluBez, 2),
    'dph_sadzba' => $DPH,
    'spolu_s_dph' => $spoluSDph,
    'kusov' => $kusov,
    'chyby' => $chyby,
    'upozornenia' => $upozornenia,
    'dodanie_dni' => $dni,
    'dodanie' => $dni === 0 ? 'Skladom' : "do $dni pracovných dní",
]);
