import { useState, useEffect } from 'react';
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  Table as TableInstance,
  Row,
  Header,
  HeaderGroup,
  Cell,
  Column,
} from '@tanstack/react-table';
import { ArrowUpDown, ChevronDown, Filter, Pencil, Trash2, AlertCircle, AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useVariableStore, Variable } from '@/store/variableStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { useFetchAssets } from '@/hooks/useFetchAssets';

// Interface de l'adaptateur
interface Adapter {
  id: string;
  name: string;
}

export function VariablePreview() {
  const { previewVariables, totalCount, setPreviewVariables } = useVariableStore();
  
  // Add the useFetchAssets hook
  const { isLoading: isLoadingAssets, error: assetsError, fetchAssets } = useFetchAssets();
  
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  const [dataTypeOpen, setDataTypeOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  
  // État pour la modale d'édition
  const [editVar, setEditVar] = useState<Variable | null>(null);
  const [editVarDraft, setEditVarDraft] = useState<Variable | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  
  // État pour la modale de confirmation de suppression en masse
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  
  // État pour la modale de confirmation de suppression totale
  const [deleteAllConfirmOpen, setDeleteAllConfirmOpen] = useState(false);
  
  // État pour stocker la liste des adaptateurs
  const [adaptersList, setAdaptersList] = useState<Adapter[]>([]);
  const [isLoadingAdapters, setIsLoadingAdapters] = useState(false);
  
  // Fetch assets and variables on mount
  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);
  
  // Charger la liste des adaptateurs au chargement du composant
  useEffect(() => {
    setIsLoadingAdapters(true);
    fetch('/api-proxy/DataService/Adapters')
      .then(r => r.json())
      .then(data => setAdaptersList(data.adapters || []))
      .catch(() => {
        console.error('Failed to load adapters');
        setAdaptersList([]);
      })
      .finally(() => setIsLoadingAdapters(false));
  }, []);
  
  // Fonction helper pour récupérer le nom de l'adaptateur à partir de son ID
  const getAdapterName = (adapterId: string | undefined): string => {
    if (!adapterId) return 'No adapter';
    const adapter = adaptersList.find(a => a.id === adapterId);
    return adapter ? adapter.name : adapterId;
  };
  
  // Handler pour ouvrir la modale d'édition
  const handleEditVar = (v: Variable) => {
    setEditVar(v);
    setEditVarDraft({ ...v });
    setEditOpen(true);
  };
  
  // Handler pour sauvegarder l'édition
  const handleSaveEdit = () => {
    if (!editVarDraft) return;
    setPreviewVariables(
      previewVariables.map(v => v === editVar ? { ...editVarDraft } : v)
    );
    setEditOpen(false);
    setEditVar(null);
    setEditVarDraft(null);
    toast.success('Variable mise à jour');
  };
  
  // Handler pour supprimer une variable
  const handleDeleteVar = (v: Variable) => {
    setPreviewVariables(previewVariables.filter(x => x !== v));
    toast.success('Variable supprimée');
  };

  // Handler pour supprimer les variables sélectionnées
  const handleBulkDelete = () => {
    const selectedRows = table.getSelectedRowModel().rows;
    if (selectedRows.length === 0) return;
    
    setDeleteConfirmOpen(true);
  };
  
  // Handler pour supprimer toutes les variables
  const handleDeleteAll = () => {
    if (previewVariables.length === 0) return;
    
    setDeleteAllConfirmOpen(true);
  };
  
  // Exécuter la suppression en masse après confirmation
  const confirmBulkDelete = () => {
    const selectedRows = table.getSelectedRowModel().rows;
    const selectedVariables = selectedRows.map(row => row.original);
    const remainingVariables = previewVariables.filter(v => !selectedVariables.includes(v));
    
    setPreviewVariables(remainingVariables);
    setRowSelection({});
    setDeleteConfirmOpen(false);
    
    toast.success(`${selectedVariables.length} variables supprimées`);
  };
  
  // Exécuter la suppression de toutes les variables après confirmation
  const confirmDeleteAll = () => {
    const count = previewVariables.length;
    setPreviewVariables([]);
    setRowSelection({});
    setDeleteAllConfirmOpen(false);
    
    toast.success(`Toutes les variables ont été supprimées (${count} au total)`);
  };

  // Ajouter des actions sur les colonnes
  const columns: ColumnDef<Variable>[] = [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'name',
      header: ({ column }: { column: Column<Variable> }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Variable Name
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }: { row: Row<Variable> }) => {
        const level = row.original.level;
        const indentSize = typeof level === 'number' ? level * 20 : 0;
        return (
          <div style={{ paddingLeft: `${indentSize}px` }} className="font-medium">
            {row.getValue('name')}
          </div>
        );
      },
    },
    {
      accessorKey: 'level',
      header: ({ column }: { column: Column<Variable> }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Level
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }: { row: Row<Variable> }) => {
        const level = row.getValue('level');
        return (
          <Badge variant="outline" className="font-mono">
            {String(level)}
          </Badge>
        );
      },
      enableSorting: true,
    },
    {
      accessorKey: 'topic',
      header: 'Adapter/Connection/Tag',
      cell: ({ row }: { row: Row<Variable> }) => {
        // Format attendu: "connectionName::assetName_tagName"
        const topic = row.getValue('topic') as string;
        const adapterId = row.original.adapterId || '';
        const adapterName = getAdapterName(adapterId);
        
        // Extraire connection et tag du topic
        let connectionName = '';
        let tagName = '';
        
        if (topic) {
          const parts = topic.split('::');
          if (parts.length > 0) {
            connectionName = parts[0];
            
            if (parts.length > 1) {
              // La partie après :: contient assetName_tagName
              const assetTag = parts[1].split('_');
              if (assetTag.length > 1) {
                // Le tagName est la dernière partie après le dernier underscore
                tagName = assetTag[assetTag.length - 1];
              }
            }
          }
        }
        
        return (
          <div className="font-mono text-xs">
            <div className="flex flex-col">
              <span className="text-blue-600" title={`Adapter: ${adapterName} (${adapterId})`}>
                {adapterName}
              </span>
              <span className="text-green-600" title={`Connection: ${connectionName}`}>
                {connectionName || 'No connection'}
              </span>
              <span className="text-orange-600" title={`Tag: ${tagName}`}>
                {tagName || 'No tag'}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'dataType',
      header: 'Data Type',
      cell: ({ row }: { row: Row<Variable> }) => (
        <Badge variant="outline" className="font-mono">
          {row.getValue('dataType')}
        </Badge>
      ),
      filterFn: (row: Row<Variable>, id: string, value: string[]) => {
        return value.includes(row.getValue(id));
      },
    },
    {
      accessorKey: 'units',
      header: 'Units',
      cell: ({ row }: { row: Row<Variable> }) => (
        <div className="text-xs text-muted-foreground">
          {row.getValue('units') || '-'}
        </div>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }: { row: Row<Variable> }) => (
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => handleEditVar(row.original)}
            title="Edit variable"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => handleDeleteVar(row.original)}
            title="Delete variable"
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    }
  ];

  const table = useReactTable({
    data: previewVariables,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
    enableRowSelection: true,
  });

  // Filter options for data types
  const dataTypes = ['Double', 'Boolean', 'String', 'Integer'];
  
  // Nombre de variables sélectionnées
  const selectedCount = Object.keys(rowSelection).length;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Variable Preview</CardTitle>
          <CardDescription>
            {totalCount} variables will be created based on energy mappings
            {selectedCount > 0 && ` • ${selectedCount} variables sélectionnées`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center py-4 gap-2 flex-wrap justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <Input
                placeholder="Filter variable names..."
                value={(table.getColumn('name')?.getFilterValue() as string) ?? ''}
                onChange={(event) =>
                  table.getColumn('name')?.setFilterValue(event.target.value)
                }
                className="max-w-sm"
              />
              
              <DropdownMenu open={dataTypeOpen} onOpenChange={setDataTypeOpen}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <Filter className="mr-2 h-4 w-4" />
                    Data Type
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {dataTypes.map((type) => (
                    <DropdownMenuCheckboxItem
                      key={type}
                      checked={(table.getColumn('dataType')?.getFilterValue() as string[])?.includes(type)}
                      onCheckedChange={(value) => {
                        const filterValues = (table.getColumn('dataType')?.getFilterValue() as string[]) || [];
                        if (value) {
                          table.getColumn('dataType')?.setFilterValue([...filterValues, type]);
                        } else {
                          table.getColumn('dataType')?.setFilterValue(
                            filterValues.filter((val) => val !== type)
                          );
                        }
                        setDataTypeOpen(false);
                      }}
                    >
                      {type}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              
              <DropdownMenu open={columnsOpen} onOpenChange={setColumnsOpen}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    Columns
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {table
                    .getAllColumns()
                    .filter((column: Column<Variable>) => column.getCanHide())
                    .map((column: Column<Variable>) => {
                      return (
                        <DropdownMenuCheckboxItem
                          key={column.id}
                          className="capitalize"
                          checked={column.getIsVisible()}
                          onCheckedChange={(value) => {
                            column.toggleVisibility(!!value);
                            setColumnsOpen(false);
                          }}
                        >
                          {column.id}
                        </DropdownMenuCheckboxItem>
                      );
                    })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            <div className="flex items-center gap-2">
              {selectedCount > 0 && (
                <Button 
                  variant="destructive" 
                  onClick={handleBulkDelete}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Supprimer sélection ({selectedCount})
                </Button>
              )}
              
              {previewVariables.length > 0 && (
                <Button 
                  variant="outline" 
                  onClick={handleDeleteAll}
                  className="border-destructive text-destructive hover:bg-destructive/10"
                >
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  Tout supprimer ({previewVariables.length})
                </Button>
              )}
            </div>
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup: HeaderGroup<Variable>) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header: Header<Variable, unknown>) => {
                      return (
                        <TableHead key={header.id}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row: Row<Variable>) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                    >
                      {row.getVisibleCells().map((cell: Cell<Variable, unknown>) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                      No variables to preview
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between space-x-2 py-4">
            <div className="text-sm text-muted-foreground">
              {previewVariables.length} variables au total • 
              Page {table.getState().pagination.pageIndex + 1} of{' '}
              {table.getPageCount()}
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Modale d'édition */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Variable</DialogTitle>
          </DialogHeader>
          {editVarDraft && (
            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input 
                  value={editVarDraft.name} 
                  onChange={e => setEditVarDraft(d => d ? { ...d, name: e.target.value } : d)} 
                  className="w-full"
                />
              </div>
              <div>
                <Label>Data Type</Label>
                <select 
                  className="w-full p-2 border rounded" 
                  value={editVarDraft.dataType} 
                  onChange={e => setEditVarDraft(d => d ? { ...d, dataType: e.target.value as any } : d)}
                >
                  <option value="Double">Double</option>
                  <option value="Boolean">Boolean</option>
                  <option value="String">String</option>
                  <option value="Integer">Integer</option>
                </select>
              </div>
              <div>
                <Label>Units</Label>
                <Input 
                  value={editVarDraft.units || ''} 
                  onChange={e => setEditVarDraft(d => d ? { ...d, units: e.target.value } : d)} 
                  className="w-full"
                />
              </div>
              <div>
                <Label>Topic</Label>
                <Input 
                  value={editVarDraft.topic || ''} 
                  onChange={e => setEditVarDraft(d => d ? { ...d, topic: e.target.value } : d)} 
                  className="w-full"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Modale de confirmation de suppression en masse */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmer la suppression</DialogTitle>
            <DialogDescription>
              Vous êtes sur le point de supprimer {selectedCount} variables. Cette action ne peut pas être annulée.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center p-3 bg-amber-50 dark:bg-amber-950/30 rounded-md border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400">
            <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
            <span className="text-sm">Les variables supprimées ne pourront pas être récupérées.</span>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>Annuler</Button>
            <Button variant="destructive" onClick={confirmBulkDelete}>Supprimer {selectedCount} variables</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Modale de confirmation de suppression totale */}
      <Dialog open={deleteAllConfirmOpen} onOpenChange={setDeleteAllConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Supprimer TOUTES les variables</DialogTitle>
            <DialogDescription>
              Vous êtes sur le point de supprimer TOUTES les variables ({previewVariables.length} au total). Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center p-4 bg-red-50 dark:bg-red-950/30 rounded-md border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400">
            <AlertTriangle className="h-6 w-6 mr-3 flex-shrink-0" />
            <div>
              <p className="font-medium">Attention !</p>
              <p className="text-sm mt-1">Toutes les variables seront supprimées, y compris celles qui ne sont pas affichées sur la page actuelle.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteAllConfirmOpen(false)}>Annuler</Button>
            <Button variant="destructive" onClick={confirmDeleteAll}>
              Confirmer la suppression de toutes les variables
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
} 