'use client';
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from "@/components/ui/label";
import { useVariableStore, AnchorTemplate, Variable } from '@/store/variableStore';
import { ExcelData }          from '@/store/excelStore';
import { MappingConfig }      from '@/components/mapping-modal';
import { buildAssetLevels, AssetNode } from '@/lib/assetUtils';
import { useExcelStore }      from '@/store/excelStore';
import { useMappingStore }    from '@/store/mappingStore';
import { Settings, Info } from 'lucide-react';
import { TemplateManagerModal } from './TemplateManagerModal';
import { useAssetCache } from '@/store/assetCache';
import { useAssetIdMap } from '@/store/assetIdMap';
import { toast } from 'sonner';
import { z } from 'zod';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog as UIDialog, DialogContent as UIDialogContent, DialogHeader as UIDialogHeader, DialogTitle as UIDialogTitle, DialogFooter as UIDialogFooter } from '@/components/ui/dialog';
import { VariablePreview } from '@/components/VariablePreview';
import { useShallow } from 'zustand/react/shallow';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EnergyExcelWizard } from './energy-excel-wizard';

// Define types for Adapters and ConnectionNames
interface Adapter {
  id: string;
  name: string; // Assuming the API returns at least id and a display name
}

// Assuming the browse endpoint returns a list of strings or objects with a name
// For simplicity, let's assume it's an array of strings for now.
// The API doc says: GET /DataService/Adapters/{id}/browse
// Let's refine this if we know the exact structure. For now, string[] is a placeholder.
// The user document mentions "connectionName", implying it's a string.

// Helper pour détecter la colonne énergie
function findEnergyColumn(headers: string[]): string | undefined {
  const candidates = ['Type', 'EnergyType', 'Energie', 'Énergie'];
  return headers.find(h => candidates.includes(h.trim()));
}

// Helper pour trouver la colonne du niveau le plus bas
function findLowestLevelColumn(mappingConfig: any): { key: string, level: number } | undefined {
  let maxLevel = -1;
  let key = '';
  for (const [colKey, map] of Object.entries(mappingConfig.columnMappings)) {
    const m = map as any;
    if (m.type === 'level' && typeof m.level === 'number' && m.level > maxLevel) {
      maxLevel = m.level;
      key = colKey;
    }
  }
  if (maxLevel >= 0) return { key, level: maxLevel };
  else return undefined;
}

