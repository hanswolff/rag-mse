import { readFileSync } from "fs";
import { join } from "path";

describe("deploy.sh post-deploy selftest gate", () => {
  const deployScript = readFileSync(join(__dirname, "../deploy.sh"), "utf-8");

  it("calls /api/selftest on the local port with the bearer token", () => {
    expect(deployScript).toContain("http://127.0.0.1:3000/api/selftest");
    expect(deployScript).toContain("Authorization: Bearer %s");
    expect(deployScript).toContain('-H @"$SELFTEST_HEADER_FILE"');
  });

  it("keeps the bearer token off the process command line", () => {
    expect(deployScript).not.toContain('-H "Authorization: Bearer $SELFTEST_TOKEN"');
    expect(deployScript).toMatch(/chmod 600 "\$SELFTEST_HEADER_FILE"/);
  });

  it("removes the selftest temp files even when the deploy is interrupted", () => {
    expect(deployScript).toMatch(
      /cleanup\(\) \{\n\s*rm -f "\$LOG_FILE" "\$SELFTEST_RESPONSE_FILE" "\$SELFTEST_HEADER_FILE"/
    );
  });

  it("rolls back image-only when the selftest reports errors", () => {
    // App war beim Selftest bereits healthy -> DB darf nicht mehr angefasst
    // werden (ADR 0008), nur das Image wird zurückgerollt. Der Match endet am
    // ersten "fi", damit er nicht in den Rollback eines Nachbar-Gates rutscht.
    expect(deployScript).toMatch(
      /if ! run_post_deploy_selftest; then(?:(?!\bfi\b)[\s\S])*rollback_deployment "image-only"(?:(?!\bfi\b)[\s\S])*exit 1/
    );
  });

  it("warns instead of failing when SELFTEST_TOKEN is missing", () => {
    expect(deployScript).toMatch(/-z "\$\{SELFTEST_TOKEN:-\}"/);
    expect(deployScript).toContain("SELFTEST_TOKEN is not set");
  });

  it("does not roll back when the container itself lacks the token", () => {
    expect(deployScript).toContain("self-test not configured");
  });

  it("runs the selftest only after the container is healthy", () => {
    const healthcheckIndex = deployScript.indexOf('wait_for_service_health "app" "healthy" 60');
    const selftestCallIndex = deployScript.indexOf("if ! run_post_deploy_selftest");
    expect(healthcheckIndex).toBeGreaterThan(-1);
    expect(selftestCallIndex).toBeGreaterThan(healthcheckIndex);
  });
});
