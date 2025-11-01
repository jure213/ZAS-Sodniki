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

**`listPayments()` (line ~262)**
- ✅ No changes needed

**`addPayment()` (line ~318)**
- ✅ No changes needed

**`updatePayment()` (line ~349)**
- ✅ No changes needed

**`markPaymentAsPaid()` (line ~390)**
- ✅ No changes needed (uses `amount` as is)

**`getDashboardStats()` (line ~537)**
- ✅ No changes needed (uses `amount` as is)

**`generatePaymentsForCompetition()` (line ~753)** - MAJOR CHANGES

- **CURRENT**: Izračunava znesek na podlagi hours, role, kilometers
- **NEW**: Prebere `znesek_sodnik` ali `znesek_racun` iz competition_officials (odvisno od tariff parametra)
- Remove calculation logic (lines 784-839)
- Replace with: read `znesek_sodnik` or `znesek_racun` from `official` object
- Line 870: `amount: amount` → `amount: (tariffType === 'sodnik' ? official.znesek_sodnik : official.znesek_racun)`

**`getCompetitionReportData()` (line ~919)** - MAJOR CHANGES

- **CURRENT**: Izračunava baseAmount based on role and hours
- **NEW**: Use stored `znesek_sodnik` or `znesek_racun` from competition_officials
- Line 956-997: Remove calculation logic
- Should read: `amount: official.znesek_sodnik` or `amount: official.znesek_racun` (based on tariffType parameter)

**`getCompetitionsSummaryData()` (line ~1050)** - MAJOR CHANGES

- Line 1067-1096: Remove calculation logic
- Should use: `official.znesek_sodnik` or `official.znesek_racun` directly
- Line 1100: `officialsTotal += baseAmount` → `officialsTotal += (tariffType === 'sodnik' ? official.znesek_sodnik : official.znesek_racun)`

---

### 2.2 `electron/handlers/payment.handlers.ts`

✅ **NO CHANGES NEEDED** - all functions work with `amount` field as is

---

### 2.3 `electron/handlers/official.handlers.ts`

**`official:getHistory` handler (line ~135)** - MAJOR CHANGES

- **CURRENT**: Calculates amounts manually from hours, role, kilometers
- **NEW**: Should read `znesek_sodnik` or `znesek_racun` from competition_officials
- Lines 159-189: Remove calculation logic
- Replace with:

```typescript
const totalAmount = co.znesek_sodnik; // or znesek_racun based on preference
```

- Simplify to just read the stored values

---

### 2.4 `electron/handlers/export.handlers.ts`

**`competition:exportToExcel` handler (line ~20)**

- ✅ Should work as-is if getCompetitionReportData is fixed
- Data will come from stored `znesek_sodnik`/`znesek_racun` values

**`competition:exportSummary` handler (line ~110)**

- ✅ Should work as-is if getCompetitionsSummaryData is fixed

---

### 2.5 `electron/handlers/competition.handlers.ts`

**`competition:addOfficial` / `competition:updateOfficial` handlers** - NEW LOGIC NEEDED

- Need to accept `znesek_sodnik` and `znesek_racun` from frontend
- Save these values to competition_officials table
- Update SQL INSERT/UPDATE statements to include new columns

---

## 3. FRONTEND FILES TO UPDATE

### 3.1 `src/pages/competitions.js` - MAJOR CHANGES

**When adding/editing official on competition:**

Current modal needs:

1. **Calculate both amounts** (sodnik & račun) when user enters hours/km/role
2. **Display both calculated amounts** with editable input fields
3. **Allow overwrite** - user can manually change calculated values
4. **Save both amounts** to database

New UI in modal:

```html
<div class="mb-2">
  <label>Izračunan znesek (Sodnik tarifa)</label>
  <input type="number" id="calc-znesek-sodnik" value="...">
  <small>Avtomatsko izračunan, lahko spremeniš</small>
</div>
<div class="mb-2">
  <label>Izračunan znesek (Račun tarifa)</label>
  <input type="number" id="calc-znesek-racun" value="...">
  <small>Avtomatsko izračunan, lahko spremeniš</small>
</div>
```

