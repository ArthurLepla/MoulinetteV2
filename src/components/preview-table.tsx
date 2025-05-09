import React from 'react';
import { ExcelData } from '@/store/excelStore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface PreviewTableProps {
  data: ExcelData | null;
  maxRows?: number;
}

export const PreviewTable: React.FC<PreviewTableProps> = ({ data, maxRows = 20 }) => {
  if (!data || !data.headers || !data.rows) {
    return <p className="text-sm text-muted-foreground">No data to preview or data is not in the expected format.</p>;
  }

  const { headers, rows } = data;
  const displayedRows = rows.slice(0, maxRows);

  if (headers.length === 0) {
    return <p className="text-sm text-muted-foreground">Excel file seems to have no header row.</p>;
  }
  
  if (displayedRows.length === 0 && rows.length > 0) {
    return <p className="text-sm text-muted-foreground">No data rows to preview (headers might exist).</p>;
  }

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Excel file seems to have no data rows.</p>;
  }

  return (
    <div className="mt-4 border rounded-md overflow-hidden">
      <h3 className="text-lg font-semibold p-4 bg-muted/50">Data Preview (First {Math.min(rows.length, maxRows)} Rows of {rows.length})</h3>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {headers.map((header, index) => (
                <TableHead key={index} className="whitespace-nowrap">{header || `Column ${index + 1}`}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayedRows.map((row, rowIndex) => (
              <TableRow key={rowIndex}>
                {headers.map((_, cellIndex) => ( // Iterate based on headers length to ensure consistent cell count
                  <TableCell key={cellIndex} className="whitespace-nowrap">
                    {row[cellIndex] !== null && row[cellIndex] !== undefined ? String(row[cellIndex]) : ''}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {rows.length > maxRows && (
        <p className="p-4 text-sm text-muted-foreground">Showing first {maxRows} of {rows.length} total rows.</p>
      )}
    </div>
  );
}; 