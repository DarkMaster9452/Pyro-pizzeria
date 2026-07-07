# Brand logos

The header (and other places) use these two logo files:

- `pyro.svg`        → Pyro Pizzeria logo
- `polomarik.svg`   → Polomárik Pizzeria logo

The committed `.svg` files are clean placeholder lockups built from the printed
menu artwork. To use the exact brand art, replace a file in place (keep the same
name), or drop a transparent PNG next to it and point `logo` in
`src/lib/data.ts` at the new file. Recommended height ~96px; they render at 48px
(2× for retina). If a logo file is missing, the header falls back to a script
wordmark automatically.
