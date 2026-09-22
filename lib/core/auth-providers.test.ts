import { describe, expect, it } from "vitest";
import { configuredProviders, resolvePostLoginRedirect } from "./auth-providers";

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

describe("resolvePostLoginRedirect", () => {
  const baseUrl = "http://localhost:3020";
  it("sends bare-origin callbacks to the workspace, never the landing page", () => {
    expect(resolvePostLoginRedirect(baseUrl, baseUrl)).toBe(`${baseUrl}/workspace`);
    expect(resolvePostLoginRedirect(`${baseUrl}/`, baseUrl)).toBe(`${baseUrl}/workspace`);
    expect(resolvePostLoginRedirect("/", baseUrl)).toBe(`${baseUrl}/workspace`);
  });

  it("passes relative and same-origin targets through", () => {
    expect(resolvePostLoginRedirect("/upload", baseUrl)).toBe(`${baseUrl}/upload`);
    expect(resolvePostLoginRedirect(`${baseUrl}/briefs`, baseUrl)).toBe(`${baseUrl}/briefs`);
  });

  it("falls back to the workspace for cross-origin targets", () => {
    expect(resolvePostLoginRedirect("https://evil.example/x", baseUrl)).toBe(`${baseUrl}/workspace`);
  });
});
