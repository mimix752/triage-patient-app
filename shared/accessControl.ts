export type PatientEntryLink = {
  token: string;
  isActive: boolean;
  expiresAt: string | number | Date | null;
};

export const LOCAL_ADMIN_EMAILS = [
  "marouaidomar1@gmail.com",
  "bellaouhammousalma@gmail.com",
  "mariamessaber20@gmail.com",
] as const;

export const LOCAL_ADMIN_PASSWORD = "1234";
export const LOCAL_ADMIN_EMAIL_STORAGE_KEY = "triage_local_admin_email";
export const LOCAL_ADMIN_PASSWORD_STORAGE_KEY = "triage_local_admin_password";

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isAllowedLocalAdminEmail(value: string) {
  const email = normalizeEmail(value);
  return LOCAL_ADMIN_EMAILS.includes(email as (typeof LOCAL_ADMIN_EMAILS)[number]);
}

export function isAuthorizedLocalAdminCredentials(params: {
  email: string;
  password: string;
}) {
  return isAllowedLocalAdminEmail(params.email) && params.password === LOCAL_ADMIN_PASSWORD;
}

export function buildLocalAdminOpenId(email: string) {
  return `local-admin:${normalizeEmail(email)}`;
}

export function isAuthorizedStaffAccess(params: {
  expectedAdminEmail: string;
  userEmail?: string | null;
  userRole?: string | null;
}) {
  const expectedAdminEmail = normalizeEmail(params.expectedAdminEmail || "");
  const userEmail = normalizeEmail(params.userEmail || "");

  return Boolean(params.userRole === "admin" && expectedAdminEmail && userEmail === expectedAdminEmail);
}

export function pickActivePatientEntryLink<T extends PatientEntryLink>(links: T[], now = Date.now()) {
  return (
    links.find((link) => {
      const expiresAt = link.expiresAt ? new Date(link.expiresAt).getTime() : null;
      return link.isActive && (!expiresAt || expiresAt > now);
    }) ?? null
  );
}
