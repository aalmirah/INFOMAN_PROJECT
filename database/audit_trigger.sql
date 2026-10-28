--------------------------------------------------------------------
-- 1) Audit log table
--------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
    audit_id        BIGSERIAL PRIMARY KEY,
    table_name      TEXT NOT NULL,
    action_type     TEXT NOT NULL CHECK (action_type IN ('INSERT', 'UPDATE', 'DELETE')),
    user_name       TEXT NOT NULL,
    action_time     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    old_values      JSONB,
    new_values      JSONB
);

--------------------------------------------------------------------
-- 2) Trigger function
--    Uses app.user if set; otherwise falls back to current_user
--------------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit_user()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (table_name, action_type, user_name, action_time, old_values, new_values)
        VALUES (
            TG_TABLE_NAME,
            TG_OP,
            COALESCE(current_setting('app.user', true), current_user),
            NOW(),
            NULL,
            to_jsonb(NEW)
        );
        RETURN NEW;

    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_log (table_name, action_type, user_name, action_time, old_values, new_values)
        VALUES (
            TG_TABLE_NAME,
            TG_OP,
            COALESCE(current_setting('app.user', true), current_user),
            NOW(),
            to_jsonb(OLD),
            to_jsonb(NEW)
        );
        RETURN NEW;

    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (table_name, action_type, user_name, action_time, old_values, new_values)
        VALUES (
            TG_TABLE_NAME,
            TG_OP,
            COALESCE(current_setting('app.user', true), current_user),
            NOW(),
            to_jsonb(OLD),
            NULL
        );
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

--------------------------------------------------------------------
-- 3) Example table to audit
--------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS employee (
    employee_id SERIAL PRIMARY KEY,
    first_name  TEXT NOT NULL,
    last_name   TEXT NOT NULL,
    salary      NUMERIC(12,2) NOT NULL DEFAULT 0
);

--------------------------------------------------------------------
-- 4) Attach trigger to table
--------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_employee_audit ON employee;
CREATE TRIGGER trg_employee_audit
AFTER INSERT OR UPDATE OF first_name, last_name, salary OR DELETE
ON employee
FOR EACH ROW
EXECUTE FUNCTION audit_user();

--------------------------------------------------------------------
-- 5) Test script
--------------------------------------------------------------------
-- Optional: set application user context
SET app.user = 'db_admin';

-- Insert
INSERT INTO employee (first_name, last_name, salary)
VALUES ('John', 'Doe', 50000.00);

-- Update
UPDATE employee
SET salary = 55000.00
WHERE employee_id = 1;

-- Delete
DELETE FROM employee
WHERE employee_id = 1;

-- View audit log
SELECT *
FROM audit_log
ORDER BY action_time;

-- Clean up if needed:
-- TRUNCATE audit_log;
-- TRUNCATE employee;