# ZAS Sodniki - Specifikacija Aplikacije

## Pregled

Desktop aplikacija za upravljanje plačil atletskih sodnikov. SQLite baza podatkov, multi-user sistem z RBAC (role-based access control).

---

## 1. AVTENTIKACIJA IN UPORABNIKI

### Login sistem

- ✅ Login stran (username + password)
- ✅ Session management (localStorage)
- ✅ Logout funkcionalnost
- ✅ Avtomatičen logout ob zaprtju aplikacije (security)

### Uporabniške vloge

- **Admin**: Polni dostop (CRUD vse)
- **User**: Read-only dostop (brez urejanja)

### Privzeti uporabnik

- Username: `admin`
- Password: `admin123`

---

## 2. PODATKOVNI MODEL

### Tabela: users

```sql
- id (INTEGER PRIMARY KEY)
- username (TEXT UNIQUE)
- password (TEXT) -- hashed
- name (TEXT)
- role (TEXT) -- 'admin' ali 'user'
- created_at (DATETIME)
```

### Tabela: officials (Sodniki)

```sql
- id (INTEGER PRIMARY KEY)
- name (TEXT)
- email (TEXT)
- phone (TEXT)
- license_number (TEXT)
- active (BOOLEAN)
- created_at (DATETIME)
```

### Tabela: competitions (Tekmovanja)

```sql
- id (INTEGER PRIMARY KEY)
- name (TEXT)
- date (DATE)
- location (TEXT)
- type (TEXT) -- 'indoor', 'outdoor', 'cross_country'
- status (TEXT) -- 'planned', 'completed', 'cancelled'
- notes (TEXT)
- created_at (DATETIME)
```

### Tabela: competition_officials (Povezava)

```sql
- id (INTEGER PRIMARY KEY)
- competition_id (INTEGER FK)
- official_id (INTEGER FK)
- role (TEXT) -- dinamične vloge iz settings
- hours (REAL) -- opravljene ure
- notes (TEXT)
```

### Tabela: payments (Izplačila)

```sql
- id (INTEGER PRIMARY KEY)
- official_id (INTEGER FK)
- competition_id (INTEGER FK)
- amount (REAL)
- date (DATE)
- method (TEXT) -- 'cash', 'bank_transfer', 'check', 'other'
- status (TEXT) -- 'owed', 'paid'
- notes (TEXT)
- created_at (DATETIME)
```

### Tabela: settings (Nastavitve)

```sql
- key (TEXT PRIMARY KEY)
- value (TEXT) -- JSON format za official_roles
```

---

## 3. FUNKCIONALNOSTI PO STRANEH

### 📊 Dashboard (Nadzorna plošča)

- **Read-only za vse**
- Statistike:
  - Skupno število sodnikov
  - Število aktivnih tekmovanj
  - Skupna vrednost izplačil
  - Status plačil (dolguje vs. plačano)s
- Pregled zadnjih aktivnosti
- Grafi/vizualizacije (opcijsko)

### 👤 Officials (Sodniki)

**Admin funkcije:**

- ✅ Dodaj novega sodnika (ime, email, telefon, licenca)
- ✅ Uredi podatke sodnika
- ✅ Izbriši sodnika
- ✅ Označi kot aktiven/neaktiven

**User funkcije:**

- ✅ Pregled seznama sodnikov (read-only)

**Tabela prikaz:**

- Ime, Email, Telefon, Licenčna številka, Status (aktiven/neaktiven)

### 🏆 Competitions (Tekmovanja)

**Admin funkcije:**

- ✅ Dodaj novo tekmovanje (ime, datum, lokacija, tip)
- ✅ Uredi tekmovanje
- ✅ Izbriši tekmovanje
- ✅ Dodeli sodnike tekmovanju
- ✅ Vnesi opravljene ure za vsakega sodnika
- ✅ Vnesi vlogo sodnika na tekmovanju (dinamično iz settings)
- ✅ Spremeni status (načrtovano/zaključeno/preklicano)

**User funkcije:**

- ✅ Pregled seznama tekmovanj (read-only)

**Tabela prikaz:**

- Ime, Datum, Lokacija, Tip, Status, Število sodnikov

**Detail view (klik na tekmovanje):**

- Seznam dodeljenih sodnikov
- Vloga vsakega sodnika
- Opravljene ure
- Status

### 💰 Payments (Izplačila)

**Admin funkcije:**

- ✅ Dodaj novo izplačilo
- ✅ **Avtomatičen izračun zneska** glede na:
  - Tekmovanje
  - Sodnik
  - Vloga sodnika (urna postavka iz settings)
  - Opravljene ure
- ✅ Ročno urejanje zneska (override)
- ✅ Uredi izplačilo
- ✅ Izbriši izplačilo
- ✅ Označi kot plačano
- ✅ **Filtri:**
  - Po sodniku (dropdown)
  - Po tekmovanju (dropdown)
  - Po statusu (dolguje/plačano)
  - Po datumu (od-do)
  - Števec rezultatov ("Prikazujem X od Y")
  - Gumb "Počisti filtre"

