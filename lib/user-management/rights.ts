export const RIGHTS_MODULE_CODES = [
  "CUSTOMER",
  "PRODUCT",
  "HR",
  "SALES",
  "REPORTS",
] as const;

export type RightsModuleCode = (typeof RIGHTS_MODULE_CODES)[number];

const RIGHTS_MODULE_COUNTS: Record<RightsModuleCode, number> = {
  CUSTOMER: 3,
  PRODUCT: 6,
  HR: 13,
  SALES: 7,
  REPORTS: 7,
};

export type RightsModule = {
  code: RightsModuleCode;
  name: string;
  rights: { id: number; label: string }[];
};

export type RightsResponse = {
  modules: RightsModule[];
  selected: number[];
  readOnly: boolean;
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isRightId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export function isIdList(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.every(isRightId) &&
    new Set(value).size === value.length
  );
}

export function isRightsModuleCode(value: unknown): value is RightsModuleCode {
  return typeof value === "string" &&
    RIGHTS_MODULE_CODES.some((code) => code === value);
}

export function hasExpectedRightsCounts(modules: RightsModule[]): boolean {
  return modules.length === RIGHTS_MODULE_CODES.length &&
    new Set(modules.map((module) => module.code)).size === RIGHTS_MODULE_CODES.length &&
    modules.every((module) => module.rights.length === RIGHTS_MODULE_COUNTS[module.code]);
}

function isRightsModule(value: unknown): value is RightsModule {
  return isRecord(value) &&
    isRightsModuleCode(value.code) &&
    typeof value.name === "string" &&
    Array.isArray(value.rights) &&
    value.rights.length > 0 &&
    value.rights.every((right: unknown) =>
      isRecord(right) && isRightId(right.id) &&
      typeof right.label === "string" && right.label.trim().length > 0,
    );
}

export function isRightsResponse(value: unknown): value is RightsResponse {
  if (!isRecord(value) || !Array.isArray(value.modules) ||
      !isIdList(value.selected) || typeof value.readOnly !== "boolean") {
    return false;
  }
  if (!value.modules.every(isRightsModule) || !hasExpectedRightsCounts(value.modules)) {
    return false;
  }
  const ids = value.modules.flatMap((module) => module.rights.map((right) => right.id));
  return new Set(ids).size === ids.length &&
    value.selected.every((id) => ids.includes(id)) &&
    (!value.readOnly || value.selected.length === ids.length);
}
