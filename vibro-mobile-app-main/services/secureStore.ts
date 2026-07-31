import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const isWeb = Platform.OS === "web";

/**
 * SecureStore Service
 * Provides a simple interface for securely storing key-value pairs
 * Falls back to localStorage on web
 */
export const SecureStoreService = {
  set: async (
    key: string,
    value: string,
    options?: SecureStore.SecureStoreOptions
  ): Promise<void> => {
    try {
      const jsonValue = JSON.stringify(value);
      if (isWeb) {
        localStorage.setItem(key, jsonValue);
      } else {
        await SecureStore.setItemAsync(key, jsonValue, options);
      }
    } catch (error) {
      console.error(`SecureStore set error for key "${key}":`, error);
      throw error;
    }
  },

  get: async (key: string): Promise<string | null> => {
    try {
      let jsonValue: string | null = null;
      if (isWeb) {
        jsonValue = localStorage.getItem(key);
      } else {
        jsonValue = await SecureStore.getItemAsync(key);
      }
      return jsonValue ? JSON.parse(jsonValue) : null;
    } catch (error) {
      console.error(`SecureStore get error for key "${key}":`, error);
      return null;
    }
  },

  remove: async (key: string): Promise<void> => {
    try {
      if (isWeb) {
        localStorage.removeItem(key);
      } else {
        await SecureStore.deleteItemAsync(key);
      }
    } catch (error) {
      console.error(`SecureStore remove error for key "${key}":`, error);
      throw error;
    }
  },

  isAvailable: async (): Promise<boolean> => {
    try {
      if (isWeb) return true;
      return await SecureStore.isAvailableAsync();
    } catch (error) {
      console.error("SecureStore availability check error:", error);
      return false;
    }
  },
};

/**
 * Commonly used SecureStore keys
 */
export const SecureStoreKeys = {
  AUTH_INFO: "authInfo",
};
