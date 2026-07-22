# SmartReview — Prototype C2 (Multi-pass handoff — fork of Proto C Sequential Review Experience)

**This prototype (ProtoC)** splits the AI-assisted tax return review into two explicit, sequential phases (research finding: CPAs want *data accuracy first, insights second*):

1. **Phase 1 — Import Accuracy:** the source-document experience (essentially ProtoA) — orange field flags, edit/mark-correct, dynamic banner + dynamic tab badges. All import/OCR flags live here.
2. **Phase 2 — AI Diagnostics:** the strategic AI review (compliance, YoY, opportunities) via `AgentReportPane`, with all import/OCR flags removed so there is zero redundancy between phases. Phase 2 is **hard-locked** (visible + explained) until Phase 1 is complete.

Built as a fresh copy of ProtoB (which = ProtoA + AI panel). Single `DataReviewPage` with a `phase` state (`'welcome' | 'import' | 'diagnostics'`) toggling layout — no new store, no new routes. Dev server runs on **port 5177** (ProtoB was 5174) so both can run side-by-side. See `PROTO_C_REQUIREMENTS.md` for the full spec.

---

## IDS Prototyping Environment

This is a prototyping playground for the **Intuit Design System (IDS)**. It's designed for designers — you don't need to be a developer to build things here. Describe what you want, and the AI will build it using real IDS components and tokens.

## Quick Start

- **Build something:** Use `/prototype` and describe what you want
- **Build from Figma:** Use `/figma` with a Figma URL or pasted design data
- **Look up a component:** Use `/component` and name the component
- **Find a design token:** Use `/token-lookup` and describe the style you need
- **Start the preview:** Use `/preview` to see your work at `http://localhost:5174`
- **Start over:** Use `/reset` to get a clean slate

## How We Work Together

This tool works best as a **collaborative pair** — you bring the design intent, the agent handles the implementation.

**What to expect:**
- Before building anything, the agent will confirm its understanding of your request
- When decisions come up mid-build, the agent will stop and ask rather than guess
- When something goes wrong, the agent will explain it in plain language and offer options — always with a **(Recommended)** path clearly marked
- After each build, the agent will summarize what was created and suggest a next step

**If something isn't right:** Just say so. Describe what you expected and the agent will adjust. You don't need to know why it went wrong — just what you wanted.

## Available Skills

Skills are advanced slash commands for complex workflows. Type `/` followed by the skill name.

### Building & Prototyping
- `/prototype <description>` — Build a full prototype from a text description
- `/figma <URL>` — Build a prototype from a Figma design
- `/wireframe <description>` — Quick wireframe with skeleton placeholders
- `/layout <type>` — Generate a layout (sidebar, dashboard, split-view, centered, holy-grail)
- `/page <type>` — Generate a page (settings, form, list, table, detail, empty-state, error, onboarding)
- `/form <fields>` — Build a form from a list of fields (e.g., `name, email, message`)
- `/table-builder <columns>` — Build a data table from column names (e.g., `name, email, status, date`)
- `/navigation <type>` — Add navigation (tabs, sidebar, pagination, step-flow, accordion)

### Customization
- `/compose <components>` — Combine multiple IDS components together
- `/animate <target>` — Add animations using IDS duration/easing tokens
- `/theme <name>` — Switch or explore IDS themes
- `/responsive` — Make the current prototype responsive across breakpoints
- `/icon-search <description>` — Find the right icon from @design-systems/icons
- `/token-preview <category>` — Render a visual reference of design tokens (colors, spacing, typography)

### Quality & Review
- `/audit-a11y` — Accessibility audit (WCAG AA compliance check)
- `/audit-style` — Style compliance audit (token usage, forbidden libraries)
- `/explain` — Explain the current prototype in plain language
- `/spec` — Generate a design specification for the current prototype
- `/compare <A> vs <B>` — Compare two IDS components side by side

### Save & Restore
- `/snapshot <name>` — Save the current prototype as a named snapshot
- `/restore <name>` — Restore a previously saved snapshot (auto-saves current state first)
- `/snapshots` — List all saved snapshots

### Help
- `/help` — Show a friendly guide to all available commands and skills

## Agents

Specialized agents handle deep, autonomous work. They are used internally by skills and can be referenced for complex tasks.

| Agent | Specialty |
|-------|-----------|
| `ids-component-expert` | Deep knowledge of all 70+ IDS component APIs, props, and composition |
| `token-resolver` | Maps visual values to the ~780 IDS design tokens |
| `figma-translator` | Converts Figma designs into IDS code via MCP |
| `accessibility-auditor` | WCAG 2.1 AA compliance auditing |
| `style-validator` | Token compliance and forbidden-library detection |
| `responsive-architect` | Responsive layout transformation across breakpoints |
| `prototype-reviewer` | Comprehensive QA combining all audit perspectives |

## Rules (Non-Negotiable)

1. **Only use IDS components** — never Material UI, Chakra, Ant Design, or any other UI library
2. **Only use CSS Modules** — never Tailwind, SASS, styled-components, or CSS-in-JS
3. **Only use design tokens** — never hardcode colors, spacing, or typography values
4. **Only use IDS icons** — always `@design-systems/icons`, never inline SVGs or third-party icon libraries
5. **Always import component CSS** — every `@ids-ts/*` import needs a matching `import '@ids-ts/<name>/dist/main.css'`
6. **No wrapper components** — use `@ids-ts/*` components directly in JSX

