import { create } from 'zustand';

export const useAssetIdMap = create<{
  idMap: Record<string, string>;
  setIdMap: (m: Record<string, string>) => void;
  clear: () => void;
}>(set => ({
  idMap: {},
  setIdMap: (m) => set({ idMap: m }),
  clear: () => set({ idMap: {} }),
})); 