# Architecture

`@jamiethompson/oklch` is a thin contract over [colorjs.io](https://colorjs.io).
colorjs.io does the math. This package decides what the math is allowed to say.

## The thesis

A generator can't know what yellow-500 should look like. An eye can. The
library's job is to make the eye faster and its calls measurable, never to sign
off. So nothing here generates a palette, picks a preset, or declares a pairing
fine. Every function answers one question about one color or one pair, and
answers it with a report.

## Three tiers

**Tier 1 — one color or one pair.** Parse, gamut, distance, contrast, the two
solvers, hue, format. This is the whole package today.

**Tier 2 — a list of steps.** `inspectRamp` measures a ramp the eye placed —
nothing is generated. `minPass` finds the first step that clears a surface.
`createScale` is the one continuous thing, for data rather than palettes. Built
from Tier 1's public surface only; `tests/architecture.test.ts` reads the Tier 2
sources and fails if they import anything else.

**Tier 3 — a whole system.** `resolveBinding` and `buildTokenSet` bind the
steps an eye placed to semantic roles, with a receipt per pairing; the three
exporters ship the set as CSS, DTCG design tokens, or a Tailwind theme. The
opinion layer, every part rebuildable from Tiers 1–2. A pairing that does not
clear is refused, not filled in — there is no fallback color anywhere.

The tiers are a guarantee, not a diagram: a higher tier has no privileged access
to anything below it. If it needed some, the public API would be incomplete, and
that would be a bug.

## The contract

Every function is a thin wrapper that adds the same five rules over colorjs.io:

1. **Parsers return null. Everything else throws by name**, naming the violation
   and the legal alternative. `parseColor` is the one function whose domain is
   untrusted input; every other function's input is a color a caller already
   holds, so a bad one is a bug and is refused as one.
2. **Angles wrap, amounts refuse.** Hue −30 is 330. Chroma −0.1 is an error, with
   the opposite-hue point named in the message.
3. **Map, never clip; map before measuring.** Gamut mapping is the CSS Color 4
   algorithm. The contrast meters are defined over sRGB and refuse anything
   outside it — measuring through a clamp flatters a color the display cannot
   show.
4. **No rounding, no normalization** between what was asked and what ships.
   colorjs.io's serializer gamut-maps and rounds to five digits by default; every
   call site opts out explicitly, and a test asserts the defaults are off.
5. **Every output is a report.** A map says what moved and by how much. A check
   says what each meter read, against which bar, with what margin. A solve says
   what ships, what was measured, and where the edge is. Nothing says "fine".

## P3 first, sRGB as the fallback

Every gamut-aware function takes the gamut. There is no default, because the
answer differs by screen and a default would be a silent decision. Browsers clip
rather than map, so a P3 literal shipped alone is a clip on every sRGB screen;
`gamutMap(color, "srgb")` is the tool for seeing what those screens should have
been handed instead. The solvers go further: a candidate is mapped into the
gamut that ships and measured on its sRGB fallback, and both are in the report.

## Receipts

A receipt is a usage guarantee, not a log of arithmetic. It attaches to a
pairing — this token on that surface — and states that the pairing was verified,
what each meter read, and **which standard that reading answers to**. A WCAG 2.2
ratio is a conformance claim with legal weight in most regions; an APCA Lc is a
design signal and legal cover for nothing. A number without its standard invites
exactly the misplaced confidence this package exists to prevent, so a receipt
always carries both, by name.

## Where invariants live

Output invariants live in core: hue in [0, 360), no `NaN` out of a serializer.
Non-termination is fixed by construction: every search is a fixed-count bisection
or a fixed-count sweep, never a loop on a tolerance. Domain validation lives at
the boundary, in one small module that every function calls first.

## Tests

No oracle is needed against colorjs.io for math it performs. Tests assert the
contract: every refusal as a named throw, every report field present, colorjs.io's
defaults verified off, and one property test per bisection — the result clears,
one step further does not.

## Prior art

`color-engine-mcp` (culori + apca-w3) is the closest thing: parse, convert,
contrast, gamut map, ramp, solve. sRGB target only, WCAG-only solver, near-miss
tolerance instead of refusal, never throws, clamps hex. Four things not found
anywhere else are the product here: P3 as a target with a reported fallback, APCA
as a solver target, a safe-prefix `maxChroma`, and refusal semantics.
