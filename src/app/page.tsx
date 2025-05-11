'use client';

import React, { useEffect, useState, ReactNode, useCallback } from 'react';
import Image from "next/image";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExcelDropzone } from "@/components/excel-dropzone";
import { useExcelStore, ExcelData } from "@/store/excelStore";
import { PreviewTable } from "@/components/preview-table";
import { MappingModal, MappingConfig } from "@/components/mapping-modal";
import { Button } from "@/components/ui/button";

import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { createApiClient } from '@/lib/apiClient';
import { useBulkAssets, ProcessedBulkResponse, MutationVariables } from '@/hooks/useBulkAssets';
import { buildAssetLevels, AssetLevel } from '@/lib/assetUtils';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronsUpDown } from 'lucide-react';
import { UseMutationResult } from '@tanstack/react-query';
import { CreateVariables } from '@/components/CreateVariables';
import { useAssetStore } from '@/store/assetStore';
import { Loader2 } from 'lucide-react';
import { useMappingStore } from '@/store/mappingStore';
import { AssetsBulk } from '@/components/AssetsBulk';
import { VariablePreview } from '@/components/VariablePreview';
import { VariableWizard } from '@/components/variable-wizard';
import { useAssetCache } from '@/store/assetCache';
import type { CachedAsset } from '@/store/assetCache';
import { useAssetIdMap } from '@/store/assetIdMap';
import { useVariableStore } from '@/store/variableStore';

interface Adapter {
  id: string;
  name: string;
  type: string;
  status?: string;
  connectionName?: string;
}

