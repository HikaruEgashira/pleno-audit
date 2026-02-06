# 045: Dashboard View Modularization

## Status
Accepted

## Context
The audit extension dashboard implementation had grown into a single large component that combined data fetching, filtering, styling, and view rendering. This increased cognitive load, made targeted changes riskier, and encouraged tightly coupled state updates.

## Decision
Split the dashboard into focused modules:
- Hooks for data loading, derived stats, and filtered views.
- View components for each tab (overview, violations, network, domains, AI, services, events).
- Shared utilities/constants for tabs, period options, and styles.

## Consequences
- Dashboard behavior remains unchanged but becomes easier to navigate and extend.
- Side effects and derived data are centralized, reducing duplication.
- Additional files increase file count, but each file is smaller and more focused.
