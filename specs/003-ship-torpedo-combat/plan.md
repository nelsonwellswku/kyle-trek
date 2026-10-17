# Implementation Plan: Ship Torpedo Combat

**Branch**: `redo` | **Date**: 2026-10-16 | **Spec**: [spec.md](spec.md)

**Feature context**: `003-ship-torpedo-combat`. Setup resolves this feature independently of the current Git branch; no branch-switch hook is configured.

**Input**: Feature specification from `specs/003-ship-torpedo-combat/spec.md`

## Summary

Extend the two-player local game with strength, constitution, starting/current hit points, fixed armor class, and move-then-optional-attack turns. Add a feature-local battle state machine, immutable combat state, deterministic injectable dice, and a cancellable Phaser torpedo animator. Reuse the established board, random starting zones, reachability, and smooth ship flight. Hits use d20 plus strength against AC 12 and d8 plus strength damage; lethal damage ends the battle. Every attack finishes its visuals, result, and handoff/winner display within 1.5 seconds under the reference acceptance conditions.

## Technical Context

**Language/Version**: TypeScript 6.0.3, strict mode, ES2022 target; Node 24 and npm 11 for development.

**Primary Dependencies**: Phaser 4.2.1, Vite 8.3.4; existing DOM controls and procedural graphics. No added runtime dependencies.

**Storage**: In-memory immutable battle snapshots; no persistence, backend, or schema migration.

**Testing**: Vitest 5.0.5 with feature-local Node tests, scripted randomness, controlled animators, fake DOM and mocked Phaser; real Phaser browser fixture for visual/timing acceptance. ESLint 10.12.0, Prettier 3.9.10, TypeScript and Vite build checks.

**Target Platform**: Desktop browser with hardware-accelerated WebGL and mouse; existing 600 × 600 logical canvas with Phaser FIT scaling. Timing baseline: current stable desktop Chromium, foreground visible tab, 1280 × 800 viewport, at least four logical CPU cores and 8 GB RAM, no CPU/network throttling; record browser, OS, CPU, RAM, GPU, refresh rate.

**Project Type**: Single client-side web game organized by gameplay features.

**Performance Goals**: Each attack's full animation, result display, and next-turn availability or winner display within 1,500 ms of launch. Nominal animation is 1,150 ms to leave rendering margin. Preserve existing movement animation and ≤200 ms playable-highlight target. Verify individual timings rather than averages.

**Constraints**: Exactly two local players and ships on 100 squares; movement before optional attack; no attack range/ammunition/line-of-sight restrictions; no actions during animation. Starting HP is at least 1 without rerolling. Restart invalidates all old work. No new asset downloads, storage, network, authentication, or production stat editor.

**Scale/Scope**: One battle and at most one moving ship or torpedo sequence at a time. HP starts in 1–30, ability scores in 8–20. Existing movement-only code remains a regression reference while the application composes combat as its playable mode.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / gate | Before research | Post-design evidence |
| --- | --- | --- |
| Gameplay feature cohesion | Pass | Combat state, rolls, coordinator, UI, effects, and tests live in `ship-combat`; board and movement are explicit dependencies. `ship-stats` has one purpose and two consumers. |
| Specific, strong types | Pass | Validated stat values; literal armor class; readonly snapshots; discriminated attack/phase unions; typed identity tuples; no broad dynamic domain types. |
| Class-based composition | Pass | `BattleSession` composes rules/resolver; controller composes views/animators; `AgilityStat` composes `AbilityStat`. Only `CombatScene extends Phaser.Scene` is required by the framework contract. |
| Test-driven development | Pass as planned | Each implementation slice begins with an observed expected behavioral failure, then green/refactor and affected regressions. Commands/results go in a future `development.md`. No implementation or test-execution evidence is claimed by this plan. |
| Architecture/dependency review | Pass | Combat imports movement mechanics and ports, never a live movement `TurnSession`. No competing turn owner or inheritance for reuse; complete combat fields are retained through updates. |

Post-design result: all gates pass. No unjustified violation, unresolved technical decision, or constitution amendment is required.

## Project Structure

### Documentation (this feature)

```text
specs/003-ship-torpedo-combat/
├── spec.md
├── checklists/requirements.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/combat-ui.md
```

`tasks.md` and `development.md` belong to later task-generation and implementation phases.

### Source Code (repository root)

Planned additions and integration points:

