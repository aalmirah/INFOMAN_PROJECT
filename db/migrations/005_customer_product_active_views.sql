CREATE OR REPLACE VIEW customer_active AS
SELECT
  custno,
  custname,
  address,
  payterm,
  status,
  stamp
FROM customer
WHERE status = 'Active';

CREATE OR REPLACE VIEW product_active AS
SELECT
  prodcode,
  description,
  unit,
  status,
  stamp
FROM product
WHERE status = 'Active';

CREATE INDEX IF NOT EXISTS customer_status_custname_idx
  ON customer (status, custname);

CREATE INDEX IF NOT EXISTS customer_status_address_idx
  ON customer (status, address);

CREATE INDEX IF NOT EXISTS product_status_description_idx
  ON product (status, description);

CREATE INDEX IF NOT EXISTS product_status_unit_idx
  ON product (status, unit);

COMMENT ON VIEW customer_active IS
  'Active customer rows for customer-management search screens and filters.';

COMMENT ON VIEW product_active IS
  'Active product rows for product-management search screens and filters.';
