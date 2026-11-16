-- REVIEW ONLY. Do not execute without separate approval and isolated testing.
-- Intended only for HOPE-ERP-QA, project reference jlygmihiufrlqxzsfhpf.
-- Verify the project reference in the dashboard, then replace the placeholder
-- below. The placeholder is a manual confirmation, not technical project proof.
-- This replaces only the previously installed synthetic QA placeholders.
-- It preserves right IDs and refuses existing permission or relevant audit
-- history. Do not use it to migrate a real or previously used catalogue.
-- It changes no accounts, permissions, audit rows, policies, or feature flags.
-- Locks block catalogue, permission, and audit writes until the transaction ends.

BEGIN;

SET TRANSACTION ISOLATION LEVEL READ COMMITTED;

DO $confirmation$
DECLARE
  v_confirmed_project_ref text := 'REPLACE_AFTER_MANUAL_VERIFICATION';
BEGIN
  IF v_confirmed_project_ref <> 'jlygmihiufrlqxzsfhpf' THEN
    RAISE EXCEPTION 'Manually verify the HOPE-ERP-QA project reference first';
  END IF;
END;
$confirmation$;

LOCK TABLE public.module, public.rights IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public.user_permission, public.audit_log IN SHARE ROW EXCLUSIVE MODE;

CREATE TEMPORARY TABLE dev07_qa_catalogue (
  module_code text NOT NULL,
  sort_order integer NOT NULL,
  code varchar(40) NOT NULL UNIQUE,
  action varchar(30) NOT NULL CHECK (action ~ '^[A-Z][A-Z0-9_]*$'),
  label varchar(100) NOT NULL,
  PRIMARY KEY (module_code, sort_order)
) ON COMMIT DROP;

INSERT INTO dev07_qa_catalogue (module_code, sort_order, code, action, label) VALUES
  ('CUSTOMER', 1, 'customers.view', 'VIEW', 'View Customer'),
  ('CUSTOMER', 2, 'customers.add', 'ADD', 'Add Customer'),
  ('CUSTOMER', 3, 'customers.edit', 'EDIT', 'Edit Customer'),
  ('PRODUCT', 1, 'products.add', 'ADD', 'Add Product'),
  ('PRODUCT', 2, 'products.edit', 'EDIT', 'Edit Product'),
  ('PRODUCT', 3, 'products.delete', 'DELETE', 'Delete Product'),
  ('PRODUCT', 4, 'products.price_add', 'ADD_PRICE', 'Add Price'),
  ('PRODUCT', 5, 'products.price_edit', 'EDIT_PRICE', 'Edit Price'),
  ('PRODUCT', 6, 'products.price_delete', 'DELETE_PRICE', 'Delete Price'),
  ('HR', 1, 'hr.job_add', 'ADD_JOB', 'Add Job'),
  ('HR', 2, 'hr.job_edit', 'EDIT_JOB', 'Edit Job'),
  ('HR', 3, 'hr.job_delete', 'DELETE_JOB', 'Delete Job'),
  ('HR', 4, 'hr.department_add', 'ADD_DEPARTMENT', 'Add Department'),
  ('HR', 5, 'hr.department_edit', 'EDIT_DEPARTMENT', 'Edit Department'),
  ('HR', 6, 'hr.department_delete', 'DELETE_DEPARTMENT', 'Delete Department'),
  ('HR', 7, 'hr.employee_add', 'ADD_EMPLOYEE', 'Add Employee'),
  ('HR', 8, 'hr.employee_edit', 'EDIT_EMPLOYEE', 'Edit Employee'),
  ('HR', 9, 'hr.employee_delete', 'DELETE_EMPLOYEE', 'Delete Employee'),
  ('HR', 10, 'hr.job_history_view', 'VIEW_JOBHISTORY', 'View Job History'),
  ('HR', 11, 'hr.job_history_add', 'ADD_JOBHISTORY', 'Add Job History'),
  ('HR', 12, 'hr.job_history_edit', 'EDIT_JOBHISTORY', 'Edit Job History'),
  ('HR', 13, 'hr.job_history_delete', 'DELETE_JOBHISTORY', 'Delete Job History'),
  ('SALES', 1, 'sales.sale_add', 'ADD_SALE', 'Add Sale'),
  ('SALES', 2, 'sales.sale_edit', 'EDIT_SALE', 'Edit Sale'),
  ('SALES', 3, 'sales.sale_delete', 'DELETE_SALE', 'Delete Sale'),
  ('SALES', 4, 'sales.sale_detail_view', 'VIEW_SALEDETAIL', 'View Sale Details'),
  ('SALES', 5, 'sales.sale_detail_add', 'ADD_SALEDETAIL', 'Add Sale Detail'),
  ('SALES', 6, 'sales.sale_detail_edit', 'EDIT_SALEDETAIL', 'Edit Sale Detail'),
  ('SALES', 7, 'sales.sale_detail_delete', 'DELETE_SALEDETAIL', 'Delete Sale Detail'),
  ('REPORTS', 1, 'reports.top_customers', 'TOP_CUSTOMERS', 'Top Customers'),
  ('REPORTS', 2, 'reports.product_master', 'PRODUCT_MASTER', 'Product Master List'),
  ('REPORTS', 3, 'reports.top_products', 'TOP_PRODUCTS', 'Top Products'),
  ('REPORTS', 4, 'reports.active_employees', 'ACTIVE_EMPLOYEES', 'Active Employees'),
  ('REPORTS', 5, 'reports.all_employees', 'ALL_EMPLOYEES', 'All Employees'),
  ('REPORTS', 6, 'reports.employee_job_history', 'EMPLOYEE_JOBHISTORY', 'Employee Job History'),
  ('REPORTS', 7, 'reports.top_sales', 'TOP_SALES', 'Top Sales');

