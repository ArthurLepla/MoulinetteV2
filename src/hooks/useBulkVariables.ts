import { useState } from 'react';
import { AxiosInstance } from 'axios';
import { Variable } from '../types';

interface UseBulkVariablesReturn {
  isCreating: boolean;
  progress: number;
  error: Error | null;
  createVariablesBulk: (
    variables: Variable[], 
    client: AxiosInstance, 
    chunkSize?: number,
    onProgress?: (processed: number, total: number) => void
  ) => Promise<boolean>;
}

/**
 * Hook for creating variables in bulk with progress tracking
 * @returns Functions and state for bulk variable creation
 */
export const useBulkVariables = (): UseBulkVariablesReturn => {
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Create variables in bulk with chunking to avoid overwhelming the API
   * @param variables - Array of variables to create
   * @param client - Axios client instance
   * @param chunkSize - Size of chunks to process (default: 1000)
   * @param onProgress - Optional callback for progress updates
   * @returns Promise resolving to success boolean
   */
  const createVariablesBulk = async (
    variables: Variable[],
    client: AxiosInstance,
    chunkSize = 1000,
    onProgress?: (processed: number, total: number) => void
  ): Promise<boolean> => {
    if (variables.length === 0) {
      return true; // Nothing to do
    }

    setIsCreating(true);
    setProgress(0);
    setError(null);

    try {
      const totalCount = variables.length;
      let processedCount = 0;

      // Split variables into chunks
      const chunks: Variable[][] = [];
      for (let i = 0; i < variables.length; i += chunkSize) {
        chunks.push(variables.slice(i, i + chunkSize));
      }

      // Process each chunk sequentially
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        try {
          // Send bulk request for this chunk
          await client.post('/DataService/Variables/Bulk/Create', chunk);
          
          // Update progress
          processedCount += chunk.length;
          const currentProgress = Math.round((processedCount / totalCount) * 100);
          setProgress(currentProgress);
          
          // Call progress callback if provided
          if (onProgress) {
            onProgress(processedCount, totalCount);
          }
        } catch (err) {
          console.error(`Error creating variables chunk ${i + 1}/${chunks.length}:`, err);
          // Continue with next chunk despite errors
        }
      }

      setProgress(100);
      return true;
    } catch (err: any) {
      const error = err instanceof Error
        ? err
        : new Error('Unknown error during bulk variable creation');
      setError(error);
      return false;
    } finally {
      setIsCreating(false);
    }
  };

  return {
    isCreating,
    progress,
    error,
    createVariablesBulk
  };
}; 