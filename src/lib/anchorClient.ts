import axios, { AxiosInstance } from 'axios';

// This function creates an Axios instance specifically for the Anchor API endpoints
export const createAnchorClient = (token: string | null): AxiosInstance => {
  const baseURL = '/api-proxy'; // Use the same proxy as in apiClient
  const anchorPath = '/DataService/anchor/v1'; // Base path for Anchor API

  const headers: { [key: string]: string } = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const anchorClient = axios.create({
    baseURL: `${baseURL}${anchorPath}`,
    headers: headers,
    timeout: 15000, // 15 seconds timeout for API calls
  });

  return anchorClient;
};

// Anchor API service with typed methods
export const anchorService = {
  // Asset attributes management
  addAssetAttribute: (client: AxiosInstance, assetId: string, attributeKey: string, attributeValue: string) => {
    return client.post(`/assets/${assetId}/attributes`, {
      key: attributeKey,
      value: attributeValue
    });
  },
  
  // Asset updating (PATCH)
  updateAsset: (client: AxiosInstance, assetId: string, updates: Record<string, any>) => {
    return client.patch(`/assets/${assetId}`, updates);
  },
  
  // Adapters management
  getAdapters: (client: AxiosInstance) => {
    return client.get('/adaptermgmt/adapters');
  },
  
  // Retention policies
  getRetentions: (client: AxiosInstance) => {
    return client.get('/anchor-ex/v1/retentions');
  },
  
  createRetention: (client: AxiosInstance, retentionData: any) => {
    return client.post('/anchor-ex/v1/retentions', retentionData);
  },
  
  updateRetention: (client: AxiosInstance, retentionId: string, retentionData: any) => {
    return client.put(`/anchor-ex/v1/retentions/${retentionId}`, retentionData);
  }
}; 