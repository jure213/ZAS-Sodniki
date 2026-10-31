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
sudo docker network inspect proxy-net >/dev/null || sudo docker network create proxy-net
sudo docker network inspect psql-net >/dev/null || sudo docker network create psql-net
sudo docker compose config --quiet
sudo docker compose pull
sudo docker compose up -d
sudo docker compose ps
```

`.env` vsebuje skrivnosti strežnika in se ne commita. Aplikacija od verzije
1.1.0 ne vsebuje nobenega ključa: uporabniki se prijavijo prek `login()` v bazi
(glej razdelek 7). JWT skrivnost rotiraš z `./deploy/scripts/rotate-jwt-secret.sh`.

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

## 7. Database migrations and the v1.1.0 auth cutover

### How it works now

- Schema changes live in `deploy/sql/NNN_*.sql` and are applied by
  `./deploy/scripts/migrate.sh`, each in one transaction. Applied versions are
  recorded in `private.schema_migrations`. `--status` lists them.
- `migrate.sh` also always runs `deploy/sql/roles.sql` (API roles) and
  `deploy/sql/grant-api.sql` (all API privileges), and copies
  `PGRST_JWT_SECRET` from `.env` into `private.config` so the database can sign
  login tokens. `restore-dump.sh` calls `migrate.sh` automatically.
- Backups exclude the contents of `private.config`, so they don't contain the
  JWT secret.
- API roles:

  | Role | Who | Can |
  |---|---|---|
  | `zas_anon` | no token | only `rpc/login` |
  | `zas_user` | app role `user` | read everything except `users` |
  | `zas_admin` | app role `admin` | read/write data; users only via `create_user` / `update_user` / `delete_user` |

- Tokens last 12 h (30 days with "Ostani prijavljen"). Deleting a user or
  changing their password or role immediately invalidates their tokens
  (`private.check_request`, run by PostgREST before every request).

### One-time cutover from v1.0.8 (shared key) to v1.1.0

Do this in the evening when nobody is entering data. All 1.0.8 installs stop
working at step 3 and get the 1.1.0 update on their next start.

1. **Prepare the release:** on your PC, `npm install`, then `npm run build:win`.
   Create GitHub release `v1.1.0` as a **draft** with the `.exe`, `.blockmap`
   and `latest.yml`. Don't publish it yet.
2. **Backup:** on the VPS:
   ```bash
   cd /home/jurer/projects/ZAS-Sodniki
   ./deploy/scripts/backup.sh
   git pull
   ```
3. **Migrate, rotate the secret, restart PostgREST:**
   ```bash
   ./deploy/scripts/migrate.sh
   ./deploy/scripts/rotate-jwt-secret.sh   # also recreates the api container with the new config
   ```
4. **nginx** (adds the login rate limit):
   ```bash
   sudo cp deploy/nginx/sodniki-api.https.conf \
     /home/jurer/projects/vps-reverse-proxy/conf.d/sodniki-api.https.conf
   sudo docker exec reverse-proxy nginx -t
   sudo docker exec reverse-proxy nginx -s reload
   ```
5. **Verify:**
   ```bash
   ./deploy/scripts/verify.sh
   ```
   It checks that anonymous reads get `401`, that the old `ZAS_API_KEY` from
   `.env` is rejected, and that `rpc/login` answers.
6. **Publish** the GitHub release, then install 1.1.0 and log in once as an
   admin and once as a normal user.
7. **Clean up:** delete the `ZAS_API_KEY=` line and `.env.bak` from the VPS. On
   development machines `.env` no longer needs any server secrets: the app
   defaults to `https://sodniki-api.jurer.eu`, and `ZAS_API_URL` overrides it.

If `migrate.sh` fails, nothing has changed (single transaction) and 1.0.8 keeps
working. Rolling back after a successful migration means restoring the
insecure setup. Avoid it; if you must, recreate the old role
(`CREATE ROLE zas_sodniki_api NOLOGIN BYPASSRLS; GRANT zas_sodniki_api TO postgrest_authenticator;`),
check out the previous `docker-compose.yml` and `deploy/sql/grant-api.sql`,
run that `grant-api.sql`, restore `.env.bak`, and run `docker compose up -d api`.

