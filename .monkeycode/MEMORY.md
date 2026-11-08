# User Instruction Memory

This file records user instructions, preferences, and teachings for reference in future interactions.

## Format

### User Instruction Entry
User instruction entries should follow this format:

[User Instruction Summary]
- Date: [YYYY-MM-DD]
- Context: [Mentioned scenario or time]
- Instructions:
  - [Content of user teaching or instruction, described line by line]

### Project Knowledge Entry
Entries discovered by the Agent during task execution should follow this format:

[Project Knowledge Summary]
- Date: [YYYY-MM-DD]
- Context: Discovered by Agent while performing [specific task description]
- Category: [Operations & Deployment|Build Methods|Testing Methods|Troubleshooting & Debugging|Workflow & Collaboration|Environment Configuration]
- Instructions:
  - [Specific knowledge points, described line by line]

## Deduplication Strategy
- Before adding a new entry, check for similar or identical instructions.
- If a duplicate is found, skip the new entry or merge it with the existing one.
- When merging, update the context or date information.
- This helps avoid redundant entries and keeps the memory file tidy.

## Entries

[Plant pot replacement is approximate]
- Date: 2026-11-08
- Context: User reviewed the leaf-pattern pot overlay after viewBox crop (commit b3f09f0); accepted current quality and will later provide element-separated assets for a deeper pass.
- Category: Troubleshooting & Debugging
- Instructions:
  - Plant stage PNGs bake in terracotta pot + stone saucer. Current replacement crops the base art via nested svg viewBox (`POT_CUT` in visuals.js) and draws `acc-plant-1` behind foliage.
  - Crop + overlay still leaves a visible seam / scale mismatch. Do not spend more cycles on clipPath, extra crop ratios, or WEAR_POS hacks for this pot.
  - Wait for layered exports (plant / pot / saucer as separate PNGs). Same constraint applies to adult cat/dog baked-in collar, scarf, and kerchief.
  - When layered assets arrive, treat pot as a furniture/base slot behind the plant, not as a worn overlay on a baked pot.

[Playwright and preview]
- Date: 2026-11-08
- Context: Discovered by Agent while running browser tests and local preview
- Category: Testing Methods
- Instructions:
  - Playwright: `require('/usr/local/lib/node_modules/@playwright/test')`, `channel:'chromium'`, `headless`, `--no-sandbox`, `process.exit`; scripts under `/tmp/opencode`.
  - Preview server: port 8000, `python3 -m http.server 8000 --directory /workspace`.
  - Full regression: `node --test engine.test.cjs visuals.test.cjs audio.test.cjs` then `node browser.test.cjs`.
