import { useState } from 'react';
import * as XLSX from 'xlsx';

interface UseExcelParseOptions {
  // Potentielles options futures, par exemple pour spécifier des feuilles ou des en-têtes
}

interface ExcelRow {
  [key: string]: any;
}

interface UseExcelParseReturn {
  parsedData: ExcelRow[] | null;
  isParsing: boolean;
  error: Error | null;
  parseFile: (file: File) => Promise<void>;
}

export const useExcelParse = (options?: UseExcelParseOptions): UseExcelParseReturn => {
  const [parsedData, setParsedData] = useState<ExcelRow[] | null>(null);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const parseFile = async (file: File): Promise<void> => {
    setIsParsing(true);
    setError(null);
    setParsedData(null);

    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const arrayBuffer = event.target?.result;
          if (!arrayBuffer) {
            throw new Error('Failed to read file buffer.');
          }
          const workbook = XLSX.read(arrayBuffer, { type: 'array' });
          
          // Pour l'instant, on lit la première feuille.
          // On pourra rendre ça configurable plus tard.
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          // Convertir la feuille en JSON.
          // XLSX.utils.sheet_to_json convertit par défaut chaque ligne en objet.
          const jsonData = XLSX.utils.sheet_to_json<ExcelRow>(worksheet);
          
          setParsedData(jsonData);
        } catch (e: any) {
          setError(e instanceof Error ? e : new Error('An unknown error occurred during parsing.'));
        } finally {
          setIsParsing(false);
        }
      };
      reader.onerror = () => {
        setError(new Error('FileReader error.'));
        setIsParsing(false);
      };
      reader.readAsArrayBuffer(file);
    } catch (e: any) {
      setError(e instanceof Error ? e : new Error('An unknown error occurred.'));
      setIsParsing(false);
    }
  };

  return {
    parsedData,
    isParsing,
    error,
    parseFile,
  };
}; 