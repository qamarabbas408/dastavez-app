# Dastavez — Implementation Plan

Derived from `DASTAVEZ_UI_FLOW.md` (source of truth for screens and behavior). This plan covers sequencing, architecture decisions, and the concrete file changes. **No code in this plan is written yet** — it is a proposal for review.

## Context

**Dastavez** is an offline document scanner. This phase delivers a **clickable UI prototype only**: every screen, state, and transition is real, but camera, OCR, file pickers, exports, persistence, and network are all simulated. No permissions are requested and no external SDKs are used.

- App name: **Dastavez** / subtitle **Offline Document Scanner**
- Platforms: iOS + Android, TypeScript, Expo SDK 57 (RN 0.86.3, React 19.2.3)
- No accounts, no sync, no analytics, no cloud
- Visual direction: calm and official, accessible contrast, generous touch targets

## Phase 0 — Toolchain baseline (already done)

Verified 2026-10-01: `npx tsc --noEmit` silent, `npx expo lint` silent, `npx expo-doctor` 21/21, `npx expo install --check` clean. New Architecture is unconditional on SDK 57; `reactCompiler` and `typedRoutes` are on. See `AGENTS.md` for the full constraints.

## Architecture decisions

These are the choices that shape everything downstream. Each has a reason tied to the spec or the codebase.

### A1. Navigation shape — root stack with an authenticated group

The spec asks for "a simple stack for task screens and a persistent Home/Settings navigation affordance for top-level destinations." That maps to a root stack plus a two-tab native-tabs group:

```
src/app/_layout.tsx              → Root Stack, handles the first-launch redirect
src/app/(onboarding)/_layout.tsx → Stack: welcome, unlock
src/app/(tabs)/_layout.tsx       → NativeTabs: index (Home), settings
src/app/(tabs)/index.tsx         → Home
src/app/(tabs)/settings.tsx      → Settings
src/app/scan/...                 → capture-preview, page-review
src/app/import/...               → source, picker
src/app/edit-save.tsx            → shared by scan and import
src/app/document/[id]/...        → view, export-confirm, share-handoff
```

Task screens live at the root level as stack screens above the tabs, so Back returns correctly and the tab bar stays out of the way. `(onboarding)` and `(tabs)` are route groups — parentheses mean no URL segment, so the redirect logic stays simple.

Native tabs beat JS tabs here: Home and Settings are genuine top-level destinations, and the system tab bar gives correct iOS/Android feel for free. The SDK 57 import is `expo-router/unstable-native-tabs` (it only becomes `expo-router/native-tabs` in SDK 58).

### A2. Icons — `md` + `sf` props, no new dependency

`@expo/vector-icons` is **not** installed and `expo-symbols` is iOS-only, so Android icons need a plan. `NativeTabs.Trigger.Icon` accepts `sf` (SF Symbols, iOS) and `md` (Material Symbols, Android) natively — no library needed. SDK 56+ supports `{default, selected}` objects on both, so distinct selected states work. I'll use `sf="house.fill"` / `md="home"` style pairs.

This deliberately avoids `@react-native-vector-icons`, which the docs note **requires a development build** (`getImageSourceSync` needs a native module). That would break the Expo Go workflow this prototype depends on.

For in-screen icons, the existing `expo-symbols` `SymbolView` works on iOS but is inert on Android. I'll build a thin `AppIcon` wrapper that maps a single semantic name to `sf` on iOS and `md` on Android, so Android never shows a blank gap. **This needs your confirmation** — it's the one place the prototype can't be pixel-identical across platforms without adding a dependency.

### A3. State — one reducer-backed React Context store

All documents, drafts, and forced-failure flags live in a single `useReducer` store exposed via Context at the root layout. No Redux, no Zustand, no persistence.

Why Context and not Zustand: the state is a handful of records that change only through user actions in one tree. Context plus a reducer is ~60 lines, has zero dependencies, and keeps the whole mock layer readable in a single file — which matters when the reviewer is meant to read it. It also avoids the `set-state-in-effect` lint rule entirely, since all transitions go through dispatch.

