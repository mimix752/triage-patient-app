import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./_core/env", () => ({
  ENV: {
    appId: "",
    cookieSecret: "",
    databaseUrl: "",
    oAuthServerUrl: "",
    ownerOpenId: "",
    isProduction: false,
    forgeApiUrl: "https://forge.example.test",
    forgeApiKey: "test-key",
  },
}));

describe("invokeLLM", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("utilise le modèle explicitement fourni quand il est précisé", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "resp_1",
        created: Date.now(),
        model: "gemini-2.5-pro",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "{}" },
            finish_reason: "stop",
          },
        ],
      }),
    } as Response);

    const { invokeLLM } = await import("./_core/llm");

    await invokeLLM({
      model: "gemini-2.5-pro",
      messages: [{ role: "user", content: "Analyse cette image." }],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = fetchMock.mock.calls[0]?.[1];
    expect(request).toBeDefined();
    const payload = JSON.parse(String(request?.body));
    expect(payload.model).toBe("gemini-2.5-pro");
  });

  it("conserve le modèle par défaut quand aucun modèle n’est fourni", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "resp_2",
        created: Date.now(),
        model: "gemini-2.5-flash",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "{}" },
            finish_reason: "stop",
          },
        ],
      }),
    } as Response);

    const { invokeLLM } = await import("./_core/llm");

    await invokeLLM({
      messages: [{ role: "user", content: "Bonjour" }],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = fetchMock.mock.calls[0]?.[1];
    expect(request).toBeDefined();
    const payload = JSON.parse(String(request?.body));
    expect(payload.model).toBe("gemini-2.5-flash");
  });
});
