import { NextResponse } from "next/server";
import { isDesktopMode } from "@/lib/core/desktop";
import pkg from "../../../package.json";

// Public capability flag: lets client chrome (nav gate, ontology shell)
// render the desktop workspace UI when the Electron shell sets
// MONAD_DESKTOP=1. Reads no organization data. Forced dynamic: the flag is
// runtime server env, so prerendering would bake in the build-time value.
// The running code version lets the UI offer updates without new deploys.
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ desktop: isDesktopMode(), version: pkg.version as string });
}
