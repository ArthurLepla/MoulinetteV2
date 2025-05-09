import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// Input might not be needed if propertyName is removed
// import { Input } from "@/components/ui/input"; 
import { Label } from "@/components/ui/label";
import { ExcelData } from '@/store/excelStore';
import { z } from 'zod';

// Ensure helper functions are defined at the top-level or correctly scoped
const getColumnIndexByHeader = (header: string, allHeaders: string[]): number => {
  return allHeaders.indexOf(header);
};

const getOriginalHeaderFromUniqueKey = (uniqueKey: string, allHeaders: string[]): string => {
  if (allHeaders.includes(uniqueKey)) return uniqueKey;
  const match = uniqueKey.match(/_col_(\d+)/);
  if (match && match[1]) {
    const index = parseInt(match[1], 10);
    if (index >= 0 && index < allHeaders.length) {
      return allHeaders[index];
    }
  }
  return uniqueKey; 
};

// Simplified ColumnMapping interface
export interface ColumnMapping {
  type: 'level' | 'EnergyType' | 'ignore';
  level?: number; // For type 'level'
  // propertyName is removed
}

export interface MappingConfig {
  columnMappings: { [header: string]: ColumnMapping };
}

// Simplified Zod Schema
const columnMappingSchema = z.object({
  type: z.enum(['level', 'EnergyType', 'ignore']),
  level: z.number().optional(),
});

const mappingConfigSchema = z.object({
  columnMappings: z.record(z.string(), columnMappingSchema)
}).superRefine((config, ctx) => {
  const mappings = Object.values(config.columnMappings);
  const typeCounts: { [key: string]: string[] } = {}; // Store header keys for each type
  let energyTypeColumnCount = 0;

  mappings.forEach((mapping, index) => {
    const headerKey = Object.keys(config.columnMappings)[index];
    let uniqueTypeKey: string = mapping.type;

    if (mapping.type === 'level') {
      if (typeof mapping.level === 'number') {
        uniqueTypeKey = `level-${mapping.level}`;
      } else {
        // This implies an issue: type 'level' should have a numeric level.
        // The UI should ensure a level is selected if type is 'level'.
        // Zod base schema could also enforce: .refine(data => !(data.type === 'level' && data.level === undefined), { message: "Level number is required for type 'level'."})
        // For counting, if it occurs, treat as a distinct problematic key or add issue directly.
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Column '${headerKey}' is type 'level' but level number is missing.`,
          path: ['columnMappings', headerKey, 'level']
        });
        uniqueTypeKey = `level_invalid-${headerKey}`; // Ensure it doesn't collide
      }
    }
    
    if (mapping.type === 'EnergyType') {
        energyTypeColumnCount++;
    }

    if (!typeCounts[uniqueTypeKey]) {
      typeCounts[uniqueTypeKey] = [];
    }
    typeCounts[uniqueTypeKey].push(headerKey);
  });

  // Check for duplicate levels
  Object.keys(typeCounts).forEach(key => {
    if (key.startsWith('level-') && typeCounts[key].length > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Level '${key.split('-')[1]}' can only be assigned to one column. Found on: ${typeCounts[key].join(', ')}`,
        path: ['columnMappings']
      });
    }
  });
  
  // Check that EnergyType is assigned to at most one column
  if (energyTypeColumnCount === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "One column must be mapped as 'EnergyType'.", // Making it mandatory
      path: ['columnMappings']
    });
  } else if (energyTypeColumnCount > 1) {
    const energyTypeColumns = mappings.map((m, i) => m.type === 'EnergyType' ? Object.keys(config.columnMappings)[i] : null).filter(Boolean);
    ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `'EnergyType' can only be assigned to one column. Found on: ${energyTypeColumns.join(', ')}`,
        path: ['columnMappings']
      });
  }
  // Not strictly required to have an energy type, can be optional
});


// Simplified MAPPING_TYPES
const MAPPING_TYPES = [
  { value: 'ignore', label: 'Ignore' },
  { value: 'level', label: 'Level' },
  { value: 'EnergyType', label: 'Energy Type' },
];

const MAX_LEVELS = 5; // Max N for Level N