`useReducer` state persists as long as the root layout is mounted, which satisfies "in-memory only, restart persistence out of scope."

### A4. Theme — extend the existing token file

`src/constants/theme.ts` already has `Colors`, `Fonts`, `Spacing`, and light/dark pairs. I'll extend it with semantic tokens (`accent`, `danger`, `border`, `surface`, `textMuted`) rather than introduce a new theming system. Reuse `ThemedText` and `ThemedView`, and keep `useTheme`.

The "calm and official" direction maps to a restrained palette: a desaturated blue accent, near-black/near-white neutrals, and a clearly distinct destructive red that still passes contrast in both schemes.

### A5. Accessibility is a build requirement, not a pass at the end

The spec's acceptance criteria call for accessible labels, adequate touch targets, and readability at large text sizes. I'll set `minHeight: 48` on every tappable control from the start, add `accessibilityRole`/`accessibilityLabel` as components are written, and avoid fixed heights that break under font scaling.

### A6. Reuse and cleanup

`ThemedText`, `ThemedView`, `useTheme`, `use-color-scheme`, and `global.css` stay. These get **deleted**: `explore.tsx`, `hint-row.tsx`, `web-badge.tsx`, `animated-icon.tsx` + `.web.tsx` + `.module.css`, `external-link.tsx`, `components/ui/collapsible.tsx`, and the Expo tab icons under `assets/images/tabIcons/`. The scaffold's branded splash stays for now.

## Proposed file layout

```text
src/
  app/
    _layout.tsx                     root Stack + onboarding redirect
    (onboarding)/
      _layout.tsx
      welcome.tsx                    Screen 1
      unlock.tsx                     Screen 2
    (tabs)/
      _layout.tsx                   NativeTabs
      index.tsx                      Screen 3 — Home
      settings.tsx                   Screen 10
    scan/
      _layout.tsx                   hides tab bar for task screens
      capture-preview.tsx           Screen 4
      page-review.tsx               Screen 5
    import/
      _layout.tsx
      source.tsx                     Screen 6a
      picker.tsx                     Screen 6b, ?source=photos|pdfs
    edit-save.tsx                    Screen 7
    document/
      [id]/
        _layout.tsx
        index.tsx                    Screen 8 — Document View
        export-confirm.tsx           Screen 9a
        share-handoff.tsx            Screen 9b
  components/
    atoms/          button, text-field, icon, badge, list-row, card, banner
    molecules/      primary-actions, search-bar, page-thumbnail, action-bar
    organisms/      document-list, camera-viewfinder, page-strip, ocr-panel
  store/
    types.ts                        Document, Draft, FailureMode
    seed.ts                         4 fictional documents + mock pages
    store.tsx                       provider, reducer, hooks
  features/         per-screen view logic, kept out of app/ per AGENTS.md
```

Atomic tiers follow the best-practices article; `src/components/{atoms,molecules,organisms}` gives the shared directory the article asks for.

## Mock data

Four fictional documents, clearly invented, no real agency names:

| Title | Pages | Type | Date | OCR |
|---|---|---|---|---|
| Harbour Maintenance Log | 3 | PDF | 2026-08-14 | short excerpt |
| Tenant Notice — Unit 4B | 2 | JPEG | 2026-07-02 | short excerpt |
| Vehicle Handover Checklist | 1 | JPEG | 2026-06-21 | short excerpt |
| Committee Minutes | 5 | PDF | 2026-05-30 | short excerpt |

Six seeded capture pages for Scan/Add page/Retake, drawn from a `MOCK_PAGES` pool. Photos and PDFs pickers use disjoint sample sets so the source choice visibly matters.

## Failure and edge states

