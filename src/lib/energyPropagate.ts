import { Asset } from '../types';

// Interfaces for the energy types and mapping
export interface EnergyMap {
  [assetId: string]: string; // Maps asset ID to energy type
}

export interface ParentMap {
  [assetId: string]: string; // Maps asset ID to its parent ID
}

export type EnergyType = 'electricity' | 'gas' | 'water' | 'thermal' | 'other';

// Interface representing flags to be set on parent assets
export interface EnergyFlags {
  isElectricity?: boolean;
  isGas?: boolean;
  isWater?: boolean;
  isThermal?: boolean;
}

/**
 * Builds a parent mapping from assets (child -> parent relationship)
 * @param assets - Array of all assets
 * @returns A mapping of child asset IDs to their parent asset IDs
 */
export function buildParentMap(assets: Asset[]): ParentMap {
  const parentMap: ParentMap = {};
  
  for (const asset of assets) {
    if (asset.parentId) {
      parentMap[asset.id] = asset.parentId;
    }
  }
  
  return parentMap;
}

/**
 * Identifies leaf assets (assets with no children)
 * @param assets - Array of all assets
 * @returns Array of leaf asset IDs
 */
export function identifyLeafAssets(assets: Asset[]): string[] {
  // Create a set of all possible parent IDs
  const parentIds = new Set<string>();
  for (const asset of assets) {
    if (asset.parentId) {
      parentIds.add(asset.parentId);
    }
  }
  
  // Return assets that are not parents
  return assets
    .filter(asset => !parentIds.has(asset.id))
    .map(asset => asset.id);
}

/**
 * Determines the energy flags to set on a parent based on children's energy types
 * @param childrenEnergyTypes - Array of energy types from children
 * @returns Object with boolean flags for each energy type
 */
export function determineEnergyFlags(childrenEnergyTypes: string[]): EnergyFlags {
  const flags: EnergyFlags = {};
  const uniqueTypes = new Set(childrenEnergyTypes);
  
  if (uniqueTypes.has('electricity')) flags.isElectricity = true;
  if (uniqueTypes.has('gas')) flags.isGas = true;
  if (uniqueTypes.has('water')) flags.isWater = true;
  if (uniqueTypes.has('thermal')) flags.isThermal = true;
  
  return flags;
}

/**
 * Propagates energy types up the asset hierarchy
 * @param energyMap - Mapping of asset IDs to energy types (usually just leaf nodes)
 * @param parentMap - Mapping of child asset IDs to parent asset IDs
 * @returns A mapping of parent asset IDs to their energy flags
 */
export function propagateEnergyTypes(
  energyMap: EnergyMap,
  parentMap: ParentMap
): Record<string, EnergyFlags> {
  const result: Record<string, EnergyFlags> = {};
  const processed = new Set<string>();
  const parentChildrenMap: Record<string, string[]> = {};
  
  // Build reverse mapping (parent -> children)
  Object.entries(parentMap).forEach(([childId, parentId]) => {
    if (!parentChildrenMap[parentId]) {
      parentChildrenMap[parentId] = [];
    }
    parentChildrenMap[parentId].push(childId);
  });
  
  // Process all assets with energy types (leaf nodes)
  const processAsset = (assetId: string, energyType: string) => {
    if (processed.has(assetId)) return;
    processed.add(assetId);
    
    // Process parent if it exists
    const parentId = parentMap[assetId];
    if (parentId) {
      // Get all energy types from children of this parent
      const childrenEnergyTypes: string[] = [];
      
      // Add the current asset's energy type
      childrenEnergyTypes.push(energyType);
      
      // Add energy types from other children of this parent
      const otherChildren = parentChildrenMap[parentId] || [];
      for (const otherChildId of otherChildren) {
        if (energyMap[otherChildId]) {
          childrenEnergyTypes.push(energyMap[otherChildId]);
        }
      }
      
      // Determine flags and set on the parent
      const flags = determineEnergyFlags(childrenEnergyTypes);
      result[parentId] = flags;
      
      // Continue upward propagation
      for (const type of childrenEnergyTypes) {
        processAsset(parentId, type);
      }
    }
  };
  
  // Start propagation from each leaf node
  Object.entries(energyMap).forEach(([assetId, energyType]) => {
    processAsset(assetId, energyType);
  });
  
  return result;
} 