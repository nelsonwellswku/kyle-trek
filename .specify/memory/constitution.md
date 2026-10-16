# Kyle Trek Constitution

## Core Principles

### I. Gameplay Feature Cohesion

The codebase MUST be organized primarily around gameplay features and capabilities.
Code belonging to a feature MUST live together within that feature's boundary, including
its state, behavior, interfaces, and tests. Top-level groups organized solely by technical
role, such as models, controllers, or services, MUST NOT be the primary project structure.
Shared capabilities MUST have an explicit purpose and consumers across feature boundaries.
This organization keeps gameplay changes localized and makes feature ownership clear.

### II. Specific, Strong Types

Code MUST use specific, strongly typed representations wherever the language and dependencies
support them. Domain concepts and contracts MUST use types that express their valid structure
and values rather than unnecessarily broad or dynamic representations. Less-specific or
dynamic types MAY be used only where required for compatibility with third-party libraries.
Such exceptions MUST be localized to the integration boundary, documented with the compatibility
reason, and converted or validated into specific project types before use by gameplay code.
This preserves explicit contracts and makes invalid states easier to detect.

### III. Class-Based Design Through Composition

Application structure MUST be class-based and object-oriented, with classes encapsulating
cohesive state and behavior and collaborating through explicit contracts. New behavior MUST
prefer composition of focused collaborators over inheritance. Inheritance MUST have a
documented substitutability or third-party compatibility justification; reuse alone is not
sufficient. This keeps gameplay capabilities independently changeable and avoids coupling
unrelated behavior through class hierarchies.

### IV. Test-Driven Development (Non-Negotiable)

Every feature and bug fix MUST follow the red-green-refactor cycle. Before implementing a
change, write a test that demonstrates the missing or broken behavior and run it to confirm
that it fails for the expected behavioral reason. Implement the change only after observing
that failure, then run the test and confirm that it passes. Refactor after reaching green,
rerunning the relevant tests to keep them passing. An unrelated setup, compilation, or
dependency failure does not establish the required red state. Bug fixes MUST retain the
demonstrating test as regression coverage. This process provides evidence that tests detect
the behavior they protect.

## Architecture Constraints

- Feature boundaries and dependencies MUST be explicit in implementation plans and code.
  Technical-role subdivisions MAY exist within a feature when useful.
- A shared capability MUST have cohesive responsibility; unrelated feature code MUST NOT be
  collected into generic shared containers merely because it has the same technical role.
- Feature contracts MUST expose specific types. Third-party compatibility exceptions and
  inheritance justifications MUST be recorded alongside the affected boundary or design.
- Design reviews MUST evaluate feature cohesion, type specificity, class responsibilities,
  and composition before accepting a proposed architecture.

## Development Workflow and Review

1. Define the observable behavior and identify the owning gameplay feature or capability.
2. Write the behavior test before implementation and run it. Record the command and the
   expected behavioral failure in the change's development or review record.
3. Implement the smallest change that satisfies the behavior while following the architecture
   principles, then run the demonstrating test and confirm that it passes.
4. Refactor with tests passing and run the relevant feature and affected integration tests.
   Record the successful verification commands and results.
5. Before acceptance, review the change against every core principle. Reviewers MUST verify
   red-green-refactor evidence, feature placement, type choices, and composition decisions.
   A noncompliant change MUST be corrected or preceded by an approved constitution amendment.

## Governance

This constitution governs project architecture and development practices. Project plans,
specifications, implementation tasks, and reviews MUST comply with it. Conflicting project
guidance MUST be reconciled with this constitution before the affected work is accepted.

Amendments MUST document the proposed rule changes, rationale, affected practices, and any
required migration. A project maintainer MUST approve an amendment before it takes effect.
Each amendment MUST update the version, last-amended date, and temporary Sync Impact Report;
the original ratification date MUST be preserved. The report is review scratch material and
MUST be removed before the amended constitution is committed.

Versions MUST follow semantic versioning: MAJOR for incompatible principle removals or
redefinitions, MINOR for new principles or materially expanded guidance, and PATCH for
clarifications or other non-semantic refinements. Initial adoption is version 1.0.0.

Every implementation plan and change review MUST check compliance. Any proposed exception
outside an explicitly permitted rule MUST follow the amendment procedure rather than being
silently accepted. Maintainers MUST review related guidance for consistency when approving
amendments; dependent commands and templates consume this constitution at runtime.

**Version**: 1.0.0 | **Ratified**: 2026-10-15 | **Last Amended**: 2026-10-15
