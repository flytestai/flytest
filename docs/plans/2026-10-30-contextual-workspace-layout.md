# FeiCe Contextual Workspace Layout Implementation Plan

**Goal:** Remove irrelevant business sidebars, consolidate page actions, and keep resource directories usable without displacing content on small screens.

**Architecture:** A shared WorkspaceDirectoryLayout owns one persistent directory instance, a full-width heading outlet, a contextual toolbar, and a responsive accessible drawer. The drawer teleports outside the application to keep business modals and dropdowns usable, locks background interaction and restores focus. WorkspacePane preserves visited tab state while its heading follows the active tab. Existing business events, permission checks and API filtering remain in their current components.

**Tech Stack:** Vue 3, TypeScript, Arco Design Vue, VueUse, CSS, Playwright.

## Tasks

- [x] Build shared directory layout, heading outlet and active pane context; support desktop collapse/resize, persistent preference, mobile dialog, Escape and focus return.
- [x] API: directory only for requests/cases; records/reports use searchable collection filter with explicit clear; environments show full width.
- [x] UI: directory only for pages/steps/cases; other tabs show full width. Preserve filters and selections between tabs.
- [x] Cases/suites/bugs: adopt shared layout; detail/editor prioritize content and keep directory accessible.
- [x] Reports: move generation to full-width header; move suite selection and snapshot tools to on-demand drawer. Requirement review/analysis selectors and AI conversation history adopt the shared shell. Personal center uses horizontal tabs; scene builder independently collapses library/config panels.
- [x] Replace prominent generic directory operations with root add and explicit per-node menus; preserve all existing operations and confirmations.
- [x] Flatten nested panels and toolbars within shared workspaces; retain A2 tokens and quality color semantics.
- [x] Verify populated directories, selection/filter persistence, menus, drawer focus/Escape, resize, route switches and bounds at 1440/1280/1024/768/390/320px. Run production build and affected regression checks.

## Acceptance

No directory on unrelated tabs. No directory stacked above mobile content. No duplicate primary actions in directory headers. Current filter is visible and clearable. Dialog controls remain keyboard accessible. No business API contracts or backend changes. Implementation proceeds locally; no automatic Git operations.

## Regression fixes discovered during implementation

- Deserialize persisted expanded/collapsed values as booleans, including after a full reload.
- Close the directory on explicit resource navigation, rather than asynchronous catalog synchronization.
- Mount directory contents only after the page first needs them, retaining the instance across later tab switches.
- Synchronize cleared filters with tree selection; apply the current module to newly visited UI tabs.
- Keep native keyboard events available for the outer drawer after closing a node menu.
- Replace the two-item personal settings menu with native tabs so 320px screens never hide password settings in overflow.
- Let defect filters and sort controls shrink and wrap within their actual content width.
