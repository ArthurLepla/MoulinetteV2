import { create } from 'zustand';

export interface CachedAsset {
  assetId: string;
  path:    string;   // USINE@SECTEUR@MACHINE
  level:   number;
  name:    string;
}

export const useAssetCache = create<{
  tree: CachedAsset[];
  setTree: (t: CachedAsset[]) => void;
  clear: () => void;
}>(set => ({
  tree: [],
  setTree: (t) => set({ tree: t }),
  clear: () => set({ tree: [] }),
})); 