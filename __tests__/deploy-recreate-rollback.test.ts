import { spawnSync } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";

// Scheitert `podman-compose up --force-recreate`, kann der alte Container schon
// entfernt sein. Der Test führt den echten Block aus deploy.sh mit gestubbten
// podman-/podman-compose-Aufrufen aus und prüft die Reaktion.
describe("deploy.sh recreate failure handling", () => {
  const deploySh = readFileSync(join(__dirname, "../deploy.sh"), "utf-8");

  function extractRecreateBlock(): string {
    const tagFn = deploySh.match(/^restore_previous_image_tag\(\) \{\n[\s\S]*?\n\}/m);
    const start = deploySh.indexOf('echo "Recreating app container with latest image..."');
    const failureStart = deploySh.indexOf('if [ "$status" -ne 0 ]; then', start);
    const end = deploySh.indexOf("\nfi\n", failureStart);
    expect(tagFn).not.toBeNull();
    expect(start).toBeGreaterThan(-1);
    expect(failureStart).toBeGreaterThan(start);
    return `${tagFn![0]}\n${deploySh.slice(start, end + 4)}`;
  }

  function runRecreate(options: { recreateStatus: number; previousRunning: boolean; prevContainer?: string }) {
    const script = `
set -euo pipefail
LOG_FILE=/dev/null
PREV_APP_CONTAINER_ID="${options.prevContainer ?? "old-container"}"
PREV_IMAGE_ID="sha-old"
PREV_IMAGE_NAME="localhost/project_app"
podman-compose() { return ${options.recreateStatus}; }
podman() {
  case "$1" in
    inspect) echo "${options.previousRunning ? "true" : "false"}" ;;
    tag) echo "TAG $2 $3" ;;
  esac
}
rollback_deployment() { echo "ROLLBACK $1"; }
${extractRecreateBlock()}
echo "CONTINUED"
`;
    return spawnSync("bash", ["-c", script], { encoding: "utf-8" });
  }

  it("rolls back with DB restore when the previous container is gone", () => {
    const result = runRecreate({ recreateStatus: 1, previousRunning: false });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("ROLLBACK with-db-restore");
    expect(result.stdout).not.toContain("CONTINUED");
  });

  it("rolls back with DB restore on a first deploy without previous container", () => {
    const result = runRecreate({ recreateStatus: 1, previousRunning: false, prevContainer: "" });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("ROLLBACK with-db-restore");
  });

  it("only resets the image tag when the previous container still runs", () => {
    const result = runRecreate({ recreateStatus: 1, previousRunning: true });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("only resetting the image tag");
    expect(result.stdout).toContain("TAG sha-old localhost/project_app");
    expect(result.stdout).not.toContain("ROLLBACK");
  });

  it("continues when the recreate succeeds", () => {
    const result = runRecreate({ recreateStatus: 0, previousRunning: false });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("CONTINUED");
    expect(result.stdout).not.toContain("ROLLBACK");
  });
});
