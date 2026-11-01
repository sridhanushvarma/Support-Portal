import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Bundles the background worker into dist/worker.mjs so the production image
 * can run it with plain Node (no TypeScript tooling). Prisma and native
 * modules stay external and are resolved from node_modules.
 */
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

await build({
  entryPoints: [path.join(root, "scripts/worker.ts")],
  outfile: path.join(root, "dist/worker.mjs"),
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  sourcemap: true,
  // Prisma ships in the standalone node_modules; everything else (e.g. nodemailer) is bundled.
  external: ["@prisma/client", ".prisma/client", "sharp"],
  alias: { "@": path.join(root, "src"), "server-only": path.join(root, "tests/stubs/empty.ts") },
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
  logLevel: "warning",
});
console.log("Built dist/worker.mjs");
