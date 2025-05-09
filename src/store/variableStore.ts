import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { Variable } from '../types';

interface VariableState {
  // Variables data
  variables: Variable[];
  previewVariables: Variable[]; // For preview before creation
  
  // Status flags
  varsReady: boolean;
  variablesCreated: boolean;
  isCreatingVariables: boolean;
  
  // Processing status
  progress: number; // 0-100 percentage for bulk operations
  processedCount: number;
  totalCount: number;
  
  // Error state
  error: string | null;
  
  // Actions
  setVariables: (variables: Variable[]) => void;
  setPreviewVariables: (variables: Variable[]) => void;
  setVarsReady: (ready: boolean) => void;
  setVariablesCreated: (created: boolean) => void;
  setProgress: (progress: number) => void;
  setProcessedCount: (count: number) => void;
  setTotalCount: (count: number) => void;
  setError: (error: string | null) => void;
  resetVariableStore: () => void;
}

export const useVariableStore = create<VariableState>()(
  immer((set) => ({
    // Initial state
    variables: [],
    previewVariables: [],
    varsReady: false,
    variablesCreated: false,
    isCreatingVariables: false,
    progress: 0,
    processedCount: 0,
    totalCount: 0,
    error: null,
    
    // Actions
    setVariables: (variables) => set({ variables }),
    
    setPreviewVariables: (variables) => set({ 
      previewVariables: variables,
      totalCount: variables.length
    }),
    
    setVarsReady: (ready) => set({ varsReady: ready }),
    
    setVariablesCreated: (created) => set({ 
      variablesCreated: created,
      isCreatingVariables: !created // If created, we're no longer creating
    }),
    
    setProgress: (progress) => set({ progress }),
    
    setProcessedCount: (count) => set((state) => {
      state.processedCount = count;
      // Update progress based on total count
      if (state.totalCount > 0) {
        state.progress = Math.round((count / state.totalCount) * 100);
      }
    }),
    
    setTotalCount: (count) => set({ totalCount: count }),
    
    setError: (error) => set({ error }),
    
    resetVariableStore: () => set({
      variables: [],
      previewVariables: [],
      varsReady: false,
      variablesCreated: false,
      isCreatingVariables: false,
      progress: 0,
      processedCount: 0,
      totalCount: 0,
      error: null
    })
  }))
); 