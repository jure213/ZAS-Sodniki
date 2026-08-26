# ZAS Sodniki: Supabase → VPS PostgreSQL cutover runbook

Ta dokument je celoten postopek za selitev podatkov aplikacije ZAS Sodniki iz
Supabase v PostgreSQL + PostgREST Docker stack na VPS-u. Izvajaj ga po vrsti.

## 0. Trenutno stanje (26. 8. 2026)

Že narejeno:

- `zas-sodniki-db` (PostgreSQL 17.11) teče in je `healthy`.
- `zas-sodniki-api` (PostgREST 14.12) teče.
- PostgreSQL nima javnega host porta; pgAdmin ga doseže prek `psql-net`.
- API je objavljen na `https://sodniki-api.jurer.eu/rest/v1/`.
- TLS certifikat za `sodniki-api.jurer.eu` velja do 24. 11. 2026.
- Zahteva brez API ključa pravilno vrne `401 Unauthorized`.
- Produkcijski `.env` in novi API ključ sta že ustvarjena z dovoljenji `0600`.
- Aplikacija je preusmerjena na novi API in verzija je dvignjena na `1.0.7`.
- TypeScript in Linux paket sta že uspešno zgrajena.
- Ciljna baza je še prazna; Supabase podatki še niso izvoženi ali uvoženi.
- Poskusni lokalni backup prazne ciljne baze je uspel.

Ne naredi naslednjega:

- Ne poganjaj ponovno `node scripts/generate-deploy-env.js`.
- Ne objavi verzije 1.0.7 pred končnim uvozom.
- Ne izklopi ali izbriši Supabase pred uspešnim končnim exportom.
- Ne dodajaj javnega `ports:` za PostgreSQL ali PostgREST.

## 1. Popravi pgAdmin certifikat

Origin certifikat za `psql-db.jurer.eu` je pretekel 16. 7. 2026, zato
Cloudflare trenutno lahko vrača `526`. Obnovi ga:

```bash
sudo certbot certonly --webroot \
  -w /var/www/certbot \
  -d psql-db.jurer.eu \
  --force-renewal

sudo docker exec reverse-proxy nginx -t
sudo docker exec reverse-proxy nginx -s reload
curl -I https://psql-db.jurer.eu
```

Pričakovan rezultat zadnjega ukaza je `401 Unauthorized`, ker je pgAdmin
zaščiten z dodatnim nginx geslom.

## 2. Jutrišnji začetni preflight

```bash
cd /home/jurer/projects/ZAS-Sodniki

sudo docker compose ps
sudo docker exec reverse-proxy nginx -t
curl -I https://sodniki-api.jurer.eu/rest/v1/
```

Pričakovano:

- `zas-sodniki-db` je `healthy`;
- `zas-sodniki-api` je `Up`;
- nginx test je uspešen;
- API brez ključa vrne `401 Unauthorized`.

Če containerja ne tečeta:

```bash
sudo docker compose up -d
sudo docker compose logs --tail=100 db api
```

## 3. Vzemi povezovalne podatke iz Supabase

V Supabase Dashboardu:

1. Odpri projekt ZAS Sodniki.
2. Na vrhu klikni **Connect**.
3. Izberi **Session pooler**.
4. Pripravi naslednje vrednosti:
   - Host, npr. `aws-0-eu-central-1.pooler.supabase.com`;
   - Port: `5432`;
   - Database: `postgres`;
   - User: `postgres.<project-ref>`;
   - database password.

Uporabi **Session pooler na portu 5432**. Ne uporabi Transaction poolerja na
portu 6543. Če database password ni znan, ga najprej resetiraj v Database
settings projekta.

Uradna razlaga povezav:
https://supabase.com/docs/guides/database/connecting-to-postgres

## 4. Poskusni export (Supabase ostane aktiven)

Med poskusnim exportom lahko trenutna aplikacija še deluje. Zaženi:

```bash
cd /home/jurer/projects/ZAS-Sodniki
./deploy/scripts/export-supabase.sh
```

Skripta vpraša:

```text
Supabase database host: <SESSION_POOLER_HOST>
Port [5432]: 5432
Database [postgres]: postgres
Username [postgres]: postgres.<project-ref>
Database password: <GESLO_SE_NE_PRIKAŽE>
```

Na koncu mora izpisati tri poti:

```text
Export verified: .../zas-sodniki-supabase-<TIMESTAMP>.dump
Metadata:        .../zas-sodniki-supabase-<TIMESTAMP>.metadata.txt
Checksum:        .../zas-sodniki-supabase-<TIMESTAMP>.dump.sha256
```

Preglej datoteke:

```bash
ls -lh deploy/dumps/
```

Preveri checksum; `<TIMESTAMP>` zamenjaj z dejanskim imenom:

