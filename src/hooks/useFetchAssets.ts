import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { useAssetStore } from '@/store/assetStore';
import { useVariableStore } from '@/store/variableStore';
import { createApiClient } from '@/lib/apiClient';
import axios from 'axios';
import { createAnchorClient } from '@/lib/anchorClient';

interface AssetData {
  $anchor: string;
  $name?: string;
  [key: string]: any;
}

export function useFetchAssets(options = { showToasts: true }) {
  const { token, apiUrl } = useAuth();
  const { setAnchorMap } = useAssetStore();
  const { setPreviewVariables } = useVariableStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assetsData, setAssetsData] = useState<AssetData[]>([]);

  const fetchAssets = useCallback(async () => {
    if (!token) return;

    setIsLoading(true);
    setError(null);

    if (options.showToasts) {
      toast.loading("Fetching assets...", { id: "fetch-assets" });
    }

    try {
      // Utiliser le proxy Next.js pour contourner CORS
      const proxyClient = axios.create({
        baseURL: '/api/proxy',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      // Step 1: Get all assets
      console.log("Fetching assets from /api/proxy/assets");
      const assetsResponse = await proxyClient.get('/assets');
      
      if (!assetsResponse.data || !Array.isArray(assetsResponse.data)) {
        throw new Error("Unexpected response format for assets");
      }
      
      const assets: AssetData[] = assetsResponse.data;
      setAssetsData(assets);
      
      if (options.showToasts) {
        toast.success(`Found ${assets.length} assets`, { id: "fetch-assets" });
      }
      
      // Step 2: Fetch details for each asset to get names and variables
      const assetsWithDetails: AssetData[] = [];
      const newAnchorMap: Record<string, string> = {};
      const variables: any[] = [];
      
      toast.loading(`Loading asset details...`, { id: "fetch-asset-details" });
      
      // Process assets in smaller batches to avoid overwhelming the API
      const batchSize = 10;
      const batches = Math.ceil(assets.length / batchSize);
      
      for (let i = 0; i < batches; i++) {
        const batchStart = i * batchSize;
        const batchAssets = assets.slice(batchStart, batchStart + batchSize);
        
        // Process batch in parallel
        const batchPromises = batchAssets.map(async (asset) => {
          try {
            const assetId = asset.$anchor;
            
            // Utiliser selectors=+$name comme attendu par l'API
            const detailResponse = await proxyClient.get(`/assets/${assetId}`, {
              params: {
                selectors: '+$name'
              }
            });
            
            if (detailResponse.data) {
              const assetWithDetails = detailResponse.data;
              
              // Extract and store asset name
              if (assetWithDetails.$name) {
                newAnchorMap[assetWithDetails.$name] = assetId;
              }
              
              // Extract variables (properties with null values)
              Object.entries(assetWithDetails).forEach(([key, value]) => {
                // Skip built-in properties
                if (key.startsWith('$')) return;
                
                // If value is null, it's a variable
                if (value === null) {
                  // Create a variable entry
                  variables.push({
                    id: `${assetId}_${key}`,
                    name: key,
                    assetId: assetId,
                    assetName: assetWithDetails.$name || '',
                    dataType: "Double", // Default, can be refined later
                    units: "",
                    topic: "",
                    level: 0
                  });
                }
              });
              
              return assetWithDetails;
            }
            return null;
          } catch (err) {
            console.error(`Error fetching details for asset ${asset.$anchor}:`, err);
            return null;
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        batchResults.forEach(result => {
          if (result) {
            assetsWithDetails.push(result);
          }
        });
        
        // Update progress
        toast.loading(`Loading asset details: ${Math.min((i + 1) * batchSize, assets.length)}/${assets.length}`, 
          { id: "fetch-asset-details" });
      }
      
      // Update state with the collected data
      setAnchorMap(newAnchorMap);
      setPreviewVariables(variables);
      
      toast.success(`Processed ${assetsWithDetails.length} assets with ${variables.length} variables`, 
        { id: "fetch-asset-details" });
      
    } catch (err: any) {
      console.error("Error fetching assets:", err);
      setError(err.message || "Failed to fetch assets");
      
      if (options.showToasts) {
        toast.error("Error fetching assets", { 
          id: "fetch-assets",
          description: err.message || "An unexpected error occurred" 
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [token, apiUrl, setAnchorMap, setPreviewVariables, options.showToasts]);

  return {
    isLoading,
    error,
    assetsData,
    fetchAssets
  };
} 