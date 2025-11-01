# Payment System Refactoring Plan - SIMPLIFIED

## Overview

Dodajanje `znesek_sodnik` in `znesek_racun` v `competition_officials` tabelo.

**`amount` v `payments` tabeli ostane kot je** (predstavlja dolg, brez preimenovanja).

---

## 1. DATABASE CHANGES

### SQL Migracija

```sql
-- Add new columns to competition_officials
ALTER TABLE competition_officials
ADD COLUMN znesek_sodnik DECIMAL(10,2) DEFAULT 0,
ADD COLUMN znesek_racun DECIMAL(10,2) DEFAULT 0;
```

---

## 2. BACKEND FILES TO UPDATE

### 2.1 `electron/supabase.ts`

#### Interfaces to update

- Add new fields to CompetitionOfficial interface: `znesek_sodnik`, `znesek_racun`
- ✅ Payment interface stays the same (uses `amount`)

#### Functions to update

**`listPayments()`, `addPayment()`, `updatePayment()`, `markPaymentAsPaid()`, `getDashboardStats()`**
- ✅ NO CHANGES - all work with `amount` as is

**`generatePaymentsForCompetition()` (line ~753)** - MAJOR CHANGES
- **CURRENT**: Izračunava znesek na podlagi hours, role, kilometers
- **NEW**: Prebere `znesek_sodnik` ali `znesek_racun` iz competition_officials
- Remove calculation logic (lines 784-839)
- Replace with: `amount: (tariffType === 'sodnik' ? official.znesek_sodnik : official.znesek_racun)`

**`getCompetitionReportData()` (line ~919)** - MAJOR CHANGES
- **CURRENT**: Izračunava baseAmount based on role and hours
- **NEW**: Use stored `znesek_sodnik` or `znesek_racun` from competition_officials
- Remove calculation logic (lines 956-997)
- Replace with: `amount: (tariffType === 'sodnik' ? official.znesek_sodnik : official.znesek_racun)`

**`getCompetitionsSummaryData()` (line ~1050)** - MAJOR CHANGES
- **CURRENT**: Calculates amounts
- **NEW**: Use stored values directly
- Replace calculation with: `(tariffType === 'sodnik' ? official.znesek_sodnik : official.znesek_racun)`

---

### 2.2 `electron/handlers/payment.handlers.ts`

✅ **NO CHANGES NEEDED** - all functions work with `amount` field as is

---

### 2.3 `electron/handlers/official.handlers.ts`

**`official:getHistory` handler (line ~135)** - MAJOR CHANGES
- **CURRENT**: Calculates amounts manually from hours, role, kilometers
- **NEW**: Read `znesek_sodnik` or `znesek_racun` from competition_officials
- Remove calculation logic (lines 159-189)
- Replace with: `amount: co.znesek_sodnik` (or znesek_racun based on preference)

---

### 2.4 `electron/handlers/export.handlers.ts`

✅ **MINIMAL CHANGES** - should work as-is if data source functions are fixed
- Data will automatically come from stored `znesek_sodnik`/`znesek_racun` values

---

### 2.5 `electron/handlers/competition.handlers.ts`

**`competition:addOfficial` / `competition:updateOfficial` handlers** - NEW LOGIC NEEDED
- Accept `znesek_sodnik` and `znesek_racun` from frontend
- Save these values to competition_officials table
- Update SQL INSERT/UPDATE statements to include new columns

---

## 3. FRONTEND FILES TO UPDATE

### 3.1 `src/pages/competitions.js` - MAJOR CHANGES

**When adding/editing official on competition:**

Current modal needs to:
1. **Calculate both amounts** (sodnik & račun) when user enters hours/km/role
2. **Display both calculated amounts** with editable input fields
3. **Allow overwrite** - user can manually change calculated values
4. **Save both amounts** to database

New UI in modal:
```html
<div class="mb-2">
  <label>Izračunan znesek (Sodnik tarifa)</label>
  <input type="number" step="0.01" id="calc-znesek-sodnik" class="form-control">
  <small class="form-text">Avtomatsko izračunan, lahko spremeniš</small>
</div>
<div class="mb-2">
  <label>Izračunan znesek (Račun tarifa)</label>
  <input type="number" step="0.01" id="calc-znesek-racun" class="form-control">
  <small class="form-text">Avtomatsko izračunan, lahko spremeniš</small>
</div>
```

**Implementation steps:**
1. Add event listeners to hours/km/role inputs
2. On change → calculate both amounts using current tariff system
3. Pre-fill the two new input fields
4. User can edit if needed
5. On save → send both `znesek_sodnik` and `znesek_racun` to backend

---

### 3.2 `src/pages/payments.js`

✅ **NO CHANGES NEEDED** - uses `amount` field as is

---

### 3.3 `src/pages/dashboard.js`

✅ **NO CHANGES NEEDED** - uses `amount` field as is

---

### 3.4 `src/pages/officials.js`

✅ **MINIMAL CHANGES** - backend will return correct amounts from stored values

---

## 4. TESTING CHECKLIST

### Database
- [ ] Run migration successfully
- [ ] Verify new columns exist in competition_officials
- [ ] ✅ payments table unchanged (amount field stays)

### Backend
- [ ] Compile TypeScript: `npm run tsc`
- [ ] No compilation errors

### Add/Edit Official on Competition
- [ ] Modal shows both calculated amounts
- [ ] Can overwrite calculated amounts
- [ ] Both amounts saved to database
- [ ] Values persist on page reload

### Generate Payments
- [ ] Payments created with correct amount based on tariff selection
- [ ] Tariff selection (sodnik/račun) works correctly

### Payments, Dashboard, Officials Pages
- [ ] ✅ All work as before (no changes needed)

### Exports
- [ ] Single competition export works with correct amounts
- [ ] Summary export works with correct amounts
- [ ] Both tariff types export correctly

---

## 5. ROLLBACK PLAN

```sql
-- Rollback migration
ALTER TABLE competition_officials
DROP COLUMN znesek_sodnik,
DROP COLUMN znesek_racun;
```

---

## SUMMARY

### Files to change: 5 (down from 9!)

**Backend:**
1. `electron/supabase.ts` - 3 major functions
2. `electron/handlers/official.handlers.ts` - getHistory simplification
3. `electron/handlers/competition.handlers.ts` - save new fields

**Frontend:**
1. `src/pages/competitions.js` - add modal UI for both amounts

**Database:**
1. SQL migration - add 2 columns only

### Files with NO changes needed: 4
- `electron/handlers/payment.handlers.ts`
- `electron/handlers/export.handlers.ts` (auto-fixed by data changes)
- `src/pages/payments.js`
- `src/pages/dashboard.js`

---

## NOTES

- ⚠️ After migration, existing records will have `znesek_sodnik = 0` and `znesek_racun = 0`
- May need to run data fix script OR manually re-assign officials to competitions
- **BENEFIT**: ~70% less refactoring work by keeping `amount` as is!
