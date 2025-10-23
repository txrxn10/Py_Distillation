/**
 * API service module for image generation
 * Handles HTTP requests to the backend image generation service
 */

import {
  ImageGenerationRequest,
  ImageGenerationResponse,
  PromptRewriteRequest,
  PromptRewriteResponse,
  ImageEditRequest,
  ImageEditResponse,
  ApiResponse,
  ApiErrorCode,
  ValidationError,
  isApiError,
  validateImageGenerationRequest,
  validateImageGenerationResponse,
  validatePromptRewriteRequest,
  validatePromptRewriteResponse
} from './types';

import Cookies from 'js-cookie';

/**
 * Configuration constants for the API service
 */
const API_CONFIG = {
  BASE_URL: 'http://ceatapi.demodevelopment.com',
  ENDPOINTS: {
    IMAGE_GENERATION: '/api/image/generate',
    PROMPT_REWRITE: '/api/rewrite',
    IMAGE_EDIT: '/api/image/edit',
    IMAGE_DOWNLOAD: '/api/image/download'
  },
  TIMEOUT: 30000, // 30 seconds timeout
  HEADERS: {
    'Content-Type': 'application/json'
  }
} as const;

/**
 * Get authentication headers with JWT token
 */
function getAuthHeaders(): HeadersInit {
  const token = Cookies.get('auth_token');
  const headers: HeadersInit = {
    ...API_CONFIG.HEADERS
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
}

/**
 * Handle authentication errors by redirecting to login
 */
function handleAuthError(): void {
  Cookies.remove('auth_token');
  window.location.href = '/';
}

/**
 * Authenticated fetch wrapper that automatically includes JWT token and handles auth errors
 */
async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const authHeaders = getAuthHeaders();
  
  const response = await fetch(url, {
    ...options,
    headers: {
      ...authHeaders,
      ...options.headers
    }
  });

  // Handle authentication errors
  if (response.status === 401) {
    handleAuthError();
    throw new ApiServiceError('Authentication required', 'HTTP_401');
  }

  return response;
}

/**
 * Custom error class for API-related errors with enhanced typing
 */
export class ApiServiceError extends Error {
  constructor(
    message: string,
    public readonly code?: ApiErrorCode,
    public readonly details?: unknown,
    public readonly validationErrors?: ValidationError[]
  ) {
    super(message);
    this.name = 'ApiServiceError';
  }

  /**
   * Check if this error is a validation error
   */
  isValidationError(): boolean {
    return this.code === 'VALIDATION_ERROR' && Array.isArray(this.validationErrors);
  }

  /**
   * Get formatted validation error messages
   */
  getValidationMessages(): string[] {
    if (!this.validationErrors) return [];
    return this.validationErrors.map(error => `${error.field}: ${error.message}`);
  }
}

/**
 * Image Generation API service class
 * Provides methods for interacting with the backend image generation service
 */
