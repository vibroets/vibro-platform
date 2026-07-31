"use client";

import GlobalLoader from "@/components/ui/globalloader";
import ChatBot from "@/components/ChatBot";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // 👇 listener for manual trigger
    const handleStart = () => setLoading(true);
    window.addEventListener("route-loader-start", handleStart);

    return () => {
      window.removeEventListener("route-loader-start", handleStart);
    };
  }, []);

  useEffect(() => {
    if (!pathname) return;
    setLoading(true);

    const timeout = setTimeout(() => setLoading(false), 500);

    return () => clearTimeout(timeout);
  }, [pathname]);

  // Avoid hydrating server-rendered interactive markup that may be mutated by
  // browser extensions before React loads (common hydration mismatch cause).
  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white/70">
        <GlobalLoader />
      </div>
    );
  }

  return (
    <>
      {loading && (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-white/70 backdrop-blur-sm z-50">
          {/* Spinner */}
          <div className="mb-10">
            <GlobalLoader />
          </div>
        </div>
      )}
      {children}
      <ChatBot />
    </>
  );
}
