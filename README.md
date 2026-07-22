# SmartReview Proto C2 — Multi-pass review & handoff

Fork of **Proto C** with preparer → handoff → reviewer pass. Local preview runs on **port 5177** so it can sit beside Proto C (5175) and Proto A (5174).

## Getting Started (local)

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- [Yarn](https://yarnpkg.com/) (v4+ — included via `packageManager` in `package.json`)
- Access to the Intuit npm registry (configured via `.yarnrc.yml`) — needed only for a fresh `yarn install`

### Run locally

```bash
cd "/Users/jalzate/AI projects/SmartReview-ProtoC2"

# If node_modules is missing (first time / clean machine):
yarn install

# Start the preview
yarn dev
# or: npm run dev
```

Open **http://localhost:5177**

Demo tip: use the header **Preparer | Reviewer** switch, or finish diagnostics → **Wrap up this pass** → pass to reviewer → **Open as reviewer**.

### If `yarn install` fails (Intuit registry)

Copy deps from Proto C once (same packages):

```bash
rm -rf node_modules
cp -R "../SmartReview-ProtoC/node_modules" "./node_modules"
yarn dev
```

## Deploy to a separate URL (GitHub Pages)

Target site: **https://jualzate87.github.io/SmartReview-AIc2/**

Run this once from your own terminal (agent push is often blocked):

```bash
cd "/Users/jalzate/AI projects/SmartReview-ProtoC2"

# 1) Create the public repo + push main
gh repo create jualzate87/SmartReview-AIc2 --public --source=. --remote=origin --push

# 2) Build + publish gh-pages (also pushes main)
./deploy.sh

# 3) First time only — enable Pages:
#    https://github.com/jualzate87/SmartReview-AIc2/settings/pages
#    Source: Deploy from a branch → gh-pages / (root)
```

After that, redeploy anytime with:

```bash
./deploy.sh
```

Live URL next to the others:

| Proto | URL |
|-------|-----|
| A | https://jualzate87.github.io/SmartReturn-Review/ |
| A2 | https://jualzate87.github.io/SmartReturn-Review-A2/ |
| C | https://jualzate87.github.io/SmartReview-AIc/ |
| **C2** | **https://jualzate87.github.io/SmartReview-AIc2/** |

## How to Use

Open the project in Cursor and start chatting with the AI assistant. You can describe what you want in plain language, or use slash commands for specific tasks.

### Slash Commands

| Command | What it does |
|---------|-------------|
| `/prototype <description>` | Build a UI from a text description |
| `/figma <URL>` | Build a UI from a Figma design |
| `/component <name>` | Look up an IDS component's API and usage |
| `/token-lookup <description>` | Find the right design token for a style |
| `/layout <type>` | Generate a layout (sidebar, dashboard, split-view, etc.) |
| `/page <type>` | Generate a full page (settings, form, table, empty-state, etc.) |
| `/form <fields>` | Build a form from field names (e.g., `name, email, message`) |
| `/table-builder <columns>` | Build a data table from column names |
| `/navigation <type>` | Add navigation (tabs, sidebar, pagination, step-flow) |
| `/wireframe <description>` | Quick low-fidelity wireframe with skeleton placeholders |
| `/compose <components>` | Combine multiple IDS components together |
| `/responsive` | Make the current prototype responsive |
| `/animate <target>` | Add animations using IDS motion tokens |
| `/theme <name>` | Switch or explore IDS themes |
| `/icon-search <description>` | Find an icon from the IDS icon library |
| `/token-preview <category>` | Visual reference of tokens (colors, spacing, typography) |
| `/compare <A> vs <B>` | Compare two IDS components side by side |
| `/audit-a11y` | Check accessibility (WCAG AA) |
| `/audit-style` | Check design token and style compliance |
| `/explain` | Explain the current prototype in plain language |
| `/spec` | Generate a developer handoff spec |
| `/snapshot <name>` | Save your current work |
| `/restore <name>` | Go back to a saved version |
| `/snapshots` | List all saved versions |
| `/help` | Show all available commands |

### Example Workflow

1. **Start the server** -- run `yarn dev` in your terminal
2. **Describe your idea** -- tell the AI what you want to build, e.g. *"Build a settings page with a sidebar nav, a form with name and email fields, and a save button"*
3. **Iterate** -- ask for changes like *"Make the sidebar collapsible"* or *"Add a toast message when the form is saved"*
4. **Check quality** -- run `/audit-a11y` to check accessibility or `/audit-style` to verify token usage
5. **Save your work** -- use `/snapshot my-settings-page` to save a version you can return to later

## What You're Building With

This environment uses the real **Intuit Design System** -- the same components and tokens used in production Intuit products.

- **70+ IDS components** -- buttons, forms, tables, modals, navigation, and more
- **780+ design tokens** -- colors, spacing, typography, elevation, motion
- **IDS icon library** -- hundreds of icons from `@design-systems/icons`

Everything stays on-system. The AI is configured to only use IDS components, design tokens, and icons -- never third-party libraries.

## Project Structure

You only need to care about the pages and styles folders:

```
src/
├── App.tsx                  ← Router shell (managed by the AI)
├── pages/
│   ├── HomePage.tsx         ← Your prototype starts here
│   └── [OtherPage].tsx      ← Additional pages created by skills
├── styles/
│   ├── HomePage.module.css  ← Home page styles
│   ├── [OtherPage].module.css ← Per-page styles
│   ├── App.module.css       ← Shell-level styles (minimal)
│   ├── index.css            ← Global styles (don't edit)
│   ├── fonts.css            ← Font imports (don't edit)
│   └── intuit.css           ← IDS design tokens (don't edit)
```

The AI handles all the code. Each page has its own file in `src/pages/` with a matching CSS module in `src/styles/`.

## Available Scripts

| Command | Description |
|---------|-------------|
| `yarn dev` | Start the dev server at http://localhost:5174 |
| `yarn build` | Create a production build |
| `yarn sync-tokens` | Update design tokens from the DDMS CDN |

## Tips for Designers

- **Be specific** -- instead of *"make it look good"*, try *"add a page header with the product name and a settings icon on the right"*
- **Reference Figma** -- paste a Figma URL with `/figma` and the AI will translate the design into IDS code
- **Use component names** -- if you know the IDS component you want (e.g. "use a Drawer instead of a Modal"), mention it
- **Ask questions** -- use `/component <name>` to learn what a component can do, or `/token-lookup` to find the right token
- **Save often** -- use `/snapshot` before trying big changes so you can `/restore` if needed
- **Check your work** -- `/audit-a11y` catches accessibility issues, `/audit-style` catches token compliance issues

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `yarn install` fails | Make sure you have access to the Intuit npm registry. Check that `.yarnrc.yml` is configured correctly. |
| Dev server won't start | Try `yarn install` again, then `yarn dev`. Make sure port 5174 isn't already in use. |
| Components look unstyled | The AI may have forgotten a CSS import. Ask it to check that all `@ids-ts/*` components have their CSS imported. |
| Prototype looks wrong after changes | Use `/restore <name>` to go back to a saved snapshot, or ask the AI to undo the last change. |
