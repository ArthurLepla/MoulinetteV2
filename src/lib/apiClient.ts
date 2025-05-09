import axios, { AxiosInstance } from 'axios';

// This function creates an Axios instance with dynamic baseURL (from proxy) and auth token.
// It's intended to be called from within components/hooks where apiUrl and token are available from AuthContext.
export const createApiClient = (token: string | null, apiUrl?: string | null): AxiosInstance => {
  // For client-side requests that go through the Next.js proxy, the baseURL relative to the Next.js app.
  // For direct server-to-server calls (not applicable here yet), you might use the full apiUrl.
  // For now, all client-side API calls will use the proxy path.
  const effectiveApiUrl = '/api-proxy'; // Always use the proxy for client-side calls

  const headers: { [key: string]: string } = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const apiClient = axios.create({
    baseURL: effectiveApiUrl, // Use the proxy path as the base for client-side calls
    headers: headers,
    timeout: 15000, // 15 seconds timeout for API calls
  });

  // You can add interceptors here if needed, for example, to handle errors globally
  // or to refresh tokens (though token refresh is not part of the current scope).

  // apiClient.interceptors.response.use(
  //   (response) => response,
  //   (error) => {
  //     // Handle global errors, e.g., redirect on 401 if not on login page
  //     if (error.response && error.response.status === 401) {
  //       // Potentially call logout() from AuthContext or redirect
  //       // This needs careful handling to avoid loops and access to context/router
  //       console.error("Axios interceptor: Unauthorized access - 401");
  //     }
  //     return Promise.reject(error);
  //   }
  // );

  return apiClient;
};

// Example of a more specific API service (optional for now, but good practice)
// export const adapterService = {
//   getAdapters: (apiClient: AxiosInstance) => {
//     return apiClient.get('/DataService/Adapters');
//   },
// }; 