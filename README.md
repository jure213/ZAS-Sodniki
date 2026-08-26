# ZAS Sodniki

Namizna aplikacija za vodenje izplačil atletskih sodnikov.

## Hitri zagon

```zsh
# 1) Namesti odvisnosti
npm install

# 2) Na razvojnem računalniku varno nastavi ZAS_API_URL in ZAS_API_KEY
#    (produkcijska .env je že ustvarjena na VPS-u)

# 3) Dev zagon (prevede TS in zažene Electron)
npm run dev
```

`node scripts/generate-deploy-env.js` uporabi samo ob prvi postavitvi novega
strežnika. Lokalno generiran ključ ne bo veljal proti obstoječemu produkcijskemu
API-ju.

Aplikacija uporablja lasten PostgREST API. Produkcijski PostgreSQL in API sta
opisana v [DEPLOYMENT.md](DEPLOYMENT.md).

## Gradnja paketov

```zsh
# Linux
npm run build:linux

# Windows
npm run build:win
```

Datoteke za nastavitev v posameznem sisetmu bodo v mapi `release/`.

## Struktura

- `electron/` — glavna Electron logika (TypeScript)
  - `main.ts` — zagon aplikacije, okno, IPC registracija
  - `preload.ts` — varni most (contextBridge) do rendererja
  - `supabase.ts` — HTTP podatkovni odjemalec, združljiv s PostgREST API-jem
  - `handlers/` — IPC handlerji (auth, settings, officials, …)
- `src/` — renderer (HTML + JS)
  - `index.html` — osnovni UI (Bootstrap) + hitri testi
  - `renderer.js` — kliče API iz `preload`
- `deploy/` — PostgreSQL/PostgREST migracija, nginx predloge in backupi

## Licenca

MIT
