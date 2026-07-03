---
name: Tailwind v4 CSS @import ordering
description: Fix for "vite:css @import must precede all other statements" when adding a Google Fonts @import alongside Tailwind v4's own @import "tailwindcss".
---

In Tailwind v4 projects (`@import "tailwindcss"` at the top of the theme CSS file), adding an external stylesheet import (e.g. Google Fonts) anywhere after `@import "tailwindcss"` can trigger a PostCSS/Lightning CSS error: `@import must precede all other statements (besides @charset or empty @layer)` — even though it visually looks like the `@import` is near the top of the file.

**Why:** Tailwind's own `@import "tailwindcss"` expands into a large inlined stylesheet during processing; once that expansion happens, any `@import` written after it is no longer the first statement in the actual token stream, which violates the CSS spec rule that `@import` must be first.

**How to apply:** put any external/font `@import url(...)` as the literal first line of the CSS file, before `@import "tailwindcss"` and before `@import "tw-animate-css"` or any `@plugin`/`@custom-variant` directives. This is a design-subagent-generated pattern that reliably causes this exact error — check for it whenever a subagent adds a Google Fonts import to `index.css`.
