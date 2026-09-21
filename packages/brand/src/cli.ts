import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";

import { parse } from "./brand.js";
import { buildBrand, describeFailures } from "./build.js";

export interface Io {
  readonly out: (line: string) => void;
  readonly err: (line: string) => void;
}

const USAGE = `oklch-brand: audit a brand file, and ship its shadcn theme

  oklch-brand check <brand.json>
  oklch-brand build <brand.json> [--out <dir>]

check prints a verdict per token and exits 1 unless every one clears.
build does the same, then writes <name>.css, <name>.registry.json and
<name>.tokens.json into --out (default: the current directory). Nothing is
written unless every token clears; there is no fallback color.`;

/** The CLI, as a function: argv without node and the script, and where lines go. Returns the exit code. */
export async function main(argv: readonly string[], io: Io): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...argv],
      allowPositionals: true,
      options: {
        out: { type: "string", short: "o" },
        help: { type: "boolean", short: "h" },
      },
    });
  } catch (error) {
    io.err(error instanceof Error ? error.message : String(error));
    io.err(USAGE);
    return 2;
  }
  const [command, file] = parsed.positionals;
  if (parsed.values.help || command === undefined) {
    io.out(USAGE);
    return command === undefined ? 2 : 0;
  }
  if ((command !== "check" && command !== "build") || file === undefined) {
    io.err(
      `oklch-brand: expected \`check <brand.json>\` or \`build <brand.json>\``,
    );
    io.err(USAGE);
    return 2;
  }

  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch (error) {
    io.err(
      `oklch-brand: cannot read ${file}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return 2;
  }
  let brand;
  try {
    brand = parse(text);
  } catch (error) {
    io.err(
      `oklch-brand: ${file} is not a brand file: ${error instanceof Error ? error.message : String(error)}`,
    );
    return 2;
  }

  const built = buildBrand(brand);
  const failures = describeFailures(built.audit);
  const tokens = built.audit.light.length;
  if (built.outputs === null) {
    io.err(
      `${brand.name}: ${failures.length} of ${tokens * 2} verdicts do not clear`,
    );
    for (const line of failures) io.err(`  ${line}`);
    return 1;
  }
  io.out(
    `${brand.name}: every token clears (${tokens} tokens, ${built.audit.set!.receipts.length} receipts, gamut ${brand.gamut})`,
  );
  if (command === "check") return 0;

  const dir = parsed.values.out ?? ".";
  await mkdir(dir, { recursive: true });
  for (const output of Object.values(built.outputs)) {
    const path = join(dir, output.file);
    await writeFile(path, output.text, "utf8");
    io.out(`  wrote ${path}`);
  }
  return 0;
}
