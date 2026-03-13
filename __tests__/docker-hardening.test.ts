import { existsSync, readFileSync } from "fs";
import { join } from "path";

describe("Docker hardening", () => {
  const dockerfilePath = join(__dirname, "../Dockerfile");
  const dockerignorePath = join(__dirname, "../.dockerignore");

  it("has Dockerfile and .dockerignore", () => {
    expect(existsSync(dockerfilePath)).toBe(true);
    expect(existsSync(dockerignorePath)).toBe(true);
  });

  it("removes sensitive standalone artifacts from runtime image", () => {
    const dockerfile = readFileSync(dockerfilePath, "utf-8");

    expect(dockerfile).toContain("FROM base AS deps");
    expect(dockerfile).toContain("FROM deps AS builder");
    expect(dockerfile).toContain("pnpm install --frozen-lockfile");
    expect(dockerfile).toContain("pnpm run build");
    expect(dockerfile).toContain("pnpm run build:scripts");
  });

  it("excludes sensitive standalone paths from build context", () => {
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
  });
});
