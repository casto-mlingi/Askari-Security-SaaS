import { useState, useCallback } from 'react';
import { ApiResponse } from '../types';

export function useAsync<T>(asyncFunction: (...args: any[]) => Promise<ApiResponse<T>>) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<T | null>(null);

  const execute = useCallback(async (...args: any[]) => {
    setLoading(true);
    setError(null);
    try {
      const response = await asyncFunction(...args);
      if (response.error) {
        setError(response.error);
        return { error: response.error };
      }
      setData(response.data || null);
      return { data: response.data };
    } catch (e) {
      const msg = 'An unexpected connection error occurred.';
      setError(msg);
      return { error: msg };
    } finally {
      setLoading(false);
    }
  }, [asyncFunction]);

  return { execute, loading, error, data, setData };
}