const DashboardContent: React.FC = () => {
  const { token, apiUrl, isAuthenticated, logout, isLoading: authIsLoading } = useAuth();
  const router = useRouter();
  const [adapters, setAdapters] = useState<Adapter[]>([]);
  const [adaptersError, setAdaptersError] = useState<string | null>(null);
  const [adaptersLoading, setAdaptersLoading] = useState<boolean>(true);

  useEffect(() => {
    if (authIsLoading) return;

    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    if (token && apiUrl) {
      const apiClient = createApiClient(token, apiUrl);
      setAdaptersLoading(true);
      apiClient.get('/DataService/Adapters')
        .then(response => {
          if (response.data && Array.isArray(response.data.adapters)) {
            setAdapters(response.data.adapters);
            setAdaptersError(null);
          } else {
            setAdapters([]);
            console.warn("Unexpected adapter data structure:", response.data);
            setAdaptersError("Failed to load adapters: Unexpected data structure.");
          }
        })
        .catch(err => {
          console.error("Failed to fetch adapters:", err);
          if (err.response && err.response.status === 401) {
            setAdaptersError("Authentication error fetching adapters. Please re-login.");
            logout();
            router.push('/login');
          } else {
            setAdaptersError("Failed to load adapters. Check console for details.");
          }
        })
        .finally(() => {
          setAdaptersLoading(false);
        });
    } else if (!authIsLoading && !token) {
      router.push('/login');
    }
  }, [isAuthenticated, token, apiUrl, router, authIsLoading, logout]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  if (authIsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading user session...</p>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto p-4 pt-6 md:p-6 lg:p-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Dashboard</CardTitle>
          <CardDescription>
            Welcome! You are successfully connected.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {apiUrl && (
            <div>
              <h3 className="font-semibold">API URL:</h3>
              <p className="text-sm text-gray-700 dark:text-gray-300 break-all">{apiUrl}</p>
            </div>
          )}
          {token && (
            <div>
              <h3 className="font-semibold">Auth Token (first 30 chars):</h3>
              <p className="text-sm text-gray-700 dark:text-gray-300 break-all">
                {token.substring(0, 30)}...
              </p>
            </div>
          )}
          <Button onClick={handleLogout} variant="destructive" className="w-full mt-4">
            Logout
          </Button>
        </CardContent>
      </Card>

      <Card className="max-w-2xl mx-auto mt-6">
        <CardHeader>
          <CardTitle>Adapters</CardTitle>
          <CardDescription>List of configured data adapters.</CardDescription>
        </CardHeader>
        <CardContent>
          {adaptersLoading && <p>Loading adapters...</p>}
          {adaptersError && <p className="text-red-500">Error: {adaptersError}</p>}
          {!adaptersLoading && !adaptersError && adapters.length === 0 && (
            <p>No adapters found or an issue occurred.</p>
          )}
          {!adaptersLoading && !adaptersError && adapters.length > 0 && (
            <ul className="space-y-2">
              {adapters.map((adapter) => (
                <li key={adapter.id} className="p-2 border rounded-md">
                  <p className="font-semibold">{adapter.name} ({adapter.id})</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Type: {adapter.type}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default function HomePage() {
  const { setParsedData } = useExcelStore();
  const { token, apiUrl, isAuthenticated, isLoading: authIsLoading, logout } = useAuth();
  const router = useRouter();
  const [adapters, setAdapters] = useState<Adapter[]>([]);
  const [adaptersError, setAdaptersError] = useState<string | null>(null);
  const [adaptersLoading, setAdaptersLoading] = useState<boolean>(true);
  const parsedExcelData = useExcelStore((state) => state.parsedData);
  const { mappingConfig, setMappingConfig } = useMappingStore();
  const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
  const bulkCreateMutation: UseMutationResult<ProcessedBulkResponse, Error, MutationVariables> = useBulkAssets();
  const [totalAssetsToCreate, setTotalAssetsToCreate] = useState(0);
  const [wizardOpen, setWizardOpen] = useState(false);
  const assetTree = useAssetCache((s) => s.tree);
  const setAssetTree = useAssetCache((s) => s.setTree);

  useEffect(() => {
    if (!authIsLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authIsLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated && token && apiUrl) {
      const apiClient = createApiClient(token, apiUrl);
      setAdaptersLoading(true);
      setAdaptersError(null);
      apiClient.get('/DataService/Adapters')
        .then(response => {
          if (response.data && Array.isArray(response.data.adapters)) {
            setAdapters(response.data.adapters);
          } else {
            setAdapters([]);
            console.warn("Unexpected adapter data structure:", response.data);
            setAdaptersError("Failed to load adapters: Unexpected data structure.");
          }
        })
        .catch(err => {
          console.error("Failed to fetch adapters:", err);
          if (err.response && err.response.status === 401) {
            setAdaptersError("Authentication error fetching adapters. Attempting to re-login.");
          } else {
            setAdaptersError("Failed to load adapters. Check console for details.");
          }
        })
        .finally(() => {
          setAdaptersLoading(false);
        });
    } else if (!authIsLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, token, apiUrl, router, authIsLoading]);

  const handleDataParsed = useCallback((data: ExcelData | null) => {
    setParsedData(data);
    if (data) {
      console.log("PAGE.TSX: Parsed data stored in Zustand:", data);
    } else {
      console.log("PAGE.TSX: Parsed data is null or an error occurred.");
    }
  }, [setParsedData]);

  const handleOpenMappingModal = () => {
    if (parsedExcelData) {
      setIsMappingModalOpen(true);
    }
  };

  const handleCloseMappingModal = () => {
    setIsMappingModalOpen(false);
  };

  const handleSubmitMapping = (config: MappingConfig) => {
    console.log("PAGE.TSX: Submitted mapping config:", config);
    setMappingConfig(config);
    setIsMappingModalOpen(false);
    setWizardOpen(true);
  };

  const handlePushAssets = () => {
    if (!parsedExcelData || !mappingConfig) {
      toast.error("Missing Excel data or mapping configuration.");
      return;
    }

    const assetLevels: AssetLevel[] = buildAssetLevels(parsedExcelData, mappingConfig);
    
    let calculatedTotalAssets = 0;
    assetLevels.forEach(level => calculatedTotalAssets += level.nodes.length);

    if (calculatedTotalAssets === 0) {
      toast.info("No Assets to Create: The current data and mapping did not result in any assets to create.");
      return;
    }
    setTotalAssetsToCreate(calculatedTotalAssets);
    bulkCreateMutation.reset();

    toast.message("Bulk Creation Started", {
      description: `Attempting to create ${calculatedTotalAssets} assets across ${assetLevels.length} levels...`,
    });

    bulkCreateMutation.mutate(
      { levels: assetLevels },
      {
        onSuccess: (response) => {
          handleBulkCreateSuccess(response);
          
          toast.success(`Created ${response.successes.length} assets successfully.`, {
            description: `${response.failures.length} failures. Check console for details.`,
          });
        },
        onError: (error) => {
          toast.error("Bulk Creation Failed", {
            description: error.message || "An unexpected error occurred during bulk asset creation.",
          });
        },
      }
    );
  };
  
  const { status: bulkCreateStatus, data: bulkCreateData, error: bulkCreateError } = bulkCreateMutation;

  const successesCount = bulkCreateData?.successes?.length || 0;
  const failuresCount = bulkCreateData?.failures?.length || 0;
  const processedCount = successesCount + failuresCount;
  const progressValue = totalAssetsToCreate > 0 ? (processedCount / totalAssetsToCreate) * 100 : 0;

  // After successful asset creation, update assetStore
  const handleBulkCreateSuccess = (response: ProcessedBulkResponse) => {
    // Inform user
    toast.success(`Created ${response.successes.length} assets successfully.`, {
      description: `${response.failures.length} failures. Check console for details.`,
    });
    // Mapping externalId/fullPath -> assetId pour flux A
    const { setIdMap } = useAssetIdMap.getState();
    const idMap: Record<string, string> = {};
    response.successes.forEach(success => {
      if (success.externalId && success.assetId) {
        idMap[success.externalId] = success.assetId;
      }
    });
    setIdMap(idMap);
    // Update asset store with created assets and mark as created
    const assets = response.successes.map(success => ({
      id: success.externalId || '',
      name: success.name,
      parentId: success.parentId !== '0' ? success.parentId : undefined,
      anchorId: success.assetId
    }));
    
    // Construction de l'anchorMap complet pour le flux A
    const anchorMap: Record<string, string> = {};
    
    // D'abord, construire un mappage des assetIds vers leurs chemins complets
    const assetIdToPath: Record<string, string> = {};
    const assetIdToParentId: Record<string, string> = {};
    
    // Étape 1: Collecter les relations parent-enfant et noms
    response.successes.forEach(success => {
      if (success.assetId) {
        assetIdToParentId[success.assetId] = success.parentId || '0';
      }
    });
    
    // Étape 2: Construire les chemins complets
    response.successes.forEach(success => {
      if (success.assetId) {
        // Stocker la correspondance externalId → assetId si disponible
        if (success.externalId) {
          anchorMap[success.externalId] = success.assetId;
        }
        
        // Essayer de construire le chemin complet
        try {
          // Commencer par le nom de l'asset
          let pathParts = [success.name];
          let currentId = success.parentId;
          
          // Remonter l'arborescence pour construire le chemin
          while (currentId && currentId !== '0') {
            const parentAsset = response.successes.find(a => a.assetId === currentId);
            if (parentAsset) {
              pathParts.unshift(parentAsset.name);
              currentId = parentAsset.parentId;
            } else {
              break; // Parent non trouvé, arrêter la remontée
            }
          }
          
          // Assembler le chemin avec des @ comme séparateurs
          const fullPath = pathParts.join('@');
          
          // Ajouter la correspondance path → assetId
          anchorMap[fullPath] = success.assetId;
        } catch (error) {
          console.warn('Erreur lors de la construction du chemin pour', success.name, error);
        }
      }
    });
    
    const { setAssets, setAnchorMap, setAssetsCreated } = useAssetStore.getState();
    setAssets(assets);
    setAnchorMap(anchorMap);
    setAssetsCreated(true);
    
    console.log('AnchorMap créé avec', Object.keys(anchorMap).length, 'entrées');
    console.log('Exemples de clés dans anchorMap:', Object.keys(anchorMap).slice(0, 5));
  };

  // Retrieve assets from IIH (flux B)
  async function retrieveAssets() {
    if (!token || !apiUrl) return;
    const api = createApiClient(token, apiUrl);
    try {
      // Correction : nouvelle route pour l'arbre d'assets
      const res = await api.get('/AssetService/Assets/Tree');
      const flat: CachedAsset[] = [];
      // Créer un anchorMap pour le flux B
      const newAnchorMap: Record<string, string> = {};
      
      const walk = (n: any, p: string[] = [], lvl: number = 0) => {
        const path = [...p, n.name];
        const fullPath = path.join('@');
        
        // Ajouter au tableau plat pour assetCache
        flat.push({ assetId: n.assetId, path: fullPath, level: lvl, name: n.name });
        
        // Ajouter au anchorMap la correspondance path → assetId
        if (n.assetId) {
          newAnchorMap[fullPath] = n.assetId;
        }
        
        (n.children || []).forEach((c: any) => walk(c, path, lvl + 1));
      };
      
      walk(res.data); // racine unique
      
      // Mettre à jour les stores
      setAssetTree(flat);
      
      // Mettre à jour l'anchorMap dans le store des assets
      const { setAnchorMap } = useAssetStore.getState();
      setAnchorMap(newAnchorMap);
      
      console.log('AnchorMap créé avec', Object.keys(newAnchorMap).length, 'entrées');
      console.log('Exemple de chemins:', Object.keys(newAnchorMap).slice(0, 3));
      
      toast.success(`Loaded ${flat.length} assets from IIH.`);
    } catch (err) {
      toast.error('Failed to load assets.');
      console.error(err);
    }
  }

  // Handler pour bulk send (à relier à l'API plus tard)
  const handleBulkSend = async () => {
    // Récupérer les variables du store
    const { previewVariables } = useVariableStore.getState();
    
    // Récupérer la table de correspondance entre externalId et assetId
    const { anchorMap } = useAssetStore.getState();
    
    console.log('[handleBulkSend] anchorMap size =', Object.keys(anchorMap).length);
    if (Object.keys(anchorMap).length > 0) {
      console.log('[handleBulkSend] quelques exemples de clés:', Object.keys(anchorMap).slice(0, 5));
      console.log('[handleBulkSend] quelques exemples de valeurs:', Object.entries(anchorMap).slice(0, 5));
    }
    
    // Afficher des informations de débogage pour identifier les problèmes de correspondance
    if (previewVariables.length > 0) {
      console.log('[DEBUG] Premiers assetPath des variables:', 
                  previewVariables.slice(0, 3).map(v => v.assetPath));
                  
      console.log('[DEBUG] premieres cles anchorMap :',
              Object.keys(anchorMap).slice(0, 20));

      // Tentons de chercher directement les assetPath dans l'anchorMap
      console.log('[DEBUG] recherche directe pour les premiers assetPath:',
              previewVariables.slice(0, 3).map(v => 
                v.assetPath ? [v.assetPath, anchorMap[v.assetPath]] : null));
              
      // Cherchons des suffixes qui pourraient correspondre
      const pathsToTest = previewVariables.slice(0, 3)
                         .map(v => v.assetPath)
                         .filter(Boolean);
                         
      for (const path of pathsToTest) {
        if (!path) continue;
        console.log('[DEBUG] match suffixe pour', path, 
          Object.entries(anchorMap)
                .find(([k]) => k.endsWith(path) || 
                              path.endsWith(k) || 
                              k.endsWith('@' + path)));
      }
    }
    
    // Fonction pour résoudre les UUID avec plusieurs stratégies de correspondance
    const resolveOwnerUuid = (assetPath: string): string => {
      if (!assetPath) return '';
      
      // Normalisation pour rendre les comparaisons plus robustes
      const normalize = (s: string) => s.trim().toUpperCase();
      const normPath = normalize(assetPath);
      
      // 1. Tentative de correspondance exacte
      let uuid = anchorMap[assetPath];
      if (uuid) return uuid;

      // 2. Ignorer la casse
      const caseMatch = Object.entries(anchorMap)
             .find(([k]) => normalize(k) === normPath);
      if (caseMatch) return caseMatch[1];

      // 3. Correspondance de suffixe (si le chemin est un sous-chemin)
      const suffixMatch = Object.entries(anchorMap)
             .find(([k]) => normalize(k).endsWith('@' + normPath));
      if (suffixMatch) return suffixMatch[1];
      
      // 4. Correspondance de préfixe (si le chemin est un sur-chemin)
      const prefixMatch = Object.entries(anchorMap)
             .find(([k]) => normPath.endsWith('@' + normalize(k)));
      if (prefixMatch) return prefixMatch[1];
      
      // 5. Recherche partielle (ignorer le noeud racine)
      const pathSegments = assetPath.split('@');
      if (pathSegments.length > 1) {
        const partialPath = pathSegments.slice(1).join('@'); // Ignorer le premier segment
        const partialMatch = Object.entries(anchorMap)
               .find(([k]) => normalize(k) === normalize(partialPath) || 
                            normalize(k).endsWith('@' + normalize(partialPath)));
        if (partialMatch) return partialMatch[1];
      }

      // 6. Rien trouvé
      return '';
    };
    
    // VÉRIFICATION CRITIQUE: S'assurer que l'anchorMap n'est pas vide
    if (Object.keys(anchorMap).length === 0) {
      toast.error('Aucun asset disponible pour associer les variables', {
        description: 'Veuillez d\'abord créer des assets ou charger des assets existants avant d\'envoyer les variables.',
        action: {
          label: 'Comment faire ?',
          onClick: () => toast.info('Retournez à l\'onglet Assets et cliquez sur "Create Assets" ou "Retrieve assets from IIH"')
        }
      });
      return;
    }
    
    if (!previewVariables || previewVariables.length === 0) {
      toast.error('Aucune variable à envoyer. Veuillez d\'abord créer des variables.');
      return;
    }
    
    // Vérifier que nous avons un token et une URL d'API
    if (!token || !apiUrl) {
      toast.error('Session d\'authentification invalide. Veuillez vous reconnecter.');
      return;
    }
    
    // Créer le client API
    const apiClient = createApiClient(token, apiUrl);
    
    // Fonction pour convertir les types de données au format attendu par l'API
    const convertDataType = (dataType: string): string => {
      const mapping: Record<string, string> = {
        'Double': 'float64',
        'Integer': 'int32',
        'Boolean': 'bool',
        'String': 'string'
      };
      return mapping[dataType] || 'float64'; // Par défaut float64 si inconnu
    };
    
    // Fonction pour formater les unités selon le format IIH
    const formatUnit = (unit?: string): string | undefined => {
      if (!unit) return undefined;
      
      // Table de correspondance simple pour quelques unités courantes
      const unitMapping: Record<string, string> = {
        '°C': '10-CEL',
        'C': '10-CEL',
        'F': '10-FAH',
        'K': '10-KEL',
        'bar': '9-BAR',
        'Pa': '9-PAS',
        'kPa': '9-KPA',
        'W': '7-WTT',
        'kW': '7-KWT',
        'MW': '7-MWT',
        'm3': '4-MTQ',
        'L': '4-LTR',
        'kg': '3-KGM',
        'g': '3-GRM',
        'A': '5-AMP',
        'mA': '5-MAM',
        'V': '5-VLT',
        'mV': '5-MVL',
        '%': '1-P1'
      };
      
      return unitMapping[unit] || '0-' + unit; // Format générique si unité non reconnue
    };
    
    // Extraire l'UUID de l'assetId (supprimer "anchor.asset@" s'il existe)
    const extractUuid = (assetId?: string): string => {
      if (!assetId) return '';
      // Si l'assetId est déjà au format UUID
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(assetId)) {
        return assetId;
      }
      // Si l'assetId est au format anchor.asset@UUID
      const match = assetId.match(/anchor\.asset@([0-9a-f-]+)/i);
      if (match && match[1]) {
        return match[1];
      }
      return assetId; // Retourner tel quel si format non reconnu
    };
    
    // Transformer les variables en format compatible avec l'API Anchor-ex Bulk
    const bulkRequestData = previewVariables.map((variable, index) => {
      // Nettoyer le nom (pas d'espaces ni caractères spéciaux)
      const cleanName = variable.name.replace(/[^a-zA-Z0-9_-]/g, '_');
      
      // S'assurer que le nom commence par une lettre ou un underscore
      const validName = /^[a-zA-Z_]/.test(cleanName) ? cleanName : `var_${cleanName}`;
      
      // Récupérer l'UUID de l'asset via plusieurs méthodes
      // Utiliser la fonction resolveOwnerUuid pour trouver le meilleur match
      const ownerUuid = resolveOwnerUuid(variable.assetPath) || 
                        (variable.assetId ? extractUuid(variable.assetId) : '');
      
      // Vérifier que l'UUID n'est pas vide
      if (!ownerUuid) {
        console.warn(`Variable ${variable.name} n'a pas d'assetId valide:`, {
          assetPath: variable.assetPath,
          assetId: variable.assetId,
          anchorMapKeys: Object.keys(anchorMap).length > 0 ? Object.keys(anchorMap).slice(0, 5) : 'empty'
        });
      }
      
      return {
        "$concept": "attribute", // Propriété obligatoire pour identifier le type d'objet
        "$abstraction": "instance", // Propriété obligatoire pour préciser que c'est une instance concrète
        "$_bulkId": `var_${index + 1}`,
        "$_owner": ownerUuid,
        "$name": validName,
        "$datatype": convertDataType(variable.dataType),
        "$unit": formatUnit(variable.units)
      };
    });
    
    // Afficher un aperçu des 5 premiers éléments pour débogage
    console.log("AnchorMap:", Object.keys(anchorMap).length, "entrées");
    console.table(bulkRequestData.slice(0, 5));
    
    // Filtrer les variables avec un UUID vide
    const validBulkRequestData = bulkRequestData.filter(item => item.$_owner);
    
    if (validBulkRequestData.length === 0) {
      toast.error('Aucune variable valide à envoyer. Vérifiez que vos variables sont bien associées à des assets.');
      return;
    }
    
    if (validBulkRequestData.length < bulkRequestData.length) {
      toast.warning(`${bulkRequestData.length - validBulkRequestData.length} variables ont été ignorées car elles n'ont pas d'asset associé.`);
    }
    
    // Afficher un toast de chargement
    toast.loading('Envoi des variables en cours...', {
      id: 'bulk-send-variables'
    });
    
    try {
      // Envoyer la requête au bon endpoint avec atomic=true pour validation complète
      const response = await apiClient.post('/DataService/anchor-ex/v1/bulk?atomic=true', {
        data: validBulkRequestData
      });
      
      // Vérifier la réponse
      if (response.data && response.data.data) {
        // Succès
        const successCount = response.data.data.length;
        const errorCount = response.data.errors ? response.data.errors.length : 0;
        
        if (errorCount > 0) {
          // Certaines variables ont échoué
          toast.error(`Certaines variables n'ont pas pu être importées (${errorCount} erreurs)`, {
            id: 'bulk-send-variables',
            description: 'Consultez la console pour plus de détails.'
          });
          console.error('Erreurs lors de l\'import de variables:', response.data.errors);
        } else {
          // Toutes les variables ont été importées avec succès
          toast.success(`${successCount} variables importées avec succès dans l'IIH`, {
            id: 'bulk-send-variables',
            duration: 5000
          });
        }
      } else {
        // Quelque chose s'est mal passé
        toast.error('Erreur lors de l\'import des variables', {
          id: 'bulk-send-variables',
          description: 'La réponse du serveur est invalide.'
        });
      }
    } catch (error) {
      // Afficher les détails complets de l'erreur pour diagnostic
      console.error('Erreur lors de l\'envoi des variables:', error);
      
      // Extraire et afficher les détails de la réponse pour diagnostic
      const err = error as any; // Type assertion pour accéder aux propriétés
      if (err.response) {
        console.error(
          "IIH →", err.response.status,
          JSON.stringify(err.response.data, null, 2)
        );
        
        // Également afficher la première variable envoyée pour référence
        if (validBulkRequestData.length > 0) {
          console.log("Premier élément envoyé:", JSON.stringify(validBulkRequestData[0], null, 2));
        }
      }
      
      toast.error('Erreur lors de l\'envoi des variables', {
        id: 'bulk-send-variables',
        description: error instanceof Error ? error.message : 'Une erreur inattendue s\'est produite.'
      });
    }
  };

  if (authIsLoading) {
    return (
        <div className="flex items-center justify-center min-h-screen">
            <p>Loading application...</p>
        </div>
    );
  }

  if (!isAuthenticated) {
    return null; 
  }

  return (
    <main className="container mx-auto py-8 px-4 md:px-6 lg:px-8">
      <header>
        <h1 className="text-xl font-bold mb-2">Energy Assets & Variables</h1>
        <p className="text-muted-foreground">Import excel data, map assets, and create energy variables</p>
      </header>

      <Tabs defaultValue="assets" className="mt-6">
        <TabsList>
          <TabsTrigger value="assets">Assets</TabsTrigger>
          <TabsTrigger value="variables" id="variable-preview-tab">Variables</TabsTrigger>
        </TabsList>
        
        <TabsContent value="assets" className="space-y-4">
          {/* Existing Asset Tab Content */}
          <ExcelDropzone onDataParsed={handleDataParsed} />
          
          {parsedExcelData && (
            <>
              <div className="mt-4 flex flex-wrap gap-2 justify-between items-center">
                <h2 className="text-lg font-semibold">Excel Data Preview</h2>
                <div className="flex gap-2">
                  <Button onClick={handleOpenMappingModal} variant="outline">
                    Configure Mapping
                  </Button>
                  <Button 
                    onClick={handlePushAssets} 
                    disabled={!mappingConfig || bulkCreateMutation.isPending}
                  >
                    {bulkCreateMutation.isPending ? 'Creating...' : 'Create Assets'}
                  </Button>
                </div>
              </div>
              <PreviewTable data={parsedExcelData} />

              {parsedExcelData && mappingConfig && (
                <div className="mt-6 space-y-4 border-t pt-6">
                  <h2 className="text-lg font-semibold">Define Variable Sets (Assets Tab View)</h2>
                  <Button variant="outline" onClick={() => setWizardOpen(true)}>
                    Open Variable Set Wizard
                  </Button>
                  <VariablePreview />
                </div>
              )}
            </>
          )}
          
          {bulkCreateMutation.isPending && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Creating Assets</CardTitle>
                <CardDescription>
                  Processing {totalAssetsToCreate} assets...
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Progress 
                  value={
                    ((bulkCreateMutation.data as ProcessedBulkResponse | undefined)?.successes.length || 0) / 
                    (totalAssetsToCreate || 1) * 100
                  } 
                  className="h-2"
                />
                <p className="text-sm text-muted-foreground mt-2">
                  Created {(bulkCreateMutation.data as ProcessedBulkResponse | undefined)?.successes.length || 0} of {totalAssetsToCreate}
                </p>
              </CardContent>
            </Card>
          )}
          
          {bulkCreateMutation.data && (
            <Collapsible className="mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle>Asset Creation Results</CardTitle>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <ChevronsUpDown className="h-4 w-4" />
                        <span className="sr-only">Toggle</span>
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                  <CardDescription>
                    Created {(bulkCreateMutation.data as ProcessedBulkResponse).successes.length} assets 
                    ({(bulkCreateMutation.data as ProcessedBulkResponse).failures.length} failures)
                  </CardDescription>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent>
                    <div className="space-y-2">
                      {bulkCreateMutation.data.failures.length > 0 && (
                        <div>
                          <h3 className="font-semibold text-destructive">Failures:</h3>
                          <ul className="list-disc pl-5 text-sm">
                            {(bulkCreateMutation.data as ProcessedBulkResponse).failures.slice(0, 5).map((failure, index) => (
                              <li key={index} className="text-destructive">
                                {failure.assetName || 'Unknown'}: {failure.message || 'Unknown error'}
                              </li>
                            ))}
                            {(bulkCreateMutation.data as ProcessedBulkResponse).failures.length > 5 && (
                              <li>...and {(bulkCreateMutation.data as ProcessedBulkResponse).failures.length - 5} more</li>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}
        </TabsContent>
        
        <TabsContent value="variables" className="space-y-4">
          {((parsedExcelData && mappingConfig) || assetTree.length > 0) ? (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Define & Preview Variable Sets</h2>
              <p className="text-sm text-muted-foreground">
                Use the wizard to generate variable sets based on anchor templates and your asset hierarchy. 
                The preview below will update as you add sets.
              </p>
              <Button
                variant="secondary"
                onClick={() => setWizardOpen(true)}
              >
                Add/Modify Variable Sets (Wizard)
              </Button>
              <VariablePreview />
              <Button
                className="w-full mt-6 h-14 text-lg"
                variant="default"
                onClick={handleBulkSend}
              >
                Valider et envoyer dans l&apos;IIH
              </Button>
            </div>
          ) : (
            <div className="p-4 space-y-4 text-center">
              <p className="text-muted-foreground">
                Aucune hiérarchie détectée.&nbsp;
                <br/>Importe un Excel <b>ou</b> récupère les assets existants.
              </p>
              <Button onClick={retrieveAssets}>
                Retrieve assets from IIH
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <MappingModal
        isOpen={isMappingModalOpen}
        onClose={handleCloseMappingModal}
        onSubmit={handleSubmitMapping}
        existingConfig={mappingConfig}
        excelData={parsedExcelData}
      />

      {/* Affiche le wizard si on a soit Excel+mapping (flux A), soit assetTree (flux B) */}
      {((parsedExcelData && mappingConfig) || assetTree.length > 0) && (
        <VariableWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
      )}
    </main>
  );
}
