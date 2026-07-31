import { router } from 'expo-router';

export const resetToLogin = () => {
  router.replace('/(auth)/login');
};
