import { useMutation, UseMutationResult } from '@tanstack/react-query';
import { createApiClient } from '@/lib/apiClient';
import { useAuth } from '@/context/AuthContext';
import * as idb from '@/lib/indexedDB'; // Import IndexedDB utilities
import { AssetLevel, AssetNode } from '@/lib/assetUtils'; // <-- IMPORT NEW TYPES

// 1. Updated AssetToCreate interface for API payload
export interface AssetToCreate {
  name: string;
  parentId?: string | null; // "0" or null for root, or actual parentId. Optional for root.
  sortOrder?: number;
  externalId?: string; // To store pathKey or original row reference, helps map results
}

// 2. CreatedAsset interface (remains largely the same)
export interface CreatedAsset {
  assetId: string;
  name: string;
  parentId: string; // API will return this
  sortOrder?: number;
  hasChildren?: boolean;
  externalId?: string; // Carried over from AssetToCreate
}

// 3. BulkAssetError interface - ADDED assetName and assetExternalId
export interface BulkAssetError {
  objectIndex?: number; // Index within the specific chunk/level attempt, less critical now
  errorKey: string;
  message: string;
  assetName?: string; // Name of the asset that failed
  assetExternalId?: string; // externalId (fullPath) of the asset that failed
}

// 4. ApiBulkResponse interface (remains the same)
interface ApiBulkResponse {
  results: CreatedAsset[];
  errors: Array<{
    errorKey: string;
    message: string;
    debugInfo?: {
      objectIndex?: number;
      [key: string]: any;
    };
    [key: string]: any;
  }>;
}

// ProcessedBulkResponse (remains the same, aggregates all levels)
export interface ProcessedBulkResponse {
  successes: CreatedAsset[];
  failures: BulkAssetError[];
  // Could add level-specific progress/results here if needed for UI
}

// Interface for the variables passed to the mutation - CHANGED
export interface MutationVariables {
  levels: AssetLevel[];
  // Add onProgress callback if granular progress updates are needed
  // onProgress?: (progress: { currentLevel: number; totalLevels: number; successesThisLevel: number; errorsThisLevel: number }) => void;
}

const CHUNK_SIZE = 1000; // As per spec

