export type LogoOptions = {
  layers: number;
  curl: number;
  twist: number;
  strokeWidth: number;
  accents: number;
  foreground: string;
  accent: string;
};

export type LogoMark = {
  x: number;
  y: number;
  angle: number;
  rotation: number;
  width: number;
  height: number;
  opacity: number;
  accent: boolean;
};

export const DEFAULT_LOGO_OPTIONS: Readonly<LogoOptions>;

export function getMarkCount(layers: number): number;

export function buildLogoModel(
  input?: Partial<LogoOptions>,
): {
  options: LogoOptions;
  marks: LogoMark[];
};

export function generateLogoSvg(input?: Partial<LogoOptions>): string;
