import { formatOklch, parseColor, type OkLCH } from "@jamiethompson/oklch";

import "./style.css";

/** The page shell: a function's name, the question it answers, and the contract it adds. */
export function page(
  name: string,
  question: string,
  contract: string,
): HTMLElement {
  document.title = `${name} · oklch`;
  const main = document.querySelector("main")!;
  main.innerHTML = `
    <a class="back" href="../">← all functions</a>
    <h1><code>${name}</code></h1>
    <p class="question">${question}</p>
    <p class="contract">${contract}</p>
    <form></form>
    <div class="out"></div>
  `;
  return main;
}

export function form(main: HTMLElement): HTMLFormElement {
  return main.querySelector("form")!;
}

export function out(main: HTMLElement): HTMLElement {
  return main.querySelector(".out")!;
}

/** A labelled input, returned so callers can read it. */
export function field(
  form: HTMLFormElement,
  label: string,
  attrs: Record<string, string>,
): HTMLInputElement {
  const el = document.createElement("label");
  el.innerHTML = `<span>${label}</span>`;
  const input = document.createElement("input");
  for (const [k, v] of Object.entries(attrs)) input.setAttribute(k, v);
  el.append(input);
  form.append(el);
  return input;
}

export function select(
  form: HTMLFormElement,
  label: string,
  options: string[],
): HTMLSelectElement {
  const el = document.createElement("label");
  el.innerHTML = `<span>${label}</span>`;
  const sel = document.createElement("select");
  for (const o of options) {
    const opt = document.createElement("option");
    opt.value = o;
    opt.textContent = o;
    sel.append(opt);
  }
  el.append(sel);
  form.append(el);
  return sel;
}

/** A gamut chooser with no default selected: the page must ask. */
export function gamutField(form: HTMLFormElement): () => string | undefined {
  const set = document.createElement("fieldset");
  set.innerHTML = `
    <span>gamut</span>
    <label><input type="radio" name="gamut" value="p3"> p3</label>
    <label><input type="radio" name="gamut" value="srgb"> srgb</label>
  `;
  form.append(set);
  return () =>
    (set.querySelector("input:checked") as HTMLInputElement | null)?.value;
}

/** Re-render on every input, and show a refusal as the product it is. */
export function live(
  form: HTMLFormElement,
  target: HTMLElement,
  render: () => string,
): void {
  const run = () => {
    try {
      target.classList.remove("refusal");
      target.innerHTML = render();
    } catch (error) {
      target.classList.add("refusal");
      target.textContent =
        error instanceof Error ? error.message : String(error);
    }
  };
  form.addEventListener("input", run);
  run();
}

/** Parse a color field, or explain why it is null. */
export function color(input: HTMLInputElement): OkLCH {
  const parsed = parseColor(input.value);
  if (parsed === null) {
    throw new Error(
      `parseColor("${input.value}") is null: not a color this package reads`,
    );
  }
  return parsed;
}

export function num(input: HTMLInputElement): number {
  return input.value.trim() === "" ? NaN : Number(input.value);
}

export function swatch(c: OkLCH, caption: string): string {
  return `<div class="swatch"><div style="background:${formatOklch(c)}"></div><span>${caption}</span></div>`;
}

export function swatches(items: [OkLCH, string][]): string {
  return `<div class="swatches">${items.map(([c, cap]) => swatch(c, cap)).join("")}</div>`;
}

export function json(value: unknown): string {
  return `<pre>${JSON.stringify(value, (_, v) => (typeof v === "number" ? Number(v.toPrecision(6)) : v), 2)}</pre>`;
}

export function fixed(n: number, digits = 4): string {
  return n.toFixed(digits);
}