// --- NEW: Level-by-Level Asset Creation Logic ---
async function bulkCreateAssetsByLevelApi(
  levels: AssetLevel[],
  token: string,
  apiUrl: string,
  // onProgress?: MutationVariables['onProgress'] // Optional progress callback
): Promise<ProcessedBulkResponse> {
  const apiClient = createApiClient(token, apiUrl);
  const allSuccesses: CreatedAsset[] = [];
  const allFailures: BulkAssetError[] = [];
  const idOfPath: Record<string, string> = {}; // Maps node.fullPath to server-assigned assetId

  for (let levelIndex = 0; levelIndex < levels.length; levelIndex++) {
    const levelGroup = levels[levelIndex];
    const payloadForCurrentLevel: AssetToCreate[] = [];
    const skippedNodesThisLevel: AssetNode[] = [];

    console.log(`Processing level ${levelGroup.level}...`);

    for (const node of levelGroup.nodes) {
      let parentIdToSet: string | null | undefined = undefined;
      if (node.parentPath) {
        parentIdToSet = idOfPath[node.parentPath];
        if (!parentIdToSet) {
          // Parent was not created successfully or path is wrong
          console.warn(`Skipping asset "${node.name}" (path: ${node.fullPath}) because its parent (path: ${node.parentPath}) was not successfully created or ID not found.`);
          allFailures.push({
            errorKey: 'ParentAssetCreationFailed',
            message: `Parent asset (path: ${node.parentPath}) for "${node.name}" was not created successfully or its ID was not found.`,
            assetName: node.name,
            assetExternalId: node.fullPath,
          });
          skippedNodesThisLevel.push(node);
          continue; // Skip this node
        }
      } else {
        // MODIFIED: Root assets get parentId: "0"
        parentIdToSet = "0"; 
      }

      payloadForCurrentLevel.push({
        name: node.name,
        parentId: parentIdToSet,
        externalId: node.fullPath, // This is node.fullPath
      });
    }

    if (payloadForCurrentLevel.length === 0 && skippedNodesThisLevel.length > 0) {
      console.log(`Level ${levelGroup.level} has no assets to create after skipping due to parent failures.`);
      // if (onProgress) onProgress({ currentLevel: levelIndex + 1, totalLevels: levels.length, successesThisLevel: 0, errorsThisLevel: skippedNodesThisLevel.length });
      continue;
    }
    if (payloadForCurrentLevel.length === 0) {
        console.log(`Level ${levelGroup.level} has no assets to create after parent failures or empty level.`);
        // if (onProgress) onProgress({ currentLevel: levelIndex + 1, totalLevels: levels.length, successesThisLevel: 0, errorsThisLevel: 0 });
        continue;
    }


    // Chunking for the current level's payload
    for (let i = 0; i < payloadForCurrentLevel.length; i += CHUNK_SIZE) {
      const chunk = payloadForCurrentLevel.slice(i, i + CHUNK_SIZE); // This is the array of AssetToCreate sent to API
      try {
        console.log(`  Level ${levelGroup.level}, Chunk ${Math.floor(i/CHUNK_SIZE) + 1}: Creating ${chunk.length} assets...`);
        // For debugging the payload for root level:
        if (levelGroup.level === 0 && i === 0) { // First chunk of root level
            console.log("Payload for root level first chunk (SENT TO API):", JSON.stringify(chunk, null, 2));
        }
        const response = await apiClient.post<ApiBulkResponse>(
          '/AssetService/Assets/Bulk/Create',
          chunk
        );
        
        // ADDED: Log the raw successful results from the API for the first chunk of the root level
        if (levelGroup.level === 0 && i === 0 && response.data) {
            console.log("RAW API Response (SUCCESSES) for root level first chunk:", JSON.stringify(response.data.results || [], null, 2));
            // ADDED: Log errors specifically for the first chunk of the root level
            if (response.data.errors && response.data.errors.length > 0) {
                console.error("RAW API Response (ERRORS) for root level first chunk:", JSON.stringify(response.data.errors, null, 2));
            }
        }

        if (response.data) {
          const successfulApiAssets = response.data.results || []; // These are CreatedAsset from API
          const erroredApiAssets = response.data.errors || [];    // These are raw errors from API

          // MODIFIED SUCCESS/ERROR MAPPING LOGIC:
          const errorIndicesInChunk = new Set<number>();
          erroredApiAssets.forEach(err => {
            if (err.debugInfo && typeof err.debugInfo.objectIndex === 'number') {
              errorIndicesInChunk.add(err.debugInfo.objectIndex);
            }
            // Log all API errors directly, referencing the input chunk for context
            const failedAssetInChunk = (err.debugInfo && typeof err.debugInfo.objectIndex === 'number' && err.debugInfo.objectIndex < chunk.length) 
                                       ? chunk[err.debugInfo.objectIndex] 
                                       : null;
            allFailures.push({
              objectIndex: err.debugInfo?.objectIndex, // Index within the current chunk
              errorKey: err.errorKey || 'UnknownApiError',
              message: err.message || 'An unknown API error occurred.',
              assetName: failedAssetInChunk?.name || 'Unknown from API error',
              assetExternalId: failedAssetInChunk?.externalId || 'Unknown from API error',
            });
          });

          let successCursor = 0;
          chunk.forEach((inputAsset, chunkIndex) => {
            if (!errorIndicesInChunk.has(chunkIndex)) { // If this index was not an error
              if (successCursor < successfulApiAssets.length) {
                const apiAsset = successfulApiAssets[successCursor++]; // Get the next successful asset from API response
                
                // `inputAsset.externalId` here IS node.fullPath
                if (inputAsset.externalId && apiAsset.assetId) {
                  idOfPath[inputAsset.externalId] = apiAsset.assetId;
                  // Ensure the asset pushed to allSuccesses contains our original externalId for caching
                  allSuccesses.push({ 
                    ...apiAsset, // spread fields from API (name, assetId, parentId from server)
                    externalId: inputAsset.externalId // ensure our local externalId is preserved
                  });
                  console.log(`Successfully mapped: ${inputAsset.externalId} -> ${apiAsset.assetId}`);
                } else {
                  // This case implies API returned a success but missing assetId, or our input was missing externalId
                  console.warn(`Could not map successful asset: API asset ID or input externalId missing. API Asset: ${JSON.stringify(apiAsset)}, Input: ${JSON.stringify(inputAsset)}`);
                  allFailures.push({
                    errorKey: "MappingErrorOnSuccess",
                    message: `Asset "${apiAsset.name || inputAsset.name}" reported as success by API but assetId missing or input externalId missing for mapping.`,
                    assetName: apiAsset.name || inputAsset.name,
                    assetExternalId: inputAsset.externalId
                  });
                }
              } else {
                // This implies more successes in chunk than in API response results, after accounting for errors
                console.warn(`Mismatch in success count for chunk. Input asset at index ${chunkIndex} ("${inputAsset.name}") was not in API errors, but no corresponding API success result found.`);
                allFailures.push({
                  errorKey: 'MissingApiSuccessRecord',
                  message: `Asset "${inputAsset.name}" was not in API errors, but no corresponding API success result found.`,
                  assetName: inputAsset.name,
                  assetExternalId: inputAsset.externalId
                });
              }
            }
          });
          // REMOVED the old loop that directly used apiAsset.externalId and logged MissingExternalIdOnSuccess

        } else {
           console.warn(`Unexpected empty or malformed response data from bulk create for level ${levelGroup.level}, chunk starting at original index ${i}`);
           chunk.forEach((assetInChunk, chunkIndex) => {
               allFailures.push({
                   objectIndex: chunkIndex,
                   errorKey: 'ChunkProcessingError',
                   message: 'Failed to process chunk or malformed API response.',
                   assetName: assetInChunk.name,
                   assetExternalId: assetInChunk.externalId
               });
           });
        }
      } catch (err: any) {
        console.error(`Error processing chunk for level ${levelGroup.level}, starting at original index ${i}:`, err);
        const errorMsg = err.response?.data?.message || err.message || 'Unknown error during chunk processing.';
        chunk.forEach((assetInChunk, chunkIndex) => {
          allFailures.push({
            objectIndex: chunkIndex,
            errorKey: err.response?.data?.errorKey || 'NetworkOrServerError',
            message: `Failed to process chunk for asset "${assetInChunk.name}": ${errorMsg}`,
            assetName: assetInChunk.name,
            assetExternalId: assetInChunk.externalId,
          });
        });
      }
    }
    // if (onProgress) onProgress({ currentLevel: levelIndex + 1, totalLevels: levels.length, successesThisLevel: payloadForCurrentLevel.length - (allFailures.filter(f => f.level === levelGroup.level).length), errorsThisLevel: (allFailures.filter(f => f.level === levelGroup.level).length) });
    console.log(`Finished processing level ${levelGroup.level}. Total successes so far: ${allSuccesses.length}, Total failures so far: ${allFailures.length}`);
  } // End of levels loop

  return { successes: allSuccesses, failures: allFailures };
}

