import { useState } from 'react';
import * as XLSX from 'xlsx';

// Re-define or import ExcelData if it's shared
// For now, defining it here for clarity matching the store's structure
export interface ExcelData {
  sheets: string[];
  headers: string[];
  rows: any[][]; // Assuming rows will be array of arrays after header extraction
  activeSheet: string;
}

interface ExcelRowObject {
  [key: string]: any;
}

interface UseExcelParseReturn {
  parsedData: ExcelData | null;
  isParsing: boolean;
  error: Error | null;
  parseFile: (file: File) => Promise<void>;
  // Optional: a function to clear/reset state if needed
  // clearData: () => void;
}

export const useExcelParse = (): UseExcelParseReturn => {
  const [parsedData, setParsedData] = useState<ExcelData | null>(null);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const parseFile = async (file: File): Promise<void> => {
    setIsParsing(true);
    setError(null);
    setParsedData(null); // Clear previous data

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const arrayBuffer = event.target?.result;
          if (!arrayBuffer) {
            throw new Error('Failed to read file buffer.');
          }
          const workbook = XLSX.read(arrayBuffer, { type: 'array' });
          
          const sheetNames = workbook.SheetNames;
          if (sheetNames.length === 0) {
            throw new Error('No sheets found in the workbook.');
          }
          
          const activeSheetName = sheetNames[0]; // Default to the first sheet
          const worksheet = workbook.Sheets[activeSheetName];
          
          // Get headers: XLSX.utils.sheet_to_json with header:1 gives an array of arrays,
          // the first inner array is the header row.
          const headerRows = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1 });
          const headers: string[] = headerRows.length > 0 ? headerRows[0] : [];
          
          // Get data rows as array of objects (original behavior)
          const jsonDataObjects = XLSX.utils.sheet_to_json<ExcelRowObject>(worksheet);

          // Convert array of objects to array of arrays for the `rows` field in ExcelData
          // This aligns `rows` with a more generic table structure if needed later
          // or you could keep jsonDataObjects if `rows: ExcelRowObject[]` is preferred in ExcelData
          const dataRowsAsArrays: any[][] = jsonDataObjects.map(obj => headers.map(header => obj[header]));
          
          setParsedData({
            sheets: sheetNames,
            headers: headers,
            rows: dataRowsAsArrays, // or jsonDataObjects if you change ExcelData.rows type
            activeSheet: activeSheetName,
          });
          setIsParsing(false);
          resolve();
        } catch (e: any) {
          setError(e instanceof Error ? e : new Error('An unknown error occurred during parsing.'));
          setIsParsing(false);
          reject(e);
        }
      };
      reader.onerror = (err) => {
        setError(new Error('FileReader error.'));
        setIsParsing(false);
        reject(err);
      };
      reader.readAsArrayBuffer(file);
    });
  };

  // const clearData = () => {
  //   setParsedData(null);
  //   setError(null);
  //   // Potentially reset other states like acceptedFileName in the component
  // };

  return {
    parsedData,
    isParsing,
    error,
    parseFile,
    // clearData
  };
}; 