**User funkcije:**

- ✅ Pregled seznama izplačil (read-only)
- ✅ Uporaba filtrov

**Tabela prikaz:**

- Sodnik, Tekmovanje, Znesek (€), Način plačila, Status, Datum

**Način plačila:**

- Gotovina, Bančno nakazilo, Ček, Drugo

### ⚙️ Settings (Nastavitve) - **SAMO ADMIN**

**Upravljanje vlog sodnikov:**

- ✅ Pregled vseh vlog
- ✅ Dodaj novo vlogo (ime + urna postavka €)
- ✅ Uredi vlogo (ime in urna postavka)
- ✅ Izbriši vlogo
- ✅ Real-time shranjevanje v JSON format v settings tabeli

**Primer vlog:**

```json
[
  { "id": 1, "name": "Glavni sodnik", "hourlyRate": 25.00 },
  { "id": 2, "name": "Pomožni sodnik", "hourlyRate": 18.00 },
  { "id": 3, "name": "Časomerilec", "hourlyRate": 15.00 }
]
```

### 👥 Users (Upravljanje uporabnikov) - **SAMO ADMIN**

- ✅ Pregled vseh uporabnikov
- ✅ Dodaj novega uporabnika (username, password, ime, vloga)
- ✅ Uredi uporabnika (ime, vloga, password)
- ✅ Izbriši uporabnika
- ✅ Oznake vloge (badge): Admin (modra), User (siva)

---

## 4. UI/UX ZAHTEVE

### Styling

- Bootstrap 5 za konsistenten izgled
- Tailwind CSS (trenutno) ALI Bootstrap (za rewrite)
- Responsive layout (deluje na različnih velikostih oken)
- Sidebar navigacija z ikonami:
  - 📊 Dashboard
  - 👤 Sodniki
  - 🏆 Tekmovanja (flag ikona)
  - 💰 Izplačila
  - ⚙️ Nastavitve (samo admin)
  - 👥 Uporabniki (samo admin)

### Barve in ikone

