'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useAggregationStore, Aggregation, AggregationMethod, AggregationTimeframe } from '@/store/aggregationStore';
import { useVariableStore, Variable } from '@/store/variableStore';
import { createApiClient } from '@/lib/apiClient';
import { useAuth } from '@/context/AuthContext';
import { Loader2, Filter, ChevronDown, ChevronUp, Check, RefreshCw } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface BulkAggregationModalProps {
  open: boolean;
  onClose: () => void;
}

// Fonction helper pour générer un nom d'agrégation
const generateAggregationName = (variableName: string, method: AggregationMethod, timeframe: AggregationTimeframe): string => {
  const methodMap: Record<AggregationMethod, string> = {
    'avg': 'Moy',
    'sum': 'Sum',
    'min': 'Min',
    'max': 'Max',
    'count': 'Count',
    'first': 'First',
    'last': 'Last'
  };
  
  const timeframeMap: Record<AggregationTimeframe, string> = {
    '1m': '1min',
    '5m': '5min',
    '15m': '15min',
    '30m': '30min',
    '1h': '1h',
    '4h': '4h',
    '12h': '12h',
    '1d': '1j',
    '1w': '1sem',
    '1mo': '1mois'
  };
  
  return `${variableName}_${methodMap[method]}_${timeframeMap[timeframe]}`;
};

