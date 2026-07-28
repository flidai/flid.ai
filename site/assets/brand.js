import { brandSystem } from "/lib/brand-system.mjs";

function masterForReference(reference) {
  if (reference.layers === 8) return "essential";
  if (reference.layers === 16) return "full";
  return "primary";
}

function findAsset(manifest, { type, master, theme = "on-dark" }) {
  return manifest.assets.find(
    (asset) =>
      asset.type === type &&
      asset.master === master &&
      asset.theme === theme,
  );
}

function renderScaleReferences(manifest) {
  document.querySelector("[data-brand-scale]").innerHTML =
    brandSystem.scaleReferences
      .map((reference) => {
        const master = masterForReference(reference);
        const iconOnly = reference.role === "Small icon only";
        const asset = findAsset(manifest, {
          type: iconOnly ? "mark" : "lockup",
          master,
        });
        const className = iconOnly
          ? "reference-asset is-icon"
          : "reference-asset is-lockup";

        return `
          <article class="reference-scale-row">
            <header><strong>${reference.size}px</strong><span>${reference.label} · ${reference.layers}L</span></header>
            <div class="reference-lockup" style="--reference-size:${reference.size}px">
              <img class="${className}" src="${asset.path}" alt="">
            </div>
            <span>${reference.role}</span>
          </article>`;
      })
      .join("");
}

function renderAssetLibrary(manifest) {
  document.querySelector("[data-brand-assets]").innerHTML = manifest.assets
    .map((asset) => {
      const surface =
        asset.theme === "on-light"
          ? "is-light"
          : asset.theme === "adaptive"
            ? "is-accent"
            : "is-dark";
      const label = asset.id.replaceAll("-", " ").replace(
        /\b\w/g,
        (character) => character.toUpperCase(),
      );
      const downloads = [];
      if (asset.files?.svg) {
        downloads.push({ label: "SVG", path: asset.files.svg });
      }
      if (asset.files?.pdf) {
        downloads.push({ label: "PDF", path: asset.files.pdf });
      }
      if (asset.files?.ico) {
        downloads.push({ label: "ICO", path: asset.files.ico });
      }
      for (const png of asset.files?.png ?? []) {
        const suffix = png.scale
          ? `${png.scale}×`
          : png.width === png.height
            ? `${png.width}`
            : "";
        downloads.push({
          label: `PNG${suffix ? ` ${suffix}` : ""}`,
          path: png.path,
        });
      }

      return `
        <article class="asset-card">
          <a class="asset-preview ${surface}" href="${asset.path}" download>
            <img src="${asset.path}" alt="">
          </a>
          <footer>
            <strong>${label}</strong>
            <div class="asset-downloads">
              ${downloads
                .map(
                  ({ label: downloadLabel, path }) =>
                    `<a href="${path}" download>${downloadLabel} ↓</a>`,
                )
                .join("")}
            </div>
          </footer>
        </article>`;
    })
    .join("");
}

document.querySelector("[data-brand-colors]").innerHTML = Object.values(
  brandSystem.colors,
)
  .map(
    (color) => `
      <article class="color-card" style="--swatch:${color.hex}">
        <div></div>
        <footer><strong>${color.name}</strong><span>${color.token}<br>${color.hex}</span></footer>
      </article>`,
  )
  .join("");

fetch("/brand-assets/manifest.json")
  .then((response) => {
    if (!response.ok) throw new Error("Unable to load brand assets");
    return response.json();
  })
  .then((manifest) => {
    renderScaleReferences(manifest);
    renderAssetLibrary(manifest);
  })
  .catch(() => {
    document.querySelector("[data-brand-scale]").textContent =
      "Scale references could not be loaded.";
    document.querySelector("[data-brand-assets]").textContent =
      "Brand assets could not be loaded.";
  });

const sourceElement = document.querySelector("[data-generator-source]");
fetch("/lib/logo-generator.mjs")
  .then((response) => {
    if (!response.ok) throw new Error("Unable to load source");
    return response.text();
  })
  .then((source) => {
    sourceElement.textContent = source;
  })
  .catch(() => {
    sourceElement.textContent = "Generator source could not be loaded.";
  });
