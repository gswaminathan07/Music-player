# Implementation Plan: Master Console 3-Column Layout, Minimalist Header & Instant Cache Busting

Restructure the Master Console into a clean, minimalistic 3-column desktop layout (Karaoke on the left, Platter & high-framerate Analyzer in the center, Queue on the right), slim down the top bar by removing duplicate song info, eliminate the oscilloscope trace, enhance lyrics search for hits like P.Y.T., and ensure client browsers receive updates immediately via network-first caching.

## User Review Required

> [!IMPORTANT]
> - **Top Bar Redesign**: The top bar in the Master Console will be slimmed down to an ultra-compact toolbar (minimize button, compact format badge, EQ and share buttons), removing the duplicate track title and artist.
> - **Layout Structure**: 
>   - **Desktop**: Left column: Live Karaoke & Lyrics; Center column: Turntable Platter & 60 FPS Peak Analyzer; Right column: Up Next Playback Queue.
>   - **Mobile**: Responsive single-column view auto-scaled so the platter, analyzer, and docked lyrics fit comfortably on screen without vertical scrolling.
> - **Cache Busting**: Update `sw.js` and `index.html` to enforce Network-First fetching on all application scripts and pages, clearing stale cached bundles automatically.

---

## Proposed Changes

### 1. Service Worker & Instant Update Cache Busting
#### `public/sw.js` & `index.html`
- Bump service worker cache name to `vettify-v3-live`.
- Switch strategy for navigational documents (`/`, `index.html`) and application scripts/styles from cache-first to **Network-First** with stale-while-revalidate fallback for offline mode.
- In `activate` event, immediately purge all older static caches and call `self.clients.claim()`.
- Add an automatic reload trigger when a new service worker takes control.

---

### 2. FullScreenPlayer Top Bar & Layout Redesign
#### `src/components/FullScreenPlayer.tsx`
- **Slim Header Bar**:
  - Remove the large central song title and artist lines from the top bar.
  - Convert the top bar into a sleek 36px-high utility bar with:
    - Left: Down chevron icon + subtle "STUDIO CONSOLE" tag.
    - Right: 10-Band EQ button, Share button, and Close button.
- **Remove Oscilloscope Trace**:
  - Verify and guarantee no oscilloscope waveform renders beneath the spectrum bars in the Peak Level Analyzer.
- **3-Column Desktop Layout**:
  - **Left Column**: Live interactive Karaoke & Lyrics stage with time-synced auto-scrolling, translation, romanization toggles, and click-to-seek lines.
  - **Center Column**: Turntable Platter (`PixelTurntableWidget` master size) + 60 FPS Peak Level Analyzer (VU indicator + 42 logarithmic frequency bands).
  - **Right Column**: Up Next Queue showing track titles, artists, durations, active playing indicator (`▶`), and click-to-play switching.
- **Mobile Viewport Optimization**:
  - On viewports `< 1024px`, smoothly collapse the side columns into an auto-fitting layout with segmented navigation (`Platter`, `Karaoke`, `VU Meter`, `Queue`) that prevents vertical overflow.

---

### 3. Peak Level Analyzer Frame Rate & Smoothness
#### `src/components/AudioVisualizer.tsx`
- Ensure the canvas render loop runs at 60 FPS via a dedicated `requestAnimationFrame` loop.
- Optimize bar rendering calculations to eliminate layout thrashing.
- Keep the design minimal, sharp, and pixel-crisp without clutter.

---

### 4. Lyrics Service & Server-Side Search for Famous Tracks (e.g. P.Y.T.)
#### `server.ts` & `src/services/lyricsService.ts`
- Enhance the Google Search grounding prompt and query normalization for songs with abbreviations (e.g. "PYT" -> "Michael Jackson P.Y.T. (Pretty Young Thing)").
- Add title aliases and normalization to handle punctuation variations (e.g., "P.Y.T.", "PYT", "P. Y. T.").
- Ensure that when the client requests lyrics for "PYT" or "Vinmeen", the server accurately retrieves and time-syncs the lyrics.

---

## Verification Plan

### Automated Tests & Compiles
- Run `npm run lint` (`tsc --noEmit`) to verify zero TypeScript errors.
- Run `compile_applet` (`vite build`) to verify the production bundle builds cleanly.

### Visual & Interactive Verification
- Open the Master Console on desktop:
  - Verify the 3-column layout: Karaoke on the left, Turntable Platter & 60 FPS Analyzer in the center, Queue on the right.
  - Verify the top bar is slim and has no duplicate song title.
  - Verify there is no oscilloscope trace anywhere on the screen.
- Test playback on songs like "P.Y.T." and verify lyrics are retrieved and displayed in the Karaoke panel.
- Inspect cache and verify that reloads load the latest code immediately.
