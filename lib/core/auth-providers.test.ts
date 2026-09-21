import { describe, expect, it } from "vitest";
import { configuredProviders } from "./auth-providers";

const base = {
  AUTH_GITHUB_ID: "",
  AUTH_GITHUB_SECRET: "",
  AUTH_GOOGLE_ID: "",
  AUTH_GOOGLE_SECRET: "",
  AUTH_RESEND_KEY: "",
};

describe("configuredProviders", () => {
  it("all off with empty env", () => {
    expect(configuredProviders(base)).toEqual({ github: false, google: false, email: false });
  });

  it("github on only when id + secret both set", () => {
    expect(configuredProviders({ ...base, AUTH_GITHUB_ID: "id" })).toEqual({
      github: false,
      google: false,
      email: false,
    });
    expect(configuredProviders({ ...base, AUTH_GITHUB_ID: "id", AUTH_GITHUB_SECRET: "s" }).github).toBe(true);
  });

  it("google and email independent", () => {
    const flags = configuredProviders({
      ...base,
      AUTH_GOOGLE_ID: "id",
      AUTH_GOOGLE_SECRET: "s",
      AUTH_RESEND_KEY: "key",
    });
    expect(flags).toEqual({ github: false, google: true, email: true });
  });
});
