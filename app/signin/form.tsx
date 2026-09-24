"use client";

import { signIn } from "next-auth/react";
import { useState, type FormEvent } from "react";
import type { ProviderFlags } from "@/lib/core/auth-providers";

function GitHubMark() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

const ERRORS: Record<string, string> = {
  OAuthSignin: "Could not start sign-in. Try again.",
  OAuthCallback: "Sign-in failed at the provider. Try again.",
  OAuthAccountNotLinked:
    "This email already signed in with a different provider. Use the original one, then link GitHub from settings.",
  EmailSignin: "Could not send the magic link. Check the address and try again.",
  Verification: "That link expired or was already used. Request a fresh one.",
  AccessDenied: "Sign-in was not allowed for this account.",
  Configuration: "Sign-in is not configured on this server yet.",
};

export default function SignInForm({
  flags,
  callbackUrl,
  error,
}: {
  flags: ProviderFlags;
  callbackUrl: string;
  error: string | null;
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [mailSent, setMailSent] = useState(false);
  async function sendMagicLink(e: FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) return;
    setBusy("email");
    setClientError(null);
    setMailSent(false);
    try {
      const res = (await signIn("resend", { email, callbackUrl, redirect: false })) as unknown as
        | { error?: string; url?: string | null }
        | undefined;
      if (res?.error) {
        setClientError(ERRORS[res.error] ?? `Could not send the magic link (${res.error}).`);
      } else {
        setMailSent(true);
      }
    } catch {
      setClientError("Could not send the magic link. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }
  const nothing = !flags.github && !flags.google && !flags.email;

  async function startOAuth(provider: "github" | "google") {
    setBusy(provider);
    setClientError(null);
    try {
      // On success this navigates away to the provider. Anything that
      // resolves back here (a returned error, or a throw) means the
      // handshake never started — surface it instead of looping silently.
      const res = (await signIn(provider, { callbackUrl })) as unknown as
        | { error?: string; url?: string | null }
        | undefined;
      if (res?.error) {
        setClientError(ERRORS[res.error] ?? `Could not start ${provider} sign-in (${res.error}).`);
      } else if (res && res.url == null) {
        setClientError(`Could not reach the sign-in server. Check your connection and try again.`);
      }
    } catch (e) {
      setClientError(
        `Could not start ${provider} sign-in in this browser (${e instanceof Error ? e.message : "network error"}). Try incognito / another browser.`,
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p role="alert" className="rounded-md border p-3 text-sm" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>
          {ERRORS[error] ?? "Sign-in failed. Try again."}
        </p>
      ) : null}
      {clientError ? (
        <p role="alert" className="rounded-md border p-3 text-sm" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>
          {clientError}
        </p>
      ) : null}
      {nothing ? (
        <p role="alert" className="rounded-md border p-3 text-sm ds-text-2" style={{ borderColor: "var(--hairline)" }}>
          No sign-in provider is configured on this server yet. Add AUTH_GITHUB_ID and AUTH_GITHUB_SECRET (or Google / Resend keys) to the environment and restart.
        </p>
      ) : null}
      {flags.github ? (
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => {
            void startOAuth("github");
          }}
          className="flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          style={{ background: "#24292f" }}
        >
          <GitHubMark />
          {busy === "github" ? "Opening GitHub…" : "Continue with GitHub"}
        </button>
      ) : null}
      {flags.google ? (
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => {
            void startOAuth("google");
          }}
          className="ds-state flex w-full items-center justify-center gap-2 rounded-md border px-4 py-2.5 text-sm font-medium ds-text disabled:opacity-50"
          style={{ borderColor: "var(--hairline)", background: "var(--panel)" }}
        >
          {busy === "google" ? "Opening Google…" : "Continue with Google"}
        </button>
      ) : null}
      {flags.email ? (
        <form
          className="space-y-2 rounded-md border p-3"
          style={{ borderColor: "var(--hairline)" }}
          onSubmit={(e) => {
            void sendMagicLink(e);
          }}
        >
          <label htmlFor="signin-email" className="text-sm font-medium ds-text">
            Email magic link
          </label>
          <input
            id="signin-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
            className="w-full rounded-md border px-3 py-2 text-sm ds-text"
            style={{ borderColor: "var(--hairline)", background: "var(--ground)" }}
          />
          <button
            type="submit"
            disabled={busy !== null}
            className="w-full rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            style={{ background: "var(--accent)" }}
          >
            {busy === "email" ? "Sending…" : "Email me a link"}
          </button>
          {mailSent && (
            <p role="status" className="text-sm ds-text-2">
              Link sent. Check your inbox, then click it to sign in.
            </p>
          )}
        </form>
      ) : null}
    </div>
  );
}