The spec requires these to be reachable and understandable. A `FailureMode` union in the store drives them, with a **developer-only** panel (behind a `__DEV__` guard) exposing toggles for: empty library, permission denied, unlock cancelled, OCR failure, low storage, export cancelled.

**Resolved: the panel lives in Settings, not behind a shake gesture.** The shake gesture was the
conventional answer, but it needs accelerometer access — which means motion permission on iOS. The
project's hard constraint is that the app never requests a permission, so a gesture that only works
after a permission prompt would contradict it. A Settings section also happens to be more
discoverable for a reviewer walking the acceptance criteria in order.

## Build order

Each phase is independently runnable and verifiable.

1. **Foundation** — extend theme tokens, create the store with types and seed data, build atoms, add `AppIcon`, delete scaffold screens. Verify: app boots to an empty tabs shell, lint and typecheck clean.
2. **Onboarding + Unlock** — root layout with the redirect, `welcome.tsx`, `unlock.tsx` with Unlock/Cancel/Try again. Verify: cold start lands on Welcome; Cancel stays put with a status message.
3. **Home** — header, search, Scan/Import actions, recent list, empty and no-results states. Verify: all three list states reachable via search and the dev toggle.
4. **Scan path** — capture preview with permission-denied variant, page review with thumbnails and mock controls, edit & save with OCR-failure and low-storage variants. Verify: full Scan → Document View, and unsaved-changes prompts fire.
5. **Import path** — source chooser and both mock pickers. Verify: Home → Import → Edit & Save.
6. **Document View + Export** — preview/OCR segmented control, export confirmation, mock share handoff, delete confirmation. Verify: export cancelled returns to Document View; delete returns Home.
7. **Settings + dev panel** — privacy copy, app-lock mock, local management, delete-all with destructive confirmation, `__DEV__` toggles. Verify: every failure state reachable from the panel.
8. **Acceptance pass** — walk all six acceptance criteria, check large-text and small-screen layout, confirm a11y labels, then lint, typecheck, and `expo-doctor`.

## Verification

After every phase:

```bash
npx tsc --noEmit && npx expo lint
```

Before declaring done: the three above plus a manual walk of the acceptance criteria.

## Open questions

1. **A2 icons** — accept `sf` + `md` pairing (no dependency, minor Android visual difference), or add `@react-native-vector-icons` for pixel-identical cross-platform icons? Adding it means moving off Expo Go to a development build 
Answer : (Whatever recommended and optimized).
> **Resolved:** accepted the `sf` + `md` pairing, and no dependency was needed at all — on SDK 57
> `expo-symbols` renders Material Symbols on Android from the same declaration
> (`name={{ ios, android }}`), so the trade-off turned out to be moot. `@expo/vector-icons` was
> briefly installed and removed again.
2. **Dev panel placement** — Settings section (discoverable) or shake gesture (matches conventions)?
Answer : match conventions
> **Resolved:** implemented the Settings section instead. See "Failure and edge states" above — the
> shake gesture would have required motion permission on iOS, which the no-permission rule forbids.
> Flagging the deviation explicitly rather than quietly picking one.
3. **Web target** — the scaffold supports web and the spec says iOS + Android. Keep web building, or drop it from scope? 
Answer : drop web target . focus on IOS+Android.. and remove it from scoope as well. 
> **Resolved:** dropped. `app.json` is `platforms: ["ios", "android"]`, the web deps and scripts are
> out of `package.json`, and every `.web.tsx` / CSS file is deleted.
4. **Tab bar on task screens** — spec says persistent affordance for top-level destinations, implying task screens hide it. I plan to hide it on Scan/Page Review/Edit. Confirm.
Answer : Confirm
> **Resolved:** task screens are root-level `Stack` screens outside `(tabs)`, so the tab bar is not
> part of their hierarchy at all and Back returns to the tabs correctly.

## Explicitly out of scope

Camera, OCR, file pickers, real exports or share sheets, any persistence or database, network requests, authentication, permissions, analytics, and external SDKs beyond what Expo ships.