**Implementation steps:**

1. Add event listeners to hours/km/role inputs
2. On change → calculate both amounts using current tariff system
3. Pre-fill the two new input fields
4. User can edit if needed
5. On save → send both znesek_sodnik and znesek_racun to backend

**Functions to add/modify:**

- `calculateAmounts(hours, role, kilometers)` → returns {znesek_sodnik, znesek_racun}
- `showAddOfficialModal()` - add new input fields
- Save handler - include new values in data sent to backend

---

### 3.2 `src/pages/payments.js`

✅ **NO CHANGES NEEDED** - uses `amount` field as is

---

### 3.3 `src/pages/dashboard.js`

✅ **NO CHANGES NEEDED** - uses `amount` field as is

---

### 3.4 `src/pages/officials.js`

**`showOfficialInfo()` function** (line ~150)

- Backend `getHistory` will return data with correct amounts from stored values
- Minimal or no frontend changes needed

---

## 4. TESTING CHECKLIST

After all changes:

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

### Payments Page

- [ ] ✅ No changes, should work as before

### Dashboard

- [ ] ✅ No changes, should work as before

### Officials Info

- [ ] History shows correct amounts from stored values
- [ ] Totals calculated correctly

### Exports

- [ ] Single competition export works with correct amounts
- [ ] Summary export works with correct amounts
- [ ] Both tariff types export correctly

---

## 5. ROLLBACK PLAN

If something goes wrong:

```sql
-- Rollback migration
ALTER TABLE competition_officials
DROP COLUMN znesek_sodnik,
DROP COLUMN znesek_racun;
```

Then revert code changes using git.

---

## SUMMARY

### Files to change: 5 (down from 9!)

**Backend:**

1. ✅ `electron/supabase.ts` - 3 major functions
2. ✅ `electron/handlers/official.handlers.ts` - getHistory simplification
3. ✅ `electron/handlers/competition.handlers.ts` - save new fields

**Frontend:**

1. ✅ `src/pages/competitions.js` - add modal UI for both amounts

**Database:**

1. ✅ SQL migration - add 2 columns only

### Files with NO changes needed: 4

- ❌ `electron/handlers/payment.handlers.ts`
- ❌ `electron/handlers/export.handlers.ts` (auto-fixed by data changes)
- ❌ `src/pages/payments.js`
- ❌ `src/pages/dashboard.js`

---

## NOTES

- ⚠️ IMPORTANT: After migration, existing records will have znesek_sodnik = 0 and znesek_racun = 0
- May need to run a data fix script to calculate and populate these values for existing records
- Or manually re-assign officials to competitions to trigger new calculation
- **BENEFIT**: ~70% less refactoring work by keeping `amount` as is!


### 2.4 `electron/handlers/export.handlers.ts`

**`competition:exportToExcel` handler (line ~20)** - MAJOR CHANGES

- **CURRENT**: Uses `row.amount` which was calculated
- **NEW**: `row.amount` will now come from `znesek_sodnik` or `znesek_racun`
- Line 74-78: Comments need update
- Line 77: `const baseAmount = row.amount - row.travelCost` - logic stays same but data source changes
- Line 78: `const rowTotal = row.amount` - stays same
- ✅ Actually should work as-is if getCompetitionReportData is fixed

**`competition:exportSummary` handler (line ~110)** - CHANGES

- Line 203: `officialsTotal += (row.amount - row.travelCost)` - should work if data is correct
- ✅ Should work as-is if getCompetitionsSummaryData is fixed

---

### 2.5 `electron/handlers/competition.handlers.ts`

**`competition:addOfficial` / `competition:updateOfficial` handlers** - NEW LOGIC NEEDED

- Need to accept `znesek_sodnik` and `znesek_racun` from frontend
- Save these values to competition_officials table
- Update SQL INSERT/UPDATE statements to include new columns

---

## 3. FRONTEND FILES TO UPDATE

### 3.1 `src/pages/competitions.js` - MAJOR CHANGES

**When adding/editing official on competition:**

