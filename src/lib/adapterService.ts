import { AxiosInstance } from 'axios';

// Define interface for adapter structure based on the API docs
export interface Adapter {
  id: string;
  name: string;
  type: string;
  locked?: boolean;
  active?: boolean;
  isDefault?: boolean;
  canBrowse?: boolean;
  connected?: boolean;
  description?: string;
  config?: Record<string, any>;
}

export interface AdapterResponse {
  adapters: Adapter[];
}

export const adapterService = {
  /**
   * Get all adapters
   * @param client - Axios instance
   * @returns Promise with adapters response
   */
  getAdapters: (client: AxiosInstance) => {
    return client.get<AdapterResponse>('/DataService/Adapters');
  },

  /**
   * Get adapter by ID
   * @param client - Axios instance
   * @param adapterId - Adapter ID
   * @returns Promise with adapter data
   */
  getAdapterById: (client: AxiosInstance, adapterId: string) => {
    return client.get(`/DataService/Adapters/${adapterId}`);
  },
}; 