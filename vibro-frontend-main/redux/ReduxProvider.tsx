"use client";

import { Provider } from "react-redux";
import { store } from "./store";
import { useEffect } from "react";
import { rehydrateAuth } from "./slices/authSlice";

export function ReduxProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Dispatch rehydration action when app loads
    store.dispatch(rehydrateAuth());
  }, []);

  return <Provider store={store}>{children}</Provider>;
}
