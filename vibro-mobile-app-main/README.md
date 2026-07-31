# Vibro Mobile App

## Overview

The Vibro Mobile App is built using **React Native**, **Expo**, and **TypeScript**. It communicates with the Vibro Backend APIs and uses **EAS Build** for generating Android application packages (APKs).

### Key Features

- React Native with Expo
- TypeScript
- Expo Router
- EAS Build for Android APKs
- OTA Updates using Expo

---

## Technology Stack

| Component | Version |
|----------|----------|
| React Native | 0.81.4 |
| Expo SDK | 54.0.0 |
| Language | TypeScript |
| Navigation | Expo Router |

---

## Prerequisites

Before running the project, ensure the following are installed:

- Node.js (LTS Recommended)
- npm
- Android Studio
- Android SDK
- Git
- Expo Go (Android/iOS)
- EAS CLI

---

# Getting Started

## Clone the Repository

```bash
git clone <repository-url>
cd <project-directory>
```

## Checkout the Required Branch

```bash
git checkout <branch_name>
```

## Install Dependencies

```bash
npm install
```

## Install EAS CLI

```bash
npm install -g eas-cli
```

## Login to Expo

```bash
eas login
```

Login using the Expo account that has access to the project.

If prompted to install compatible Expo packages, run:

```bash
npx expo install
```

---

# Running the Application

Start the Expo development server:

```bash
npx expo start
```

For local testing using Expo Go:

1. Start the Expo development server.
2. Press **S** to switch to **Expo Go** mode (if required).
3. Open the **Expo Go** application on your mobile device.
4. Scan the QR code displayed in the terminal or browser.
5. The application will launch on your device.

---

# API Configuration

Configure the backend API endpoint in:

```
services/index.ts
```

### QA Environment

```ts
const BASE_URL = "https://qa.api.vibroets.com/";
```

### Production Environment

```ts
const BASE_URL = "https://api.vibroets.com/";
```

> Ensure the correct API Base URL is configured before testing or generating builds.

---

# Build Commands

### Preview APK

```bash
eas build --profile preview-apk-android --platform android
```

### Production APK

```bash
eas build --profile production --platform android --clear-cache
```

### Local APK

```bash
eas build -p android --profile preview-apk --local
```

### Internal Preview Build

```bash
eas build --profile preview --platform android
```

---

# OTA Update

Publish JavaScript updates without rebuilding the APK.

### Publish Update

```bash
eas update --branch preview --message "Preview update"
```

### View Published Updates

```bash
eas update:list --branch preview
```

---

# Useful Commands

### Start Development Server

```bash
npx expo start
```

### Clear Expo Cache

```bash
npx expo start --clear
```

### Run on Android Emulator

```bash
npx expo run:android
```

---

# Development Notes

- Always run `npm install` after cloning or pulling the latest code.
- Verify the correct API Base URL before creating QA or Production builds.
- Use Expo Go for local application testing.
- Ensure the correct Expo account is logged in before generating builds.
- Build profiles are maintained in `eas.json`.
- If cache-related issues occur, clear the Expo cache before restarting the application.

---

# Summary

The Vibro Mobile App is built using **React Native**, **Expo**, and **TypeScript**. Install the project dependencies, log in to Expo, configure the appropriate API Base URL, and start the development server using:

```bash
npx expo start
```

For Android builds, use the appropriate **EAS Build** profile based on the target environment.