## 8. v2.0.0 cutover: migration 002, release, rollback

Migration `deploy/sql/002_data_model.sql` changes money storage: payments get
installments (`payment_transactions`), assignments carry their own tariff
snapshot, roles and disciplines become tables, settings move to
`private.settings_legacy`. It drops the columns v1.1.x clients write to, so
**1.1.x clients stop working on purpose** from the moment it is applied until
they have updated. Apply it together with the v2.0.0 release, never separately,
and do it in the evening when nobody is entering data.

The migration runs in one transaction. A failed preflight check or assertion
rolls everything back and prints what to fix; it never edits your data to make a
check pass. Known preflight stops: duplicate assignments (same official twice in
one competition), several payments for one official in one competition,
unreadable dates, unknown statuses or payment methods, unreadable installment
lines in remarks, malformed role JSON. A failed run leaves 1.1.x working.

Conventions used below:

- **PC** = your Windows machine, commands run in **Git Bash** from the
  repository root (`C:\Users\admin\Documents\CODING\Projects\ZAS-Sodniki`).
- **VPS** = `~/projects/zas-sodniki` (lowercase). If `docker` needs sudo there,
  the deploy scripts add it themselves; for the plain `docker compose` lines
  below use `sudo docker compose`.
- The last v1 commit is `13d35c6` (v1.1.2, `main` before the merge). It is
  never tagged `v1.1.2` in git, so the rollback uses the commit id.
- Backups and reports contain real names and money: they stay in
  `deploy/backups/` and `deploy/dumps/` (both gitignored) or in `~`, never in git.

### 8.1 One-time: the rehearsal stack on your PC

`deploy/rehearsal/` is a throwaway copy of the production stack (Postgres,
PostgREST, nginx with the `/rest/v1` prefix) that listens on 127.0.0.1 only and
has its own random secrets.

```bash
source deploy/rehearsal/env.sh        # creates deploy/rehearsal/.env on first use
docker compose up -d
```

Always `source deploy/rehearsal/env.sh` in each new Git Bash window before any
rehearsal command. It points `docker compose` and the deploy scripts at the
rehearsal stack and its secrets. Without it, compose would read the repo's own
`.env` and mix two sets of secrets (the JWT secrets then differ and every
token is rejected). To start over with an empty database: `docker compose down -v`
and `docker compose up -d`. To remove the stack: `docker compose down -v`.

### 8.2 Cutover night

Variables used in several steps (set them once per window):

```bash
VPS=jurer@<your-vps-host>             # the only thing to fill in
VPSDIR='~/projects/zas-sodniki'
```

**Step 1. Fresh backup on the VPS, copy it to your PC** (this file is also the
rollback point; write its name down)

```bash
BACKUP=$(ssh "$VPS" "cd $VPSDIR && ./deploy/scripts/backup.sh >/dev/null && ls -t deploy/backups/zas-sodniki-*.dump | head -1 | xargs basename")
echo "$BACKUP"
mkdir -p deploy/dumps
scp "$VPS:projects/zas-sodniki/deploy/backups/$BACKUP" deploy/dumps/
# the two hashes must be identical
ssh "$VPS" "sha256sum $VPSDIR/deploy/backups/$BACKUP" | cut -d' ' -f1
sha256sum "deploy/dumps/$BACKUP" | cut -d' ' -f1
```

**Step 2. Rehearse 002 on exactly that backup** (nothing here touches the VPS)

```bash
source deploy/rehearsal/env.sh
docker compose down -v && docker compose up -d       # empty database
sleep 15                                              # wait for the healthcheck
./deploy/scripts/restore-dump.sh "deploy/dumps/$BACKUP"   # restores, then applies 002 + grants
./deploy/scripts/migrate.sh --status                  # 001_auth and 002_data_model: applied
./deploy/sql/tests/run.sh                             # expect: 6/6 test files passed.
ZAS_API_URL=http://127.0.0.1:${REHEARSAL_API_PORT:-8081} ZAS_API_PREFIX="" ./deploy/scripts/verify.sh
                                                      # expect: Database and public API checks passed.
docker compose exec -T db psql --no-psqlrc -U zas_sodniki_admin -d zas_sodniki \
  < deploy/sql/reports/002_report.sql > ~/002_report_rehearsal.txt
```

