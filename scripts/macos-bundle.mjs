import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
// Stage outside cloud-synced Documents: file providers can recreate FinderInfo
// on .app directories immediately after xattr removal and break strict checks.
export function cleanStage(bundle) {
  const directory = mkdtempSync(path.join(tmpdir(), "recurring-bill-build-"));
  const staged = path.join(directory, "Recurring Bill.app");
  try {
    execFileSync("/bin/cp", ["-R", "-X", bundle, staged], {
      env: { ...process.env, COPYFILE_DISABLE: "1" },
    });
  } catch (e) {
    rmSync(directory, { recursive: true, force: true });
    throw e;
  }
  return {
    directory,
    bundle: staged,
    cleanup: () => rmSync(directory, { recursive: true, force: true }),
  };
}
