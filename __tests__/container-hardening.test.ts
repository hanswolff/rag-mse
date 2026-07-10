import { existsSync, readFileSync } from "fs";
import { join } from "path";

describe("Container hardening", () => {
  const containerfilePath = join(__dirname, "../Containerfile");
  const containerignorePath = join(__dirname, "../.containerignore");

  it("has Containerfile and .containerignore", () => {
    expect(existsSync(containerfilePath)).toBe(true);
    expect(existsSync(containerignorePath)).toBe(true);
  });

  it("builds a runtime image only from host-generated artifacts", () => {
    const containerfile = readFileSync(containerfilePath, "utf-8");

    expect(containerfile).toContain("FROM node:22 AS runner");
    expect(containerfile).toContain("COPY --chown=${APP_UID}:${APP_GID} .next/standalone ./");
    expect(containerfile).toContain("COPY --chown=${APP_UID}:${APP_GID} .next/static ./.next/static");
    expect(containerfile).not.toContain("pnpm install --frozen-lockfile");
    expect(containerfile).not.toContain("pnpm run build");
    expect(containerfile).not.toContain("pnpm run build:scripts");
  });

  it("excludes sensitive paths while allowing required host build artifacts", () => {
    const containerignore = readFileSync(containerignorePath, "utf-8");

    expect(containerignore).toContain(".git");
    expect(containerignore).toContain(".env");
    expect(containerignore).toContain(".env.*");
    expect(containerignore).toContain("node_modules");
    expect(containerignore).toContain("__tests__");
    expect(containerignore).toContain("__mocks__");
    expect(containerignore).toContain("docs");
    expect(containerignore).toContain("ops");
    expect(containerignore).toContain("data");
    expect(containerignore).toContain(".next");
    expect(containerignore).toContain("!.next/standalone");
    expect(containerignore).toContain("!.next/static");
  });
});
