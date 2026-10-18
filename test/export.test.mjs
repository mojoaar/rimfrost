// Export check: the token files a consumer outside OpenCode (a web app) reads.
//
// The suite runs the real exporter over the real palettes into a temp dir, so
// these assertions are about the shipped data, not a fixture.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { exportAll } from "../src/export.mjs";
import { HUES } from "../src/contract.mjs";

const PROJECT_ROOT = fileURLToPath(new URL("..", import.meta.url));
const PALETTES = join(PROJECT_ROOT, "src", "palettes");
// The temp dir mirrors the repo root, so every path below is the real
// repo-relative one and the fresh-build guard only has to grow entries.
const ROOT = mkdtempSync(join(tmpdir(), "rimfrost-export-"));
const OPENCODE = join(ROOT, "opencode", "dist");
const TOKENS = join(ROOT, "web", "dist", "tokens");
const { themes, errors } = exportAll({ palettesDir: PALETTES, outDir: OPENCODE, tokensDir: TOKENS });
const tokens = JSON.parse(readFileSync(join(TOKENS, "tokens.json"), "utf8"));

const HEX6 = /^#[\da-f]{6}$/i;

/** Every string leaf of `node`, with its dotted path, for top-level keys only. */
function leaves(node, prefix = "") {
  const found = [];
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") found.push([path, value]);
    else if (value && typeof value === "object") found.push(...leaves(value, path));
  }
  return found;
}

test("every palette is exported, with no errors", () => {
  assert.deepEqual(errors, []);
  assert.deepEqual(themes, ["fjord", "nordlys", "ravn", "skumring"]);
});

test("the token file carries the package version and every theme in both modes", () => {
  const { version } = JSON.parse(readFileSync(join(PROJECT_ROOT, "package.json"), "utf8"));
  assert.equal(tokens.version, version);
  for (const name of themes) {
    assert.deepEqual(Object.keys(tokens.themes[name]).sort(), ["dark", "light"]);
  }
});

test("every exported token is a six-digit hex or transparent", () => {
  for (const name of themes) {
    for (const mode of ["dark", "light"]) {
      const { tokens: roles } = tokens.themes[name][mode];
      assert.ok(Object.keys(roles).length > 60, `${name} ${mode} exported only ${Object.keys(roles).length} tokens`);
      for (const [path, value] of leaves(roles)) {
        assert.ok(
          HEX6.test(value) || value === "transparent",
          `${name} ${mode} ${path} is ${JSON.stringify(value)}`,
        );
      }
    }
  }
});

test("no exported key leaks a reference or a state key", () => {
  for (const name of themes) {
    for (const mode of ["dark", "light"]) {
      const { tokens: roles, ramps } = tokens.themes[name][mode];
      for (const key of [...Object.keys(roles), ...Object.keys(ramps)]) {
        assert.ok(!key.includes("$"), `${name} ${mode} key ${key} looks like a reference`);
        assert.ok(!key.includes("@"), `${name} ${mode} key ${key} is a dialog token`);
      }
    }
  }
});

test("ramps are every hue at all nine steps, per mode", () => {
  for (const name of themes) {
    for (const mode of ["dark", "light"]) {
      const { ramps } = tokens.themes[name][mode];
      assert.deepEqual(Object.keys(ramps).sort(), [...HUES].sort());
      for (const [hue, ramp] of Object.entries(ramps)) {
        assert.equal(Object.keys(ramp).length, 9, `${name} ${mode} ${hue} has ${Object.keys(ramp).length} steps`);
        assert.ok(HEX6.test(ramp["500"]), `${name} ${mode} ${hue}.500 is ${ramp["500"]}`);
      }
    }
  }
});

test("dist/ holds exactly what a fresh build writes", () => {
  // The build output is committed, so it can go stale silently: this is the guard.
  const files = [
    ...themes.map((name) => `opencode/dist/${name}.json`),
    "web/dist/tokens/tokens.json",
    ...themes.map((name) => `web/dist/tokens/${name}.css`),
  ];
  for (const file of files) {
    assert.equal(
      readFileSync(join(PROJECT_ROOT, file), "utf8"),
      readFileSync(join(ROOT, file), "utf8"),
      `${file} is stale — run: npm run export`,
    );
  }
});

test("the CSS puts one property name in both mode blocks", () => {
  const css = readFileSync(join(TOKENS, "fjord.css"), "utf8");
  assert.match(css, /\[data-theme="fjord-dark"\]/);
  assert.match(css, /\[data-theme="fjord-light"\]/);
  // The same custom property, twice: once per mode, so one attribute flips a page.
  assert.equal(css.match(/--fjord-blue-500:/g).length, 2);
  // Dark is the default block, and the dark ramps are the whole-hue ones.
  assert.match(css, /--fjord-blue-500: #4278ad;/);
  assert.match(css, /--fjord-text-base: #1b2733;/);
  for (const name of themes) {
    assert.ok(readFileSync(join(TOKENS, `${name}.css`), "utf8").includes(`[data-theme="${name}-light"]`));
  }
});