export class ImageGenerationAPI {
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(baseUrl: string = API_CONFIG.BASE_URL, timeout: number = API_CONFIG.TIMEOUT) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
  }

  /**
   * Generate images using the backend API
   * @param request - The image generation request parameters
   * @param signal - Optional AbortSignal for request cancellation
   * @returns Promise resolving to the API response
   * @throws ApiServiceError for various error conditions
   */
  async generateImages(
    request: ImageGenerationRequest,
    signal?: AbortSignal
  ): Promise<ImageGenerationResponse> {
    // Validate input parameters
    this.validateRequest(request);

    // Create AbortController for timeout if no signal provided
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log('Request timeout reached, aborting...');
      controller.abort();
    }, this.timeout);

    // Use provided signal or timeout controller, but combine them if both exist
    let effectiveSignal: AbortSignal;

    if (signal) {
      // If external signal is provided, we need to handle both timeout and external cancellation
      effectiveSignal = signal;

      // Listen for external signal abort
      if (signal.aborted) {
        clearTimeout(timeoutId);
        throw new Error('Request was already cancelled');
      }

      // Set up listener for external signal
      const abortHandler = () => {
        console.log('Request cancelled by external signal');
        clearTimeout(timeoutId);
        controller.abort();
      };

      signal.addEventListener('abort', abortHandler, { once: true });

      // Clean up listener when timeout controller aborts
      controller.signal.addEventListener('abort', () => {
        signal.removeEventListener('abort', abortHandler);
      }, { once: true });
    } else {
      effectiveSignal = controller.signal;
    }

    try {
      const url = `${this.baseUrl}${API_CONFIG.ENDPOINTS.IMAGE_GENERATION}`;

      console.log('Starting image generation request...');

      const response = await authenticatedFetch(url, {
        method: 'POST',
        body: JSON.stringify(request),
        signal: effectiveSignal
      });

      // Clear timeout if request completes successfully
      clearTimeout(timeoutId);
      console.log('Request completed successfully');

      // Handle HTTP errors
      if (!response.ok) {
        await this.handleHttpError(response);
      }

      // Parse and validate response
      const data = await this.parseResponse(response);

      // Validate response structure
      this.validateResponse(data);

      return data as ImageGenerationResponse;

    } catch (error) {
      // Always clear timeout on any error
      clearTimeout(timeoutId);

      // Log cancellation vs other errors differently
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Request was cancelled or timed out');
      } else {
        console.error('Request failed with error:', error);
      }

      throw this.handleApiError(error);
    }
  }

  /**
   * Validate the request parameters using runtime validation
   * @param request - The request to validate
   * @throws ApiServiceError if validation fails
   */
  private validateRequest(request: ImageGenerationRequest): void {
    const validationErrors = validateImageGenerationRequest(request);

    if (validationErrors.length > 0) {
      const errorMessage = `Request validation failed: ${validationErrors.map(e => `${e.field}: ${e.message}`).join(', ')}`;
      throw new ApiServiceError(
        errorMessage,
        'VALIDATION_ERROR',
        { request },
        validationErrors
      );
    }
  }

  /**
   * Handle HTTP error responses with proper typing
   * @param response - The failed HTTP response
   * @throws ApiServiceError with appropriate error details
   */
  private async handleHttpError(response: Response): Promise<never> {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    let errorCode: ApiErrorCode = `HTTP_${response.status}` as ApiErrorCode;
    let errorDetails: unknown = undefined;

    try {
      // Try to parse error response body
      const errorData = await response.json();
      if (errorData && typeof errorData === 'object') {
        if ('error' in errorData && typeof errorData.error === 'string') {
          errorMessage = errorData.error;
        }
        if ('code' in errorData && typeof errorData.code === 'string') {
          // Validate that the code is a valid ApiErrorCode
          const validCodes: ApiErrorCode[] = [
            'NETWORK_ERROR', 'REQUEST_CANCELLED',
            'HTTP_400', 'HTTP_401', 'HTTP_403', 'HTTP_404', 'HTTP_429',
            'HTTP_500', 'HTTP_502', 'HTTP_503', 'HTTP_504',
            'INVALID_PROMPT', 'INVALID_RATIO', 'INVALID_RESOLUTION', 'INVALID_STYLE',
            'PARSE_ERROR', 'INVALID_RESPONSE', 'API_ERROR', 'UNKNOWN_ERROR', 'VALIDATION_ERROR'
          ];

          if (validCodes.includes(errorData.code as ApiErrorCode)) {
            errorCode = errorData.code as ApiErrorCode;
          }
        }
        errorDetails = errorData;
      }
    } catch (parseError) {
      // If parsing fails, include parse error in details
      errorDetails = { parseError, originalResponse: response.statusText };
    }

    throw new ApiServiceError(errorMessage, errorCode, errorDetails);
  }

  /**
   * Parse the response JSON safely
   * @param response - The HTTP response to parse
   * @returns Parsed response data
   * @throws ApiServiceError if parsing fails
   */
  private async parseResponse(response: Response): Promise<ApiResponse> {
    try {
      const data = await response.json();
      return data as ApiResponse;
    } catch (error) {
      throw new ApiServiceError(
        'Failed to parse response as JSON',
        'PARSE_ERROR',
        { originalError: error }
      );
    }
  }

  /**
   * Validate the response structure using runtime validation
   * @param data - The parsed response data
   * @throws ApiServiceError if response structure is invalid
   */
  private validateResponse(data: ApiResponse): void {
    const validationErrors = validateImageGenerationResponse(data);

    if (validationErrors.length > 0) {
      const errorMessage = `Response validation failed: ${validationErrors.map(e => `${e.field}: ${e.message}`).join(', ')}`;
      throw new ApiServiceError(
        errorMessage,
        'INVALID_RESPONSE',
        { response: data },
        validationErrors
      );
    }

    // If it's an API error response, throw it as an ApiServiceError
    if (isApiError(data)) {
      throw new ApiServiceError(
        data.error || 'Unknown API error',
        (data.code as ApiErrorCode) || 'API_ERROR',
        data.details
      );
    }
  }

  /**
   * Rewrite a prompt using AI enhancement
   * @param request - The prompt rewrite request parameters
   * @param signal - Optional AbortSignal for request cancellation
   * @returns Promise resolving to the rewrite response
   * @throws ApiServiceError for various error conditions
   */
  async rewritePrompt(
    request: PromptRewriteRequest,
    signal?: AbortSignal
  ): Promise<PromptRewriteResponse> {
    // Validate input parameters
    this.validateRewriteRequest(request);

    // Create AbortController for timeout if no signal provided
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log('Rewrite request timeout reached, aborting...');
      controller.abort();
    }, this.timeout);

    // Use provided signal or timeout controller
    let effectiveSignal: AbortSignal;

    if (signal) {
      effectiveSignal = signal;

      if (signal.aborted) {
        clearTimeout(timeoutId);
        throw new Error('Request was already cancelled');
      }

      const abortHandler = () => {
        console.log('Rewrite request cancelled by external signal');
        clearTimeout(timeoutId);
        controller.abort();
      };

      signal.addEventListener('abort', abortHandler, { once: true });

      controller.signal.addEventListener('abort', () => {
        signal.removeEventListener('abort', abortHandler);
      }, { once: true });
    } else {
      effectiveSignal = controller.signal;
    }

    try {
      const url = `${this.baseUrl}${API_CONFIG.ENDPOINTS.PROMPT_REWRITE}`;

      console.log('Starting prompt rewrite request...');

      const response = await authenticatedFetch(url, {
        method: 'POST',
        body: JSON.stringify(request),
        signal: effectiveSignal
      });

      clearTimeout(timeoutId);
      console.log('Rewrite request completed successfully');

      // Handle HTTP errors
      if (!response.ok) {
        await this.handleHttpError(response);
      }

      // Parse and validate response
      const data = await this.parseResponse(response);

      // Validate response structure
      this.validateRewriteResponse(data);

      return data as PromptRewriteResponse;

    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Rewrite request was cancelled or timed out');
      } else {
        console.error('Rewrite request failed with error:', error);
      }

      throw this.handleApiError(error);
    }
  }

  /**
   * Validate the rewrite request parameters using runtime validation
   * @param request - The request to validate
   * @throws ApiServiceError if validation fails
   */
  private validateRewriteRequest(request: PromptRewriteRequest): void {
    const validationErrors = validatePromptRewriteRequest(request);

    if (validationErrors.length > 0) {
      const errorMessage = `Rewrite request validation failed: ${validationErrors.map(e => `${e.field}: ${e.message}`).join(', ')}`;
      throw new ApiServiceError(
        errorMessage,
        'VALIDATION_ERROR',
        { request },
        validationErrors
      );
    }
  }

  /**
   * Validate the rewrite response structure using runtime validation
   * @param data - The parsed response data
   * @throws ApiServiceError if response structure is invalid
   */
  private validateRewriteResponse(data: unknown): void {
    const validationErrors = validatePromptRewriteResponse(data);

    if (validationErrors.length > 0) {
      const errorMessage = `Rewrite response validation failed: ${validationErrors.map(e => `${e.field}: ${e.message}`).join(', ')}`;
      throw new ApiServiceError(
        errorMessage,
        'INVALID_RESPONSE',
        { response: data },
        validationErrors
      );
    }

    // If it's an API error response, throw it as an ApiServiceError
    const response = data as any;
    if (response && typeof response === 'object' && response.success === false) {
      throw new ApiServiceError(
        response.error || 'Unknown API error',
        (response.code as ApiErrorCode) || 'API_ERROR',
        response.details
      );
    }
  }

  /**
   * Handle and transform various error types into ApiServiceError
   * @param error - The caught error
   * @returns ApiServiceError with appropriate message and details
   */
  private handleApiError(error: unknown): ApiServiceError {
    // If already an ApiServiceError, return as-is
    if (error instanceof ApiServiceError) {
      return error;
    }

    // Handle AbortError (request cancellation/timeout)
    if (error instanceof Error && error.name === 'AbortError') {
      return new ApiServiceError(
        'Request was cancelled or timed out',
        'REQUEST_CANCELLED',
        { originalError: error }
      );
    }

    // Handle TypeError (network errors, CORS, etc.)
    if (error instanceof TypeError) {
      return new ApiServiceError(
        'Network error: Unable to connect to the server',
        'NETWORK_ERROR',
        { originalError: error }
      );
    }

    // Handle other Error instances
    if (error instanceof Error) {
      return new ApiServiceError(
        `Unexpected error: ${error.message}`,
        'UNKNOWN_ERROR',
        { originalError: error }
      );
    }

    // Handle non-Error objects
    return new ApiServiceError(
      'An unknown error occurred',
      'UNKNOWN_ERROR',
      { originalError: error }
    );
  }
}

