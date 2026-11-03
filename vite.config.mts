import { defineConfig } from "vite-plus";

// Vite+ handles linting (Oxlint), formatting (Oxfmt), tests (Vitest) and
// staged-file checks. Next.js still builds the app with Turbopack.
export default defineConfig({
  lint: {
    ignorePatterns: [".next/**", "node_modules/**", "data/**", "src/components/ui/**"],
    plugins: ["typescript", "react", "nextjs", "unicorn", "oxc", "import"],
    options: {
      typeAware: true,
      typeCheck: true,
    },
    rules: {
      "no-console": "off",
      "nextjs/no-img-element": "off",
      "react/react-in-jsx-scope": "off",
    },
  },
  fmt: {
    ignorePatterns: [
      ".next/**",
      "node_modules/**",
      "data/**",
      "src/components/ui/**",
      "package-lock.json",
    ],
    printWidth: 100,
    sortPackageJson: true,
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
  staged: {
    "*.{ts,tsx,js,mjs,json,css,md}": "vp check --fix",
  },
});
