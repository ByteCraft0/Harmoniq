# HARMONIQ LITE — ANDROID DEVELOPMENT & BUILD SETUP GUIDE

**Document Version:** 1.0.0
**Target:** Harmoniq Lite (Android)
**Location:** `docs/android/ANDROID_SETUP.md`

---

## 1. Prerequisites

To build and run Harmoniq Lite on an Android device or emulator:

1. **Node.js:** v20.x or v22.x LTS
2. **Java Development Kit (JDK):** JDK 17 or JDK 21 (Temurin / OpenJDK recommended)
3. **Android Studio:** Ladybug (2024.2+) or newer
4. **Android SDK Packages:**
   - Android SDK Platform 35 / 36
   - Android SDK Build-Tools 35.0.0
   - Android SDK Command-line Tools (latest)
   - Android Emulator
5. **Environment Variables:**
   ```powershell
   $env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.x"
   $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
   $env:PATH += ";$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\cmdline-tools\latest\bin"
   ```

---

## 2. Project Configuration Details

- **Package Name / Application ID:** `com.bytecraft.harmoniqlite`
- **Application Display Name:** `Harmoniq Lite`
- **Capacitor Version:** `8.6.2`
- **Min SDK:** 24 (Targeting Android 7.0+, recommended minimum Android 8.0 API 26 for Media3)
- **Target SDK:** 35 / 36 (Android 15 / 16)
- **Compile SDK:** 36

---

## 3. Build & Development Workflows

### 3.1 Mobile Web Bundle & Android Sync
To build the React production assets and synchronize them into the Android native project:
```bash
npm run mobile:build
```
*(Executes `vite build && npx cap sync android`)*

### 3.2 Sync Native Plugins & Configs Only
When modifying `capacitor.config.ts` or native plugin registrations:
```bash
npm run mobile:sync
```

### 3.3 Open in Android Studio
To launch the project in Android Studio for debugging or running on an emulator/device:
```bash
npm run mobile:open
```

### 3.4 Command-Line APK Compilation (When Android SDK / JDK is available)
From the repository root:
```bash
cd android
./gradlew assembleDebug
```
The compiled debug APK will be located at:
`android/app/build/outputs/apk/debug/app-debug.apk`

---

## 4. Testing the Mobile Shell in Browser / Desktop

You can preview and test the mobile shell directly in any browser or desktop environment without Android Studio:
```bash
npm run dev
```
Navigate to:
`http://localhost:5173/?mobile=1`
