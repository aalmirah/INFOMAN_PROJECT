CREATE TABLE employee (
  empno varchar(5) PRIMARY KEY,
  lastname varchar(15) NOT NULL,
  firstname varchar(15) NOT NULL,
  gender char(1) CHECK (gender IN ('M', 'F')),
  birthdate date,
  hiredate date NOT NULL,
  sepdate date,
  status varchar(8) NOT NULL DEFAULT 'Active'
    CONSTRAINT employee_status_check CHECK (status IN ('Active', 'Inactive')),
  stamp varchar(80) NOT NULL DEFAULT (
    'CREATED system ' ||
    to_char(clock_timestamp() AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD HH12:MI AM')
  ),
  CONSTRAINT employee_separation_date_check
    CHECK (sepdate IS NULL OR sepdate >= hiredate)
);

COMMENT ON COLUMN employee.sepdate IS
  'Date the employee left the company; this is separate from status, which marks a record as Active or Inactive.';
COMMENT ON COLUMN employee.status IS
  'Record state (soft deletion); this is separate from sepdate, which records when the employee left the company.';

CREATE TABLE job (
  jobcode varchar(5) PRIMARY KEY,
  jobdesc varchar(20) NOT NULL,
  status varchar(8) NOT NULL DEFAULT 'Active'
    CONSTRAINT job_status_check CHECK (status IN ('Active', 'Inactive')),
  stamp varchar(80) NOT NULL DEFAULT (
    'CREATED system ' ||
    to_char(clock_timestamp() AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD HH12:MI AM')
  )
);

CREATE TABLE department (
  deptcode varchar(5) PRIMARY KEY,
  deptname varchar(20) NOT NULL,
  status varchar(8) NOT NULL DEFAULT 'Active'
    CONSTRAINT department_status_check CHECK (status IN ('Active', 'Inactive')),
  stamp varchar(80) NOT NULL DEFAULT (
    'CREATED system ' ||
    to_char(clock_timestamp() AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD HH12:MI AM')
  )
);

CREATE TABLE jobhistory (
  empno varchar(5) NOT NULL,
  jobcode varchar(5) NOT NULL,
  effdate date NOT NULL,
  salary numeric(10, 2) NOT NULL CHECK (salary >= 0),
  deptcode varchar(5) NOT NULL,
  status varchar(8) NOT NULL DEFAULT 'Active'
    CONSTRAINT jobhistory_status_check CHECK (status IN ('Active', 'Inactive')),
  stamp varchar(80) NOT NULL DEFAULT (
    'CREATED system ' ||
    to_char(clock_timestamp() AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD HH12:MI AM')
  ),
  PRIMARY KEY (empno, jobcode, effdate),
  CONSTRAINT jobhistory_employee_fk FOREIGN KEY (empno)
    REFERENCES employee (empno) ON DELETE RESTRICT,
  CONSTRAINT jobhistory_job_fk FOREIGN KEY (jobcode)
    REFERENCES job (jobcode) ON DELETE RESTRICT,
  CONSTRAINT jobhistory_department_fk FOREIGN KEY (deptcode)
    REFERENCES department (deptcode) ON DELETE RESTRICT
);

CREATE TABLE customer (
  custno varchar(5) PRIMARY KEY,
  custname varchar(30) NOT NULL,
  address varchar(50) NOT NULL,
  payterm varchar(3) NOT NULL CHECK (payterm IN ('COD', '30D', '45D')),
  status varchar(8) NOT NULL DEFAULT 'Active'
    CONSTRAINT customer_status_check CHECK (status IN ('Active', 'Inactive')),
  stamp varchar(80) NOT NULL DEFAULT (
    'CREATED system ' ||
    to_char(clock_timestamp() AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD HH12:MI AM')
  )
);

CREATE TABLE product (
  prodcode varchar(6) PRIMARY KEY,
  description varchar(30) NOT NULL,
  unit varchar(3) NOT NULL CHECK (unit IN ('pc', 'ea', 'mtr', 'pkg', 'ltr')),
  status varchar(8) NOT NULL DEFAULT 'Active'
    CONSTRAINT product_status_check CHECK (status IN ('Active', 'Inactive')),
  stamp varchar(80) NOT NULL DEFAULT (
    'CREATED system ' ||
    to_char(clock_timestamp() AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD HH12:MI AM')
  )
);

CREATE TABLE pricehist (
  effdate date NOT NULL,
  prodcode varchar(6) NOT NULL,
  unitprice numeric(10, 2) NOT NULL CHECK (unitprice >= 0),
  status varchar(8) NOT NULL DEFAULT 'Active'
    CONSTRAINT pricehist_status_check CHECK (status IN ('Active', 'Inactive')),
  stamp varchar(80) NOT NULL DEFAULT (
    'CREATED system ' ||
    to_char(clock_timestamp() AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD HH12:MI AM')
  ),
  PRIMARY KEY (effdate, prodcode),
  CONSTRAINT pricehist_product_fk FOREIGN KEY (prodcode)
    REFERENCES product (prodcode) ON DELETE RESTRICT
);

CREATE TABLE sales (
  transno varchar(8) PRIMARY KEY,
  salesdate date NOT NULL,
  custno varchar(5) NOT NULL,
  empno varchar(5) NOT NULL,
  status varchar(8) NOT NULL DEFAULT 'Active'
    CONSTRAINT sales_status_check CHECK (status IN ('Active', 'Inactive')),
  stamp varchar(80) NOT NULL DEFAULT (
    'CREATED system ' ||
    to_char(clock_timestamp() AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD HH12:MI AM')
  ),
  CONSTRAINT sales_customer_fk FOREIGN KEY (custno)
    REFERENCES customer (custno) ON DELETE RESTRICT,
  CONSTRAINT sales_employee_fk FOREIGN KEY (empno)
    REFERENCES employee (empno) ON DELETE RESTRICT
);

CREATE TABLE salesdetail (
  transno varchar(8) NOT NULL,
  prodcode varchar(6) NOT NULL,
  quantity numeric(10, 2) NOT NULL CHECK (quantity > 0),
  status varchar(8) NOT NULL DEFAULT 'Active'
    CONSTRAINT salesdetail_status_check CHECK (status IN ('Active', 'Inactive')),
  stamp varchar(80) NOT NULL DEFAULT (
    'CREATED system ' ||
    to_char(clock_timestamp() AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD HH12:MI AM')
  ),
  PRIMARY KEY (transno, prodcode),
  CONSTRAINT salesdetail_sales_fk FOREIGN KEY (transno)
    REFERENCES sales (transno) ON DELETE RESTRICT,
  CONSTRAINT salesdetail_product_fk FOREIGN KEY (prodcode)
    REFERENCES product (prodcode) ON DELETE RESTRICT
);

CREATE TABLE payment (
  orno varchar(8) PRIMARY KEY,
  paydate date NOT NULL,
  amount numeric(10, 2) NOT NULL CHECK (amount > 0),
  transno varchar(8) NOT NULL,
  status varchar(8) NOT NULL DEFAULT 'Active'
    CONSTRAINT payment_status_check CHECK (status IN ('Active', 'Inactive')),
  stamp varchar(80) NOT NULL DEFAULT (
    'CREATED system ' ||
    to_char(clock_timestamp() AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD HH12:MI AM')
  ),
  CONSTRAINT payment_sales_fk FOREIGN KEY (transno)
    REFERENCES sales (transno) ON DELETE RESTRICT
);

CREATE INDEX employee_status_idx ON employee (status);
CREATE INDEX job_status_idx ON job (status);
CREATE INDEX department_status_idx ON department (status);
CREATE INDEX jobhistory_status_idx ON jobhistory (status);
CREATE INDEX jobhistory_empno_idx ON jobhistory (empno);
CREATE INDEX jobhistory_jobcode_idx ON jobhistory (jobcode);
CREATE INDEX jobhistory_deptcode_idx ON jobhistory (deptcode);
CREATE INDEX customer_status_idx ON customer (status);
CREATE INDEX product_status_idx ON product (status);
CREATE INDEX pricehist_status_idx ON pricehist (status);
CREATE INDEX pricehist_product_effdate_idx ON pricehist (prodcode, effdate DESC);
CREATE INDEX sales_status_idx ON sales (status);
CREATE INDEX sales_custno_idx ON sales (custno);
CREATE INDEX sales_empno_idx ON sales (empno);
CREATE INDEX salesdetail_status_idx ON salesdetail (status);
CREATE INDEX salesdetail_transno_idx ON salesdetail (transno);
CREATE INDEX salesdetail_prodcode_idx ON salesdetail (prodcode);
CREATE INDEX payment_status_idx ON payment (status);
CREATE INDEX payment_transno_idx ON payment (transno);