- Primary: Modra (#3B82F6)
- Success: Zelena (#10B981)
- Danger: Rdeča (#EF4444)
- Warning: Rumena (#F59E0B)
- Ikone: Lucide React (trenutno) ALI Bootstrap Icons / Font Awesome (rewrite)

### Interakcije

- Potrditve pred brisanjem ("Ali ste prepričani?")
- Loading stanja med API calls
- Toast notifications za success/error (opcijsko)
- Modal dialogs za forms (opcijsko)

---

## 5. TEHNIČNE ZAHTEVE

### Trenutni Stack (React + TypeScript)

```text
Frontend:
- React 18.2.0
- TypeScript 5.3.3
- Tailwind CSS
- Vite 5.0.10

Backend (Electron):
- Electron 28.1.0
- Better-SQLite3 11.0.0
- IPC komunikacija (contextBridge)

Build:
- electron-builder 24.9.1
- Wine (za Windows cross-compilation)
```

### Predlagan Stack za Rewrite (Vanilla TS)

```text
Frontend:
- HTML5
- TypeScript (vanilla, no framework)
- Bootstrap 5 CSS
- Bootstrap Icons

Backend (Electron):
- Electron 28.1.0 (ostane isto)
- Better-SQLite3 11.0.0 (ostane isto)
- IPC komunikacija (ostane isto)

Build:
- TypeScript compiler (tsc)
- electron-builder (brez Vite!)
```

### Datotečna struktura (Rewrite)

```text
project/
├── electron/
│   ├── main.ts              # Electron main process
│   ├── preload.ts           # IPC bridge
│   ├── database.ts          # SQLite manager
│   ├── handlers/            # IPC handlers (ostane isto)
│   └── config/
│       └── roles.ts
├── src/
│   ├── index.html           # Main HTML
│   ├── pages/
│   │   ├── login.ts         # Login page logic
│   │   ├── dashboard.ts     # Dashboard logic
│   │   ├── officials.ts     # Officials CRUD
│   │   ├── competitions.ts  # Competitions CRUD
│   │   ├── payments.ts      # Payments + filters
│   │   ├── settings.ts      # Settings (admin only)
│   │   └── users.ts         # User management
│   ├── components/
│   │   ├── sidebar.ts       # Navigation
│   │   └── auth.ts          # Auth logic
│   ├── utils/
│   │   └── helpers.ts       # Helper functions
│   └── styles/
│       └── main.css         # Custom CSS
├── package.json
├── tsconfig.json
└── electron-builder.json
```

---

## 6. RAZLIKE MED TRENUTNO IN NOVO VERZIJO

| Aspekt | Trenutno (React) | Novo (Vanilla TS) |
|--------|------------------|-------------------|
| **Framework** | React + Vite | Vanilla TypeScript |
| **CSS** | Tailwind | Bootstrap 5 |
| **Bundle Size** | ~220KB + React (~100MB installer) | ~50KB (~20MB installer) |
| **Build Čas** | ~1-2 min | ~10-20 sec |
| **Kompleksnost** | Visoka | Nizka |
| **Packaging Issues** | ES modules, CORS, custom protocols | Brez problemov |
| **Hot Reload** | Da (Vite HMR) | Ne (ročno refresh) |
| **Type Safety** | Da | Da |
| **Learning Curve** | Višja (React concepts) | Nižja (vanilla DOM) |
| **Maintainability** | Težja (dependencies) | Lažja (manj dependencies) |

---

## 7. OHRANITI MORA

### Funkcionalnosti

✅ Vse CRUD operacije (Create, Read, Update, Delete)
✅ Authentication & Authorization (Admin vs User)
✅ RBAC (Role-Based Access Control)
✅ Dinamične vloge sodnikov iz nastavitev
✅ Avtomatičen izračun plačil
✅ Filtri na strani Izplačila
✅ localStorage security (clear on close)
✅ SQLite database z vsemi tabelami
✅ IPC komunikacija med main/renderer
✅ Cross-platform build (Linux, Windows)

### Uporabniška izkušnja

✅ Sidebar navigacija
✅ Konzistenten dizajn
✅ Potrditve pred brisanjem
✅ Read-only za non-admin
✅ Iste ikone in barve

---

## 8. POTREBNO ZA NOVO VERZIJO

### Novi dependencies

```json
{
  "dependencies": {
    "electron": "^28.1.0",
    "better-sqlite3": "^11.0.0"
  },
  "devDependencies": {
    "typescript": "^5.3.3",
    "electron-builder": "^24.9.1",
    "@types/better-sqlite3": "^7.6.8",
    "@types/node": "^20.10.6"
  }
}
```

### Odstraniti

- ❌ React, React-DOM
- ❌ Vite, vite-plugin-electron
- ❌ Tailwind CSS
- ❌ @types/react
- ❌ PostCSS

### Dodati

- ✅ Bootstrap 5 CSS (CDN ali lokalno)
- ✅ Bootstrap Icons (CDN ali lokalno)
- ✅ Vanilla TS DOM manipulation utilities

### Delo potrebno

1. **Setup** (~30 min)
   - Ustvari novo strukturo
   - Nastavi tsconfig.json
   - Odstrani Vite/React dependencies

2. **HTML/CSS** (~1h)
   - index.html z Bootstrap
   - Sidebar layout
   - Forms in tables

3. **TypeScript Logic** (~3-4h)
   - Prepiši vsako stran (Login, Dashboard, Officials, Competitions, Payments, Settings, Users)
   - DOM manipulation
   - Event handlers
   - API calls (ostanejo isti)

4. **Testing** (~1h)
   - Test vse funkcionalnosti
   - Test RBAC
   - Test filtri

5. **Build & Package** (~30 min)
   - Nastavi build proces
   - Test .deb/.AppImage packaging
   - Test Windows .exe

### SKUPAJ: ~6-7 ur dela

---

## 9. KORISTI REWRITA

### Za Development

✅ Hitrejši build (20s vs 2min)
✅ Lažje debugging (no minified code)
✅ Manj dependencies (easier maintenance)
✅ No complex build pipeline

### Za Production

✅ Manjši installer (~20MB vs ~100MB)
✅ Hitrejši startup
✅ Brez packaging issues (white screen, CORS, etc.)
✅ file:// protocol deluje out-of-box

### Za Uporabnika

✅ Vse funkcionalnosti ostanejo enake
✅ Hitrejša aplikacija
✅ Manjši download

---

## 10. MIGRATION PLAN

### Faza 1: Priprava

- [ ] Backup trenutnega koda
- [ ] Ustvari novo branch `vanilla-ts-rewrite`
- [ ] Setup nova struktura map

### Faza 2: Backend (Ostane Isto)

- [ ] Kopiraj `electron/` folder (brez sprememb)
- [ ] Kopiraj `types/` (brez sprememb)

### Faza 3: Frontend Rewrite

- [ ] HTML struktura + Bootstrap
- [ ] Login page
- [ ] Dashboard page
- [ ] Officials page
- [ ] Competitions page
- [ ] Payments page (z filtri!)
- [ ] Settings page
- [ ] Users page
- [ ] Sidebar component

### Faza 4: Testing

- [ ] Test vse CRUD operacije
- [ ] Test authentication
- [ ] Test RBAC (admin vs user)
- [ ] Test filtri
- [ ] Test payment calculation

### Faza 5: Build

- [ ] Setup build script
- [ ] Test Linux build (.deb, .AppImage)
- [ ] Test Windows build (.exe)

### Faza 6: Deployment

- [ ] Documentation update
- [ ] Release notes
- [ ] Distribute to users

---

## ZAKLJUČEK

Rewrite na vanilla TypeScript + Bootstrap bi rešil **VSE trenutne packaging probleme** in ohranil **VSE funkcionalnosti**.

**Priporočam: GO FOR IT!** 🚀

