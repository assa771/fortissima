<?php
/** Spoločné funkcie API Fortissima (cenník, limity, partneri). Z prehliadača nedostupné (api/.htaccess). */
declare(strict_types=1);

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
function skontroluj_limit(int $max, int $okno, string $druh = 'rl'): void {
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'x';
    $f = sys_get_temp_dir() . '/fortissima_' . $druh . '_' . hash('sha256', $ip . __DIR__);
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

/* ---------- B2B partneri a cenové hladiny ---------- */
const B2B_SESSION = 'FORTISSIMA_B2B';

function b2b_session(bool $zapis = false): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    // bez cookie nezakladáme reláciu (bežný návštevník = MOC)
    if (!$zapis && !isset($_COOKIE[B2B_SESSION])) return;
    session_name(B2B_SESSION);
    session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax',
                               'secure' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')]);
    session_start($zapis ? [] : ['read_and_close' => true]);
}
/** Riadok partnera z partneri.csv (len aktívny) alebo null. */
function partner_podla_loginu(string $login): ?array {
    foreach (nacitaj_csv('partneri.csv') as $r) {
        if (strcasecmp(trim($r['login'] ?? ''), $login) === 0 && trim((string)($r['aktivny'] ?? '1')) !== '0') return $r;
    }
    return null;
}
function hladina(string $kod): ?array {
    foreach (nacitaj_csv('hladiny.csv') as $r) {
        if (strtolower(trim($r['kod'])) === strtolower($kod)) {
            return ['kod' => strtolower(trim($r['kod'])), 'nazov' => $r['nazov'], 'koeficient' => cislo($r['koeficient']),
                    's_dph' => trim((string)($r['zobrazit_s_dph'] ?? '0')) === '1'];
        }
    }
    return null;
}
/** Aktuálne prihlásený partner + jeho hladina; inak null. */
function aktualny_partner(): ?array {
    b2b_session();
    $login = $_SESSION['b2b_login'] ?? null;
    if (!$login) return null;
    $p = partner_podla_loginu((string)$login);
    if (!$p) return null;
    $h = hladina((string)$p['hladina']);
    if (!$h) return null;
    return ['login' => $p['login'], 'nazov' => $p['nazov'] ?? $p['login'], 'hladina' => $h,
            'id' => trim((string)($p['id'] ?? '')), 'ico' => trim((string)($p['ico'] ?? ''))];
}
/** Hladina pre tento dopyt: partnerova alebo verejná MOC. */
function aktualna_hladina(): array {
    $p = aktualny_partner();
    if ($p) return $p['hladina'] + ['partner' => $p['nazov'], 'partner_id' => $p['id'], 'partner_ico' => $p['ico'], 'partner_login' => $p['login']];
    $h = hladina('moc') ?? ['kod' => 'moc', 'nazov' => 'MOC', 'koeficient' => 1.25, 's_dph' => true];
    return $h + ['partner' => null, 'partner_id' => null, 'partner_ico' => null, 'partner_login' => null];
}
