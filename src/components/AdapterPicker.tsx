import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
} from "@/components/ui/select";
import { Adapter, adapterService, AdapterResponse } from '@/lib/adapterService';
import { useAssetStore } from '@/store/assetStore';
import { AxiosInstance } from 'axios';

interface AdapterPickerProps {
  client: AxiosInstance | null;
  disabled?: boolean;
}

export function AdapterPicker({ client, disabled = false }: AdapterPickerProps) {
  const [value, setValue] = useState('');
  
  const { 
    adapterId: currentAdapterIdFromStore,
    setAdapterId, 
    setAdapterSelected 
  } = useAssetStore();

  const { data, isLoading, error, refetch } = useQuery<AdapterResponse, Error>({
    queryKey: ['adapters', client],
    queryFn: async (): Promise<AdapterResponse> => {
      if (!client || typeof client.get !== 'function') {
        throw new Error('API client is not initialized or invalid.');
      }
      
      const response = await adapterService.getAdapters(client);
      
      let adaptersArray: Adapter[] = [];
      if (response.data && Array.isArray(response.data.adapters)) {
        adaptersArray = response.data.adapters;
      } else if (Array.isArray(response.data)) {
        adaptersArray = response.data as Adapter[];
      } else if (response.data && typeof response.data === 'object' && response.data !== null) {
        const potentialAdaptersKey = Object.keys(response.data).find(key => Array.isArray((response.data as any)[key]));
        if (potentialAdaptersKey) {
          adaptersArray = (response.data as any)[potentialAdaptersKey] as Adapter[];
        }
      }

      const validAdapters = adaptersArray.filter(
        a => a && typeof a.id === 'string' && typeof a.name === 'string' && typeof a.type === 'string'
      );
      
      return { adapters: validAdapters };
    },
    enabled: !!client && typeof client?.get === 'function',
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });

  const adapters = data?.adapters || [];
  const selectedAdapter = adapters.find((adapter: Adapter) => adapter.id === value);

  useEffect(() => {
    if (value) {
      setAdapterId(value);
      setAdapterSelected(true);
    } else {
      setAdapterSelected(false);
    }
  }, [value, setAdapterId, setAdapterSelected]);

  useEffect(() => {
    if (currentAdapterIdFromStore && !value) {
      setValue(currentAdapterIdFromStore);
    }
  }, [currentAdapterIdFromStore, value]);

  useEffect(() => {
    console.log('[AdapterPicker] State check:', {
      propDisabled: disabled,
      isLoading,
      isError: !!error,
      error,
      clientValid: !!client && typeof client?.get === 'function',
      adaptersCount: adapters.length,
      currentValue: value,
      selectedAdapterName: selectedAdapter?.name,
    });
  }, [disabled, isLoading, error, client, adapters, value, selectedAdapter]);
  
  const handleRefresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    refetch();
  };
  
  return (
    <div className="flex flex-col space-y-2">
      <div className="flex justify-between items-center">
        <label htmlFor="adapter-picker-select" className="text-sm font-medium">Select Adapter</label>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleRefresh}
          disabled={isLoading || !client}
          aria-label="Refresh adapters list"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <Select 
        value={value}
        onValueChange={(selectedValue) => setValue(selectedValue ? selectedValue : '')}
        disabled={disabled || isLoading || !client}
      >
        <SelectTrigger id="adapter-picker-select" className="w-full justify-between">
          {selectedAdapter ? selectedAdapter.name : "Select adapter..."}
        </SelectTrigger>
        <SelectContent className="w-[--radix-select-trigger-width]" style={{minWidth: '200px'}}>
          {isLoading && <SelectItem value="loading_placeholder" disabled>Loading...</SelectItem>}
          {error && !isLoading && <SelectItem value="error_placeholder" disabled>Error loading adapters.</SelectItem>}
          {!isLoading && !error && adapters.length === 0 && (
            <SelectItem value="no_adapters_placeholder" disabled>No adapters found.</SelectItem>
          )}
          {!isLoading && !error && adapters.length > 0 && (
            <SelectGroup>
              <SelectLabel>Available Adapters</SelectLabel>
              {adapters.map((adapter: Adapter) => (
                <SelectItem key={adapter.id} value={adapter.id}>
                  <span>{adapter.name}</span>
                </SelectItem>
              ))}
            </SelectGroup>
          )}
        </SelectContent>
      </Select>

      {error && !isLoading && ( 
        <div className="flex items-center justify-between mt-1">
          <p className="text-sm text-destructive">
            Failed to load adapters. ({error.message})
          </p>
          <Button 
            variant="link" 
            size="sm" 
            onClick={handleRefresh}
            className="text-destructive"
          >
            Retry
          </Button>
        </div>
      )}
    </div>
  );
} 