import React, { useCallback, useState } from 'react';
import { useDropzone, FileWithPath } from 'react-dropzone';
import { useExcelParse } from '@/hooks/use-excel-parse'; // Ajuste le chemin si nécessaire

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
  onDataParsed?: (data: any[] | null) => void; // Callback pour passer les données parsées au parent
}

export const ExcelDropzone: React.FC<ExcelDropzoneProps> = ({ onDataParsed }) => {
  const { parsedData, isParsing, error, parseFile } = useExcelParse();
  const [acceptedFileName, setAcceptedFileName] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: FileWithPath[]) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      setAcceptedFileName(file.name);
      await parseFile(file);
      if (onDataParsed) {
        // Note: parseFile met à jour `parsedData` de manière asynchrone dans le hook.
        // Pour obtenir les données les plus récentes, on pourrait envisager de retourner les données depuis parseFile
        // ou d'utiliser un useEffect dans ce composant pour écouter les changements de `parsedData`.
        // Pour l'instant, on passe la valeur actuelle de `parsedData` (qui pourrait être celle de l'appel précédent).
        // Une meilleure approche serait d'attendre la mise à jour de `parsedData` dans le hook.
      }
    }
  }, [parseFile, onDataParsed]);

  // Pour passer les données parsées au composant parent dès qu'elles sont disponibles
  React.useEffect(() => {
    if (onDataParsed && parsedData) {
      onDataParsed(parsedData);
    }
    // Si le parsing échoue ou est réinitialisé, on notifie aussi le parent
    if (onDataParsed && (error || (!isParsing && !parsedData && acceptedFileName))) {
        // Peut-être que l'on ne veut notifier que sur succès ou erreur explicite
        // Pour l'instant, on notifie aussi si on a un nom de fichier mais plus de données
        // ce qui peut arriver après un clear.
        // onDataParsed(null); // A discuter si on veut clearer les données du parent ici.
    }
  }, [parsedData, onDataParsed, error, isParsing, acceptedFileName]);

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

  return (
    <div className="container mx-auto p-4">
      <div {...getRootProps({ style })}>
        <input {...getInputProps()} />
        <p>Glissez-déposez un fichier Excel ici, ou cliquez pour sélectionner un fichier</p>
        <em>(Fichiers .xls et .xlsx uniquement)</em>
      </div>
      {acceptedFileName && !isParsing && !error && (
        <p className="mt-2 text-green-600">Fichier accepté : {acceptedFileName}</p>
      )}
      {isParsing && <p className="mt-2 text-blue-600">Parsing en cours...</p>}
      {error && <p className="mt-2 text-red-600">Erreur : {error.message}</p>}
      {/* Optionnel: Afficher un aperçu ou un message de succès des données parsées */} 
      {/* {parsedData && !isParsing && (
        <div className="mt-2">
          <h3 className="text-lg font-semibold">Données Parsées (aperçu) :</h3>
          <pre className="bg-gray-100 p-2 rounded text-sm">
            {JSON.stringify(parsedData.slice(0, 5), null, 2)} 
          </pre>
          <p>Total de lignes: {parsedData.length}</p>
        </div>
      )} */}
    </div>
  );
}; 