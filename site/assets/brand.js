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
      const label = `${asset.master} ${asset.type}`.replace(
        /\b\w/g,
        (character) => character.toUpperCase(),
      );

      return `
        <a class="asset-card" href="${asset.path}" download>
          <div class="asset-preview ${surface}">
            <img src="${asset.path}" alt="">
          </div>
          <footer>
            <strong>${label}</strong>
            <span>${asset.status.toUpperCase()} · SVG ↓</span>
          </footer>
        </a>`;
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
