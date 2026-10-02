<?php
// Nastavenia kalkulačky Fortissima. Tento súbor sa nedá otvoriť z prehliadača (api/.htaccess).

return [
    // Priečinok s cenníkom (CSV súbory).
    // Najbezpečnejšie je mať ho MIMO verejného priečinka webu, napr.:
    //   'cennik_dir' => __DIR__ . '/../../_cennik',   // vedľa public_html
    'cennik_dir' => __DIR__ . '/../_cennik',

    // Ochrana proti hromadnému sťahovaniu cien: max. počet dopytov z jednej IP adresy za časové okno.
    'limit_dopytov' => 150,
    'limit_okno_s'  => 600,

    // Najväčšia hrúbka steny, ktorú kalkulačka rieši (mm).
    'max_stena' => 400,

    // Sadzba DPH (ceny v cenníku sú VOC bez DPH).
    'dph' => 0.23,

    // Ochrana prihlasovania partnerov: max. pokusov z jednej IP za okno (s).
    'limit_prihlaseni' => 10,
    'limit_prihlaseni_okno_s' => 900,
];
