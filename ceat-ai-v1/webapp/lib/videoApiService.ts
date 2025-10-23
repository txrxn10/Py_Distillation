import { ApiServiceError } from './api';
import { PromptGenerationRequest, StoryboardResponse, FinalVideoResponse, Scene } from './types';

const API_BASE_URL = 'http://ceatapi.demodevelopment.com/api';

async function fetchApi(endpoint: string, options: RequestInit, timeout: number = 600000): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(endpoint, {
      ...options,
      signal: controller.signal,
    });

    const responseData = await response.json();

    if (!response.ok) {
      throw new ApiServiceError(responseData.message || 'An API error occurred.', responseData.code, responseData.data, responseData.errors);
    }

    return responseData;
  } catch (error) {
    if (error instanceof ApiServiceError) {
      throw error;
    }
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiServiceError('Request timed out.', 'HTTP_500');
    }
    throw new ApiServiceError('A network or parsing error occurred.', 'NETWORK_ERROR', error);
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function generateStoryboardPrompts(requestData: PromptGenerationRequest): Promise<StoryboardResponse> {
  return fetchApi(`${API_BASE_URL}/prompts/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestData),
  });
}


export async function enhancePrompt(prompt: string): Promise<{ data: { enhanced_prompt: string } }> {
    return fetchApi(`${API_BASE_URL}/prompts/enhance`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) });
}

export async function generateFinalVideo(scenes: Scene[], parameters: Record<string, any>, imageGcsUri?: string | null): Promise<FinalVideoResponse> {
  console.log("imageGcsUri",imageGcsUri);
    const payload: any = { scenes, stitch: true, transitions: true, parameters };
  if (imageGcsUri) {
    payload.image = { gcsUri: imageGcsUri };
  }
  return fetchApi(`${API_BASE_URL}/video/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
}

export async function uploadFileViaProxy(file: File): Promise<{ gs_uri: string, public_url: string }> {
    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch(`${API_BASE_URL}/uploads/proxy-upload`, {
        method: 'POST',
        body: formData,
        });

        const responseData = await response.json();
        if (!response.ok) {
            throw new ApiServiceError(responseData.message || 'Proxy upload failed.');
        }
        return responseData.data;

    } catch (error) {
        if (error instanceof ApiServiceError) throw error;
        throw new ApiServiceError('File upload failed due to a network error.', 'NETWORK_ERROR', error);
    }
    
}

export async function getDownloadUrl(gsPath: string): Promise<{ signedUrl: string }> {
  const response = await fetchApi(`${API_BASE_URL}/uploads/generate-download-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gsPath }),
  });
  return response.data;
}
