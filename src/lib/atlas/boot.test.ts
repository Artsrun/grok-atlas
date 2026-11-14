import assert from "node:assert/strict";
import { test } from "node:test";
import { bootMarks, markBoot, resetBoot } from "./boot.ts";

test("boot stamps gl / lit / ready once, in order", () => {
  resetBoot();
  assert.deepEqual(bootMarks(), { gl: null, lit: null, ready: null });

  markBoot("gl");
  const afterGl = bootMarks();
  assert.equal(typeof afterGl.gl, "number");
  assert.equal(afterGl.lit, null);
  assert.equal(afterGl.ready, null);

  markBoot("day");
  const afterDay = bootMarks();
  assert.ok(afterDay.lit !== null && afterDay.lit >= (afterGl.gl ?? 0));
  assert.equal(afterDay.ready, null);

  markBoot("night");
  const afterNight = bootMarks();
  assert.ok(afterNight.ready !== null && afterNight.ready >= (afterDay.lit ?? 0));

  markBoot("day");
  assert.deepEqual(bootMarks(), afterNight, "repeat marks do not move the stamps");

  resetBoot();
  assert.deepEqual(bootMarks(), { gl: null, lit: null, ready: null });
});