If `restore-dump.sh` stops with a preflight message, nothing was changed:
fix the data (or ask) before cutover night, and take a fresh backup again.

Read `~/002_report_rehearsal.txt`. The cutover goes ahead only if:

- section 1 lists only flags you have already looked at (each is a decision the
  migration took; ids and names are listed in the later sections);
- section 9 (dashboard, v1 vs v2) says `as expected` for every year;
- section 10 says `differing_rows` = 0 and `total_v1` = `total_v2`;
- section 11 has `t` on every line.

Write down the 2025/current-year `paid` and `owed` numbers of section 9 and the
owed total of section 10: step 7 compares the real app against them. Also take
a screenshot of the 1.1.2 dashboard on your PC before the VPS is migrated.

Optional: also rehearse the rollback now (section 8.3) on this same stack.

**Step 3. Merge `v2-rewrite` into `main` and push**

`main` is still `13d35c6`, so this is a fast-forward and must stay one.

```bash
git status --short                      # clean (REVIEW.md and parity/ are untracked and stay that way)
git fetch origin
git checkout main
git merge --ff-only v2-rewrite
git push origin main
git log --oneline -1                    # note this commit: the release is built from it
```

**Step 4. Build v2.0.0 as a DRAFT GitHub release**

The release build must talk to production. A leftover `ZAS_API_URL` in `.env`
(for example `http://localhost:8082` from testing) would be baked into the app,
so it is overridden explicitly and checked after the build.

```bash
npm ci || npm install                   # use the same Node as for 1.1.x
npm run typecheck && npm test
ZAS_API_URL=https://sodniki-api.jurer.eu npm run build
npx electron-builder --win --publish never
npm run check:release                 # must print: API URL in this package: https://sodniki-api.jurer.eu
ls release/ZAS.Sodniki.Setup.2.0.0.exe release/ZAS.Sodniki.Setup.2.0.0.exe.blockmap release/latest.yml
```

Create the draft (nobody gets it while it is a draft) and upload the three files.
With the GitHub CLI:

```bash
gh release create v2.0.0 --draft --target main --title "ZAS Sodniki 2.0.0" \
  --notes "Nova različica: izplačila z obroki, nov uporabniški vmesnik." \
  release/ZAS.Sodniki.Setup.2.0.0.exe release/ZAS.Sodniki.Setup.2.0.0.exe.blockmap release/latest.yml
```

(or in the GitHub web UI: Releases, Draft a new release, tag `v2.0.0`, target
`main`, attach the same three files, **Save draft**). Do not install the
installer on the PC that holds your real 1.1.2 yet.

**Step 5. VPS: pull, migrate, verify, report** (this is the point of no return
for 1.1.x clients)

```bash
ssh "$VPS"
cd ~/projects/zas-sodniki
git status --short                      # clean
git pull --ff-only                      # fast-forwards to the commit from step 3
./deploy/scripts/migrate.sh --status    # 002_data_model: pending
./deploy/scripts/migrate.sh             # ends with: Database is up to date (1 migration(s) applied).
./deploy/scripts/verify.sh              # ends with: Database and public API checks passed.
sudo docker compose exec -T db psql --no-psqlrc -U zas_sodniki_admin -d zas_sodniki \
  < deploy/sql/reports/002_report.sql > ~/002_report_vps.txt   # drop sudo if not needed
exit
```

Then copy the report down and check it is the same as the rehearsal
(`scp "$VPS:002_report_vps.txt" ~/` and compare sections 9, 10, 11). Do not run
`deploy/sql/tests/run.sh` on the VPS. Do not restart anything: `migrate.sh`
already tells PostgREST to reload its schema. If `migrate.sh` fails, nothing
changed and 1.1.x keeps working: stop here and read the message.

If anything in verify or the report looks wrong, go to 8.3 now, before publishing.

**Step 6. Publish the release**

```bash
gh release edit v2.0.0 --draft=false --latest
```

(web UI: open the draft, **Publish release**). From now on installed 1.1.x apps
find the update when they start (the check runs 3 seconds after launch), and the
Download button then installs 2.0.0.

**Step 7. Compare with the numbers from before**

Install 2.0.0 on your PC (or let 1.1.2 update itself), log in as an admin and
as a normal user:

