# 🚀 Navodila za dodajanje potnih stroškov in discipline

## ⚠️ POMEMBNO - Pred zagonom aplikacije!

Aplikacija potrebuje posodobitev strukture baze podatkov. Brez tega **NE BO DELOVALA PRAVILNO**.

---

## 📦 Korak 1: Posodobi Supabase bazo

### Možnost A: Preko Supabase Dashboard

1. Odpri [Supabase Dashboard](https://supabase.com)
2. Izberi svoj projekt
3. Klikni na "SQL Editor" v meniju
4. Kopiraj vsebino datoteke `migration_add_kilometers_discipline.sql`
5. Zalepi v SQL Editor
6. Klikni "Run" / "Zaženi"

### Možnost B: Preko Supabase CLI (če ga uporabljate)

```bash
supabase db push
```

---

## ✅ Korak 2: Preveri uspešnost migracije

V SQL Editor zaženi:

```sql
SELECT * FROM pragma_table_info('competition_officials');
```

Preverite, da vidite stolpce:

- ✅ `kilometers` (REAL)
- ✅ `discipline` (TEXT)

---

## 🛠️ Korak 3: Zgradi aplikacijo

```bash
npm install
npm run build
```

---

## 🎯 Kaj je novo?

### 1️⃣ Potni stroški

- Pri dodeljevanju sodnika lahko vnesete kilometre
- Avtomatski izračun: **€0.37/km**
- Prikazano v tabeli in izplačilih

### 2️⃣ Disciplina

- Dropdown meni z izbirov discipline:
  - Tek, Met, Skok, Hoja, Kombinacija, Splošno
- Sledenje na kateri disciplini je sodnik delal

---

## 📚 Dodatna dokumentacija

Za podrobnosti glej: **`CHANGELOG_potni_stroski.md`**

---

## 🆘 V primeru težav

1. Preveri da je Supabase baza posodobljena
2. Preveri da so novi stolpci dodani (`kilometers`, `discipline`)
3. Rebuild aplikacijo z `npm run build`
4. Preveri console za morebitne napake

---

**Vprašanja?** Kontaktiraj razvijalca! 👨‍💻
