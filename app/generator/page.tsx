import type { Metadata } from "next";
import { LogoGenerator } from "./LogoGenerator";
import "./generator.css";

export const metadata: Metadata = {
  title: "Signal Mark Generator — Flid",
  description:
    "A procedural workbench for developing the Flid signal mark and its reduced-layer variations.",
};

export default function GeneratorPage() {
  return <LogoGenerator />;
}
