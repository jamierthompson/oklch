import { describe, expect, it } from "vitest";

import { parseColor } from "@jamiethompson/oklch";

import {
  newTheme,
  safeSeed,
  withRamp,
  withRecipe,
  type Theme,
} from "./theme.ts";
import {
  canRedo,
  canUndo,
  currentOf,
  describe as describeCommand,
  EMPTY,
  MAX_ENTRIES,
  perform,
  redo,
  redoTo,
  select,
  summarize,
  undo,
  undoTo,
  type Command,
  type Entry,
  type Studio,
} from "./history.ts";

let n = 0;
const entry = (theme: Theme, command: Command, at = 0): Entry => ({
  id: `e${++n}`,
  at,
  theme: { id: theme.id, name: theme.name },
  command,
});
const acme = () => newTheme("Acme", "#2563eb", "srgb");
const create = (s: Studio, b: Theme, at = 0) =>
  perform(
    s,
    entry(
      b,
      {
        kind: "create",
        index: s.themes.length,
        theme: b,
        from: "#2563eb",
        previous: s.current,
      },
      at,
    ),
  );
const nameOf = (s: Studio) => currentOf(s)?.name;
const step5 = (b: Theme) =>
  b.ramps.find((r) => r.name === "primary")!.steps[5]!;

describe("perform, undo, redo", () => {
  it("creates a theme and selects it; undo removes it and returns to the previous one; redo brings it back", () => {
    const a = acme();
    const b = { ...acme(), id: "b", name: "Beta" };
    let s = create(EMPTY, a);
    s = create(s, b);
    expect(s.themes.map((x) => x.name)).toEqual(["Acme", "Beta"]);
    expect(nameOf(s)).toBe("Beta");
    s = undo(s);
    expect(s.themes.map((x) => x.name)).toEqual(["Acme"]);
    expect(nameOf(s)).toBe("Acme");
    expect(canRedo(s)).toBe(true);
    s = redo(s);
    expect(nameOf(s)).toBe("Beta");
    expect(canRedo(s)).toBe(false);
  });

  it("deleting lands on a neighbor, and undo restores the theme at its place, selected", () => {
    const a = acme();
    const b = { ...acme(), id: "b", name: "Beta" };
    const c = { ...acme(), id: "c", name: "Gamma" };
    let s = create(create(create(EMPTY, a), b), c);
    s = select(s, "b");
    s = perform(s, entry(b, { kind: "delete", index: 1, theme: b }));
    expect(s.themes.map((x) => x.name)).toEqual(["Acme", "Gamma"]);
    expect(nameOf(s)).toBe("Gamma");
    s = undo(s);
    expect(s.themes.map((x) => x.name)).toEqual(["Acme", "Beta", "Gamma"]);
    expect(nameOf(s)).toBe("Beta");
  });

  it("a rename, undone, is the old name; a new action after undo truncates the redo", () => {
    const a = acme();
    let s = create(EMPTY, a);
    s = perform(
      s,
      entry(a, { kind: "rename", from: "Acme", to: "Acme Co" }, 5000),
    );
    expect(nameOf(s)).toBe("Acme Co");
    s = undo(s);
    expect(nameOf(s)).toBe("Acme");
    expect(s.log).toHaveLength(2);
    s = perform(
      s,
      entry(a, { kind: "rename", from: "Acme", to: "Acme Inc" }, 9000),
    );
    expect(s.log).toHaveLength(2);
    expect(s.log[1]!.command).toMatchObject({ to: "Acme Inc" });
    expect(canRedo(s)).toBe(false);
  });

  it("undoing a change on another theme selects that theme first", () => {
    const a = acme();
    const b = { ...acme(), id: "b", name: "Beta" };
    let s = create(create(EMPTY, a), b);
    s = perform(
      s,
      entry(b, { kind: "rename", from: "Beta", to: "Beta 2" }, 5000),
    );
    s = select(s, a.id);
    expect(nameOf(s)).toBe("Acme");
    s = undo(s);
    expect(s.current).toBe("b");
    expect(nameOf(s)).toBe("Beta");
  });
});

describe("delete", () => {
  it("deleting the last theme lands on the one above; deleting the only theme leaves none", () => {
    const a = acme();
    const b = { ...acme(), id: "b", name: "Beta" };
    let s = create(create(EMPTY, a), b);
    s = perform(s, entry(b, { kind: "delete", index: 1, theme: b }));
    expect(nameOf(s)).toBe("Acme");
    s = perform(s, entry(a, { kind: "delete", index: 0, theme: a }));
    expect(s.themes).toEqual([]);
    expect(s.current).toBeNull();
    expect(describeCommand({ kind: "delete", index: 0, theme: a }).change).toBe(
      "Deleted",
    );
  });
});