```bash
sha256sum --check \
  deploy/dumps/zas-sodniki-supabase-<TIMESTAMP>.dump.sha256
```

Pričakovano:

```text
...dump: OK
```

Preglej izvorno verzijo, extensione in število vrstic:

```bash
cat deploy/dumps/zas-sodniki-supabase-<TIMESTAMP>.metadata.txt
```

Dump in metadata sta občutljiva podatka. Ne pošiljaj ju v Git, e-pošto ali
issue; mapa `deploy/dumps/` je že v `.gitignore`.

## 5. Poskusni restore

Ker je ciljna baza trenutno prazna, pri prvem restoreu ne uporabi `--replace`:

```bash
./deploy/scripts/restore-dump.sh \
  deploy/dumps/zas-sodniki-supabase-<TIMESTAMP>.dump
```

Nato:

```bash
./deploy/scripts/verify.sh
```

Pričakovano:

- prisotnih je šest tabel;
- izpiše se število vrstic v vsaki tabeli;
- javni API je dosegljiv z novim ključem;
- zadnja vrstica je `Database and public API checks passed.`

Obvezne tabele:

```text
users
officials
competitions
competition_officials
payments
settings
```

Primerjaj število vrstic z `.metadata.txt`. Če se katerakoli številka ne ujema,
ne nadaljuj na končni cutover.

## 6. Dodaj bazo v pgAdmin

Odpri `https://psql-db.jurer.eu`, nato dodaj server:

```text
Name: ZAS Sodniki
Host: zas-sodniki-db
Port: 5432
Maintenance database: zas_sodniki
Username: zas_sodniki_admin
```

Database password lahko v zasebnem terminalu prebereš z:

```bash
cd /home/jurer/projects/ZAS-Sodniki
sed -n 's/^POSTGRES_PASSWORD=//p' .env
```

Gesla ne kopiraj v dokumentacijo ali Git.

## 7. Funkcionalni test poskusne kopije

Najprej preveri build:

```bash
npm run tsc
```

Na računalniku z namiznim okoljem zaženi development ali namesti testni paket.
Preveri:

1. prijavo;
2. prikaz uporabnikov in sodnikov;
3. prikaz tekmovanj in plačil;
4. branje in shranjevanje nastavitev;
5. ustvarjanje testnega zapisa;
6. spremembo testnega zapisa;
7. izbris testnega zapisa.

Poskusna ciljna baza je samo snapshot. Dokler ni izveden končni cutover, ostaja
Supabase edini produkcijski vir resnice. Verzije 1.0.7 še ne razpošlji.

## 8. Končni cutover

Ta del izvedi v enem maintenance oknu.

### 8.1 Ustavi pisanje

- Obvesti vse uporabnike.
- Vsi naj popolnoma zaprejo verzijo 1.0.6.
- Od tega trenutka nihče ne sme spreminjati podatkov.

### 8.2 Naredi nov končni export

Ponovno zaženi:

```bash
cd /home/jurer/projects/ZAS-Sodniki
./deploy/scripts/export-supabase.sh
```

Vnesi iste Session pooler podatke. Uporabi novi, najnovejši timestamp in preveri
checksum:

```bash
ls -lt deploy/dumps/
sha256sum --check \
  deploy/dumps/zas-sodniki-supabase-<NOVI_TIMESTAMP>.dump.sha256
```

Ne nadaljuj, če rezultat ni `OK`.

### 8.3 Takoj blokiraj staro aplikacijo

Po uspešnem končnem dumpu v Supabase Dashboardu odpri:

```text
Project Settings → API Keys → Legacy API Keys
```

Deaktiviraj stari `service_role` ključ, ki ga uporablja verzija 1.0.6. Če UI
legacy `anon` in `service_role` obravnava skupaj, deaktiviraj oba. Deaktivacija
je reverzibilna. Ne briši projekta in ne rotiraj po nepotrebnem celotnega JWT
sistema.

Uradna navodila:
https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys

### 8.4 Prepiši poskusno bazo s končnim dumpom

```bash
./deploy/scripts/restore-dump.sh --replace \
  deploy/dumps/zas-sodniki-supabase-<NOVI_TIMESTAMP>.dump
```

Na poziv vpiši natančno:

```text
REPLACE zas_sodniki
```

Nato izvedi:

```bash
./deploy/scripts/verify.sh
./deploy/scripts/backup.sh
```

Ponovno primerjaj število vrstic s končnim `.metadata.txt`.

## 9. Objavi aplikacijo 1.0.7

Šele po uspešnem končnem restoreu in preverjanju naredi produkcijske pakete.

Linux:

```bash
npm run build:linux
```

Windows:

```bash
npm run build:win
```