```text
src/
├── app/
│   ├── GameApplication.ts                 # compose combat factory/session/scene/HUD
│   └── styles.css                         # combat HUD/results styling
└── features/
    ├── board/                             # existing board snapshot, geometry, view
    ├── game-setup/                        # reuse setup factory, randomness, shell
    ├── ship-stats/
    │   ├── domain/AbilityStat.ts
    │   └── tests/ability-stat.test.ts
    ├── ship-movement/
    │   ├── domain/AgilityStat.ts           # compose shared AbilityStat
    │   ├── domain/PendingMove.ts           # extract existing flight data contract
    │   ├── domain/TurnSession.ts           # compatibility re-export; old semantics retained
    │   └── presentation/FlightAnimator.ts  # import extracted contract
    └── ship-combat/
        ├── domain/
        │   ├── CombatGame.ts
        │   ├── CombatGameFactory.ts
        │   ├── DiceRoller.ts
        │   ├── AttackResolver.ts
        │   └── BattleSession.ts
        ├── presentation/
        │   ├── CombatScene.ts
        │   ├── CombatController.ts
        │   ├── CombatControls.ts
        │   ├── TorpedoAnimator.ts
        │   ├── PhaserTorpedoAnimator.ts
        │   └── TorpedoPath.ts
        └── tests/
            ├── *.test.ts                  # state, dice, UI, lifecycle, geometry, integration
            ├── fixtures/ControlledTorpedoAnimator.ts
            └── browser/
                ├── fixture.html
                └── fixture.ts
```

**Structure Decision**: Keep gameplay behavior feature-local. Reuse board and movement by their existing public shapes; move only the ability-score rule to the focused `ship-stats` capability, and extract movement's pending-animation contract from its session owner. Reuse `RandomSource` from setup without a gratuitous infrastructure migration. The app is the composition root. Existing movement and setup test suites remain regression coverage; app-level tests are updated to exercise combat wiring and ten setup draws.

## Phase 0: Research Decisions

Completed [research.md](research.md) covers battle authority, shared ability rules, random initialization, roll/commit timing, exact miss geometry, animation timing, cancellation, failure recovery, and validation boundaries. Source investigation resolves all technical context without new dependencies or unanswered questions.

## Phase 1: Design and Contracts

### Domain and state transitions

- `CombatGame` retains both validated, readonly complete ships. Position and damage updates preserve all other fields. `CombatGameFactory` composes setup and dice.
- `BattleSession` owns the sole phase union: movement-ready, awaiting-movement-skip, moving, attack-ready, attacking, finished, disposed.
- `AttackResolver` produces a discriminated hit/miss outcome once at launch. Misses consume no damage roll. Session commits the stored outcome after matching presentation completion.
- Movement completion/skip keeps the active player. Attack completion or End turn hands off once; lethal damage instead enters finished. Detailed fields, invariants, and transitions are in [data-model.md](data-model.md).

### Integration and lifecycle

- `CombatController` accepts phase-appropriate left clicks; transforms through `BoardGeometry`; clears movement highlights during animation and attack phases; updates DOM state and logical ship positions after matching completions.
- Scene initialization and New Game wait for the matching board postrender before allowing input. Preserve serialized replacement requests and generation-failure behavior in `GameApplication`.
- Replacement increments revision before cancelling move/projectile effects. Completion/failure/progress handlers require matching revision, token, action ID, and phase; synchronous callbacks before `start()` returns are supported. Disposal is idempotent.
- Movement animation failure restores origin and retry. Under FR-019, attack animation failure removes remaining effects, finalizes and displays the same already-rolled outcome once, exposes a presentation error, and makes the next turn or winner available within 1.5 seconds of launch; replacement/disposal cancellation never applies old damage.

### UI and effects

- Native controls show all stats and the active phase, offer Skip movement only when immobile, and offer End turn only while attack-ready. Keep native keyboard focus/activation and textual live outcome/winner messages consistent with the existing HUD.
- Procedural star travels directly on hits and along an analytically clear near-miss ray on misses. An explosion follows contact on hits. One finite tween drives effects, and all resources are destroyed on finish/cancel.
- User-facing behavior, input matrix, rendering readiness, animator identity contracts, and result semantics are defined in [contracts/combat-ui.md](contracts/combat-ui.md).

### Verification design

Follow [quickstart.md](quickstart.md) for deterministic boundary/phase checks, lifecycle failures, actual-Phaser visual and timing scenarios, existing-suite regression commands, and five-player usability acceptance. Test each behavior red first and retain meaningful regressions. Mocks establish orchestration and once-only semantics; real browser observations establish blinking/contact/off-board visuals and the 1.5-second wall-clock deadline.

## Complexity Tracking

No constitution violations require an exception. The battle coordinator is necessary because movement's turn coordinator intentionally has different handoff semantics; procedural effects and existing ports avoid additional frameworks or competing state owners.