- Dashboard: paid for the year and owed total equal the section 9 numbers of the
  report from step 2 (`paid_v2`, `owed_v2`).
- Payments page, status "Odprta": the remaining total in the footer equals the
  owed total of section 10, and the number of officials with a balance equals
  `officials_compared`.
- Open one competition you know, check its D1 export.
- Admin sees Nastavitve and Uporabniki, the normal user does not.

If the numbers differ, roll back (8.3) rather than patching live data.

### 8.3 Roll back

What is lost: everything entered in v2 after step 5. Decide early; every hour
makes it more expensive.

**A. Before the release is published** (no client has 2.0.0)

On the VPS, `<backup>` is the file from step 1:

```bash
cd ~/projects/zas-sodniki
B=<backup>                               # the name from step 1, for example zas-sodniki-20261031T113747Z.dump
mkdir -p deploy/dumps && cp "deploy/backups/$B" deploy/dumps/   # restore-dump.sh reads from deploy/dumps
# 1. Still on the v2 checkout: only its restore-dump.sh has --no-migrate and can drop the v2 tables
./deploy/scripts/restore-dump.sh --replace --no-migrate "deploy/dumps/$B"   # asks you to type: REPLACE zas_sodniki
# 2. Now the v1 code: its migrate.sh restores the v1 roles, grants and the JWT secret
git checkout 13d35c6                     # detached HEAD is fine; do not run git pull on the VPS now
./deploy/scripts/migrate.sh              # 0 migrations applied
./deploy/scripts/verify.sh               # Database and public API checks passed.
```

Then log in with a 1.1.2 app and check the dashboard. Delete the draft release
(`gh release delete v2.0.0 --cleanup-tag=false`, or in the web UI) so nobody
publishes it by accident. To try again later: `git checkout main && git pull`,
then start at step 1 of 8.2 with a fresh backup.

Order matters. `restore-dump.sh --replace` of v1.1.2 only drops `private`, so
`pg_restore --clean` would fail on the v2 tables and views. `--no-migrate`
stops the v2 `migrate.sh` from applying 002 again on top of the restored
backup. The v2 `grant-api.sql` refers to tables the old schema does not have,
which is why the v1 `migrate.sh` is the one that runs last.

**B. After the release was published and some clients installed 2.0.0**

Those clients cannot work against the restored v1 database, and they will not
downgrade by themselves. Restore the database (A), then publish the 1.1.2 code
as a higher version so the auto-updater moves them back:

```bash
git checkout -b rollback-2.0.1 13d35c6
npm version 2.0.1 --no-git-tag-version
# in .env remove any ZAS_API_URL line (or it is baked into the build), then:
npm install && npm run build:win         # v1 build script; output in release/
git add package.json && git commit -m "Rollback build 2.0.1 (v1.1.2 code)"
git push origin rollback-2.0.1
gh release create v2.0.1 --target rollback-2.0.1 --title "ZAS Sodniki 2.0.1" \
  --notes "Vrnitev na prejšnjo delovanje." \
  release/ZAS.Sodniki.Setup.2.0.1.exe release/ZAS.Sodniki.Setup.2.0.1.exe.blockmap release/latest.yml
```

Also delete or mark the 2.0.0 release as pre-release so it is no longer "latest".
Clients on 2.0.0 get 2.0.1 on their next start (2.0.1 > 2.0.0).

**Rehearse the rollback (once, on the rehearsal stack, before cutover night)**

After step 2 of 8.2, in the same Git Bash window:

```bash
git worktree add ../zas-v1 13d35c6      # a checkout of the v1 code next to the repo
echo "REPLACE zas_sodniki" | ./deploy/scripts/restore-dump.sh --replace --no-migrate "deploy/dumps/$BACKUP"
../zas-v1/deploy/scripts/migrate.sh      # v1 migrate.sh against the rehearsal stack (same exports)
docker compose exec -T db psql -U zas_sodniki_admin -d zas_sodniki -Atc \
  "SELECT to_regclass('public.payment_transactions') IS NULL AS back_on_v1_schema"   # t
./deploy/scripts/migrate.sh              # and forward again: applies 002 a second time
git worktree remove ../zas-v1
```

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
