import { create } from "zustand";

interface FormStore {
  isFormDirty: boolean;
  setIsFormDirty: (value: boolean) => void;
  prefetchedFormId: string | null;
  prefetchedFormData: any | null;
  setPrefetchedForm: (id: string, data: any) => void;
  consumePrefetchedForm: (id: string) => any | null;
  backgroundSavingIds: string[];
  beginBackgroundSave: (id: string) => void;
  endBackgroundSave: (id: string) => void;
}

export const useFormStore = create<FormStore>((set) => ({
  isFormDirty: false,
  setIsFormDirty: (value) => set({ isFormDirty: value }),
  prefetchedFormId: null,
  prefetchedFormData: null,
  setPrefetchedForm: (id, data) => set({ prefetchedFormId: id, prefetchedFormData: data }),
  consumePrefetchedForm: (id) => {
    let consumed: any | null = null;
    set((state: any) => {
      if (state.prefetchedFormId === id) {
        consumed = state.prefetchedFormData;
        return { prefetchedFormId: null, prefetchedFormData: null };
      }
      return {};
    });
    return consumed;
  },
  backgroundSavingIds: [],
  beginBackgroundSave: (id) => set((state: any) => ({ backgroundSavingIds: Array.from(new Set([...(state.backgroundSavingIds || []), id])) })),
  endBackgroundSave: (id) => set((state: any) => ({ backgroundSavingIds: (state.backgroundSavingIds || []).filter((x: string) => x !== id) })),
}));
