import assert from "node:assert/strict";
import {
  access,
  mkdtemp,
  rm,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { buildSite } from "../scripts/build.mjs";

test("ships the original depth story in production builds", async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "flid-depth-demo-"));
  const output = join(temporaryRoot, "dist");

  try {
    await buildSite({ outputDirectory: output });

    await access(join(output, "index.html"));
    await access(join(output, "assets/depth-reference", "depth-story.mp4"));
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});
