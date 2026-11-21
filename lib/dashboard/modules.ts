import type { RightsModuleCode } from "@/lib/user-management/rights";

export const DASHBOARD_MODULES: {
  code: RightsModuleCode;
  name: string;
  href: string;
  description: string;
  icon: string;
  color: string;
}[] = [
  { code: "CUSTOMER", name: "Customers", href: "/customers", description: "Customer information and account operations.", icon: "CU", color: "green" },
  { code: "PRODUCT", name: "Products", href: "/products", description: "Product information and pricing operations.", icon: "PR", color: "teal" },
  { code: "HR", name: "Human Resources", href: "/human-resources", description: "Employee, department, job and job history operations.", icon: "HR", color: "pink" },
  { code: "SALES", name: "Sales", href: "/sales", description: "Sales transactions and sales detail operations.", icon: "SA", color: "lilac" },
  { code: "REPORTS", name: "Reports", href: "/reports", description: "Customer, product, employee and sales reporting.", icon: "RE", color: "slate" },
];
