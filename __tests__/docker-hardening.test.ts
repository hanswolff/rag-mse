import { existsSync, readFileSync } from "fs";
import { join } from "path";

describe("Docker hardening", () => {
  const dockerfilePath = join(__dirname, "../Dockerfile");
  const dockerignorePath = join(__dirname, "../.dockerignore");

  it("has Dockerfile and .dockerignore", () => {
    expect(existsSync(dockerfilePath)).toBe(true);
    expect(existsSync(dockerignorePath)).toBe(true);
  });

  it("builds a runtime image only from host-generated artifacts", () => {
    const dockerfile = readFileSync(dockerfilePath, "utf-8");

    expect(dockerfile).toContain("FROM node:22 AS runner");
    expect(dockerfile).toContain("COPY --chown=${APP_UID}:${APP_GID} .next/standalone ./");
    expect(dockerfile).toContain("COPY --chown=${APP_UID}:${APP_GID} .next/static ./.next/static");
    expect(dockerfile).not.toContain("pnpm install --frozen-lockfile");
    expect(dockerfile).not.toContain("pnpm run build");
    expect(dockerfile).not.toContain("pnpm run build:scripts");
  });

  it("excludes sensitive paths while allowing required host build artifacts", () => {
    const dockerignore = readFileSync(dockerignorePath, "utf-8");

    expect(dockerignore).toContain(".git");
    expect(dockerignore).toContain(".env");
    expect(dockerignore).toContain(".env.*");
    expect(dockerignore).toContain("node_modules");
    expect(dockerignore).toContain("__tests__");
    expect(dockerignore).toContain("__mocks__");
    expect(dockerignore).toContain("docs");
    expect(dockerignore).toContain("ops");
    expect(dockerignore).toContain("data");
    expect(dockerignore).toContain(".next");
    expect(dockerignore).toContain("!.next/standalone");
    expect(dockerignore).toContain("!.next/static");
  });
});
