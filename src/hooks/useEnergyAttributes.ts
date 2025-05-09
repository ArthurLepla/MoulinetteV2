import { useState } from 'react';
import { AxiosInstance } from 'axios';
import { Asset } from '../types';
import { anchorService } from '../lib/anchorClient';
import { 
  buildParentMap, 
  identifyLeafAssets, 
  propagateEnergyTypes, 
  EnergyMap, 
  ParentMap, 
  EnergyType, 
  EnergyFlags 
} from '../lib/energyPropagate';

interface UseEnergyAttributesReturn {
  isTagging: boolean;
  isPropagating: boolean;
  error: Error | null;
  energyMap: EnergyMap;
  energyFlags: Record<string, EnergyFlags>;
  tagLeaves: (assets: Asset[], leafEnergyMap: Record<string, EnergyType>, client: AxiosInstance) => Promise<EnergyMap>;
  propagate: (assets: Asset[], energyMap: EnergyMap, client: AxiosInstance) => Promise<Record<string, EnergyFlags>>;
}

/**
 * Hook to manage energy attribute tagging and propagation on assets
 */
export const useEnergyAttributes = (): UseEnergyAttributesReturn => {
  const [isTagging, setIsTagging] = useState<boolean>(false);
  const [isPropagating, setIsPropagating] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [energyMap, setEnergyMap] = useState<EnergyMap>({});
  const [energyFlags, setEnergyFlags] = useState<Record<string, EnergyFlags>>({});

  /**
   * Tag leaf assets with energy type attributes
   * @param assets - All assets in the hierarchy
   * @param leafEnergyMap - Mapping of leaf asset IDs to their energy types
   * @param client - Configured Axios instance for the Anchor API
   * @returns Updated energy map
   */
  const tagLeaves = async (
    assets: Asset[],
    leafEnergyMap: Record<string, EnergyType>,
    client: AxiosInstance
  ): Promise<EnergyMap> => {
    setIsTagging(true);
    setError(null);
    
    try {
      const leafAssets = identifyLeafAssets(assets);
      const updatedEnergyMap: EnergyMap = { ...energyMap };
      
      // Process leaf assets in sequence (could be optimized with Promise.all if API supports it)
      for (const leafId of leafAssets) {
        const energyType = leafEnergyMap[leafId];
        
        if (energyType) {
          try {
            // Add 'energyType' attribute to the leaf asset
            await anchorService.addAssetAttribute(
              client,
              leafId,
              'energyType',
              energyType
            );
            
            // Update the energy map with the successfully tagged asset
            updatedEnergyMap[leafId] = energyType;
          } catch (err) {
            console.error(`Failed to tag asset ${leafId}:`, err);
            // Continue with other assets even if one fails
          }
        }
      }
      
      setEnergyMap(updatedEnergyMap);
      return updatedEnergyMap;
    } catch (err: any) {
      const error = err instanceof Error 
        ? err 
        : new Error('Unknown error during energy tagging');
      setError(error);
      throw error;
    } finally {
      setIsTagging(false);
    }
  };

  /**
   * Propagate energy types from leaf assets to parents as flags
   * @param assets - All assets in the hierarchy
   * @param energyMap - Mapping of asset IDs to energy types
   * @param client - Configured Axios instance for the Anchor API
   * @returns Mapping of parent asset IDs to their energy flags
   */
  const propagate = async (
    assets: Asset[],
    energyMap: EnergyMap,
    client: AxiosInstance
  ): Promise<Record<string, EnergyFlags>> => {
    setIsPropagating(true);
    setError(null);
    
    try {
      // Build parent mapping
      const parentMap = buildParentMap(assets);
      
      // Propagate energy types up the hierarchy
      const parentEnergyFlags = propagateEnergyTypes(energyMap, parentMap);
      
      // Update assets with energy flags using PATCH
      for (const [assetId, flags] of Object.entries(parentEnergyFlags)) {
        try {
          await anchorService.updateAsset(client, assetId, flags);
        } catch (err) {
          console.error(`Failed to update asset ${assetId} with flags:`, err);
          // Continue with other assets even if one fails
        }
      }
      
      setEnergyFlags(parentEnergyFlags);
      return parentEnergyFlags;
    } catch (err: any) {
      const error = err instanceof Error 
        ? err 
        : new Error('Unknown error during energy propagation');
      setError(error);
      throw error;
    } finally {
      setIsPropagating(false);
    }
  };

  return {
    isTagging,
    isPropagating,
    error,
    energyMap,
    energyFlags,
    tagLeaves,
    propagate
  };
}; 