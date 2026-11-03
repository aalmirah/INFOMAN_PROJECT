-- seed.sql
-- Add the project team to the employee/job history tables defined by schema.sql.
-- Run after schema.sql and users_rights.sql. Safe to re-run.
--
-- The employee schema does not store email addresses; team emails belong to
-- the users table created by users_rights.sql.

INSERT INTO department (deptcode, deptname) VALUES
  ('PRJ', 'Project Team')
ON CONFLICT (deptcode) DO NOTHING;

INSERT INTO job (jobcode, jobdesc) VALUES
  ('SCR', 'Scrum Master'),
  ('DEV', 'Developer'),
  ('UID', 'UI Designer'),
  ('TST', 'Tester'),
  ('DBA', 'Database Admin')
ON CONFLICT (jobcode) DO NOTHING;

INSERT INTO employee (empno, lastname, firstname, gender, birthdate, hiredate, sepdate)
VALUES
  ('00065', 'Abdul',           'Almirah',      NULL, NULL, CURRENT_DATE, NULL),
  ('00067', 'Guibang-guibang', 'Chelcee',      NULL, NULL, CURRENT_DATE, NULL),
  ('00069', 'Granada',         'Daniela Drew', NULL, NULL, CURRENT_DATE, NULL),
  ('00071', 'Penoliar',        'Miah Bless',   NULL, NULL, CURRENT_DATE, NULL),
  ('00073', 'Lagrada',         'Rich Anne',    NULL, NULL, CURRENT_DATE, NULL)
ON CONFLICT (empno) DO NOTHING;

INSERT INTO jobhistory (empno, jobcode, effdate, deptcode)
SELECT team.empno, team.jobcode, CURRENT_DATE, 'PRJ'
FROM (VALUES
  ('00065', 'SCR'),
  ('00067', 'DEV'),
  ('00069', 'UID'),
  ('00071', 'TST'),
  ('00073', 'DBA')
) AS team(empno, jobcode)
WHERE NOT EXISTS (
  SELECT 1
  FROM jobhistory history
  WHERE history.empno = team.empno
    AND history.jobcode = team.jobcode
);

INSERT INTO users (username, full_name, email)
SELECT team.username, team.full_name, team.email
FROM (VALUES
  ('scrum_master',   'Almirah Abdul',           'almirahabdul4@gmail.com'),
  ('developer',      'Chelcee Guibang-guibang', 'chelceeguibang3@gmail.com'),
  ('ui_designer',    'Daniela Drew Granada',    'granadadaniela56@gmail.com'),
  ('tester',         'Miah Bless Penoliar',     'miahblessp@gmail.com'),
  ('database_admin', 'Rich Anne Lagrada',       'rich.lagrada@gmail.com')
) AS team(username, full_name, email)
WHERE NOT EXISTS (
  SELECT 1
  FROM users existing
  WHERE existing.username = team.username
     OR existing.email = team.email
);
