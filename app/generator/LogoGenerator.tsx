"use client";

import { useMemo, useState } from "react";
import {
  DEFAULT_LOGO_OPTIONS,
  generateLogoSvg,
  getMarkCount,
  type LogoOptions,
} from "../../lib/logo-generator.mjs";

const presets = [
  { label: "Full", layers: 16, curl: 0.88, twist: 0 },
  { label: "Reduced", layers: 12, curl: 0.94, twist: 4 },
  { label: "Essential", layers: 8, curl: 1.02, twist: 8 },
];

type NumberOption = "layers" | "curl" | "twist" | "strokeWidth" | "accents";

type RangeControlProps = {
  label: string;
  name: NumberOption;
  value: number;
  minimum: number;
  maximum: number;
  step: number;
  displayValue: string;
  onChange: (name: NumberOption, value: number) => void;
};

function RangeControl({
  label,
  name,
  value,
  minimum,
  maximum,
  step,
  displayValue,
  onChange,
}: RangeControlProps) {
  return (
    <label className="generator-control">
      <span>
        {label}
        <output htmlFor={`generator-${name}`}>{displayValue}</output>
      </span>
      <input
        id={`generator-${name}`}
        type="range"
        min={minimum}
        max={maximum}
        step={step}
        value={value}
        onChange={(event) => onChange(name, Number(event.target.value))}
      />
    </label>
  );
}

export function LogoGenerator() {
  const [options, setOptions] = useState<LogoOptions>({
    ...DEFAULT_LOGO_OPTIONS,
  });
  const svg = useMemo(() => generateLogoSvg(options), [options]);
  const markCount = getMarkCount(options.layers);

  function updateNumber(name: NumberOption, value: number) {
    setOptions((current) => ({ ...current, [name]: value }));
  }

  function updateColor(name: "foreground" | "accent", value: string) {
    setOptions((current) => ({ ...current, [name]: value }));
  }

  function applyPreset(preset: (typeof presets)[number]) {
    setOptions((current) => ({
      ...current,
      layers: preset.layers,
      curl: preset.curl,
      twist: preset.twist,
    }));
  }

  function downloadSvg() {
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `flid-signal-${options.layers}-layers.svg`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="generator-page">
      <header className="generator-header">
        <a href="/" className="generator-brand" aria-label="Back to Flid home">
          <span className="generator-brand-dot" aria-hidden="true" />
          FLID / SIGNAL LAB
        </a>
        <span>PROCEDURAL MARK · V0.1</span>
      </header>

      <section className="generator-layout">
        <aside className="generator-panel">
          <div className="generator-intro">
            <p className="generator-kicker">Logo generator</p>
            <h1>Shape the signal.</h1>
            <p>
              A deterministic drawing system for exploring the Flid mark—from a
              dense field to a quieter, reduced form.
            </p>
          </div>

          <div className="generator-presets" aria-label="Layer presets">
            {presets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                className={
                  options.layers === preset.layers ? "is-active" : undefined
                }
                onClick={() => applyPreset(preset)}
              >
                <span>{preset.label}</span>
                <strong>{preset.layers}L</strong>
              </button>
            ))}
          </div>

          <div className="generator-controls">
            <RangeControl
              label="Layers"
              name="layers"
              value={options.layers}
              minimum={4}
              maximum={20}
              step={1}
              displayValue={`${options.layers}`}
              onChange={updateNumber}
            />
            <RangeControl
              label="Curl"
              name="curl"
              value={options.curl}
              minimum={0.55}
              maximum={1.55}
              step={0.01}
              displayValue={options.curl.toFixed(2)}
              onChange={updateNumber}
            />
            <RangeControl
              label="Twist"
              name="twist"
              value={options.twist}
              minimum={-35}
              maximum={35}
              step={1}
              displayValue={`${options.twist}°`}
              onChange={updateNumber}
            />
            <RangeControl
              label="Line weight"
              name="strokeWidth"
              value={options.strokeWidth}
              minimum={0.22}
              maximum={1.2}
              step={0.01}
              displayValue={options.strokeWidth.toFixed(2)}
              onChange={updateNumber}
            />
            <RangeControl
              label="Signal accents"
              name="accents"
              value={options.accents}
              minimum={0}
              maximum={8}
              step={1}
              displayValue={`${options.accents}`}
              onChange={updateNumber}
            />

            <div className="generator-color-row">
              <label>
                <span>Field</span>
                <input
                  type="color"
                  value={options.foreground}
                  onChange={(event) =>
                    updateColor("foreground", event.target.value)
                  }
                />
              </label>
              <label>
                <span>Signal</span>
                <input
                  type="color"
                  value={options.accent}
                  onChange={(event) =>
                    updateColor("accent", event.target.value)
                  }
                />
              </label>
            </div>
          </div>

          <div className="generator-actions">
            <button type="button" className="export-button" onClick={downloadSvg}>
              Export SVG <span aria-hidden="true">↓</span>
            </button>
            <button
              type="button"
              className="reset-button"
              onClick={() => setOptions({ ...DEFAULT_LOGO_OPTIONS })}
            >
              Reset
            </button>
          </div>
        </aside>

        <section className="generator-stage" aria-label="Generated logo preview">
          <div className="generator-stage-meta generator-stage-meta-top">
            <span>LIVE VECTOR</span>
            <span>100 × 100</span>
          </div>
          <div
            className="generator-preview"
            style={
              {
                "--preview-accent": options.accent,
              } as React.CSSProperties
            }
            dangerouslySetInnerHTML={{ __html: svg }}
          />
          <div className="generator-crosshair" aria-hidden="true" />
          <div className="generator-stage-meta generator-stage-meta-bottom">
            <span>{markCount} MARKS</span>
            <span>137.507764°</span>
          </div>
        </section>
      </section>

      <section className="generator-notes">
        <div>
          <span>01 / OBSERVED</span>
          <p>
            Repeated open curves advance by the golden angle while their radius,
            scale, and visibility increase outwards.
          </p>
        </div>
        <div>
          <span>02 / REBUILT</span>
          <p>
            Flid&apos;s version uses a new cubic curve, a normalized layer
            system, and controlled signal accents.
          </p>
        </div>
        <div>
          <span>03 / VARIABLE</span>
          <p>
            Layer count changes the structural complexity while keeping the
            overall silhouette and visual weight stable.
          </p>
        </div>
      </section>
    </main>
  );
}
