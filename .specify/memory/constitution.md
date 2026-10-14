<!-- Sync Impact Report
Version change: (none) → 1.0.0 (initial adoption)
Modified principles: none (initial document; template placeholders replaced)
Added sections:
- Core Principles I–V (Gameplay Correctness, Player Clarity, Test-First Rules, Data-Driven Content, Pragmatic Simplicity)
- Additional Constraints: Technical & Performance Standards
- Development Workflow & Quality Gates
- Governance (amendment procedure, versioning, compliance review)
Removed sections: none
Follow-up TODOs: none
-->

# kyle-trek Constitution

## Core Principles

### I. Gameplay Correctness & Deterministic Rules
Every game rule MUST be explicit, deterministic, and independently verifiable.
Turn resolution, RNG, and state transitions MUST be reproducible from a given
seed + state. Non-determinism MUST be isolated to a seedable RNG source.
Rationale: turn-based games live or die on player trust; deterministic rules
enable testing, replays, save/load, and bug reproduction.

### II. Player Clarity & Feedback
Every game state change MUST be legible to the player. All actions, odds,
costs, and outcomes MUST be previewable or explainable before or immediately
after the action. No silent state changes, no hidden modifiers affecting turns
without disclosure in UI or logs. Rationale: strategy requires informed
decisions; clarity is more valuable than visual polish in 2D turn-based play.

### III. Test-First Game Rules (NON-NEGOTIABLE)
Game logic MUST follow TDD: tests for rules/turn/state written before
implementation, verified to fail, then implemented to pass. Required coverage:
new rules, rule changes, turn/state transitions, win/lose conditions,
save/load round-trips, and RNG-seeded edge cases. UI rendering MAY be tested
manually; core simulation MUST NOT rely on manual testing.
Rationale: rule interactions compound quickly; only automated rule tests keep
refactoring safe.

### IV. Data-Driven Content
Game content (units, items, abilities, maps, encounters, tuning values) MUST be
defined as data separate from simulation code. Code implements mechanics;
data defines instances. No hard-coded stats or content tables in logic files.
Balance changes MUST NOT require logic rewrites. Rationale: enables rapid
iteration, modding, and balance tuning without destabilizing core systems.

### V. Pragmatic Simplicity & Sufficient Performance
Prefer the simplest implementation that satisfies the rules and remains
readable; YAGNI applies. Performance MUST meet sufficiency targets rather than
maximal optimization: responsive UI input, turn resolution without perceptible
stall, stable frame rate for 2D rendering. No premature optimization, no custom
engines/frameworks, no architectural complexity without a justified gameplay
need. Rationale: for a 2D turn-based game, maintainability and iteration speed
outweigh raw throughput; performance work MUST be driven by measured gaps.

## Technical & Performance Standards

This is a 2D turn-based game; correctness, clarity, and iteration speed
outrank raw performance.

- Stack: prefer simple, well-supported 2D tooling; new dependencies MUST be
justified and documented.
- Performance targets (sufficiency, not ceilings): UI input acknowledged
without perceptible lag; typical turn resolution completes promptly on modest
hardware; no allocations or work per frame that cause visible stutter.
Measure before optimizing; profiling evidence REQUIRED for perf-driven
refactors.
- State & persistence: full game state MUST be serializable; save/load MUST
round-trip exactly, including RNG state and pending turn queue.
- Compatibility & assets: pixel/sprite assets MUST use lossless or
project-standard formats; audio MUST degrade gracefully when unavailable.
- Accessibility baseline: readable fonts/scales, keyboard- and mouse-playable
turns, color is never the sole signal for critical state.

## Development Workflow & Quality Gates

- Small, reviewable changes: one rule/mechanic per change set where feasible.
- Before merge, every change MUST: pass rule tests, include tests for new or
changed rules, preserve save/load compatibility or document a migration, and
update data files/docs when tuning changes.
- Code review MUST verify: constitution compliance, rule determinism, player
clarity of affected UX, and absence of logic/data mixing.
- Complexity MUST be justified in the change description; speculative systems
(game modes, multiplayer, editors) MUST NOT be built ahead of need.
- Bug fixes MUST add a regression test reproducing the faulty rule or state.

## Governance

This constitution supersedes all other practices for kyle-trek development.
All specifications, plans, and reviews MUST verify compliance with Core
Principles; violations MUST be explicitly justified and recorded.

- Amendments: proposed via documented rationale, impact on existing rules, and
migration plan if behavior changes. Approval by project owner.
- Versioning: semantic — MAJOR for incompatible principle removals or
redefinitions, MINOR for new principles or materially expanded guidance,
PATCH for clarifications and wording fixes.
- Compliance review: every spec and plan MUST cite applicable principles;
reviews MUST reject non-compliant work unless a waiver with expiry is granted.
- Runtime guidance: use `.specify/memory/constitution.md` as the authoritative
source; dependent templates and commands read it at runtime.

**Version**: 1.0.0 | **Ratified**: 2026-10-14 | **Last Amended**: 2026-10-14
