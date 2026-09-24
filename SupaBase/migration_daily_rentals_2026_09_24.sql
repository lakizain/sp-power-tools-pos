-- ================================================================
-- DAILY RENTALS MIGRATION
-- Matches RentalModal.tsx: one rental record = one date + one amount.
-- Safe to run after migration_rentals_2026_09_09.sql.
-- Does not delete legacy columns because the existing rentals service
-- still writes/reads them and still selects rental_items (*).
-- ================================================================

BEGIN;

-- Keep the existing table compatible with the current Supabase service.
ALTER TABLE public.rentals
  ALTER COLUMN rent_from SET NOT NULL,
  ALTER COLUMN rent_to SET NOT NULL,
  ALTER COLUMN daily_rate SET DEFAULT 0.00,
  ALTER COLUMN total_rent SET DEFAULT 0.00,
  ALTER COLUMN paid_amount SET DEFAULT 0.00,
  ALTER COLUMN security_deposit SET DEFAULT 0.00,
  ALTER COLUMN items SET DEFAULT '[]'::jsonb;

-- Existing historical rentals remain valid, but the new model stores one date.
UPDATE public.rentals
SET rent_to = rent_from
WHERE rent_to IS DISTINCT FROM rent_from;

-- Daily entries do not use weekly pricing, deposits, or advance payments.
UPDATE public.rentals
SET weekly_rate = NULL,
    security_deposit = 0.00,
    paid_amount = 0.00,
    items = '[]'::jsonb
WHERE weekly_rate IS NOT NULL
   OR security_deposit <> 0.00
   OR paid_amount <> 0.00
   OR items <> '[]'::jsonb;

-- Keep the total amount and daily amount synchronized for existing records.
UPDATE public.rentals
SET daily_rate = total_rent
WHERE daily_rate IS DISTINCT FROM total_rent;

-- Helpful indexes for date-based daily collection reports.
CREATE INDEX IF NOT EXISTS idx_rentals_daily_date
  ON public.rentals (rent_from DESC);

CREATE INDEX IF NOT EXISTS idx_rentals_daily_amount
  ON public.rentals (total_rent);

-- Confirm the relation used by services.ts still exists.
DO $$
BEGIN
  IF to_regclass('public.rental_items') IS NULL THEN
    RAISE EXCEPTION 'public.rental_items is required by src/lib/services.ts';
  END IF;
END $$;

COMMIT;

-- Verification query:
SELECT
  id,
  rent_from AS rental_date,
  total_rent AS rental_amount,
  daily_rate,
  rent_to,
  items,
  weekly_rate,
  security_deposit,
  paid_amount
FROM public.rentals
ORDER BY rent_from DESC, created_at DESC;
