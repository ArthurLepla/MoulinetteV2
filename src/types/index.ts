// Assets
export interface Asset {
  id: string;
  name: string;
  parentId?: string; 
  assetTypeId?: string;
  assetType?: string;
  attributes?: AssetAttribute[];
  isElectricity?: boolean;
  isGas?: boolean;
  isWater?: boolean;
  isThermal?: boolean;
}

export interface AssetAttribute {
  key: string;
  value: string;
}

// Variables
export interface Variable {
  name: string;
  topic: string;
  dataType: 'Double' | 'Boolean' | 'String' | 'Integer';
  description?: string;
  units?: string;
  assetId: string;
}

// Mapping
export interface MappingConfig {
  idField: string;
  nameField: string;
  parentIdField: string;
  assetTypeField?: string;
  [key: string]: string | undefined;
}

// Energy
export type EnergyType = 'electricity' | 'gas' | 'water' | 'thermal' | 'other';

// Adapter
export interface Adapter {
  id: string;
  name: string;
  description?: string;
} 