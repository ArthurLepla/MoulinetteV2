'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useAggregationStore, Aggregation, AggregationMethod, AggregationTimeframe } from '@/store/aggregationStore';
import { useVariableStore } from '@/store/variableStore';
import { createApiClient } from '@/lib/apiClient';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AggregationModalProps {
  open: boolean;
  onClose: () => void;
  aggregationToEdit?: Aggregation | null;
}

export function AggregationModal({ open, onClose, aggregationToEdit }: AggregationModalProps) {
  const { token, apiUrl } = useAuth();
  const { addAggregation, updateAggregation } = useAggregationStore();
  const { previewVariables } = useVariableStore();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [form, setForm] = useState<Omit<Aggregation, 'id' | 'status' | 'createdAt' | 'lastUpdatedAt' | 'errorMessage'>>({
    name: '',
    sourceVariableId: '',
    sourceVariableName: '',
    method: 'avg',
    timeframe: '1h',
    description: '',
    enabled: true,
  });

  // Initialiser le formulaire avec les valeurs de l'agrégation à éditer
  useEffect(() => {
    if (aggregationToEdit) {
      setForm({
        name: aggregationToEdit.name,
        sourceVariableId: aggregationToEdit.sourceVariableId,
        sourceVariableName: aggregationToEdit.sourceVariableName || '',
        method: aggregationToEdit.method,
        timeframe: aggregationToEdit.timeframe,
        description: aggregationToEdit.description || '',
        enabled: aggregationToEdit.enabled,
      });
    } else {
      // Réinitialiser le formulaire pour une nouvelle agrégation
      setForm({
        name: '',
        sourceVariableId: '',
        sourceVariableName: '',
        method: 'avg',
        timeframe: '1h',
        description: '',
        enabled: true,
      });
    }
  }, [aggregationToEdit, open]);

  // Mettre à jour le sourceVariableName lorsque sourceVariableId change
  useEffect(() => {
    if (form.sourceVariableId) {
      // Chercher dans les variables
      const variable = previewVariables.find(v => v.name === form.sourceVariableId || v.id === form.sourceVariableId);
      if (variable) {
        setForm(prev => ({ ...prev, sourceVariableName: variable.name }));
      }
    }
  }, [form.sourceVariableId, previewVariables]);

  const handleChange = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    // Validation de base
    if (!form.name.trim()) {
      toast.error('Le nom est requis');
      return;
    }

    if (!form.sourceVariableId) {
      toast.error('Veuillez sélectionner une variable source');
      return;
    }

    setIsSubmitting(true);

    try {
      if (!token || !apiUrl) {
        throw new Error('Vous devez être connecté pour créer une agrégation');
      }

      const apiClient = createApiClient(token, apiUrl);
      
      // Préparer les données pour l'API Anchor
      const aggregationData = {
        "$concept": "aggregation",
        "$abstraction": "instance",
        "$name": form.name,
        "$description": form.description,
        "sourceVariable": form.sourceVariableId,
        "method": form.method,
        "timeframe": form.timeframe,
        "enabled": form.enabled
      };

      // Si c'est une mise à jour, utiliser PATCH, sinon POST
      let response;
      if (aggregationToEdit?.id) {
        // Mettre à jour une agrégation existante via l'API Anchor
        response = await apiClient.patch(`/DataService/anchor-ex/v1/aggregations/${aggregationToEdit.id}`, aggregationData);
        
        // Mettre à jour dans le store
        updateAggregation(aggregationToEdit.id, {
          ...form,
          lastUpdatedAt: new Date().toISOString()
        });
        
        toast.success('Agrégation mise à jour avec succès');
      } else {
        // Créer une nouvelle agrégation via l'API Anchor
        response = await apiClient.post('/DataService/anchor-ex/v1/aggregations', aggregationData);
        
        // Récupérer l'ID généré
        const newId = response.data.id || `temp-${Date.now()}`;
        
        // Ajouter au store
        addAggregation({
          ...form,
          id: newId,
          status: 'pending',
          createdAt: new Date().toISOString()
        });
        
        toast.success('Agrégation créée avec succès');
      }

      // Fermer le modal
      onClose();
    } catch (error) {
      console.error('Erreur lors de la création/mise à jour de l\'agrégation:', error);
      toast.error('Erreur lors de la création/mise à jour de l\'agrégation');
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
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>{aggregationToEdit ? 'Modifier l\'agrégation' : 'Créer une nouvelle agrégation'}</DialogTitle>
          <DialogDescription>
            Les agrégations permettent de traiter les données de variables sur différentes périodes de temps.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Nom
            </Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className="col-span-3"
            />
          </div>
          
          <div className="grid grid-cols-4 items-start gap-4">
            <Label className="text-right pt-2">
              Variable source
            </Label>
            <div className="col-span-3">
              {previewVariables.length === 0 ? (
                <div className="text-center p-4 text-sm text-muted-foreground">
                  Aucune variable disponible. Utilisez le bouton "Retrieve assets & variables" dans l'onglet Agrégation.
                </div>
              ) : (
                <Select 
                  value={form.sourceVariableId} 
                  onValueChange={(value) => handleChange('sourceVariableId', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une variable" />
                  </SelectTrigger>
                  <SelectContent>
                    <ScrollArea className="h-[200px]">
                      {previewVariables.map((variable, index) => (
                        <SelectItem 
                          key={`${variable.id || variable.name}-${index}`} 
                          value={variable.id || variable.name}
                        >
                          {variable.name}
                        </SelectItem>
                      ))}
                    </ScrollArea>
                  </SelectContent>
                </Select>
              )}
              
              {form.sourceVariableName && (
                <div className="mt-2 text-sm font-medium">
                  Variable sélectionnée: {form.sourceVariableName}
                </div>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="method" className="text-right">
              Méthode
            </Label>
            <Select 
              value={form.method} 
              onValueChange={(value) => handleChange('method', value as AggregationMethod)}
            >
              <SelectTrigger className="col-span-3">
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
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="timeframe" className="text-right">
              Période
            </Label>
            <Select 
              value={form.timeframe} 
              onValueChange={(value) => handleChange('timeframe', value as AggregationTimeframe)}
            >
              <SelectTrigger className="col-span-3">
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
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="description" className="text-right">
              Description
            </Label>
            <Textarea
              id="description"
              value={form.description || ''}
              onChange={(e) => handleChange('description', e.target.value)}
              className="col-span-3"
              rows={3}
            />
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="enabled" className="text-right">
              Activée
            </Label>
            <div className="flex items-center space-x-2 col-span-3">
              <Switch
                id="enabled"
                checked={form.enabled}
                onCheckedChange={(checked) => handleChange('enabled', checked)}
              />
              <Label htmlFor="enabled">
                {form.enabled ? 'Oui' : 'Non'}
              </Label>
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {aggregationToEdit ? 'Mettre à jour' : 'Créer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 