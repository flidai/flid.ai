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
    for (let index = 1; index <= 8; index += 1) {
      await writeFile(
        join(media, `depth-clip-${String(index).padStart(2, "0")}.mp4`),
        `fixture-${index}`,
      );
    }

    await buildSite({
      outputDirectory: output,
      depthMediaDirectory: media,
    });

    const html = await readFile(join(output, "index.html"), "utf8");
    assert.match(html, /data-depth-demo="local"/);
    for (let index = 1; index <= 8; index += 1) {
      await access(
        join(
          output,
          "assets/depth-reference",
          `depth-clip-${String(index).padStart(2, "0")}.mp4`,
        ),
      );
    }
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

