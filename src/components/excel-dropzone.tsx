import React, { useCallback, useState, useEffect } from 'react';
import { useDropzone, FileWithPath } from 'react-dropzone';
import { useExcelParse, ExcelData } from '@/hooks/use-excel-parse'; // Import ExcelData

// Optionnel: Styles de base pour la dropzone
const baseStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '20px',
  borderWidth: 2,
  borderRadius: 2,
  borderColor: '#eeeeee',
  borderStyle: 'dashed',
  backgroundColor: '#fafafa',
  color: '#bdbdbd',
  outline: 'none',
  transition: 'border .24s ease-in-out',
  cursor: 'pointer'
};

const focusedStyle: React.CSSProperties = {
  borderColor: '#2196f3'
};

const acceptStyle: React.CSSProperties = {
  borderColor: '#00e676'
};

const rejectStyle: React.CSSProperties = {
  borderColor: '#ff1744'
};

interface ExcelDropzoneProps {
  onDataParsed?: (data: ExcelData | null) => void; // Updated to use ExcelData
}

export const ExcelDropzone: React.FC<ExcelDropzoneProps> = ({ onDataParsed }) => {
  const { parsedData, isParsing, error, parseFile } = useExcelParse();
  const [acceptedFileName, setAcceptedFileName] = useState<string | null>(null);
  const [internalError, setInternalError] = useState<string | null>(null); // For file read errors not from parsing

  const onDrop = useCallback(async (acceptedFiles: FileWithPath[]) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      setAcceptedFileName(file.name);
      setInternalError(null); // Clear previous general errors
      try {
        await parseFile(file); // parseFile now returns a promise
        // Data will be passed via useEffect listening to parsedData from the hook
      } catch (e: any) {
        // This catch is for errors during the parseFile promise itself (e.g., file read issues before parsing starts)
        // Errors during the actual XLSX parsing are set in the hook's error state.
        console.error("Error during parseFile invocation:", e);
        setInternalError(e.message || 'Failed to initiate file parsing.');
        if (onDataParsed) {
          onDataParsed(null); // Notify parent of failure
        }
      }
    }
  }, [parseFile, onDataParsed]);

  useEffect(() => {
    if (onDataParsed) {
      if (error) {
        console.log("EXCELDROPZONE: Hook reported a parsing error.");
        onDataParsed(null); 
      } else if (parsedData) {
        console.log("EXCELDROPZONE: Hook has parsedData. Type:", typeof parsedData, "Is Array?", Array.isArray(parsedData), "Data:", parsedData);
        onDataParsed(parsedData);
      } else if (!isParsing && acceptedFileName && !error && !parsedData) {
        // This case handles if a file was accepted, parsing finished, no error, but no data (e.g. empty file or cleared)
        // console.log("ExcelDropzone: Notifying parent of no data after attempt.");
        // onDataParsed(null); // Decide if this should also clear parent data
      }
    }
  }, [parsedData, error, onDataParsed, isParsing, acceptedFileName]);

  const {
    getRootProps,
    getInputProps,
    isFocused,
    isDragAccept,
    isDragReject
  } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    },
    multiple: false
  });

  const style = React.useMemo(() => ({
    ...baseStyle,
    ...(isFocused ? focusedStyle : {}),
    ...(isDragAccept ? acceptStyle : {}),
    ...(isDragReject ? rejectStyle : {})
  }), [
    isFocused,
    isDragAccept,
    isDragReject
  ]);

  // Display hook error if present, otherwise internal error
  const displayError = error ? error.message : internalError;

  return (
    <div className="container mx-auto p-4">
      <div {...getRootProps({ style })}>
        <input {...getInputProps()} />
        <p>Glissez-déposez un fichier Excel ici, ou cliquez pour sélectionner un fichier</p>
        <em>(Fichiers .xls et .xlsx uniquement)</em>
      </div>
      {acceptedFileName && !isParsing && !displayError && parsedData && (
        <p className="mt-2 text-green-600">Fichier traité : {acceptedFileName}</p>
      )}
       {acceptedFileName && !isParsing && !displayError && !parsedData && (
        <p className="mt-2 text-yellow-600">Fichier accepté : {acceptedFileName}, mais pas de données extraites ou parsing annulé.</p>
      )}
      {isParsing && <p className="mt-2 text-blue-600">Parsing en cours...</p>}
      {displayError && <p className="mt-2 text-red-600">Erreur : {displayError}</p>}
    </div>
  );
}; 