export function BulkAggregationModal({ open, onClose }: BulkAggregationModalProps) {
  const { token, apiUrl } = useAuth();
  const { addAggregation } = useAggregationStore();
  const { previewVariables } = useVariableStore();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionProgress, setSubmissionProgress] = useState(0);
  const [totalToSubmit, setTotalToSubmit] = useState(0);
  
  // État pour les filtres
  const [showFilters, setShowFilters] = useState(false);
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [selectedLevels, setSelectedLevels] = useState<number[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // État pour les variables sélectionnées
  const [selectedVariables, setSelectedVariables] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  
  // État pour la configuration d'agrégation
  const [aggregationMethod, setAggregationMethod] = useState<AggregationMethod>('avg');
  const [aggregationTimeframe, setAggregationTimeframe] = useState<AggregationTimeframe>('1h');
  const [generateNames, setGenerateNames] = useState(true);
  const [prefix, setPrefix] = useState('');
  const [suffix, setSuffix] = useState('');
  
  // Pour prévisualiser les noms générés
  const [previewName, setPreviewName] = useState('');
  
  // Listes des valeurs uniques pour les filtres
  const uniqueAssets = Array.from(new Set(previewVariables.map(v => {
    if (v.assetPath) {
      const parts = v.assetPath.split('@');
      return parts[parts.length - 1];
    }
    // Fallback pour les variables sans assetPath
    return v.assetId ? v.assetId.split('-')[0] : 'Unknown';
  }))).sort();
  
  const uniqueLevels = Array.from(new Set(
    previewVariables
      .filter(v => typeof v.level === 'number')
      .map(v => v.level)
  )).sort((a, b) => a - b);
  
  const uniqueTypes = Array.from(new Set(previewVariables.map(v => {
    // Détecter le type de variable basé sur son nom ou ses caractéristiques
    if (v.name.includes('_TypeEnergie')) return 'Type Énergie';
    if (v.name.includes('_isElec') || v.name.includes('_isGaz') || 
        v.name.includes('_isEau') || v.name.includes('_isAir')) 
      return 'Drapeau Énergie';
    return v.dataType; // Fallback au type de données
  }))).sort();
  
  // Récupérer les variables avec leurs propriétés enrichies
  const getEnrichedVariables = (): { id: string, name: string, type?: string, asset?: string }[] => {
    return previewVariables.map(v => ({
      id: v.id || v.name,
      name: v.name,
      type: v.dataType,
      asset: v.assetPath ? v.assetPath.split('@').pop() || '' : ''
    }));
  };
  
  // Filtrer les variables selon les critères sélectionnés
  const filteredVariables = getEnrichedVariables().filter(variable => {
    // Recherche textuelle
    if (searchTerm && !variable.name.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    
    // Trouver la variable originale pour accéder à ses propriétés complètes
    const originalVar = previewVariables.find(v => (v.id || v.name) === variable.id);
    if (!originalVar) return false;
    
    // Filtre par asset
    if (selectedAssets.length > 0) {
      const assetName = originalVar.assetPath ? 
        originalVar.assetPath.split('@').pop() : 
        originalVar.assetId ? originalVar.assetId.split('-')[0] : '';
      
      if (!assetName || !selectedAssets.includes(assetName)) {
        return false;
      }
    }
    
    // Filtre par niveau
    if (selectedLevels.length > 0 && 
        (typeof originalVar.level !== 'number' || !selectedLevels.includes(originalVar.level))) {
      return false;
    }
    
    // Filtre par type
    if (selectedTypes.length > 0) {
      const type = originalVar.name.includes('_TypeEnergie') 
        ? 'Type Énergie' 
        : originalVar.name.includes('_isElec') || originalVar.name.includes('_isGaz') || 
          originalVar.name.includes('_isEau') || originalVar.name.includes('_isAir')
          ? 'Drapeau Énergie'
          : originalVar.dataType;
          
      if (!selectedTypes.includes(type)) {
        return false;
      }
    }
    
    return true;
  });
  
  // Mise à jour de la sélection quand les filtres changent
  useEffect(() => {
    if (selectAll && filteredVariables.length > 0) {
      // Au lieu de mettre à jour directement l'état, utiliser un timeout pour éviter les problèmes de rendu
      const timer = setTimeout(() => {
        setSelectedVariables(filteredVariables.map(v => v.id));
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [filteredVariables, selectAll]);
  
  // Mise à jour de l'aperçu du nom
  useEffect(() => {
    if (filteredVariables.length > 0 && selectedVariables.length > 0) {
      const sampleVariableId = selectedVariables[0];
      const sampleVariable = getEnrichedVariables().find(v => v.id === sampleVariableId);
      
      if (sampleVariable) {
        const generatedName = generateAggregationName(sampleVariable.name, aggregationMethod, aggregationTimeframe);
        const formattedName = generateNames 
          ? prefix + generatedName + suffix
          : `${sampleVariable.name}_${aggregationMethod}_${aggregationTimeframe}`;
        setPreviewName(formattedName);
      }
    }
  }, [selectedVariables, aggregationMethod, aggregationTimeframe, generateNames, prefix, suffix]);
  
  // Gestion de sélection/désélection de toutes les variables
  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    
    // Utiliser setTimeout pour éviter les problèmes de rendu avec ScrollArea
    // lors de la sélection d'un grand nombre d'éléments
    if (checked) {
      const batchSize = 100; // Traiter par lots pour éviter de surcharger le rendu
      const variableIds = filteredVariables.map(v => v.id);
      
      if (variableIds.length <= batchSize) {
        // Si peu d'éléments, mettre à jour directement
        setSelectedVariables(variableIds);
      } else {
        // Pour un grand nombre, traiter par lots avec un léger délai
        setSelectedVariables([]); // Réinitialiser d'abord
        
        // Fonction pour ajouter un lot
        const addBatch = (startIndex: number) => {
          setTimeout(() => {
            setSelectedVariables(prev => {
              const endIndex = Math.min(startIndex + batchSize, variableIds.length);
              const batch = variableIds.slice(startIndex, endIndex);
              return [...prev, ...batch];
            });
            
            // Continuer avec le prochain lot si nécessaire
            if (startIndex + batchSize < variableIds.length) {
              addBatch(startIndex + batchSize);
            }
          }, 10);
        };
        
        // Démarrer le traitement par lots
        addBatch(0);
      }
    } else {
      setSelectedVariables([]);
    }
  };
  
  // Gestion de la sélection d'une variable
  const handleSelectVariable = (checked: boolean, variableId: string) => {
    if (checked) {
      setSelectedVariables(prev => [...prev, variableId]);
    } else {
      setSelectedVariables(prev => prev.filter(id => id !== variableId));
      // Si on désélectionne une variable, désactiver selectAll
      if (selectAll) {
        setSelectAll(false);
      }
    }
  };
  
  // Créer les agrégations en masse
  const handleSubmit = async () => {
    if (selectedVariables.length === 0) {
      toast.error('Veuillez sélectionner au moins une variable');
      return;
    }
    
    if (!token || !apiUrl) {
      toast.error('Vous devez être connecté pour créer des agrégations');
      return;
    }
    
    setIsSubmitting(true);
    setSubmissionProgress(0);
    setTotalToSubmit(selectedVariables.length);
    
    const apiClient = createApiClient(token, apiUrl);
    const aggregationsCreated: Aggregation[] = [];
    let successCount = 0;
    let errorCount = 0;
    
    try {
      // Récupérer toutes les variables actives une fois pour la recherche
      const allActiveVariables = getEnrichedVariables();
      
      // Traiter chaque variable sélectionnée
      for (let i = 0; i < selectedVariables.length; i++) {
        const variableId = selectedVariables[i];
        const variable = allActiveVariables.find(v => v.id === variableId);
        
        if (!variable) continue;
        
        // Générer le nom de l'agrégation
        const baseName = generateAggregationName(variable.name, aggregationMethod, aggregationTimeframe);
        const aggregationName = generateNames ? prefix + baseName + suffix : baseName;
        
        // Préparer les données pour l'API
        const aggregationData = {
          "$concept": "aggregation",
          "$abstraction": "instance",
          "$name": aggregationName,
          "$description": `Agrégation automatique de ${variable.name} (${aggregationMethod}, ${aggregationTimeframe})`,
          "sourceVariable": variable.name, // Utiliser le nom de la variable comme référence
          "method": aggregationMethod,
          "timeframe": aggregationTimeframe,
          "enabled": true
        };
        
        try {
          // Créer l'agrégation via l'API
          const response = await apiClient.post('/DataService/anchor-ex/v1/aggregations', aggregationData);
          
          // Récupérer l'ID généré
          const newId = response.data.id || `temp-${Date.now()}-${i}`;
          
          // Créer l'objet agrégation pour le store
          const newAggregation: Aggregation = {
            id: newId,
            name: aggregationName,
            sourceVariableId: variable.id,
            sourceVariableName: variable.name,
            method: aggregationMethod,
            timeframe: aggregationTimeframe,
            description: `Agrégation automatique de ${variable.name} (${aggregationMethod}, ${aggregationTimeframe})`,
            enabled: true,
            status: 'pending',
            createdAt: new Date().toISOString()
          };
          
          // Ajouter l'agrégation au store
          addAggregation(newAggregation);
          aggregationsCreated.push(newAggregation);
          successCount++;
        } catch (error) {
          console.error(`Erreur lors de la création de l'agrégation pour ${variable.name}:`, error);
          errorCount++;
        }
        
        // Mettre à jour la progression
        setSubmissionProgress(Math.round(((i + 1) / selectedVariables.length) * 100));
      }
      
      // Afficher un toast de succès
      if (successCount > 0) {
        toast.success(`${successCount} agrégations créées avec succès`, {
          description: errorCount > 0 ? `${errorCount} erreurs se sont produites` : undefined
        });
      } else if (errorCount > 0) {
        toast.error(`Aucune agrégation créée, ${errorCount} erreurs se sont produites`);
      }
      
      // Fermer le modal
      onClose();
    } catch (error) {
      console.error('Erreur globale lors de la création des agrégations:', error);
      toast.error('Une erreur s\'est produite lors de la création des agrégations');
    } finally {
      setIsSubmitting(false);
    }
  };

  const aggregationMethods: { value: AggregationMethod; label: string }[] = [
    { value: 'avg', label: 'Moyenne' },
    { value: 'sum', label: 'Somme' },
    { value: 'min', label: 'Minimum' },
    { value: 'max', label: 'Maximum' },
    { value: 'count', label: 'Comptage' },
    { value: 'first', label: 'Première valeur' },
    { value: 'last', label: 'Dernière valeur' },
  ];

  const aggregationTimeframes: { value: AggregationTimeframe; label: string }[] = [
    { value: '1m', label: '1 minute' },
    { value: '5m', label: '5 minutes' },
    { value: '15m', label: '15 minutes' },
    { value: '30m', label: '30 minutes' },
    { value: '1h', label: '1 heure' },
    { value: '4h', label: '4 heures' },
    { value: '12h', label: '12 heures' },
    { value: '1d', label: '1 jour' },
    { value: '1w', label: '1 semaine' },
    { value: '1mo', label: '1 mois' },
  ];
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[900px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Créer des agrégations en masse</DialogTitle>
          <DialogDescription>
            Créez plusieurs agrégations simultanément pour vos variables.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="select" className="flex-grow overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="select">Sélection des variables</TabsTrigger>
            <TabsTrigger value="configure">Configuration des agrégations</TabsTrigger>
          </TabsList>
          
          <TabsContent value="select" className="flex-grow overflow-hidden flex flex-col">
            <div>
              <div className="mb-4 py-2 px-4 bg-muted/30 rounded-md text-sm">
                <p>Sélectionnez les variables pour lesquelles vous souhaitez créer des agrégations.</p>
                <p className="mt-1 text-muted-foreground">{previewVariables.length} variables disponibles</p>
              </div>
            </div>
            
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="selectAll" 
                  checked={selectAll}
                  onCheckedChange={handleSelectAll}
                />
                <Label htmlFor="selectAll">
                  Tout sélectionner ({filteredVariables.length})
                  {selectedVariables.length > 0 && selectedVariables.length !== filteredVariables.length && 
                    ` - ${selectedVariables.length} sélectionnées`}
                </Label>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Filtres
                  {showFilters ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
                </Button>
              </div>
            </div>
            
            <Collapsible open={showFilters} onOpenChange={setShowFilters}>
              <CollapsibleContent>
                <div className="border rounded-md p-4 mb-4 space-y-4">
                  <h3 className="font-medium">Filtres</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="searchTerm">Recherche</Label>
                      <Input 
                        id="searchTerm"
                        placeholder="Rechercher..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <Label>Niveaux</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {uniqueLevels.map(level => (
                          <Badge 
                            key={level} 
                            variant={selectedLevels.includes(level) ? "default" : "outline"}
                            className="cursor-pointer"
                            onClick={() => {
                              setSelectedLevels(prev => 
                                prev.includes(level) 
                                  ? prev.filter(l => l !== level) 
                                  : [...prev, level]
                              );
                            }}
                          >
                            Niveau {level}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <Label>Types</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {uniqueTypes.map(type => (
                          <Badge 
                            key={type} 
                            variant={selectedTypes.includes(type) ? "default" : "outline"}
                            className="cursor-pointer"
                            onClick={() => {
                              setSelectedTypes(prev => 
                                prev.includes(type) 
                                  ? prev.filter(t => t !== type) 
                                  : [...prev, type]
                              );
                            }}
                          >
                            {type}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <Label>Assets</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {uniqueAssets.length > 10 ? (
                        <Select 
                          value={selectedAssets.length === 1 ? selectedAssets[0] : ""} 
                          onValueChange={(value) => {
                            if (value) setSelectedAssets([value]);
                            else setSelectedAssets([]);
                          }}
                        >
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Sélectionner un asset" />
                          </SelectTrigger>
                          <SelectContent>
                            {uniqueAssets.map(asset => (
                              <SelectItem key={asset} value={asset}>
                                {asset}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        uniqueAssets.map(asset => (
                          <Badge 
                            key={asset} 
                            variant={selectedAssets.includes(asset) ? "default" : "outline"}
                            className="cursor-pointer"
                            onClick={() => {
                              setSelectedAssets(prev => 
                                prev.includes(asset) 
                                  ? prev.filter(a => a !== asset) 
                                  : [...prev, asset]
                              );
                            }}
                          >
                            {asset}
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
            
            <div className="text-sm mb-2">
              {selectedVariables.length} variables sélectionnées sur {filteredVariables.length} filtrées
              {previewVariables.length === 0 && (
                <span className="text-muted-foreground ml-1">
                  Aucune variable n'est disponible. Utilisez le bouton "Retrieve assets & variables" dans l'onglet Agrégation.
                </span>
              )}
            </div>
            
            <ScrollArea className="flex-grow border rounded-md">
              <div className="p-1">
                {previewVariables.length === 0 ? (
                  <div className="text-center p-4 text-muted-foreground">
                    Aucune variable disponible
                  </div>
                ) : filteredVariables.length === 0 ? (
                  <div className="text-center p-4 text-muted-foreground">
                    Aucune variable ne correspond aux critères sélectionnés
                  </div>
                ) : filteredVariables.length > 300 && selectAll ? (
                  // Afficher un message spécial pour éviter de rendre trop d'éléments quand tout est sélectionné
                  <div className="p-4">
                    <p className="text-center mb-2 font-medium">
                      {selectedVariables.length} variables sélectionnées
                    </p>
                    <p className="text-sm text-muted-foreground text-center">
                      La liste est masquée car un grand nombre d'éléments est sélectionné.
                      <br/>
                      Désélectionnez "Tout sélectionner" pour voir et modifier la sélection.
                    </p>
                  </div>
                ) : (
                  // Sinon, afficher jusqu'à 300 variables pour maintenir de bonnes performances
                  filteredVariables.slice(0, 300).map((variable, index) => (
                    <div 
                      key={`${variable.id}-${index}`} 
                      className={`flex items-center space-x-2 p-2 ${index % 2 === 0 ? 'bg-muted/40' : ''} rounded-md`}
                    >
                      <Checkbox 
                        id={`variable-${index}`} 
                        checked={selectedVariables.includes(variable.id)}
                        onCheckedChange={(checked) => handleSelectVariable(!!checked, variable.id)}
                      />
                      <Label htmlFor={`variable-${index}`} className="flex-grow">
                        <div className="font-medium">{variable.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {variable.type && `${variable.type} | `}
                          {variable.asset && `Asset: ${variable.asset}`}
                        </div>
                      </Label>
                    </div>
                  ))
                )}
                {filteredVariables.length > 300 && !selectAll && (
                  <div className="p-2 text-center text-sm text-muted-foreground">
                    {filteredVariables.length - 300} variables supplémentaires non affichées.
                    <br/>
                    Utilisez les filtres pour affiner la liste ou "Tout sélectionner".
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="configure" className="flex-grow overflow-auto">
            <div className="space-y-6 py-4">
              <div className="space-y-4">
                <h3 className="font-medium">Configuration des agrégations pour {selectedVariables.length} variables</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="method">Méthode d'agrégation</Label>
                    <Select 
                      value={aggregationMethod} 
                      onValueChange={(value) => setAggregationMethod(value as AggregationMethod)}
                    >
                      <SelectTrigger id="method">
                        <SelectValue placeholder="Sélectionner une méthode" />
                      </SelectTrigger>
                      <SelectContent>
                        {aggregationMethods.map((method) => (
                          <SelectItem key={method.value} value={method.value}>
                            {method.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="timeframe">Période d'agrégation</Label>
                    <Select 
                      value={aggregationTimeframe} 
                      onValueChange={(value) => setAggregationTimeframe(value as AggregationTimeframe)}
                    >
                      <SelectTrigger id="timeframe">
                        <SelectValue placeholder="Sélectionner une période" />
                      </SelectTrigger>
                      <SelectContent>
                        {aggregationTimeframes.map((timeframe) => (
                          <SelectItem key={timeframe.value} value={timeframe.value}>
                            {timeframe.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center space-x-2 mb-4">
                    <Checkbox 
                      id="generateNames" 
                      checked={generateNames}
                      onCheckedChange={(checked) => setGenerateNames(!!checked)}
                    />
                    <Label htmlFor="generateNames">
                      Générer automatiquement les noms d'agrégation
                    </Label>
                  </div>
                  
                  {generateNames && (
                    <div className="border rounded-md p-4 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="prefix">Préfixe</Label>
                          <Input 
                            id="prefix"
                            placeholder="Préfixe"
                            value={prefix}
                            onChange={(e) => setPrefix(e.target.value)}
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="suffix">Suffixe</Label>
                          <Input 
                            id="suffix"
                            placeholder="Suffixe"
                            value={suffix}
                            onChange={(e) => setSuffix(e.target.value)}
                          />
                        </div>
                      </div>
                      
                      {selectedVariables.length > 0 && (
                        <div>
                          <Label>Aperçu du nom généré</Label>
                          <div className="border rounded-md p-2 mt-1 bg-muted/40 font-mono text-sm">
                            {previewName}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Exemple basé sur la première variable sélectionnée
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {isSubmitting && (
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progression</span>
                  <span>{submissionProgress}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2.5">
                  <div 
                    className="bg-primary h-2.5 rounded-full" 
                    style={{ width: `${submissionProgress}%` }}
                  ></div>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || selectedVariables.length === 0}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Création en cours...
              </>
            ) : (
              <>Créer {selectedVariables.length} agrégation(s)</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 