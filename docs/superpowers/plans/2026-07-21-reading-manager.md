# Reading Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Git-backed Reading Manager that handles mixed media, four reading states, timestamps, and homepage/full-shelf views without adding a backend or exposing credentials.

**Architecture:** Keep `reading/posts.json` as the source of truth. Put schema migration, validation, state transitions, and homepage selection in one dependency-free browser/CommonJS module. Extend the existing editor with a Reading mode that edits an in-memory copy and downloads valid JSON for a normal Git commit.

**Tech Stack:** Static HTML, CSS, vanilla JavaScript, JSON, Node.js `node:test`

---

### Task 1: Lock the data contract with tests

**Files:**
- Create: `tests/reading-manager.test.js`
- Create: `reading/reading-manager.js`

- [ ] Add failing tests for legacy-field migration, validation, four-state transitions, and homepage selection.
- [ ] Run `node --test tests/reading-manager.test.js` and confirm the new expectations fail.
- [ ] Implement `normalizeEntry`, `validateEntry`, `transitionEntry`, `selectHomepageEntries`, and `serializeEntries` in a browser/CommonJS module.
- [ ] Run the focused test until it passes.

### Task 2: Migrate the reading data

**Files:**
- Modify: `reading/posts.json`
- Test: `tests/reading-manager.test.js`

- [ ] Replace `author`, `link`, `theme`, and `date` with `creator`, `url`, `topics`, `type`, and lifecycle timestamps.
- [ ] Give each entry a stable slug-style `id` and preserve both existing links.
- [ ] Add a schema test that validates every committed entry.

### Task 3: Add Reading mode to the existing editor

**Files:**
- Modify: `editor.html`
- Modify: `tests/homepage.test.js`

- [ ] Add failing structure tests for the mode switch, manager form, list, and shared model script.
- [ ] Add a Writing/Reading mode switch while preserving the current writing workflow.
- [ ] Load `reading/posts.json`, then provide search/status filters, add/edit/delete, and explicit loading/empty/error states.
- [ ] Apply state transitions through the shared model so timestamps are automatic.
- [ ] Save a browser draft and download deterministic `posts.json`; do not request or store a GitHub token.
- [ ] Add clear instructions for replacing `reading/posts.json` and committing through GitHub.

### Task 4: Make both public shelves consume the shared schema

**Files:**
- Modify: `index.html`
- Modify: `reading.html`
- Modify: `tests/homepage.test.js`

- [ ] Add failing tests for creator/url/topics/type fields and all four status labels.
- [ ] On the homepage, show active items only, prioritise `reading` before `want`, then sort by `updated_at`, capped at four.
- [ ] On the full Reading page, add status/type/topic filters and keep the tactile bookshelf interaction.
- [ ] Render `read` and `stopped` distinctly, with correct accessible labels and tooltip metadata.

### Task 5: Verify and publish

**Files:**
- Verify: all changed files

- [ ] Run `node --test tests/*.test.js` and `git diff --check`.
- [ ] Test Editor, homepage, and Reading page at desktop and mobile widths in warm and terminal themes.
- [ ] Check keyboard focus, form errors, empty/loading states, and reduced-motion behaviour.
- [ ] Run Lighthouse against the local static server and fix material accessibility or performance regressions.
- [ ] Review the final diff, commit the scoped change, push `main`, and verify GitHub Pages deployment.