DO $preflight$
BEGIN
  IF pg_catalog.row_security_active('public.module'::regclass)
     OR pg_catalog.row_security_active('public.rights'::regclass)
     OR pg_catalog.row_security_active('public.user_permission'::regclass)
     OR pg_catalog.row_security_active('public.audit_log'::regclass) THEN
    RAISE EXCEPTION 'The executing role must have complete row visibility';
  END IF;

  IF EXISTS (SELECT 1 FROM public.user_permission)
     OR EXISTS (SELECT 1 FROM public.audit_log WHERE lower(table_name) IN ('user_permission', 'rights')) THEN
    RAISE EXCEPTION 'Permission rows or relevant audit history exist; do not replace the catalogue';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE contype = 'f' AND confrelid = 'public.rights'::regclass
      AND conrelid <> 'public.user_permission'::regclass
  ) THEN
    RAISE EXCEPTION 'Unexpected foreign key to rights; review before proceeding';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger
    WHERE tgrelid = 'public.rights'::regclass
      AND NOT tgisinternal AND tgenabled <> 'D'
  ) THEN
    RAISE EXCEPTION 'Unexpected rights-table trigger; review before proceeding';
  END IF;

  IF (SELECT count(*) FROM dev07_qa_catalogue) <> 36
     OR EXISTS (
       SELECT 1
       FROM (VALUES ('CUSTOMER', 3), ('PRODUCT', 6), ('HR', 13),
                    ('SALES', 7), ('REPORTS', 7)) AS expected(code, n)
       LEFT JOIN public.module m ON m.code = expected.code AND m.status = 'Active'
       LEFT JOIN public.rights r ON r.module_id = m.module_id
       GROUP BY expected.code, expected.n
       HAVING count(DISTINCT m.module_id) <> 1 OR count(r.right_id) <> expected.n
     )
     OR EXISTS (
       SELECT 1
       FROM dev07_qa_catalogue c
       LEFT JOIN public.module m ON m.code = c.module_code AND m.status = 'Active'
       LEFT JOIN public.rights r ON r.module_id = m.module_id AND r.sort_order = c.sort_order
       WHERE r.right_id IS NULL OR r.status IS DISTINCT FROM 'Active'
          OR r.code IS DISTINCT FROM c.module_code || '_QA_ACTION_' || c.sort_order::text
          OR r.action IS DISTINCT FROM 'QA_ACTION_' || c.sort_order::text
          OR r.label IS DISTINCT FROM 'QA action ' || c.sort_order::text
     )
     OR EXISTS (
       SELECT 1 FROM public.rights r
       JOIN dev07_qa_catalogue c ON c.code = r.code
     ) THEN
    RAISE EXCEPTION 'The existing catalogue does not match the unused synthetic QA baseline';
  END IF;
END;
$preflight$;

DO $replace$
DECLARE
  v_updated integer;
BEGIN
  UPDATE public.rights r
  SET code = c.code, action = c.action, label = c.label
  FROM dev07_qa_catalogue c
  JOIN public.module m ON m.code = c.module_code
  WHERE r.module_id = m.module_id AND r.sort_order = c.sort_order;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 36 OR EXISTS (
    SELECT 1 FROM dev07_qa_catalogue c
    LEFT JOIN public.module m ON m.code = c.module_code
    LEFT JOIN public.rights r ON r.module_id = m.module_id AND r.sort_order = c.sort_order
    WHERE r.code IS DISTINCT FROM c.code OR r.action IS DISTINCT FROM c.action
       OR r.label IS DISTINCT FROM c.label OR r.status IS DISTINCT FROM 'Active'
  ) THEN
    RAISE EXCEPTION 'Catalogue verification failed';
  END IF;
END;
$replace$;

COMMIT;
