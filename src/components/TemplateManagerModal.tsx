'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useVariableStore, AnchorTemplate, Variable } from '@/store/variableStore'; // Variable might not be needed here
import { Trash2, PlusCircle, Edit3 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface TemplateManagerModalProps {
  open: boolean;
  onClose: () => void;
}

const DATA_TYPES: Variable['dataType'][] = ['Double', 'Boolean', 'String', 'Integer'];

export function TemplateManagerModal({ open, onClose }: TemplateManagerModalProps) {
  const { templates, addTemplate, updateTemplate, deleteTemplate } = useVariableStore();
  const [isEditing, setIsEditing] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState<AnchorTemplate | null>(null);

  // Form state for new/editing template
  const [formLabel, setFormLabel] = useState('');
  const [formId, setFormId] = useState(''); // For editing existing
  const [formVariables, setFormVariables] = useState<{ suffix: string; dataType: Variable['dataType']; units?: string }[]>([]);

  const startNewTemplate = () => {
    setIsEditing(true);
    setCurrentTemplate(null);
    setFormId(uuidv4()); // Generate new ID for a new template
    setFormLabel('');
    setFormVariables([{ suffix: '', dataType: 'Double', units: '' }]);
  };

  const startEditTemplate = (template: AnchorTemplate) => {
    setIsEditing(true);
    setCurrentTemplate(template);
    setFormId(template.id);
    setFormLabel(template.label);
    setFormVariables([...template.variables]);
  };

  const handleVariableChange = (index: number, field: string, value: string) => {
    const newVars = [...formVariables];
    if (field === 'dataType') {
      newVars[index] = { ...newVars[index], [field]: value as Variable['dataType'] };
    } else {
      newVars[index] = { ...newVars[index], [field]: value };
    }
    setFormVariables(newVars);
  };

  const addVariableToForm = () => {
    setFormVariables([...formVariables, { suffix: '', dataType: 'Double', units: '' }]);
  };

  const removeVariableFromForm = (index: number) => {
    setFormVariables(formVariables.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!formLabel.trim() || !formId.trim()) {
      // Basic validation: ID and Label are required
      alert('Template ID and Label are required.'); // Replace with better notification
      return;
    }
    const templateToSave: AnchorTemplate = {
      id: formId,
      label: formLabel,
      variables: formVariables.map(v => ({...v, units: v.units?.trim() === '' ? undefined : v.units?.trim()})), // Ensure empty units are undefined
    };

    if (currentTemplate) {
      updateTemplate(templateToSave);
    } else {
      addTemplate(templateToSave);
    }
    setIsEditing(false);
    setCurrentTemplate(null);
  };

  const handleDeleteTemplate = (templateId: string) => {
    if (window.confirm('Are you sure you want to delete this template?')) {
      deleteTemplate(templateId);
      if (currentTemplate?.id === templateId) {
        setIsEditing(false);
        setCurrentTemplate(null);
      }
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) { setIsEditing(false); onClose(); } }}>
      <DialogContent className="sm:max-w-2xl md:max-w-3xl lg:max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{isEditing ? (currentTemplate ? 'Edit Template' : 'Create New Template') : 'Manage Anchor Templates'}</DialogTitle>
        </DialogHeader>

        {isEditing ? (
          // FORM VIEW for Add/Edit
          <div className="flex-grow overflow-y-auto pr-2 space-y-4 py-4">
            <div>
              <Label htmlFor="templateId">Template ID</Label>
              <Input id="templateId" value={formId} onChange={(e) => setFormId(e.target.value)} disabled={!!currentTemplate} placeholder="e.g., custom-energy-meter" />
              {!currentTemplate && <p className="text-xs text-muted-foreground">Unique ID. Will be auto-generated if left blank on creation, cannot be changed after.</p>}
            </div>
            <div>
              <Label htmlFor="templateLabel">Template Label</Label>
              <Input id="templateLabel" value={formLabel} onChange={(e) => setFormLabel(e.target.value)} placeholder="e.g., Custom Energy Meter (kWh, kW, A)" />
            </div>
            
            <h3 className="text-md font-semibold pt-2">Variables in Template</h3>
            <ScrollArea className="max-h-[calc(90vh-400px)] pr-3">
              {formVariables.map((variable, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-end border p-3 rounded-md mb-3">
                  <div className="col-span-4">
                    <Label htmlFor={`var-suffix-${index}`}>Suffix</Label>
                    <Input id={`var-suffix-${index}`} value={variable.suffix} onChange={(e) => handleVariableChange(index, 'suffix', e.target.value)} placeholder="_PowerFactor" />
                  </div>
                  <div className="col-span-3">
                    <Label htmlFor={`var-dataType-${index}`}>Data Type</Label>
                    <Select value={variable.dataType} onValueChange={(value) => handleVariableChange(index, 'dataType', value)}>
                      <SelectTrigger id={`var-dataType-${index}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DATA_TYPES.map(dt => <SelectItem key={dt} value={dt}>{dt}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-3">
                    <Label htmlFor={`var-units-${index}`}>Units (Optional)</Label>
                    <Input id={`var-units-${index}`} value={variable.units || ''} onChange={(e) => handleVariableChange(index, 'units', e.target.value)} placeholder="kWh, A, etc."/>
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <Button variant="ghost" size="icon" onClick={() => removeVariableFromForm(index)} className="text-destructive hover:text-destructive-foreground hover:bg-destructive/80">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </ScrollArea>
            <Button variant="outline" size="sm" onClick={addVariableToForm} className="mt-2">
              <PlusCircle className="mr-2 h-4 w-4" /> Add Variable
            </Button>
          </div>
        ) : (
          // LIST VIEW
          <ScrollArea className="flex-grow py-4 pr-2 max-h-[calc(90vh-200px)]">
            <div className="space-y-2">
              {templates.length === 0 && <p className="text-muted-foreground text-center py-4">No custom templates yet. Create one!</p>}
              {templates.map((template) => (
                <div key={template.id} className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/50">
                  <div>
                    <p className="font-semibold">{template.label}</p>
                    <p className="text-xs text-muted-foreground">ID: {template.id} &bull; {template.variables.length} variable(s)</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => startEditTemplate(template)}><Edit3 className="mr-1 h-4 w-4"/> Edit</Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDeleteTemplate(template.id)}><Trash2 className="mr-1 h-4 w-4"/> Delete</Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="mt-auto pt-4 border-t">
          {isEditing ? (
            <>
              <Button variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
              <Button onClick={handleSubmit}>Save Template</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={startNewTemplate} className="mr-auto">
                <PlusCircle className="mr-2 h-4 w-4" /> Create New Template
              </Button>
              <DialogClose asChild>
                <Button variant="secondary">Close</Button>
              </DialogClose>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 