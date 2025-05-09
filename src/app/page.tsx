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
  const setMappingConfigInStore = useExcelStore((state) => state.setMappingConfig);
  const currentMappingConfig = useExcelStore((state) => state.mappingConfig);

  const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
  const bulkCreateMutation: UseMutationResult<ProcessedBulkResponse, Error, MutationVariables> = useBulkAssets();
  const [totalAssetsToCreate, setTotalAssetsToCreate] = useState(0);

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
    setMappingConfigInStore(config);
    setIsMappingModalOpen(false);
  };

  const handlePushAssets = () => {
    if (!parsedExcelData || !currentMappingConfig) {
      toast.error("Missing Excel data or mapping configuration.");
      return;
    }

    const assetLevels: AssetLevel[] = buildAssetLevels(parsedExcelData, currentMappingConfig);
    
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
    
    // Extract assets and map them to their anchor IDs
    const assets = response.successes.map(success => ({
      id: success.externalId || '',
      name: success.name,
      parentId: success.parentId !== '0' ? success.parentId : undefined,
      anchorId: success.assetId
    }));
    
    const anchorMap: Record<string, string> = {};
    
    response.successes.forEach(success => {
      if (success.externalId && success.assetId) {
        anchorMap[success.externalId] = success.assetId;
      }
    });
    
    // Update asset store with created assets and mark as created
    const { setAssets, setAnchorMap, setAssetsCreated } = useAssetStore.getState();
    setAssets(assets);
    setAnchorMap(anchorMap);
    setAssetsCreated(true);
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
          <TabsTrigger value="variables">Variables</TabsTrigger>
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
                    disabled={!currentMappingConfig || bulkCreateMutation.isPending}
                  >
                    {bulkCreateMutation.isPending ? 'Creating...' : 'Create Assets'}
                  </Button>
                </div>
              </div>
              <PreviewTable data={parsedExcelData} />
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
          {/* Variables Tab Content */}
          <CreateVariables />
        </TabsContent>
      </Tabs>

      <MappingModal
        isOpen={isMappingModalOpen}
        onClose={handleCloseMappingModal}
        onSubmit={handleSubmitMapping}
        existingConfig={currentMappingConfig}
        excelData={parsedExcelData}
      />
    </main>
  );
}
