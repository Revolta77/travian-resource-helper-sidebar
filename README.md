# Travian Resource Helper

Súbory pre **Travian Resource Calculator** – rozšírenie pre prehliadač (Chromium, Manifest V3) a súvisiaci **userscript** (Resource Helper sidebar) s prekladmi **EN / SK**.

## Štruktúra projektu

| Cesta | Popis |
|--------|--------|
| `1.3_0/` | Balík rozšírenia: `manifest.json`, content skripty, popup, ikony. |
| `user-script.js` | Userscript (Tampermonkey / podobné) – bočný panel a logika „Resource Helper“. |
| `data/resource-helper-locales.js` | Centrálne reťazce pre userscript; zdroj pravdy pre i18n. |
| `embed-i18n.mjs` | Nástroj, ktorý vloží obsah `resource-helper-locales.js` do `user-script.js` (po úprave prekladov). |

Rozšírenie v `1.3_0` má vlastné `data/locales.js` – pri zmene textov v userscripte drž `resource-helper-locales.js` a príslušné súbory rozšírenia v súlade (podľa toho, čo používaš).

## Rozšírenie – načítanie v Chrome / Edge

1. Otvor `chrome://extensions` (alebo `edge://extensions`).
2. Zapni **Režim pre vývojárov** / **Developer mode**.
3. **Načítať rozšírenie bez balenia** / **Load unpacked** a vyber priečinok `1.3_0`.

Rozšírenie je nastavené na domény `*.travian.com` (pozri `manifest.json`).

## Userscript

Skopíruj obsah `user-script.js` do správcu userscriptov (napr. Tampermonkey) alebo ho nasmeruj na súbor podľa dokumentácie doplnku. Po úprave `data/resource-helper-locales.js` spusti synchronizáciu (nižšie).

## Synchronizácia prekladov do `user-script.js`

Z koreňa repozitára (vyžaduje [Node.js](https://nodejs.org/)):

```bash
node embed-i18n.mjs
```

Skript prečíta `data/resource-helper-locales.js` a vloží definície jazykov do `user-script.js` za `STORAGE_KEY`.

## Vývoj

- **Node:** `embed-i18n.mjs` používa ES moduly (`import`); spúšťaj cez `node embed-i18n.mjs`.
- **Poznámka k `manifest.json`:** pole `key` fixuje ID rozšírenia pri vývoji; pri verejnom forku zváž, či ho chceš z repozitára odstrániť a generovať lokálne.

## Git a push

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <URL-tvojho-repozitára>
git branch -M main
git push -u origin main
```

Ak repozitár už existuje s prvým commitom, použij len `git remote add` a `git push` podľa svojho hostingu (GitHub, GitLab, …).

## Licencia

Obsah repozitára používaj v súlade s licenciami pôvodných autorov a pravidlami hry Travian.
