# Pyro & Polomárik

Objednávková platforma pre dve pizzerie pod jednou správou:

| Prevádzka          | Lokalita        |
| ------------------ | --------------- |
| **Pyro Pizzeria**  | Kamenná Poruba  |
| **Polomárik**      | Stráňavy        |

Obe prevádzky sú v jednej aplikácii. Každá má vlastné menu, ceny, otváracie
hodiny, rozvozové zóny, kupóny, personál a vlastné logo. Aplikácia pokrýva
objednávku zákazníka aj celý interný chod prevádzky: kuchyňu, rozvoz, výdaj pri
pulte a administráciu.

---

## Obsah

1. [Zákaznícka časť](#zákaznícka-časť)
2. [Interná časť pre personál](#interná-časť-pre-personál)
3. [Životný cyklus objednávky](#životný-cyklus-objednávky)
4. [Obchodné pravidlá](#obchodné-pravidlá)
5. [Účty a zabezpečenie](#účty-a-zabezpečenie)
6. [Technológie](#technológie)
7. [Štruktúra projektu](#štruktúra-projektu)

---

## Zákaznícka časť

| Stránka                   | Adresa                  | Účel |
| ------------------------- | ----------------------- | ---- |
| Výber prevádzky           | úvodná obrazovka        | Zákazník si ako prvé vyberie pizzeriu. Karta prevádzky ukazuje adresu, otváracie hodiny, či je práve otvorené, odhadovaný čas prípravy a vzdialenosť, ak zákazník povolí polohu. Podľa výberu sa prepne celá aplikácia. |
| Domov                     | `/`                     | Predstavenie prevádzky, obľúbené položky, recenzie zákazníkov a rýchly vstup do objednávky. |
| Menu                      | `/menu`                 | Kompletná ponuka rozdelená do kategórií: pizza, burgery, club sandwiche, ostatné, dresingy a omáčky. Obsahuje vyhľadávanie podľa názvu aj čísla z letáku, filtre (vegetariánske, pikantné, novinky, populárne), zoradenie podľa ceny, alergény a označenie vypredaných položiek. |
| Úprava pizze              | okno v menu             | Voľba veľkosti, extra syra, plneného okraja, pridanie alebo odobratie surovín, počet kusov a poznámka pre kuchyňu. Cena sa prepočítava priebežne. |
| Košík                     | bočný panel             | Zhrnutie objednávky, úprava množstva, zľavové kupóny a odhadovaný čas prípravy. |
| Pokladňa                  | `/checkout`             | Rozvoz alebo osobný odber, kontaktné údaje a platba hotovosťou alebo kartou pri prevzatí. Online platby sa nepoužívajú. |
| Rozvozové zóny            | `/delivery`             | Prehľad zón prevádzky a overenie adresy. Pri adrese v zóne sa zobrazí minimálna objednávka, poplatok za dopravu a čas doručenia. Pri adrese mimo zón aplikácia ponúkne osobný odber alebo inú prevádzku. |
| Sledovanie objednávky     | `/track`                | Stav objednávky v reálnom čase od prijatia po doručenie. Zákazník môže objednávku zrušiť, kým ju prevádzka nezačala pripravovať. |
| Účet                      | `/account`              | História objednávok naprieč zariadeniami, opakovanie objednávky, uložené kontaktné údaje, e-mailové notifikácie, zmena hesla, export údajov a zrušenie účtu. |
| Prihlásenie / registrácia | `/login`, `/register`   | Spoločné prihlásenie pre zákazníkov aj personál. Po prihlásení aplikácia presmeruje používateľa podľa jeho roly. |
| O nás, Kontakt            | `/about`, `/contact`    | Informácie o prevádzke, otváracie hodiny, telefón a mapa. |
| Ochrana údajov, Podmienky | `/privacy`, `/terms`    | Zásady ochrany osobných údajov (GDPR), obchodné podmienky a súhlas s cookies. |

Ikona v záložke prehliadača sa mení podľa zvolenej prevádzky. Aplikáciu je
možné nainštalovať ako PWA a má SEO metadáta so štruktúrovanými údajmi
(Schema.org).

---

## Interná časť pre personál

Každý zamestnanec patrí ku konkrétnej prevádzke a vidí iba jej objednávky.
Vstup do aplikácie určuje rola účtu.

| Rola          | Adresa      | Čo robí |
| ------------- | ----------- | ------- |
| **Admin**     | `/admin`    | Riadi celú prevádzku (pozri nižšie). |
| **Kuchár**    | `/kuchyna`  | Kuchynská tabuľa (KDS). Posúva objednávky cez stavy prijatá, v príprave a hotová. Hotovú objednávku môže po potvrdení vrátiť späť do prípravy. Platby ani odovzdanie objednávky nerieši. |
| **Rozvoz**    | `/rozvoz`   | Tabuľa pre vodiča. Vodič si berie hotové objednávky na rozvoz, jedným ťuknutím otvorí navigáciu na adresu, označí objednávku ako „na ceste“, potom ako doručenú a zaplatenú. Zapisuje aj telefonické objednávky. |
| **Telefón**   | `/call`     | Prehľad hotových objednávok rozdelený na rozvoz a osobný odber. Umožňuje priamo zavolať zákazníkovi. Iné akcie tento účet nemá. |
| **Zákazník**  | `/account`  | Bežný zákaznícky účet. |

Zamestnanec pracuje iba vtedy, keď má v daný deň priradenú zmenu. Bez zmeny
zostane prihlásený, ale na tabuli nemôže nič robiť.

### Administrácia

| Sekcia              | Účel |
| ------------------- | ---- |
| **Prehľad**         | Denné štatistiky: počet objednávok, tržba, rozdelenie na hotovosť a kartu, grafy. |
| **Kuchyňa (KDS)**   | Rovnaká kuchynská tabuľa, akú má kuchár. Pri novej objednávke zaznie zvukové upozornenie. |
| **Nová objednávka** | Zadanie telefonickej objednávky. Položky sa dajú hľadať aj podľa čísla z letáku. |
| **Objednávky**      | Zoznam objednávok podľa dní s filtrami a detailom. Admin tu môže upraviť alebo zrušiť objednávku, zmeniť spôsob platby, označiť objednávku ako nezaplatenú a pri pulte odovzdať a uzavrieť osobný odber. |
| **Produkty**        | Úprava menu: názvy, ceny, veľkosti, suroviny, alergény, označenia, dostupnosť a vypredanie. |
| **Prevádzka**       | Denné otvorenie a zatvorenie prevádzky, priradenie zmien personálu, vypredané položky, spočítanie pokladne s rozdelením sprepitného, prehľad odpracovaných dní a tržieb a mazanie starých objednávok. |
| **Rozvozové zóny**  | Obce a ulice v každej zóne, poplatok za dopravu, minimálna objednávka a čas doručenia. |
| **Kupóny**          | Vytváranie a mazanie zľavových kódov. |
| **Recenzie**        | Informácia o spätnej väzbe. Recenzie sa od zákazníkov zbierajú e-mailom po objednávke. |
| **Správa účtov**    | Správa zamestnaneckých účtov: roly, priradenie k prevádzke, odomknutie zablokovaného účtu, reset hesla. Sekcia je chránená samostatným heslom. |

Administrácia je navrhnutá aj pre tablet na prevádzke. Má zbaľovateľné bočné
menu, svetlý a tmavý režim a voliteľný ukazovateľ batérie tabletu.

---

## Životný cyklus objednávky

```
prijatá → akceptovaná → v príprave → hotová → na ceste → doručená
                                         │
                                         └→ (osobný odber) odovzdaná pri pulte
kedykoľvek pred prípravou → zrušená
```

| Stav             | Kto ho nastavuje |
| ---------------- | ---------------- |
| prijatá          | zákazník (web) alebo personál (telefonická objednávka) |
| akceptovaná      | kuchyňa |
| v príprave       | kuchyňa |
| hotová           | kuchyňa |
| na ceste         | vodič |
| doručená         | vodič, pri osobnom odbere admin pri pulte |
| zrušená          | zákazník pred začatím prípravy alebo admin |

Zákazník vidí každú zmenu stavu na stránke sledovania objednávky.

---

## Obchodné pravidlá

- **Ceny počíta server.** Celkovú sumu, ceny položiek, zľavy aj poplatok za
  dopravu vždy znova prepočíta server z aktuálneho menu. Suma poslaná
  z prehliadača sa ignoruje.
- **Minimálna objednávka podľa zóny.** Každá rozvozová zóna môže mať vlastné
  minimum (napr. Rajec a okolie 20 €). Kým ho objednávka nedosiahne, pokladňa
  ukazuje, koľko ešte chýba. Minimum kontroluje aj server.
- **Vypredané položky** sa v menu nedajú objednať a server ich odmietne.
- **Otváracie hodiny a denné otvorenie.** Prevádzka prijíma objednávky iba
  v otváracích hodinách a po tom, čo ju admin v daný deň otvorí.
- **Platba** prebieha výhradne pri prevzatí, v hotovosti alebo kartou.

---

## Účty a zabezpečenie

- Heslá sú uložené iba ako Argon2id hash. Po opakovaných neúspešných
  prihláseniach sa účet dočasne zablokuje.
- Prihlásenie, registrácia, objednávky a sledovanie objednávok majú obmedzený
  počet pokusov.
- Každá interná akcia overuje prihlásenie, rolu aj príslušnosť k prevádzke.
- Dôležité udalosti sa zapisujú do auditného logu: prihlásenia, objednávky,
  zmeny stavov, vypredanie, správa účtov.
- Odhlásiť sa dá naraz zo všetkých zariadení.
- Zákazník si môže stiahnuť svoje údaje alebo zrušiť účet. Pri zrušení účtu sa
  jeho staršie objednávky anonymizujú.

---

## Technológie

| Oblasť         | Použité riešenie |
| -------------- | ---------------- |
| Aplikácia      | Next.js 15 (App Router), React 19, TypeScript |
| Vzhľad         | Tailwind CSS, Framer Motion, ikony lucide-react |
| Stav v prehliadači | Zustand (košík, zvolená prevádzka, téma) |
| Databáza       | Neon Postgres (serverless driver, parametrizované dotazy) |
| Prihlásenie    | Auth.js (NextAuth v5), Argon2id |
| Validácia      | Zod |
| Mapy           | MapLibre GL, OpenStreetMap |
| Hosting        | Vercel |

---

## Štruktúra projektu

```
src/
  app/                  stránky aplikácie
    (zákazník)          /, menu, checkout, delivery, track, account,
                        login, register, about, contact, privacy, terms, offers
    admin/              administrácia prevádzky
    kuchyna/            kuchynská tabuľa
    rozvoz/             tabuľa vodiča
    call/               telefón / výdaj
    api/auth/           prihlasovanie (Auth.js)
  components/           UI komponenty
    admin/              sekcie a grafy administrácie
    CookApp, DriverApp, CallApp, StaffOrderForm   interné tabule
    Navbar, RestaurantModal, Cart, ProductCard,
    PizzaCustomizer, AddressVerification, …       zákaznícka časť
  lib/
    data.ts             východiskové údaje prevádzok (menu, hodiny, zóny)
    server-actions.ts   serverová logika objednávok, kuchyne, rozvozu a administrácie
    users.ts            účty, roly, prihlásenie
    pricing.ts          výpočet cien
    validation.ts       validácia vstupov
    security.ts         obmedzenie počtu pokusov, audit
    service-open.ts     otváracie hodiny a denné otvorenie
  middleware.ts         ochrana interných stránok
prisma/                 referenčná schéma databázy
public/logos/           logá prevádzok
```

---

© Všetky práva vyhradené. Podrobnosti v súbore [LICENSE](LICENSE).
