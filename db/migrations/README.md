# HOPE base migrations

These numbered PostgreSQL migrations create the base structure and its sample
records in separate transactions. Apply them from the repository root with
`npm run db:migrate`, then run `npm run db:verify` to see table counts and
assertions.

## Source and assumptions

The supplied source was compared with the tracked legacy SQL in
[`database/migrations/migration_base.sql`](../../database/migrations/migration_base.sql)
and a schema-only Supabase export (PostgreSQL 17.11). Both show the same core
HOPE schema, legacy identifiers, and audit layer. The provided Supabase Schema
Visualizer screenshot confirms the relationships
among the ten requested core tables. The live schema export does not include
row data. Neither source contains the requested walkthrough IDs `C-001`,
`E-001`, `T-001`, `P-001`, `J-001`, or `D-001`. The guide/screens showing the
requested sample records and exact stamp values were not provided. Therefore
the requested sample names, descriptions, addresses, salaries, payments, and
deterministic stamps are not verified copies of the guide. The project owner
has accepted the documented sample dataset as the final Task 2 test fixture.
The SQL audit section gives only an example stamp format
(`EDIT user1 2026-10-12 11:18 AM`), not the guide's per-row stamp values.

Differences and resolutions:

- Source identifiers are legacy codes (`C0001`, `00001`, `TR000001`, `AD0001`)
  rather than the requested hyphenated walkthrough codes. The migration uses
  the requested codes.
- Live and source `job.jobCode` is `varchar(4)`, `department.deptCode` is
  `varchar(3)`, and `jobHistory.deptCode` is `varchar(4)`. The migration uses
  `varchar(5)` consistently for these keys and references to fit `J-001` and
  `D-001`.
- Live and source `customer.custname` is `varchar(20)`; this migration uses
  `varchar(30)` for provisional sample names.
- Source `priceHist.unitPrice` requires `> 0`, and `salesDetail.quantity`
  allows `>= 0`. The task requests `unitprice >= 0` and `quantity > 0`, which
  the migration implements.
- The live core tables have `is_deleted boolean NOT NULL DEFAULT false` and
  nullable `stamp varchar(60)`, added by the audit layer. The requested
  `status varchar(8)` CHECK and `stamp varchar(80) NOT NULL` are used here
  instead; `status` replaces `is_deleted` for these ten base tables.
- The live source foreign keys omit `ON DELETE` actions (PostgreSQL's default
  `NO ACTION`). This migration uses the explicitly requested `RESTRICT`.
- The provided Supabase schema diagram confirms the core relationships:
  `jobhistory` to employee/job/department; sales to customer/employee;
  salesdetail to sales/product; payment to sales; and pricehist to product.
  The migration includes these links with `RESTRICT`.
- The Supabase export also contains unrelated tables such as `customers`,
  `products`, `profiles`, `reports`, `rights`, `users`, and `userrights`.
  They are outside this task; only the ten requested singular base tables are
  created by these migrations.
- Required sample-field nullability is made explicit for dates, references,
  names, and payment values used by the workflows. These constraints keep the
  sample and verification calculations well-defined.
- The guide's exact stamps and sample fields (names, descriptions, addresses,
  payment dates, and amounts) could not be checked because the guide was not
  included. By owner decision, these accepted fixture rows use the
  deterministic `CREATED system 2025-12-31 12:00 AM` stamp. Table defaults
  generate a `CREATED system` timestamp for later inserts.
- T-004 is marked `Inactive` because the requested active-sales total is
  exactly T-001 + T-002 + T-003; the task did not separately specify T-004's
  status.

## Audit objects excluded

Both the source SQL and live schema export contain `audit_log`, `audit_user()`,
`audit_stamp()`,
`trg_set_stamp()`, `trg_audit_log()`, `trg_block_hard_delete()`,
`trg_protect_audit_log()`, `trg_check_children()`, the audit-log protection
triggers, and the `*_active` views. None are copied into these migrations.
Audit logging and these related triggers/functions/views are reserved for
Task 6. The `stamp` columns and defaults here are only fields/default values;
they do not install audit triggers.
