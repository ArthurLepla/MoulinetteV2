import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
// import { Variable } from '../types'; // Removed to resolve conflict

export interface Variable {
  name: string;
  topic: string;
  dataType: 'Double' | 'Boolean' | 'String' | 'Integer';
  units?: string;
  assetPath: string;        // USINE@FACILITIES@LT3@MACHINE
  level: number;            // 0-N for preview grouping
  assetId?: string;        // Ajouté pour le POST bulk variables
  adapterId?: string;      // ID de l'adaptateur associé à la variable
  // Removed totalCount from here as it seems to be a derived value or handled elsewhere
}

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
  appendPreview: (newVariables: Variable[]) => void;
  setVarsReady: (ready: boolean) => void;
  setVariablesCreated: (created: boolean) => void;
  setProgress: (progress: number) => void;
  setProcessedCount: (count: number) => void;
  setTotalCount: (count: number) => void;
  setError: (error: string | null) => void;
  resetVariableStore: () => void;
  templates:       AnchorTemplate[];   // ← fetched once
  setTemplates: (t: AnchorTemplate[]) => void;
  // NOUVELLES ACTIONS POUR LES TEMPLATES
  addTemplate: (newTemplate: AnchorTemplate) => void;
  updateTemplate: (updatedTemplate: AnchorTemplate) => void;
  deleteTemplate: (templateId: string) => void;
}

// Pas de templates initiaux, l'utilisateur doit les créer ou les importer
const initialTemplates: AnchorTemplate[] = [];

export const useVariableStore = create<VariableState>()(
  immer((set, get) => ({
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
    templates: initialTemplates, // Initialiser avec des exemples
    
    // Actions
    setVariables: (variables) => set({ variables }),
    
    setPreviewVariables: (variables) => set({ 
      previewVariables: variables,
      totalCount: variables.length
    }),
    
    appendPreview: (newVariables) => set((state) => ({
      previewVariables: [...state.previewVariables, ...newVariables],
      totalCount: state.previewVariables.length + newVariables.length,
    })),
    
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
      error: null,
      templates: initialTemplates
    }),
    
    setTemplates: (t) => set({ templates: t }),

    // NOUVELLES IMPLÉMENTATIONS POUR LES TEMPLATES
    addTemplate: (newTemplate) =>
      set((state) => {
        state.templates.push(newTemplate);
      }),
    updateTemplate: (updatedTemplate) =>
      set((state) => {
        const index = state.templates.findIndex((t) => t.id === updatedTemplate.id);
        if (index !== -1) {
          state.templates[index] = updatedTemplate;
        }
      }),
    deleteTemplate: (templateId) =>
      set((state) => {
        state.templates = state.templates.filter((t) => t.id !== templateId);
      }),
  }))
); 

/* anchor-template quick type */
export interface AnchorTemplate {
  id: string;           // e.g. "Energy-Elec-Std"
  label: string;        // "Énergie électrique (A+,R+,R-)"
  variables: {
    suffix:    string;  // "_A+"
    dataType:  'Double' | 'Boolean' | 'String' | 'Integer';
    units?:    string;
  }[];
} 