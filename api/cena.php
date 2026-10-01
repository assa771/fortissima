<?php
/**
 * Kalkulačka Fortissima – vráti orientačnú cenu JEDNEJ zostavy.
 * Cenník (CSV) sa nikdy neposiela do prehliadača; ten dostane len výsledok výpočtu.
 *
 *   GET cena.php?moznosti=1                       → zoznam kovania (kód + názov, bez cien)
 *   GET cena.php?kolekcia=minimal&prevedenie=falc&farba=biela&sirka=80&vyska=197
 *               &stena=120&kovanie=bb-nerez&ks=1&montaz=1&doprava=1
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
    $cesta = rtrim($CFG['cennik_dir'], '/\\') . '/' . $subor;
    if (!is_file($cesta)) {
        chyba('Cenník nie je dostupný.', 500);
    }
    $obsah = (string)file_get_contents($cesta);
    $obsah = preg_replace('/^\xEF\xBB\xBF/', '', $obsah);           // BOM
    if (!preg_match('//u', $obsah) && function_exists('iconv')) {       // nie je UTF-8 → Windows-1250
        $obsah = (string)iconv('CP1250', 'UTF-8//IGNORE', $obsah);
    }
    $riadky = preg_split('/\r\n|\r|\n/', trim($obsah));
    if (!$riadky) return [];
    $odd = substr_count($riadky[0], ';') >= substr_count($riadky[0], ',') ? ';' : ',';
    $hlavicka = array_map(fn($h) => strtolower(trim($h)), str_getcsv(array_shift($riadky), $odd, '"', ''));
    $out = [];
    foreach ($riadky as $r) {
        if (trim($r) === '') continue;
        $hodnoty = array_map('trim', str_getcsv($r, $odd, '"', ''));
        $out[] = array_combine($hlavicka, array_pad(array_slice($hodnoty, 0, count($hlavicka)), count($hlavicka), ''));
    }
    return $out;
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

/* ---------- zoznam kovania pre formulár ---------- */
if (isset($_GET['moznosti'])) {
    $kov = array_map(fn($r) => ['kod' => $r['kod'], 'nazov' => $r['nazov']], nacitaj_csv('kovanie.csv'));
    odpoved(['ok' => true, 'kovanie' => array_values($kov)]);
}

/* ---------- vstupy (len povolené hodnoty) ---------- */
$POVOLENE = [
    'kolekcia'   => ['minimal' => 'Minimal', 'vertikal' => 'Vertikal', 'prestige' => 'Prestige'],
    'prevedenie' => ['falc' => 'falcové', 'bez' => 'bezfalcové'],
    'farba'      => ['biela' => 'biela', 'kasmirova' => 'kašmírová'],
    'sirka'      => ['60' => 600, '65' => 650, '70' => 700, '80' => 800, '90' => 900],
    'vyska'      => ['197' => 1970, '2055' => 2055, '210' => 2100],
];
$in = [];
foreach ($POVOLENE as $k => $moznosti) {
    $v = (string)($_GET[$k] ?? '');
    if (!array_key_exists($v, $moznosti)) chyba("Neplatná hodnota: $k");
    $in[$k] = $v;
}
$stena = filter_var($_GET['stena'] ?? '', FILTER_VALIDATE_INT);
if ($stena === false || $stena < 80 || $stena > (int)$CFG['max_stena']) {
    chyba('Hrúbka steny musí byť od 80 do ' . (int)$CFG['max_stena'] . ' mm. Pre iné hrúbky nám pošlite dopyt.');
}
$ks = filter_var($_GET['ks'] ?? 1, FILTER_VALIDATE_INT);
if ($ks === false || $ks < 1 || $ks > 50) chyba('Počet kusov musí byť od 1 do 50.');
$kovKod = (string)($_GET['kovanie'] ?? 'bez');
$montaz = ($_GET['montaz'] ?? '0') === '1';
$doprava = ($_GET['doprava'] ?? '0') === '1';

/* ---------- zárubňa podľa hrúbky steny: F80–F160 + R90/R180 ---------- */
function zarubna_pre_stenu(int $d): array {
    $zaklad = [[80, 80, 100], [100, 100, 130], [130, 130, 160], [160, 160, 190]];
    $ext = $d <= 190 ? 0 : 90 * (int)ceil(($d - 190) / 90);
    $zvysok = $d - $ext;
    foreach ($zaklad as [$F, $min, $max]) {
        if ($ext > 0 && $F === 80) continue;
        if ($zvysok >= $min && $zvysok <= $max) return ['F' => $F, 'ext' => $ext, 'min' => $min + $ext, 'max' => $max + $ext];
    }
    chyba('Pre túto hrúbku steny nevieme zárubňu určiť.');
}
$z = zarubna_pre_stenu((int)$stena);
$r180 = intdiv($z['ext'], 180);
$r90 = intdiv($z['ext'] % 180, 90);

