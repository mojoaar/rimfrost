// iTerm2 check: the dynamic profile a terminal loads from its drop-in folder.
//
// There is no hand-made reference file to byte-compare against, so this asserts
// the mapping, the exact key set and order, and that two exports agree — the
// Guid must be stable or every export is a diff.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAll } from "../src/build.mjs";
import { exportIterm } from "../src/export-iterm.mjs";

const PROJECT_ROOT = fileURLToPath(new URL("..", import.meta.url));
const PALETTES = join(PROJECT_ROOT, "src", "palettes");
const themesDir = mkdtempSync(join(tmpdir(), "rimfrost-themes-"));
const outDir = mkdtempSync(join(tmpdir(), "rimfrost-iterm-"));
buildAll({ palettesDir: PALETTES, outDir: themesDir });
const { themes, errors } = exportIterm({ themesDir, outDir });
const body = (file) => readFileSync(join(outDir, file), "utf8");
const profile = (file) => JSON.parse(body(file)).Profiles[0];
const mode = (file) => (file.endsWith(" Light.json") ? "light" : "dark");
const themefile = (file) =>
  JSON.parse(readFileSync(join(themesDir, `${file.replace(/( Light)?\.json$/, "").toLowerCase()}.json`), "utf8"));
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const bytes = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const components = (dict) =>
  ["Red Component", "Green Component", "Blue Component"].map((key) => Math.round(dict[key] * 255));
const ANSI = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"];
const CHROMATIC = ["red", "green", "yellow", "blue", "purple", "cyan"];
const NORMAL = [["gray", "900"], ...CHROMATIC.map((hue) => [hue, "300"]), ["gray", "300"]];
const BRIGHT = [["gray", "600"], ...CHROMATIC.map((hue) => [hue, "200"]), ["gray", "100"]];
const COLOURS = [
  "Background Color", "Foreground Color", "Cursor Color", "Cursor Text Color", "Selection Color",
  "Selected Text Color", "Bold Color", "Link Color", "Underline Color", "Cursor Guide Color",
  "Badge Color", ...Array.from({ length: 16 }, (_, i) => `Ansi ${i} Color`),
];

test("every theme is exported as two mode files, with no errors", () => {
  assert.deepEqual(errors, []);
  assert.deepEqual(themes, ["fjord", "nordlys", "ravn", "skumring"]);
  assert.deepEqual(
    readdirSync(outDir).sort(),
    themes.flatMap((name) => [`${cap(name)} Light.json`, `${cap(name)}.json`]),
  );
});

test("the profile carries exactly the mapped keys, in order", () => {
  for (const file of readdirSync(outDir)) {
    assert.deepEqual(Object.keys(profile(file)), ["Name", "Guid", ...COLOURS], file);
    assert.equal(profile(file).Name, file.replace(".json", ""), file);
  }
});

test("every colour key is the mapping's token, as sRGB components", () => {
  for (const file of readdirSync(outDir)) {
    const p = profile(file);
    const { hue, background, text } = themefile(file)[mode(file)];
    const ramp = (name) =>
      typeof hue[name] === "string" ? hue[hue[name].replace("$hue.", "")] : hue[name];
    const accent = ramp("accent")["300"];
    const checks = [
      ["Background Color", background.base],
      ["Foreground Color", text.base],
      ["Cursor Color", accent],
      ["Cursor Text Color", background.base],
      ["Selection Color", background.raised.high],
      ["Selected Text Color", text.base],
      ["Bold Color", text.base],
      ["Link Color", accent],
      ["Underline Color", text.muted],
      ["Cursor Guide Color", accent],
      ["Badge Color", accent],
      ...ANSI.map((_, i) => [`Ansi ${i} Color`, ramp(NORMAL[i][0])[NORMAL[i][1]]]),
      ...ANSI.map((_, i) => [`Ansi ${i + 8} Color`, ramp(BRIGHT[i][0])[BRIGHT[i][1]]]),
    ];
    for (const [key, hex] of checks) {
      assert.deepEqual(components(p[key]), bytes(hex), `${file} ${key} is not ${hex}`);
      assert.equal(p[key]["Color Space"], "sRGB", `${file} ${key} colour space`);
    }
  }
});

test("the cursor guide is the only translucent colour", () => {
  for (const file of readdirSync(outDir)) {
    const p = profile(file);
    assert.equal(p["Cursor Guide Color"]["Alpha Component"], 0.25, file);
    for (const key of COLOURS) {
      if (key !== "Cursor Guide Color") assert.equal(p[key]["Alpha Component"], 1, `${file} ${key}`);
    }
  }
});

test("the Guid is a reproducible UUIDv5, unique per file", () => {
  const again = mkdtempSync(join(tmpdir(), "rimfrost-iterm-again-"));
  exportIterm({ themesDir, outDir: again });
  const guids = [];
  for (const file of readdirSync(outDir)) {
    assert.equal(body(file), readFileSync(join(again, file), "utf8"), `${file} is not reproducible`);
    const { Guid } = profile(file);
    assert.match(Guid, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/, `${file} Guid ${Guid}`);
    guids.push(Guid);
  }
  assert.equal(new Set(guids).size, guids.length, "two files share a Guid");
});

test("no orange reaches a terminal: there is no ANSI slot for it", () => {
  for (const file of readdirSync(outDir)) {
    for (const step of Object.values(themefile(file)[mode(file)].hue.orange)) {
      assert.ok(!body(file).includes(step), `${file} carries orange ${step}`);
    }
  }
});

test("bright slots in light mode are darker, not lighter", () => {
  const lum = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  for (const file of readdirSync(outDir)) {
    const { hue } = themefile(file)[mode(file)];
    const [normal, bright] = [hue.red["300"], hue.red["200"]];
    if (mode(file) === "dark") assert.ok(lum(bright) > lum(normal), `${file}: bright should be lighter`);
    else assert.ok(lum(bright) < lum(normal), `${file}: bright should be darker`);
  }
});
