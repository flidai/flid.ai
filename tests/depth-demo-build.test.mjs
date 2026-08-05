import assert from "node:assert/strict";
import {
  access,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { buildSite } from "../scripts/build.mjs";

test("opts the local server into research media without changing production builds", async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "flid-depth-demo-"));
  const media = join(temporaryRoot, "media");
  const output = join(temporaryRoot, "dist");

  try {
    await mkdir(media, { recursive: true });
    await writeFile(join(media, "depth-story.mp4"), "continuous-fixture");

    await buildSite({
      outputDirectory: output,
      depthMediaDirectory: media,
    });

    const html = await readFile(join(output, "index.html"), "utf8");
    assert.match(html, /data-depth-demo="local"/);
    await access(join(output, "assets/depth-reference", "depth-story.mp4"));
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});
