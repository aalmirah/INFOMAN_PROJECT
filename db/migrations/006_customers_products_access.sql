CREATE FUNCTION public.app_actor_role() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT r.name::text
  FROM public.app_user AS u
  JOIN public.role AS r ON r.role_id = u.role_id
  WHERE u.user_id = NULLIF(current_setting('app.actor_user_id', true), '')::bigint
    AND u.status = 'Active'
    AND u.is_blocked = false
    AND r.status = 'Active'
$$;

COMMENT ON FUNCTION public.app_actor_role() IS
  'Returns the active, unblocked actor role from the transaction-local app.actor_user_id setting; NULL fails closed.';

DROP VIEW IF EXISTS public.customer_active;
DROP VIEW IF EXISTS public.product_active;

CREATE VIEW public.customer_management_admin WITH (security_barrier = true) AS
SELECT custno, custname, address, payterm, status, stamp
FROM public.customer
WHERE public.app_actor_role() IN ('Admin', 'Superadmin');

CREATE VIEW public.customer_active WITH (security_barrier = true) AS
SELECT custno, custname, address, payterm
FROM public.customer
WHERE public.app_actor_role() IN ('Admin', 'Superadmin', 'User')
  AND status = 'Active';

CREATE VIEW public.product_management_admin WITH (security_barrier = true) AS
SELECT p.prodcode,
       p.description,
       p.unit,
       p.status,
       p.stamp,
       current_price.unitprice AS current_price
FROM public.product AS p
LEFT JOIN LATERAL (
  SELECT ph.unitprice
  FROM public.pricehist AS ph
  WHERE ph.prodcode = p.prodcode
    AND ph.status = 'Active'
    AND ph.effdate <= CURRENT_DATE
  ORDER BY ph.effdate DESC
  LIMIT 1
) AS current_price ON true
WHERE public.app_actor_role() IN ('Admin', 'Superadmin');

CREATE VIEW public.product_active WITH (security_barrier = true) AS
SELECT p.prodcode,
       p.description,
       p.unit,
       current_price.unitprice AS current_price
FROM public.product AS p
LEFT JOIN LATERAL (
  SELECT ph.unitprice
  FROM public.pricehist AS ph
  WHERE ph.prodcode = p.prodcode
    AND ph.status = 'Active'
    AND ph.effdate <= CURRENT_DATE
  ORDER BY ph.effdate DESC
  LIMIT 1
) AS current_price ON true
WHERE public.app_actor_role() IN ('Admin', 'Superadmin', 'User')
  AND p.status = 'Active';

CREATE VIEW public.pricehist_management_admin WITH (security_barrier = true) AS
SELECT effdate, prodcode, unitprice, status, stamp
FROM public.pricehist
WHERE public.app_actor_role() IN ('Admin', 'Superadmin');

CREATE VIEW public.pricehist_active WITH (security_barrier = true) AS
SELECT effdate, prodcode, unitprice
FROM public.pricehist
WHERE public.app_actor_role() IN ('Admin', 'Superadmin', 'User')
  AND status = 'Active';

COMMENT ON VIEW public.customer_management_admin IS
  'All customer records, including status and stamp, for active Admin and Superadmin actors only.';
COMMENT ON VIEW public.customer_active IS
  'Active customer rows without status or stamp columns for active app users.';
COMMENT ON VIEW public.product_management_admin IS
  'All product records with status and stamp for active Admin and Superadmin actors; current_price is derived from pricehist.';
COMMENT ON VIEW public.product_active IS
  'Active product rows without status or stamp columns; current_price is derived from pricehist.';
COMMENT ON VIEW public.pricehist_management_admin IS
  'All price history, including status and stamp, for active Admin and Superadmin actors only.';
COMMENT ON VIEW public.pricehist_active IS
  'Active price history without status or stamp columns for active app users.';

GRANT SELECT ON
  public.customer_management_admin,
  public.customer_active,
  public.product_management_admin,
  public.product_active,
  public.pricehist_management_admin,
  public.pricehist_active
TO PUBLIC;

CREATE FUNCTION public.reject_customer_product_hard_delete() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  RAISE EXCEPTION 'Physical deletion from % is forbidden; set status = Inactive instead.',
    TG_TABLE_NAME;
END;
$$;

COMMENT ON FUNCTION public.reject_customer_product_hard_delete() IS
  'Prevents DELETE and TRUNCATE on customer, product, and price-history tables; use status=Inactive instead.';

CREATE TRIGGER customer_no_hard_delete
BEFORE DELETE ON public.customer
FOR EACH ROW EXECUTE FUNCTION public.reject_customer_product_hard_delete();
CREATE TRIGGER customer_no_truncate
BEFORE TRUNCATE ON public.customer
FOR EACH STATEMENT EXECUTE FUNCTION public.reject_customer_product_hard_delete();
CREATE TRIGGER product_no_hard_delete
BEFORE DELETE ON public.product
FOR EACH ROW EXECUTE FUNCTION public.reject_customer_product_hard_delete();
CREATE TRIGGER product_no_truncate
BEFORE TRUNCATE ON public.product
FOR EACH STATEMENT EXECUTE FUNCTION public.reject_customer_product_hard_delete();
CREATE TRIGGER pricehist_no_hard_delete
BEFORE DELETE ON public.pricehist
FOR EACH ROW EXECUTE FUNCTION public.reject_customer_product_hard_delete();
CREATE TRIGGER pricehist_no_truncate
BEFORE TRUNCATE ON public.pricehist
FOR EACH STATEMENT EXECUTE FUNCTION public.reject_customer_product_hard_delete();

COMMENT ON TRIGGER customer_no_hard_delete ON public.customer IS
  'Enforces soft deletion for customer records.';
COMMENT ON TRIGGER customer_no_truncate ON public.customer IS
  'Prevents bypassing row-level soft-delete enforcement with TRUNCATE.';
COMMENT ON TRIGGER product_no_hard_delete ON public.product IS
  'Enforces soft deletion for product records.';
COMMENT ON TRIGGER product_no_truncate ON public.product IS
  'Prevents bypassing row-level soft-delete enforcement with TRUNCATE.';
COMMENT ON TRIGGER pricehist_no_hard_delete ON public.pricehist IS
  'Enforces soft deletion for price history records.';
COMMENT ON TRIGGER pricehist_no_truncate ON public.pricehist IS
  'Prevents bypassing row-level soft-delete enforcement with TRUNCATE.';
