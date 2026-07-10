import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [...nextCoreWebVitals, ...nextTypescript, {
  rules: {
    "@typescript-eslint/no-unused-vars": ["warn", {
      argsIgnorePattern: "^_",
      varsIgnorePattern: "^_",
    }],
    // False positive on the codebase's standard useCallback+AbortController fetch-on-effect
    // pattern (fetch fn is memoized and called via `void fetchX()`, not an inline setState).
    "react-hooks/set-state-in-effect": "off",
  },
}, {
  ignores: [
    "node_modules/**",
    ".next/**",
    "out/**",
    "build/**",
    "scripts-dist/**",
    "next-env.d.ts",
    "coverage/**",
    "public/pdf.worker.min.mjs",
  ]
}];

export default eslintConfig;
