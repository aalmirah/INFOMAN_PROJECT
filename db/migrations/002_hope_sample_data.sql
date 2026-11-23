-- The source guide is not present in the repository. These deterministic
-- CREATED stamps are provisional and should be replaced with its exact values
-- when the guide is available.
INSERT INTO customer (custno, custname, address, payterm, status, stamp) VALUES
  ('C-001', 'Hope Health Clinic', '100 Hope Street, Manila', '30D', 'Active', 'CREATED system 2025-12-31 12:00 AM'),
  ('C-002', 'Northstar Medical', '22 North Avenue, Quezon City', '45D', 'Active', 'CREATED system 2025-12-31 12:00 AM'),
  ('C-003', 'Valley Care Center', '8 Valley Road, Pasig', 'COD', 'Active', 'CREATED system 2025-12-31 12:00 AM'),
  ('C-004', 'Harborview Pharmacy', '17 Harbor Drive, Manila', '30D', 'Inactive', 'CREATED system 2025-12-31 12:00 AM'),
  ('C-005', 'City Wellness Center', '45 Central Boulevard, Makati', '45D', 'Active', 'CREATED system 2025-12-31 12:00 AM')
ON CONFLICT (custno) DO NOTHING;

INSERT INTO product (prodcode, description, unit, status, stamp) VALUES
  ('P-001', 'Medical Supply Kit', 'pc', 'Active', 'CREATED system 2025-12-31 12:00 AM'),
  ('P-002', 'Laboratory Supplies', 'pkg', 'Active', 'CREATED system 2025-12-31 12:00 AM'),
  ('P-003', 'Protective Face Mask', 'ea', 'Active', 'CREATED system 2025-12-31 12:00 AM'),
  ('P-004', 'Discontinued Test Kit', 'pc', 'Inactive', 'CREATED system 2025-12-31 12:00 AM'),
  ('P-005', 'Sanitizer Refill', 'ltr', 'Active', 'CREATED system 2025-12-31 12:00 AM')
ON CONFLICT (prodcode) DO NOTHING;

INSERT INTO employee
  (empno, lastname, firstname, gender, birthdate, hiredate, sepdate, status, stamp)
VALUES
  ('E-001', 'Santos', 'Maria', 'F', '1995-04-12', '2024-01-15', NULL, 'Active', 'CREATED system 2025-12-31 12:00 AM'),
  ('E-002', 'Reyes', 'Daniel', 'M', '1992-09-08', '2024-03-01', NULL, 'Active', 'CREATED system 2025-12-31 12:00 AM'),
  ('E-003', 'Cruz', 'Angela', 'F', '1998-02-19', '2024-06-10', NULL, 'Active', 'CREATED system 2025-12-31 12:00 AM'),
  ('E-004', 'Garcia', 'Miguel', 'M', '1990-11-03', '2023-08-01', '2025-12-31', 'Inactive', 'CREATED system 2025-12-31 12:00 AM')
ON CONFLICT (empno) DO NOTHING;

INSERT INTO job (jobcode, jobdesc, status, stamp) VALUES
  ('J-001', 'Manager', 'Active', 'CREATED system 2025-12-31 12:00 AM'),
  ('J-002', 'Sales Agent', 'Active', 'CREATED system 2025-12-31 12:00 AM'),
  ('J-003', 'Cashier', 'Active', 'CREATED system 2025-12-31 12:00 AM'),
  ('J-004', 'Clerk', 'Active', 'CREATED system 2025-12-31 12:00 AM')
ON CONFLICT (jobcode) DO NOTHING;

INSERT INTO department (deptcode, deptname, status, stamp) VALUES
  ('D-001', 'Sales', 'Active', 'CREATED system 2025-12-31 12:00 AM'),
  ('D-002', 'Finance', 'Active', 'CREATED system 2025-12-31 12:00 AM'),
  ('D-003', 'Human Resources', 'Active', 'CREATED system 2025-12-31 12:00 AM'),
  ('D-004', 'Warehouse', 'Active', 'CREATED system 2025-12-31 12:00 AM')
ON CONFLICT (deptcode) DO NOTHING;

INSERT INTO jobhistory (empno, jobcode, effdate, salary, deptcode, status, stamp) VALUES
  ('E-001', 'J-001', '2024-01-15', 52000.00, 'D-001', 'Active', 'CREATED system 2025-12-31 12:00 AM')
