import js from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.expo/**",
      "**/coverage/**",
      "mobile/expo-env.d.ts",
      // JXA scripts (osascript -l JavaScript): use ObjC/$/run globals that
      // aren't part of any standard JS environment ESLint knows about.
      "**/*.jxa.js",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      // Zod schemas + ActionRegistry commonly declare types before use.
      "@typescript-eslint/no-use-before-define": "off",
    },
  },
  {
    files: ["**/*.tsx"],
    plugins: { react, "react-hooks": reactHooks },
    languageOptions: {
      globals: { window: "readonly", document: "readonly" },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "react/react-in-jsx-scope": "off", // automatic JSX runtime
      "react/prop-types": "off", // TypeScript covers this
      // These two are newer React-Compiler-alignment rules, stricter than
      // "rules of hooks" itself: they flag idiomatic, correct patterns we
      // rely on deliberately — fetching on mount inside an effect, and a
      // child component reading a ref for a lookup (documented at the call
      // site) rather than through prop drilling. Not bugs here.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
    },
    settings: { react: { version: "detect" } },
  },
  // Test files run under Vitest/Node globals, not the browser/RN runtime.
  {
    files: ["**/tests/**/*.ts", "**/*.test.ts", "**/*.test.tsx"],
    languageOptions: {
      globals: { process: "readonly", console: "readonly" },
    },
  },
  eslintConfigPrettier,
);
