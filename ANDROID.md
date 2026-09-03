# ApexLoad Android Wrapper

This Capacitor wrapper loads the live ApexLoad web app:

```text
https://apexload-azure.vercel.app
```

## Requirements

- Android Studio or Android SDK installed.
- JDK 21. This machine is configured to use Temurin JDK 21 at
  `C:\Users\Nick\AppData\Local\Programs\Temurin\jdk-21`.
- USB debugging enabled on the Android phone.

## Build

```bash
npm run android:build
```

The debug APK will be written under:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## Install On A Phone

1. Connect the phone over USB.
2. Approve the USB debugging prompt on the phone.
3. Run:

```bash
npm run android:install
```

If `adb` is on PATH, you can confirm the phone is visible with:

```bash
adb devices
```

## Notes

- Health Connect is intentionally not included in Phase 1.
- The app id is `com.apexload.app`.
- Supabase Auth redirect URLs must include `com.apexload.app://auth/callback`
  so Google sign-in can return from Chrome to the installed Android app.
- The launcher icon and splash images are generated from `public/logo-mark.png`.
