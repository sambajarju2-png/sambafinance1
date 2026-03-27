# PayWatch Features — Deploy Package
**Date:** March 27, 2026 (Session 4)

## What's in this zip

### Modified files (complete replacements):
- `src/app/(app)/cashflow/page.tsx` — Top Vendors gate removed, now visible for everyone
- `src/components/buddy-settings.tsx` — "Code invoeren" section added
- `src/app/(app)/betalingen/bill-detail-drawer.tsx` — Notitie tab removed, Regeling tab + Betalingsregeling button added
- `src/lib/bills.ts` — `has_payment_plan` field added to Bill interface

### New files:
- `src/app/api/bills/[id]/payment-plan/route.ts` — Create/Get/Delete payment plans
- `src/app/api/bills/[id]/payment-plan/[installmentId]/route.ts` — Mark installments paid
- `src/components/payment-plan-setup.tsx` — Setup drawer (pick terms + day)
- `src/components/payment-plan-tracker.tsx` — Installment checklist + progress bar

### Database (already applied):
- `payment_plans` table ✅
- `plan_installments` table ✅  
- `has_payment_plan` column on `bills` table ✅

---

## Deploy commands

```bash
cd ~/sambafinance1
unzip -o ~/Downloads/paywatch-features-v2.zip -d .
git add .
git commit -m "feat: remove stats gate, buddy code entry, betalingsregeling"
git pull origin main --rebase
git push origin main
```

No manual edits needed — everything is in the zip.

---

## What changed

### 1. Stats gate — already done (was already `true`)
### 2. Cashflow gate — FIXED
- Top Vendors section no longer blurred/gated
- Removed `statsUnlocked` state and profile fetch (not needed anymore)

### 3. Buddy code entry — ADDED  
- New "Code invoeren" card in buddy settings
- Input field for PW-B-XXXXXX codes
- Calls existing PATCH /api/buddies endpoint
- Auto-refreshes buddy list on success

### 4. Betalingsregeling — FULL FEATURE
- **Acties tab:** "Betalingsregeling getroffen" button (only shows when no plan + not settled)
- **Setup drawer:** Pick number of terms (2-48) + payment day (1-28), shows calculated amounts
- **Regeling tab:** Only appears when bill has a plan. Shows progress bar + installment checklist
- **Mark installment paid:** Tap any installment to toggle paid/pending
- **Auto-complete:** When all installments are paid, bill status → settled
- **Header progress:** Progress bar shows in the bill drawer header
- **Cancel plan:** Option to cancel at bottom of Regeling tab

### 5. Notitie tab — REMOVED
- Removed to keep the UI clean (per your request)
