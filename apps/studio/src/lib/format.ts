import { TAILWIND_STOPS, type OkLCH } from "@jamiethompson/oklch";

export const STOP_NAMES = TAILWIND_STOPS.names;

export function stopName(index: number): string {
  return STOP_NAMES[index] ?? String(index);
}

export function fixed(n: number, digits = 3): string {
  return n.toFixed(digits);
}

export function describe(c: OkLCH): string {
  return `L ${fixed(c.L)} C ${fixed(c.C)} H ${fixed(c.H, 1)}`;
}