describe("merging", () => {
  it("moves of the same step within the window are one entry, from the first to the last", () => {
    const a = acme();
    let s = create(EMPTY, a, 0);
    const from = step5(a);
    s = perform(
      s,
      entry(
        a,
        {
          kind: "step",
          ramp: "primary",
          index: 5,
          from,
          to: { ...from, L: 0.6 },
        },
        2000,
      ),
    );
    s = perform(
      s,
      entry(
        a,
        {
          kind: "step",
          ramp: "primary",
          index: 5,
          from: { ...from, L: 0.6 },
          to: { ...from, L: 0.58 },
        },
        2100,
      ),
    );
    expect(s.log).toHaveLength(2);
    expect(s.log[1]!.command).toMatchObject({ from, to: { ...from, L: 0.58 } });
    expect(step5(currentOf(s)!).L).toBe(0.58);
    s = undo(s);
    expect(step5(currentOf(s)!)).toEqual(from);
  });

  it("a move that returns to where it began leaves no entry", () => {
    const a = acme();
    let s = create(EMPTY, a, 0);
    const from = step5(a);
    s = perform(
      s,
      entry(
        a,
        {
          kind: "step",
          ramp: "primary",
          index: 5,
          from,
          to: { ...from, L: 0.6 },
        },
        2000,
      ),
    );
    s = perform(
      s,
      entry(
        a,
        {
          kind: "step",
          ramp: "primary",
          index: 5,
          from: { ...from, L: 0.6 },
          to: from,
        },
        2100,
      ),
    );
    expect(s.log).toHaveLength(1);
  });

  it("does not merge after the window, across steps, or right after an undo", () => {
    const a = acme();
    let s = create(EMPTY, a, 0);
    const from = step5(a);
    const move = (index: number, L: number, at: number) =>
      entry(
        a,
        { kind: "step", ramp: "primary", index, from, to: { ...from, L } },
        at,
      );
    s = perform(s, move(5, 0.6, 2000));
    s = perform(s, move(5, 0.61, 4000));
    expect(s.log).toHaveLength(3);
    s = perform(s, move(6, 0.5, 4100));
    expect(s.log).toHaveLength(4);
    s = undo(s);
    s = perform(s, move(5, 0.62, 4200));
    expect(s.log).toHaveLength(4);
    expect(s.log[3]!.command).toMatchObject({ to: { L: 0.62 } });
  });
});

describe("undoTo and redoTo", () => {
  it("rewind to an entry and forward again", () => {
    const a = acme();
    let s = create(EMPTY, a, 0);
    const names = ["One", "Two", "Three"];
    let prev = "Acme";
    names.forEach((to, i) => {
      s = perform(
        s,
        entry(a, { kind: "rename", from: prev, to }, 5000 * (i + 1)),
      );
      prev = to;
    });
    expect(nameOf(s)).toBe("Three");
    const two = s.log[2]!;
    s = undoTo(s, two.id);
    expect(nameOf(s)).toBe("One");
    expect(s.cursor).toBe(2);
    expect(s.log).toHaveLength(4);
    s = redoTo(s, s.log[3]!.id);
    expect(nameOf(s)).toBe("Three");
    expect(canUndo(s)).toBe(true);
    expect(undoTo(s, "nope")).toBe(s);
  });
});

describe("the log's size", () => {
  it("keeps the newest entries when it overflows", () => {
    const a = acme();
    let s = create(EMPTY, a, 0);
    for (let i = 0; i < MAX_ENTRIES + 10; i++) {
      s = perform(
        s,
        entry(
          a,
          { kind: "rename", from: `n${i}`, to: `n${i + 1}` },
          5000 * (i + 1),
        ),
      );
    }
    expect(s.log).toHaveLength(MAX_ENTRIES);
    expect(s.cursor).toBe(MAX_ENTRIES);
    expect(nameOf(s)).toBe(`n${MAX_ENTRIES + 10}`);
  });
});

