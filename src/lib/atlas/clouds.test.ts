import assert from "node:assert/strict";
import { test } from "node:test";
import { LIVE_CLOUDS, liveCloudUrl } from "./clouds.ts";

test("live cloud URLs stay on the 3-hour feed, never the baked atlas png", () => {
  for (const url of Object.values(LIVE_CLOUDS)) {
    assert.ok(url.startsWith("https://clouds.matteason.co.uk/images/"));
    assert.ok(url.endsWith("/clouds.jpg"));
    assert.ok(!url.includes("/earth/"));
  }
  assert.equal(liveCloudUrl("low"), liveCloudUrl("mid"));
  assert.ok(liveCloudUrl("high").includes("2048x1024"));
});
