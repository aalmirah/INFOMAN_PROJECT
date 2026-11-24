-- Sprint 2 customer/product read views and active-row search indexes.
-- The current Sprint 1 schema uses status = 'Active'. The legacy
-- database/schema.sql uses is_deleted, so support that representation too.
-- The migration runner wraps each migration file in a transaction.
DO $migration$
DECLARE
    customer_active_predicate TEXT;
    product_active_predicate TEXT;
BEGIN
    IF to_regclass('public.customer') IS NULL
       OR to_regclass('public.product') IS NULL THEN
        RAISE EXCEPTION
            'S2-DBA-01 requires public.customer and public.product from Sprint 1; apply the base schema first';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'customer'
          AND column_name = 'custno'
    ) OR NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'customer'
          AND column_name = 'custname'
    ) OR NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'product'
          AND column_name = 'prodcode'
    ) OR NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'product'
          AND column_name = 'description'
    ) OR NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'customer'
          AND column_name = 'address'
    ) OR NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'customer'
          AND column_name = 'payterm'
    ) OR NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'product'
          AND column_name = 'unit'
    ) THEN
        RAISE EXCEPTION
            'S2-DBA-01 expected customer(custno, custname, address, payterm) and product(prodcode, description, unit) columns';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'customer'
          AND column_name = 'status'
    ) THEN
        customer_active_predicate := 'status = ''Active''';
    ELSIF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'customer'
          AND column_name = 'is_deleted'
    ) THEN
        customer_active_predicate := 'NOT is_deleted';
    ELSE
        RAISE EXCEPTION
            'S2-DBA-01 requires customer.status or the legacy customer.is_deleted column';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'product'
          AND column_name = 'status'
    ) THEN
        product_active_predicate := 'status = ''Active''';
    ELSIF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'product'
          AND column_name = 'is_deleted'
    ) THEN
        product_active_predicate := 'NOT is_deleted';
    ELSE
        RAISE EXCEPTION
            'S2-DBA-01 requires product.status or the legacy product.is_deleted column';
    END IF;

    -- Exclude status/is_deleted and stamp so these read views expose only
    -- customer business fields to callers that need active records.
    EXECUTE format(
        'CREATE VIEW public.v_active_customers AS
         SELECT custno, custname, address, payterm
         FROM public.customer
         WHERE %s',
        customer_active_predicate
    );
    EXECUTE format(
        'CREATE VIEW public.v_active_products AS
         SELECT prodcode, description, unit
         FROM public.product
         WHERE %s',
        product_active_predicate
    );

    -- Primary keys already index customer/product identifiers; these
    -- partial expression indexes support case-insensitive name/description
    -- prefix searches while excluding inactive rows.
    EXECUTE format(
        'CREATE INDEX idx_customer_active_custname
         ON public.customer (lower(custname) text_pattern_ops)
         WHERE %s',
        customer_active_predicate
    );
    EXECUTE format(
        'CREATE INDEX idx_product_active_description
         ON public.product (lower(description) text_pattern_ops)
         WHERE %s',
        product_active_predicate
    );
END;
$migration$;

COMMENT ON VIEW public.v_active_customers IS
    'Customer business columns for active rows only; excludes status/deletion metadata and stamp.';
COMMENT ON VIEW public.v_active_products IS
    'Product business columns for active rows only; excludes status/deletion metadata and stamp.';
COMMENT ON INDEX public.idx_customer_active_custname IS
    'Partial case-insensitive prefix-search index for active customer names.';
COMMENT ON INDEX public.idx_product_active_description IS
    'Partial case-insensitive prefix-search index for active product descriptions.';
