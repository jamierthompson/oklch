import { mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { newBrand, serialize, withOverride } from "./brand.js";
import { main } from "./cli.js";

async function run(argv: string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(argv, {
    out: (l) => out.push(l),
    err: (l) => err.push(l),
  });
  return { code, out, err };
}

async function brandFile(name: string, failing = false): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "oklch-brand-"));
  let brand = newBrand(name, "#2563eb", "srgb");
  if (failing)
    brand = withOverride(brand, "dark", "destructive", {
      ramp: "red",
      step: 10,
    });
  const path = join(dir, "brand.json");
  await writeFile(path, serialize(brand));
  return path;
}

describe("oklch-brand", () => {
  it("prints usage and exits 2 with no command", async () => {
    const r = await run([]);
    expect(r.code).toBe(2);
    expect(r.out[0]).toMatch(/^oklch-brand: audit a brand file/);
  });

  it("check exits 0 and reports the count when every token clears", async () => {
    const r = await run(["check", await brandFile("Acme")]);
    expect(r.code).toBe(0);
    expect(r.out).toEqual([
      "Acme: every token clears (31 tokens, 30 receipts, gamut srgb)",
    ]);
  });

  it("check exits 1 and names the failing token", async () => {
    const r = await run(["check", await brandFile("Acme", true)]);
    expect(r.code).toBe(1);
    expect(r.err[0]).toBe("Acme: 1 of 62 verdicts do not clear");
    expect(r.err[1]).toMatch(/^ {2}dark\/destructive on background: WCAG/);
  });

  it("build writes the three files into --out, and nothing when a token fails", async () => {
    const out = await mkdtemp(join(tmpdir(), "oklch-brand-out-"));
    const r = await run(["build", await brandFile("Acme"), "--out", out]);
    expect(r.code).toBe(0);
    expect((await readdir(out)).sort()).toEqual([
      "acme.css",
      "acme.registry.json",
      "acme.tokens.json",
    ]);
    expect(await readFile(join(out, "acme.css"), "utf8")).toContain(".dark {");

    const empty = await mkdtemp(join(tmpdir(), "oklch-brand-out-"));
    const failed = await run([
      "build",
      await brandFile("Acme", true),
      "-o",
      empty,
    ]);
    expect(failed.code).toBe(1);
    expect(await readdir(empty)).toEqual([]);
  });

  it("exits 2 on a missing file, a file that is not a brand, and a bad flag", async () => {
    expect((await run(["check", "/nonexistent/brand.json"])).code).toBe(2);
    const dir = await mkdtemp(join(tmpdir(), "oklch-brand-"));
    const bad = join(dir, "bad.json");
    await writeFile(bad, "{}");
    const r = await run(["check", bad]);
    expect(r.code).toBe(2);
    expect(r.err[0]).toMatch(/is not a brand file: version undefined is not 1/);
    expect((await run(["check", bad, "--nope"])).code).toBe(2);
  });
});
