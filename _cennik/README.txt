CENNÍK PRE KALKULAČKU FORTISSIMA
================================

!!! Ceny v týchto súboroch sú VZOROVÉ (ilustračné). Pred spustením ich nahraďte skutočnými. !!!

Súbory sa dajú otvoriť a upravovať v Exceli. Pri ukladaní zvoľte formát
„CSV (oddelený bodkočiarkou)“ alebo „CSV UTF-8“. Prvý riadok (hlavičku) nemeňte.

Všetky ceny sú S DPH, v eurách. Desatinná čiarka aj bodka fungujú (12,50 aj 12.50).

Hviezdička *  = platí pre všetky hodnoty. Ak viac riadkov sedí, použije sa
najkonkrétnejší (s najmenej hviezdičkami). Takto viete napr. dať inú cenu
len pre bielu farbu alebo len pre šírku 90.

kridla.csv      kolekcia (minimal | vertikal | prestige), prevedenie (falc | bez),
                farba (biela | kasmirova), sirka (60 | 65 | 70 | 80 | 90),
                vyska (197 | 2055 | 210), cena_s_dph, dodanie_dni (0 = skladom)
zarubne.csv     typ (F80 | F100 | F130 | F160), prevedenie, farba, sirka, vyska, cena_s_dph, dodanie_dni
rozsirenia.csv  typ (R90 | R180), sirka, vyska, cena_s_dph, dodanie_dni
                (ak R180 nemá cenu, počíta sa ako 2 × R90)
priplatky.csv   polozka (kridlo | zarubna), sirka, vyska, priplatok_s_dph, popis
                – príplatky sa k základnej cene PRIČÍTAVAJÚ (všetky, ktoré sedia)
kovanie.csv     kod (bez medzier, nemeniť pri existujúcich), nazov (zobrazí sa zákazníkovi),
                cena_s_dph, dodanie_dni – poradie riadkov = poradie v ponuke
sluzby.csv      montaz (cena za kus), doprava (cena za objednávku)

BEZPEČNOSŤ: tento priečinok je zablokovaný súborom .htaccess. Ešte bezpečnejšie je
presunúť ho mimo verejný priečinok webu (napr. vedľa public_html) a cestu nastaviť
v súbore api/config.php.
