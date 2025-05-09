import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface EnergyMapColumnModalProps {
  isOpen: boolean;
  onClose: () => void;
  excelHeaders: string[];
  onSubmit: (mapping: { assetIdCol: string; energyTypeCol: string }) => void;
  initialAssetIdCol?: string; // Optional: pre-fill if available
  initialEnergyTypeCol?: string; // Optional: pre-fill if available
}

export function EnergyMapColumnModal({
  isOpen,
  onClose,
  excelHeaders,
  onSubmit,
  initialAssetIdCol,
  initialEnergyTypeCol,
}: EnergyMapColumnModalProps) {
  const [selectedAssetIdCol, setSelectedAssetIdCol] = useState<string>("");
  const [selectedEnergyTypeCol, setSelectedEnergyTypeCol] = useState<string>("");

  useEffect(() => {
    if (isOpen) {
      // Pre-select if initial values are provided and valid
      if (initialAssetIdCol && excelHeaders.includes(initialAssetIdCol)) {
        setSelectedAssetIdCol(initialAssetIdCol);
      } else if (excelHeaders.length > 0) {
        setSelectedAssetIdCol(excelHeaders[0]); // Default to first header
      }

      if (initialEnergyTypeCol && excelHeaders.includes(initialEnergyTypeCol)) {
        setSelectedEnergyTypeCol(initialEnergyTypeCol);
      } else if (excelHeaders.length > 1) {
        setSelectedEnergyTypeCol(excelHeaders[1]); // Default to second header
      } else if (excelHeaders.length > 0) {
        setSelectedEnergyTypeCol(excelHeaders[0]); // Fallback if only one header
      }
    }
  }, [isOpen, excelHeaders, initialAssetIdCol, initialEnergyTypeCol]);

  const handleSubmit = () => {
    if (!selectedAssetIdCol || !selectedEnergyTypeCol) {
      // Optionally, show an error message to the user
      alert("Please select columns for both Asset Identifier and Energy Type.");
      return;
    }
    onSubmit({
      assetIdCol: selectedAssetIdCol,
      energyTypeCol: selectedEnergyTypeCol,
    });
    onClose(); // Close modal after submit
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Map Energy Data Columns</DialogTitle>
          <DialogDescription>
            Select which columns from your uploaded Excel file correspond to the required fields.
            The system will try to match assets using the 'Asset Identifier' column against retrieved asset names.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="asset-id-col" className="text-right col-span-1">
              Asset Identifier
            </Label>
            <Select
              value={selectedAssetIdCol}
              onValueChange={setSelectedAssetIdCol}
              name="asset-id-col"
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select Excel column..." />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Excel Columns</SelectLabel>
                  {excelHeaders.map((header) => (
                    <SelectItem key={`asset_id_col_${header}`} value={header}>
                      {header}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="energy-type-col" className="text-right col-span-1">
              Energy Type
            </Label>
            <Select
              value={selectedEnergyTypeCol}
              onValueChange={setSelectedEnergyTypeCol}
              name="energy-type-col"
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select Excel column..." />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Excel Columns</SelectLabel>
                  {excelHeaders.map((header) => (
                    <SelectItem key={`energy_type_col_${header}`} value={header}>
                      {header}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit}>Apply Mapping</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 