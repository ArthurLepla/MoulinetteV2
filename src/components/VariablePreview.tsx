import { useState } from 'react';
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
import { ArrowUpDown, ChevronDown, Filter } from 'lucide-react';

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
import { Variable } from '@/types';
import { useVariableStore } from '@/store/variableStore';

const columns: ColumnDef<Variable>[] = [
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
    cell: ({ row }: { row: Row<Variable> }) => <div className="font-medium">{row.getValue('name')}</div>,
  },
  {
    accessorKey: 'topic',
    header: 'Topic Path',
    cell: ({ row }: { row: Row<Variable> }) => (
      <div className="font-mono text-xs truncate max-w-md" title={row.getValue('topic')}>
        {row.getValue('topic')}
      </div>
    ),
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
];

export function VariablePreview() {
  const { previewVariables, totalCount } = useVariableStore();
  
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  const [dataTypeOpen, setDataTypeOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);

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
  });

  // Filter options for data types
  const dataTypes = ['Double', 'Boolean', 'String', 'Integer'];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Variable Preview</CardTitle>
        <CardDescription>
          {totalCount} variables will be created based on energy mappings
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center py-4 gap-2">
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
              <Button variant="outline" className="ml-auto">
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
        <div className="flex items-center justify-end space-x-2 py-4">
          <div className="text-sm text-muted-foreground">
            Page {table.getState().pagination.pageIndex + 1} of{' '}
            {table.getPageCount()}
          </div>
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
      </CardContent>
    </Card>
  );
} 