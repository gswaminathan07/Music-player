# FileUploadModal Progress Summary & Re-Import Failure Recovery

A detailed import progress summary and failure recovery system inside `FileUploadModal` that reports exact IndexedDB storage success vs failure counts, lists detailed failure reasons, automatically skips duplicate tracks, and provides a 'Retry Failed' action.

## User Review & Critical Decisions

> [!IMPORTANT]
> Confirmed user choices for this update:
> - **Library Behavior**: Append new unique tracks and preserve existing 295 stored tracks in IndexedDB.
> - **Failure Visibility**: Display live success counter, detailed failure reason list, and a prominent 'Retry Failed' button.
> - **Duplicate Handling**: Automatically skip duplicate track titles and artists during re-import and retry loops.

---

## 1. Overview & Core Concept

When users import large audio folders (e.g., 423 MP3/M4A files), some files may be skipped or fail due to unreadable ID3 tags, corrupted binary blobs, or non-audio formats. 

This enhancement upgrades `FileUploadModal` and `deviceFileService` so that:
1. Every file selected from the device is tracked individually during IndexedDB storage.
2. A live **Import Progress Summary** displays:
   - **Successfully Stored**: Count of files saved into IndexedDB (`offlineStorage.saveAudioBlob`).
   - **Failed / Skipped**: Count of files that failed or were skipped as duplicates.
3. A **Failure Breakdown List** details exact file names and reasons (e.g. *Duplicate track title/artist*, *Unsupported codec*, *Storage limit*).
4. A **"Retry Failed"** button allows re-attempting failed files without re-scanning the entire folder.

---

## 2. User Experience & Visual Design

### Key User Flows
1. **Initiate Scan**: User clicks **Scan Music Folder** or **Select Audio Files** in `FileUploadModal`.
2. **Live Progress**: A real-time progress bar shows `Processing 142 / 423 files...`.
3. **Progress Summary Card**: Once scanning completes (or during scan), a summary card displays:
   - `✓ 295 Tracks Stored in IndexedDB` (Green badge)
   - `⚠️ 128 Files Skipped / Failed` (Amber badge)
4. **Detailed Failure List**: An expandable list displays file names alongside specific failure details (e.g. *Skipped: "Song Title" already exists in library* or *Failed: Corrupt audio header*).
5. **Retry Action**: User clicks **"Retry 128 Failed Files"** to re-attempt importing only those specific failed files into IndexedDB.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Detailed Result Object for `processDeviceFiles`**
  - *Approach*: Upgrade `processDeviceFiles` to return `{ successTracks: Track[], failedFiles: Array<{ file: File; reason: string }> }`.
  - *Why*: Allows `FileUploadModal` to isolate failed files and provide precise feedback rather than silent drops.

- **Decision 2: Automatic Duplicate Filter**
  - *Approach*: Normalize title and artist (`norm(title)::norm(artist)`) and check against `tracks` state before saving to IndexedDB.
  - *Why*: Prevents creating identical track entries when users re-scan their music folder to fetch missing songs.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                          FileUploadModal UI                            │
├────────────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────┐              ┌───────────────────────────┐  │
│  │ Scan Music Folder     │              │ Select Audio Files        │  │
│  └───────────┬───────────┘              └─────────────┬─────────────┘  │
└──────────────┼────────────────────────────────────────┼────────────────┘
               │                                        │
               ▼                                        ▼
┌────────────────────────────────────────────────────────────────────────┐
│              deviceFileService.processDeviceFiles                     │
│  1. Extract ID3 metadata / filename title & artist                     │
│  2. Deduplicate check against existing library tracks                   │
│  3. Save binary Blob to IndexedDB (offlineStorage.saveAudioBlob)       │
└──────────────┬────────────────────────────────────────┬────────────────┘
               │                                        │
               ▼                                        ▼
┌──────────────────────────────┐        ┌────────────────────────────────┐
│ Success Buffer               │        │ Failure Buffer                 │
│ (Track objects)              │        │ ({ file: File, reason: string})│
└──────────────┬───────────────┘        └───────────────┬────────────────┘
               │                                        │
               ▼                                        ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     FileUploadModal Summary Card                       │
│  - "295 Saved in IndexedDB" badge                                      │
│  - "128 Failed / Skipped" warning badge                                │
│  - Expandable Failure Reasons list                                     │
│  - [Retry Failed Files] button ──► Re-injects Failure Buffer to scan   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Planned Changes

1. **`src/services/deviceFileService.ts`**:
   - Update `processDeviceFiles` to return `{ successTracks: Track[], failedFiles: Array<{ file: File; reason: string }> }`.
   - Implement deduplication logic against existing tracks (`title` + `artist`).

2. **`src/components/FileUploadModal.tsx`**:
   - Add state for `importSummary`: `{ successCount: number, failedFiles: Array<{ file: File; reason: string }> }`.
   - Add UI for progress summary badges, scrollable failure reasons list, and **"Retry Failed Files"** button.

3. **`src/App.tsx`**:
   - Pass existing `tracks` list into `FileUploadModal` for duplicate checking.
   - Handle appended tracks state updates seamlessly.
