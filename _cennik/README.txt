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
zarubne.csv     typ (F80 | F100 | F130 | F160), prevedenie (falc | bez | slepa = samostatná
                tunelová zárubňa bez závesov a protiplechu), farba (= farba ZÁRUBNE, môže byť iná ako krídla),
                sirka, vyska, cena_s_dph, dodanie_dni
rozsirenia.csv  typ (R90 | R180), sirka, vyska, cena_s_dph, dodanie_dni
                (voliteľne aj stĺpec farba = farba zárubne)
                (ak R180 nemá cenu, počíta sa ako 2 × R90)
priplatky.csv   polozka (kridlo | zarubna | prah | spoj-tupo | skratenie-kridlo | skratenie-zarubna), sirka, vyska, priplatok_s_dph, popis
                prah = výsuvný (padací) prah v spodku krídla; účtuje sa len keď ho zákazník zvolí (môže mať inú cenu podľa šírky)
                spoj-tupo = príplatok k zárubni za rohový spoj na tupo (90°); spoj na pokos (45°) je základ
                – príplatky sa k základnej cene PRIČÍTAVAJÚ (všetky, ktoré sedia)
zavesy.csv      kod (nikel | cierna), nazov, cena_s_dph = príplatok k zárubni, dodanie_dni
                (závesy sú súčasťou zárubne, nie samostatná položka; slepá zárubňa závesy nemá)
kovanie.csv     kod (bez medzier, nemeniť pri existujúcich), nazov (zobrazí sa zákazníkovi),
                cena_s_dph = príplatok ku krídlu, dodanie_dni – poradie riadkov = poradie v ponuke
                (zámok je súčasťou krídla, nie samostatná položka)
mriezky.csv     kod (bez | biela | hlinik | cierna …), nazov, cena_s_dph = príplatok ku krídlu, dodanie_dni
                (vetracia mriežka – všetky kolekcie, pri rámových dverách v spodnom vlysu; riadok "bez" ponechať)
sluzby.csv      montaz-falc / montaz-bez / montaz-posuvne / montaz-slepa – montáž za kus podľa typu dverí
                zameranie – pridá sa automaticky, keď zákazník zvolí montáž (paušál za zákazku)
                doprava – cena za 1 km; počíta sa vzdialenosť × 2 (tam aj späť)

BEZPEČNOSŤ: tento priečinok je zablokovaný súborom .htaccess. Ešte bezpečnejšie je
presunúť ho mimo verejný priečinok webu (napr. vedľa public_html) a cestu nastaviť
v súbore api/config.php.

skratenie.csv   kolekcia (minimal | vertikal | prestige | slepa), vyska (197 | 2055 | 210),
                max_mm = o koľko mm sa dajú dvere najviac skrátiť (prirezanie zo spodu),
                max_mm_mriezka = limit, ak má krídlo vetraciu mriežku, poznamka
                Cena skrátenia je v priplatky.csv: skratenie-kridlo (ku krídlu) a skratenie-zarubna (k zárubni).