Current modal needs:

1. **Calculate both amounts** (sodnik & račun) when user enters hours/km/role
2. **Display both calculated amounts** with editable input fields
3. **Allow overwrite** - user can manually change calculated values
4. **Save both amounts** to database

New UI in modal:

```html
<div class="mb-2">
  <label>Izračunan znesek (Sodnik tarifa)</label>
  <input type="number" id="calc-znesek-sodnik" value="..." />
  <small>Avtomatsko izračunan, lahko spremeniš</small>
</div>
<div class="mb-2">
  <label>Izračunan znesek (Račun tarifa)</label>
  <input type="number" id="calc-znesek-racun" value="..." />
  <small>Avtomatsko izračunan, lahko spremeniš</small>
</div>
```

**Implementation steps:**

1. Add event listeners to hours/km/role inputs
2. On change → calculate both amounts using current tariff system
3. Pre-fill the two new input fields
4. User can edit if needed
5. On save → send both znesek_sodnik and znesek_racun to backend

**Functions to add/modify:**

- `calculateAmounts(hours, role, kilometers)` → returns {znesek_sodnik, znesek_racun}
- `showAddOfficialModal()` - add new input fields
- Save handler - include new values in data sent to backend

---

### 3.2 `src/pages/payments.js`

**Changes:**

- Line 82: `p.amount` → `p.dolg`
- Line 129: `payment?.amount` → `payment?.dolg` (2 occurrences)
- Line 142: `payment?.amount` → `payment?.dolg` (4 occurrences)
- Line 232: `f-amount` label → `f-dolg` or keep as "Znesek" (just data field name)
- Line 232: `payment?.amount` → `payment?.dolg`

**showEditForm() function:**

- Input field: `id="f-amount"` data → uses `payment.dolg`
- When saving: `data.amount` → `data.dolg`

---

### 3.3 `src/pages/dashboard.js`

**Changes:**

- Any reference to `amount` → `dolg`
- Should be in the unpaid payments table where it sums amounts
- Search for `.amount` and replace with `.dolg`

---

### 3.4 `src/pages/officials.js`

**`showOfficialInfo()` function** (line ~150)

- Line 160: `h.amount` → should display `h.znesek_sodnik` (or based on selected tariff)
- Line 187: `h.amount` → same change
- Backend `getHistory` will return correct field

---

## 4. TESTING CHECKLIST

After all changes:

### Database

- [ ] Run migration successfully
- [ ] Verify new columns exist in competition_officials
- [ ] Verify amount renamed to dolg in payments

### Backend

- [ ] Compile TypeScript: `npm run tsc`
- [ ] No compilation errors

### Add/Edit Official on Competition

- [ ] Modal shows both calculated amounts
- [ ] Can overwrite calculated amounts
- [ ] Both amounts saved to database
- [ ] Values persist on page reload

### Generate Payments

- [ ] Payments created with correct dolg value based on tariff selection
- [ ] Tariff selection (sodnik/račun) works correctly

### Payments Page

- [ ] Displays dolg column correctly
- [ ] Edit payment works
- [ ] Mark as paid works
- [ ] Partial payments work
- [ ] Export to Excel works

### Dashboard

- [ ] Shows correct total owed amounts
- [ ] Shows correct paid amounts

### Officials Info

- [ ] History shows correct amounts
- [ ] Totals calculated correctly

### Exports

- [ ] Single competition export works with correct amounts
- [ ] Summary export works with correct amounts
- [ ] Both tariff types export correctly

---

## 5. ROLLBACK PLAN

If something goes wrong:

```sql
-- Rollback migration
ALTER TABLE competition_officials
DROP COLUMN znesek_sodnik,
DROP COLUMN znesek_racun;

ALTER TABLE payments
RENAME COLUMN dolg TO amount;
```

Then revert code changes using git.

---

## NOTES

- ⚠️ IMPORTANT: After migration, existing records will have znesek_sodnik = 0 and znesek_racun = 0
- May need to run a data fix script to calculate and populate these values for existing records
- Or manually re-assign officials to competitions to trigger new calculation
