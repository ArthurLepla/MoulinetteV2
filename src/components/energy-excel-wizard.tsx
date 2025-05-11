'use client';
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ExcelDropzone } from '@/components/excel-dropzone';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from "@/components/ui/label";
import { ExcelData } from '@/store/excelStore';
import { MappingConfig, ColumnMapping } from '@/components/mapping-modal';
import { buildAssetLevels } from '@/lib/assetUtils';
import { toast } from 'sonner';
import { Variable } from '@/store/variableStore';
import { Checkbox } from '@/components/ui/checkbox';
import { Info, ArrowRight, FileSpreadsheet, Grid3X3, Eye, Check } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface EnergyExcelWizardProps {
  open: boolean;
  onClose: () => void;
  excelData: ExcelData | null;
  onExcelImported: (data: ExcelData) => void;
  existingMapping: MappingConfig | null;
  onMappingCreated: (mapping: MappingConfig) => void;
  onVariablesPreview: (variables: Variable[]) => void;
  energyTypes: string[];
}

type Step = 'import' | 'mapping' | 'preview' | 'review';

export function EnergyExcelWizard({
  open,
  onClose,
  excelData,
  onExcelImported,
  existingMapping,
  onMappingCreated,
  onVariablesPreview,
  energyTypes
}: EnergyExcelWizardProps) {
  const [step, setStep] = useState<Step>('import');
  const [importedData, setImportedData] = useState<ExcelData | null>(excelData);
  const [mapping, setMapping] = useState<MappingConfig | null>(existingMapping);
  const [previewVariables, setPreviewVariables] = useState<Variable[]>([]);
  const [energyColumn, setEnergyColumn] = useState<string | null>(null);
  const [levelMappings, setLevelMappings] = useState<{ [level: number]: string }>({});
  const [autoDetectedEnergyColumn, setAutoDetectedEnergyColumn] = useState<string | null>(null);
  const [maxLevelCount, setMaxLevelCount] = useState(5); // Nombre maximal de niveaux à afficher
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  
  // Réinitialiser les états au changement de visibilité
  useEffect(() => {
    if (open) {
      setImportedData(excelData);
      setMapping(existingMapping);
      // Déterminer l'étape initiale
      if (!excelData) {
        setStep('import');
      } else if (!existingMapping) {
        setStep('mapping');
      } else {
        setStep('preview');
      }
    }
  }, [open, excelData, existingMapping]);
  
  // Détecter automatiquement la colonne d'énergie
  useEffect(() => {
    if (importedData && importedData.headers) {
      // Chercher des colonnes qui pourraient contenir des informations d'énergie
      const candidates = ['Type', 'EnergyType', 'Energie', 'Énergie', 'Energy'];
      const match = importedData.headers.find(header => 
        candidates.some(candidate => header.toLowerCase().includes(candidate.toLowerCase()))
      );
      
      if (match) {
        setAutoDetectedEnergyColumn(match);
        if (!energyColumn) {
          setEnergyColumn(match);
        }
      }
    }
  }, [importedData]);

  // Estimer le nombre maximal de niveaux à partir des données Excel
  useEffect(() => {
    if (importedData && importedData.headers) {
      // Chercher des colonnes qui pourraient correspondre à des niveaux
      const levelCandidates = importedData.headers.filter(header => {
        const h = header.toLowerCase();
        return h.includes('level') || h.includes('niveau') || 
               h.includes('usine') || h.includes('secteur') || 
               h.includes('atelier') || h.includes('machine') ||
               h.includes('equipement') || h.includes('bâtiment') ||
               h.includes('site') || h.includes('zone');
      });
      
      // Définir un minimum de 5 niveaux ou le nombre de colonnes candidats + 2
      const estimatedLevels = Math.max(5, levelCandidates.length + 2);
      setMaxLevelCount(estimatedLevels);
    }
  }, [importedData]);

  // Fonction pour gérer l'import du fichier Excel
  const handleExcelDataParsed = (data: ExcelData | null) => {
    if (data) {
      setImportedData(data);
      onExcelImported(data);
      setStep('mapping');
      toast.success('Fichier Excel importé avec succès');
    }
  };

  // Fonction pour créer le mapping
  const handleMappingCreated = () => {
    if (!importedData || !Object.keys(levelMappings).length || !energyColumn) {
      toast.error('Configuration incomplète. Veuillez mapper les niveaux et sélectionner une colonne d\'énergie.');
      return;
    }
    
    // Construire la configuration de mapping
    const columnMappings: { [header: string]: ColumnMapping } = {};
    
    // Ajouter les mappings de niveau
    Object.entries(levelMappings).forEach(([level, column]) => {
      columnMappings[column] = { type: 'level', level: parseInt(level) };
    });
    
    // Ajouter le mapping de la colonne d'énergie
    columnMappings[energyColumn] = { type: 'EnergyType' };
    
    const newMapping: MappingConfig = {
      columnMappings,
    };
    
    setMapping(newMapping);
    onMappingCreated(newMapping);
    
    // Générer l'aperçu des variables
    generateVariablesPreview(importedData, newMapping);
    
    setStep('preview');
    toast.success('Mapping configuré avec succès');
  };

  // Fonction pour générer l'aperçu des variables d'énergie
  const generateVariablesPreview = (data: ExcelData, mappingConfig: MappingConfig) => {
    if (!data || !mappingConfig) return;
    
    try {
      // Construire les niveaux d'assets
      const assetLevels = buildAssetLevels(data, mappingConfig);
      
      // Variables à générer
      const variables: Variable[] = [];
      
      // Index de la colonne d'énergie
      const energyColIndex = data.headers.indexOf(energyColumn || '');
      
      // Pour chaque niveau, générer les variables appropriées
      assetLevels.forEach(level => {
        const isLastLevel = level.level === Math.max(...assetLevels.map(l => l.level));
        
        // Pour chaque asset du niveau
        level.nodes.forEach(asset => {
          const assetName = asset.name;
          const assetPath = asset.fullPath;
          
          if (isLastLevel) {
            // Chercher le type d'énergie dans Excel pour cet asset
            let energyType = '';
            
            // Parcourir les lignes du fichier Excel pour trouver celle qui correspond à cet asset
            for (let i = 0; i < data.rows.length; i++) {
              const row = data.rows[i];
              
              // Vérifier si cette ligne correspond au path complet de l'asset
              const pathSegments = assetPath.split('@');
              let matchesPath = true;
              
              for (let lvl = 0; lvl < pathSegments.length; lvl++) {
                // Trouver la colonne correspondant à ce niveau
                const levelColumn = Object.entries(mappingConfig.columnMappings).find(
                  ([, m]) => (m as any).type === 'level' && (m as any).level === lvl
                )?.[0];
                
                if (!levelColumn) continue;
                
                const colIdx = data.headers.indexOf(levelColumn);
                if (colIdx === -1) continue;
                
                if (String(row[colIdx]).trim() !== pathSegments[lvl]) {
                  matchesPath = false;
                  break;
                }
              }
              
              if (matchesPath && energyColIndex !== -1) {
                // On a trouvé la ligne, récupérer le type d'énergie
                const rawValue = String(row[energyColIndex] || '').trim();
                
                // Normaliser la valeur
                if (rawValue.toLowerCase().includes('élec') || rawValue.toLowerCase().includes('elec')) {
                  energyType = 'Elec';
                } else if (rawValue.toLowerCase().includes('gaz')) {
                  energyType = 'Gaz';
                } else if (rawValue.toLowerCase().includes('eau')) {
                  energyType = 'Eau';
                } else if (rawValue.toLowerCase().includes('air')) {
                  energyType = 'Air';
                } else {
                  // Valeur par défaut
                  energyType = energyTypes[0];
                }
                
                break;
              }
            }
            
            // Si on n'a pas trouvé de type d'énergie, utiliser une heuristique sur le nom
            if (!energyType) {
              const name = assetName.toLowerCase();
              if (name.includes('elec')) energyType = 'Elec';
              else if (name.includes('gaz')) energyType = 'Gaz';
              else if (name.includes('eau')) energyType = 'Eau';
              else if (name.includes('air')) energyType = 'Air';
              else energyType = energyTypes[0];
            }
            
            // Ajouter la variable TypeEnergie
            variables.push({
              name: `${assetName}_TypeEnergie`,
              topic: `${assetName}_TypeEnergie`,
              dataType: 'String',
              assetPath,
              level: level.level,
              units: energyType
            });
          } else {
            // Pour les niveaux supérieurs, ajouter les variables booléennes
            energyTypes.forEach(energyType => {
              variables.push({
                name: `${assetName}_is${energyType}`,
                topic: `${assetName}_is${energyType}`,
                dataType: 'Boolean',
                assetPath,
                level: level.level,
                // La valeur sera calculée ultérieurement
                units: ''
              });
            });
          }
        });
      });
      
      // Mise à jour des valeurs booléennes en fonction de la hiérarchie
      updateBooleanValues(variables, assetLevels);
      
      setPreviewVariables(variables);
    } catch (error) {
      console.error("Erreur lors de la génération de l'aperçu des variables:", error);
      toast.error("Une erreur s'est produite lors de la génération de l'aperçu des variables");
    }
  };
  
  // Fonction pour mettre à jour les valeurs booléennes en fonction de la hiérarchie
  const updateBooleanValues = (variables: Variable[], assetLevels: any[]) => {
    // Construire une carte des types d'énergie pour chaque asset
    const energyMap: { [assetPath: string]: string } = {};
    variables.forEach(v => {
      if (v.name.includes('_TypeEnergie') && v.units) {
        energyMap[v.assetPath] = v.units;
      }
    });
    
    // Construire une carte des relations parent-enfant
    const parentChildMap: { [parentPath: string]: string[] } = {};
    assetLevels.forEach(level => {
      level.nodes.forEach((asset: any) => {
        const parentPath = asset.parentPath;
        if (parentPath) {
          if (!parentChildMap[parentPath]) {
            parentChildMap[parentPath] = [];
          }
          parentChildMap[parentPath].push(asset.fullPath);
        }
      });
    });
    
    // Fonction récursive pour vérifier si un type d'énergie existe dans les descendants
    const hasEnergyTypeInDescendants = (assetPath: string, energyType: string, visited = new Set<string>()): boolean => {
      if (visited.has(assetPath)) return false; // Éviter les boucles infinies
      visited.add(assetPath);
      
      // Vérifier les enfants directs
      const children = parentChildMap[assetPath] || [];
      for (const childPath of children) {
        // Si l'enfant a ce type d'énergie
        if (energyMap[childPath] === energyType) {
          return true;
        }
        
        // Vérifier récursivement
        if (hasEnergyTypeInDescendants(childPath, energyType, visited)) {
          return true;
        }
      }
      
      return false;
    };
    
    // Mettre à jour les variables booléennes
    variables.forEach(v => {
      if (v.dataType === 'Boolean' && v.name.includes('_is')) {
        const energyType = v.name.split('_is')[1];
        const hasType = hasEnergyTypeInDescendants(v.assetPath, energyType, new Set());
        v.units = hasType ? 'true' : 'false';
      }
    });
  };

  // Fonction pour finaliser la prévisualisation
  const handlePreviewComplete = () => {
    // Ajoutons un message et animation de chargement pendant la transition
    toast.loading('Préparation des variables...', {
      id: 'preview-transition'
    });
    
    // Attendre un court instant pour que l'utilisateur perçoive l'action
    setTimeout(() => {
      // Passer à l'étape suivante
      setStep('review');
      
      // Mise à jour du toast pour confirmer l'action
      toast.success(`${previewVariables.length} variables ont été préparées. Cliquez sur "Terminer" pour confirmer.`, {
        id: 'preview-transition',
        duration: 4000
      });
    }, 500);
  };

  // Fonction pour valider et fermer
  const handleWizardComplete = () => {
    // Notifier le parent composant avec les variables finales
    onVariablesPreview(previewVariables);
    setShowSuccessMessage(true);
    
    // Notification immédiate dans l'interface modale
    toast.loading('Finalisation des variables...', {
      id: 'wizard-complete'
    });
    
    // Fermer la fenêtre après un court délai pour que l'utilisateur puisse voir le message
    setTimeout(() => {
      // Mise à jour du toast avec message de succès
      toast.success(`${previewVariables.length} variables d'énergie ont été ajoutées avec succès`, {
        id: 'wizard-complete',
        duration: 5000,
      });
      
      // Fermer le modal
      setTimeout(() => {
        onClose();
        
        // Notification finale avec action pour voir les variables
        toast.success(`${previewVariables.length} variables d'énergie sont maintenant disponibles dans l'onglet "Variables"`, {
          duration: 8000,
          action: {
            label: "Voir variables",
            onClick: () => document.getElementById("variable-preview-tab")?.click()
          }
        });
      }, 1000);
    }, 1000);
  };

  // Fonction pour ajouter un niveau supplémentaire
  const handleAddLevel = () => {
    setMaxLevelCount(prev => prev + 1);
  };

  // Fonction pour retirer un niveau
  const handleRemoveLevel = () => {
    if (maxLevelCount > 1) {
      setMaxLevelCount(prev => prev - 1);
      // Supprimer également le mapping du dernier niveau s'il existe
      setLevelMappings(prev => {
        const newMappings = { ...prev };
        delete newMappings[maxLevelCount - 1];
        return newMappings;
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[80vh] my-12 overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Création de Variables d'Énergie</DialogTitle>
        </DialogHeader>

        {/* Indicateur de progression */}
        <div className="flex items-center mb-6">
          <div className={`flex items-center justify-center w-8 h-8 rounded-full ${step === 'import' ? 'bg-primary text-primary-foreground' : 'bg-primary/20 text-primary'}`}>
            <FileSpreadsheet size={18} />
          </div>
          <div className={`h-1 w-16 ${step === 'import' ? 'bg-primary/30' : 'bg-primary'}`}></div>
          <div className={`flex items-center justify-center w-8 h-8 rounded-full ${step === 'mapping' ? 'bg-primary text-primary-foreground' : step === 'import' ? 'bg-primary/20 text-primary' : 'bg-primary/20 text-primary'}`}>
            <Grid3X3 size={18} />
          </div>
          <div className={`h-1 w-16 ${step === 'import' || step === 'mapping' ? 'bg-primary/30' : 'bg-primary'}`}></div>
          <div className={`flex items-center justify-center w-8 h-8 rounded-full ${step === 'preview' ? 'bg-primary text-primary-foreground' : step === 'review' ? 'bg-primary' : 'bg-primary/20 text-primary'}`}>
            <Eye size={18} />
          </div>
          <div className={`h-1 w-16 ${step === 'review' ? 'bg-primary' : 'bg-primary/30'}`}></div>
          <div className={`flex items-center justify-center w-8 h-8 rounded-full ${step === 'review' ? 'bg-primary text-primary-foreground' : 'bg-primary/20 text-primary'}`}>
            <Check size={18} />
          </div>
        </div>

        {/* Contenu spécifique à chaque étape */}
        {step === 'import' && (
          <div className="space-y-6">
            <div className="text-center mb-4">
              <h3 className="text-lg font-medium">Importer un fichier Excel</h3>
              <p className="text-sm text-muted-foreground">
                Importez votre fichier Excel contenant la hiérarchie d'assets et les types d'énergie
              </p>
            </div>
            
            <ExcelDropzone onDataParsed={handleExcelDataParsed} />
          </div>
        )}

        {step === 'mapping' && importedData && (
          <div className="space-y-6">
            <div className="text-center mb-4">
              <h3 className="text-lg font-medium">Configuration du Mapping</h3>
              <p className="text-sm text-muted-foreground">
                Mappez les colonnes Excel aux niveaux de la hiérarchie et sélectionnez la colonne de type d'énergie
              </p>
            </div>
            
            <div className="space-y-6 mt-6">
              <div className="border p-4 rounded-md">
                <h4 className="font-medium mb-2">Colonnes disponibles</h4>
                <div className="grid grid-cols-3 gap-2">
                  {importedData.headers.map((header, index) => (
                    <div key={index} className="text-sm border px-2 py-1 rounded bg-muted/50">
                      {header}
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="grid gap-6">
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-medium">Mapping des Niveaux</h4>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleAddLevel}
                        title="Ajouter un niveau"
                      >
                        + Ajouter niveau
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleRemoveLevel}
                        disabled={maxLevelCount <= 1}
                        title="Retirer un niveau"
                      >
                        - Retirer niveau
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Associez chaque niveau à une colonne Excel
                  </p>
                  
                  {/* Utiliser un nombre dynamique de niveaux basé sur maxLevelCount */}
                  {Array.from({ length: maxLevelCount }, (_, i) => i).map(level => (
                    <div key={level} className="flex items-center gap-4 mb-2">
                      <Label className="w-24">Niveau {level}</Label>
                      <Select
                        value={levelMappings[level] || ''}
                        onValueChange={(value) => setLevelMappings({...levelMappings, [level]: value})}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Sélectionner une colonne" />
                        </SelectTrigger>
                        <SelectContent>
                          {importedData.headers.map((header, index) => (
                            <SelectItem key={index} value={header}>{header}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">Colonne de Type d'Énergie</h4>
                  <div className="flex items-center gap-4">
                    <Select
                      value={energyColumn || ''}
                      onValueChange={(value) => setEnergyColumn(value)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Sélectionner la colonne de type d'énergie" />
                      </SelectTrigger>
                      <SelectContent>
                        {importedData.headers.map((header, index) => (
                          <SelectItem key={index} value={header}>{header}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    {autoDetectedEnergyColumn && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="text-sm text-blue-500 flex items-center">
                              <Info size={16} className="mr-1" />
                              Détecté
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Colonne détectée automatiquement: {autoDetectedEnergyColumn}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end mt-4">
              <Button onClick={handleMappingCreated}>
                Continuer
                <ArrowRight className="ml-2" size={16} />
              </Button>
            </div>
          </div>
        )}

        {step === 'preview' && importedData && mapping && (
          <div className="space-y-6">
            <div className="text-center mb-4">
              <h3 className="text-lg font-medium">Prévisualisation des Variables</h3>
              <p className="text-sm text-muted-foreground">
                Voici les variables qui seront créées en fonction de votre configuration
              </p>
            </div>
            
            <div className="border rounded-md overflow-hidden">
              <div className="grid grid-cols-5 gap-2 p-3 bg-muted/50 font-medium text-sm">
                <div>Niveau</div>
                <div>Asset</div>
                <div>Variable</div>
                <div>Type</div>
                <div>Valeur</div>
              </div>
              
              <div className="max-h-[40vh] overflow-y-auto">
                {previewVariables.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    Aucune variable générée. Vérifiez votre configuration.
                  </div>
                ) : (
                  previewVariables.map((variable, index) => (
                    <div 
                      key={index} 
                      className={`grid grid-cols-5 gap-2 p-2 text-sm ${index % 2 === 0 ? 'bg-muted/20' : ''}`}
                    >
                      <div>Niveau {variable.level}</div>
                      <div title={variable.assetPath} className="truncate">
                        {variable.assetPath.split('@').pop()}
                      </div>
                      <div title={variable.name} className="truncate">{variable.name}</div>
                      <div>{variable.dataType}</div>
                      <div>{variable.units}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
            
            <div className="flex justify-between mt-4">
              <Button variant="outline" onClick={() => setStep('mapping')}>
                Retour
              </Button>
              <Button onClick={handlePreviewComplete}>
                Continuer
                <ArrowRight className="ml-2" size={16} />
              </Button>
            </div>
          </div>
        )}

        {step === 'review' && (
          <div className="space-y-6">
            <div className="text-center mb-4">
              <h3 className="text-lg font-medium">Récapitulatif</h3>
              <p className="text-sm text-muted-foreground">
                Configuration terminée. Les variables suivantes seront créées.
              </p>
            </div>
            
            <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-md p-4">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                <Check size={20} />
                <span className="font-medium">Configuration réussie</span>
              </div>
              <p className="text-sm mt-2 text-green-700/80 dark:text-green-400/80">
                {previewVariables.length} variables d'énergie ont été configurées et sont prêtes à être ajoutées.
              </p>
            </div>
            
            <div className="space-y-2">
              <div className="text-sm font-medium">Résumé des variables par niveau:</div>
              {Array.from(new Set(previewVariables.map(v => v.level))).sort((a, b) => a - b).map(level => {
                const typeEnergieCount = previewVariables.filter(v => v.level === level && v.name.includes('_TypeEnergie')).length;
                const booleanCount = previewVariables.filter(v => v.level === level && v.dataType === 'Boolean').length;
                
                return (
                  <div key={level} className="flex justify-between text-sm bg-muted/30 p-2 rounded">
                    <span>Niveau {level}</span>
                    <span className="text-muted-foreground">
                      {typeEnergieCount > 0 ? `${typeEnergieCount} variables TypeEnergie` : ''}
                      {typeEnergieCount > 0 && booleanCount > 0 ? ' • ' : ''}
                      {booleanCount > 0 ? `${booleanCount} variables booléennes` : ''}
                    </span>
                  </div>
                );
              })}
            </div>

            {showSuccessMessage && (
              <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md animate-pulse">
                <p className="text-center text-green-600 dark:text-green-400 font-medium">
                  Variables ajoutées avec succès!
                </p>
                <p className="text-center text-green-500 dark:text-green-500 text-sm mt-1">
                  Les variables sont maintenant disponibles dans l'onglet "Variable Preview".
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 'review' ? (
            <Button onClick={handleWizardComplete} disabled={showSuccessMessage}>
              Terminer et ajouter les variables
            </Button>
          ) : (
            <Button variant="outline" onClick={onClose}>Annuler</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 