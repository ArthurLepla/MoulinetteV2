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
import { Settings } from 'lucide-react';
import { TemplateManagerModal } from './TemplateManagerModal';
import { useAssetCache } from '@/store/assetCache';
import { useAssetIdMap } from '@/store/assetIdMap';
import { toast } from 'sonner';
import { z } from 'zod';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog as UIDialog, DialogContent as UIDialogContent, DialogHeader as UIDialogHeader, DialogTitle as UIDialogTitle, DialogFooter as UIDialogFooter } from '@/components/ui/dialog';
import { VariablePreview } from '@/components/VariablePreview';
import { useShallow } from 'zustand/react/shallow';

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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[80vh] my-12 overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Variable Sets by Level</DialogTitle>
        </DialogHeader>
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
              {/* Suppression du tableau de prévisualisation des variables */}
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