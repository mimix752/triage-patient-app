import { describe, expect, it } from "vitest";
import {
  buildLocalAdminOpenId,
  isAllowedLocalAdminEmail,
  isAuthorizedLocalAdminCredentials,
  normalizeEmail,
} from "./accessControl";

describe("local admin access control", () => {
  it("autorise salma@gmail.com avec le mot de passe local configuré", () => {
    expect(
      isAuthorizedLocalAdminCredentials({
        email: "salma@gmail.com",
        password: "1234",
      }),
    ).toBe(true);
  });

  it("normalise l’email avant de vérifier la liste blanche locale", () => {
    expect(isAllowedLocalAdminEmail(normalizeEmail("  Salma@Gmail.com  "))).toBe(true);
  });

  it("construit un openId local cohérent pour l’utilisateur staff", () => {
    expect(buildLocalAdminOpenId("Salma@Gmail.com")).toBe("local-admin:salma@gmail.com");
  });
});
