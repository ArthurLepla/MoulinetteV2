import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import * as XLSX from 'xlsx';
import { MappingConfig } from '@/components/mapping-modal';

export interface ExcelData {
  sheets: string[];
  headers: string[];
  rows: any[][];
  activeSheet: string;
  fileName?: string;
}

interface ExcelState {
  parsedData: ExcelData | null;
  isLoading: boolean;
  error: string | null;
  mappingConfig: MappingConfig | null;
  parsedExcelData: ExcelData | null;
  setParsedData: (data: ExcelData | null) => void;
  parseExcelFile: (file: File) => Promise<void>;
  setMappingConfig: (config: MappingConfig | null) => void;
  setParsedExcelData: (data: ExcelData | null) => void;
}

export const useExcelStore = create<ExcelState>()(
  immer((set, get) => ({
    parsedData: null,
    isLoading: false,
    error: null,
    mappingConfig: null,
    parsedExcelData: null,
    setParsedData: (data) => {
      const oldData = get().parsedData;
      let shouldResetMapping = true;
      if (data && oldData && JSON.stringify(data.headers) === JSON.stringify(oldData.headers)) {
        shouldResetMapping = false;
      }
      if (!data) {
        shouldResetMapping = true;
      }

      set({
        parsedData: data,
        mappingConfig: shouldResetMapping ? null : get().mappingConfig
      });
    },
    parseExcelFile: async (file: File) => {
      set({ isLoading: true, error: null });
      try {
        const dataBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(dataBuffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) throw new Error("No sheets found");
        const sheet = workbook.Sheets[sheetName];
        const jsonData: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        if (jsonData.length === 0) throw new Error("Sheet empty");

        const headers = (jsonData[0] as string[]).map(String);
        const rows = jsonData.slice(1);
        
        const newParsedData: ExcelData = {
          sheets: workbook.SheetNames,
          headers: headers,
          rows: rows,
          activeSheet: sheetName,
        };

        const oldData = get().parsedData;
        let shouldResetMapping = true;
        if (oldData && JSON.stringify(newParsedData.headers) === JSON.stringify(oldData.headers)) {
            shouldResetMapping = false;
        }

        set({
          parsedData: newParsedData,
          isLoading: false,
          error: null,
          mappingConfig: shouldResetMapping ? null : get().mappingConfig
        });
      } catch (e) {
        let errorMessage = "Unknown error during Excel parsing.";
        if (e instanceof Error) errorMessage = e.message;
        set({ isLoading: false, error: errorMessage, parsedData: null, mappingConfig: null });
      }
    },
    setMappingConfig: (config) => {
      set({ mappingConfig: config });
    },
    setParsedExcelData: (data) => set({ parsedExcelData: data }),
  }))
); 