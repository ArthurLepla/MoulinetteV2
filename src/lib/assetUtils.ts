import { AssetToCreate } from '@/hooks/useBulkAssets';     // adjust if path differs
import { ExcelData }      from '@/store/excelStore';
import { MappingConfig }  from '@/components/mapping-modal';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Return the uniqueKey used in mapping (“header” or “_col_X”) → column index */
const columnKeyToIndex = (uniqueKey: string, headers: string[]): number => {
  if (headers.includes(uniqueKey)) return headers.indexOf(uniqueKey);
  const match = uniqueKey.match(/_col_(\d+)/);
  return match ? Number(match[1]) : -1;
};

/** Fetch a cell by mapping type / level */
const getCell = (
  row   : any[],
  type  : 'level' | 'EnergyType',
  level : number | undefined,
  cfg   : MappingConfig,
  headers: string[]
): string | null => {
  // find the uniqueKey of the column mapped to this type/level
  const uniqueKey = Object.entries(cfg.columnMappings).find(
    ([, m]) =>
      (m.type === 'level' && type === 'level' && m.level === level) ||
      (m.type === 'EnergyType' && type === 'EnergyType')
  )?.[0];
  if (!uniqueKey) return null;

  const idx = columnKeyToIndex(uniqueKey, headers);
  if (idx === -1 || idx >= row.length) return null;

  const v = row[idx];
  return v === undefined || v === null ? null : String(v).trim();
};

/* ------------------------------------------------------------------ */
/* MAIN : buildAssetLevels                                             */
/* ------------------------------------------------------------------ */

// Polyfill for crypto.randomUUID if not available
if (typeof window !== 'undefined') { // Ensure we are in a browser environment
  // @ts-ignore
  if (!window.crypto) {
    // @ts-ignore
    window.crypto = {}; // Create crypto object if it doesn't exist
  }

  // @ts-ignore
  if (!window.crypto.randomUUID) {
    // @ts-ignore
    window.crypto.randomUUID = function randomUUID() {
      // Basic UUID v4 implementation
      // Ensure crypto.getRandomValues is available for the polyfill
      // @ts-ignore
      if (!window.crypto.getRandomValues) {
        // Basic fallback for getRandomValues if it's also missing.
        // NOTE: This fallback is NOT cryptographically secure.
        // For production, a more robust polyfill for getRandomValues would be needed
        // if this environment is commonly encountered.
        // @ts-ignore
        window.crypto.getRandomValues = function(buffer: Uint8Array) {
          for (let i = 0; i < buffer.length; i++) {
            buffer[i] = Math.floor(Math.random() * 256);
          }
          return buffer;
        };
      }
      // @ts-ignore
      return (([1e7])+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, (c: number) =>
        (c ^ (window.crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)
      );
    };
  }
}

export interface AssetNode {
  name: string;
  parentPath: string | null; // "ROOT" or path key (e.g., "USINE@FACILITIES")
  fullPath: string; // Full path key for this node (e.g., "USINE@FACILITIES@LT3")
  externalId?: string; // Optional: can be fullPath or another unique identifier from Excel
}

export interface AssetLevel {
  level: number;
  nodes: AssetNode[];
}

/**
 * Convert parsed Excel rows + mapping into an array of levels,
 * with each level containing nodes to be created.
 */
export function buildAssetLevels(
  excel: ExcelData,
  cfg  : MappingConfig,
  maxHierarchyDepth = 10 // Max depth of asset hierarchy
): AssetLevel[] {
  const { headers, rows } = excel;
  
  // Store nodes temporarily keyed by their full path to avoid duplicates
  // and easily retrieve them for level structuring.
  const allNodesByPath: Map<string, { name: string; parentPath: string | null; level: number }> = new Map();

  for (const row of rows) {
    const pathSegments: string[] = [];
    for (let lv = 0; lv < maxHierarchyDepth; lv++) {
      const cellValue = getCell(row, 'level', lv, cfg, headers);
      if (!cellValue || cellValue.trim() === '') {
        // If a level is missing or empty, stop processing this path for the current row
        break; 
      }
      pathSegments.push(cellValue.trim());

      // For each segment in the path, ensure a node is registered
      const currentPathKey = pathSegments.join('@');
      if (!allNodesByPath.has(currentPathKey)) {
        const name = pathSegments[pathSegments.length - 1];
        const parentPathKey = pathSegments.length === 1 ? null : pathSegments.slice(0, -1).join('@');
        allNodesByPath.set(currentPathKey, {
          name: name,
          parentPath: parentPathKey,
          level: pathSegments.length - 1 // 0-indexed level
        });
      }
    }
  }

  // Group nodes by level
  const levels: AssetLevel[] = [];
  allNodesByPath.forEach((nodeDetails, fullPath) => {
    const level = nodeDetails.level;
    if (!levels[level]) {
      levels[level] = { level: level, nodes: [] };
    }
    levels[level].nodes.push({
      name: nodeDetails.name,
      parentPath: nodeDetails.parentPath,
      fullPath: fullPath, // Store the full path for later ID mapping
      externalId: fullPath // Example: using fullPath as externalId
    });
  });

  // Filter out any potentially empty levels if maxHierarchyDepth was too high
  return levels.filter(level => level && level.nodes.length > 0);
} 