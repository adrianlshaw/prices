# Price Checker — Product Specification

## Overview

A mobile-first web app for iPhone that lets you scan product barcodes in-store and instantly see whether you've found a cheaper price elsewhere. When a product is new, you capture its price using your camera; the app uses OCR to extract the number automatically.

---

## Goals

- **Zero-friction scanning**: open the app, point at a barcode, get a result.
- **Minimal taps**: no unnecessary confirmation dialogs or extra steps.
- **Works offline-first**: a cached local database so the app works in stores with poor signal.
- **iPhone-optimised**: full-screen camera, large tap targets, no hover states.

---

## Core User Flows

### Flow 1 — Product already in the database

1. User opens the app → camera activates immediately (no "start scan" button).
2. User points camera at a barcode → barcode decoded automatically (no tap required).
3. App looks up the barcode in the local database.
4. **Result screen** displays:
   - Product name (if stored)
   - Cheapest known price + store name, prominently
   - Full price history table: store | price | date recorded
   - A "Add price at this store" button (for updating with a new observation)
5. Tapping "Add price at this store" → goes straight to Flow 2, step 3.

### Flow 2 — New product (not in database)

1. Barcode decoded → no match found.
2. App shows: *"New product — capture the price tag"* with the camera still live.
3. User points camera at a price tag → OCR runs continuously, candidate price highlighted in an overlay.
4. When a price is detected with high confidence, it is auto-confirmed (no tap). A brief visual flash confirms acceptance.
5. App prompts for **store name** (text field, pre-filled with the last store used).
6. Optionally: product name (text field, can be left blank).
7. One tap "Save" → entry written to database → returns to scanner.

### Flow 3 — Manual price entry fallback

- Accessible from the OCR screen via a small "Enter manually" link.
- Numeric keypad field for price. Store name pre-filled. One tap "Save".

---

## Screens

### Scanner Screen (home/default)
- Full-screen camera feed.
- Thin status bar at top: app name + settings icon.
- No other chrome. The camera IS the UI.
- On successful barcode decode: short haptic + brief overlay, then transition.

### Result Screen
- Back button returns to scanner immediately (camera restarts).
- Cheapest price shown in large type with store name beneath it.
- Secondary list of all entries, newest first.
- "Add new price" button at the bottom (sticky).

### Add Price Screen
- Camera feed (for OCR) takes upper 60% of screen.
- Detected price overlaid on feed in real time.
- Store name field (text, autocomplete from previously used stores).
- Product name field (optional).
- "Save" button — disabled until price is populated.
- "Enter manually" link opens a numeric input instead of the camera feed.

### Settings Screen
- Manage stored products (list, search, delete).
- Export data as CSV.
- Clear all data.

---

## Data Model

### `products`
| Field | Type | Notes |
|---|---|---|
| `barcode` | string (PK) | EAN-13, UPC-A, etc. |
| `name` | string | optional |
| `created_at` | ISO datetime | |

### `price_entries`
| Field | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `barcode` | string (FK) | |
| `store` | string | |
| `price` | number | stored in pence (integer); display as £X.XX |
| `recorded_at` | ISO datetime | |
| `source` | enum | `ocr` \| `manual` |

The cheapest price per product is `MIN(price)` across all entries. If the user records a new (lower) price, that becomes the new cheapest.

---

## Technical Stack (recommended)

| Concern | Choice | Reason |
|---|---|---|
| Framework | **React + Vite** (PWA) | Fast, installable on iPhone home screen |
| Barcode scanning | **ZXing-js** or **@zxing/browser** | Runs in Safari WebRTC camera stream |§
| Barcode lookup | **Open Food Facts API** | Free, no key required; fetches product name automatically |
| OCR | **Tesseract.js** (client-side) | No server required; price tags are simple digits |
| Local database | **IndexedDB via Dexie.js** | Persistent, offline, no backend needed |
| Styling | **Tailwind CSS** | Rapid mobile-first styling |
| State | **Zustand** | Lightweight, no boilerplate |

> A backend / sync layer can be added later if multi-device sync is needed.

### Barcode lookup behaviour

**v1 (no backend): call Open Food Facts directly from the client.**

Open Food Facts is a fully open database — read endpoints require **no API key**. The only convention is setting a descriptive `User-Agent` header (e.g. `PriceChecker/1.0`). It also supports CORS, so the browser can call it without a proxy. This keeps v1 fully client-side with no infrastructure to maintain.

