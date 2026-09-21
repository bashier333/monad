import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/core/auth";
import { configuredProviders } from "@/lib/core/auth-providers";
import { getEnv } from "@/lib/core/env";
import SignInForm from "./form";

export const metadata = { title: "Sign in - Monad" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const session = await auth();
  const callbackUrl = sp.callbackUrl ?? "/workspace";
  if (session?.user?.id) redirect(callbackUrl);
  const flags = configuredProviders(getEnv());

  return (
    <main className="mx-auto max-w-sm space-y-5 p-4 md:p-8">
      <div className="flex items-center gap-2">
        <span aria-hidden className="inline-block h-6 w-6 rounded-[6px]" style={{ background: "var(--accent)" }} />
        <p className="text-lg font-semibold tracking-tight ds-text">Monad</p>
      </div>
      <div>
        <h1 className="text-xl font-semibold tracking-tight ds-text">Sign in</h1>
        <p className="mt-1 text-sm ds-text-2">One account for every workspace you belong to.</p>
      </div>
      <SignInForm flags={flags} callbackUrl={callbackUrl} error={sp.error ?? null} />
      <p className="text-xs ds-text-2">
        Trouble signing in? <Link href="/support" className="underline">Contact support</Link>
      </p>
    </main>
  );
}
