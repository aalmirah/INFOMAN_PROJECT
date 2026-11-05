Place idempotent PostgreSQL seed scripts here. Use `INSERT ... ON CONFLICT`,
or another repeat-safe pattern, so `npm run db:seed` can run more than once.
Seed files run in filename order, each in its own transaction.
