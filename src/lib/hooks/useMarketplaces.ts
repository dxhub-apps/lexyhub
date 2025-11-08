/**
 * useMarketplaces Hook
 *
 * Fetches available marketplace providers from the database
 * Used for dynamic dropdown selections across the application
 */

import { useEffect, useState } from "react";

export interface Marketplace {
  id: string;
  display_name: string;
  provider_type: string;
  is_enabled: boolean;
}

interface UseMarketplacesResult {
  marketplaces: Marketplace[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useMarketplaces(): UseMarketplacesResult {
  const [marketplaces, setMarketplaces] = useState<Marketplace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  useEffect(() => {
    let isCancelled = false;

    async function fetchMarketplaces() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/marketplaces");

        if (!response.ok) {
          throw new Error(`Failed to fetch marketplaces: ${response.statusText}`);
        }

        const data = await response.json();

        if (!isCancelled) {
          setMarketplaces(data.marketplaces || []);
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : "Unknown error");
          setMarketplaces([]);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    fetchMarketplaces();

    return () => {
      isCancelled = true;
    };
  }, [refetchTrigger]);

  const refetch = () => {
    setRefetchTrigger((prev) => prev + 1);
  };

  return {
    marketplaces,
    loading,
    error,
    refetch,
  };
}
