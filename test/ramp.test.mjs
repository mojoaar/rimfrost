import test from "node:test";
import assert from "node:assert/strict";
import { expandRamp } from "../src/ramp.mjs";
import { srgbToOklab, hexToRgb, contrastRatio } from "../src/color.mjs";

const CYAN_DARK = { 100:"#cbf0f2", 300:"#6fc4cd", 500:"#358892", 700:"#1c4c53", 900:"#0a1d20" };
const STEPS = ["100","200","300","400","500","600","700","800","900"];
const L = (hex) => srgbToOklab(hexToRgb(hex)).L;
const C = (hex) => { const {a,b} = srgbToOklab(hexToRgb(hex)); return Math.hypot(a,b); };

test("every step is present and endpoints are exact", () => {
  const ramp = expandRamp(CYAN_DARK);
  assert.deepEqual(Object.keys(ramp).sort(), [...STEPS].sort());
  for (const s of [100,300,500,700,900]) assert.equal(ramp[s], CYAN_DARK[s]);
});

test("lightness is monotonic along the ramp", () => {
  const ramp = expandRamp(CYAN_DARK);
  const ls = STEPS.map((s) => L(ramp[s]));
  for (let i = 1; i < ls.length; i++) assert.ok(ls[i] < ls[i-1],
    `step ${STEPS[i]} is lighter than ${STEPS[i-1]}: ${ls[i-1]} -> ${ls[i]}`);
});

test("mid steps keep their chroma instead of going grey", () => {
  const ramp = expandRamp(CYAN_DARK);
  for (const [mid, lo, hi] of [[200,100,300],[400,300,500],[600,500,700],[800,700,900]]) {
    const floor = Math.min(C(ramp[lo]), C(ramp[hi])) * 0.8;
    assert.ok(C(ramp[mid]) >= floor, `step ${mid} chroma ${C(ramp[mid])} < floor ${floor}`);
  }
});

test("no step duplicates another", () => {
  const ramp = expandRamp(CYAN_DARK);
  const used = new Set(STEPS.map((s) => ramp[s]));
  assert.equal(used.size, 9);
});

test("a light-mode ramp expanding towards lighter steps works the same way", () => {
  const lightGray = { 100:"#202c38", 300:"#4a5a6b", 500:"#7b8b9c", 700:"#b3c0cc", 900:"#dbe3ea" };
  const ramp = expandRamp(lightGray);
  const ls = STEPS.map((s) => L(ramp[s]));
  for (let i = 1; i < ls.length; i++) assert.ok(ls[i] > ls[i-1]);
  assert.ok(contrastRatio(ramp["900"], ramp["100"]) > contrastRatio(ramp["900"], ramp["700"]));
});
