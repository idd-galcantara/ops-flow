# Requirements - ops-flow v0.6.1 dark-mode readability

## Scope

This specification covers the frontend dark theme readability improvement. It preserves the
existing theme toggle, light theme, component structure, and read-only product boundary.

## Requirements

### Requirement 1 - Keep dark-theme text readable

1. WHEN the dark theme is active THEN primary text SHALL remain clearly distinguishable from
   the application surfaces.
2. WHEN secondary text, metadata, labels, or technical values are rendered THEN their contrast
   SHALL remain sufficient for comfortable reading without requiring increased browser zoom.
3. Dark-theme surfaces, fields, borders, and hover states SHALL retain enough separation that
   text is not visually lost against the background.

### Requirement 2 - Preserve visual hierarchy

1. Primary text SHALL remain stronger than secondary text while both remain legible.
2. Technical labels and metadata SHALL use the dark-theme semantic tokens instead of falling back
   to low-contrast light-theme gray literals.
3. The improvement SHALL not change the light theme's existing appearance or the theme toggle
   persistence behavior.

### Requirement 3 - Preserve product boundaries

1. The change SHALL remain frontend-only.
2. The change SHALL not add backend routes, Kubernetes mutation operations, or renderer filesystem
   access.
3. Frontend typecheck and tests SHALL pass after the styling change.

## Definition of done

- Dark-theme primary and secondary text is readable across the main shell, tables, details,
  forms, and preset UI.
- Dark-theme surfaces and controls have clear visual separation.
- Light-theme behavior and theme persistence remain unchanged.
- Frontend typecheck and tests pass.
- A manual desktop and narrow-viewport visual smoke test is recorded.