export function VariableWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { appendPreview, previewVariables, setPreviewVariables } = useVariableStore();
  const { parsedExcelData }  = useExcelStore();
  const { mappingConfig }    = useMappingStore();
  const assetCache = useAssetCache((s) => s.tree);

  // Energy types
  const energyTypes = ['Elec', 'Gaz', 'Eau', 'Air'];
  const [enableEnergyFeatures, setEnableEnergyFeatures] = useState(false);
  const [energyRelations, setEnergyRelations] = useState<{[assetPath: string]: string}>({});
  const [parentChildMap, setParentChildMap] = useState<{[parentPath: string]: string[]}>({});
  const [manualEnergyConfig, setManualEnergyConfig] = useState<{[assetPath: string]: string}>({});
  const [configureEnergyOpen, setConfigureEnergyOpen] = useState(false);
  const [excelEnergyColumn, setExcelEnergyColumn] = useState<string | null>(null);
  const [autoDetectEnergyColumn, setAutoDetectEnergyColumn] = useState(true);
  const [energyConfigMode, setEnergyConfigMode] = useState<'manual' | 'auto'>('auto');
  const [showEnergyExcelWizard, setShowEnergyExcelWizard] = useState(false);
  const [energyMappingConfig, setEnergyMappingConfig] = useState<MappingConfig | null>(null);
  const [energyExcelData, setEnergyExcelData] = useState<ExcelData | null>(null);

  // Levels à proposer (Excel ou assetCache)
  const levels = parsedExcelData && mappingConfig
    ? (() => {
        const assetLevels = buildAssetLevels(parsedExcelData, mappingConfig);
        return assetLevels.map(l => ({ level: l.level, label: `Level ${l.level}`, nodes: l.nodes }));
      })()
    : (() => {
        // On filtre les assets dont assetId === "0" (edge)
        const filteredAssets = assetCache.filter(a => a.assetId !== "0");
        if (filteredAssets.length === 0) return [];
        
        // Trouver le niveau minimum après filtrage
        const minLevel = Math.min(...filteredAssets.map(a => a.level));
        
        // Décalage des levels pour commencer à 0 (après avoir filtré edge)
        return Array.from(new Set(filteredAssets.map(a => a.level - minLevel)))
          .sort((a, b) => a - b)
          .map(lvl => ({ 
            level: lvl, 
            label: `Level ${lvl}`,
            // Récupérer les assets correspondant à ce niveau après décalage
            nodes: filteredAssets.filter(a => a.level - minLevel === lvl)
          }));
      })();

  // State par level
  const [levelConfigs, setLevelConfigs] = useState<{ [level: number]: {
    adapterId?: string;
    connectionName?: string;
    tagNames: string[];
    availableConnectionNames: string[];
    availableTagNames: string[];
    isLoadingTags: boolean;
    isLoadingConn: boolean;
  } }>({});

  // Reset state à l'ouverture
  useEffect(() => {
    if (open) setLevelConfigs({});
  }, [open]);

  // Fetch adapters (une seule fois)
  const [adaptersList, setAdaptersList] = useState<Adapter[]>([]);
  const [isLoadingAdapters, setIsLoadingAdapters] = useState(false);
  useEffect(() => {
    if (open) {
      setIsLoadingAdapters(true);
      fetch('/api-proxy/DataService/Adapters')
        .then(r => r.json())
        .then(data => setAdaptersList(data.adapters || []))
        .catch(() => setAdaptersList([]))
        .finally(() => setIsLoadingAdapters(false));
    }
  }, [open]);

  // Adapter global (plus par level)
  const [globalAdapterId, setGlobalAdapterId] = useState<string | undefined>(undefined);
  const [globalConnectionNames, setGlobalConnectionNames] = useState<string[]>([]);
  const [isLoadingGlobalConn, setIsLoadingGlobalConn] = useState(false);

  // Quand on change d'adapter global, on fetch les connectionNames
  useEffect(() => {
    // Capture la valeur courante de levels pour éviter la boucle infinie
    const currentLevels = levels;
    if (globalAdapterId) {
      setIsLoadingGlobalConn(true);
      fetch(`/api-proxy/DataService/Adapters/${globalAdapterId}/browse`)
        .then(r => r.json())
        .then(data => {
          const tags = data.tags || [];
          const uniqueConnNames: string[] = Array.from(new Set(tags.map((t: any) => t.connectionName).filter((v: any): v is string => typeof v === 'string')));
          setGlobalConnectionNames(uniqueConnNames);

          // Récupérer tous les tags uniques
          const uniqueTagNames: string[] = Array.from(new Set(tags.map((t: any) => t.tagName).filter((v: any): v is string => typeof v === 'string')));

          // Mettre à jour levelConfigs pour chaque level
          setLevelConfigs(cfgs => {
            const newCfgs = { ...cfgs };
            currentLevels.forEach(lvl => {
              newCfgs[lvl.level] = {
                ...newCfgs[lvl.level],
                availableTagNames: uniqueTagNames,
                tagNames: [], // reset sélection
                isLoadingTags: false,
                isLoadingConn: false,
                availableConnectionNames: uniqueConnNames,
              };
            });
            return newCfgs;
          });
        })
        .catch(() => {
          setGlobalConnectionNames([]);
          setLevelConfigs(cfgs => {
            const newCfgs = { ...cfgs };
            currentLevels.forEach(lvl => {
              newCfgs[lvl.level] = {
                ...newCfgs[lvl.level],
                availableTagNames: [],
                tagNames: [],
                isLoadingTags: false,
                isLoadingConn: false,
                availableConnectionNames: [],
              };
            });
            return newCfgs;
          });
        })
        .finally(() => {
          setIsLoadingGlobalConn(false);
        });
    } else {
      setGlobalConnectionNames([]);
      setLevelConfigs(cfgs => {
        const newCfgs = { ...cfgs };
        currentLevels.forEach(lvl => {
          newCfgs[lvl.level] = {
            ...newCfgs[lvl.level],
            availableTagNames: [],
            tagNames: [],
            isLoadingTags: false,
            isLoadingConn: false,
            availableConnectionNames: [],
          };
        });
        return newCfgs;
      });
    }
  }, [globalAdapterId]);

  // Handler pour choisir un adapter sur un level
  const handleAdapterChange = (level: number, adapterId: string) => {
    setLevelConfigs(cfgs => ({
      ...cfgs,
      [level]: {
        ...cfgs[level],
        adapterId,
        isLoadingConn: true,
        availableConnectionNames: [],
        connectionName: undefined,
        availableTagNames: [],
        tagNames: [],
        isLoadingTags: false,
      }
    }));
    // Fetch connectionNames et tags
    fetch(`/api-proxy/DataService/Adapters/${adapterId}/browse`)
      .then(r => r.json())
      .then(data => {
        const tags = data.tags || [];
        const uniqueConnNames: string[] = Array.from(new Set(tags.map((t: any) => t.connectionName).filter((v: any): v is string => typeof v === 'string')));
        const uniqueTagNames: string[] = Array.from(new Set(tags.map((t: any) => t.tagName).filter((v: any): v is string => typeof v === 'string')));
        setLevelConfigs(cfgs => ({
          ...cfgs,
          [level]: {
            ...cfgs[level],
            availableConnectionNames: uniqueConnNames,
            isLoadingConn: false,
            availableTagNames: uniqueTagNames,
            isLoadingTags: false,
          }
        }));
      })
      .catch(() => setLevelConfigs(cfgs => ({
        ...cfgs,
        [level]: {
          ...cfgs[level],
          availableConnectionNames: [],
          isLoadingConn: false,
          availableTagNames: [],
          isLoadingTags: false,
        }
      })));
  };

  // Handler pour choisir une connectionName
  const handleConnectionNameChange = (level: number, connectionName: string) => {
    setLevelConfigs(cfgs => ({
      ...cfgs,
      [level]: {
        ...cfgs[level],
        connectionName,
      }
    }));
  };

  // Handler pour choisir les tags
  const handleTagNamesChange = (level: number, tagNames: string[]) => {
    setLevelConfigs(cfgs => ({
      ...cfgs,
      [level]: {
        ...cfgs[level],
        tagNames,
      }
    }));
  };

  // State pour la config des tags
  const [tagConfig, setTagConfig] = useState<{ [tagName: string]: { dataType: string, units: string } }>({});
  const [tagConfigOpen, setTagConfigOpen] = useState(false);

  // Agréger tous les tags connus (tous levels chargés)
  const allTagNames = Array.from(new Set(
    Object.values(levelConfigs).flatMap(cfg => cfg?.availableTagNames || [])
  ));

  // DataTypes possibles
  const dataTypes = ['Double', 'Boolean', 'String', 'Integer'];

  // Génération des variables pour un level
  const handleAddVariables = (level: number) => {
    console.log('handleAddVariables called for level', level);
    const cfg = levelConfigs[level];
    console.log('levelConfigs pour ce level:', cfg);
    // Utiliser l'adapterId global si celui du niveau n'est pas défini
    if (!cfg || (!cfg.adapterId && !globalAdapterId) || !cfg.tagNames.length) {
      console.log('Early return: cfg manquant ou adapterId/tagNames manquants. adapterId local:', 
                cfg?.adapterId, 'adapterId global:', globalAdapterId, 'tagNames:', cfg?.tagNames);
      toast.error('Please select adapter and at least one tag.');
      return;
    }
    // Utiliser l'adapterId global si nécessaire
    const effectiveAdapterId = cfg.adapterId || globalAdapterId;
    
    // Assets du level
    const assets = parsedExcelData && mappingConfig
      ? (() => {
          const assetLevels = buildAssetLevels(parsedExcelData, mappingConfig);
          console.log('assetLevels générés:', assetLevels);
          const lvl = assetLevels.find(l => l.level === level);
          return lvl ? lvl.nodes : [];
        })()
      : (() => {
          // Filtrer les assets avec assetId="0" et décaler les niveaux
          const filteredAssets = assetCache.filter(a => a.assetId !== "0");
          if (filteredAssets.length === 0) return [];
          
          const minLevel = Math.min(...filteredAssets.map(a => a.level));
          // Récupérer les assets du niveau demandé après décalage
          return filteredAssets.filter(a => a.level - minLevel === level);
        })();
        
    // Log détaillé pour debug
    console.log('[handleAddVariables] assets:', assets, 'level:', level, 'parsedExcelData:', parsedExcelData, 'mappingConfig:', mappingConfig, 'assetCache:', assetCache);
    if (!assets || assets.length === 0) {
      console.log('Early return: aucun asset trouvé pour ce niveau');
      toast.error('Aucun asset trouvé pour ce niveau. Impossible d\'ajouter des variables.');
      return;
    }
    // Génération des variables
    const vars: Variable[] = [];
    assets.forEach(asset => {
      const assetName = (asset as any).name;
      const assetPath = (asset as any).fullPath || (asset as any).path;
      // Correction: assetId = assetId || fullPath || externalId
      const assetId = (asset as any).assetId || (asset as any).fullPath || (asset as any).externalId;
      // Trouver le connectionName qui matche le nom de l'asset
      let connectionName = globalConnectionNames.find(cn => cn.toLowerCase() === assetName.toLowerCase());
      if (!connectionName && globalConnectionNames.length > 0) {
        connectionName = globalConnectionNames[0];
      }
      cfg.tagNames.forEach((tagName: string) => {
        const config = tagConfig[tagName] || {};
        vars.push({
          name: `${assetName}_${tagName}`,
          topic: `${connectionName || ''}::${assetName}_${tagName}`,
          dataType: (config.dataType as any) || 'Double',
          units: config.units || undefined,
          assetPath,
          assetId,
          level,
          adapterId: effectiveAdapterId,
        });
      });
    });
    // Validation Zod (nom, charset, etc)
    const allowedCharset = /^[A-Za-z0-9_.\-()]+$/;
    const variableSchema = z.object({
      name: z.string().max(50).regex(allowedCharset),
      topic: z.string(),
      dataType: z.enum(['Double', 'Boolean', 'String', 'Integer']),
      units: z.string().optional(),
      assetPath: z.string(),
      assetId: z.string().optional(),
      level: z.number(),
      adapterId: z.string().optional(),
    });
    const errors: string[] = [];
    vars.forEach(v => {
      const result = variableSchema.safeParse(v);
      if (!result.success) errors.push(`${v.name}: ${result.error.errors.map(e => e.message).join(', ')}`);
    });
    if (errors.length > 0) {
      toast.error('Validation errors', { description: errors.slice(0, 5).join('\n') + (errors.length > 5 ? '\n…' : '') });
      return;
    }
    // Déduplication
    const existing = new Set(previewVariables.map(v => v.name + '|' + v.topic));
    const deduped = vars.filter(v => !existing.has(v.name + '|' + v.topic));
    console.log('Variables à ajouter:', deduped);
    appendPreview(deduped);
    toast.success(`Added ${deduped.length} variables for level ${level}`);
  };

  // Génération des variables d'énergie pour un level
  const handleAddEnergyVariables = (level: number) => {
    // Assets du level
    const assets = parsedExcelData && mappingConfig
      ? (() => {
          const assetLevels = buildAssetLevels(parsedExcelData, mappingConfig);
          const lvl = assetLevels.find(l => l.level === level);
          return lvl ? lvl.nodes : [];
        })()
      : (() => {
          const filteredAssets = assetCache.filter(a => a.assetId !== "0");
          if (filteredAssets.length === 0) return [];
          
          const minLevel = Math.min(...filteredAssets.map(a => a.level));
          return filteredAssets.filter(a => a.level - minLevel === level);
        })();
        
    if (!assets || assets.length === 0) {
      toast.error('Aucun asset trouvé pour ce niveau. Impossible d\'ajouter des variables.');
      return;
    }

    // Variables à générer
    const vars: Variable[] = [];
    let energyVarsAdded = 0;

    // Pour le dernier niveau: ajouter des variables TypeEnergie (String)
    const isLastLevel = level === Math.max(...levels.map(l => l.level));
    if (isLastLevel) {
      // Pour chaque asset du dernier niveau
      assets.forEach(asset => {
        const assetName = (asset as any).name;
        const assetPath = (asset as any).fullPath || (asset as any).path;
        const assetId = (asset as any).assetId || (asset as any).fullPath || (asset as any).externalId;

        // Déterminer le type d'énergie (utiliser la configuration manuelle si disponible)
        let energyType = manualEnergyConfig[assetPath];
        
        // Si aucune configuration manuelle, attribuer un type par défaut
        if (!energyType) {
          const nameLC = assetName.toLowerCase();
          if (nameLC.includes('elec')) energyType = 'Elec';
          else if (nameLC.includes('gaz')) energyType = 'Gaz';
          else if (nameLC.includes('eau')) energyType = 'Eau';
          else if (nameLC.includes('air')) energyType = 'Air';
          else energyType = energyTypes[0]; // Type par défaut
        }

        // Créer une variable TypeEnergie
        vars.push({
          name: `${assetName}_TypeEnergie`,
          topic: `${assetName}_TypeEnergie`,
          dataType: 'String',
          assetPath,
          assetId,
          level,
          // Stocker la valeur initiale dans units (sera utilisée par le système)
          units: energyType
        });
        
        // Mettre à jour les relations d'énergie pour cet asset
        setEnergyRelations(prev => ({
          ...prev,
          [assetPath]: energyType
        }));
        
        energyVarsAdded++;
      });
    } 
    // Pour les niveaux supérieurs: ajouter des isElec, isGaz, isEau, isAir (Boolean)
    else {
      // Construire la relation parent-enfant et déterminer les types d'énergie pour ce niveau
      buildEnergyRelationships();

      // Pour chaque asset du niveau courant
      assets.forEach(asset => {
        const assetName = (asset as any).name;
        const assetPath = (asset as any).fullPath || (asset as any).path;
        const assetId = (asset as any).assetId || (asset as any).fullPath || (asset as any).externalId;

        // Vérifier quels types d'énergie existent parmi les enfants de cet asset
        const childPaths = parentChildMap[assetPath] || [];
        const childEnergyTypes = childPaths.map(childPath => energyRelations[childPath]);
        
        // Pour chaque type d'énergie, vérifier s'il est présent chez au moins un enfant
        energyTypes.forEach(energyType => {
          // Valeur par défaut (si pas d'enfants connus)
          let hasEnergyType = false;
          
          // Si on a des données sur les enfants
          if (childPaths.length > 0) {
            // Vérifier si au moins un enfant ou sous-enfant a ce type d'énergie
            hasEnergyType = childEnergyTypes.some(type => type === energyType) || 
              // Vérifier récursivement les types d'énergie des enfants
              hasEnergyTypeInDescendants(assetPath, energyType);
          }
          
          vars.push({
            name: `${assetName}_is${energyType}`,
            topic: `${assetName}_is${energyType}`,
            dataType: 'Boolean',
            assetPath,
            assetId,
            level,
            // La valeur initiale sera stockée dans le topic pour référence
            // (sera remplacée par la vraie valeur lors de l'utilisation)
            units: hasEnergyType ? 'true' : 'false'
          });
          energyVarsAdded++;
        });
      });
    }

    // Validation Zod (nom, charset, etc)
    const allowedCharset = /^[A-Za-z0-9_.\-()]+$/;
    const variableSchema = z.object({
      name: z.string().max(50).regex(allowedCharset),
      topic: z.string(),
      dataType: z.enum(['Double', 'Boolean', 'String', 'Integer']),
      units: z.string().optional(),
      assetPath: z.string(),
      assetId: z.string().optional(),
      level: z.number(),
      adapterId: z.string().optional(),
    });

    const errors: string[] = [];
    vars.forEach(v => {
      const result = variableSchema.safeParse(v);
      if (!result.success) errors.push(`${v.name}: ${result.error.errors.map(e => e.message).join(', ')}`);
    });

    if (errors.length > 0) {
      toast.error('Validation errors', { description: errors.slice(0, 5).join('\n') + (errors.length > 5 ? '\n…' : '') });
      return;
    }

    // Déduplication
    const existing = new Set(previewVariables.map(v => v.name + '|' + v.topic));
    const deduped = vars.filter(v => !existing.has(v.name + '|' + v.topic));
    
    appendPreview(deduped);
    toast.success(`Added ${deduped.length} energy variables for level ${level}`);
  };

  // Analyser les variables TypeEnergie existantes pour construire une carte des relations
  const buildEnergyRelationships = () => {
    // Récupérer toutes les variables TypeEnergie dans les variables de prévisualisation
    const energyVars = previewVariables.filter(v => v.name.includes('_TypeEnergie'));
    
    // Carte temporaire pour stocker les relations parent-enfant
    const tempParentChildMap: {[parentPath: string]: string[]} = {};
    const tempEnergyRelations: {[assetPath: string]: string} = {};
    
    // Extraire les données du mapping ou de l'assetCache pour construire la hiérarchie
    const allAssets = new Map<string, any>();
    
    // D'abord, collectons tous les assets de tous les niveaux
    levels.forEach(lvl => {
      const assets = parsedExcelData && mappingConfig
        ? (() => {
            const assetLevels = buildAssetLevels(parsedExcelData, mappingConfig);
            const level = assetLevels.find(l => l.level === lvl.level);
            return level ? level.nodes : [];
          })()
        : (() => {
            const filteredAssets = assetCache.filter(a => a.assetId !== "0");
            if (filteredAssets.length === 0) return [];
            
            const minLevel = Math.min(...filteredAssets.map(a => a.level));
            return filteredAssets.filter(a => a.level - minLevel === lvl.level);
          })();
          
      assets.forEach(asset => {
        const assetPath = (asset as any).fullPath || (asset as any).path;
        allAssets.set(assetPath, asset);
      });
    });
    
    // Construire la relation parent-enfant
    allAssets.forEach((asset, assetPath) => {
      const parentPath = (asset as any).parentPath;
      if (parentPath) {
        if (!tempParentChildMap[parentPath]) {
          tempParentChildMap[parentPath] = [];
        }
        tempParentChildMap[parentPath].push(assetPath);
      }
    });
    
    // Assigner les types d'énergie par défaut (en se basant sur le dernier segment du nom de l'asset)
    // ou utiliser les variables TypeEnergie déjà définies
    energyVars.forEach(v => {
      const assetPath = v.assetPath;
      const assetName = (v.name.split('_TypeEnergie')[0] || '').toLowerCase();
      
      // Déterminer le type d'énergie en fonction du nom
      let energyType = '';
      if (assetName.includes('elec')) energyType = 'Elec';
      else if (assetName.includes('gaz')) energyType = 'Gaz';
      else if (assetName.includes('eau')) energyType = 'Eau';
      else if (assetName.includes('air')) energyType = 'Air';
      else {
        // Choisir un type aléatoire pour la démo
        energyType = energyTypes[Math.floor(Math.random() * energyTypes.length)];
      }
      
      tempEnergyRelations[assetPath] = energyType;
    });
    
    // Mettre à jour l'état
    setParentChildMap(tempParentChildMap);
    setEnergyRelations(tempEnergyRelations);
  };
  
  // Fonction récursive pour vérifier si un asset a un descendant avec un type d'énergie spécifique
  const hasEnergyTypeInDescendants = (assetPath: string, energyType: string): boolean => {
    const children = parentChildMap[assetPath] || [];
    
    // Vérifier directement les enfants
    for (const childPath of children) {
      if (energyRelations[childPath] === energyType) {
        return true;
      }
      
      // Vérifier récursivement les petits-enfants
      if (hasEnergyTypeInDescendants(childPath, energyType)) {
        return true;
      }
    }
    
    return false;
  };

  // Lorsque le composant se monte ou que les variables de prévisualisation changent,
  // reconstruire les relations énergétiques
  useEffect(() => {
    if (enableEnergyFeatures) {
      buildEnergyRelationships();
    }
  }, [previewVariables, enableEnergyFeatures]);

  // Fonction pour configurer manuellement les types d'énergie 
  const configureEnergyTypes = () => {
    // Obtenir tous les assets du dernier niveau
    const lastLevel = Math.max(...levels.map(l => l.level));
    const lastLevelAssets = parsedExcelData && mappingConfig
      ? (() => {
          const assetLevels = buildAssetLevels(parsedExcelData, mappingConfig);
          const lvl = assetLevels.find(l => l.level === lastLevel);
          return lvl ? lvl.nodes : [];
        })()
      : (() => {
          const filteredAssets = assetCache.filter(a => a.assetId !== "0");
          if (filteredAssets.length === 0) return [];
          
          const minLevel = Math.min(...filteredAssets.map(a => a.level));
          return filteredAssets.filter(a => a.level - minLevel === lastLevel);
        })();

    // Préparer la configuration initiale
    const initialConfig = { ...manualEnergyConfig };
    
    // Assigner un type d'énergie par défaut si non défini
    lastLevelAssets.forEach(asset => {
      const assetPath = (asset as any).fullPath || (asset as any).path;
      if (!initialConfig[assetPath]) {
        const assetName = (asset as any).name.toLowerCase();
        
        // Déterminer le type d'énergie en fonction du nom
        let defaultType = '';
        if (assetName.includes('elec')) defaultType = 'Elec';
        else if (assetName.includes('gaz')) defaultType = 'Gaz';
        else if (assetName.includes('eau')) defaultType = 'Eau';
        else if (assetName.includes('air')) defaultType = 'Air';
        else {
          // Si aucun mot-clé, utiliser le premier type
          defaultType = energyTypes[0];
        }
        
        initialConfig[assetPath] = defaultType;
      }
    });
    
    // Mettre à jour la configuration manuelle
    setManualEnergyConfig(initialConfig);
    
    // Ouvrir la boîte de dialogue
    setConfigureEnergyOpen(true);
  };

  // Mettre à jour la configuration d'énergie d'un asset
  const updateAssetEnergyType = (assetPath: string, energyType: string) => {
    setManualEnergyConfig(prev => ({
      ...prev,
      [assetPath]: energyType
    }));
  };

  // Appliquer les configurations manuelles aux relations d'énergie
  useEffect(() => {
    if (Object.keys(manualEnergyConfig).length > 0) {
      setEnergyRelations(prev => ({
        ...prev,
        ...manualEnergyConfig
      }));
    }
  }, [manualEnergyConfig]);

  // Corriger ici en définissant la fonction getCell au sein du composant pour éviter les erreurs
  const getEnergyValueFromExcel = (assetPath: string) => {
    if (!parsedExcelData || !mappingConfig || !excelEnergyColumn) return null;
    
    // Trouver le dernier niveau pour savoir combien de segments de chemin on doit avoir
    const lastLevel = Math.max(...levels.map(l => l.level));
    
    // On cherche la ligne Excel qui correspond à cet asset
    const pathSegments = assetPath.split('@');
    
    // Parcourir les lignes d'Excel pour trouver celle qui correspond
    for (let rowIdx = 0; rowIdx < parsedExcelData.rows.length; rowIdx++) {
      const row = parsedExcelData.rows[rowIdx];
      const rowPathSegments: string[] = [];
      
      // Reconstruire le chemin complet à partir des colonnes de niveau
      let matchesPath = true;
      for (let lvl = 0; lvl <= lastLevel; lvl++) {
        // Trouver la colonne qui correspond à ce niveau
        const levelColumn = Object.entries(mappingConfig.columnMappings).find(
          ([, m]) => (m as any).type === 'level' && (m as any).level === lvl
        )?.[0];
        
        if (!levelColumn) {
          matchesPath = false;
          break;
        }
        
        // Trouver l'index de la colonne
        const colIdx = parsedExcelData.headers.indexOf(levelColumn);
        if (colIdx === -1) {
          matchesPath = false;
          break;
        }
        
        // Récupérer la valeur
        const cellValue = row[colIdx] ? String(row[colIdx]).trim() : '';
        if (!cellValue) {
          matchesPath = false;
          break;
        }
        
        rowPathSegments.push(cellValue);
        
        // Si on a déjà assez de segments pour comparer avec notre chemin cible
        if (lvl < pathSegments.length) {
          if (rowPathSegments[lvl] !== pathSegments[lvl]) {
            matchesPath = false;
            break;
          }
        }
      }
      
      // Si tous les segments correspondent et on a le bon nombre de segments
      if (matchesPath && rowPathSegments.length === pathSegments.length) {
        // On a trouvé la ligne qui correspond à notre asset, récupérer la valeur d'énergie
        const energyColIdx = parsedExcelData.headers.indexOf(excelEnergyColumn);
        if (energyColIdx !== -1) {
          return String(row[energyColIdx] || '').trim();
        }
      }
    }
    
    return null;
  };

  // Détecter automatiquement la colonne d'énergie dans le fichier Excel
  useEffect(() => {
    if (parsedExcelData && mappingConfig && autoDetectEnergyColumn && energyConfigMode === 'auto') {
      // Utiliser notre helper pour détecter la colonne d'énergie
      const energyColHeader = findEnergyColumn(parsedExcelData.headers);
      if (energyColHeader) {
        setExcelEnergyColumn(energyColHeader);
        console.log('Colonne énergie détectée:', energyColHeader);
        
        // Pré-remplir la configuration avec les valeurs du fichier Excel
        const lastLevel = Math.max(...levels.map(l => l.level));
        const assets = (() => {
          const assetLevels = buildAssetLevels(parsedExcelData, mappingConfig);
          const lvl = assetLevels.find(l => l.level === lastLevel);
          return lvl ? lvl.nodes : [];
        })();
        
        // Préparer la nouvelle configuration
        const newConfig: {[assetPath: string]: string} = {};
        
        // Pour chaque asset du dernier niveau
        assets.forEach(asset => {
          const assetPath = (asset as any).fullPath;
          
          // Récupérer la valeur d'énergie depuis Excel
          const energyValue = getEnergyValueFromExcel(assetPath);
          
          if (energyValue) {
            // Normaliser la valeur pour qu'elle corresponde aux types d'énergie attendus
            let normalizedValue: string;
            if (energyValue.toLowerCase().includes('élec') || energyValue.toLowerCase().includes('elec')) {
              normalizedValue = 'Elec';
            } else if (energyValue.toLowerCase().includes('gaz')) {
              normalizedValue = 'Gaz';
            } else if (energyValue.toLowerCase().includes('eau')) {
              normalizedValue = 'Eau';
            } else if (energyValue.toLowerCase().includes('air')) {
              normalizedValue = 'Air';
            } else {
              // Si la valeur existe mais ne correspond à aucun type connu
              normalizedValue = energyTypes[0];
            }
            
            newConfig[assetPath] = normalizedValue;
          } else {
            // Pas de valeur trouvée, utiliser une heuristique sur le nom
            const assetName = (asset as any).name.toLowerCase();
            let defaultType = '';
            if (assetName.includes('elec')) defaultType = 'Elec';
            else if (assetName.includes('gaz')) defaultType = 'Gaz';
            else if (assetName.includes('eau')) defaultType = 'Eau';
            else if (assetName.includes('air')) defaultType = 'Air';
            else {
              // Si aucun mot-clé, utiliser le premier type
              defaultType = energyTypes[0];
            }
            
            newConfig[assetPath] = defaultType;
          }
        });
        
        // Mettre à jour la configuration manuelle
        if (Object.keys(newConfig).length > 0) {
          setManualEnergyConfig(newConfig);
          toast.success(`Détection automatique des types d'énergie: ${Object.keys(newConfig).length} assets configurés`);
        }
      }
    }
  }, [parsedExcelData, mappingConfig, autoDetectEnergyColumn, energyConfigMode, levels]);

  // Ouvrir l'assistant d'import Excel pour l'énergie
  const openEnergyExcelWizard = () => {
    // Si on a déjà des données Excel mappées, on les utilise
    if (parsedExcelData && mappingConfig) {
      setEnergyExcelData(parsedExcelData);
      setEnergyMappingConfig(mappingConfig);
    } else {
      // Sinon, on part de zéro
      setEnergyExcelData(null);
      setEnergyMappingConfig(null);
    }
    setShowEnergyExcelWizard(true);
  };

  // Gérer l'import des données Excel pour l'énergie
  const handleEnergyExcelImported = (data: ExcelData) => {
    setEnergyExcelData(data);
  };

  // Gérer la création du mapping pour l'énergie
  const handleEnergyMappingCreated = (mapping: MappingConfig) => {
    setEnergyMappingConfig(mapping);
  };

  // Gérer la prévisualisation des variables d'énergie
  const handleEnergyVariablesPreview = (variables: Variable[]) => {
    // Déduplication avec les variables existantes
    const existing = new Set(previewVariables.map(v => v.name + '|' + v.topic));
    const deduped = variables.filter(v => !existing.has(v.name + '|' + v.topic));
    
    // Ajouter les nouvelles variables
    appendPreview(deduped);
    setShowEnergyExcelWizard(false);
    toast.success(`${deduped.length} variables d'énergie ajoutées`);
    
    // Mettre à jour les relations d'énergie
    const newEnergyRelations: {[assetPath: string]: string} = {};
    variables.forEach(v => {
      if (v.name.includes('_TypeEnergie') && v.units) {
        newEnergyRelations[v.assetPath] = v.units;
      }
    });
    
    setEnergyRelations(prev => ({
      ...prev,
      ...newEnergyRelations
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[80vh] my-12 overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Variable Sets by Level</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="tags">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="tags">Tag Variables</TabsTrigger>
            <TabsTrigger value="energy">Energy Variables</TabsTrigger>
          </TabsList>

          <TabsContent value="tags">
            {/* Adapter global */}
            <div className="flex items-center gap-4 mb-4">
              <Label className="w-32">Adapter</Label>
              <Select
                value={globalAdapterId}
                onValueChange={v => setGlobalAdapterId(v)}
                disabled={isLoadingAdapters}
              >
                <SelectTrigger><SelectValue placeholder="Choose adapter" /></SelectTrigger>
                <SelectContent>
                  {adaptersList.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Bouton config tags */}
            <div className="flex justify-end mb-2">
              <Button variant="secondary" onClick={() => setTagConfigOpen(true)}>
                Configurer tags
              </Button>
            </div>

            {/* Dialog de config tags */}
            <UIDialog open={tagConfigOpen} onOpenChange={setTagConfigOpen}>
              <UIDialogContent className="sm:max-w-lg">
                <UIDialogHeader>
                  <UIDialogTitle>Configurer les tags</UIDialogTitle>
                </UIDialogHeader>
                <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                  {allTagNames.length === 0 && <div className="text-muted-foreground text-sm">Aucun tag détecté</div>}
                  {allTagNames.map(tag => (
                    <div key={tag} className="flex items-center gap-4">
                      <div className="w-32 font-mono text-xs truncate">{tag}</div>
                      <select
                        className="border rounded px-2 py-1 text-xs"
                        value={tagConfig[tag]?.dataType || ''}
                        onChange={e => setTagConfig(cfg => ({
                          ...cfg,
                          [tag]: { ...cfg[tag], dataType: e.target.value }
                        }))}
                      >
                        <option value="">Type</option>
                        {dataTypes.map(dt => <option key={dt} value={dt}>{dt}</option>)}
                      </select>
                      <input
                        className="border rounded px-2 py-1 text-xs w-24"
                        placeholder="Unité"
                        value={tagConfig[tag]?.units || ''}
                        onChange={e => setTagConfig(cfg => ({
                          ...cfg,
                          [tag]: { ...cfg[tag], units: e.target.value }
                        }))}
                      />
                      <Button size="icon" variant="ghost" onClick={() => setTagConfig(cfg => {
                        const c = { ...cfg };
                        delete c[tag];
                        return c;
                      })} title="Réinitialiser">
                        ×
                      </Button>
                    </div>
                  ))}
                </div>
                <UIDialogFooter>
                  <Button variant="outline" onClick={() => setTagConfigOpen(false)}>Fermer</Button>
                </UIDialogFooter>
              </UIDialogContent>
            </UIDialog>

            <div className="space-y-6 py-4">
              {levels.map(lvl => (
                <div key={lvl.level} className="border rounded-md p-4 space-y-2">
                  <div className="flex gap-4 items-center">
                    <Label className="w-32">Level {lvl.level}</Label>
                    <div className="flex flex-wrap gap-2 items-center">
                      {levelConfigs[lvl.level]?.availableTagNames?.length ? (
                        levelConfigs[lvl.level].availableTagNames.map((tag: string) => (
                          <label key={tag} className="flex items-center gap-1">
                            <Checkbox
                              checked={levelConfigs[lvl.level].tagNames?.includes(tag)}
                              onCheckedChange={(checked) => {
                                const prev = levelConfigs[lvl.level].tagNames || [];
                                let next: string[];
                                if (checked) {
                                  next = [...prev, tag];
                                } else {
                                  next = prev.filter(t => t !== tag);
                                }
                                handleTagNamesChange(lvl.level, next);
                              }}
                            />
                            <span className="text-xs">{tag}</span>
                          </label>
                        ))
                      ) : (
                        <span className="text-muted-foreground text-xs">No tags available</span>
                      )}
                    </div>
                    <Button onClick={() => handleAddVariables(lvl.level)} variant="outline">
                      Add variables for this level
                    </Button>
                  </div>
                  <div className="mt-2">
                    <div className="text-muted-foreground text-xs">
                      {previewVariables.filter(v => v.level === lvl.level).length > 0 
                        ? `${previewVariables.filter(v => v.level === lvl.level).length} variables will be created for this level.`
                        : "No variables added for this level yet."}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="energy">
            <div className="space-y-4 py-4">
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-medium">Energy Types Configuration</h3>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info size={16} className="text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-md">
                        <p>Cette fonctionnalité génère automatiquement :</p>
                        <ul className="list-disc pl-5 mt-1">
                          <li>Les variables <strong>TypeEnergie</strong> pour le dernier niveau</li>
                          <li>Les variables <strong>isElec, isGaz,</strong> etc. pour les niveaux supérieurs, calculées automatiquement</li>
                        </ul>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  This configuration will create energy-related variables based on your hierarchy:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-sm mb-4">
                  <li>For the lowest level: A <span className="font-bold">TypeEnergie</span> variable (string type) for each asset</li>
                  <li>For higher levels: <span className="font-bold">isElec, isGaz, isEau, isAir</span> boolean variables that indicate if assets of that type exist below</li>
                </ul>
                
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="enableEnergyFeatures" 
                    checked={enableEnergyFeatures}
                    onCheckedChange={(checked) => setEnableEnergyFeatures(!!checked)} 
                  />
                  <Label htmlFor="enableEnergyFeatures">Enable Energy Features</Label>
                </div>
                
                {enableEnergyFeatures && (
                  <div className="mt-4 border p-4 rounded-md">
                    <div className="flex items-center space-x-4">
                      <div className="flex-1">
                        <Label className="text-base font-medium mb-2 block">Configuration Method</Label>
                        <div className="flex gap-8">
                          <div className="flex items-center space-x-2">
                            <input 
                              type="radio" 
                              id="configAuto" 
                              checked={energyConfigMode === 'auto'} 
                              onChange={() => setEnergyConfigMode('auto')}
                              className="radio"
                            />
                            <label htmlFor="configAuto">
                              <span className="font-medium">Automatic</span>
                              <span className="text-xs block text-muted-foreground">
                                Detect energy types from Excel
                              </span>
                            </label>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <input 
                              type="radio" 
                              id="configManual" 
                              checked={energyConfigMode === 'manual'} 
                              onChange={() => setEnergyConfigMode('manual')}
                              className="radio"
                            />
                            <label htmlFor="configManual">
                              <span className="font-medium">Manual</span>
                              <span className="text-xs block text-muted-foreground">
                                Configure each asset manually
                              </span>
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {energyConfigMode === 'auto' && (
                      <div className="mt-4">
                        <div className="flex flex-col gap-4">
                          <p className="text-sm text-muted-foreground">
                            L'assistant d'importation va vous guider à travers le processus d'import et de mapping du fichier Excel pour configurer les variables d'énergie.
                          </p>
                          
                          <Button 
                            onClick={openEnergyExcelWizard} 
                            className="w-full"
                          >
                            Démarrer l'assistant d'import Excel
                          </Button>
                        </div>
                      </div>
                    )}
                    
                    {energyConfigMode === 'manual' && (
                      <div className="mt-4 flex justify-end">
                        <Button 
                          variant="outline" 
                          onClick={configureEnergyTypes}
                        >
                          <span>Configure Energy Types</span>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info size={16} className="ml-2 text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Configurez manuellement le type d'énergie des assets du dernier niveau</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Dialog de configuration des types d'énergie */}
              <UIDialog open={configureEnergyOpen} onOpenChange={setConfigureEnergyOpen}>
                <UIDialogContent className="sm:max-w-lg">
                  <UIDialogHeader>
                    <UIDialogTitle>Configure Energy Types</UIDialogTitle>
                    {excelEnergyColumn && energyConfigMode === 'auto' && (
                      <p className="text-sm text-muted-foreground">
                        Valeurs configurées automatiquement depuis la colonne <span className="font-mono">{excelEnergyColumn}</span> du fichier Excel
                      </p>
                    )}
                  </UIDialogHeader>
                  <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                    {Object.keys(manualEnergyConfig).length === 0 ? (
                      <div className="text-muted-foreground text-sm">No assets found at the lowest level.</div>
                    ) : (
                      Object.entries(manualEnergyConfig).map(([assetPath, energyType]) => {
                        // Récupérer le nom de l'asset depuis le chemin
                        const assetName = assetPath.split('@').pop() || assetPath;
                        
                        return (
                          <div key={assetPath} className="flex items-center gap-4">
                            <div className="w-48 truncate text-sm" title={assetPath}>{assetName}</div>
                            <Select
                              value={energyType}
                              onValueChange={(value) => updateAssetEnergyType(assetPath, value)}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                              <SelectContent>
                                {energyTypes.map(type => (
                                  <SelectItem key={type} value={type}>{type}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        );
                      })
                    )}
                  </div>
                  <UIDialogFooter>
                    <Button variant="outline" onClick={() => setConfigureEnergyOpen(false)}>Close</Button>
                  </UIDialogFooter>
                </UIDialogContent>
              </UIDialog>

              {/* Assistant Excel pour l'énergie */}
              <EnergyExcelWizard
                open={showEnergyExcelWizard}
                onClose={() => setShowEnergyExcelWizard(false)}
                excelData={energyExcelData}
                onExcelImported={handleEnergyExcelImported}
                existingMapping={energyMappingConfig}
                onMappingCreated={handleEnergyMappingCreated}
                onVariablesPreview={handleEnergyVariablesPreview}
                energyTypes={energyTypes}
              />

              {/* N'afficher les niveaux que si le mode manuel est sélectionné */}
              {enableEnergyFeatures && energyConfigMode === 'manual' && (
                <div className="space-y-6">
                  {levels.map(lvl => (
                    <div key={lvl.level} className="border rounded-md p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="block mb-1">Level {lvl.level}</Label>
                          <p className="text-xs text-muted-foreground">
                            {lvl.level === Math.max(...levels.map(l => l.level)) ? (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger className="text-left">
                                    TypeEnergie variables will be added for each asset
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Ces variables contiennent le type d'énergie de l'asset (Elec, Gaz, Eau, Air)</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger className="text-left">
                                    isElec, isGaz, isEau, isAir boolean variables will be added
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Ces variables booléennes indiquent si un asset de ce type existe dans les niveaux inférieurs</p>
                                    <p className="mt-1"><strong>Exemple :</strong> Si un Atelier a des machines qui utilisent de l'électricité, isElec=true</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </p>
                        </div>
                        <Button onClick={() => handleAddEnergyVariables(lvl.level)} variant="outline">
                          Add energy variables
                        </Button>
                      </div>
                      <div className="mt-2">
                        <div className="text-muted-foreground text-xs">
                          {previewVariables.filter(v => v.level === lvl.level && 
                            (v.name.includes('_TypeEnergie') || 
                            v.name.includes('_isElec') || 
                            v.name.includes('_isGaz') || 
                            v.name.includes('_isEau') || 
                            v.name.includes('_isAir'))).length > 0 
                            ? `${previewVariables.filter(v => v.level === lvl.level && 
                              (v.name.includes('_TypeEnergie') || 
                              v.name.includes('_isElec') || 
                              v.name.includes('_isGaz') || 
                              v.name.includes('_isEau') || 
                              v.name.includes('_isAir'))).length} energy variables will be created for this level.`
                            : "No energy variables added for this level yet."}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button variant="default" onClick={() => toast.success("Check the Variables Preview section to view and manage all variables.")}>
            View all variables
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 