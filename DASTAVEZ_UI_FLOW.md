# Dastavez — Static UI Flow

## Purpose

Build a clickable React Native prototype that settles Dastavez's core screens and navigation before camera, OCR, file picker, export, or persistence integrations are added. Use mock/sample data only. Do not request device permissions or handle real documents.

## Product Decisions

- App name: **Dastavez**. Subtitle: **Offline Document Scanner**.
- Platform: Android and iOS, implemented in React Native with TypeScript.
- Home screen prioritizes recent documents, search, and a prominent Scan action.
- Import entry points cover photos and PDFs, but the prototype simulates selection.
- Visual direction: calm and official, with accessible contrast, legible type, clear labels, and generous touch targets.
- No account or sign-in flow.

## Navigation Map

```text
First Launch → Unlock → Home
                         ├── Scan → Capture Preview → Page Review → Edit & Save → Document View
                         ├── Import → Mock Source Selection → Edit & Save → Document View
                         ├── Recent Document → Document View
                         └── Settings

Document View → Export Confirmation → Mock Share Handoff → Document View
Document View → Delete Confirmation → Home
```

Use a simple stack for task screens and a persistent Home/Settings navigation affordance for top-level destinations. Back navigation returns to the previous screen and preserves unsaved mock state until the user explicitly discards it.

## Screens and Behavior

### 1. First Launch

- Welcome to Dastavez and a short explanation that scans are intended to stay on the device.
- Show the BYOD limitation: the app cannot control OS backups, screenshots, share destinations, or a compromised phone.
- Continue goes to Unlock. No account creation.

### 2. Unlock

- Mock device-authentication prompt with **Unlock**, **Cancel**, and **Try again** states.
- Successful mock unlock goes to Home. Cancel/failure stays on the screen and shows a concise status message.

### 3. Home

- Header with Dastavez identity, search field, and Settings action.
- Prominent **Scan document** button and **Import** action.
- Recent document list rows show title, date, page count, and file type using seeded mock entries.
- Include a first-use empty state with the same Scan and Import actions.
- Search filters the seeded list locally; an unmatched query shows a no-results state.

### 4. Scan and Capture Preview

- Simulated camera viewport with framing guide, flash toggle visual, shutter, and close/back action.
- Shutter adds a seeded mock page and opens Page Review; it never opens the real camera.
- Provide a separate permission-denied simulation with explanation and a **Back to Home** action. Do not link to device Settings.

### 5. Page Review

- Thumbnail strip/grid with page numbers and selected-page emphasis.
- Mock controls: Add page, rotate, reorder, retake, remove, Continue.
- Add/retake uses seeded pages and mock state only.
- Removing the last page returns to capture preview; leaving with unsaved pages asks whether to discard.

### 6. Import

- Source chooser with **Photos** and **PDFs** options.
- Each option opens a mock picker containing sample items and Cancel/Select actions.
- Selecting an item creates an in-memory draft and continues to Edit & Save. No OS picker or filesystem access.

### 7. Edit & Save

- Preview the selected mock page with Crop, Rotate, and filter controls represented as visual controls; actions update mock UI state only.
- Document title field, multipage PDF toggle, and English OCR toggle/status.
- **Save document** creates an in-memory document record and opens Document View.
- Simulate OCR failure with Retry and Continue without OCR actions.
- Simulate low storage with a blocking notice and Back action; do not discard draft without confirmation.
- Unsaved changes prompt on Back/Cancel: **Keep editing** or **Discard draft**.

### 8. Document View

- Show mock document preview, title, page count, and page navigation.
- Tabs or a segmented control switch between Preview and recognized text; if OCR failed or is unavailable, show the relevant empty/error state.
- Actions: Export PDF, Export JPEG, Delete, Back to Home.
- Deletion requires explicit confirmation; confirmed deletion removes the in-memory record and returns Home.

### 9. Export Confirmation and Mock Handoff

- Before either export, show format and destination-control notice: Dastavez does not control how another app handles an exported file.
- **Cancel** returns to Document View. **Continue** opens a mock share destination sheet with sample destinations and Cancel.
- Selecting a mock destination shows success feedback, then returns to Document View. No actual share sheet or network activity.

### 10. Settings

- Privacy and local-storage explanation, app-lock setting mock, and local document management entry.
- Include a **Delete all sample documents** action with a destructive confirmation.
- No admin, account, sync, analytics, or cloud controls.

## Prototype Data and State

- Seed 3–5 clearly fictional documents with fictional titles, dates, page counts, and sample OCR text.
- Keep all prototype documents and drafts in in-memory mock state; restart persistence is out of scope.
- Provide deterministic controls or developer-only toggles to reach empty library, permission denied, unlock cancelled, OCR failure, low storage, and export cancelled states.
- Do not use real agency names, logos, sensitive records, camera input, local files, network calls, or external SDKs.

## Acceptance Criteria

- A reviewer can navigate the main paths: First Launch → Unlock → Home → Scan → Page Review → Edit & Save → Document View → Export, and Home → Import → Edit & Save.
- Home supports populated, empty, and no-search-results states.
- All controls provide visible feedback; Back behavior is consistent and drafts are not silently discarded.
- Required failure, cancellation, confirmation, and delete states are reachable and understandable.
- The prototype makes no device permission requests, file access, camera access, OCR calls, exports, persistence writes, or network requests.
- Layout remains readable with large text and on small phone screens; controls have accessible labels and adequate touch targets.
