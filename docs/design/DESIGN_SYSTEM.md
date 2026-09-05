# Ngerti.in design system

Light, Duolingo-inspired foundation with Spark Blue (`#1cb0f6`) as the primary. Preview locally with `bun dev:web`, then open `/design-system.html`. This standalone Vite development entry does not need Clerk or API access and is not included in the production application build.

## Foundation

- Semantic tokens live in `apps/web/src/index.css`. Use `bg-primary`, `text-foreground`, `text-muted-foreground`, `border-input`, and related semantic utilities in new UI.
- Local Fontsource fonts: Nunito Sans 500/700 for body and controls; Nunito 900 (`font-display font-black`) for display headlines at 36–48px. No proprietary Duolingo font or mascot assets.
- White canvas, charcoal body text, 12px field corners, 16px button corners, 20px card corners, and 2px outlines. Buttons use a solid 3–4px bottom edge with a pressed state, following the updated screenshot reference. No blurred shadows or glass. Gradients are limited to the decorative dashboard learning banner.
- Keep Tailwind's standard 4px spacing unit: `gap-3` = 12px, `p-4` = 16px, `p-6` = 24px. Do not redefine `--spacing-8` as 8px: Tailwind uses it for `p-8`, which must remain 32px.
- Layout tokens: 1200px maximum page width, responsive 80–120px section gaps, 16–24px card padding. These marketing dimensions are optional for learning screens.
- Body is 16px/1.47, card titles 18px, section titles 24px, and button labels 14px (13px small). Uppercase/tracking is for buttons and navigation, never prose.

## Color adaptations

The user's explicit primary choice overrides conflicting green/blue CTA restrictions in the supplied reference. Blue owns primary actions and display accents; green remains available for successful answers/progress.

Primary text uses white following the updated user direction. White on `#1cb0f6` does not meet WCAG AA text contrast; this is an intentional visual tradeoff, not an accessibility certification. Interactive text uses darker `--link: #0077ad`; muted copy uses `#707070`. The original reference palette remains available as named tokens. Use muted/disabled colors only for their intended roles.

## Components

`components.json` configures shadcn's `new-york` registry with aliases shared by TypeScript and Vite. Card, Input, Textarea, and Badge were added through the shadcn CLI and customized; Button retains the existing Radix Slot/CVA contract with semantic variants and sizes. All components reuse the existing `cn` utility and Radix Slot dependency.

```tsx
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

<Button>Mulai belajar</Button>
<Button variant="outline">Sudah punya akun</Button>
<Button variant="secondary" size="sm">Lihat materi</Button>
<Input id="topic" aria-describedby="topic-help" />
```

Always pair fields with labels, icon-only controls with accessible names, and invalid fields with explanatory text. Focus uses visible outlines, independent of decorative shadows. Color transitions honor reduced motion.

Add future components from the repository root with `bunx shadcn@latest add <component> --cwd apps/web`. Review generated styles and imports: remove stock shadows/dark styles, apply the component-specific radius tokens and 2px borders, and reuse `@/lib/utils` and existing primitives. Avoid blindly overwriting customized components.

## Scope

This is foundation setup, not the full screen redesign. Existing shared Buttons and global typography receive the theme; existing hard-coded slate/teal page styles and native form elements still need migration during each screen's redesign. No changes to product flows, API contracts, or learning state.

References: [shadcn manual setup](https://ui.shadcn.com/docs/installation/manual), [components configuration](https://ui.shadcn.com/docs/components-json), and the user-provided Duolingo style reference.

Secondary buttons use a flat neutral surface (`bg-muted`), charcoal text, and a 2px border, with no raised edge. The pale-blue secondary palette remains available for badges and supporting surfaces.

## Dashboard and adaptive themes

Dashboard follows the revised Brilliant Home reference with top navigation and a streak card on the left. Modules now appear as compact horizontal rows on the right, with title, metadata, progress, and a direct action. A learning banner introduces the module list; the sidebar includes total XP and the best-streak row. Mobile puts the module list first and wraps each action beneath its title. All modules opens the full library. The shared shell also affects existing pages using it.

The header uses an animated sun/moon button. Until an explicit choice exists, the theme follows device preference changes. Clicking toggles light/dark and persists the choice under `ngertiin-theme`. The animation follows the same `data-theme` selector as the palette and honors reduced motion. Dark semantic tokens use a neutral charcoal canvas (#141414), cards (#202020), and neutral gray borders with Spark Blue accents. Legacy page-specific hard-coded styles outside the dashboard still need dark-mode migration.

Open `/dashboard-preview.html` during Vite development; add `?empty` for an empty-state preview. This development-only entry renders actual dashboard content with labeled sample data and a memory router. It omits the account control so it can render without Clerk. Production `/dashboard` retains its authenticated query, retry, and next-learning destinations. Preview checks do not certify authenticated API flows.