Na GitHubu objavi release/tag:

```text
v1.0.7
```

Za delovanje obstoječega Electron updaterja morajo biti v releaseu ustrezni
installer, update `.yml` in `.blockmap` artefakti, ki jih ustvari
`electron-builder`.

Namesti 1.0.7 na enem testnem računalniku in ponovi prijavo, branje ter en
create/update/delete test. Nato dovoli posodobitev ostalim uporabnikom. Stara
1.0.6 mora po deaktivaciji Supabase ključa izgubiti dostop.

## 10. Vključi tedenski backup

Ročni backup je že bil preizkušen. Namesti timer:

```bash
cd /home/jurer/projects/ZAS-Sodniki

sudo cp deploy/systemd/zas-sodniki-backup.service /etc/systemd/system/
sudo cp deploy/systemd/zas-sodniki-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now zas-sodniki-backup.timer
sudo systemctl list-timers zas-sodniki-backup.timer
```

Naredi še prvi produkcijski timer test:

```bash
sudo systemctl start zas-sodniki-backup.service
sudo systemctl status zas-sodniki-backup.service --no-pager
ls -lh deploy/backups/
```

Backupi so stisnjeni, imajo checksum in dovoljenja `0600`. Hranijo se 56 dni.

## 11. Nastavi reload nginx ob obnovi certifikatov

Certbot certifikat obnovi, Docker nginx pa mora po obnovi ponovno naložiti
datoteke:

```bash
sudo mkdir -p /etc/letsencrypt/renewal-hooks/deploy
sudo tee /etc/letsencrypt/renewal-hooks/deploy/reload-docker-nginx.sh >/dev/null <<'EOF'
#!/bin/sh
/usr/bin/docker exec reverse-proxy nginx -t && \
/usr/bin/docker exec reverse-proxy nginx -s reload
EOF
sudo chmod 755 /etc/letsencrypt/renewal-hooks/deploy/reload-docker-nginx.sh
sudo certbot renew --dry-run
```

## 12. Po migraciji

- Supabase projekta najmanj 30 dni ne izbriši.
- Pusti stare API ključe deaktivirane.
- Spremljaj `docker compose logs` in tedenske backupe.
- Po 30 dneh lahko projekt izbrišeš šele, ko potrdiš delovanje backup/restora.
- `.env`, dumpe in backupe vedno obravnavaj kot občutljive podatke.

Redno preverjanje:

```bash
cd /home/jurer/projects/ZAS-Sodniki
sudo docker compose ps
sudo docker compose logs --tail=100 db api
sudo docker exec reverse-proxy nginx -t
./deploy/scripts/verify.sh
systemctl list-timers zas-sodniki-backup.timer
```

## 13. Rollback

### Pred objavo 1.0.7 in pred novimi zapisi na VPS-u

Če končni restore ali preverjanje ne uspe:

1. ponovno aktiviraj stari Supabase legacy ključ;
2. uporabniki naj ostanejo na verziji 1.0.6;
3. odpravi napako in ponovi finalni export/restore;
4. ne objavi 1.0.7.

### Po novih produkcijskih zapisih na VPS-u

Supabase ključa ne vključi neposredno, ker bi nastala dva različna vira resnice.
Tak rollback zahteva nov dump iz VPS PostgreSQL in nadzorovan povratni restore v
Supabase.

## 14. Pogoste napake

### `password authentication failed`

- preveri database password;
- pri Session poolerju mora biti user `postgres.<project-ref>`;
- uporabi port `5432`.

### Direct host ni dosegljiv

Uporabi Session pooler. Supabase direct connection je pogosto IPv6, Session
pooler pa je dosegljiv prek IPv4.

### `restore-dump.sh` pravi, da cilj vsebuje tabele

Pri finalnem restoreu uporabi `--replace`. Pri poskusnem restoreu tega ne naredi,
razen če zavestno ponavljaš prejšnji poskus.

### Nginx `host not found in upstream`

Preveri, ali vsi upstream containerji tečejo in so na `proxy-net`:

```bash
sudo docker ps
sudo docker network inspect proxy-net
```

Nato vedno:

```bash
sudo docker exec reverse-proxy nginx -t
sudo docker exec reverse-proxy nginx -s reload
```

### API vrne `401`

`401` brez API ključa je pričakovan. `./deploy/scripts/verify.sh` uporabi lokalni
ključ iz `.env` in mora po restoreu uspeti.

### API vrne `404` za tabelo

Tabela še ni obnovljena ali PostgREST schema cache ni osvežen. Preveri restore
loge in zaženi:

```bash
sudo docker compose exec -T db \
  psql -U zas_sodniki_admin -d zas_sodniki \
  -c "NOTIFY pgrst, 'reload schema';"
```
