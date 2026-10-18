// Ramp expansion: five hand-tuned anchors become the nine steps the contract
// requires. The four gaps are filled at the OKLab midpoint, which is where the
// perceptually even point sits; interpolating in sRGB instead would leave the
// odd steps bunched and the midtones washed out.
//
// There is deliberately no `direction` parameter. The anchors already encode
// the ramp's direction — dark-mode ramps run light at 100 to dark at 900, light
// mode the reverse — so this module only ever fills between the anchors it is
// handed, in the order the contract numbers them. Callers that want a light
// ramp pass anchors that get lighter as the step number rises.

import { mixOklab } from "./color.mjs";

/** The five anchored steps, in ascending order, so the four gaps are pairwise. */
const ANCHOR_STEPS = [100, 300, 500, 700, 900];

/**
 * Expand the five anchors `{100,300,500,700,900}` into all nine ramp steps.
 *
 * @param {{[step: number]: string}} anchors hex values for the five anchored steps
 * @returns {Record<string, string>} every step from "100" to "900"
 */
export function expandRamp(anchors) {
  const ramp = {};
  for (const step of ANCHOR_STEPS) ramp[step] = anchors[step];

  for (let i = 0; i < ANCHOR_STEPS.length - 1; i++) {
    const lower = ANCHOR_STEPS[i];
    const upper = ANCHOR_STEPS[i + 1];
    ramp[(lower + upper) / 2] = mixOklab(anchors[lower], anchors[upper], 0.5);
  }
  return ramp;
}
