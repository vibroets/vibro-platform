import type React from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { UserProvider } from "@/components/user-provider";
import { Toaster } from "@/components/ui/toaster";
import { ReduxProvider } from "@/redux/ReduxProvider";
import RehydrateProvider from "@/components/rehydrateprovider";
import "./globals.css";
import ClientLayout from "./client-layout"; // 👈 new wrapper
import { ToastProvider } from "@/components/ui/ToastProvider";
import { faviconDataUri } from "./embedded-favicon";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "VIBRO - Operational Excellence Tool",
  description: "A unified dashboard for operational excellence",
  generator: "v0.dev",
  icons: {
    icon: faviconDataUri,
    apple: faviconDataUri,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className={inter.className}>
        <ReduxProvider>
          <RehydrateProvider>
            <ThemeProvider defaultTheme="light">
              <UserProvider>
                <Toaster />
                <ToastProvider />
                <ClientLayout>{children}</ClientLayout>{" "}
                {/* 👈 wrap with client */}
              </UserProvider>
            </ThemeProvider>
          </RehydrateProvider>
        </ReduxProvider>
      </body>
    </html>
  );
}
