import { useEffect } from 'react';
import { useVariableStore, Variable } from '@/store/variableStore';
import { createApiClient } from '@/lib/apiClient';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useAssetStore } from '@/store/assetStore';

interface FetchVariablesOptions {
  enrichWithAssetPaths?: boolean;
  showToasts?: boolean;
}

export function useFetchVariables(
  filterIds?: string[], 
  filterType: 'assetIds' | 'aspectIds' | 'adapterIds' | 'variableIds' = 'assetIds',
  options: FetchVariablesOptions = { enrichWithAssetPaths: true, showToasts: true }
) {
  const { token, apiUrl } = useAuth();
  const { setPreviewVariables, previewVariables } = useVariableStore();
  const { anchorMap } = useAssetStore();
  
  const isLoading = useVariableStore(s => s.isLoading);
  const setLoading = useVariableStore(s => s.setLoading || ((loading: boolean) => {}));
  const setError = useVariableStore(s => s.setError || ((error: string | null) => {}));

  useEffect(() => {
    if (!token || !apiUrl) return;
    
    // Si le store a déjà une méthode setLoading, l'utiliser
    if (setLoading) setLoading(true);
    if (setError) setError(null);
    
    const api = createApiClient(token, apiUrl);
    const params = filterIds && filterIds.length > 0 
      ? { [filterType]: JSON.stringify(filterIds) }
      : undefined;
    
    if (options.showToasts) {
      toast.loading("Récupération des variables...", { id: "fetch-variables" });
    }
    
    api.get('/DataService/Variables', { params })
      .then(res => {
        if (res.data && Array.isArray(res.data.variables)) {
          // Mapper au format attendu par le store
          const variables = res.data.variables.map((v: any) => ({
            id:           v.id || "",
            name:         v.name || "",
            topic:        v.topic || "",
            dataType:     v.dataType || "Double",
            units:        v.unit,
            assetId:      v.assetId || "",
            assetPath:    "", // Sera enrichi plus tard si nécessaire
            level:        0,  // Sera enrichi plus tard si nécessaire
            adapterId:    v.adapterId || ""
          }));
          
          let enrichedVariables = variables;
          
          // Enrichir avec les chemins d'assets si demandé et si anchorMap disponible
          if (options.enrichWithAssetPaths && Object.keys(anchorMap).length > 0) {
            enrichedVariables = variables.map((v: Variable) => {
              if (v.assetId) {
                // Chercher le chemin de l'asset correspondant
                const assetPath = Object.entries(anchorMap)
                  .find(([_, id]) => id === v.assetId)?.[0] || "";
                
                // Déterminer le niveau basé sur le nombre de séparateurs
                const level = assetPath ? assetPath.split('@').length - 1 : 0;
                
                return { ...v, assetPath, level };
              }
              return v;
            });
          }
          
          // Fusionner avec les variables existantes en dédupliquant par nom
          // seulement si nous ne remplaçons pas tout le store
          if (previewVariables.length > 0 && !filterIds) {
            const existingNames = new Set(previewVariables.map((v: Variable) => v.name));
            const newVariables = enrichedVariables.filter((v: Variable) => !existingNames.has(v.name));
            setPreviewVariables([...previewVariables, ...newVariables]);
            
            if (options.showToasts) {
              toast.success(
                `${enrichedVariables.length} variables récupérées`, 
                { 
                  id: "fetch-variables",
                  description: `${newVariables.length} nouvelles variables ajoutées`
                }
              );
            }
          } else {
            // Remplacer le store complet
            setPreviewVariables(enrichedVariables);
            
            if (options.showToasts) {
              toast.success(
                `${enrichedVariables.length} variables récupérées`, 
                { id: "fetch-variables" }
              );
            }
          }
          
          console.log(`[useFetchVariables] Récupéré ${enrichedVariables.length} variables`);
        } else {
          console.warn("[useFetchVariables] Format de réponse inattendu:", res.data);
          if (options.showToasts) {
            toast.error('Format de réponse inattendu', { id: "fetch-variables" });
          }
          if (setError) setError('Format de réponse inattendu');
        }
      })
      .catch(err => {
        console.error('[useFetchVariables] Erreur:', err);
        if (options.showToasts) {
          toast.error(
            'Échec de récupération des variables', 
            { 
              id: "fetch-variables",
              description: err.message || "Erreur inconnue"
            }
          );
        }
        if (setError) setError(err.message || "Erreur de récupération des variables");
      })
      .finally(() => {
        if (setLoading) setLoading(false);
      });
  }, [token, apiUrl, filterIds?.join(','), filterType, options.enrichWithAssetPaths]);
  
  return {
    isLoading,
    variables: previewVariables
  };
} 