<?php
/**
 * Prihlásenie B2B partnerov (cenové hladiny). Účty sú v _cennik/partneri.csv.
 *
 *   GET  partner.php                      → { ok, prihlaseny, nazov, hladina:{kod,nazov,s_dph} }
 *   POST partner.php {login, heslo}       → prihlásenie
 *   POST partner.php {odhlasit:true}      → odhlásenie
 */
declare(strict_types=1);
require __DIR__ . '/lib.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function stav(): array {
    $p = aktualny_partner();
    if (!$p) return ['ok' => true, 'prihlaseny' => false];
    return ['ok' => true, 'prihlaseny' => true, 'nazov' => $p['nazov'],
            'hladina' => ['kod' => $p['hladina']['kod'], 'nazov' => $p['hladina']['nazov'], 's_dph' => $p['hladina']['s_dph']]];
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') odpoved(stav());

$vstup = json_decode((string)file_get_contents('php://input', false, null, 0, 4096), true);
if (!is_array($vstup)) chyba('Neplatná požiadavka.');

if (!empty($vstup['odhlasit'])) {
    b2b_session(true);
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $c = session_get_cookie_params();
        setcookie(session_name(), '', ['expires' => time() - 3600, 'path' => $c['path'], 'secure' => $c['secure'], 'httponly' => true, 'samesite' => 'Lax']);
    }
    session_destroy();
    odpoved(['ok' => true, 'prihlaseny' => false]);
}

// ochrana proti hádaniu hesiel
skontroluj_limit((int)($CFG['limit_prihlaseni'] ?? 10), (int)($CFG['limit_prihlaseni_okno_s'] ?? 900), 'login');

$login = trim((string)($vstup['login'] ?? ''));
$heslo = (string)($vstup['heslo'] ?? '');
if ($login === '' || $heslo === '' || strlen($login) > 80 || strlen($heslo) > 200) chyba('Zadajte prihlasovacie meno a heslo.', 401);

$p = partner_podla_loginu($login);
$ulozene = $p ? trim((string)($p['heslo'] ?? '')) : '';
$ok = false;
if ($p && $ulozene !== '') {
    $ok = strncmp($ulozene, '$2', 2) === 0 || strncmp($ulozene, '$argon', 6) === 0
        ? password_verify($heslo, $ulozene)
        : hash_equals($ulozene, $heslo);
}
if (!$ok || !hladina((string)$p['hladina'])) {
    usleep(400000);
    chyba('Nesprávne meno alebo heslo.', 401);
}

b2b_session(true);
session_regenerate_id(true);
$_SESSION['b2b_login'] = $p['login'];
session_write_close();
$_SESSION = ['b2b_login' => $p['login']];   // pre stav() v tej istej požiadavke
$h = hladina((string)$p['hladina']);
odpoved(['ok' => true, 'prihlaseny' => true, 'nazov' => $p['nazov'] ?? $p['login'],
         'hladina' => ['kod' => $h['kod'], 'nazov' => $h['nazov'], 's_dph' => $h['s_dph']]]);
