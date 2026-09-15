# Supabase Realtime rollout notes

## Bucket A: direct row merge
Tables in this bucket are safe to subscribe to directly from the client because they are non-sensitive and either globally scoped or already public in the app:

- attendance_settings
- payroll_settings
- holidays
- food_and_beverage_inventory
- food_packages
- services
- sub_services
- service_sub_services
- production_inventory
- kitchen_inventory
- assets_inventory
- employees
- attendance
- leave_types
- leave_requests

Use the shared `useRealtimeEntity` hook and merge the incoming row into local state with the stale-row guard from `isRealtimeRowNewer()`.

## Bucket B: signal only + refetch
Sensitive or aggregate-heavy tables must not stream full row payloads into the client directly:

- sales
- service_transactions
- expense aggregates
- any payroll / summary logic that derives totals from multiple tables

For these tables, listen for the event, set a lightweight refresh signal, and refetch the authenticated API route that computes the correct totals. This keeps the client logic safe and avoids exposing raw financial detail to every browser tab.

## Verification checklist
1. Run the migration in the Supabase SQL editor.
2. Confirm the table is present in `pg_publication_tables` for `supabase_realtime`.
3. Confirm the matching `SELECT` policy exists for each Bucket A table.
4. Update a row in Supabase and confirm the browser console logs the Realtime payload.
5. Verify the page refetches or merges the updated state without stale rows.
