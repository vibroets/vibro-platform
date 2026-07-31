// Module declarations for packages TypeScript may fail to resolve
declare module '@react-native-async-storage/async-storage';
declare module 'date-fns';
declare module 'expo-sharing';
declare module '@expo/vector-icons';
declare module 'expo-file-system';

// Fix expo-router "is not a module" - root index.d.ts has no exports
declare module 'expo-router' {
  import { ComponentType } from 'react';
  export const router: {
    push: (href: string | { pathname: string; params?: Record<string, unknown> }) => void;
    replace: (href: string) => void;
    back: () => void;
  };
  export function useRouter(): unknown;
  export function useLocalSearchParams<T = Record<string, string>>(): T;
  export function useSegments(): string[];
  export function usePathname(): string;
  export function useGlobalSearchParams<T = Record<string, string>>(): T;
  export function useNavigation<T = Record<string, unknown>>(): T & {
    addListener: (event: string, callback: (e: { preventDefault: () => void }) => void) => () => void;
    goBack: () => void;
    navigate: (name: string, params?: Record<string, unknown>) => void;
  };
  export function useFocusEffect(callback: () => void | (() => void)): void;
  export function withLayoutContext(Component: ComponentType<unknown>): ComponentType<unknown>;
  export const Slot: ComponentType<unknown>;
  export const Stack: ComponentType<unknown>;
  export const Redirect: ComponentType<{ href: string }>;
}
