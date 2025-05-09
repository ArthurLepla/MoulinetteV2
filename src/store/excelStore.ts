import { create } from 'zustand';

interface ExcelData {
  sheets: string[];
  headers: string[];
  rows: any[][];
  activeSheet: string;
}

interface ExcelStoreState {
  parsedData: ExcelData | null;
  setParsedData: (data: ExcelData | null) => void;
}

export const useExcelStore = create<ExcelStoreState>((set) => ({
  parsedData: null,
  setParsedData: (data) => set({ parsedData: data }),
})); 