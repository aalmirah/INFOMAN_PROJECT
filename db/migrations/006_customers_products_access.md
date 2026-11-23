# Sprint 2: customer, product, and price-history access

Migration `006_customers_products_access.sql` adds the SQL read surfaces for
the Customers and Products modules. The normal migration runner wraps this
file and its `schema_migrations` record in one transaction. Do not edit an
applied migration.

## Actor context

After authenticating the account in trusted server code, set its `app_user`
ID transaction-locally on the same connection used for module queries:

```sql
BEGIN;
SET LOCAL app.actor_user_id = '123';
-- Run one or more module queries on this connection.
COMMIT;
```

`app_actor_role()` resolves that ID against the current active, unblocked
`app_user` and active `role`. A missing or inactive account returns `NULL`,
which exposes no module rows. Do not accept the actor ID from a browser or
client-supplied request field, and do not give database credentials to users:
custom PostgreSQL settings are a server-side guardrail, not authentication.
The views are granted `SELECT` to PostgreSQL roles so a trusted app connection
can query them without module-table access; with no authenticated actor context
they return no rows.

## Read surfaces

| View | Admin / Superadmin | User | Columns |
|---|---|---|---|
| `customer_management_admin` | All customers | No rows | Includes `status`, `stamp` |
| `customer_active` | Active customers | Active customers | Omits `status`, `stamp` |
| `product_management_admin` | All products | No rows | Includes `status`, `stamp`, derived `current_price` |
| `product_active` | Active products | Active products | Omits `status`, `stamp`, derived `current_price` |
| `pricehist_management_admin` | All history | No rows | Includes `status`, `stamp` |
| `pricehist_active` | Active history | Active history | Omits `status`, `stamp` |

Use the management views for Admin and Superadmin screens and the active views
for User screens. `current_price` is the latest active price-history row with
an effective date on or before `CURRENT_DATE`; it is never stored on
`product`. It is `NULL` when no such history exists. Historical sales totals
continue to calculate prices as of each sale date and are unchanged by this
migration.

Physical `DELETE` and `TRUNCATE` on `customer`, `product`, and `pricehist`
raise an error. Set the row's `status` to `Inactive` instead. Adding or
inactivating price history therefore leaves prior prices available for
historical sales calculations.

## Apply and verify

From the repository root, after configuring `.env` for a development
PostgreSQL database:

```text
npm run db:migrate
npm run db:verify
```

`db:verify` creates temporary role actors inside a transaction, checks each
view's role filtering and visible columns, and rolls the test actors back.
It also checks fixture IDs and statuses, current prices, sales totals, and
rejects DELETE/TRUNCATE attempts inside savepoints that are rolled back.
Successful assertions are printed as `PASS` lines.

Expected results on the provided fixture:

| Assertion | Expected |
|---|---:|
| Customer IDs C-001..C-005 | 5 rows; C-004 Inactive; other 4 Active |
| Product IDs P-001..P-005 | 5 rows; P-004 Inactive; other 4 Active |
| Admin / Superadmin management views | All base rows, with `status` and `stamp` |
| User active views | Only Active rows; no `status` or `stamp` columns |
| User management views | 0 rows |
| P-003 current price; P-004 current price | 28.00; NULL |
| T-001 / T-002 / T-003 sales totals | 234.50 / 140.00 / 510.00 |
| Active sales total | 884.50 |
| Stored `product.current_price` column | 0 columns |
| Enabled DELETE/TRUNCATE guards | 6 triggers |
| DELETE/TRUNCATE attempts | All 6 rejected; fixture remains unchanged |

## Development rollback

The migration runner has no down-migration command. For a disposable local
development database only, switch to the prior code revision and run
`npm run db:reset`, then `npm run db:migrate` to rebuild from that revision.
Do not reset the shared Supabase database. For a shared database, preserve
the migration history and correct mistakes with a new forward migration.