/**
 * Default instance of the ImageGenerationAPI
 * Can be used directly for most use cases
 */
export const imageGenerationAPI = new ImageGenerationAPI();

/**
 * Convenience function for generating images
 * @param request - The image generation request
 * @param signal - Optional AbortSignal for cancellation
 * @returns Promise resolving to the generated images response
 */
export async function generateImages(
  request: ImageGenerationRequest,
  signal?: AbortSignal
): Promise<ImageGenerationResponse> {
  return imageGenerationAPI.generateImages(request, signal);
}

/**
 * Convenience function for rewriting prompts
 * @param request - The prompt rewrite request
 * @param signal - Optional AbortSignal for cancellation
 * @returns Promise resolving to the rewrite response
 */
export async function rewritePrompt(
  request: PromptRewriteRequest,
  signal?: AbortSignal
): Promise<PromptRewriteResponse> {
  return imageGenerationAPI.rewritePrompt(request, signal);
}

/**
 * Download an image from a URL
 * @param imageUrl - The URL of the image to download
 * @param filename - Optional filename for the download
 * @param signal - Optional AbortSignal for cancellation
 * @returns Promise that resolves when download starts
 */
export async function downloadImage(
  imageUrl: string,
  filename?: string,
  signal?: AbortSignal
): Promise<void> {
  const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.IMAGE_DOWNLOAD}`;

  const response = await authenticatedFetch(url, {
    method: 'POST',
    body: JSON.stringify({
      image_url: imageUrl,
      filename: filename || 'generated_image.png'
    }),
    signal
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiServiceError(
      errorData.error || `Download failed: ${response.status}`,
      errorData.code || 'DOWNLOAD_ERROR'
    );
  }

  // Get filename from response headers or use provided filename
  const contentDisposition = response.headers.get('content-disposition');
  let downloadFilename = filename || 'generated_image.png';

  if (contentDisposition) {
    const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
    if (filenameMatch) {
      downloadFilename = filenameMatch[1];
    }
  }

  // Create blob and download
  const blob = await response.blob();
  const downloadUrl = window.URL.createObjectURL(blob);

  // Create temporary download link
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = downloadFilename;
  document.body.appendChild(link);
  link.click();

  // Cleanup
  document.body.removeChild(link);
  window.URL.revokeObjectURL(downloadUrl);
}

/**
 * Edit an image using the backend API
 * @param imageFile - The image file to edit
 * @param request - The image edit request parameters
 * @param signal - Optional AbortSignal for cancellation
 * @returns Promise resolving to the edit response
 */
export async function editImage(
  imageFile: File,
  request: ImageEditRequest,
  signal?: AbortSignal
): Promise<ImageEditResponse> {
  const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.IMAGE_EDIT}`;

  // Create FormData for file upload
  const formData = new FormData();
  formData.append('image', imageFile);
  formData.append('prompt', request.prompt);
  formData.append('editMode', request.editMode);
  formData.append('maskMode', request.maskMode);
  if (request.numImages !== undefined) {
    formData.append('numImages', request.numImages.toString());
  }

  // For FormData, we need to handle headers differently
  const token = Cookies.get('auth_token');
  const headers: HeadersInit = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: formData, // Don't set Content-Type header for FormData
    signal
  });

  // Handle authentication errors
  if (response.status === 401) {
    handleAuthError();
    throw new ApiServiceError('Authentication required', 'HTTP_401');
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiServiceError(
      errorData.error || `Edit failed: ${response.status}`,
      errorData.code || 'EDIT_ERROR'
    );
  }

  const data = await response.json();

  if (!data.success) {
    throw new ApiServiceError(
      data.error || 'Edit failed',
      data.code || 'EDIT_ERROR'
    );
  }

  return data as ImageEditResponse;
}

