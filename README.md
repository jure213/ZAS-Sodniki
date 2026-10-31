# ZAS Sodniki

Namizna aplikacija za vodenje izplačil atletskih sodnikov.

## Hitri zagon

```zsh
# 1) Namesti odvisnosti
npm install

# 2) Dev zagon (prevede TS in zažene Electron)
npm run dev

# Proti drugemu API-ju (npr. lokalni testni stack):
ZAS_API_URL=http://localhost:8080 npm run dev
```

Aplikacija ne vsebuje nobenega ključa. Uporabnik se prijavi z uporabniškim
imenom in geslom; baza vrne kratkotrajen žeton z vlogo `zas_user` ali
`zas_admin`, pravice pa preverja PostgreSQL. `node scripts/generate-deploy-env.js`
uporabi samo ob prvi postavitvi novega strežnika.

Aplikacija uporablja lasten PostgREST API. Produkcijski PostgreSQL, API in
migracije baze so opisani v [DEPLOYMENT.md](DEPLOYMENT.md).

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
  - `supabase.ts` — PostgREST odjemalec; hrani žeton prijavljenega uporabnika
  - `handlers/` — IPC handlerji (auth, settings, officials, …)
- `src/` — renderer (HTML + JS)
  - `index.html` — osnovni UI (Bootstrap) + hitri testi
  - `renderer.js` — kliče API iz `preload`
- `deploy/` — PostgreSQL/PostgREST postavitev, nginx predloge in backupi
  - `sql/000_baseline.sql` — shema pred migracijami (samo dokumentacija)
  - `sql/NNN_*.sql` — migracije, ki jih izvede `scripts/migrate.sh`
  - `sql/roles.sql`, `sql/grant-api.sql` — API vloge in pravice

## Licenca

MIT
