import { AxiosInstance } from 'axios';
import { Asset } from '@/types';

export interface AssetsResponse {
  assets: Asset[];
  total: number;
  page: number;
  pageSize: number;
}

export const assetService = {
  /**
   * Get all assets (with pagination)
   * @param client - Axios instance
   * @param page - Page number (starting at 1)
   * @param pageSize - Number of items per page
   * @returns Promise with assets response
   */
  getAssets: (client: AxiosInstance, page = 1, pageSize = 100) => {
    return client.get<AssetsResponse>(`/DataService/anchor/v1/assets?page=${page}&pageSize=${pageSize}`);
  },

  /**
   * Get asset by ID
   * @param client - Axios instance
   * @param assetId - Asset ID
   * @returns Promise with asset data
   */
  getAssetById: (client: AxiosInstance, assetId: string) => {
    return client.get<Asset>(`/DataService/anchor/v1/assets/${assetId}`);
  },

  /**
   * Get all assets recursively (handles pagination automatically)
   * @param client - Axios instance
   * @returns Promise with all assets
   */
  getAllAssets: async (client: AxiosInstance): Promise<Asset[]> => {
    let allAssets: Asset[] = [];
    let currentPage = 1;
    const pageSize = 100;
    let hasMorePages = true;

    while (hasMorePages) {
      const response = await assetService.getAssets(client, currentPage, pageSize);
      const { assets, total } = response.data;
      
      allAssets = [...allAssets, ...assets];
      
      // Check if we need to fetch more pages
      const totalFetched = currentPage * pageSize;
      hasMorePages = totalFetched < total;
      currentPage++;
    }

    return allAssets;
  }
}; 