// Simplified guessMapping function
const guessMapping = (header: string): ColumnMapping => {
  const h = header.toLowerCase().trim();
  if (h.includes('usine')) return { type: 'level', level: 0 };
  if (h.includes('secteur')) return { type: 'level', level: 1 };
  if (h.includes('atelier')) return { type: 'level', level: 2 };
  if (h.includes('machine')) return { type: 'level', level: 3 }; 
  if (h === 'type') return { type: 'EnergyType' }; 
  // Columns like "Test", "ETH" will become 'ignore' by default with this.
  return { type: 'ignore' };
};

interface MappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  excelData: ExcelData | null;
  onSubmit: (config: MappingConfig) => void;
  existingConfig?: MappingConfig | null; // To load existing config if available
}

export const MappingModal: React.FC<MappingModalProps> = ({ isOpen, onClose, excelData, onSubmit, existingConfig }) => {
  const [internalMappings, setInternalMappings] = useState<{ [header: string]: ColumnMapping }>({});
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [dryRunResults, setDryRunResults] = useState<string[] | null>(null);
  const [isPerformingDryRun, setIsPerformingDryRun] = useState(false);

  const { headers, rows: excelRows } = excelData || { headers: [], rows: [] }; // Ensure headers and rows are available even if excelData is briefly null during init

  useEffect(() => {
    if (isOpen && excelData && excelData.headers) {
      const initialMappings: { [header: string]: ColumnMapping } = {};
      excelData.headers.forEach((header, index) => {
        const key = header || `_col_${index}`;
        if (existingConfig && existingConfig.columnMappings && existingConfig.columnMappings[key]) {
          const loadedMapping = existingConfig.columnMappings[key] as any; // Treat as any for upgrade path
          
          // Check against current valid types first
          if (loadedMapping.type === 'level' || loadedMapping.type === 'ignore' || loadedMapping.type === 'EnergyType') {
            // Ensure level is number if type is level, otherwise default or set to ignore
            if (loadedMapping.type === 'level' && typeof loadedMapping.level !== 'number') {
              initialMappings[key] = guessMapping(header); // Or { type: 'ignore' }
            } else {
              initialMappings[key] = loadedMapping as ColumnMapping; // Cast back if it fits current schema
            }
          } else if (loadedMapping.type === 'property' && loadedMapping.propertyName === 'energyType'){
            initialMappings[key] = { type: 'EnergyType' }; // Convert old property to new EnergyType
          } else {
            initialMappings[key] = guessMapping(header); 
          }
        } else {
          initialMappings[key] = guessMapping(header);
        }
      });
      setInternalMappings(initialMappings);
      setValidationErrors([]); 
      setDryRunResults(null); 
    } 
  }, [excelData, existingConfig, isOpen]);

  if (!isOpen || !excelData) return null;

  const applyAutoMap = () => {
    if (!excelData || !excelData.headers) return;
    const autoMapped: { [header: string]: ColumnMapping } = {};
    excelData.headers.forEach((header, index) => {
      const key = header || `_col_${index}`;
      autoMapped[key] = guessMapping(header);
    });
    setInternalMappings(autoMapped);
    setValidationErrors([]);
    setDryRunResults(null);
  };

  const handleMappingChange = (key: string, type: ColumnMapping['type']) => {
    setInternalMappings(prev => ({
      ...prev,
      [key]: { 
        type, 
        level: type === 'level' ? (prev[key]?.level ?? 0) : undefined, 
        // propertyName assignment removed
      }
    }));
    setValidationErrors([]); 
    setDryRunResults(null); 
  };

  const handleLevelChange = (key: string, levelString: string) => {
    const level = parseInt(levelString);
    setInternalMappings(prev => ({
      ...prev,
      [key]: { ...prev[key], type: 'level', level }
    }));
    setValidationErrors([]);
    setDryRunResults(null); 
  };

  // handlePropertyNameChange is removed as 'property' type is removed

  const handleSubmit = () => {
    const result = mappingConfigSchema.safeParse({ columnMappings: internalMappings });
    if (!result.success) {
      const messages = result.error.issues.map(issue => issue.message);
      setValidationErrors(messages);
      setDryRunResults(null);
      return; // Stop if validation fails
    } else {
      setValidationErrors([]);
      onSubmit(result.data); 
      onClose(); // Close modal on successful submit
    }
  };
  
  const performDryRun = async () => {
    console.log("Current internalMappings for Dry Run:", JSON.stringify(internalMappings, null, 2));
    setValidationErrors([]);
    setDryRunResults(null);
    setIsPerformingDryRun(true);

    const validationResult = mappingConfigSchema.safeParse({ columnMappings: internalMappings });
    if (!validationResult.success) {
      setValidationErrors(validationResult.error.issues.map(issue => issue.message));
      setIsPerformingDryRun(false);
      return;
    }
    const currentConfig = validationResult.data;
    let issues: string[] = [];

    if (!excelRows || excelRows.length === 0) {
      issues.push("Error: No data rows to process for dry run.");
      setDryRunResults(issues);
      setIsPerformingDryRun(false);
      return;
    }

    const mappingToUniqueKey: { [typeAndLevel: string]: string } = {};
    let energyTypeColumnKey: string | null = null;

    Object.entries(currentConfig.columnMappings).forEach(([uniqueKey, mapping]) => {
      if (mapping.type === 'level' && typeof mapping.level === 'number') {
        mappingToUniqueKey[`level-${mapping.level}`] = uniqueKey;
      } else if (mapping.type === 'EnergyType') {
        energyTypeColumnKey = uniqueKey; // Assuming only one by Zod validation
      } 
      // 'ignore' mappings are not stored here
    });

    const getCellValue = (rowIndex: number, mappedType: string, subKey?: string | number): string | null => {
      let uniqueKeyForMapping: string | undefined;
      if (mappedType === 'level' && typeof subKey === 'number') {
        uniqueKeyForMapping = mappingToUniqueKey[`level-${subKey}`];
      } else if (mappedType === 'EnergyType') {
        uniqueKeyForMapping = energyTypeColumnKey || undefined;
      } else {
        uniqueKeyForMapping = mappingToUniqueKey[mappedType]; 
      }

      if (!uniqueKeyForMapping) return null;
      const originalHeader = getOriginalHeaderFromUniqueKey(uniqueKeyForMapping, headers);
      const colIndex = getColumnIndexByHeader(originalHeader, headers);

      if (colIndex === -1 || rowIndex >= excelRows.length || !excelRows[rowIndex] || colIndex >= excelRows[rowIndex].length) return null;
      const cellValue = excelRows[rowIndex][colIndex];
      return cellValue !== null && cellValue !== undefined ? String(cellValue).trim() : null;
    };

    interface ProcessedNode {
      id: string;           // Path-based ID: level0Name@level1Name@...
      name: string;         // Name of this specific level/node
      level: number;
      parentKey: string | null; // Concatenated key of parent names
      originalRowIndex: number;
      energyType?: string | null;
      children: ProcessedNode[]; // For potential future tree building
      fullPathSegments: string[];
    }

    const seenFullPaths = new Set<string>();        // Tracks unique full paths (e.g., USINE@FACILITIES@CHAUFFERIE@VRA_RA14)
    const nameParentCollision = new Map<string, number>(); // Tracks "name@parentKey" -> first originalRowIndex
    
    const allNodes: ProcessedNode[] = [];
    const FORBIDDEN_CHARS_REGEX = /[^a-zA-Z0-9_\-\s\.\(\)]/g;
    const MAX_LENGTH = 50;
    let currentParentKeys: (string | null)[] = Array(MAX_LEVELS + 1).fill(null);

    for (let i = 0; i < excelRows.length; i++) {
      const rowNumForMsg = i + 1;
      let nodeName: string | null = null;
      let nodeLevel: number = -1;
      let nodeIdPathSegments: string[] = [];

      for (let l = 0; l <= MAX_LEVELS; l++) {
        const levelVal = getCellValue(i, 'level', l);
        if (levelVal && levelVal !== "") { 
          nodeName = levelVal;
          nodeLevel = l;
          nodeIdPathSegments = currentParentKeys.slice(0, l).filter(Boolean) as string[];
          nodeIdPathSegments.push(nodeName);
          break;
        }
      }

      if (!nodeName) {
        issues.push(`Warning (Row ${rowNumForMsg}): Skipping row. Cannot determine a name from Level columns for hierarchy.`);
        continue;
      }

      if (nodeName.length > MAX_LENGTH) {
        issues.push(`Warning (Row ${rowNumForMsg}): Name "${nodeName.substring(0, 20)}..." (Level ${nodeLevel}) exceeds ${MAX_LENGTH} chars.`);
      }
      const forbiddenMatch = nodeName.match(FORBIDDEN_CHARS_REGEX);
      if (forbiddenMatch) {
        issues.push(`Warning (Row ${rowNumForMsg}): Name "${nodeName.substring(0, 20)}..." (Level ${nodeLevel}) contains forbidden chars: ${forbiddenMatch.join(', ')}.`);
      }

      const parentKey = nodeLevel > 0 ? (currentParentKeys.slice(0, nodeLevel).filter(Boolean).join('@') || 'ROOT') : 'ROOT';
      const fullPath = nodeIdPathSegments.join('@');
      const nameAtParent = `${nodeName}@${parentKey}`;
      
      // De-duplication logic
      if (seenFullPaths.has(fullPath)) {
        // This exact asset path has been processed (e.g. same machine, different energy type or row)
        // This is not an error for asset creation itself, but the row might carry a different energyType.
        // We still process the energy type for this row.
      } else {
        // This is a new asset path
        if (nameParentCollision.has(nameAtParent)) {
          // Another asset (different fullPath) has the same name under the same parent path.
          const firstRow = nameParentCollision.get(nameAtParent)! + 1;
          issues.push(`Error: Duplicate asset name "${nodeName}" under parent path "${parentKey || 'ROOT'}". First seen at row ${firstRow}, conflicting with row ${rowNumForMsg}. Paths: ${nameParentCollision.get(nameAtParent)} vs ${fullPath}`);
        } else {
          nameParentCollision.set(nameAtParent, i); // Store original row index for first encounter
        }
        seenFullPaths.add(fullPath);
      }
      
      // Update parent keys for next iteration *after* using them for current node's parentKey
      currentParentKeys[nodeLevel] = nodeName;
      for (let l = nodeLevel + 1; l <= MAX_LEVELS; l++) {
        currentParentKeys[l] = null;
      }

      const energyType = getCellValue(i, 'EnergyType');
      if (energyType && energyType.length > MAX_LENGTH) {
         issues.push(`Warning (Row ${rowNumForMsg}): EnergyType "${energyType.substring(0,20)}..." exceeds ${MAX_LENGTH} chars.`);
      }
      if (energyType) {
        const energyForbidden = energyType.match(FORBIDDEN_CHARS_REGEX);
        if (energyForbidden) {
            issues.push(`Warning (Row ${rowNumForMsg}): EnergyType "${energyType.substring(0,20)}..." contains forbidden chars: ${energyForbidden.join(', ')}.`);
        }
      }

      // Add to allNodes for potential further processing or data collection, even if it's a repeated asset path
      allNodes.push({
        id: fullPath,
        name: nodeName,
        level: nodeLevel,
        parentKey: parentKey === 'ROOT' && nodeLevel === 0 ? null : parentKey,
        originalRowIndex: i,
        energyType: energyType,
        children: [],
        fullPathSegments: nodeIdPathSegments,
      });
    }

    if (issues.length === 1 && issues[0].startsWith("Dry run started")) {
      issues.push("Dry run: Basic checks completed. No errors or warnings detected with simplified mappings.");
    } else if (issues.length > 0 && !issues.slice(1).some(iss => iss.toLowerCase().startsWith('error'))) {
      issues.push("Dry run: Completed with warnings. Please review.");
    } else if (issues.some(iss => iss.toLowerCase().startsWith('error'))) {
      issues.push("Dry run: Completed with ERRORS. Please review and fix mappings or data.");
    }

    setDryRunResults(issues);
    setIsPerformingDryRun(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(openStatus) => !openStatus && onClose()}>
      <DialogContent className="sm:max-w-[90%] md:max-w-[80%] lg:max-w-[70%] xl:max-w-[60%]">
        <DialogHeader>
           <div className="flex justify-between items-center">
            <div>
              <DialogTitle>Configure Column Mapping</DialogTitle>
              <DialogDescription>
                Map Excel columns to Levels or Energy Type. Use 'Auto-map' for suggestions.
              </DialogDescription>
            </div>
            <Button variant="outline" size="sm" onClick={applyAutoMap} title="Attempt to automatically map columns based on headers">Auto-map Columns</Button>
          </div>
        </DialogHeader>

        {validationErrors.length > 0 && (
          <div className="p-3 my-2 bg-destructive/10 border border-destructive/50 rounded-md">
            <h4 className="font-semibold text-destructive mb-1">Mapping Configuration Errors:</h4>
            <ul className="list-disc pl-5 text-sm text-destructive">
              {validationErrors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {dryRunResults && (
          <div className={`p-3 my-2 rounded-md ${dryRunResults.some(r => r.toLowerCase().includes('error') || r.toLowerCase().includes('warning')) ? 'bg-amber-100 dark:bg-amber-900/30 border border-amber-500/50' : 'bg-green-100 dark:bg-green-900/30 border border-green-500/50'}`}>
            <h4 className={`font-semibold mb-1 ${dryRunResults.some(r => r.toLowerCase().includes('error') || r.toLowerCase().includes('warning')) ? 'text-amber-700 dark:text-amber-300' : 'text-green-700 dark:text-green-300'}`}>Dry Run Results:</h4>
            <ul className={`list-disc pl-5 text-sm ${dryRunResults.some(r => r.toLowerCase().includes('error') || r.toLowerCase().includes('warning')) ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
              {dryRunResults.map((result, i) => (
                <li key={i}>{result}</li>
              ))}
            </ul>
          </div>
        )}
        
        <div className="py-1 max-h-[55vh] overflow-y-auto space-y-3 pr-2">
          {headers.map((header, index) => {
            const uniqueKey = header || `_col_${index}`;
            const displayHeader = header || `Unnamed Column ${index + 1}`;
            const currentMapping = internalMappings[uniqueKey] || { type: 'ignore' };

            return (
              <div key={uniqueKey} className="grid grid-cols-1 md:grid-cols-3 gap-x-3 gap-y-2 items-center p-3 border rounded-md bg-muted/20">
                <Label htmlFor={`select-type-${uniqueKey}`} className="md:col-span-1 font-medium text-sm truncate" title={displayHeader}>
                  {displayHeader}
                </Label>
                <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-2 items-center">
                  <div> 
                    <Select
                      value={currentMapping.type}
                      onValueChange={(value) => handleMappingChange(uniqueKey, value as ColumnMapping['type'])}                    
                    >
                      <SelectTrigger id={`select-type-${uniqueKey}`}>
                        <SelectValue placeholder="Select mapping type" />
                      </SelectTrigger>
                      <SelectContent>
                        {MAPPING_TYPES.map(mType => (
                          <SelectItem key={mType.value} value={mType.value}>{mType.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {currentMapping.type === 'level' && (
                    <div> 
                      <Select
                        value={String(currentMapping.level ?? 0)}
                        onValueChange={(value) => handleLevelChange(uniqueKey, value)}
                      >
                        <SelectTrigger id={`select-level-${uniqueKey}`}>
                          <SelectValue placeholder="Select level" />
                        </SelectTrigger>
                        <SelectContent>
                          {[...Array(MAX_LEVELS + 1).keys()].map(levelNum => (
                            <SelectItem key={levelNum} value={String(levelNum)}>Level {levelNum}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {/* Conditional rendering for 'propertyName' Input is removed */}
                  {/* Placeholder for grid alignment if needed */}
                  {currentMapping.type !== 'level' && <div className="hidden sm:block"></div>}
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="mt-4 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="secondary" onClick={performDryRun} disabled={isPerformingDryRun}>
            {isPerformingDryRun ? 'Performing Dry Run...' : 'Dry Run'}
          </Button>
          <Button onClick={handleSubmit} disabled={isPerformingDryRun}>Save Mapping</Button> 
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}; 