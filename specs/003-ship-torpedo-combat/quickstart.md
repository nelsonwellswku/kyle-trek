# Quickstart Validation: Ship Torpedo Combat

**Status:** Design-time validation guide. Combat tests and the browser fixture described below must be created during implementation; this plan does not claim they exist or have passed.

## Prerequisites

- Node 24 and npm 11; install locked dependencies with `npm ci` if needed.
- Run commands from the repository root.
- Read [data model](data-model.md) and [UI contract](contracts/combat-ui.md).
- Desktop browser with WebGL and a mouse. For SC-009 timing use current stable Chromium, foreground visible tab, 1280 × 800 viewport, hardware-accelerated WebGL, ≥4 logical CPU cores and ≥8 GB RAM. Disable CPU/network throttling. Record browser version, OS, CPU, RAM, GPU, and display refresh rate.

## Test-first implementation and automated checks

For each behavior slice, first add a meaningful test, run it, and observe failure for the missing behavior. Then implement, run green, refactor, and rerun affected tests. Record commands, failure reasons, and passing results in `specs/003-ship-torpedo-combat/development.md` during implementation. Compilation or missing-module failures alone are not the required red evidence.

After the planned tests exist:

```bash
npm test -- src/features/ship-stats/tests
npm test -- src/features/ship-combat/tests
npm test -- src/features/ship-movement/tests
npm test -- src/features/board/tests
npm test -- src/features/game-setup/tests
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
```

Expect feature discovery to select real tests; do not suppress empty selection. Update application tests for the combat composition and ten initialization random draws; retain movement-only session tests for their existing semantics.

### Deterministic acceptance cases

| Coverage | Required checks |
| --- | --- |
| Stats / SC-001 | Exhaust all 13 ability scores across agility/strength/constitution, exact mapping and nonpositive agility allowance; invalid/fractional/out-of-range values rejected |
| Initialization / SC-002, SC-008 | 100 known-roll setups, ten-draw ordering, independent bucket selection; HP roll 0 and 20; constitution −1 and +5; HP clamp to 1; AC 12; 1,000 deterministic setups for ranges and mapping |
| Turns / SC-003 | 50 turns mixing attacks and End turn; movement retains player/token; no-move acknowledgement opens attack; both immobile ships do not cycle automatically; invalid, early, repeated, non-left clicks do not consume actions |
| Rolls / SC-004 | At least 100 controlled attacks covering total 11 miss, total 12 hit, all strength modifiers, d20 and d8 endpoints, zero damage, nonlethal hit, exact lethal damage and overkill |
| RNG consumption | Miss draws d20 only; hit draws d20 then d8; End turn and invalid input draw nothing; invalid random sample never partially mutates battle state |
| State preservation | Moves preserve all combat values; damage changes only defender current HP; HP unchanged until matching animation completion; last result persists until replaced |
| Victory / SC-006 | Lethal commit declares attacker winner without opening another turn; final state rejects gameplay input; New Game resets winner, HP, stats, and player |
| Lifecycle | Duplicate/stale completions, progress/failures, synchronous callbacks, movement recovery, attack visual failure without reroll, disposal, replacement during travel/explosion, queued New Game, failed replacement generation |
| Path geometry | Hit endpoint exact; miss segment analytically clears defender, closest approach on-board, endpoint fully off-board; adjacency, edge, corner, diagonal, and maximum separation |

Use injected scripted samples and controlled animators; do not use uncontrolled random trials as a CI fairness oracle. Samples do not prove independence/equal probability: also review separate draws and equal-width bucket mapping.

## Normal browser play

```bash
npm run dev
```

Open `http://127.0.0.1:5173/`.

