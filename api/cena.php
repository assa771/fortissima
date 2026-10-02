<?php
/**
 * Kalkulácia Fortissima – ocení cenovú ponuku (jednu alebo viac položiek).
 * Cenník (CSV) sa nikdy neposiela do prehliadača; ten dostane len výsledok výpočtu.
 *
 *   GET  cena.php?moznosti=1   → zoznam kovania (kód + názov, bez cien)
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
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

$CFG = require __DIR__ . '/config.php';

function odpoved(array $data, int $kod = 200): void {
    http_response_code($kod);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}
function chyba(string $sprava, int $kod = 400): void {
    odpoved(['ok' => false, 'chyba' => $sprava], $kod);
}
/** Chyba jednej položky – nezastaví ocenenie ostatných. */
final class ChybaPolozky extends Exception {}

/* ---------- obmedzenie počtu dopytov (proti hromadnému sťahovaniu cien) ---------- */
function skontroluj_limit(int $max, int $okno): void {
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'x';
    $f = sys_get_temp_dir() . '/fortissima_rl_' . hash('sha256', $ip . __DIR__);
    $teraz = time();
    $zaznamy = [];
    if (is_file($f)) {
        $zaznamy = array_filter(explode(',', (string)@file_get_contents($f)), fn($t) => $t !== '' && (int)$t > $teraz - $okno);
    }
    if (count($zaznamy) >= $max) {
        chyba('Príliš veľa dopytov. Skúste to prosím o pár minút.', 429);
    }
    $zaznamy[] = (string)$teraz;
    @file_put_contents($f, implode(',', $zaznamy), LOCK_EX);
}
skontroluj_limit((int)$CFG['limit_dopytov'], (int)$CFG['limit_okno_s']);

