/** Theme names: a fresh one for a new theme, and a copy's. */

/** Football words; any first with any second makes a name, like "Red Zone" or "Shotgun Snap". */
const FIRST = [
  "Blindside",
  "Blitz",
  "Bootleg",
  "Crossbar",
  "Dime",
  "Endzone",
  "Flea",
  "Fourth",
  "Fullback",
  "Goalline",
  "Gridiron",
  "Hail",
  "Halfback",
  "Iron",
  "Kickoff",
  "Midfield",
  "Nickel",
  "Pigskin",
  "Pistol",
  "Playbook",
  "Punt",
  "Red",
  "Shotgun",
  "Sideline",
  "Spiral",
  "Sudden",
  "Tailgate",
  "Touchback",
  "Turf",
  "Wildcat",
];

const SECOND = [
  "Audible",
  "Blitz",
  "Bomb",
  "Draw",
  "Drive",
  "Fumble",
  "Huddle",
  "Kicker",
  "Lateral",
  "Mary",
  "Option",
  "Pass",
  "Pocket",
  "Punter",
  "Rally",
  "Reverse",
  "Rush",
  "Sack",
  "Screen",
  "Slant",
  "Snap",
  "Spike",
  "Stack",
  "Sweep",
  "Tackle",
  "Trick",
  "Victory",
  "Zone",
];

const sameName = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

/** Whether a name is already some theme's, ignoring case and the spaces around it. */
export function isNameTaken(name: string, names: Iterable<string>): boolean {
  for (const n of names) if (sameName(n, name)) return true;
  return false;
}

/** The name, or the first of "name 2", "name 3", … that no theme has. */
export function uniqueName(name: string, names: Iterable<string>): string {
  const taken = [...names];
  if (!isNameTaken(name, taken)) return name;
  for (let n = 2; ; n++) {
    const next = `${name} ${n}`;
    if (!isNameTaken(next, taken)) return next;
  }
}

/** A copy's name, as Finder names one: "Acme copy", then "Acme copy 2"; a copy of a copy counts on. */
export function copyName(name: string, names: Iterable<string>): string {
  const base = /^(.*) copy(?: \d+)?$/.exec(name)?.[1] ?? name;
  return uniqueName(`${base} copy`, names);
}

/** A two-word football name no theme has yet, like "Red Zone". */
export function autoName(
  names: Iterable<string>,
  random: () => number = Math.random,
): string {
  const taken = [...names];
  const pick = (words: readonly string[]) =>
    words[Math.floor(random() * words.length)]!;
  for (let tries = 0; tries < 50; tries++) {
    const name = `${pick(FIRST)} ${pick(SECOND)}`;
    if (!isNameTaken(name, taken)) return name;
  }
  return uniqueName(`${pick(FIRST)} ${pick(SECOND)}`, taken);
}
