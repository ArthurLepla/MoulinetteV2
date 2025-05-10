import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { MappingConfig } from '@/components/mapping-modal'; // Assuming MappingConfig is exported from here

interface MappingState {
  mappingConfig: MappingConfig | null;
  setMappingConfig: (config: MappingConfig | null) => void;
}

export const useMappingStore = create<MappingState>()(
  immer((set) => ({
    mappingConfig: null,
    setMappingConfig: (config) => set({ mappingConfig: config }),
  }))
); 