1. Confirm exactly one board/canvas, opposing-zone starts, Player 1 first, and both ships' distinct scores/modifiers, HP, and AC 12.
2. If a ship can move, click one highlighted destination. Confirm existing smooth collision-free flight, then the same player receives the attack choice. Attempting an attack before movement must do nothing.
3. If immobile, confirm an explanation and **Skip movement**; click it and confirm attack-ready without moving or handing off.
4. Click the opponent's square. Confirm one blinking star and hit/explosion or near-miss/off-board behavior, a readable result, correct HP, then one handoff. Inputs during either animation do nothing.
5. On another attack-ready turn choose **End turn**. Confirm no torpedo or HP change and exactly one handoff. End turn must be unavailable before movement, during animations, and after victory.
6. Continue to a lethal hit; confirm HP 0, correct winner, and no further gameplay changes. Start a fresh game and check reset.
7. Use New Game during flight, torpedo travel, and explosion. Confirm no old callbacks or effects alter the replacement. Repeat rapid requests; retain one canvas/listener set.
8. Resize and test cell targeting under FIT scaling. Tab to native New Game/Skip movement/End turn controls and activate available buttons. Confirm readable phase/result text and no console errors.

## Reproducible actual-Phaser fixture

Implementation must provide a development-only fixture at:

`http://127.0.0.1:5173/src/features/ship-combat/tests/browser/fixture.html`

It must use production `CombatScene`, controller, session, board view, and animators, with injected deterministic dice and validated live combat states. Provide preset selection/reset and observations for launch, contact/exit, effect completion, result display, next actionable frame, and winner display, keyed by revision/attack ID. Do not import the fixture from production or add production stat editing. Fixtures may construct live positions outside starting zones without weakening production initialization rules.

| Preset | Setup / action | Expected result |
| --- | --- | --- |
| Threshold miss | Strength 10, d20 11; move/skip then attack | Total 11 misses; no d8/HP change; projectile exits |
| Threshold hit | Strength 10, d20 12, d8 4 | Total 12 hits; 4 damage after contact/explosion |
| Zero damage | Strength 8, d20 13, d8 1 | Total 12 hits and explodes; zero HP loss |
| Lethal / overkill | Defender HP 1; guaranteed hit, damage ≥1 | HP 0 and attacker winner; no opponent input |
| Adjacent | Ship centers one cell apart; repeat hit/miss | Direct contact or analytically clear near miss |
| Edge / corner | Defender at (1,1), (1,10), (10,1), (10,10) in separate presets | Miss visibly passes defender before full off-board exit |
| Maximum distance | Ships at opposing corners; fixed hit/miss | Deadline holds despite long distance |
| Immobile | Agility 8 or 10 | Explicit Skip movement, then optional attack/End turn |
| Reset interruption | Reset during travel or explosion | Fresh Player 1 battle; old effects/outcome cancelled |

## Visual, timing, and usability acceptance

- Observe at least 20 attacks across hits/misses, adjacency, maximum distance, edges/corners, and lethal hits. Verify blinking-star motion, contact-before-explosion on hits, close noncontact paths and complete off-board disappearance on misses, and no duplicate HP changes/handoffs.
- Measure from accepted launch to the first rendered frame showing both completed result and actionable next turn, or winner for lethal hits. Include flight and explosion/exit, not merely tween elapsed configuration. **Every measured attack must be ≤1,500 ms**; retain individual measurements and report every failure, not an average.
- Verify the result isn't announced before visual impact/outcome and HP is not reduced at launch. Check 0-damage hits and overkill display.
- Preserve established movement visual checks and timing targets. Reuse the acceptance environment above; foreground timing does not promise execution while a browser tab is suspended.
- Run five first-time-player trials. At least four must identify both ships' current HP, perform legal movement, launch an attack, and identify its result without assistance (SC-007).
- Record actual environment, screenshots/observations, timings and usability outcomes. Mocked Phaser tests cannot substitute for these checks. Mark browser checks pending if a real browser is unavailable.

## Production-build smoke check

```bash
npm run build
npm run preview
```

Open `http://127.0.0.1:4173/` and repeat setup, movement/skip, attack/End turn, victory, resize, and New Game checks. The test-only fixture is not a required production route.

## Completion evidence

Retain red-green-refactor commands/results, deterministic coverage, final static/test/build checks, real-browser timing and visual records, and usability results in the implementation development record. Review feature ownership, typed boundaries, class composition, and Phaser inheritance justification against the constitution before acceptance. Planning artifacts and specification-quality checkbox state do not establish implementation completion.