/**
 * Utility function to create a combined AbortSignal from multiple sources
 * @param signals - Array of AbortSignals to combine
 * @returns A new AbortSignal that aborts when any of the input signals abort
 */
export function combineAbortSignals(...signals: (AbortSignal | undefined)[]): AbortSignal {
  const controller = new AbortController();

  // Filter out undefined signals
  const validSignals = signals.filter((signal): signal is AbortSignal => signal !== undefined);

  // If any signal is already aborted, abort immediately
  if (validSignals.some(signal => signal.aborted)) {
    controller.abort();
    return controller.signal;
  }

  // Set up listeners for all signals
  const abortHandler = () => {
    controller.abort();
  };

  validSignals.forEach(signal => {
    signal.addEventListener('abort', abortHandler, { once: true });
  });

  // Clean up listeners when our controller aborts
  controller.signal.addEventListener('abort', () => {
    validSignals.forEach(signal => {
      signal.removeEventListener('abort', abortHandler);
    });
  }, { once: true });

  return controller.signal;
}

/**
 * Utility function to safely abort a controller and handle cleanup
 * @param controller - The AbortController to abort
 * @param reason - Optional reason for the abort
 */
export function safeAbort(controller: AbortController | null | undefined, reason?: string): void {
  if (controller && !controller.signal.aborted) {
    if (reason) {
      console.log(`Aborting request: ${reason}`);
    }
    try {
      controller.abort();
    } catch (error) {
      console.warn('Error while aborting controller:', error);
    }
  }
}

