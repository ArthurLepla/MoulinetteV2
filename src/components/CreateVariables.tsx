import { useEffect, useState, useMemo } from 'react';
import { AxiosInstance } from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, CheckCircle2, Loader2, Upload, Settings2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { createApiClient } from '@/lib/apiClient';
import { useAssetStore } from '@/store/assetStore';
import { EnergyMap } from '@/lib/energyPropagate';
import { Asset } from '@/types';
import { useVariableStore } from '@/store/variableStore';
import { useEnergyAttributes } from '@/hooks/useEnergyAttributes';
import { useBulkVariables } from '@/hooks/useBulkVariables';
import { buildVariableArray } from '@/lib/variableBuilder';
import { AdapterPicker } from './AdapterPicker';
import { VariablePreview } from './VariablePreview';
import * as XLSX from 'xlsx';
import { EnergyMapColumnModal } from './EnergyMapColumnModal';

interface RawExcelSheetData {
  headers: string[];
  rows: string[][];
  fileName: string;
}

enum ProcessStage {
  NotStarted,
  TaggingLeaves,
  PropagatingFlags,
  GeneratingVariables,
  PreviewReady,
  CreatingVariables,
  Completed,
  Error
}

export function CreateVariables() {
  const { token, apiUrl } = useAuth();
  const [stage, setStage] = useState<ProcessStage>(ProcessStage.NotStarted);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rawEnergyExcelData, setRawEnergyExcelData] = useState<RawExcelSheetData | null>(null);
  const [needsEnergyMapColumnMapping, setNeedsEnergyMapColumnMapping] = useState<boolean>(false);
  const [isEnergyMapModalOpen, setIsEnergyMapModalOpen] = useState<boolean>(false);
  const [energyColumnMapping, setEnergyColumnMapping] = useState<{ assetIdCol: string; energyTypeCol: string } | null>(null);
  
  const client = useMemo(() => {
    if (!token) {
      console.log('[CreateVariables] Token is null. Client not created.');
      return null;
    }
    console.log('[CreateVariables] Initializing client. API URL:', apiUrl);
    try {
      const newAxiosClient = createApiClient(token, apiUrl);
      if (newAxiosClient && typeof newAxiosClient.get === 'function') {
        console.log('[CreateVariables] Axios client initialized successfully.');
        return newAxiosClient;
      } else {
        console.error('[CreateVariables] createApiClient did NOT return a valid Axios instance.');
        return null;
      }
    } catch (error) {
      console.error('[CreateVariables] Error during client instantiation:', error);
      return null;
    }
  }, [token, apiUrl]);
  
  const { 
    assets, 
    assetsCreated, 
    leafEnergyMap, 
    adapterId, 
    adapterSelected,
    energyFlagsReady,
    setEnergyMap,
    setParentEnergyFlags,
    setEnergyFlagsReady 
  } = useAssetStore();
  
  const {
    varsReady,
    variablesCreated,
    previewVariables,
    isCreatingVariables,
    progress,
    setPreviewVariables,
    setVarsReady,
    setVariables,
    setVariablesCreated,
    setProcessedCount,
    setTotalCount,
    setProgress
  } = useVariableStore();
  
  const { tagLeaves, propagate, isTagging, isPropagating, error: energyError } = useEnergyAttributes();
  const { createVariablesBulk, isCreating, progress: bulkProgress, error: bulkError } = useBulkVariables();
  const energyMap = useAssetStore(s => s.energyMap);

  /*
  useEffect(() => {
    const processEnergyAttributesViaAPI = async () => {
      if (assetsCreated && client && assets.length > 0 && !energyFlagsReady && !rawEnergyExcelData) {
        try {
          setStage(ProcessStage.TaggingLeaves);
          const updatedEnergyMap = await tagLeaves(assets, leafEnergyMap, client);
          setEnergyMap(updatedEnergyMap);
          
          setStage(ProcessStage.PropagatingFlags);
          const flags = await propagate(assets, updatedEnergyMap, client);
          setParentEnergyFlags(flags);
          
          setEnergyFlagsReady(true);
          
          if (adapterSelected && adapterId) {
            setStage(ProcessStage.GeneratingVariables);
            generateVariablePreview();
          } else {
            setStage(ProcessStage.PreviewReady);
          }
        } catch (error) {
          console.error('Error processing energy attributes via API (non-Excel flow):', error);
          setErrorMessage('Failed to process energy attributes via API');
          setStage(ProcessStage.Error);
        }
      }
    };
    
    processEnergyAttributesViaAPI();
  }, [assetsCreated, client, assets, leafEnergyMap, energyFlagsReady, adapterId, adapterSelected, rawEnergyExcelData]);
  */

  useEffect(() => {
    if (energyFlagsReady && adapterSelected && adapterId && !varsReady) {
      const currentEnergyMap = energyMap;
      if (Object.keys(currentEnergyMap).length > 0) {
        console.log('[CreateVariables] Conditions met for preview generation. Calling generateVariablePreview().');
        generateVariablePreview();
      } else {
        console.log('[CreateVariables] Conditions for preview met, but energyMap is empty. Waiting for energyMap.');
      }
    }
  }, [energyFlagsReady, adapterSelected, adapterId, varsReady, energyMap]);

  const generateVariablePreview = () => {
    if (!adapterId) {
      console.log('[CreateVariables] generateVariablePreview skipped: No adapterId selected.');
      return;
    }
    const currentAssets = useAssetStore.getState().assets;
    const currentEnergyMap = useAssetStore.getState().energyMap;

    if(currentAssets.length === 0) {
      console.log('[CreateVariables] generateVariablePreview skipped: No assets available in store.');
      return;
    }
    if(Object.keys(currentEnergyMap).length === 0) {
      console.log('[CreateVariables] generateVariablePreview skipped: EnergyMap is empty.');
      return;
    }

    setStage(ProcessStage.GeneratingVariables);
    try {
      console.log('[CreateVariables] generateVariablePreview - Input Assets count:', currentAssets.length, '(First 5 shown):', JSON.stringify(currentAssets.map(a => ({id: a.id, name: a.name})).slice(0, 5), null, 2));
      console.log('[CreateVariables] generateVariablePreview - Input EnergyMap entry count:', Object.keys(currentEnergyMap).length, '(First 5 shown):', JSON.stringify(Object.fromEntries(Object.entries(currentEnergyMap).slice(0,5)), null, 2));
      console.log('[CreateVariables] generateVariablePreview - Selected AdapterID:', adapterId);
      
      const variables = buildVariableArray(currentAssets, currentEnergyMap, adapterId);
      console.log('[CreateVariables] generateVariablePreview - Generated Variables Count:', variables.length);
      if (variables.length > 0) {
        console.log('[CreateVariables] generateVariablePreview - Generated Variables (first 5):', JSON.stringify(variables.slice(0,5), null, 2));
      }

      setPreviewVariables(variables);
      setVarsReady(true);
      if (variables.length > 0) {
        setStage(ProcessStage.PreviewReady);
        setErrorMessage(null);
      } else {
        setStage(ProcessStage.PreviewReady);
      }
    } catch (error) {
      console.error('Error generating variable preview:', error);
      setErrorMessage('Failed to generate variable preview');
      setStage(ProcessStage.Error);
    }
  };

  const handleEnergyMapUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setRawEnergyExcelData(null);
    setNeedsEnergyMapColumnMapping(false);
    setEnergyMap({});
    setEnergyFlagsReady(false);
    setVarsReady(false);
    setPreviewVariables([]);
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];
        
        if (jsonData.length === 0) throw new Error("Excel sheet is empty.");

        const headers = (jsonData[0] as string[]).map(String);
        const rows = jsonData.slice(1).map(row => (row as string[]).map(String));

        if (rows.length === 0) throw new Error("Excel has headers but no data rows.");

        setRawEnergyExcelData({ headers, rows, fileName: file.name });
        setNeedsEnergyMapColumnMapping(true);
        console.log(`[CreateVariables] Parsed Excel: '${file.name}' (${headers.length} headers, ${rows.length} data rows).`);
        setErrorMessage(null);

        const currentAssets = useAssetStore.getState().assets;
        if (currentAssets.length > 0 && useAssetStore.getState().assetsCreated) {
          setIsEnergyMapModalOpen(true);
          setNeedsEnergyMapColumnMapping(false);
        }
      } catch (err: any) {
        console.error("Error parsing Excel for energy map:", err);
        setErrorMessage(`Failed to parse Excel for energy map: ${err.message}`);
        setRawEnergyExcelData(null);
        setNeedsEnergyMapColumnMapping(false);
      }
    };
    reader.onerror = (err) => {
      console.error("FileReader error:", err);
      setErrorMessage("Failed to read the uploaded file.");
      setRawEnergyExcelData(null);
      setNeedsEnergyMapColumnMapping(false);
    };
    reader.readAsBinaryString(file);
  };
  
  const handleEnergyMapColumnSubmit = (mapping: { assetIdCol: string; energyTypeCol: string }) => {
    setEnergyColumnMapping(mapping);
    setIsEnergyMapModalOpen(false);
    handleProcessMappedEnergyData(mapping.assetIdCol, mapping.energyTypeCol);
  };

  const handleProcessMappedEnergyData = (assetIdCol: string, energyTypeCol: string) => {
    if (!rawEnergyExcelData || !assetsCreated || assets.length === 0) {
      setErrorMessage("Cannot process energy map: Raw Excel data or API assets are missing.");
      return;
    }

    console.log(`[CreateVariables] Starting to process mapped energy data. AssetID Col: '${assetIdCol}', EnergyType Col: '${energyTypeCol}'`);
    setStage(ProcessStage.GeneratingVariables);

    try {
      const assetIdHeaderIndex = rawEnergyExcelData.headers.indexOf(assetIdCol);
      const energyTypeHeaderIndex = rawEnergyExcelData.headers.indexOf(energyTypeCol);

      if (assetIdHeaderIndex === -1 || energyTypeHeaderIndex === -1) {
        throw new Error("Selected mapping columns not found in Excel headers.");
      }

      const newEnergyMap: EnergyMap = {};
      let matchesFound = 0;

      // Normalization function
      const norm = (s: string | undefined): string => {
        if (s === undefined || s === null) return '';
        return s.normalize('NFD')
                .replace(/[\u0300-\u036f]/g,'')
                .replace(/\s+/g,'')
                .toLowerCase();
      }

      const assetsByName: Record<string, Asset> = {};
      // Use the already mapped 'assets' from the store which should be up-to-date
      const currentAssetsFromStore = useAssetStore.getState().assets; 
      currentAssetsFromStore.forEach(asset => {
        if (asset.name) { // asset.name should now be populated correctly by displayName
          assetsByName[norm(asset.name)] = asset;
        }
      });
      
      console.log("[CreateVariables] API Assets (first 3 name mappings for matching after norm):",
        Object.fromEntries(Object.entries(assetsByName).slice(0,3).map(([key, value]) => [key, {id: value.id, name: value.name}])));

      if (rawEnergyExcelData.rows.length > 0 && rawEnergyExcelData.rows[0]) {
        console.log('[CreateVariables] Example name from Excel (0, assetIdCol HdrIdx):', rawEnergyExcelData.rows[0][assetIdHeaderIndex]);
        console.log('[CreateVariables] Example name from Excel (0, assetIdCol HdrIdx) after norm:', norm(rawEnergyExcelData.rows[0][assetIdHeaderIndex]));
      }

      rawEnergyExcelData.rows.forEach((row, rowIndex) => {
        const excelAssetIdentifierRaw = row[assetIdHeaderIndex];
        const excelAssetIdentifierNormalized = norm(excelAssetIdentifierRaw);
        const energyType = row[energyTypeHeaderIndex]?.trim();

        if (excelAssetIdentifierNormalized && energyType) {
          const matchedAsset = assetsByName[excelAssetIdentifierNormalized];
          if (matchedAsset) {
            newEnergyMap[matchedAsset.id] = energyType;
            matchesFound++;
          } else {
            // Optional: log non-matches for debugging
            // if (rowIndex < 5) { // Log first few non-matches
            //   console.log(`[CreateVariables] No match for Excel ID (norm): '${excelAssetIdentifierNormalized}' (raw: '${excelAssetIdentifierRaw}')`);
            // }
          }
        }
      });

      if (matchesFound === 0 && rawEnergyExcelData.rows.length > 0) {
        setErrorMessage("No matching assets found between Excel and retrieved assets based on the selected identifier column. Variable preview might be empty.");
        console.warn("[CreateVariables] No matches found between Excel identifiers and API asset names.");
      }
      console.log(`[CreateVariables] Finished processing mapped energy data. ${matchesFound} assets matched.`);
      
      setEnergyMap(newEnergyMap);
      setEnergyFlagsReady(true);
      setNeedsEnergyMapColumnMapping(false);
      setRawEnergyExcelData(null);

      if (adapterSelected && adapterId) {
        console.log("[CreateVariables] Calling generateVariablePreview after mapping and setting energyMap.");
        generateVariablePreview(); 
      } else {
        setStage(ProcessStage.PreviewReady);
      }

    } catch (err: any) {
      console.error("Error processing mapped energy data:", err);
      setErrorMessage(`Error processing mapped energy data: ${err.message}`);
      setStage(ProcessStage.Error);
    }
  };

  const handleCreateVariables = async () => {
    if (!client || !previewVariables.length || !varsReady) return;
    setStage(ProcessStage.CreatingVariables);
    try {
      const success = await createVariablesBulk(
        previewVariables,
        client,
        1000,
        (processed, total) => {
          setProcessedCount(processed);
          setTotalCount(total);
        }
      );
      if (success) {
        setVariables(previewVariables);
        setVariablesCreated(true);
        setStage(ProcessStage.Completed);
      } else {
        throw new Error('Variable creation failed');
      }
    } catch (error) {
      console.error('Error creating variables:', error);
      setErrorMessage('Failed to create variables');
      setStage(ProcessStage.Error);
    }
  };

  const isProcessing = isTagging || isPropagating || isCreatingVariables || 
                      stage === ProcessStage.TaggingLeaves || 
                      stage === ProcessStage.PropagatingFlags ||
                      stage === ProcessStage.GeneratingVariables;
  
  const calculateTotalProgress = () => {
    switch (stage) {
      case ProcessStage.TaggingLeaves: return 20;
      case ProcessStage.PropagatingFlags: return 40;
      case ProcessStage.GeneratingVariables: return 60; 
      case ProcessStage.PreviewReady: return 80;
      case ProcessStage.CreatingVariables: return 80 + (bulkProgress * 0.2);
      case ProcessStage.Completed: return 100;
      default: return 0;
    }
  };

  const getStageLabel = () => {
    switch (stage) {
      case ProcessStage.NotStarted: return 'Waiting for assets';
      case ProcessStage.TaggingLeaves: return 'Tagging leaf assets with energy types...';
      case ProcessStage.PropagatingFlags: return 'Propagating energy flags to parent assets...';
      case ProcessStage.GeneratingVariables: return 'Generating variable definitions...';
      case ProcessStage.PreviewReady: return 'Ready to create variables';
      case ProcessStage.CreatingVariables: return `Creating variables (${progress}%)...`;
      case ProcessStage.Completed: return 'Variables created successfully!';
      case ProcessStage.Error: return 'Error during variable creation';
      default: return 'Processing...';
    }
  };

  useEffect(() => {
    if (needsEnergyMapColumnMapping && rawEnergyExcelData && assets.length > 0 && assetsCreated && !isEnergyMapModalOpen) {
      setIsEnergyMapModalOpen(true);
      setNeedsEnergyMapColumnMapping(false);
    }
  }, [needsEnergyMapColumnMapping, rawEnergyExcelData, assets, assetsCreated, isEnergyMapModalOpen]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Variable Generation</CardTitle>
          <CardDescription>Create variables based on asset energy types</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium">Progress</span>
                <span className="text-sm text-muted-foreground">
                  {Math.round(calculateTotalProgress())}%
                </span>
              </div>
              <Progress value={calculateTotalProgress()} />
              <p className="text-sm text-muted-foreground">{getStageLabel()}</p>
            </div>
            
            {!assetsCreated ? (
              <div className="pt-4">
                <Button 
                  className="w-full"
                  variant="outline"
                  onClick={async () => {
                    console.log('[CreateVariables] "Retrieve Assets" button clicked.');
                    console.log('[CreateVariables] Current auth token:', token);
                    console.log('[CreateVariables] Current API URL from context:', apiUrl);
                    if (!client?.get) {
                      console.error('[CreateVariables] API client not ready for "Retrieve Assets". Token or apiUrl might be missing, or client init failed.');
                      setErrorMessage('API client not ready. Please ensure you are logged in and the application has initialized correctly.');
                      setStage(ProcessStage.Error);
                      return;
                    }
                    
                    try {
                      console.log('[CreateVariables] Fetching assets from the AssetService/Assets/Tree endpoint...');
                      
                      // Switch to the Tree endpoint that provides a hierarchical view with names
                      const response: any = await client.get('/AssetService/Assets/Tree');
                      
                      if (!response.data) {
                        throw new Error('No data returned from Assets Tree API');
                      }
                      
                      console.log('[CreateVariables] Assets Tree API response received');
                      
                      // Helper function to recursively extract assets from tree structure
                      const extractAssetsFromTree = (node: any, assets: any[] = []): any[] => {
                        if (!node) return assets;
                        
                        // Add the current node as an asset (if it has an ID and name)
                        if (node.assetId && node.name) {
                          assets.push({
                            id: node.assetId,
                            name: node.name,
                            parentId: node.parentId || undefined,
                            anchorId: node.assetId
                          });
                        }
                        
                        // Process all children recursively
                        if (Array.isArray(node.children)) {
                          node.children.forEach((child: any) => {
                            extractAssetsFromTree(child, assets);
                          });
                        }
                        
                        return assets;
                      };
                      
                      // Extract all assets from the tree structure
                      const mappedAssets: Asset[] = extractAssetsFromTree(response.data);
                      
                      // Log results
                      console.log(`[CreateVariables] Extracted ${mappedAssets.length} assets from the tree structure`);
                      
                      if (mappedAssets.length === 0) {
                        console.warn('[CreateVariables] No assets found from Asset Tree API.');
                        setErrorMessage('No assets found. Please check if assets exist in the source system.');
                        setStage(ProcessStage.NotStarted);
                        useAssetStore.getState().setAssets([]);
                        useAssetStore.getState().setAssetsCreated(false);
                        return;
                      }
                      
                      // Log the first few assets to verify the structure
                      console.log('[CreateVariables] Processed assets (first 5 shown):', 
                        JSON.stringify(mappedAssets.slice(0, 5), null, 2));
                      
                      // Store the assets
                      useAssetStore.getState().setAssets(mappedAssets);
                      useAssetStore.getState().setAssetsCreated(true);
                      setErrorMessage(null);
                      setStage(ProcessStage.NotStarted);
                      console.log(`[CreateVariables] Loaded ${mappedAssets.length} assets successfully.`);
                      
                      if (rawEnergyExcelData && needsEnergyMapColumnMapping) {
                        setIsEnergyMapModalOpen(true);
                        setNeedsEnergyMapColumnMapping(false);
                      }
                    } catch (error: any) {
                      console.error('Error fetching assets:', error);
                      setErrorMessage(`Failed to retrieve assets: ${error.message || 'Unknown error'}`);
                      setStage(ProcessStage.Error);
                    }
                  }}
                  disabled={isProcessing || assetsCreated}
                >
                  Retrieve Assets
                </Button>
                <p className="text-xs text-muted-foreground pt-2">Start by retrieving the asset hierarchy.</p>
              </div>
            ) : (
              <>
                <div className="py-2">
                  <AdapterPicker 
                    client={client} 
                    disabled={isProcessing || !assetsCreated || variablesCreated || !client} 
                  />
                </div>

                <div className="py-2 space-y-2">
                  <label htmlFor="energy-map-upload" className="text-sm font-medium block">
                    Upload Energy Map File (Excel)
                  </label>
                  <div className="flex items-center space-x-2">
                    <Button asChild variant="outline" className="cursor-pointer">
                      <label htmlFor="energy-map-upload" className="flex items-center">
                        <Upload className="mr-2 h-4 w-4" />
                        {rawEnergyExcelData?.fileName ? "Change File..." : "Choose File..."}
                        <input 
                          id="energy-map-upload" 
                          type="file" 
                          accept=".xlsx, .xls" 
                          onChange={handleEnergyMapUpload} 
                          className="sr-only"
                          disabled={isProcessing || !assetsCreated || variablesCreated || !client}
                        />
                      </label>
                    </Button>
                    {rawEnergyExcelData?.fileName && (
                      <span className="text-sm text-muted-foreground truncate max-w-xs" title={rawEnergyExcelData.fileName}>
                        {rawEnergyExcelData.fileName}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Upload your Excel. You'll be prompted to map columns (e.g., Asset Name/ID, Energy Type).
                  </p>
                </div>
              </>
            )}
            
            {errorMessage && (
              <Alert variant="destructive" className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}
            
            {stage === ProcessStage.Completed && (
              <Alert className="mt-4 bg-green-50 text-green-800 border-green-200">
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Success</AlertTitle>
                <AlertDescription>
                  {previewVariables.length} variables have been created successfully.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            className="w-full"
            onClick={handleCreateVariables}
            disabled={ 
              !varsReady || 
              isProcessing || 
              !previewVariables.length || 
              !adapterId || 
              variablesCreated ||
              !client 
            }
          >
            {isProcessing && stage !== ProcessStage.CreatingVariables && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} 
            {stage === ProcessStage.CreatingVariables && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} 
            {variablesCreated ? 'Variables Created' : (stage === ProcessStage.CreatingVariables ? 'Creating...' : 'Create Variables')}
          </Button>
        </CardFooter>
      </Card>

      {varsReady && previewVariables.length > 0 && (
        <VariablePreview />
      )}

      {rawEnergyExcelData && (
        <EnergyMapColumnModal
          isOpen={isEnergyMapModalOpen}
          onClose={() => {
            setIsEnergyMapModalOpen(false);
          }}
          excelHeaders={rawEnergyExcelData.headers || []}
          onSubmit={handleEnergyMapColumnSubmit}
          initialAssetIdCol={energyColumnMapping?.assetIdCol}
          initialEnergyTypeCol={energyColumnMapping?.energyTypeCol}
        />
      )}
    </div>
  );
} 