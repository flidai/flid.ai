import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import sharp from "sharp";

import { primerColors } from "../lib/primer-colors.mjs";

const root = new URL("../", import.meta.url);

async function read(pathname) {
  return readFile(new URL(pathname, root));
}

function pngDimensions(buffer) {
  assert.deepEqual(
    [...buffer.subarray(0, 8)],
    [137, 80, 78, 71, 13, 10, 26, 10],
  );
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

test("ships the complete deterministic brand package in the repository", async () => {
  const [committed, built] = await Promise.all([
    read("brand-assets/manifest.json"),
    read("dist/brand-assets/manifest.json"),
  ]);

  assert.deepEqual(JSON.parse(committed), JSON.parse(built));
  assert.match(
    (await read("brand-assets/README.md")).toString("utf8"),
    /SVG.*PNG.*PDF/is,
  );
});

test("provides SVG, vector PDF, and 1x/2x/4x PNG for every logo", async () => {
  const manifest = JSON.parse(await read("dist/brand-assets/manifest.json"));
  assert.equal(manifest.schemaVersion, 3);

  const logo = manifest.assets.find(
    (asset) =>
      asset.id === "lockup-primary-on-dark" && asset.type === "lockup",
  );
  assert.ok(logo);
  assert.equal(logo.files.svg, "/brand-assets/lockup-primary-on-dark.svg");
  assert.equal(logo.files.pdf, "/brand-assets/pdf/lockup-primary-on-dark.pdf");
  assert.deepEqual(
    logo.files.png.map(({ scale }) => scale),
    [1, 2, 4],
  );

  const [svg, pdf, png1x, png4x] = await Promise.all([
    read(`dist/${logo.files.svg.slice(1)}`),
    read(`dist/${logo.files.pdf.slice(1)}`),
    read(`dist/${logo.files.png[0].path.slice(1)}`),
    read(`dist/${logo.files.png[2].path.slice(1)}`),
  ]);

  assert.match(svg.toString("utf8"), /^<svg/);
  assert.match(pdf.toString("ascii", 0, 5), /^%PDF-/);
  const one = pngDimensions(png1x);
  const four = pngDimensions(png4x);
  assert.equal(four.width, one.width * 4);
  assert.equal(four.height, one.height * 4);
});

test("includes browser, app, profile, and social-sharing assets", async () => {
  const manifest = JSON.parse(await read("dist/brand-assets/manifest.json"));
  const paths = new Set(
    manifest.assets.flatMap((asset) => [
      asset.path,
      asset.files?.ico,
      asset.files?.webmanifest,
      ...(asset.files?.png ?? []).map((file) => file.path),
    ].filter(Boolean)),
  );

  for (const path of [
    "/brand-assets/favicon/favicon.ico",
    "/brand-assets/favicon/favicon-32.png",
    "/brand-assets/favicon/apple-touch-icon.png",
    "/brand-assets/favicon/icon-192.png",
    "/brand-assets/favicon/icon-512.png",
    "/brand-assets/social/profile-dark-1024.png",
    "/brand-assets/social/profile-light-1024.png",
    "/brand-assets/social/share-dark-1200x630.png",
    "/brand-assets/social/share-light-1200x630.png",
  ]) {
    assert.ok(paths.has(path), `manifest is missing ${path}`);
    assert.ok((await read(`dist/${path.slice(1)}`)).length > 100);
  }

  const share = pngDimensions(
    await read("dist/brand-assets/social/share-dark-1200x630.png"),
  );
  assert.deepEqual(share, { width: 1200, height: 630 });

  const ico = await read("dist/brand-assets/favicon/favicon.ico");
  assert.deepEqual([...ico.subarray(0, 4)], [0, 0, 1, 0]);
});

test("includes company and personal LinkedIn banners in both color modes", async () => {
  const manifest = JSON.parse(await read("dist/brand-assets/manifest.json"));
  const expected = [
    ["linkedin-company-dark", 1128, 191],
    ["linkedin-company-light", 1128, 191],
    ["linkedin-personal-dark", 1584, 396],
    ["linkedin-personal-light", 1584, 396],
  ];

  for (const [id, width, height] of expected) {
    const asset = manifest.assets.find((candidate) => candidate.id === id);
    assert.ok(asset, `manifest is missing ${id}`);
    assert.equal(asset.type, "linkedin");
    assert.equal(asset.files.png[0].width, width);
    assert.equal(asset.files.png[0].height, height);
    assert.match(asset.files.svg, new RegExp(`${id}-${width}x${height}\\.svg$`));

    const png = pngDimensions(
      await read(`dist/${asset.files.png[0].path.slice(1)}`),
    );
    assert.deepEqual(png, { width, height });

    const svg = (
      await read(`dist/${asset.files.svg.slice(1)}`)
    ).toString("utf8");
    assert.match(svg, /data-linkedin-safe-content="center"/);
    const fieldStart = Number(
      svg.match(
        /data-decorative-field="primary-12-layer"[^>]+data-clear-gap="64"[^>]+transform="translate\(([\d.]+)/,
      )?.[1],
    );
    const statementRight = Number(
      svg.match(/data-statement-right="([\d.]+)"/)?.[1],
    );
    const statementCenter = Number(
      svg.match(/data-statement-center="([\d.]+)"/)?.[1],
    );
    assert.ok(Number.isFinite(fieldStart), "banner must record the field start");
    assert.ok(
      Number.isFinite(statementRight),
      "banner must record the statement boundary",
    );
    assert.equal(
      statementCenter,
      width / 2,
      "banner statement must be centered on the full canvas",
    );
    assert.ok(
      fieldStart - statementRight >= 64,
      "decorative field must preserve 64px of clearance from the statement",
    );
    const safeContent = svg.match(
      /<g data-linkedin-safe-content="center"[^>]*>(.*?)<\/g>/s,
    )?.[1];
    assert.ok(safeContent);
    assert.doesNotMatch(safeContent, /<circle/);
    assert.match(safeContent, /data-positioning-outline="true"/);
    assert.doesNotMatch(svg, /data-domain-outline|data-wordmark-outline|data-divider/);
    assert.doesNotMatch(svg, /<text|font-family/);
  }

  const [darkCompany, darkPersonal] = await Promise.all([
    read("dist/brand-assets/social/linkedin-company-dark-1128x191.svg")
      .then((buffer) => buffer.toString("utf8")),
    read("dist/brand-assets/social/linkedin-personal-dark-1584x396.svg")
      .then((buffer) => buffer.toString("utf8")),
  ]);
  assert.match(
    darkCompany,
    /data-message="Products where agents do real work\."/,
  );
  assert.match(
    darkPersonal,
    /data-message="Building agent-native products\."/,
  );
  assert.match(
    darkCompany,
    /data-decorative-field="primary-12-layer" data-placement="right-crop"/,
  );
});

test("includes an opaque dark LinkedIn company logo", async () => {
  const manifest = JSON.parse(await read("dist/brand-assets/manifest.json"));
  const asset = manifest.assets.find(
    (candidate) => candidate.id === "linkedin-company-logo-dark",
  );

  assert.ok(asset, "manifest is missing linkedin-company-logo-dark");
  assert.equal(asset.type, "linkedin-logo");
  assert.equal(asset.master, "primary");
  assert.deepEqual(asset.opticalCompensation, {
    artworkRatio: 0.82,
    strokeWidth: 0.85,
    minimumOpacity: 0.7,
    foreground: "#ffffff",
  });
  assert.equal(asset.files.png[0].width, 1024);
  assert.equal(asset.files.png[0].height, 1024);
  assert.equal(
    asset.files.png[0].path,
    "/brand-assets/social/linkedin-company-logo-dark-1024.png",
  );

  const png = await read(
    "dist/brand-assets/social/linkedin-company-logo-dark-1024.png",
  );
  const { data, info } = await sharp(png)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const expectedCorner = [
    ...Buffer.from(primerColors.dark.canvas.slice(1), "hex"),
    255,
  ];

  assert.deepEqual({ width: info.width, height: info.height }, {
    width: 1024,
    height: 1024,
  });
  assert.deepEqual([...data.subarray(0, 4)], expectedCorner);

  for (let alpha = 3; alpha < data.length; alpha += 4) {
    assert.equal(data[alpha], 255, "LinkedIn logo must not contain transparency");
  }

  const thumbnail = await sharp(png)
    .resize(68, 68)
    .removeAlpha()
    .raw()
    .toBuffer();
  let visiblePixels = 0;
  let maximumContrast = 0;
  for (let pixel = 0; pixel < thumbnail.length; pixel += 3) {
    const contrast = Math.max(
      Math.abs(thumbnail[pixel] - expectedCorner[0]),
      Math.abs(thumbnail[pixel + 1] - expectedCorner[1]),
      Math.abs(thumbnail[pixel + 2] - expectedCorner[2]),
    );
    if (contrast > 30) visiblePixels += 1;
    maximumContrast = Math.max(maximumContrast, contrast);
  }
  assert.ok(
    visiblePixels > 300,
    "LinkedIn logo must remain visible at the platform thumbnail size",
  );
  assert.ok(maximumContrast > 120, "LinkedIn logo needs strong local contrast");
});
