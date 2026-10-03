# Fortissima – riadenie výroby (prototyp)

Interná aplikácia: zákazky → výrobné dávky → výrobná dokumentácia → sklad → expedícia.
Beží celá v prehliadači, dáta sú v `localStorage` daného prehliadača (záloha: Nastavenia → Export).

- Import objednávky z kalkulačky webu (rovnaký prehliadač) alebo zo súboru JSON/CSV z kalkulačky.
- Výstupy: výdajka, CNC list krídel (Homag), príprava zárubní + rezný plán, CNC list zárubní (Comec),
  kompletačný list, dodací list, nákladkový list, štítky, CSV pre MRP.
- CNC kódy sú v rovnakom formáte ako v doterajšom Exceli; všetky technické konštanty sú v Nastaveniach.

Do repozitára nepatria žiadne skutočné dáta zákazníkov.
