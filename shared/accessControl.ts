export type PatientEntryLink = {
  token: string;
  isActive: boolean;
  expiresAt: string | number | Date | null;
};

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isAuthorizedStaffAccess(params: {
  isAuthenticated: boolean;
  expectedAdminEmail: string;
  userEmail?: string | null;
  userRole?: string | null;
}) {
  const expectedAdminEmail = normalizeEmail(params.expectedAdminEmail || "");
  const userEmail = normalizeEmail(params.userEmail || "");

  return Boolean(
    params.isAuthenticated &&
      params.userRole === "admin" &&
      expectedAdminEmail &&
      userEmail === expectedAdminEmail,
  );
}

export function pickActivePatientEntryLink<T extends PatientEntryLink>(links: T[], now = Date.now()) {
  return links.find((link) => {
    const expiresAt = link.expiresAt ? new Date(link.expiresAt).getTime() : null;
    return link.isActive && (!expiresAt || expiresAt > now);
  }) ?? null;
}
