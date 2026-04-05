import { describe, expect, it } from "vitest";
import { resolvePublicOrigin } from "./publicOrigin";

describe("resolvePublicOrigin", () => {
  it("conserve une origine déjà publique", () => {
    const origin = resolvePublicOrigin({
      currentOrigin: "https://3000-demo.manus.computer",
      referrer: "https://app.manus.im/session/123",
    });

    expect(origin).toBe("https://3000-demo.manus.computer");
  });

  it("préfère une origine ancêtre publique lorsque l’origine courante est locale", () => {
    const origin = resolvePublicOrigin({
      currentOrigin: "http://127.0.0.1:3000",
      ancestorOrigins: ["https://3000-demo.manus.computer"],
      referrer: "https://app.manus.im/session/123",
    });

    expect(origin).toBe("https://3000-demo.manus.computer");
  });

  it("retombe sur le referrer public lorsque l’origine courante est locale", () => {
    const origin = resolvePublicOrigin({
      currentOrigin: "http://127.0.0.1:3000",
      referrer: "https://app.manus.im/projects/triage-patient-app",
    });

    expect(origin).toBe("https://app.manus.im");
  });

  it("ignore les referrers locaux et retourne l’origine courante en dernier recours", () => {
    const origin = resolvePublicOrigin({
      currentOrigin: "http://127.0.0.1:3000",
      referrer: "http://localhost:5173/some-preview",
    });

    expect(origin).toBe("http://127.0.0.1:3000");
  });
});
