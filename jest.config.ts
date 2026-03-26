import type { Config } from "jest";

const config: Config = {
  coverageProvider: "v8",
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  testTimeout: 20000,
  maxWorkers: "50%",
  transform: {
    "^.+\\.(t|j)sx?$": ["babel-jest", {
      presets: [
        ["@babel/preset-env", { targets: { node: "current" } }],
        ["@babel/preset-react", { runtime: "automatic" }],
        "@babel/preset-typescript",
      ],
    }],
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "react-datepicker/dist/react-datepicker.css": "<rootDir>/__mocks__/react-datepicker.css",
    "react-pdf/dist/Page/AnnotationLayer.css": "<rootDir>/__mocks__/react-datepicker.css",
    "react-pdf/dist/Page/TextLayer.css": "<rootDir>/__mocks__/react-datepicker.css",
  },
  testPathIgnorePatterns: [
    "<rootDir>/__tests__/helpers/",
  ],
  modulePathIgnorePatterns: [
    "<rootDir>/.next/",
  ],
  transformIgnorePatterns: [
    "node_modules/(?!(@prisma/client)/)",
  ],
  coverageThreshold: {
    global: {
      lines: 80,
      functions: 70,
      branches: 70,
      statements: 80,
    },
  },
};

export default config;
