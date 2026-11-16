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

## Development & Verification Commands

All standard development and verification commands are run from the `app/` directory:

| Command | What runs | Needs server? | Exits on its own? | Excluded checks |
| :--- | :--- | :--- | :--- | :--- |
| `npm run lint` | Oxlint fast static linter (116 rules across source files) | No | Yes (code 0 on pass) | Typechecking, runtime tests, DOM rendering, storage |
| `npm run build` | TypeScript project references compilation (`tsc -b`) and Vite production bundle | No | Yes (code 0 on pass) | **Not a user-scenario test.** Excludes runtime tests, user interactions, and storage |
| `npm run check` | Combined offline verification: `oxlint` + `tsc -b` + `npm test` | No | Yes (code 0 on pass) | Real browser rendering, native Android APIs |
| `npm test` | Vitest test runner (unit rules and React Testing Library component tests) | No | Yes (code 0 on pass) | Real browser engine, real IndexedDB, Android platform |
| `npm run test:watch` | Vitest interactive file-watcher | No | No (stays active until `q` or `Ctrl+C`) | Real browser engine, real IndexedDB, Android platform |
| `npm run test:e2e` | Playwright test runner in isolated Chromium context with real IndexedDB | No (auto-starts dev server if needed) | Yes (code 0 on pass) | Native Android OS shell, Android hardware back button |

> [!NOTE]
> **Static Build vs. User-Scenario Tests:**  
> `npm run build` is a static build and TypeScript type-checking step. It verifies that syntax, types, and bundling succeed without errors. It does **not** execute user scenarios, component interactions, or database persistence.

> [!IMPORTANT]
> **Platform Scope:**  
> Playwright tests (`npm run test:e2e`) run in a real desktop browser engine (Chromium) against real IndexedDB. They do **not** test native Android features, Capacitor bridges, Android WebView lifecycles, or physical back-button handling.

## Running Tests

```bash
# 1. Run all unit and component tests
npm test

# 2. Run unit tests interactively during development
npm run test:watch

# 3. Run browser end-to-end tests (real IndexedDB lifecycle)
npm run test:e2e

# 4. Run complete static and unit verification in one command
npm run check
```

---

## Android Mobile Integration (Capacitor)

### 1. Selected Version
- **Capacitor Version:** **Capacitor 8** (`@capacitor/core@8.6.2`, `@capacitor/android@8.6.2`, `@capacitor/cli@8.6.2`).

### 2. Environment Requirements
- **Node.js:** v22.0.0 or higher (active environment: `v24.19.0`).
- **Android Studio:** Android Studio 2025.2.1+ / Otter or newer (active: `2026.1`).
- **Android SDK:**
  - Target / Compile SDK: **API 36** (`android-36`).
  - Build-tools: **36.0.0** (or 35.0.0+).
  - Minimum supported Android version: **API 24** (Android 7.0+).
- **JDK:** **JDK 21** (bundled JBR in Android Studio `/Applications/Android Studio.app/Contents/jbr/Contents/Home`).
- **Environment Variables (export in `~/.zshrc`):**
  ```bash
  export ANDROID_HOME=$HOME/Library/Android/sdk
  export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
  export PATH=$PATH:$ANDROID_HOME/platform-tools:$JAVA_HOME/bin
  ```

### 3. Android Project Location
- Native Android project root: **`app/android/`** (contains Gradle wrapper, `AndroidManifest.xml`, `MainActivity.java`, and native configurations).

### 4. Build, Sync, and Open Commands
Run all commands from `app/`:

```bash
# 1. Compile the web bundle to dist/
npm run build

# 2. Synchronize web assets and configurations into native Android container
npx cap sync android

# 3. Launch the native project in Android Studio
npx cap open android
```

### 5. Device Launch Method
- **Option A (Android Studio):**
  1. Open the project via `npx cap open android`.
  2. In Android Studio's device dropdown, select an Android Virtual Device (AVD running API 24–36) or a connected physical device (with USB debugging enabled).
  3. Click **Run** (green play icon or `Ctrl+R`).
- **Option B (Command Line):**
  ```bash
  npx cap run android
  ```

### 6. Development Update Cycle (After React Code Changes)
Whenever you modify React components, styles, or logic:
```bash
# Step 1: Recompile web assets
npm run build

# Step 2: Push changes into the native Android assets directory
npx cap sync android

# Step 3: Rebuild and deploy in Android Studio (or run npx cap run android)
```

### 7. What Was Verified on Android
- **Web Compilation:** Web code builds cleanly into `app/dist/` without type or syntax errors.
- **Native Sync:** Assets (`dist/index.html`, SVG icons, JS/CSS bundles) successfully copied to `android/app/src/main/assets/public/`.
- **Config Sync:** Generated `android/app/src/main/assets/capacitor.config.json` with correct parameters (`appId: "com.mycollection.app"`, `appName: "My Collection"`).
- **Native Scaffolding:** `MainActivity.java`, AndroidManifest, Gradle wrapper scripts, and resource directories are properly structured and linked.

### 8. Known Limitations
- **Physical Back Button:** The Android hardware back button closes the application by default unless wired to the in-app router via `@capacitor/app`.
- **Native File Export:** In the browser, JSON export triggers an immediate download. On native Android, saving to the device's shared Downloads folder or sharing to other apps requires native file/share integrations (`@capacitor/filesystem` or `@capacitor/share`).
- **Photos in Exports:** Text-based JSON exports exclude photo attachments as stated in the UI.
- **Test Automation Scope:** Playwright automated tests run against desktop Chromium; native Android APK execution and device gestures are verified manually.
