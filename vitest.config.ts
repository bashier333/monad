import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, ".") } },
  test: {
    environment: "node",
    exclude: ["node_modules", "**/__gen_test__/**"],
    coverage: {
      provider: "v8",
      include: [
        "lib/core/ingest/columns.ts",
        "lib/core/ingest/validate.ts",
        "lib/core/ingest/merge.ts",
        "lib/core/ingest/parse.ts",
        "lib/core/ingest/scan.ts",
        "lib/core/ingest/presets.ts",
        "lib/core/ingest/adapters.ts",
        "lib/core/brief/summary.ts",
        "lib/core/brief/content.ts",
        "lib/core/corrections/rules.ts",
        "lib/core/corrections/apply.ts",
        "lib/core/rules/validate.ts",
        "lib/core/answers/nl.ts",
        "lib/packs/freight/margin/engine.ts",
        "lib/packs/freight/brief/build.ts",
        "lib/packs/freight/brief/variants.ts",
        "lib/packs/freight/csv.ts",
        "lib/packs/freight/nl.ts",
        "lib/packs/agency/engine.ts",
        "lib/packs/agency/brief/build.ts",
        "lib/packs/agency/brief/variants.ts",
        "lib/packs/agency/csv.ts",
        "lib/packs/agency/nl.ts",
        "lib/packs/agency/validate.ts",
        "lib/packs/agency/merge.ts",
      ],
      thresholds: { lines: 80, functions: 80 },
    },
  },
});