// Type for the mutation function remains the same, but variables type changes
type BulkAssetMutationFn = (variables: MutationVariables) => Promise<ProcessedBulkResponse>;

export function useBulkAssets(): UseMutationResult<ProcessedBulkResponse, Error, MutationVariables> {
  const { token, apiUrl } = useAuth();

  const actualMutationFn: BulkAssetMutationFn = (variables: MutationVariables) => {
    if (!token || !apiUrl) {
      return Promise.reject(new Error('Authentication token or API URL is not available.'));
    }
    if (!variables.levels || variables.levels.length === 0) {
      console.log("No levels to process for bulk asset creation.");
      return Promise.resolve({ successes: [], failures: [] });
    }
    // Call the new level-by-level function
    return bulkCreateAssetsByLevelApi(variables.levels, token, apiUrl /*, variables.onProgress */);
  };

  return useMutation<ProcessedBulkResponse, Error, MutationVariables>({
    mutationFn: actualMutationFn,
    onSuccess: async (data: ProcessedBulkResponse, variables: MutationVariables) => {
      // The 'variables.assets.length' is no longer valid as 'variables' now contains 'levels'.
      // We need to calculate total attempted assets differently if needed for logging.
      let totalAttemptedAssets = 0;
      variables.levels.forEach(level => totalAttemptedAssets += level.nodes.length);
      
      console.log('Bulk asset creation by level API call finished.');
      console.log(`${data.successes.length}/${totalAttemptedAssets} assets created successfully across all levels.`);
      
      if (data.failures.length > 0) {
        console.warn(`${data.failures.length} errors occurred across all levels:`);
        data.failures.forEach(fail => {
          // Updated logging for failures
          const failureMessage = `  Asset: "${fail.assetName}" (ExternalID: ${fail.assetExternalId || 'N/A'}) - Error: ${fail.errorKey} - ${fail.message}${fail.objectIndex !== undefined ? ` (Chunk Index: ${fail.objectIndex})` : ''}`;
          console.warn(failureMessage);
        });
      }

      // --- IndexedDB Caching (should still work if externalId is correctly passed) ---
      if (data.successes.length > 0) {
        console.log('Caching successful assets to IndexedDB...');
        try {
          for (const asset of data.successes) {
            // Ensure externalId (which should be node.fullPath) and assetId are present
            if (asset.externalId && asset.assetId) {
              await idb.writeData(idb.ASSET_CACHE_STORE, {
                excelRowKey: asset.externalId, // Using externalId (fullPath) as the key
                assetId: asset.assetId,
                name: asset.name,
                parentId: asset.parentId
              });
            } else {
              console.warn('Skipping cache for asset due to missing externalId or assetId', asset);
            }
          }
          console.log('Finished caching assets.');
        } catch (cacheError) {
          console.error('Error during IndexedDB caching:', cacheError);
        }
      }
    },
    onError: (error: Error, variables: MutationVariables) => {
      console.error('Bulk asset creation by level mutation failed globally:', error.message);
    },
  });
} 