## Where the Rules Live

The detailed component and token documentation lives in `.cursor/rules/`. This is the **single source of truth** shared by both Cursor and Claude Code.

### Before using a component, read its rule file:
```
.cursor/rules/components/<name>.mdc
```
Example: Before using `@ids-ts/button`, read `.cursor/rules/components/button.mdc`

### Before using tokens, read the relevant token file:
```
.cursor/rules/tokens/intuit/<category>.mdc
```
Example: For color tokens, read `.cursor/rules/tokens/intuit/color.mdc`

### Key rule files:
- `.cursor/rules/design-system.mdc` — master rules (architecture, file structure, all available components)
- `.cursor/rules/tokens.mdc` — token overview (categories, naming patterns, quick reference)
- `.cursor/rules/icons.mdc` — icon usage (imports, props, available icons)
- `.cursor/rules/typography.mdc` — typography system
- `.cursor/rules/figma.mdc` — Figma-to-code workflow

## File Structure

```
src/
├── App.tsx                  ← Router shell (managed by skills, don't edit directly)
├── pages/
│   ├── HomePage.tsx         ← Default page — your prototype starts here
│   └── [Name].tsx           ← Additional pages created by skills
├── styles/
│   ├── App.module.css       ← Shell-level styles (minimal)
│   ├── HomePage.module.css  ← Home page styles
│   ├── [Name].module.css    ← Per-page styles
│   ├── index.css            ← Global styles (don't edit)
│   ├── fonts.css            ← Font imports (don't edit)
│   └── intuit.css           ← Design tokens from DDMS CDN (don't edit)
```

Each page has its own file in `src/pages/` and its own CSS module in `src/styles/`. Pages are accessible at `http://localhost:5174/#/[page-path]`. Skills handle creating new pages and wiring them into the router.

## Available Components

All packages use the `@ids-ts/*` scope. Install with `yarn add @ids-ts/<name>`.

- `accordion` — collapsible content sections
- `app-tile` — application tile cards
- `backdrop` — overlay background layer
- `badge` — status indicators and counts
- `button` — primary, secondary, and standard buttons
- `cards` — card containers
- `carousel` — content carousels
- `checkbox` — checkboxes and checkbox groups
- `chip` — filter and selection chips
- `combo-link` — combined link elements
- `date-picker` — date selection
- `date-range-picker` — date range selection
- `determinate` — determinate progress indicator
- `drawer` — slide-out panels
- `dropdown` — dropdown menus
- `dropdown-button` — button with dropdown
- `dropdown-typeahead` — searchable dropdown
- `flair` — decorative elements
- `guidance-tooltip` — help tooltips
- `guided-tour-tooltip` — onboarding tour steps
- `icon-container` — icon wrapper
- `icon-control` — interactive icons
- `indeterminate` — indeterminate progress indicator
- `info-link` — informational links
- `inline-validation-message` — form validation messages
- `left-navigation` — sidebar navigation
- `link` — hyperlinks
- `link-action-button` — link-styled buttons
- `loader` — loading spinners
- `menu` — context and action menus
- `modal-dialog` — modal windows
- `page-message` — full-width banners
- `pagination` — page navigation
- `panel` — content panels
- `panel-contextual` — contextual side panels
- `point-of-need` — contextual help
- `popover` — popover containers
- `product-header` — app header bar
- `progress-bar` — progress bar indicator
- `radio` — radio buttons
- `segmented-button` — toggle button groups
- `skeleton` — loading placeholders
- `split-button` — button with dropdown action
- `stacked-page-messages` — multiple banners
- `status-dropdown` — status selection dropdown
- `step-flow` — multi-step wizards
- `survey-tool` — survey/feedback collection
- `switch` — toggle switches
- `table` — data tables
- `tabs` — tab navigation
- `text-field` — text inputs
- `textarea` — multi-line text inputs
- `toast-message` — temporary notifications
- `tooltip` — hover tooltips
- `trowser` — full-screen overlays
- `typography` — text components
- `video` — video players

Utility packages (no visual UI): `a11yfocus`, `click-away-listener`, `core`, `portal`, `position`, `zindex`

## Dev Server

```bash
npm run dev        # Starts on http://localhost:5174
npm run build      # Production build
npm run sync-tokens [version]  # Update design tokens from DDMS CDN
```

## Common Mistakes

- Forgetting to `import '@ids-ts/<name>/dist/main.css'` alongside the component
- Hardcoding `color: #393A3D` instead of `color: var(--color-text-primary)`
- Using `styled-components` or Tailwind classes
- Creating a `<MyButton>` wrapper around `<Button>` — just use `<Button>` directly
- Using absolute positioning for layout — use Flexbox or Grid
- Using inline SVGs instead of `@design-systems/icons`
- Not checking `.cursor/rules/components/<name>.mdc` before using a component
- Importing CSS as `import './styles/App.css'` instead of `import styles from './styles/App.module.css'`
