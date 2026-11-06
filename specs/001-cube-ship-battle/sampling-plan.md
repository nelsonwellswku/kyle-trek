# Seeded statistical sampling plan

This plan is fixed before running the statistical acceptance tests. It tests the random draws used by the implemented setup, combat, and visual-effect paths; passing it is evidence for these seeded samples, not a proof of the underlying random generator.

## Samples and seed allocation

- Use 20,000 independent trials for each sample family.
- Setup uses `random.Random(46061)`. Each trial creates a complete battle and records each ship's eligible starting cell, all six ability scores, and the raw 0..20 hit-point draw before the constitution modifier and HP floor are applied.
- Visual effects use `random.Random(47047)` and produce one miss angle and side per trial using the real `CombatEffectPlanner`.
- Gameplay combat uses a distinct `random.Random(47048)` and produces one d20 result per trial using `CombatRules`; d8 results are recorded on hit trials only, as required by the rules.
- Each seed is fixed so the test is exactly reproducible. Setup, visual, and gameplay streams are distinct objects. The sampled miss uses fixed, well-separated cells and a fixed screen projection so every planned effect has feasible geometry.

## Hypotheses and test family

Use Pearson chi-square goodness-of-fit tests for:

1. Each ship's 50 eligible starting cells, with equal expected frequency.
2. Each of the six 8..20 ability-score draws, with equal expected frequency.
3. Each ship's underlying 0..20 HP draw before constitution adjustment and flooring, with equal expected frequency.
4. The 10..35 integer miss angle, the two miss sides, gameplay d20, and hit-conditional gameplay d8, each with equal expected frequency over its stated support.

Use Pearson chi-square tests of independence for all 45 pairings among the ten setup draw variables (two complete cell choices, six scores, and two raw HP draws). A cell choice is treated as one 50-category outcome, so its goodness-of-fit test checks the joint eligible-cell distribution. Also test the angle/side, angle/d20, and side/d20 pairings for independence. These last three tests detect coupling between miss-path randomness and gameplay dice as well as angle/side coupling.

The family contains 62 p-values: 14 goodness-of-fit tests and 48 independence tests. Every expected contingency-table cell has expected count at least 5 at this sample size (the minimum is 20,000 / 2,500 = 8 for the two 50-cell placements). Apply Holm–Bonferroni step-down correction to the complete family at family-wise significance level 0.05. Reject in sorted p-value order while `p <= 0.05 / (62 - rank)`; stop at the first non-rejection. Any rejection fails the acceptance test.

## Reporting

Record the seeds, trial counts, test-family size, correction and threshold, number of rejected hypotheses, and test command/result in `development.md`. Retain automated results separately from display-based performance and usability acceptance.
