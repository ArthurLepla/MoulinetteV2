"use client";

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { createApiClient } from '@/lib/apiClient';

interface Adapter {
  id: string;
  name: string;
  type: string;
  status?: string;
  connectionName?: string;
}

export default function DashboardPage() {
  const { token, apiUrl, isAuthenticated, logout, isLoading: authIsLoading } = useAuth();
  const router = useRouter();
  const [adapters, setAdapters] = useState<Adapter[]>([]);
  const [adaptersError, setAdaptersError] = useState<string | null>(null);
  const [adaptersLoading, setAdaptersLoading] = useState<boolean>(true);

  useEffect(() => {
    if (isAuthenticated && token) {
      const apiClient = createApiClient(token, apiUrl);
      setAdaptersLoading(true);
      apiClient.get('/DataService/Adapters')
        .then(response => {
          if (response.data && Array.isArray(response.data.adapters)) {
            setAdapters(response.data.adapters);
          } else {
            setAdapters([]);
            console.warn("Unexpected adapter data structure:", response.data);
            setAdaptersError("Failed to load adapters: Unexpected data structure.");
          }
        })
        .catch(err => {
          console.error("Failed to fetch adapters:", err);
          if (err.response && err.response.status === 401) {
            setAdaptersError("Authentication error fetching adapters. Please re-login.");
          } else {
            setAdaptersError("Failed to load adapters. Check console for details.");
          }
        })
        .finally(() => {
          setAdaptersLoading(false);
        });
    } else if (!authIsLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, token, apiUrl, router, authIsLoading]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  if (authIsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading user session...</p>
      </div>
    );
  }

  if (!isAuthenticated && !authIsLoading) {
    return null;
  }

  return (
    <div className="container mx-auto p-4 pt-6 md:p-6 lg:p-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Dashboard</CardTitle>
          <CardDescription>
            Welcome! You are successfully connected.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {apiUrl && (
            <div>
              <h3 className="font-semibold">API URL:</h3>
              <p className="text-sm text-gray-700 dark:text-gray-300 break-all">{apiUrl}</p>
            </div>
          )}
          {token && (
            <div>
              <h3 className="font-semibold">Auth Token (first 30 chars):</h3>
              <p className="text-sm text-gray-700 dark:text-gray-300 break-all">
                {token.substring(0, 30)}...
              </p>
            </div>
          )}
          <Button onClick={handleLogout} variant="destructive" className="w-full mt-4">
            Logout
          </Button>
        </CardContent>
      </Card>

      <Card className="max-w-2xl mx-auto mt-6">
        <CardHeader>
          <CardTitle>Adapters</CardTitle>
          <CardDescription>List of configured data adapters.</CardDescription>
        </CardHeader>
        <CardContent>
          {adaptersLoading && <p>Loading adapters...</p>}
          {adaptersError && <p className="text-red-500">Error: {adaptersError}</p>}
          {!adaptersLoading && !adaptersError && adapters.length === 0 && (
            <p>No adapters found or an issue occurred.</p>
          )}
          {!adaptersLoading && !adaptersError && adapters.length > 0 && (
            <ul className="space-y-2">
              {adapters.map((adapter) => (
                <li key={adapter.id} className="p-2 border rounded-md">
                  <p className="font-semibold">{adapter.name} ({adapter.id})</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Type: {adapter.type}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 