"use client";
import { Toaster } from "react-hot-toast";

export function ToastProvider() {
  return (
    <Toaster
      position="top-center"
      toastOptions={{
        duration: 3000,
        style: {
          background: "rgba(15, 23, 42, 0.9)",
          color: "#fff",
          borderRadius: "12px",
          padding: "12px 16px",
          fontSize: "0.9rem",
          boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
          backdropFilter: "blur(8px)",
        },
        success: {
          iconTheme: {
            primary: "#4ade80",
            secondary: "#1e293b",
          },
        },
        error: {
          iconTheme: {
            primary: "#f87171",
            secondary: "#1e293b",
          },
        },
      }}
    />
  );
}