/* ---------- čítanie CSV (Excel: bodkočiarka/čiarka, UTF-8 aj Windows-1250, desatinná čiarka) ---------- */
function nacitaj_csv(string $subor): array {
    global $CFG;
    static $cache = [];
    if (isset($cache[$subor])) return $cache[$subor];
    $cesta = rtrim($CFG['cennik_dir'], '/\\') . '/' . $subor;
    if (!is_file($cesta)) chyba('Cenník nie je dostupný.', 500);
    $obsah = (string)file_get_contents($cesta);
    $obsah = preg_replace('/^\xEF\xBB\xBF/', '', $obsah);
    if (!preg_match('//u', $obsah) && function_exists('iconv')) {
        $obsah = (string)iconv('CP1250', 'UTF-8//IGNORE', $obsah);
    }
    $riadky = preg_split('/\r\n|\r|\n/', trim($obsah));
    if (!$riadky) return $cache[$subor] = [];
    $odd = substr_count($riadky[0], ';') >= substr_count($riadky[0], ',') ? ';' : ',';
    $hlavicka = array_map(fn($h) => strtolower(trim($h)), str_getcsv(array_shift($riadky), $odd, '"', ''));
    $out = [];
    foreach ($riadky as $r) {
        if (trim($r) === '') continue;
        $hodnoty = array_map('trim', str_getcsv($r, $odd, '"', ''));
        $out[] = array_combine($hlavicka, array_pad(array_slice($hodnoty, 0, count($hlavicka)), count($hlavicka), ''));
    }
    return $cache[$subor] = $out;
}
function cislo($v): float {
    $v = str_replace([' ', "\u{00A0}", '€'], '', (string)$v);
    return (float)str_replace(',', '.', $v);
}
/** Najkonkrétnejší riadok, ktorý sedí (hviezdička = čokoľvek). */
function najdi(array $riadky, array $kriteria): ?array {
    $najlepsi = null; $skore = -1;
    foreach ($riadky as $r) {
        $s = 0; $ok = true;
        foreach ($kriteria as $k => $v) {
            $h = strtolower((string)($r[$k] ?? '*'));
            if ($h === '*' || $h === '') continue;
            if ($h !== strtolower((string)$v)) { $ok = false; break; }
            $s++;
        }
        if ($ok && $s > $skore) { $najlepsi = $r; $skore = $s; }
    }
    return $najlepsi;
}
function priplatky(array $riadky, string $polozka, string $sirka, string $vyska): float {
    $sum = 0.0;
    foreach ($riadky as $r) {
        if (strtolower($r['polozka'] ?? '') !== $polozka) continue;
        $sOk = in_array($r['sirka'] ?? '*', ['*', '', $sirka], true);
        $vOk = in_array($r['vyska'] ?? '*', ['*', '', $vyska], true);
        if ($sOk && $vOk) $sum += cislo($r['priplatok_s_dph'] ?? 0);
    }
    return $sum;
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
        odpoved(['ok' => true, 'kovanie' => array_values($kov), 'zavesy' => array_values($zav), 'mriezky' => array_values($mr)]);
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
    $pridaj = function (string $typ, string $kod, string $nazov, float $cenaKs, int $mn, int $d = 0, array $extra = []) use (&$riadky, &$dni) {
        $riadky[] = ['typ' => $typ, 'kod' => $kod, 'nazov' => $nazov, 'mnozstvo' => $mn, 'cena_ks' => round($cenaKs, 2), 'spolu' => round($cenaKs * $mn, 2)] + $extra;
        $dni = max($dni, $d);
    };

    // rohový spoj obložky zárubne: pokos (45°, základ) alebo tupo (90°, príplatok)
    $spoj = strtolower((string)($p['spoj'] ?? 'pokos'));
    if (!in_array($spoj, ['pokos', 'tupo'], true)) throw new ChybaPolozky('Neplatný rohový spoj zárubne.');
    $cenaSpoj = ($soZar && $spoj === 'tupo') ? priplatky($prip, 'spoj-tupo', $in['sirka'], $in['vyska']) : 0.0;
    $spojTxt = $spoj === 'tupo' ? 'spoj na tupo' : 'spoj na pokos';

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
        $cenaPrah = $prah ? priplatky($prip, 'prah', $in['sirka'], $in['vyska']) : 0.0;
        if ($prah && $cenaPrah <= 0) throw new ChybaPolozky($nemame);

        // vetracia mriežka – všetky kolekcie (pri rámových dverách v spodnom vlysu)
        $mrKod = strtolower((string)($p['mriezka'] ?? 'bez'));
        $mr = null;
        if ($mrKod !== 'bez') {
            foreach (nacitaj_csv('mriezky.csv') as $r) if (strtolower($r['kod']) === $mrKod) $mr = $r;
            if (!$mr) throw new ChybaPolozky('Neplatná vetracia mriežka.');
        }

        $rozmerKridla = $falc ? ($N + 50) . ' × ' . ($V1 + 15) : ($N + 22) . ' × ' . ($V1 + 1);
        $r = najdi(nacitaj_csv('kridla.csv'), ['kolekcia' => $in['kolekcia'], 'prevedenie' => $in['prevedenie'], 'farba' => $in['farba'],
                                               'sirka' => $in['sirka'], 'vyska' => $in['vyska']]);
        if (!$r) throw new ChybaPolozky($nemame);
        $pridaj('KRIDLO', "{$c('kolekcia')}-{$c('prevedenie')}-{$c('farba')}-$rozm-{$c('smer')}",
            sprintf('Krídlo %s, %s, %s, %s/%s, %s (%s mm), %s%s%s', $POV['kolekcia'][$in['kolekcia']][0], $POV['prevedenie'][$in['prevedenie']][0],
                    $POV['farba'][$in['farba']][0], $in['sirka'], $vyskaTxt, $POV['smer'][$in['smer']][0], $rozmerKridla, $kov['nazov'],
                    $prah ? ', výsuvný prah' : '', $mr ? ', ' . lcfirst($mr['nazov']) : ''),
            cislo($r['cena_s_dph']) + priplatky($prip, 'kridlo', $in['sirka'], $in['vyska']) + cislo($kov['cena_s_dph']) + $cenaPrah + ($mr ? cislo($mr['cena_s_dph']) : 0), $ks,
            max((int)cislo($r['dodanie_dni'] ?? 0), (int)cislo($kov['dodanie_dni'] ?? 0), $mr ? (int)cislo($mr['dodanie_dni'] ?? 0) : 0),
            ['prah' => $prah, 'mriezka' => $mr ? $mrKod : 'bez']);
    }

    if ($soZar) {
        $kz = ['prevedenie' => $in['prevedenie'], 'farba' => $in['farba_zarubne'], 'sirka' => $in['sirka'], 'vyska' => $in['vyska']];
        $r = najdi(nacitaj_csv('zarubne.csv'), ['typ' => 'F' . $z['F']] + $kz);
        if (!$r) throw new ChybaPolozky($nemame);
        $farbaZ = $POV['farba_zarubne'][$in['farba_zarubne']][0];
        if ($slepa) {
            $nazovZ = sprintf('Slepá (tunelová) zárubňa F%d, %s, %s/%s, %s – bez závesov a protiplechu', $z['F'], $farbaZ, $in['sirka'], $vyskaTxt, $spojTxt);
        } else {
            $nazovZ = sprintf('Obložková zárubňa F%d, %s, %s, %s, %s', $z['F'], $falc ? 'falcová' : 'bezfalcová', $farbaZ, lcfirst($zav['nazov']), $spojTxt);
        }
        $pridaj('ZARUBNA', "F{$z['F']}-$kodPrev-{$c('farba_zarubne')}-$rozm-$kodSmer", $nazovZ,
            cislo($r['cena_s_dph']) + priplatky($prip, 'zarubna', $in['sirka'], $in['vyska']) + ($zav ? cislo($zav['cena_s_dph']) : 0) + $cenaSpoj, $ks,
            max((int)cislo($r['dodanie_dni'] ?? 0), $zav ? (int)cislo($zav['dodanie_dni'] ?? 0) : 0),
            ['zavesy' => $zav ? strtolower($zav['kod']) : '', 'spoj' => $spoj]);

        // rozširovacie elementy (vo farbe zárubne)
        if ($z['ext'] > 0) {
            $roz = nacitaj_csv('rozsirenia.csv');
            $k2 = ['farba' => $in['farba_zarubne'], 'sirka' => $in['sirka'], 'vyska' => $in['vyska']];
            $e90 = najdi($roz, ['typ' => 'R90'] + $k2);
            $e180 = najdi($roz, ['typ' => 'R180'] + $k2);
            $fz = $c('farba_zarubne');
            if ($r180) {
                if ($e180) $pridaj('ROZSIRENIE', "R180-$fz-$rozm", 'Rozširovací element R180', cislo($e180['cena_s_dph']), $ks * $r180, (int)cislo($e180['dodanie_dni'] ?? 0));
                elseif ($e90) $pridaj('ROZSIRENIE', "R90-$fz-$rozm", 'Rozširovací element R90', cislo($e90['cena_s_dph']), $ks * $r180 * 2, (int)cislo($e90['dodanie_dni'] ?? 0));
                else throw new ChybaPolozky($nemame);
            }
            if ($r90) {
                if (!$e90) throw new ChybaPolozky($nemame);
                $pridaj('ROZSIRENIE', "R90-$fz-$rozm", 'Rozširovací element R90', cislo($e90['cena_s_dph']), $ks * $r90, (int)cislo($e90['dodanie_dni'] ?? 0));
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
        'zarubna' => $soZar ? 'F' . $z['F'] . ($r180 ? ' + ' . ($r180 > 1 ? $r180 . '× ' : '') . 'R180' : '') . ($r90 ? ' + R90' : '') : 'bez zárubne',
        'rozsah_steny' => $soZar ? $z['min'] . '–' . $z['max'] . ' mm' : '',
        'dodanie_dni' => $dni,
    ];
}

$vysledky = [];
$spolu = 0.0; $dni = 0; $kusov = 0; $chyby = 0;
foreach ($vstup['polozky'] as $p) {
    if (!is_array($p)) chyba('Neplatná položka.');
    $uid = preg_replace('/[^A-Za-z0-9_-]/', '', (string)($p['uid'] ?? ''));
    $uid = substr($uid, 0, 24);
    try {
        $v = ocen_polozku($p, $CFG, $POVOLENE);
        $spolu += $v['spolu']; $dni = max($dni, $v['dodanie_dni']); $kusov += $v['ks'];
        $vysledky[] = ['uid' => $uid] + $v;
    } catch (ChybaPolozky $e) {
        $chyby++;
        $vysledky[] = ['uid' => $uid, 'ok' => false, 'chyba' => $e->getMessage()];
    }
}

// služby na úrovni celej ponuky
//  - montáž: cena za kus podľa typu (montaz-falc, montaz-bez, montaz-slepa, neskôr montaz-posuvne);
//    montuje sa len zárubňa – samostatné krídla (bez zárubne) sa nemontujú
//  - zameranie: automaticky pri montáži (paušál za zákazku)
//  - doprava: sadzba za km × vzdialenosť × 2 (tam aj späť)
$sluzby = [];
$sl = [];
foreach (nacitaj_csv('sluzby.csv') as $r) $sl[strtolower($r['kod'])] = $r;
$sluzba = function (string $kod, string $nazov, float $c, float $mn, string $jedn) use (&$sluzby) {
    $sluzby[] = ['typ' => 'SLUZBA', 'kod' => $kod, 'nazov' => $nazov, 'mnozstvo' => $mn, 'jednotka' => $jedn,
                 'cena_ks' => round($c, 2), 'spolu' => round($c * $mn, 2)];
};
$upozornenia = [];
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
        $sluzba('SL-MONTAZ-' . strtoupper($typ), $r['nazov'], cislo($r['cena_s_dph']), $n, 'ks');
    }
    if ($podlaTypu && isset($sl['zameranie'])) $sluzba('SL-ZAMERANIE', $sl['zameranie']['nazov'], cislo($sl['zameranie']['cena_s_dph']), 1, 'zákazka');
}
if (!empty($vstup['doprava']) && $kusov > 0 && isset($sl['doprava'])) {
    $km = filter_var($vstup['doprava_km'] ?? '', FILTER_VALIDATE_FLOAT);
    if ($km === false || $km <= 0 || $km > 2000) {
        $upozornenia[] = 'Pre výpočet dopravy zadajte vzdialenosť v kilometroch.';
    } else {
        $km = round($km);
        $sluzba('SL-DOPRAVA', $sl['doprava']['nazov'] . " ($km km × 2)", cislo($sl['doprava']['cena_s_dph']), $km * 2, 'km');
    }
}
$spoluSluzby = array_sum(array_column($sluzby, 'spolu'));

odpoved([
    'ok' => true,
    'polozky' => $vysledky,
    'sluzby' => $sluzby,
    'medzisucet' => round($spolu, 2),
    'spolu' => round($spolu + $spoluSluzby, 2),
    'kusov' => $kusov,
    'chyby' => $chyby,
    'upozornenia' => $upozornenia,
    'dodanie_dni' => $dni,
    'dodanie' => $dni === 0 ? 'Skladom' : "do $dni pracovných dní",
]);
