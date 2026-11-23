INSERT INTO role (name, description) VALUES
  ('Superadmin', 'Full access to all active rights; effective rights are implicit.'),
  ('Admin', 'Manages users and grants rights to users.'),
  ('User', 'Default role for newly registered users; only explicitly granted rights.')
ON CONFLICT (name) DO UPDATE
SET description = EXCLUDED.description,
    status = 'Active';

INSERT INTO module (code, name, sort_order) VALUES
  ('CUSTOMER', 'Customer', 1),
  ('PRODUCT', 'Product', 2),
  ('HR', 'Human Resources', 3),
  ('SALES', 'Sales', 4),
  ('REPORTS', 'Reports', 5)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    sort_order = EXCLUDED.sort_order,
    status = 'Active';

INSERT INTO rights (code, module_id, action, label, sort_order)
SELECT v.code, m.module_id, v.action, v.label, v.sort_order
FROM (VALUES
  ('CUSTOMER_ADD', 'CUSTOMER', 'ADD', 'Add Customer', 1),
  ('CUSTOMER_EDIT', 'CUSTOMER', 'EDIT', 'Edit Customer', 2),
  ('CUSTOMER_DELETE', 'CUSTOMER', 'DELETE', 'Delete Customer', 3),
  ('PRODUCT_ADD', 'PRODUCT', 'ADD', 'Add Product', 1),
  ('PRODUCT_EDIT', 'PRODUCT', 'EDIT', 'Edit Product', 2),
  ('PRODUCT_DELETE', 'PRODUCT', 'DELETE', 'Delete Product', 3),
  ('PRICE_ADD', 'PRODUCT', 'ADD_PRICE', 'Add Price', 4),
  ('PRICE_EDIT', 'PRODUCT', 'EDIT_PRICE', 'Edit Price', 5),
  ('PRICE_DELETE', 'PRODUCT', 'DELETE_PRICE', 'Delete Price', 6),
  ('JOB_ADD', 'HR', 'ADD_JOB', 'Add Job', 1),
  ('JOB_EDIT', 'HR', 'EDIT_JOB', 'Edit Job', 2),
  ('JOB_DELETE', 'HR', 'DELETE_JOB', 'Delete Job', 3),
  ('DEPARTMENT_ADD', 'HR', 'ADD_DEPARTMENT', 'Add Department', 4),
  ('DEPARTMENT_EDIT', 'HR', 'EDIT_DEPARTMENT', 'Edit Department', 5),
  ('DEPARTMENT_DELETE', 'HR', 'DELETE_DEPARTMENT', 'Delete Department', 6),
  ('EMPLOYEE_ADD', 'HR', 'ADD_EMPLOYEE', 'Add Employee', 7),
  ('EMPLOYEE_EDIT', 'HR', 'EDIT_EMPLOYEE', 'Edit Employee', 8),
  ('EMPLOYEE_DELETE', 'HR', 'DELETE_EMPLOYEE', 'Delete Employee', 9),
  ('JOBHISTORY_VIEW', 'HR', 'VIEW_JOBHISTORY', 'View Job History', 10),
  ('JOBHISTORY_ADD', 'HR', 'ADD_JOBHISTORY', 'Add Job History', 11),
  ('JOBHISTORY_EDIT', 'HR', 'EDIT_JOBHISTORY', 'Edit Job History', 12),
  ('JOBHISTORY_DELETE', 'HR', 'DELETE_JOBHISTORY', 'Delete Job History', 13),
  ('SALE_ADD', 'SALES', 'ADD_SALE', 'Add Sale', 1),
  ('SALE_EDIT', 'SALES', 'EDIT_SALE', 'Edit Sale', 2),
  ('SALE_DELETE', 'SALES', 'DELETE_SALE', 'Delete Sale', 3),
  ('SALEDETAIL_VIEW', 'SALES', 'VIEW_SALEDETAIL', 'View Sale Details', 4),
  ('SALEDETAIL_ADD', 'SALES', 'ADD_SALEDETAIL', 'Add Sale Detail', 5),
  ('SALEDETAIL_EDIT', 'SALES', 'EDIT_SALEDETAIL', 'Edit Sale Detail', 6),
  ('SALEDETAIL_DELETE', 'SALES', 'DELETE_SALEDETAIL', 'Delete Sale Detail', 7),
  ('REPORT_TOP_CUSTOMERS', 'REPORTS', 'TOP_CUSTOMERS', 'Top Customers', 1),
  ('REPORT_PRODUCT_MASTER', 'REPORTS', 'PRODUCT_MASTER', 'Product Master List', 2),
  ('REPORT_TOP_PRODUCTS', 'REPORTS', 'TOP_PRODUCTS', 'Top Products', 3),
  ('REPORT_ACTIVE_EMPLOYEES', 'REPORTS', 'ACTIVE_EMPLOYEES', 'Active Employees', 4),
  ('REPORT_ALL_EMPLOYEES', 'REPORTS', 'ALL_EMPLOYEES', 'All Employees', 5),
  ('REPORT_EMPLOYEE_JOBHISTORY', 'REPORTS', 'EMPLOYEE_JOBHISTORY', 'Employee Job History', 6),
  ('REPORT_TOP_SALES', 'REPORTS', 'TOP_SALES', 'Top Sales', 7)
) AS v(code, module_code, action, label, sort_order)
JOIN module m ON m.code = v.module_code
ON CONFLICT (code) DO UPDATE
SET module_id = EXCLUDED.module_id,
    action = EXCLUDED.action,
    label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order,
    status = 'Active';
