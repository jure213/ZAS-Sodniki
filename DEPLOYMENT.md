# Selitev ZAS Sodniki iz Supabase na VPS

Stack vsebuje zasebni PostgreSQL 17 in PostgREST API. PostgreSQL nima javnega
porta. Electron aplikacija dostopa samo do
`https://sodniki-api.jurer.eu/rest/v1/`, pgAdmin pa do baze prek omrežja
`psql-net`.

## 1. DNS

V DNS-u dodaj `A` zapis:

```text
sodniki-api.jurer.eu -> javni IPv4 naslov tega VPS-a
```

Če uporabljaš Cloudflare, naj bo zapis med izdajo certifikata nastavljen na
`DNS only`.

## 2. Priprava skrivnosti in Docker stacka

Na trenutnem VPS-u je ta korak že izveden. Ukaz za generiranje `.env` uporabi
samo pri povsem novi postavitvi.

```bash
cd /home/jurer/projects/ZAS-Sodniki
node scripts/generate-deploy-env.js
npm run generate:config
sudo docker network inspect proxy-net >/dev/null || sudo docker network create proxy-net
sudo docker network inspect psql-net >/dev/null || sudo docker network create psql-net
sudo docker compose config --quiet
sudo docker compose pull
sudo docker compose up -d
sudo docker compose ps
```

Datoteki `.env` in `electron/generated/api-config.ts` vsebujeta ključe in se ne
commitata. `node scripts/generate-deploy-env.js --force` ju rotira; tega ne
uporabi med delovanjem že izdanih odjemalcev brez nove izdaje aplikacije.

## 3. HTTP route in TLS certifikat

Najprej namesti samo HTTP konfiguracijo:

```bash
sudo cp deploy/nginx/sodniki-api.http.conf \
  /home/jurer/projects/vps-reverse-proxy/conf.d/sodniki-api.http.conf
sudo docker exec reverse-proxy nginx -t
sudo docker exec reverse-proxy nginx -s reload
sudo certbot certonly --webroot -w /var/www/certbot -d sodniki-api.jurer.eu
```

Te ukaze izvedi šele, ko DNS zapis že kaže na ta VPS.

Po uspešno izdanem certifikatu namesti HTTPS konfiguracijo:

```bash
sudo cp deploy/nginx/sodniki-api.https.conf \
  /home/jurer/projects/vps-reverse-proxy/conf.d/sodniki-api.https.conf
sudo docker exec reverse-proxy nginx -t
sudo docker exec reverse-proxy nginx -s reload
```

Ne dodajaj `ports:` na `db` ali `api`; javna sta samo porta 80/443 obstoječega
`reverse-proxy` containerja.

## 4. Rehearsal export iz Supabase

V Supabase Dashboard odpri **Connect** oziroma **Database settings** in si
pripravi host, port, database, user in database password. Nato zaženi:

```bash
cd /home/jurer/projects/ZAS-Sodniki
./deploy/scripts/export-supabase.sh
```

Skripta geslo prebere skrito in ustvari tri privatne datoteke v
`deploy/dumps/`: `.dump`, `.metadata.txt` in `.sha256`.

Če Supabase direct host ni dosegljiv prek IPv6, v Dashboardu izberi session
pooler ter v skripto vnesi njegov host, port in uporabniško ime.

Uvozi izpisano `.dump` datoteko:

```bash
./deploy/scripts/restore-dump.sh deploy/dumps/zas-sodniki-supabase-YYYYMMDDTHHMMSSZ.dump
./deploy/scripts/verify.sh
npm run tsc
```

V pgAdmin dodaj strežnik z naslednjimi podatki:

```text
Host: zas-sodniki-db
Port: 5432
Maintenance database: zas_sodniki
Username: zas_sodniki_admin
Password: POSTGRES_PASSWORD iz lokalne .env datoteke
```

Pred cutoverjem v development buildu preveri prijavo, sezname, nastavitve ter
create/update/delete testnega zapisa.

## 5. Končni cutover

1. Obvesti uporabnike in zapri vse instance aplikacije, da se pisanje ustavi.
2. Ponovno zaženi `./deploy/scripts/export-supabase.sh` in počakaj, da skripta
   potrdi archive ter checksum.
3. V Supabase Dashboard začasno ustavi projekt oziroma onemogoči stari API ključ,
   da stare verzije aplikacije ne morejo več pisati.
4. Končni dump uvozi z eksplicitnim overwriteom:

```bash
./deploy/scripts/restore-dump.sh --replace \
  deploy/dumps/zas-sodniki-supabase-YYYYMMDDTHHMMSSZ.dump
./deploy/scripts/verify.sh
```

5. Zgradi in objavi verzijo 1.0.7 prek obstoječega GitHub release updaterja:

```bash
npm run build:win
# oziroma
npm run build:linux
```

Starih Supabase podatkov ne izbriši najmanj 30 dni. Če rollback izvedeš, preden
je na novi bazi nastal nov zapis, ponovno omogoči Supabase in uporabi verzijo
1.0.6. Po novih zapisih na VPS-u rollback zahteva povratno migracijo.

## 6. Tedenski backup z osemtedensko hrambo

Najprej naredi in preveri ročni backup:

```bash
./deploy/scripts/backup.sh
```

Nato namesti systemd timer:

```bash
sudo cp deploy/systemd/zas-sodniki-backup.service /etc/systemd/system/
sudo cp deploy/systemd/zas-sodniki-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now zas-sodniki-backup.timer
sudo systemctl list-timers zas-sodniki-backup.timer
```

Backupi so v `deploy/backups/`, imajo checksum in dovoljenja samo za lastnika.
Datoteke, starejše od 56 dni, se samodejno odstranijo.

## Diagnostika

```bash
sudo docker compose ps
sudo docker compose logs --tail=100 db api
sudo docker network inspect proxy-net
sudo docker network inspect psql-net
sudo docker exec reverse-proxy nginx -t
curl -I https://sodniki-api.jurer.eu/rest/v1/
```

Ne prikazuj vsebine `.env` in API ključa ne pošiljaj po e-pošti ali v issue.
