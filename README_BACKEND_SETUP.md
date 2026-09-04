Backend setup

Required environment variables (set in Vercel / local .env):

- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY (server-only)
- SESSION_SECRET (any random string)

Install required packages:

```bash
# from repository root
npm install @supabase/supabase-js bcryptjs
```

Notes:
- The Supabase service role key MUST remain server-only and never be exposed to the browser.
- The provided `lib/supabaseServer.ts` creates a server-only Supabase client using the service role key.
- The simple session implementation uses an HMAC-signed token stored in an HttpOnly cookie named `session`. Set `SESSION_SECRET` to a secure value in production.

Next steps (recommended):
- Implement additional API routes mirroring the SQL schema (employees, attendance, inventory, sales, expenses, stock transactions, etc.).
- Add server-side validation, authorization checks, and transaction handling as needed.
- Run `npm run build` to verify TypeScript.
