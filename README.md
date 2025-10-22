# ZAS Sodniki

Namizna aplikacija za vodenje izplačil atletskih sodnikov. 

## Hitri zagon

```zsh
# 1) Namesti odvisnosti (prenese tudi native binarije za better-sqlite3)
npm install

# 2) Dev zagon (prevede TS in zažene Electron)
npm run dev
```

- Privzeti admin uporabnik: `admin` / `123`
- Baza se ustvari v: `$XDG_CONFIG_HOME/zas-sodniki-vanilla/zas-sodniki.db` (na Linuxu običajno `~/.config/...`).

## Gradnja paketov

```zsh
# Linux
npm run build:linux

# Windows (potreben Wine za cross-build na Linuxu)
npm run build:win
```

Artefakti bodo v mapi `release/`.

## Struktura

- `electron/` — glavna Electron logika (TypeScript)
  - `main.ts` — zagon aplikacije, okno, IPC registracija
  - `preload.ts` — varni most (contextBridge) do rendererja
  - `database.ts` — SQLite upravljalnik (ustvari shemo, nekaj helperjev)
  - `handlers/` — IPC handlerji (auth, settings, officials, …)
- `src/` — renderer (HTML + JS)
  - `index.html` — osnovni UI (Bootstrap) + hitri testi
  - `renderer.js` — kliče API iz `preload`

## Opombe o varnosti

- Gesla so trenutno shranjena v navadnem besedilu za potrebe prototipa. Za produkcijo zamenjajte z bcrypt/scrypt in dodajte ustrezno politiko.
- `contextIsolation` je omogočen in `nodeIntegration` onemogočen.

## Licenca

MIT
