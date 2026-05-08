-- Liquidity rank for chart of accounts: lower values = higher liquidity.
-- Apply in the Supabase SQL editor or via `supabase db push` if you use the CLI.

ALTER TABLE "chartOfAccounts" ADD COLUMN IF NOT EXISTS "liquidityRank" integer;

ALTER TABLE "chartOfAccounts" DROP CONSTRAINT IF EXISTS "chartOfAccounts_liquidityRank_check";
ALTER TABLE "chartOfAccounts" ADD CONSTRAINT "chartOfAccounts_liquidityRank_check"
  CHECK ("liquidityRank" IS NULL OR "liquidityRank" >= 1);

COMMENT ON COLUMN "chartOfAccounts"."liquidityRank" IS 'Liquidity ordering: lower numbers mean higher liquidity.';

-- If direct updates from the app are blocked by RLS, add a policy for administrators
-- (adjust to match your role / JWT claims setup), for example:
-- CREATE POLICY "admin_update_liquidity"
--   ON "chartOfAccounts" FOR UPDATE TO authenticated
--   USING (true) WITH CHECK (true);
