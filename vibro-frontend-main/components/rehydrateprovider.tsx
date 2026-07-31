// components/RehydrateProvider.tsx

"use client";

import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { rehydrateAuth } from "@/redux/slices/authSlice";

export default function RehydrateProvider({ children }: { children: React.ReactNode }) {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(rehydrateAuth());
  }, [dispatch]);

  return <>{children}</>;
}
