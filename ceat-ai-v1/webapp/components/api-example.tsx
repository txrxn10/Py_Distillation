'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useApi } from '@/hooks/useApi';

/**
 * Example component showing how to use the authenticated API
 */
export function ApiExample() {
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<any>(null);
  
  const {
    loading,
    error,
    clearError,
    generateImages,
    getHistory,
    getBrandGuidelines
  } = useApi();

  const handleGenerateImage = async () => {
    if (!prompt.trim()) return;

    const response = await generateImages({
      prompt: prompt.trim(),
      num_images: 1,
      aspect_ratio: '1:1',
      resolution: '1024x1024'
    });

    if (response) {
      setResult(response);
    }
  };

  const handleGetHistory = async () => {
    const response = await getHistory({
      page: 1,
      per_page: 10,
      type: 'all'
    });

    if (response) {
      setResult(response);
    }
  };

  const handleGetBrandGuidelines = async () => {
    const response = await getBrandGuidelines();

    if (response) {
      setResult(response);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Authenticated API Example</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>
              {error}
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={clearError}
                className="ml-2"
              >
                Dismiss
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <label htmlFor="prompt">Image Prompt:</label>
          <Input
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter a prompt for image generation..."
            disabled={loading}
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button 
            onClick={handleGenerateImage}
            disabled={loading || !prompt.trim()}
          >
            {loading ? 'Generating...' : 'Generate Image'}
          </Button>
          
          <Button 
            onClick={handleGetHistory}
            disabled={loading}
            variant="outline"
          >
            {loading ? 'Loading...' : 'Get History'}
          </Button>
          
          <Button 
            onClick={handleGetBrandGuidelines}
            disabled={loading}
            variant="outline"
          >
            {loading ? 'Loading...' : 'Get Brand Guidelines'}
          </Button>
        </div>

        {result && (
          <div className="mt-4">
            <h3 className="font-semibold mb-2">API Response:</h3>
            <pre className="bg-gray-100 p-4 rounded-md overflow-auto text-sm">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}