> **General rule for future integrations**: if any third-party API requires a secret key, it must **never** be embedded in client-side code (keys are visible in browser DevTools). Those calls must go through a server-side backend that holds the key. Open Food Facts is safe precisely because it needs no key.

When a new barcode is decoded and no local entry exists:

1. The client calls `https://world.openfoodfacts.org/api/v3/product/{barcode}.json` directly from the browser.
2. If a match is returned, `product_name` (or `abbreviated_product_name`) is pre-filled in the Add Price form. The user can edit or clear it.
3. If the lookup fails or times out (>2 s), the product name field stays blank — the flow is not blocked.
4. The lookup is fire-and-forget; it does not delay the OCR / price-capture step.
5. The resolved product name is stored locally so the lookup is only made once per barcode.

**When a backend is introduced (v2+):** move the lookup server-side. The backend can cache results in its own product catalogue, avoid redundant external calls, and enrich records with data from multiple sources. The client would then call the app's own API instead of Open Food Facts directly.

---

## iPhone-Specific Considerations

- **Camera**: use `facingMode: { ideal: "environment" }` for the rear camera.
- **Permissions**: request camera permission on first launch with a friendly explanation.
- **Viewport**: `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` — respect the iPhone notch and home indicator.
- **Safe areas**: use `env(safe-area-inset-*)` for bottom padding on the scanner and result screens.
- **PWA**: include a Web App Manifest so the app can be added to the Home Screen and run full-screen (no Safari chrome).
- **Haptics**: use the Vibration API (`navigator.vibrate(50)`) on barcode decode.
- **Torch**: expose a torch/flashlight toggle button using `ImageCapture` API for dark stores.
- **Avoid**: hover interactions, right-click menus, mouse-only UX.

---

## UX Principles

1. **Camera is always on** — no "start scanning" button. The app's idle state IS the scanner.
2. **Auto-detect, auto-advance** — barcode decode and high-confidence OCR both advance the flow without a tap.
3. **Store name memory** — the last-used store is always pre-filled to save typing.
4. **Instant back** — every non-scanner screen has a prominent back arrow that returns to the scanner in one tap.
5. **No accounts, no sign-in** — data is local to the device.

---

## Out of Scope (v1)

- Cloud sync / multi-device
- Receipt scanning
- Price alerts / notifications
- Sharing prices with other users

---

## Open Questions

- Should there be a concept of "this price has expired" (e.g. entries older than N months are greyed out)?

---

## Future Direction — Automated Price Intelligence

A later version could introduce a backend service that automatically keeps the price database up to date, removing the need for manual scanning entirely in many cases:

- **Cloud database**: user-contributed price observations are synced to a central store, so other users' scans benefit everyone.
- **AI / scraping agent**: a background service monitors supermarket websites and updates prices automatically, flagging when a stored item has dropped in price at a known retailer.
- **Push notifications**: alert the user when a tracked product becomes cheaper somewhere.
- **Architecture hint**: design the local Dexie schema to be sync-friendly from day one (UUID PKs, `recorded_at` timestamps, `source` field already distinguishes `ocr` | `manual` — extend with `sync` | `agent`).

### Placeholder — AI price intelligence (e.g. OpenAI)

> **Status: not designed yet. Reserved for a future iteration.**

A natural language AI layer could let the user ask questions about their price data, such as:

- *"Is this cheaper at Tesco or Sainsbury's?"*
- *"Have I ever seen this product below £2?"*
- *"What's the best time of year I've recorded low prices for this item?"*

**Implementation notes (when ready):**

- The AI API key is **not bundled with the app**. Instead, the user supplies their own key in one of two ways:
  - **Bring Your Own Key (BYOK)**: user pastes their OpenAI API key into Settings. It is stored in `localStorage` / IndexedDB on-device only, never sent to any app server.
  - **OAuth login with the provider**: user signs in with their OpenAI (or equivalent) account; the app receives a scoped token, also stored locally.
- Calls to the AI API are then made directly from the client using the user-supplied credential. Because the key belongs to the user, there is no secret to protect from the user themselves.
- The Settings screen should include a clear "forget my API key" option.
- Consider rate-limiting on the client side (e.g. debounce requests) to help the user avoid unexpected charges.
- The feature should degrade gracefully: if no key is configured or the AI service is unavailable, the app still works normally. A prompt in the Result screen ("Set up AI suggestions →") can guide the user to add a key when they're ready.
