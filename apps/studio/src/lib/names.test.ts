import { describe, expect, it } from "vitest";

import { autoName, copyName, isNameTaken, uniqueName } from "./names.ts";

describe("names", () => {
  it("are taken ignoring case and the spaces around them", () => {
    expect(isNameTaken(" acme ", ["Acme"])).toBe(true);
    expect(isNameTaken("Acme Co", ["Acme"])).toBe(false);
  });

  it("are numbered when taken", () => {
    expect(uniqueName("Acme", ["Beta"])).toBe("Acme");
    expect(uniqueName("Acme", ["Acme", "Acme 2"])).toBe("Acme 3");
  });

  it("name a copy as Finder does, and a copy of a copy counts on", () => {
    expect(copyName("Acme", ["Acme"])).toBe("Acme copy");
    expect(copyName("Acme", ["Acme", "Acme copy"])).toBe("Acme copy 2");
    expect(copyName("Acme copy", ["Acme", "Acme copy"])).toBe("Acme copy 2");
    expect(copyName("Acme copy 2", ["Acme copy", "Acme copy 2"])).toBe(
      "Acme copy 3",
    );
  });
});

describe("autoName", () => {
  it("is two capitalized words", () => {
    expect(autoName([])).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
  });

  it("is never a name a theme has", () => {
    const first = autoName([], () => 0);
    expect(autoName([first], () => 0)).toBe(`${first} 2`);
  });
});
