import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { Asset, EnergyType } from '../types';
import { createAnchorClient, anchorService } from '../lib/anchorClient';
import { EnergyMap, EnergyFlags } from '../lib/energyPropagate';

interface AssetState {
  // Assets data
  assets: Asset[];
  anchorMap: Record<string, string>; // Maps asset ID to Anchor platform ID
  leafEnergyMap: Record<string, EnergyType>; // User-defined energy types for leaf assets
  
  // Status flags
  isLoading: boolean;
  assetsCreated: boolean;
  energyFlagsReady: boolean;
  adapterSelected: boolean;
  adapterId: string | null;
  
  // Error state
  error: string | null;
  
  // Energy propagation data
  energyMap: EnergyMap; // Final map of assets to energy types (after tagging API)
  parentEnergyFlags: Record<string, EnergyFlags>; // Propagated energy flags
  
  // Actions
  setAssets: (assets: Asset[]) => void;
  setAnchorMap: (map: Record<string, string>) => void;
  setAssetsCreated: (created: boolean) => void;
  setEnergyFlagsReady: (ready: boolean) => void;
  setAdapterSelected: (selected: boolean) => void;
  setAdapterId: (id: string | null) => void;
  setLeafEnergyType: (assetId: string, energyType: EnergyType) => void;
  setLeafEnergyMap: (map: Record<string, EnergyType>) => void;
  setEnergyMap: (map: EnergyMap) => void;
  setParentEnergyFlags: (flags: Record<string, EnergyFlags>) => void;
  resetAssetStore: () => void;
}

export const useAssetStore = create<AssetState>()(
  immer((set) => ({
    // Initial state
    assets: [],
    anchorMap: {},
    leafEnergyMap: {},
    isLoading: false,
    assetsCreated: false,
    energyFlagsReady: false,
    adapterSelected: false,
    adapterId: null,
    error: null,
    energyMap: {},
    parentEnergyFlags: {},
    
    // Actions
    setAssets: (assets) => set({ assets }),
    
    setAnchorMap: (map) => set({ anchorMap: map }),
    
    setAssetsCreated: (created) => set({ assetsCreated: created }),
    
    setEnergyFlagsReady: (ready) => set({ energyFlagsReady: ready }),
    
    setAdapterSelected: (selected) => set({ adapterSelected: selected }),
    
    setAdapterId: (id) => set({ adapterId: id }),
    
    setLeafEnergyType: (assetId, energyType) => set((state) => {
      state.leafEnergyMap[assetId] = energyType;
    }),
    
    setLeafEnergyMap: (map) => set({ leafEnergyMap: map }),
    
    setEnergyMap: (map) => set({ energyMap: map }),
    
    setParentEnergyFlags: (flags) => set({ parentEnergyFlags: flags }),
    
    resetAssetStore: () => set({
      assets: [],
      anchorMap: {},
      leafEnergyMap: {},
      assetsCreated: false,
      energyFlagsReady: false,
      adapterSelected: false,
      adapterId: null,
      error: null,
      energyMap: {},
      parentEnergyFlags: {}
    })
  }))
); 