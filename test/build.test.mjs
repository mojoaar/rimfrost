import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAll } from "../src/build.mjs";
import { validateTheme } from "../src/validate.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
// A temp dir rather than the committed opencode/dist: a test run must not
// rewrite tracked output, because regenerating a stale file just before the
// fresh-build guard reads it hides the staleness the guard exists to catch.
const builtDir = mkdtempSync(join(tmpdir(), "rimfrost-build-"));
const distFile = join(builtDir, "fjord.json");

test("build writes a valid dist/fjord.json", () => {
  // Drive the CLI itself so the exit code is real, not a return value.
  const run = spawnSync("node", ["src/build.mjs", "--out", builtDir], { cwd: root, encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  const theme = JSON.parse(readFileSync(distFile, "utf8"));
  for (const key of ["base", "light", "dark"]) {
    assert.ok(theme[key], `dist/fjord.json is missing ${key}`);
  }
});

test("the written file passes validation", () => {
  const theme = JSON.parse(readFileSync(distFile, "utf8"));
  assert.equal(validateTheme(theme).ok, true);
});

test("build reports a broken palette instead of writing it", () => {
  const outDir = mkdtempSync(join(tmpdir(), "fjord-build-"));
  const { built, errors } = buildAll({
    // Relative, like the CLI caller: this is the form that used to resolve
    // against src/build.mjs and break.
    palettesDir: "test/fixtures/broken",
    outDir,
  });
  assert.deepEqual(built, []);
  assert.ok(errors.some((error) => error.includes("neutral")), errors.join("\n"));
  assert.deepEqual(readdirSync(outDir), []);
});
