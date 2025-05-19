import { create } from 'zustand';

// Types pour les agrégations
export type AggregationMethod = 'avg' | 'sum' | 'min' | 'max' | 'count' | 'first' | 'last';
export type AggregationTimeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '12h' | '1d' | '1w' | '1mo';

export interface Aggregation {
  id?: string;           // L'ID généré par IIH après création
  name: string;          // Nom de l'agrégation
  sourceVariableId: string; // ID de la variable source
  sourceVariableName?: string; // Nom de la variable (pour l'affichage)
  method: AggregationMethod; // Méthode d'agrégation
  timeframe: AggregationTimeframe; // Période d'agrégation
  description?: string;  // Description optionnelle
  enabled: boolean;      // Actif/inactif
  status?: 'pending' | 'active' | 'error'; // Statut dans IIH
  errorMessage?: string; // Message d'erreur le cas échéant
  createdAt?: string;    // Date de création
  lastUpdatedAt?: string; // Date de dernière mise à jour
}

interface AggregationState {
  aggregations: Aggregation[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setAggregations: (aggregations: Aggregation[]) => void;
  addAggregation: (aggregation: Aggregation) => void;
  updateAggregation: (id: string, updates: Partial<Aggregation>) => void;
  removeAggregation: (id: string) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useAggregationStore = create<AggregationState>((set) => ({
  aggregations: [],
  isLoading: false,
  error: null,
  
  // Setter pour l'ensemble des agrégations
  setAggregations: (aggregations) => set({ aggregations }),
  
  // Ajouter une nouvelle agrégation
  addAggregation: (aggregation) => set((state) => ({
    aggregations: [...state.aggregations, aggregation]
  })),
  
  // Mettre à jour une agrégation existante
  updateAggregation: (id, updates) => set((state) => ({
    aggregations: state.aggregations.map((aggr) => 
      aggr.id === id ? { ...aggr, ...updates } : aggr
    )
  })),
  
  // Supprimer une agrégation
  removeAggregation: (id) => set((state) => ({
    aggregations: state.aggregations.filter((aggr) => aggr.id !== id)
  })),
  
  // Définir l'état de chargement
  setLoading: (isLoading) => set({ isLoading }),
  
  // Définir un message d'erreur
  setError: (error) => set({ error })
})); 