ON CONFLICT (empno, jobcode, effdate) DO NOTHING;

INSERT INTO pricehist (effdate, prodcode, unitprice, status, stamp) VALUES
  ('2025-01-01', 'P-001', 100.00, 'Active', 'CREATED system 2025-12-31 12:00 AM'),
  ('2025-02-01', 'P-001', 200.00, 'Active', 'CREATED system 2025-12-31 12:00 AM'),
  ('2025-01-01', 'P-002', 50.00, 'Active', 'CREATED system 2025-12-31 12:00 AM'),
  ('2025-01-10', 'P-002', 20.00, 'Active', 'CREATED system 2025-12-31 12:00 AM'),
  ('2025-01-01', 'P-003', 28.00, 'Active', 'CREATED system 2025-12-31 12:00 AM'),
  ('2025-01-15', 'P-003', 20.00, 'Active', 'CREATED system 2025-12-31 12:00 AM'),
  ('2025-02-01', 'P-003', 28.00, 'Active', 'CREATED system 2025-12-31 12:00 AM'),
  ('2025-01-01', 'P-005', 56.50, 'Active', 'CREATED system 2025-12-31 12:00 AM'),
  ('2025-02-01', 'P-005', 62.00, 'Active', 'CREATED system 2025-12-31 12:00 AM')
ON CONFLICT (effdate, prodcode) DO NOTHING;

INSERT INTO sales (transno, salesdate, custno, empno, status, stamp) VALUES
  ('T-001', '2025-01-05', 'C-001', 'E-001', 'Active', 'CREATED system 2025-12-31 12:00 AM'),
  ('T-002', '2025-01-20', 'C-002', 'E-002', 'Active', 'CREATED system 2025-12-31 12:00 AM'),
  ('T-003', '2025-02-15', 'C-003', 'E-001', 'Active', 'CREATED system 2025-12-31 12:00 AM'),
  ('T-004', '2025-03-10', 'C-004', 'E-003', 'Inactive', 'CREATED system 2025-12-31 12:00 AM')
ON CONFLICT (transno) DO NOTHING;

INSERT INTO salesdetail (transno, prodcode, quantity, status, stamp) VALUES
  ('T-001', 'P-001', 1, 'Active', 'CREATED system 2025-12-31 12:00 AM'),
  ('T-001', 'P-002', 1, 'Active', 'CREATED system 2025-12-31 12:00 AM'),
  ('T-001', 'P-003', 1, 'Active', 'CREATED system 2025-12-31 12:00 AM'),
  ('T-001', 'P-005', 1, 'Active', 'CREATED system 2025-12-31 12:00 AM'),
  ('T-002', 'P-001', 1, 'Active', 'CREATED system 2025-12-31 12:00 AM'),
  ('T-002', 'P-002', 1, 'Active', 'CREATED system 2025-12-31 12:00 AM'),
  ('T-002', 'P-003', 1, 'Active', 'CREATED system 2025-12-31 12:00 AM'),
  ('T-003', 'P-001', 2, 'Active', 'CREATED system 2025-12-31 12:00 AM'),
  ('T-003', 'P-002', 1, 'Active', 'CREATED system 2025-12-31 12:00 AM'),
  ('T-003', 'P-003', 1, 'Active', 'CREATED system 2025-12-31 12:00 AM'),
  ('T-003', 'P-005', 1, 'Active', 'CREATED system 2025-12-31 12:00 AM'),
  ('T-004', 'P-001', 1, 'Active', 'CREATED system 2025-12-31 12:00 AM'),
  ('T-004', 'P-003', 1, 'Active', 'CREATED system 2025-12-31 12:00 AM')
ON CONFLICT (transno, prodcode) DO NOTHING;

INSERT INTO payment (orno, paydate, amount, transno, status, stamp) VALUES
  ('PM-001', '2025-01-05', 100.00, 'T-001', 'Active', 'CREATED system 2025-12-31 12:00 AM'),
  ('PM-002', '2025-01-20', 140.00, 'T-002', 'Active', 'CREATED system 2025-12-31 12:00 AM'),
  ('PM-003', '2025-02-15', 510.00, 'T-003', 'Active', 'CREATED system 2025-12-31 12:00 AM'),
  ('PM-004', '2025-03-10', 50.00, 'T-004', 'Active', 'CREATED system 2025-12-31 12:00 AM')
ON CONFLICT (orno) DO NOTHING;
