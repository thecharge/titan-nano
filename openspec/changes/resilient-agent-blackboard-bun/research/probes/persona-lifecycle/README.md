# Persona lifecycle probe

Run on 2026-11-05 on Linux x86-64 with Bun 1.3.10.

- `simulate.ts`: simulates personas whose true survival rate is known. It checks how often each rule for "this persona needs an update" is wrong, and how often each rule for "which persona to pick" picks the worse one. It uses a fixed seed, so every run gives the same output. Run `bun simulate.ts`. Output: `simulate-output.txt`.
- The bar of 0.6 is a guess that has not been measured. `simulate.ts` assumes that a persona's true rate does not change over time.
- `drift.ts`: tests what `simulate.ts` assumed away. First, two personas swap rates halfway through. Second, two personas are almost equally good. Run `bun drift.ts`. Output: `drift-output.txt`. Plain Thompson sampling failed the first test. Counts that fade by 0.98 for each pick passed it. The fade of 0.98 and the floor of 10 % are guesses that have not been measured.
