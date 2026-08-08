// app/sw.js/route.ts
//
// Serves the service worker script from the filesystem (public/sw.js) at
// runtime instead of relying on static-file serving. This route handler
// takes precedence over the public file, so it returns 200 even when
// static-file serving is broken (e.g. the 400 errors on www.vibroets.com).
//
// Unlike the manifest route handler, the SW is read from the filesystem at
// runtime because next-pwa generates/regenerates public/sw.js DURING
// `next build` — embedding it before build would capture a stale version.

import { readFileSync } from "fs";
import { join } from "path";

export const dynamic = "force-static";
export const revalidate = false;
export const runtime = "nodejs";

export async function GET() {
  const swPath = join(process.cwd(), "public", "sw.js");
  const swContent = readFileSync(swPath, "utf8");
  return new Response(swContent, {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Service-Worker-Allowed": "/",
    },
  });
}
