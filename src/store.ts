import { create } from 'zustand';

interface AppState {
  /** The last store the user typed — pre-fills the Add Price form */
  lastStore: string;
  setLastStore: (store: string) => void;

  /** Barcode currently being worked on (from scanner to add-price screen) */
  pendingBarcode: string | null;
  setPendingBarcode: (barcode: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  lastStore: localStorage.getItem('lastStore') ?? '',
  setLastStore: (store) => {
    localStorage.setItem('lastStore', store);
    set({ lastStore: store });
  },

  pendingBarcode: null,
  setPendingBarcode: (barcode) => set({ pendingBarcode: barcode }),
}));
