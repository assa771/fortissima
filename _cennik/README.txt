CENNÍK PRE KALKULAČKU FORTISSIMA
================================

!!! Ceny v týchto súboroch sú VZOROVÉ (ilustračné). Pred spustením ich nahraďte skutočnými. !!!
!!! Skutočný cenník ani zoznam partnerov NIKDY nedávajte na GitHub. !!!

Súbory sa dajú otvoriť a upravovať v Exceli. Pri ukladaní zvoľte formát
„CSV (oddelený bodkočiarkou)“ alebo „CSV UTF-8“. Prvý riadok (hlavičku) nemeňte.

CENY = VOC BEZ DPH
------------------
Všetky ceny výrobkov (krídla, zárubne, rozšírenia, príplatky, zámky, závesy, mriežky)
sú VOC – veľkoobchodné ceny BEZ DPH, v eurách. Desatinná čiarka aj bodka fungujú.
Z VOC sa podľa cenovej hladiny (hladiny.csv) dopočíta všetko ostatné:
   MOC (maloobchod, verejný web) = VOC × 1,25 + DPH 23 %
   partneri: VOC, VOC −10 %, VOC +5 % (bez DPH; DPH sa zobrazí zvlášť)
Sadzba DPH je v api/config.php ('dph' => 0.23).

Hviezdička *  = platí pre všetky hodnoty. Ak viac riadkov sedí, použije sa
najkonkrétnejší (s najmenej hviezdičkami). Takto viete napr. dať inú cenu
len pre bielu farbu alebo len pre šírku 90.

kridla.csv      kolekcia (minimal | vertikal | prestige), prevedenie (falc | bez),
                farba (biela | kasmirova), sirka (60 | 65 | 70 | 80 | 90),
                vyska (197 | 2055 | 210), cena_voc, dodanie_dni (0 = skladom)
zarubne.csv     typ (F80 | F100 | F130 | F160), prevedenie (falc | bez | slepa = samostatná
                tunelová zárubňa bez závesov a protiplechu), farba (= farba ZÁRUBNE, môže byť iná ako krídla),
                sirka, vyska, cena_voc, dodanie_dni
rozsirenia.csv  typ (R90 | R180), sirka, vyska, cena_voc, dodanie_dni
                (voliteľne aj stĺpec farba = farba zárubne)
                (ak R180 nemá cenu, počíta sa ako 2 × R90)
priplatky.csv   polozka (kridlo | zarubna | prah | spoj-tupo | skratenie-kridlo | skratenie-zarubna), sirka, vyska, priplatok_voc, popis
                prah = výsuvný (padací) prah v spodku krídla; účtuje sa len keď ho zákazník zvolí (môže mať inú cenu podľa šírky)
                spoj-tupo = príplatok k zárubni za rohový spoj na tupo (90°); spoj na pokos (45°) je základ
                skratenie-kridlo / skratenie-zarubna = príplatok za skrátenie na mieru
                – príplatky sa k základnej cene PRIČÍTAVAJÚ (všetky, ktoré sedia)
zavesy.csv      kod (nikel | cierna), nazov, cena_voc = príplatok k zárubni, dodanie_dni
                (závesy sú súčasťou zárubne, nie samostatná položka; slepá zárubňa závesy nemá)
kovanie.csv     kod (bez medzier, nemeniť pri existujúcich), nazov (zobrazí sa zákazníkovi),
                cena_voc = príplatok ku krídlu, dodanie_dni – poradie riadkov = poradie v ponuke
                (zámok je súčasťou krídla, nie samostatná položka)
mriezky.csv     kod (bez | biela | hlinik | cierna …), nazov, cena_voc = príplatok ku krídlu, dodanie_dni
                (vetracia mriežka – všetky kolekcie, pri rámových dverách v spodnom vlysu; riadok "bez" ponechať)
skratenie.csv   kolekcia (minimal | vertikal | prestige = krídlo; zarubna = zárubňa vrátane slepej), vyska (197 | 2055 | 210),
                max_mm = o koľko mm sa dajú dvere najviac skrátiť (prirezanie zo spodu),
                max_mm_mriezka = limit, ak má krídlo vetraciu mriežku (pri zárubni sa nepoužíva), poznamka
                Krídlo a zárubňa sa skracujú nezávisle; zárubňa nemôže byť skrátená viac ako krídlo.

CENOVÉ HLADINY A PARTNERI
-------------------------
hladiny.csv     kod, nazov (zobrazí sa partnerovi), koeficient (× VOC), zobrazit_s_dph (1 = ceny s DPH, 0 = bez DPH), poznamka
                riadok "moc" = verejný web (neprihlásený návštevník). Kód hladiny nemeňte, názov a koeficient áno.
partneri.csv    login, heslo, hladina (kód z hladiny.csv), nazov (firma), aktivny (1 = môže sa prihlásiť, 0 = zablokovaný),
                id (číslo partnera z výroby, napr. P002), ico – podľa nich výroba pozná, kto objednávku poslal.
                Súbor sa dá vygenerovať vo výrobe: Partneri → Exportovať prístupy pre web.
                heslo: odporúčame zahašované (začína $2y$…); dá sa zadať aj čisté heslo, ale potom
                ho chráni iba zablokovaný priečinok. Hash vytvoríte napr. príkazom:
                   php -r 'echo password_hash("NoveHeslo", PASSWORD_DEFAULT);'
                Ukážkové účty (len na skúšku, pred spustením zmazať):
                   partner-voc / ukazka-voc, partner-minus10 / ukazka-minus10, partner-plus5 / ukazka-plus5

SLUŽBY
------
sluzby.csv      MALOOBCHOD (Košice a okolie), ceny S DPH:
                montaz-falc / montaz-bez / montaz-posuvne / montaz-slepa – montáž za kus podľa typu dverí
                zameranie – pridá sa automaticky, keď zákazník zvolí montáž (paušál za zákazku)
                doprava – cena za 1 km; počíta sa vzdialenosť × 2 (tam aj späť)
sluzby_b2b.csv  PARTNERI, ceny BEZ DPH: doprava-kridlo (za každé krídlo), doprava-zarubna (za každú zárubňu)
                Montáž a zameranie partneri nemajú.

BEZPEČNOSŤ: tento priečinok je zablokovaný súborom .htaccess. Ešte bezpečnejšie je
presunúť ho mimo verejný priečinok webu (napr. vedľa public_html) a cestu nastaviť
v súbore api/config.php.
