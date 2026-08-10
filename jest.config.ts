import type { Config } from "jest";

const transform: Config["transform"] = {
  // .mjs muss mit: lib/csp-directives.mjs teilen sich next.config.mjs und proxy.ts.
  "^.+\\.m?[tj]sx?$": ["babel-jest", {
    presets: [
      ["@babel/preset-env", { targets: { node: "current" } }],
      ["@babel/preset-react", { runtime: "automatic" }],
      "@babel/preset-typescript",
    ],
  }],
};

const moduleNameMapper: Config["moduleNameMapper"] = {
  "^@/(.*)$": "<rootDir>/$1",
  "react-datepicker/dist/react-datepicker.css": "<rootDir>/__mocks__/react-datepicker.css",
  "react-pdf/dist/Page/AnnotationLayer.css": "<rootDir>/__mocks__/react-datepicker.css",
  "react-pdf/dist/Page/TextLayer.css": "<rootDir>/__mocks__/react-datepicker.css",
};

const sharedProjectConfig = {
  transform,
  moduleNameMapper,
  modulePathIgnorePatterns: ["<rootDir>/.next/"],
  transformIgnorePatterns: ["node_modules/(?!(@prisma/client)/)"],
} as const;

// Zwei Schichten mit bewusst unterschiedlichen Regeln (ADR 0010):
// "unit" behält jsdom + globale Mocks (jest.setup.js), "integration" läuft im
// node-Environment gegen eine echte, frisch migrierte SQLite je Testdatei.
const config: Config = {
  coverageProvider: "v8",
  maxWorkers: "50%",
  // Ohne diese Liste zählt der v8-Provider nur zur Laufzeit geladene Dateien:
  // nie importierte Module blieben für die Schwellen unsichtbar.
  collectCoverageFrom: [
    "app/**/*.{ts,tsx}",
    "lib/**/*.{ts,tsx,mjs}",
    "components/**/*.{ts,tsx}",
    "!**/*.d.ts",
    "!app/**/layout.tsx",
    "!lib/generated/**",
  ],
  projects: [
    {
      ...sharedProjectConfig,
      displayName: "unit",
      testEnvironment: "jsdom",
      setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
      testTimeout: 20000,
      testPathIgnorePatterns: [
        "<rootDir>/__tests__/helpers/",
        "<rootDir>/__tests__/integration/",
        "<rootDir>/e2e/",
      ],
    },
    {
      ...sharedProjectConfig,
      displayName: "integration",
      testEnvironment: "node",
      testMatch: ["<rootDir>/__tests__/integration/**/*.test.{ts,tsx}"],
      setupFiles: ["<rootDir>/__tests__/integration/setup/integration-env.ts"],
      setupFilesAfterEnv: ["<rootDir>/__tests__/integration/setup/integration-setup.ts"],
      testTimeout: 30000,
      testPathIgnorePatterns: [
        "<rootDir>/__tests__/integration/helpers/",
        "<rootDir>/__tests__/integration/setup/",
      ],
    },
  ],
  // Ist-Stand der Gesamtcodebasis (siehe collectCoverageFrom). Die früheren
  // 80/70/70/80 galten nur für die von Tests geladenen Dateien und ließen
  // ungetestete Module unsichtbar; die Zahlen hier sind kleiner, die Messbasis
  // dafür vollständig. Nur anheben, nie senken.
  coverageThreshold: {
    global: {
      lines: 72,
      functions: 74,
      branches: 80,
      statements: 72,
    },
  },
};

export default config;
