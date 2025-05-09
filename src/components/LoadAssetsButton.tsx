import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAssetStore } from '@/store/assetStore';
import { assetService } from '@/lib/assetService';
import { AxiosInstance } from 'axios';
import { Asset } from '@/types';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface LoadAssetsButtonProps {
  client: AxiosInstance | null;
  disabled?: boolean;
}

export function LoadAssetsButton({ client, disabled = false }: LoadAssetsButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { setAssets, setAssetsCreated } = useAssetStore();

  const handleLoadAssets = async () => {
    if (!client) {
      toast.error('API client not initialized');
      return;
    }

    setIsLoading(true);
    try {
      const assets = await assetService.getAllAssets(client);
      
      if (assets.length === 0) {
        toast.info('No assets found');
      } else {
        // Build asset map for convenience
        const anchorMap: Record<string, string> = {};
        assets.forEach((asset: Asset) => {
          anchorMap[asset.id] = asset.id; // In this case id and anchorId are the same
        });
        
        // Update store
        setAssets(assets);
        setAssetsCreated(true);
        
        toast.success(`Loaded ${assets.length} existing assets`);
      }
    } catch (error) {
      console.error('Failed to load assets:', error);
      toast.error('Failed to load assets. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button 
      variant="outline" 
      onClick={handleLoadAssets} 
      disabled={disabled || isLoading}
    >
      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      Load Existing Assets
    </Button>
  );
} 