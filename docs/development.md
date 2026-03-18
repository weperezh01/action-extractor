# Development Workflow

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.local.example` to `.env.local` if you still need a local env file.
3. Configure the Postgres connection in `.env.local`.
4. Run `npm run db:migrate` before starting the app.
5. Start the app with `npm run dev`.

## Verification

- Run `npm run lint`.
- Run `npm run typecheck`.
- Run `npm test`.
- Run `npm run build`.

## Notes

- `npm run db:migrate` loads `.env.local` automatically when the variables are not already exported in the shell.
- `npm run lint` is intentionally scoped to `app/api` and `lib` in this phase so CI covers the highest-risk server/runtime surfaces without failing on pre-existing UI lint debt.
- `npm run build` skips Next's built-in lint pass because lint now runs as a dedicated CI step with its own scope.
- The runtime schema bootstrap in `lib/db.ts` is still available as a temporary fallback during this transition, but it is deprecated and should not be relied on for normal development or deploys.
