---
version: alpha
name: Linear
description: A soft violet shadcn/ui theme — muted purple primary, refined near-white canvas, and product-native SaaS precision by Tinte.
colors:
  background: "#fbfbfb"
  foreground: "#1b1b1b"
  card: "#ffffff"
  primary: "#6e78d5"
  primary-foreground: "#ffffff"
  secondary: "#1b1b1b"
  secondary-foreground: "#fbfbfb"
  muted: "#ececef"
  muted-foreground: "#71737a"
  accent: "#d9dcea"
  accent-foreground: "#000000"
  destructive: "#92681b"
  border: "#e8e8e8"
  input: "#bebfc3"
  ring: "#6f6d6d"
  sidebar: "#fbfbfb"
  sidebar-foreground: "#000000"
  sidebar-primary: "#535151"
  sidebar-accent: "#ffffff"
  chart-1: "#6d6b6b"
  chart-2: "#02755c"
  chart-3: "#a3a1a1"
  chart-4: "#004a37"
  chart-5: "#3b3939"
  dark-background: "#101011"
  dark-foreground: "#e3e4e6"
  dark-card: "#17181a"
  dark-primary: "#e6e6e6"
  dark-secondary: "#7987e1"
  dark-muted: "#141415"
  dark-muted-foreground: "#a1a2a5"
  dark-accent: "#303549"
  dark-border: "#24252a"
  dark-sidebar: "#08090a"
typography:
  display:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: -0.025em
  headline-lg:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: 500
    lineHeight: 1.25
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.6
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.6
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.4
  mono:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
rounded:
  xs: 0px
  sm: 2px
  md: 4px
  lg: 6px
  xl: 10px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  "2xl": 48px
  section: 64px
  gutter: 32px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.lg}"
    padding: 12px
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.secondary-foreground}"
    rounded: "{rounded.lg}"
    padding: 12px
  button-outline:
    backgroundColor: transparent
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: 12px
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.xl}"
    padding: 24px
  input:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: 12px
  sidebar:
    backgroundColor: "{colors.sidebar}"
    textColor: "{colors.sidebar-foreground}"
---

# Linear

