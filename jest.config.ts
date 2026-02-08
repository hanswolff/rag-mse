import type { Config } from "jest";

const config: Config = {
  coverageProvider: "v8",
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  testTimeout: 10000,
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
  },
  transformIgnorePatterns: [
    "node_modules/(?!(@prisma/client)/)",
  ],
};

export default config;
