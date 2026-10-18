import test from "node:test";
import assert from "node:assert/strict";
import { hexToRgb, rgbToHex, srgbToOklab, oklabToSrgb,
         mixOklab, relativeLuminance, contrastRatio } from "../src/color.mjs";

test("hexToRgb parses 6 and 3 digit forms, rejects junk", () => {
  assert.deepEqual(hexToRgb("#0e1620"), { r: 14, g: 22, b: 32 });
  assert.deepEqual(hexToRgb("#fff"), { r: 255, g: 255, b: 255 });
  assert.throws(() => hexToRgb("0e1620"), /Invalid hex/);
  assert.throws(() => hexToRgb("#12345"), /Invalid hex/);
});

test("rgbToHex round-trips and lowercases", () => {
  assert.equal(rgbToHex(hexToRgb("#4AA7B3")), "#4aa7b3");
});

test("OKLab round-trips within one 8 bit step", () => {
  for (const hex of ["#0e1620", "#c6d4e0", "#4aa7b3", "#f0e6c4", "#150a0c"]) {
    const back = rgbToHex(oklabToSrgb(srgbToOklab(hexToRgb(hex))));
    const a = hexToRgb(hex), b = hexToRgb(back);
    for (const k of ["r","g","b"]) assert.ok(Math.abs(a[k] - b[k]) <= 1, `${hex} ${k}`);
  }
});

test("OKLab lightness anchors", () => {
  assert.ok(Math.abs(srgbToOklab({r:255,g:255,b:255}).L - 1) < 0.001);
  assert.ok(Math.abs(srgbToOklab({r:0,g:0,b:0}).L) < 0.001);
});

test("contrastRatio matches WCAG", () => {
  assert.equal(contrastRatio("#ffffff", "#000000"), 21);
  assert.ok(Math.abs(contrastRatio("#7b8b9c", "#dbe3ea") - 2.7) < 0.05);
});

test("mixOklab lands midway in OKLab lightness, not sRGB", () => {
  const mid = mixOklab("#000000", "#ffffff", 0.5);
  assert.ok(Math.abs(srgbToOklab(hexToRgb(mid)).L - 0.5) < 0.02, mid);
});

test("mixOklab returns the endpoints exactly", () => {
  assert.equal(mixOklab("#123456", "#abcdef", 0), "#123456");
  assert.equal(mixOklab("#123456", "#abcdef", 1), "#abcdef");
});
