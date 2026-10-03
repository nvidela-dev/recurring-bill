import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { cleanStage } from "./macos-bundle.mjs";
if (process.platform === "darwin") {
  const target = process.argv[2];
  if (
    target &&
    ![
      "universal-apple-darwin",
      "aarch64-apple-darwin",
      "x86_64-apple-darwin",
    ].includes(target)
  )
    throw new Error("Unsupported build target");
  const bundle = fileURLToPath(
    new URL(
      `../src-tauri/target/${target ? target + "/" : ""}release/bundle/macos/Recurring Bill.app`,
      import.meta.url,
    ),
  );
  const stage = cleanStage(bundle);
  try {
    execFileSync(
      "codesign",
      ["--force", "--deep", "--sign", "-", stage.bundle],
      { stdio: "inherit" },
    );
    execFileSync("codesign", ["--verify", "--deep", "--strict", stage.bundle], {
      stdio: "inherit",
    });
    execFileSync("/bin/cp", ["-R", "-X", stage.bundle + "/Contents", bundle], {
      env: { ...process.env, COPYFILE_DISABLE: "1" },
    });
    console.log("Local signature verified in a clean staging directory.");
  } finally {
    stage.cleanup();
  }
}
