import { Slot } from "expo-router";
import React from "react";
import Toast from "react-native-toast-message";
import { Provider, useDispatch, useSelector } from "react-redux";
import { RootState } from "../Redux/reducer/rootReducer";

import store from "../store"; // ✅ Use relative import
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { SessionExpiredModal } from "../components/SessionExpiredModal";
import { hideSessionExpiredModal } from "../Redux/reducer/modal/modalSlice";
import { logoutRequest } from "../Redux/reducer/auth/authSlice";
import { resetToLogin } from "../utility/navigation";

// Initialize background sync service
import "../services/backgroundSyncService";

function AppContent() {
  const dispatch = useDispatch();
  const sessionExpiredVisible = useSelector((state: RootState) => state.modal.sessionExpiredVisible);

  const handleSessionExpiredOk = () => {
    dispatch(hideSessionExpiredModal());
    dispatch(logoutRequest());
    resetToLogin();
  };

  return (
    <>
      <Slot />
      <Toast />
      <SessionExpiredModal
        visible={sessionExpiredVisible}
        onPress={handleSessionExpiredOk}
      />
    </>
  );
}

export default function RootLayout() {
  return (
    <Provider store={store}>
      {/* 👇 SafeAreaProvider prevents layout issues on devices */}
      <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom', 'left', 'right']}>
          <AppContent />
        </SafeAreaView>
      </SafeAreaProvider>
    </Provider>
  );
}
