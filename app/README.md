# My Collection

Personal collection management application built with React, Vite, TypeScript, and IndexedDB.

## Storage Architecture

Collection data is stored locally in device storage using **IndexedDB** (`my_collection_db`).

### Key Capabilities
- **Persistent Storage:** Changes (additions, edits, deletions) persist across page reloads and browser restarts.
- **First Launch Choice:** Start with an empty collection or load learning items.
- **Atomic Writes:** State updates and navigation occur only after IndexedDB transactions commit to disk.
- **Data Protection:** Invalid data or newer schema versions are never silently overwritten or downgraded; diagnostic details are preserved.
- **Text Export / Import:** Full collection export and replacement import in JSON format (metadata, timestamps, and IDs preserved; photos excluded from text export).

## Development

```bash
npm install
npm run dev
npm run build
npm run lint
```