A premade shadcn/ui theme by [Tinte](https://tinte.dev). Install tokens with `npx shadcn@latest add @shadcnblocks/theme/linear`, then keep this DESIGN.md in the project root (or `.agents/`) so coding agents stay on-brand.

## Overview

Linear feels like a precision-engineered issue tracker rendered as a design system: near-white canvas with the faintest cool undertone, a soft violet-indigo primary (`#6e78d5`) that reads as product-native rather than branded, and an overall restraint that prioritizes content density over decorative flourish. In dark mode, the violet shifts to secondary accent while near-white becomes the primary action color — a sophisticated inversion that respects the app-first ethos.

The system is **refined, product-dense, and dark-mode-friendly**. It suits project management tools, issue trackers, workspace productivity apps, and any SaaS product that values efficiency over personality. The violet is subtle enough to work as a tint rather than demanding attention.

Emotional targets: fast, precise, quietly premium — never loud enterprise, never playful consumer, never over-designed.

## Colors

The palette layers a **soft violet primary** over a **cool neutral stage**. Purple provides subtle brand recognition without visual weight.

- **Primary (`#6e78d5`):** Soft violet-indigo — primary buttons, active states, selected items. In dark mode, the system inverts: near-white (`#e6e6e6`) becomes primary and violet shifts to secondary (`#7987e1`).
- **Secondary (`#1b1b1b`):** Near-black — secondary buttons, emphasis moments in light mode. Dark mode uses brighter violet as secondary.
- **Muted (`#ececef`):** Cool lavender-gray — quiet chrome, table rows, skeleton fills. A faint blue undertone distinguishes it from flat gray.
- **Foreground (`#1b1b1b`):** Near-black text — dense and legible for lists, issue titles, and data tables.
- **Background (`#fbfbfb`):** Cool near-white canvas — barely perceptible warmth removal creates a technical feel.
- **Card (`#ffffff`):** Pure white for elevated content panels.
- **Accent (`#d9dcea`):** Lavender wash — selected rows, hover backgrounds, chip fills. Tints the interface without shouting.
- **Border (`#e8e8e8`):** Cool gray separators — lightweight and consistent.
- **Ring (`#6f6d6d`):** Mid-gray focus ring — subtle, not branded.
- **Destructive (`#92681b`):** Muted amber-brown for warnings — unconventional but aligned with the low-saturation palette.

Dark mode transforms into an almost-black canvas (`#101011`) with faint cool undertones. Cards lift slightly (`#17181a`). The experience feels like a native dark IDE.

## Typography

**Inter** is the sole typeface — display, body, and labels. **JetBrains Mono** covers code and technical fragments.

- **Display / headlines:** Inter SemiBold, tight tracking (-0.025em). Refined and slightly narrow.
- **Body:** Inter Regular at 16px with 1.6 line-height. Optimized for dense information scanning.
- **Labels / UI chrome:** Inter Medium at 14px. Sentence case; concise labels.
- **Mono:** JetBrains Mono for code, IDs, and branch names.

Avoid display faces, serif fonts, or rounded alternatives. Linear's typographic identity is pure Inter precision — the same text at every scale.

## Layout

Use a **dense product rhythm**: 8px base, compact sections, and information-forward hierarchy.

- Prefer a full-width app shell with a narrow sidebar (~240px) and a content pane that stretches.
- Lists and tables are the primary content pattern — optimize for scan-ability with tight row heights.
- Group related actions in inline toolbars rather than modal dialogs.
- App shells: near-white sidebar, white content pane. Active item gets a subtle accent wash, not a heavy colored bar.
- Density: high. Linear is built for power users managing hundreds of items — whitespace is intentional but never lavish.

## Elevation & Depth

Depth is **barely-there** — Linear uses near-zero shadows and relies on border + background layering.

- Cards float with borders alone; add shadow only for overlays (command palettes, popovers).
- Shadow opacity is minimal (`0.01`–`0.03`). Most surfaces feel flat and integrated.
- Prefer tonal stacking: background (`#fbfbfb`) → card (`#ffffff`) → accent wash (`#d9dcea`) → primary button.
- Avoid dramatic shadows, colored ambient glows, or multi-layer elevation systems.
- Dark mode: rely on background lightness steps (`#101011` → `#17181a` → `#24252a`) rather than visible shadows.

## Shapes

Corner radius is **tight** — base `--radius` is `0.375rem` (6px).

- Buttons, inputs, and controls: ~6px (`rounded-lg`).
- Cards and large panels: ~10px (`rounded-xl`).
- Lists, table rows, and inline elements: 2–4px or no rounding.
- The tight radius communicates precision and density. Do not inflate to bubbly marketing-style corners.

## Components

Built for the shadcn/ui token contract. Prefer semantic tokens (`bg-primary`, `text-muted-foreground`) over raw hex in component code.

- **Primary button:** Violet fill, white label in light mode. In dark mode, near-white fill with black label.
- **Secondary button:** Near-black fill in light mode (high-contrast alternate). In dark mode, violet fill.
- **Outline / ghost:** Dark text on transparent; thin border stroke.
- **Cards:** White surface, cool gray border, tight radius. Minimal padding for dense content.
- **Inputs:** Background-matched fields, gray borders, subtle ring on focus. Keep inputs compact.
- **Sidebar:** Near-white shell, dark text. Active items use lavender accent wash, not primary fill.
- **Charts:** Series order gray → teal → lighter gray → deep teal → dark gray. Muted and professional.
- **Badges:** Lavender accent or muted gray fills. Status badges are small and quiet.
- **Command palette:** White overlay, sharp shadow, dense list — the signature Linear interaction pattern.

## Do's and Don'ts

**Do**

- Do keep the violet subtle — it's a tint for active states, not a brand billboard.
- Do prioritize information density over decorative whitespace.
- Do use Inter exclusively at all scales.
- Do maintain the tight 6px radius for a precise, engineered feel.
- Do embrace the light/dark inversion where primary swaps from violet to near-white.

**Don't**

- Don't saturate the interface with bright purple — if violet is everywhere, it loses its signal value.
- Don't add warm tints (cream, amber, coral) that fight the cool palette.
- Don't use large bubbly radii or pill-shaped buttons.
- Don't add decorative illustrations, gradients, or playful iconography.
- Don't spread borders to every element — let flat surfaces share space naturally.
- Don't invent one-off colors when the neutral gray + violet accent system already covers the use case.