describe("describe", () => {
  it("reads a step move by the channel that moved", () => {
    const from = { L: 0.62, C: 0.15, H: 250 };
    const d = describeCommand({
      kind: "step",
      ramp: "primary",
      index: 5,
      from,
      to: { ...from, L: 0.58 },
    });
    expect(d.change).toBe("primary 500 · L");
    expect(d.was.text).toBe("0.620");
    expect(d.now.text).toBe("0.580");
    expect(d.now.color).toEqual({ ...from, L: 0.58 });
  });

  it("reads seeds as hex, overrides as steps, and a create by where it came from", () => {
    const a = acme();
    expect(
      describeCommand({
        kind: "primary",
        from: a.primary,
        to: a.primary,
        before: [],
        after: [],
      }).now.text,
    ).toBe("#2563eb");
    expect(
      describeCommand({
        kind: "override",
        scheme: "light",
        token: "primary",
        from: null,
        to: { step: 7 },
      }),
    ).toMatchObject({
      change: "light primary step",
      was: { text: "preset" },
      now: { text: "700" },
    });
    expect(
      summarize(
        entry(a, {
          kind: "create",
          index: 0,
          theme: a,
          from: "Kansas City Chiefs",
          previous: null,
        }),
      ),
    ).toBe("Acme · Created · Kansas City Chiefs");
  });
});

describe("ramps", () => {
  const teal = {
    kind: "through",
    color: safeSeed(parseColor("#14b8a6")!, "srgb"),
    stops: "chromatic",
  } as const;
  const own = {
    kind: "hue",
    hue: 180,
    saturation: 0.5,
    stops: "chromatic",
  } as const;
  const rampNames = (s: Studio) => currentOf(s)!.ramps.map((r) => r.name);
  const tealOf = (s: Studio) =>
    currentOf(s)!.ramps.find((r) => r.name === "teal");

  it("adds, redraws and removes a ramp, each undoable and redoable", () => {
    const a = acme();
    let s = create(EMPTY, a);
    const added = withRamp(a, "teal", teal).ramps.at(-1)!;
    s = perform(s, entry(a, { kind: "add-ramp", index: 5, ramp: added }, 1000));
    expect(rampNames(s).at(-1)).toBe("teal");
    const redrawn = withRecipe(currentOf(s)!, "teal", own).ramps.at(-1)!;
    s = perform(
      s,
      entry(
        a,
        { kind: "redraw", ramp: "teal", from: added, to: redrawn },
        3000,
      ),
    );
    expect(tealOf(s)!.recipe).toEqual(own);
    s = perform(
      s,
      entry(a, { kind: "remove-ramp", index: 5, ramp: redrawn }, 5000),
    );
    expect(rampNames(s)).not.toContain("teal");
    s = undo(s);
    expect(tealOf(s)!.recipe).toEqual(own);
    s = undo(s);
    expect(tealOf(s)!.recipe).toEqual(teal);
    s = undo(s);
    expect(rampNames(s)).not.toContain("teal");
    s = redo(s);
    s = redo(s);
    s = redo(s);
    expect(rampNames(s)).not.toContain("teal");
    expect(canRedo(s)).toBe(false);
  });

  it("redraws of the same ramp within the window are one entry, from the first to the last", () => {
    const a = acme();
    let s = create(EMPTY, a);
    const red = currentOf(s)!.ramps.find((r) => r.name === "red")!;
    const at = (hue: number) =>
      withRecipe(currentOf(s)!, "red", { ...own, hue }).ramps.find(
        (r) => r.name === "red",
      )!;
    const first = at(10);
    s = perform(
      s,
      entry(a, { kind: "redraw", ramp: "red", from: red, to: first }, 1000),
    );
    const second = at(20);
    s = perform(
      s,
      entry(a, { kind: "redraw", ramp: "red", from: first, to: second }, 1500),
    );
    expect(s.log).toHaveLength(2);
    expect(s.log.at(-1)!.command).toMatchObject({
      kind: "redraw",
      from: red,
      to: second,
    });
    s = undo(s);
    expect(currentOf(s)!.ramps.find((r) => r.name === "red")).toEqual(red);
  });

  it("reads a redraw by its recipes, and an added or removed ramp by name", () => {
    const a = acme();
    const red = a.ramps.find((r) => r.name === "red")!;
    const d = describeCommand({
      kind: "redraw",
      ramp: "red",
      from: red,
      to: { ...red, recipe: { ...own, hue: 10, saturation: 0.9 } },
    });
    expect(d.change).toBe("red redrawn");
    expect(d.was.text).toBe("the seeds");
    expect(d.now.text).toBe("hue 10°, 90% chroma");
    expect(
      describeCommand({
        kind: "redraw",
        ramp: "teal",
        from: { ...red, name: "teal", recipe: teal },
        to: { ...red, name: "teal", recipe: { ...teal, stops: "neutral" } },
      }).now,
    ).toEqual({ text: "through #14b8a6, neutral stops", color: teal.color });
    expect(summarize(entry(a, { kind: "add-ramp", index: 5, ramp: red }))).toBe(
      "Acme · Added ramp · red",
    );
    expect(
      describeCommand({ kind: "remove-ramp", index: 5, ramp: red }),
    ).toMatchObject({ change: "Removed ramp", was: { text: "red" } });
  });
});
