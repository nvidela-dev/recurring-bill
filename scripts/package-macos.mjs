import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { cleanStage } from "./macos-bundle.mjs";
const root = fileURLToPath(new URL("..", import.meta.url));
const bundle = path.join(
  root,
  "src-tauri/target/universal-apple-darwin/release/bundle/macos/Recurring Bill.app",
);
const dir = path.join(root, "release");
mkdirSync(dir, { recursive: true });
const stage = cleanStage(bundle);
try {
  execFileSync("codesign", ["--verify", "--deep", "--strict", stage.bundle], {
    stdio: "inherit",
  });
  const executable = path.join(stage.bundle, "Contents/MacOS/recurring-bill");
  const arch = execFileSync("lipo", ["-archs", executable], {
    encoding: "utf8",
  });
  if (!arch.includes("arm64") || !arch.includes("x86_64"))
    throw new Error("Expected a universal binary.");
  const name = "Recurring-Bill-macOS-universal.zip",
    archive = path.join(dir, name);
  rmSync(archive, { force: true });
  // Exclude extended filesystem metadata and preserve bundle symlinks.
  execFileSync("/usr/bin/zip", ["-qryX", archive, "Recurring Bill.app"], {
    cwd: stage.directory,
    env: { ...process.env, COPYFILE_DISABLE: "1" },
  });
  writeFileSync(
    path.join(dir, "SHA256SUMS.txt"),
    `${createHash("sha256").update(readFileSync(archive)).digest("hex")}  ${name}\n`,
  );
  console.log(`Packaged ${archive} (${arch.trim()}).`);
} finally {
  stage.cleanup();
}
