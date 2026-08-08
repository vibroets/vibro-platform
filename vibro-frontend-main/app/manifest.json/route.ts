// app/manifest.json/route.ts
//
// Serves the PWA manifest from an embedded module (app/embedded-manifest.ts)
// instead of the static public/manifest.json file. This route handler takes
// precedence over the public file, so it returns 200 even when static-file
// serving is broken (e.g. the 400 errors on www.vibroets.com).
//
// The manifest JSON (with all icons inlined as data URIs) is generated at
// build time by scripts/generate-embedded-assets.mjs.

import { manifestJson } from "../embedded-manifest";

export const dynamic = "force-static";
export const revalidate = false;

export async function GET() {
  return new Response(manifestJson, {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
