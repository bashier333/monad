import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const config = [
  { ignores: [".next/**", "node_modules/**", "dist/**", "generated/**", "prisma/migrations/**", "var/**", "coverage/**", "k6/**", "next-env.d.ts"] },
  ...compat.config({ extends: ["next/core-web-vitals", "next/typescript"] }),
  { files: ["electron/**/*.cjs"], rules: { "@typescript-eslint/no-require-imports": "off" } },
];

export default config;
