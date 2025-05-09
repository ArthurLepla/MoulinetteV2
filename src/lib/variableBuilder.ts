import { Asset, Variable, EnergyType } from '../types';
import { EnergyMap } from './energyPropagate';

// Template-based variable configuration
export interface VariableTemplate {
  nameSuffix: string;
  topicSuffix: string;
  dataType: 'Double' | 'Boolean' | 'String' | 'Integer';
  description?: string;
  units?: string;
  applyToEnergyTypes: EnergyType[];
}

// Standard templates for common energy variables
export const defaultVariableTemplates: Record<string, VariableTemplate[]> = {
  electricity: [
    {
      nameSuffix: 'Power',
      topicSuffix: 'power',
      dataType: 'Double',
      units: 'kW',
      description: 'Electricity power consumption',
      applyToEnergyTypes: ['electricity']
    },
    {
      nameSuffix: 'Energy',
      topicSuffix: 'energy',
      dataType: 'Double',
      units: 'kWh',
      description: 'Electricity energy consumption',
      applyToEnergyTypes: ['electricity']
    },
    {
      nameSuffix: 'Voltage',
      topicSuffix: 'voltage',
      dataType: 'Double',
      units: 'V',
      description: 'Electricity voltage level',
      applyToEnergyTypes: ['electricity']
    },
    {
      nameSuffix: 'State',
      topicSuffix: 'state',
      dataType: 'Boolean',
      description: 'On/Off state',
      applyToEnergyTypes: ['electricity']
    }
  ],
  gas: [
    {
      nameSuffix: 'Flow',
      topicSuffix: 'flow',
      dataType: 'Double',
      units: 'm³/h',
      description: 'Gas flow rate',
      applyToEnergyTypes: ['gas']
    },
    {
      nameSuffix: 'Volume',
      topicSuffix: 'volume',
      dataType: 'Double',
      units: 'm³',
      description: 'Gas volume consumption',
      applyToEnergyTypes: ['gas']
    },
    {
      nameSuffix: 'Pressure',
      topicSuffix: 'pressure',
      dataType: 'Double',
      units: 'bar',
      description: 'Gas pressure',
      applyToEnergyTypes: ['gas']
    }
  ],
  water: [
    {
      nameSuffix: 'Flow',
      topicSuffix: 'flow',
      dataType: 'Double',
      units: 'm³/h',
      description: 'Water flow rate',
      applyToEnergyTypes: ['water']
    },
    {
      nameSuffix: 'Volume',
      topicSuffix: 'volume',
      dataType: 'Double',
      units: 'm³',
      description: 'Water volume consumption',
      applyToEnergyTypes: ['water']
    },
    {
      nameSuffix: 'Temperature',
      topicSuffix: 'temperature',
      dataType: 'Double',
      units: '°C',
      description: 'Water temperature',
      applyToEnergyTypes: ['water']
    },
    {
      nameSuffix: 'Pressure',
      topicSuffix: 'pressure',
      dataType: 'Double',
      units: 'bar',
      description: 'Water pressure',
      applyToEnergyTypes: ['water']
    }
  ],
  thermal: [
    {
      nameSuffix: 'Power',
      topicSuffix: 'power',
      dataType: 'Double',
      units: 'kW',
      description: 'Thermal power',
      applyToEnergyTypes: ['thermal']
    },
    {
      nameSuffix: 'Energy',
      topicSuffix: 'energy',
      dataType: 'Double',
      units: 'kWh',
      description: 'Thermal energy consumption',
      applyToEnergyTypes: ['thermal']
    },
    {
      nameSuffix: 'Flow Temperature',
      topicSuffix: 'flow_temperature',
      dataType: 'Double',
      units: '°C',
      description: 'Thermal flow temperature',
      applyToEnergyTypes: ['thermal']
    },
    {
      nameSuffix: 'Return Temperature',
      topicSuffix: 'return_temperature',
      dataType: 'Double',
      units: '°C',
      description: 'Thermal return temperature',
      applyToEnergyTypes: ['thermal']
    }
  ]
};

/**
 * Creates a standard variable name from the asset name and variable suffix
 * @param assetName - Name of the asset
 * @param suffix - Variable name suffix
 * @returns Formatted variable name
 */
export function formatVariableName(assetName: string, suffix: string): string {
  // Remove special characters, replace spaces with underscores
  const sanitizedAssetName = assetName
    .replace(/[^\w\s]/gi, '')
    .replace(/\s+/g, '_');
  
  return `${sanitizedAssetName}_${suffix}`;
}

/**
 * Creates a standard topic path for a variable
 * @param assetId - ID of the asset
 * @param adapterId - ID of the adapter
 * @param suffix - Topic suffix
 * @returns Formatted topic path
 */
export function formatTopicPath(assetId: string, adapterId: string, suffix: string): string {
  return `/${adapterId}/${assetId}/${suffix}`;
}

// Helper function to normalize energy type strings
const normalizeEnergyType = (energyInput: string): EnergyType | string => {
  const normalized = energyInput.toLowerCase().trim();
  if (normalized.includes('elec') || normalized.includes('élect')) return 'electricity';
  if (normalized.includes('gas') || normalized.includes('gaz')) return 'gas';
  if (normalized.includes('water') || normalized.includes('eau')) return 'water';
  if (normalized.includes('air')) return 'air'; // Assuming 'air' is a valid EnergyType or handled
  if (normalized.includes('thermal') || normalized.includes('thermique')) return 'thermal';
  // Add more mappings as needed
  return energyInput; // Return original if no specific mapping found, or handle as unknown
};

/**
 * Builds an array of variables based on the assets and their energy types
 * @param assets - Array of assets
 * @param energyMap - Mapping of asset IDs to energy types
 * @param adapterId - Selected adapter ID
 * @param templates - Optional custom variable templates
 * @returns Array of variables
 */
export function buildVariableArray(
  assets: Asset[],
  energyMap: EnergyMap,
  adapterId: string,
  templates: Record<string, VariableTemplate[]> = defaultVariableTemplates
): Variable[] {
  const variables: Variable[] = [];
  
  // Create map of assets by ID for quick lookup
  const assetMap = assets.reduce((map, asset) => {
    map[asset.id] = asset;
    return map;
  }, {} as Record<string, Asset>);
  
  // Process each asset that has an energy type
  Object.entries(energyMap).forEach(([assetId, energyTypeInput]) => {
    const asset = assetMap[assetId];
    if (!asset) return; // Skip if asset not found
    
    const normalizedEnergyType = normalizeEnergyType(energyTypeInput);
    
    // Get templates for this energy type
    const energyTemplates = templates[normalizedEnergyType as EnergyType] || [];
    
    // Create variables based on templates
    for (const template of energyTemplates) {
      // Ensure the template is applicable, comparing with the normalized energy type
      if (template.applyToEnergyTypes.includes(normalizedEnergyType as EnergyType)) {
        const variable: Variable = {
          name: formatVariableName(asset.name, template.nameSuffix),
          topic: formatTopicPath(assetId, adapterId, template.topicSuffix),
          dataType: template.dataType,
          description: template.description,
          units: template.units,
          assetId: assetId
        };
        
        variables.push(variable);
      }
    }
  });
  
  return variables;
} 