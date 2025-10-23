import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import * as api from '@/lib/api';

/**
 * Custom hook for making authenticated API calls with loading and error states
 */
export function useApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const executeRequest = useCallback(async <T>(
    apiCall: () => Promise<T>
  ): Promise<T | null> => {
    if (!user) {
      setError('Authentication required');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await apiCall();
      return result;
    } catch (err) {
      const errorMessage = err instanceof api.ApiServiceError 
        ? err.message 
        : 'An unexpected error occurred';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Image generation functions
  const generateImages = useCallback((request: api.ImageGenerationRequest, signal?: AbortSignal) => {
    return executeRequest(() => api.generateImages(request, signal));
  }, [executeRequest]);

  const rewritePrompt = useCallback((request: api.PromptRewriteRequest, signal?: AbortSignal) => {
    return executeRequest(() => api.rewritePrompt(request, signal));
  }, [executeRequest]);

  const editImage = useCallback((imageFile: File, request: api.ImageEditRequest, signal?: AbortSignal) => {
    return executeRequest(() => api.editImage(imageFile, request, signal));
  }, [executeRequest]);

  const downloadImage = useCallback((imageUrl: string, filename?: string, signal?: AbortSignal) => {
    return executeRequest(() => api.downloadImage(imageUrl, filename, signal));
  }, [executeRequest]);

  // Video generation functions
  const generateVideo = useCallback((request: api.VideoGenerationRequest, signal?: AbortSignal) => {
    return executeRequest(() => api.generateVideo(request, signal));
  }, [executeRequest]);

  // Prompt functions
  const enhancePrompt = useCallback((request: api.PromptEnhanceRequest, signal?: AbortSignal) => {
    return executeRequest(() => api.enhancePrompt(request, signal));
  }, [executeRequest]);

  const generatePrompt = useCallback((request: { description: string; type?: 'image' | 'video' }, signal?: AbortSignal) => {
    return executeRequest(() => api.generatePrompt(request, signal));
  }, [executeRequest]);

  // History functions
  const getHistory = useCallback((params?: Parameters<typeof api.getHistory>[0], signal?: AbortSignal) => {
    return executeRequest(() => api.getHistory(params, signal));
  }, [executeRequest]);

  const getHistoryStats = useCallback((userEmail?: string, signal?: AbortSignal) => {
    return executeRequest(() => api.getHistoryStats(userEmail, signal));
  }, [executeRequest]);

  const getHistoryItem = useCallback((itemId: string, signal?: AbortSignal) => {
    return executeRequest(() => api.getHistoryItem(itemId, signal));
  }, [executeRequest]);

  const deleteHistoryItem = useCallback((itemId: string, signal?: AbortSignal) => {
    return executeRequest(() => api.deleteHistoryItem(itemId, signal));
  }, [executeRequest]);

  const downloadHistoryItem = useCallback((itemId: string, signal?: AbortSignal) => {
    return executeRequest(() => api.downloadHistoryItem(itemId, signal));
  }, [executeRequest]);

  // Brand guidelines functions
  const getBrandGuidelines = useCallback((signal?: AbortSignal) => {
    return executeRequest(() => api.getBrandGuidelines(signal));
  }, [executeRequest]);

  const updateBrandGuidelines = useCallback((request: api.UpdateBrandGuidelinesRequest, signal?: AbortSignal) => {
    return executeRequest(() => api.updateBrandGuidelines(request, signal));
  }, [executeRequest]);

  // Upload functions
  const generateSignedUrl = useCallback((request: api.SignedUrlRequest, signal?: AbortSignal) => {
    return executeRequest(() => api.generateSignedUrl(request, signal));
  }, [executeRequest]);

  // Bucket functions
  const listBuckets = useCallback((signal?: AbortSignal) => {
    return executeRequest(() => api.listBuckets(signal));
  }, [executeRequest]);

  return {
    loading,
    error,
    clearError,
    
    // Image functions
    generateImages,
    rewritePrompt,
    editImage,
    downloadImage,
    
    // Video functions
    generateVideo,
    
    // Prompt functions
    enhancePrompt,
    generatePrompt,
    
    // History functions
    getHistory,
    getHistoryStats,
    getHistoryItem,
    deleteHistoryItem,
    downloadHistoryItem,
    
    // Brand guidelines functions
    getBrandGuidelines,
    updateBrandGuidelines,
    
    // Upload functions
    generateSignedUrl,
    
    // Bucket functions
    listBuckets,
  };
}

/**
 * Hook for making raw authenticated API calls
 */
export function useAuthenticatedFetch() {
  const { user } = useAuth();

  const authenticatedFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    if (!user) {
      throw new Error('Authentication required');
    }

    return api.apiClient(url, options);
  }, [user]);

  return authenticatedFetch;
}