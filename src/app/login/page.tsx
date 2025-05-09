"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import axios from "axios"; // Added axios import
import { useAuth } from "@/context/AuthContext"; // Import useAuth
import { useRouter } from 'next/navigation'; // Import useRouter for redirection
// import { useAuth } from "@/context/AuthContext"; // We'll create this later

export default function LoginPage() {
  const [apiUrl, setApiUrl] = useState(process.env.NEXT_PUBLIC_IIH_BASE_URL || ""); // Initialize with env var if available
  const [authToken, setAuthToken] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth(); // Get login function from context
  const router = useRouter(); // Initialize router
  // const { login } = useAuth(); // We'll use this from AuthContext

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    console.log("Attempting to connect via proxy with token:", authToken);

    try {
      const response = await axios.get(`/api-proxy/DataService/Adapters`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
          Accept: "application/json",
        },
        timeout: 10000, // 10 seconds timeout
      });

      console.log("Proxy Response Status:", response.status); // Log status
      console.log("Proxy Response Data:", response.data); // Log the actual data received

      if (response.status === 200 && response.data && Array.isArray(response.data.adapters)) {
        console.log("Connection test successful. API URL and Token are valid.", response.data);
        login(authToken, apiUrl); // Call login from AuthContext with the user-provided apiUrl
        router.push('/'); // Redirect to the root page
      } else {
        // Should not happen if status is 200, but as a safeguard
        setError("Connection test failed: Unexpected response structure.");
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        console.error("Connection API Error:", err.response?.status, err.response?.data);
        if (err.response) {
          if (err.response.status === 401) {
            setError("Authentication failed: Invalid or expired token.");
          } else if (err.response.status === 404) {
            setError("Connection failed: API endpoint not found. Check the Base URL.");
          } else {
            setError(`Connection failed: Server responded with status ${err.response.status}.`);
          }
        } else if (err.request) {
          setError("Connection failed: No response from server. Check API URL and network.");
        } else {
          setError("Connection failed: Error setting up the request.");
        }
      } else {
        console.error("Connection test failed (Non-Axios error):", err);
        setError("An unexpected error occurred during connection test.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Connect to API</CardTitle>
          <CardDescription>
            Enter your API Base URL and Authentication Token.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="apiUrl">API Base URL</Label>
              <Input
                id="apiUrl"
                type="text"
                placeholder="https://your-api-server.com/api"
                required
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="authToken">Auth Token (JWT)</Label>
              <Input
                id="authToken"
                type="text"
                placeholder="Paste your JWT token here"
                required
                value={authToken}
                onChange={(e) => setAuthToken(e.target.value)}
                disabled={isLoading}
              />
            </div>
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
          </CardContent>
          <CardFooter className="mt-6">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Connecting..." : "Connect"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
} 