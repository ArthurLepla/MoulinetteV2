'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useExcelStore } from '@/store/excelStore';
import { useMappingStore } from '@/store/mappingStore';
import { useAssetStore } from '@/store/assetStore'; // Assuming you might need this for asset operations
import { buildAssetLevels, AssetLevel } from '@/lib/assetUtils';
import { useBulkAssets, ProcessedBulkResponse, MutationVariables } from '@/hooks/useBulkAssets'; // Assuming this hook handles the API call
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronsUpDown, Loader2 } from 'lucide-react';

// Props que ce composant pourrait recevoir (à adapter si besoin)
interface AssetsBulkProps {
  // exemple: onComplete?: () => void;
}

export function AssetsBulk(props: AssetsBulkProps) {
  const parsedExcelData = useExcelStore((state) => state.parsedData);
  const currentMappingConfig = useMappingStore((state) => state.mappingConfig);
  const { assets, anchorMap, setAssets, setAnchorMap, setAssetsCreated, resetAssetStore } = useAssetStore();
  
  const bulkCreateMutation = useBulkAssets();
  const [totalAssetsToCreate, setTotalAssetsToCreate] = React.useState(0);

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
    bulkCreateMutation.reset(); // Reset previous mutation state

    toast.message("Bulk Asset Creation Started", {
      description: `Attempting to create ${calculatedTotalAssets} assets across ${assetLevels.length} levels...`,
    });

    bulkCreateMutation.mutate(
      { levels: assetLevels },
      {
        onSuccess: (response) => {
          toast.success(`Created ${response.successes.length} assets successfully.`, {
            description: `${response.failures.length} failures. Check console for details.`,
          });
          // Update asset store
          const createdAssets = response.successes.map(s => ({ 
            id: s.externalId || '', 
            name: s.name, 
            parentId: s.parentId !== '0' ? s.parentId : undefined, 
            anchorId: s.assetId 
          }));
          const newAnchorMap: Record<string, string> = {};
          response.successes.forEach(s => {
            if (s.externalId && s.assetId) newAnchorMap[s.externalId] = s.assetId;
          });
          setAssets(createdAssets);
          setAnchorMap(newAnchorMap);
          setAssetsCreated(true);
        },
        onError: (error) => {
          toast.error("Bulk Creation Failed", {
            description: error.message || "An unexpected error occurred.",
          });
        },
      }
    );
  };

  const { status: bulkCreateStatus, data: bulkCreateData, error: bulkCreateError, isPending } = bulkCreateMutation;

  const successesCount = bulkCreateData?.successes?.length || 0;
  const failuresCount = bulkCreateData?.failures?.length || 0;
  const processedCount = successesCount + failuresCount;
  const progressValue = totalAssetsToCreate > 0 ? (processedCount / totalAssetsToCreate) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Asset Creation</CardTitle>
        <CardDescription>
          This section allows you to create assets in bulk based on your Excel data and mapping configuration.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={handlePushAssets} 
          disabled={!currentMappingConfig || !parsedExcelData || isPending}
          className="w-full"
        >
          {isPending ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating Assets...</>
          ) : 'Create Assets from Excel'}
        </Button>

        {isPending && (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-muted-foreground">
              Processing {processedCount} of {totalAssetsToCreate} assets...
            </p>
            <Progress value={progressValue} className="h-2" />
          </div>
        )}

        {bulkCreateData && (
          <Collapsible className="mt-4 border rounded-md p-4">
            <CollapsibleTrigger className="flex justify-between items-center w-full font-semibold">
              Asset Creation Results
              <ChevronsUpDown className="h-4 w-4" />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-2">
              <p>Successfully created: {successesCount}</p>
              <p className={failuresCount > 0 ? 'text-destructive' : ''}>Failures: {failuresCount}</p>
              {failuresCount > 0 && (
                <div className="text-xs space-y-1">
                  <h4 className="font-medium">Failure Details (first 5):</h4>
                  <ul className="list-disc pl-5">
                    {bulkCreateData.failures.slice(0, 5).map((failure, index) => (
                      <li key={index} className="text-destructive">
                        {failure.assetName || 'Unknown Asset'}: {failure.message || 'Unknown error'}
                      </li>
                    ))}
                    {bulkCreateData.failures.length > 5 && (
                      <li>...and {bulkCreateData.failures.length - 5} more. Check console.</li>
                    )}
                  </ul>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}
         {bulkCreateError && (
          <div className="mt-4 text-destructive">
            <p>Error during asset creation: {bulkCreateError.message}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 