/* ---------- výpočet ---------- */
$N = $POVOLENE['sirka'][$in['sirka']];
$V1 = $POVOLENE['vyska'][$in['vyska']];
$falc = $in['prevedenie'] === 'falc';
$rozmerKridla = $falc ? ($N + 50) . ' × ' . ($V1 + 15) : ($N + 22) . ' × ' . ($V1 + 1);
$vyskaTxt = ['197' => '197', '2055' => '205,5', '210' => '210'][$in['vyska']];
$krit = ['prevedenie' => $in['prevedenie'], 'farba' => $in['farba'], 'sirka' => $in['sirka'], 'vyska' => $in['vyska']];
$prip = nacitaj_csv('priplatky.csv');
$polozky = [];
$dni = 0;
$pridaj = function (string $nazov, float $cenaKs, int $mnozstvo, int $d = 0) use (&$polozky, &$dni) {
    $polozky[] = ['nazov' => $nazov, 'mnozstvo' => $mnozstvo, 'cena_ks' => round($cenaKs, 2), 'spolu' => round($cenaKs * $mnozstvo, 2)];
    $dni = max($dni, $d);
};
$nemame = 'Pre túto zostavu zatiaľ nemáme cenu v cenníku. Pošlite nám prosím dopyt.';

// krídlo
$r = najdi(nacitaj_csv('kridla.csv'), ['kolekcia' => $in['kolekcia']] + $krit);
if (!$r) chyba($nemame, 404);
$pridaj(sprintf('Krídlo %s, %s, %s, %s/%s (%s mm)', $POVOLENE['kolekcia'][$in['kolekcia']], $POVOLENE['prevedenie'][$in['prevedenie']],
        $POVOLENE['farba'][$in['farba']], $in['sirka'], $vyskaTxt, $rozmerKridla),
        cislo($r['cena_s_dph']) + priplatky($prip, 'kridlo', $in['sirka'], $in['vyska']), $ks, (int)cislo($r['dodanie_dni'] ?? 0));

// zárubňa
$r = najdi(nacitaj_csv('zarubne.csv'), ['typ' => 'F' . $z['F']] + $krit);
if (!$r) chyba($nemame, 404);
$pridaj(sprintf('Obložková zárubňa F%d, %s', $z['F'], $falc ? 'falcová' : 'bezfalcová'),
        cislo($r['cena_s_dph']) + priplatky($prip, 'zarubna', $in['sirka'], $in['vyska']), $ks, (int)cislo($r['dodanie_dni'] ?? 0));

// rozširovacie elementy
if ($z['ext'] > 0) {
    $roz = nacitaj_csv('rozsirenia.csv');
    $k2 = ['sirka' => $in['sirka'], 'vyska' => $in['vyska']];
    $e90 = najdi($roz, ['typ' => 'R90'] + $k2);
    $e180 = najdi($roz, ['typ' => 'R180'] + $k2);
    if ($r180) {
        if ($e180) $pridaj('Rozširovací element R180', cislo($e180['cena_s_dph']), $ks * $r180, (int)cislo($e180['dodanie_dni'] ?? 0));
        elseif ($e90) $pridaj('Rozširovací element R90', cislo($e90['cena_s_dph']), $ks * $r180 * 2, (int)cislo($e90['dodanie_dni'] ?? 0));
        else chyba($nemame, 404);
    }
    if ($r90) {
        if (!$e90) chyba($nemame, 404);
        $pridaj('Rozširovací element R90', cislo($e90['cena_s_dph']), $ks * $r90, (int)cislo($e90['dodanie_dni'] ?? 0));
    }
}

// kovanie
$kov = null;
foreach (nacitaj_csv('kovanie.csv') as $r) if (strtolower($r['kod']) === strtolower($kovKod)) $kov = $r;
if (!$kov) chyba('Neplatné kovanie.');
if (cislo($kov['cena_s_dph']) > 0) {
    $pridaj('Kovanie: ' . $kov['nazov'], cislo($kov['cena_s_dph']), $ks, (int)cislo($kov['dodanie_dni'] ?? 0));
}

// služby
$sl = [];
foreach (nacitaj_csv('sluzby.csv') as $r) $sl[strtolower($r['kod'])] = $r;
if ($montaz && isset($sl['montaz'])) $pridaj($sl['montaz']['nazov'], cislo($sl['montaz']['cena_s_dph']), $ks);
if ($doprava && isset($sl['doprava'])) $pridaj($sl['doprava']['nazov'], cislo($sl['doprava']['cena_s_dph']), 1);

$spolu = round(array_sum(array_column($polozky, 'spolu')), 2);
$zarTxt = 'F' . $z['F'] . ($r180 ? ' + ' . ($r180 > 1 ? $r180 . '× ' : '') . 'R180' : '') . ($r90 ? ' + R90' : '');

odpoved([
    'ok' => true,
    'polozky' => $polozky,
    'spolu' => $spolu,
    'zarubna' => $zarTxt,
    'rozsah_steny' => $z['min'] . '–' . $z['max'] . ' mm',
    'dodanie_dni' => $dni,
    'dodanie' => $dni === 0 ? 'Skladom' : "do $dni pracovných dní",
]);
