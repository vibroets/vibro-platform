# Vibro Web Frontend

## Overview

The Vibro Web Frontend is built using **Next.js**, **React**, and **TypeScript**. It provides the web interface for the Vibro platform and communicates with the Vibro Backend APIs.

---

## Technology Stack

| Component | Version |
|-----------|----------|
| Next.js | 15.2.4 |
| React | 18.2.0 |
| TypeScript | 5.x |
| Tailwind CSS | 3.4.17 |
| PostCSS | 8.x |
| Autoprefixer | 10.4.20 |

---

## Prerequisites

Before running the project, ensure the following are installed:

- Node.js 20.x (Recommended)
- npm 10.x or later
- Git
- Visual Studio Code (Recommended)

> **Note:** The project Docker configuration uses Node.js 20 Alpine, so Node.js 20.x is recommended for local development.

---

## Getting Started

### Clone the Repository

```bash
git clone <repository-url>
cd vibro
```

### Checkout the Required Branch

```bash
git checkout <branch_name>
```

### Install Dependencies

```bash
npm install --legacy-peer-deps
```

### Run the Development Server

```bash
npm run dev
```

The application will be available at:

```
http://localhost:3000
```

---

## Backend API Configuration

Configure the backend API endpoint in:

```
utils/axiosInstance.ts
```

### QA Environment

```ts
const base_url = "https://qa.api.vibroets.com/api";
```

### Production Environment

```ts
const base_url = "https://api.vibroets.com/api";
```

> Ensure the correct API Base URL is configured before running the application or deploying to an environment.

---

## Core Package Versions

| Package | Version |
|----------|----------|
| next | 15.2.4 |
| react | 18.2.0 |
| react-dom | 18.2.0 |
| typescript | 5.x |
| tailwindcss | 3.4.17 |
| postcss | 8.x |
| autoprefixer | 10.4.20 |

---

## Development Notes

- Always pull the latest code before starting development.
- Install dependencies using:

```bash
npm install --legacy-peer-deps
```

- Verify that the backend service is running before testing API-related functionality.
- Ensure the correct API Base URL is configured in `utils/axiosInstance.ts`.
- Use Node.js 20.x for best compatibility.
- If dependency issues occur, delete the `node_modules` directory and reinstall the dependencies.

## To trigger front-end via Docker

docker run -d --name vibro-frontend --restart always -p 3000:3000  -e NODE_ENV=production intellectoglobal/vibro-frontend

---

## Summary

The Vibro Web Frontend is developed using **Next.js**, **React**, and **TypeScript**. Install the dependencies using `npm install --legacy-peer-deps`, configure the appropriate backend API URL, and start the application with:

```bash
npm run dev
```

The application will be available at:

```
http://localhost:3000
```