/**
 * Brand Guidelines API functions
 */

export interface BrandGuidelinesResponse {
  success: boolean;
  data?: {
    image_guidelines: string;
    video_guidelines: string;
  };
  error?: string;
}

export interface UpdateBrandGuidelinesRequest {
  image_guidelines: string;
  video_guidelines: string;
}

export interface UpdateBrandGuidelinesResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Get brand guidelines for both image and video
 * @param signal - Optional AbortSignal for cancellation
 * @returns Promise resolving to brand guidelines data
 */
export async function getBrandGuidelines(signal?: AbortSignal): Promise<BrandGuidelinesResponse> {
  const url = `${API_CONFIG.BASE_URL}/api/brand-guidelines`;

  try {
    const response = await authenticatedFetch(url, {
      method: 'GET',
      signal
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiServiceError(
        errorData.error || `Failed to fetch brand guidelines: ${response.status}`,
        errorData.code || 'FETCH_ERROR'
      );
    }

    const data = await response.json();
    return data as BrandGuidelinesResponse;
  } catch (error) {
    if (error instanceof ApiServiceError) {
      throw error;
    }
    throw new ApiServiceError(
      'Failed to fetch brand guidelines',
      'NETWORK_ERROR',
      { originalError: error }
    );
  }
}

/**
 * Update brand guidelines for both image and video
 * @param request - The brand guidelines update request
 * @param signal - Optional AbortSignal for cancellation
 * @returns Promise resolving to update response
 */
export async function updateBrandGuidelines(
  request: UpdateBrandGuidelinesRequest,
  signal?: AbortSignal
): Promise<UpdateBrandGuidelinesResponse> {
  const url = `${API_CONFIG.BASE_URL}/api/brand-guidelines`;

  try {
    const response = await authenticatedFetch(url, {
      method: 'POST',
      body: JSON.stringify(request),
      signal
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiServiceError(
        errorData.error || `Failed to update brand guidelines: ${response.status}`,
        errorData.code || 'UPDATE_ERROR'
      );
    }

    const data = await response.json();
    return data as UpdateBrandGuidelinesResponse;
  } catch (error) {
    if (error instanceof ApiServiceError) {
      throw error;
    }
    throw new ApiServiceError(
      'Failed to update brand guidelines',
      'NETWORK_ERROR',
      { originalError: error }
    );
  }
}

/**
 * History API functions
 */

export interface HistoryItem {
  id: string;
  type: "image" | "video";
  title: string;
  prompt: string;
  thumbnail: string | null;
  createdAt: string;
  settings: {
    aspectRatio?: string;
    resolution?: string;
    duration?: string;
    model?: string;
  };
  mediaUrls: string[];
  hasError: boolean;
  errorMessage?: string;
  generationTime?: number;
  model?: string;
  mimeType?: string;
}

export interface HistoryResponse {
  success: boolean;
  data?: {
    items: HistoryItem[];
    page: number;
    per_page: number;
    total_items: number;
    has_more: boolean;
  };
  error?: string;
}

export interface HistoryStatsResponse {
  success: boolean;
  data?: {
    total_items: number;
    image_count: number;
    video_count: number;
    error_count: number;
    success_rate: number;
  };
  error?: string;
}

export interface HistoryItemResponse {
  success: boolean;
  data?: HistoryItem;
  error?: string;
}

export interface DeleteHistoryItemResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Get paginated history of media items
 * @param params - Query parameters for filtering and pagination
 * @param signal - Optional AbortSignal for cancellation
 * @returns Promise resolving to history data
 */
export async function getHistory(params: {
  page?: number;
  per_page?: number;
  type?: 'all' | 'images' | 'videos';
  error_filter?: 'all' | 'no_errors' | 'only_errors';
  sort_by?: 'newest' | 'oldest' | 'name';
  search?: string;
  user_email?: string;
} = {}, signal?: AbortSignal): Promise<HistoryResponse> {
  const searchParams = new URLSearchParams();

  if (params.page) searchParams.set('page', params.page.toString());
  if (params.per_page) searchParams.set('per_page', params.per_page.toString());
  if (params.type) searchParams.set('type', params.type);
  if (params.error_filter) searchParams.set('error_filter', params.error_filter);
  if (params.sort_by) searchParams.set('sort_by', params.sort_by);
  if (params.search) searchParams.set('search', params.search);
  if (params.user_email) searchParams.set('user_email', params.user_email);

  const url = `${API_CONFIG.BASE_URL}/api/history?${searchParams.toString()}`;

  try {
    const response = await authenticatedFetch(url, {
      method: 'GET',
      signal
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiServiceError(
        errorData.error || `Failed to fetch history: ${response.status}`,
        errorData.code || 'FETCH_ERROR'
      );
    }

    const data = await response.json();
    return data as HistoryResponse;
  } catch (error) {
    if (error instanceof ApiServiceError) {
      throw error;
    }
    throw new ApiServiceError(
      'Failed to fetch history',
      'NETWORK_ERROR',
      { originalError: error }
    );
  }
}

/**
 * Get history statistics
 * @param userEmail - Optional user email filter
 * @param signal - Optional AbortSignal for cancellation
 * @returns Promise resolving to history statistics
 */
export async function getHistoryStats(userEmail?: string, signal?: AbortSignal): Promise<HistoryStatsResponse> {
  const searchParams = new URLSearchParams();
  if (userEmail) searchParams.set('user_email', userEmail);

  const url = `${API_CONFIG.BASE_URL}/api/history/stats?${searchParams.toString()}`;

  try {
    const response = await authenticatedFetch(url, {
      method: 'GET',
      signal
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiServiceError(
        errorData.error || `Failed to fetch history stats: ${response.status}`,
        errorData.code || 'FETCH_ERROR'
      );
    }

    const data = await response.json();
    return data as HistoryStatsResponse;
  } catch (error) {
    if (error instanceof ApiServiceError) {
      throw error;
    }
    throw new ApiServiceError(
      'Failed to fetch history statistics',
      'NETWORK_ERROR',
      { originalError: error }
    );
  }
}

/**
 * Get a specific history item by ID
 * @param itemId - The ID of the history item
 * @param signal - Optional AbortSignal for cancellation
 * @returns Promise resolving to history item data
 */
export async function getHistoryItem(itemId: string, signal?: AbortSignal): Promise<HistoryItemResponse> {
  const url = `${API_CONFIG.BASE_URL}/api/history/${itemId}`;

  try {
    const response = await authenticatedFetch(url, {
      method: 'GET',
      signal
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiServiceError(
        errorData.error || `Failed to fetch history item: ${response.status}`,
        errorData.code || 'FETCH_ERROR'
      );
    }

    const data = await response.json();
    return data as HistoryItemResponse;
  } catch (error) {
    if (error instanceof ApiServiceError) {
      throw error;
    }
    throw new ApiServiceError(
      'Failed to fetch history item',
      'NETWORK_ERROR',
      { originalError: error }
    );
  }
}

/**
 * Delete a specific history item
 * @param itemId - The ID of the history item to delete
 * @param signal - Optional AbortSignal for cancellation
 * @returns Promise resolving to delete confirmation
 */
export async function deleteHistoryItem(itemId: string, signal?: AbortSignal): Promise<DeleteHistoryItemResponse> {
  const url = `${API_CONFIG.BASE_URL}/api/history/${itemId}`;

  try {
    const response = await authenticatedFetch(url, {
      method: 'DELETE',
      signal
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiServiceError(
        errorData.error || `Failed to delete history item: ${response.status}`,
        errorData.code || 'DELETE_ERROR'
      );
    }

    const data = await response.json();
    return data as DeleteHistoryItemResponse;
  } catch (error) {
    if (error instanceof ApiServiceError) {
      throw error;
    }
    throw new ApiServiceError(
      'Failed to delete history item',
      'NETWORK_ERROR',
      { originalError: error }
    );
  }
}

/**
 * Download a specific history item
 * @param itemId - The ID of the history item to download
 * @param signal - Optional AbortSignal for cancellation
 * @returns Promise resolving to the downloaded file blob
 */
export async function downloadHistoryItem(itemId: string, signal?: AbortSignal): Promise<{ blob: Blob; filename: string }> {
  const url = `${API_CONFIG.BASE_URL}/api/history/${itemId}/download`;

  try {
    const response = await authenticatedFetch(url, {
      method: 'GET',
      signal
    });

    if (!response.ok) {
      // Try to get error message from JSON response
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiServiceError(
          errorData.error || `Failed to download media: ${response.status}`,
          errorData.code || 'DOWNLOAD_ERROR'
        );
      } else {
        throw new ApiServiceError(
          `Failed to download media: ${response.status} ${response.statusText}`,
          'DOWNLOAD_ERROR'
        );
      }
    }

    // Get the blob data
    const blob = await response.blob();

    // Extract filename from Content-Disposition header or create a default one
    let filename = `media_${itemId}`;
    const contentDisposition = response.headers.get('content-disposition');
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1].replace(/['"]/g, '');
      }
    }

    // If no filename from header, try to determine from content type
    if (filename === `media_${itemId}`) {
      const contentType = response.headers.get('content-type') || '';
      let extension = '';

      if (contentType.startsWith('image/')) {
        if (contentType.includes('jpeg') || contentType.includes('jpg')) {
          extension = '.jpg';
        } else if (contentType.includes('png')) {
          extension = '.png';
        } else if (contentType.includes('webp')) {
          extension = '.webp';
        } else if (contentType.includes('gif')) {
          extension = '.gif';
        } else {
          extension = '.jpg';
        }
      } else if (contentType.startsWith('video/')) {
        if (contentType.includes('mp4')) {
          extension = '.mp4';
        } else if (contentType.includes('webm')) {
          extension = '.webm';
        } else if (contentType.includes('ogg')) {
          extension = '.ogg';
        } else {
          extension = '.mp4';
        }
      }

      filename = `media_${itemId}${extension}`;
    }

    return { blob, filename };
  } catch (error) {
    if (error instanceof ApiServiceError) {
      throw error;
    }
    throw new ApiServiceError(
      'Failed to download media',
      'NETWORK_ERROR',
      { originalError: error }
    );
  }
}
/**

 * Video Generation API functions
 */

export interface VideoGenerationRequest {
  prompt: string;
  duration?: number;
  resolution?: string;
  style?: string;
}

export interface VideoGenerationResponse {
  success: boolean;
  data?: {
    video_url: string;
    thumbnail_url?: string;
    duration: number;
    resolution: string;
  };
  error?: string;
}

/**
 * Generate a video using the backend API
 * @param request - The video generation request parameters
 * @param signal - Optional AbortSignal for cancellation
 * @returns Promise resolving to the video generation response
 */
export async function generateVideo(
  request: VideoGenerationRequest,
  signal?: AbortSignal
): Promise<VideoGenerationResponse> {
  const url = `${API_CONFIG.BASE_URL}/api/video/generate`;

  try {
    const response = await authenticatedFetch(url, {
      method: 'POST',
      body: JSON.stringify(request),
      signal
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiServiceError(
        errorData.error || `Video generation failed: ${response.status}`,
        errorData.code || 'GENERATION_ERROR'
      );
    }

    const data = await response.json();
    return data as VideoGenerationResponse;
  } catch (error) {
    if (error instanceof ApiServiceError) {
      throw error;
    }
    throw new ApiServiceError(
      'Failed to generate video',
      'NETWORK_ERROR',
      { originalError: error }
    );
  }
}

/**
 * Prompt Enhancement API functions
 */

export interface PromptEnhanceRequest {
  prompt: string;
  type?: 'image' | 'video';
  style?: string;
}

export interface PromptEnhanceResponse {
  success: boolean;
  data?: {
    enhanced_prompt: string;
    original_prompt: string;
  };
  error?: string;
}

/**
 * Enhance a prompt using AI
 * @param request - The prompt enhancement request parameters
 * @param signal - Optional AbortSignal for cancellation
 * @returns Promise resolving to the enhanced prompt response
 */
export async function enhancePrompt(
  request: PromptEnhanceRequest,
  signal?: AbortSignal
): Promise<PromptEnhanceResponse> {
  const url = `${API_CONFIG.BASE_URL}/api/prompts/enhance`;

  try {
    const response = await authenticatedFetch(url, {
      method: 'POST',
      body: JSON.stringify(request),
      signal
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiServiceError(
        errorData.error || `Prompt enhancement failed: ${response.status}`,
        errorData.code || 'ENHANCEMENT_ERROR'
      );
    }

    const data = await response.json();
    return data as PromptEnhanceResponse;
  } catch (error) {
    if (error instanceof ApiServiceError) {
      throw error;
    }
    throw new ApiServiceError(
      'Failed to enhance prompt',
      'NETWORK_ERROR',
      { originalError: error }
    );
  }
}

/**
 * Generate a prompt using AI
 * @param request - The prompt generation request parameters
 * @param signal - Optional AbortSignal for cancellation
 * @returns Promise resolving to the generated prompt response
 */
export async function generatePrompt(
  request: { description: string; type?: 'image' | 'video' },
  signal?: AbortSignal
): Promise<PromptEnhanceResponse> {
  const url = `${API_CONFIG.BASE_URL}/api/prompts/generate`;

  try {
    const response = await authenticatedFetch(url, {
      method: 'POST',
      body: JSON.stringify(request),
      signal
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiServiceError(
        errorData.error || `Prompt generation failed: ${response.status}`,
        errorData.code || 'GENERATION_ERROR'
      );
    }

    const data = await response.json();
    return data as PromptEnhanceResponse;
  } catch (error) {
    if (error instanceof ApiServiceError) {
      throw error;
    }
    throw new ApiServiceError(
      'Failed to generate prompt',
      'NETWORK_ERROR',
      { originalError: error }
    );
  }
}

/**
 * Upload API functions
 */

export interface SignedUrlRequest {
  fileName: string;
  contentType: string;
}

export interface SignedUrlResponse {
  success: boolean;
  data?: {
    signed_url: string;
    file_url: string;
    expires_in: number;
  };
  error?: string;
}

/**
 * Generate a signed URL for file upload
 * @param request - The signed URL request parameters
 * @param signal - Optional AbortSignal for cancellation
 * @returns Promise resolving to the signed URL response
 */
export async function generateSignedUrl(
  request: SignedUrlRequest,
  signal?: AbortSignal
): Promise<SignedUrlResponse> {
  const url = `${API_CONFIG.BASE_URL}/api/uploads/generate-signed-url`;

  try {
    const response = await authenticatedFetch(url, {
      method: 'POST',
      body: JSON.stringify(request),
      signal
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiServiceError(
        errorData.error || `Failed to generate signed URL: ${response.status}`,
        errorData.code || 'UPLOAD_ERROR'
      );
    }

    const data = await response.json();
    return data as SignedUrlResponse;
  } catch (error) {
    if (error instanceof ApiServiceError) {
      throw error;
    }
    throw new ApiServiceError(
      'Failed to generate signed URL',
      'NETWORK_ERROR',
      { originalError: error }
    );
  }
}

/**
 * Bucket API functions
 */

export interface BucketListResponse {
  success: boolean;
  data?: {
    buckets: string[];
  };
  error?: string;
}

/**
 * List all available buckets
 * @param signal - Optional AbortSignal for cancellation
 * @returns Promise resolving to the bucket list response
 */
export async function listBuckets(signal?: AbortSignal): Promise<BucketListResponse> {
  const url = `${API_CONFIG.BASE_URL}/api/buckets/list`;

  try {
    const response = await authenticatedFetch(url, {
      method: 'GET',
      signal
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiServiceError(
        errorData.error || `Failed to list buckets: ${response.status}`,
        errorData.code || 'FETCH_ERROR'
      );
    }

    const data = await response.json();
    return data as BucketListResponse;
  } catch (error) {
    if (error instanceof ApiServiceError) {
      throw error;
    }
    throw new ApiServiceError(
      'Failed to list buckets',
      'NETWORK_ERROR',
      { originalError: error }
    );
  }
}

/**
 * Export the authenticated API client for direct use
 */
export { authenticatedFetch as apiClient };