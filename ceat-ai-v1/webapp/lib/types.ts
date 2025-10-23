/**
 * TypeScript interfaces and types for Image Generation API integration
 */

/**
 * Valid aspect ratio values
 */
export const ASPECT_RATIOS = ["1:1", "16:9", "9:16", "4:3"] as const;
export type AspectRatio = typeof ASPECT_RATIOS[number];

/**
 * Valid resolution values
 */
export const RESOLUTIONS = ["512x512", "1024x1024", "1536x1536", "2048x2048"] as const;
export type Resolution = typeof RESOLUTIONS[number];

/**
 * Valid style values
 */
export const STYLES = ["realistic", "artistic", "cartoon", "abstract"] as const;
export type Style = typeof STYLES[number];

/**
 * Valid content type values
 */
export const CONTENT_TYPES = ["none", "photo", "art"] as const;
export type ContentType = typeof CONTENT_TYPES[number];

/**
 * Valid color and tone values
 */
export const COLOR_TONES = [
  "none", 
  "black and white", 
  "cool tone", 
  "golden", 
  "monochromatic", 
  "muted color", 
  "pastel color", 
  "toned image"
] as const;
export type ColorTone = typeof COLOR_TONES[number];

/**
 * Valid lighting values
 */
export const LIGHTING_OPTIONS = [
  "none",
  "backlighting",
  "dramatic light",
  "long-time exposure",
  "low lighting",
  "multiexposure",
  "studio light",
  "surreal lighting"
] as const;
export type Lighting = typeof LIGHTING_OPTIONS[number];

/**
 * Valid composition values
 */
export const COMPOSITION_OPTIONS = [
  "none",
  "closeup",
  "knolling",
  "landscape photography",
  "photographed through window",
  "shallow depth of field",
  "shot from above",
  "shot from below",
  "surface details",
  "wide angle"
] as const;
export type Composition = typeof COMPOSITION_OPTIONS[number];

/**
 * Valid number of images values
 */
export const NUM_IMAGES_OPTIONS = [1, 2, 3, 4] as const;
export type NumImages = typeof NUM_IMAGES_OPTIONS[number];

/**
 * Request payload for image generation API with strict typing
 */
export interface ImageGenerationRequest {
  prompt: string;        // User's text description for image generation (1-2000 chars)
  ratio: AspectRatio;    // Aspect ratio from predefined values
  resolution: Resolution; // Image resolution from predefined values
  style: Style;          // Generation style from predefined values
  contentType?: ContentType; // Optional content type filter
  colorTone?: ColorTone; // Optional color and tone filter
  lighting?: Lighting;   // Optional lighting filter
  composition?: Composition; // Optional composition filter
  numImages?: NumImages; // Optional number of images to generate
}

/**
 * Response from image generation API
 */
export interface ImageGenerationResponse {
  images: string[];      // Array of signed URLs for generated images
  success: boolean;      // Indicates if the request was successful
  message?: string;      // Optional success or informational message
  requestId?: string;    // Optional request tracking identifier
  model_used?: string;   // Optional model name used for generation
  enhanced_prompt?: string; // Optional enhanced prompt used for generation
  expires_in_hours?: number; // Optional expiration time for signed URLs
  brand_guidelines_applied?: boolean; // Optional flag indicating brand guidelines were applied
}

/**
 * Error response structure for API failures
 */
export interface ApiError {
  success: false;        // Always false for error responses
  error: string;         // Human-readable error message
  code?: string;         // Optional error code for programmatic handling
  details?: unknown;     // Additional error context or validation details
}

/**
 * Union type for all possible API responses
 */
export type ApiResponse = ImageGenerationResponse | ApiError;

/**
 * Validation error details
 */
export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

/**
 * Enhanced error types for better error handling
 */
export type ApiErrorCode = 
  | 'NETWORK_ERROR'
  | 'REQUEST_CANCELLED' 
  | 'HTTP_400' | 'HTTP_401' | 'HTTP_403' | 'HTTP_404' | 'HTTP_429'
  | 'HTTP_500' | 'HTTP_502' | 'HTTP_503' | 'HTTP_504'
  | 'INVALID_PROMPT' | 'INVALID_RATIO' | 'INVALID_RESOLUTION' | 'INVALID_STYLE'
  | 'PARSE_ERROR' | 'INVALID_RESPONSE' | 'API_ERROR' | 'UNKNOWN_ERROR'
  | 'VALIDATION_ERROR';

/**
 * Type guard to check if response is an error
 */
export function isApiError(response: ApiResponse): response is ApiError {
  return !response.success;
}

/**
 * Type guard to check if response is successful
 */
export function isSuccessResponse(response: ApiResponse): response is ImageGenerationResponse {
  return response.success === true;
}

/**
 * Runtime validation for ImageGenerationRequest
 */
export function validateImageGenerationRequest(request: unknown): ValidationError[] {
  const errors: ValidationError[] = [];
  
  if (!request || typeof request !== 'object') {
    errors.push({ field: 'request', message: 'Request must be an object' });
    return errors;
  }
  
  const req = request as Record<string, unknown>;
  
  // Validate prompt
  if (!req.prompt || typeof req.prompt !== 'string') {
    errors.push({ field: 'prompt', message: 'Prompt must be a string', value: req.prompt });
  } else if (req.prompt.trim().length === 0) {
    errors.push({ field: 'prompt', message: 'Prompt cannot be empty', value: req.prompt });
  } else if (req.prompt.length > 2000) {
    errors.push({ field: 'prompt', message: 'Prompt must be less than 2000 characters', value: req.prompt });
  }
  
  // Validate ratio
  if (!req.ratio || typeof req.ratio !== 'string') {
    errors.push({ field: 'ratio', message: 'Aspect ratio must be a string', value: req.ratio });
  } else if (!ASPECT_RATIOS.includes(req.ratio as AspectRatio)) {
    errors.push({ 
      field: 'ratio', 
      message: `Aspect ratio must be one of: ${ASPECT_RATIOS.join(', ')}`, 
      value: req.ratio 
    });
  }
  
  // Validate resolution
  if (!req.resolution || typeof req.resolution !== 'string') {
    errors.push({ field: 'resolution', message: 'Resolution must be a string', value: req.resolution });
  } else if (!RESOLUTIONS.includes(req.resolution as Resolution)) {
    errors.push({ 
      field: 'resolution', 
      message: `Resolution must be one of: ${RESOLUTIONS.join(', ')}`, 
      value: req.resolution 
    });
  }
  
  // Validate style
  if (!req.style || typeof req.style !== 'string') {
    errors.push({ field: 'style', message: 'Style must be a string', value: req.style });
  } else if (!STYLES.includes(req.style as Style)) {
    errors.push({ 
      field: 'style', 
      message: `Style must be one of: ${STYLES.join(', ')}`, 
      value: req.style 
    });
  }
  
  // Validate optional contentType
  if (req.contentType !== undefined) {
    if (typeof req.contentType !== 'string') {
      errors.push({ field: 'contentType', message: 'Content type must be a string', value: req.contentType });
    } else if (!CONTENT_TYPES.includes(req.contentType as ContentType)) {
      errors.push({ 
        field: 'contentType', 
        message: `Content type must be one of: ${CONTENT_TYPES.join(', ')}`, 
        value: req.contentType 
      });
    }
  }
  
  // Validate optional colorTone
  if (req.colorTone !== undefined) {
    if (typeof req.colorTone !== 'string') {
      errors.push({ field: 'colorTone', message: 'Color tone must be a string', value: req.colorTone });
    } else if (!COLOR_TONES.includes(req.colorTone as ColorTone)) {
      errors.push({ 
        field: 'colorTone', 
        message: `Color tone must be one of: ${COLOR_TONES.join(', ')}`, 
        value: req.colorTone 
      });
    }
  }
  
  // Validate optional lighting
  if (req.lighting !== undefined) {
    if (typeof req.lighting !== 'string') {
      errors.push({ field: 'lighting', message: 'Lighting must be a string', value: req.lighting });
    } else if (!LIGHTING_OPTIONS.includes(req.lighting as Lighting)) {
      errors.push({ 
        field: 'lighting', 
        message: `Lighting must be one of: ${LIGHTING_OPTIONS.join(', ')}`, 
        value: req.lighting 
      });
    }
  }
  
  // Validate optional composition
  if (req.composition !== undefined) {
    if (typeof req.composition !== 'string') {
      errors.push({ field: 'composition', message: 'Composition must be a string', value: req.composition });
    } else if (!COMPOSITION_OPTIONS.includes(req.composition as Composition)) {
      errors.push({ 
        field: 'composition', 
        message: `Composition must be one of: ${COMPOSITION_OPTIONS.join(', ')}`, 
        value: req.composition 
      });
    }
  }
  
  // Validate optional numImages
  if (req.numImages !== undefined) {
    if (typeof req.numImages !== 'number') {
      errors.push({ field: 'numImages', message: 'Number of images must be a number', value: req.numImages });
    } else if (!NUM_IMAGES_OPTIONS.includes(req.numImages as NumImages)) {
      errors.push({ 
        field: 'numImages', 
        message: `Number of images must be one of: ${NUM_IMAGES_OPTIONS.join(', ')}`, 
        value: req.numImages 
      });
    }
  }
  
  return errors;
}

/**
 * Runtime validation for ImageGenerationResponse
 */
export function validateImageGenerationResponse(response: unknown): ValidationError[] {
  const errors: ValidationError[] = [];
  
  if (!response || typeof response !== 'object') {
    errors.push({ field: 'response', message: 'Response must be an object' });
    return errors;
  }
  
  const res = response as Record<string, unknown>;
  
  // Validate success field
  if (typeof res.success !== 'boolean') {
    errors.push({ field: 'success', message: 'Success field must be a boolean', value: res.success });
  }
  
  // If it's an error response, validate error fields
  if (res.success === false) {
    if (!res.error || typeof res.error !== 'string') {
      errors.push({ field: 'error', message: 'Error message must be a string', value: res.error });
    }
    return errors;
  }
  
  // If it's a success response, validate success fields
  if (res.success === true) {
    // Validate images array
    if (!Array.isArray(res.images)) {
      errors.push({ field: 'images', message: 'Images must be an array', value: res.images });
    } else {
      res.images.forEach((image, index) => {
        if (typeof image !== 'string') {
          errors.push({ 
            field: `images[${index}]`, 
            message: 'Each image must be a string', 
            value: image 
          });
        } else if (image.length === 0) {
          errors.push({ 
            field: `images[${index}]`, 
            message: 'Image string cannot be empty', 
            value: image 
          });
        }
      });
    }
    
    // Validate optional message field
    if (res.message !== undefined && typeof res.message !== 'string') {
      errors.push({ field: 'message', message: 'Message must be a string', value: res.message });
    }
    
    // Validate optional requestId field
    if (res.requestId !== undefined && typeof res.requestId !== 'string') {
      errors.push({ field: 'requestId', message: 'Request ID must be a string', value: res.requestId });
    }
    
    // Validate optional model_used field
    if (res.model_used !== undefined && typeof res.model_used !== 'string') {
      errors.push({ field: 'model_used', message: 'Model used must be a string', value: res.model_used });
    }
    
    // Validate optional enhanced_prompt field
    if (res.enhanced_prompt !== undefined && typeof res.enhanced_prompt !== 'string') {
      errors.push({ field: 'enhanced_prompt', message: 'Enhanced prompt must be a string', value: res.enhanced_prompt });
    }
    
    // Validate optional expires_in_hours field
    if (res.expires_in_hours !== undefined && typeof res.expires_in_hours !== 'number') {
      errors.push({ field: 'expires_in_hours', message: 'Expires in hours must be a number', value: res.expires_in_hours });
    }
    
    // Validate optional brand_guidelines_applied field
    if (res.brand_guidelines_applied !== undefined && typeof res.brand_guidelines_applied !== 'boolean') {
      errors.push({ field: 'brand_guidelines_applied', message: 'Brand guidelines applied must be a boolean', value: res.brand_guidelines_applied });
    }
  }
  
  return errors;
}

/**
 * Request payload for prompt rewrite API
 */
export interface PromptRewriteRequest {
  prompt: string;        // Original prompt to be rewritten (1-2000 chars)
}

/**
 * Response from prompt rewrite API
 */
export interface PromptRewriteResponse {
  success: boolean;      // Indicates if the request was successful
  original_prompt: string; // The original prompt that was sent
  enhanced_prompt: string; // The AI-enhanced version of the prompt
  message: string;       // Success or informational message
  warning?: string;      // Optional warning if AI enhancement failed
}

/**
 * Runtime validation for PromptRewriteRequest
 */
export function validatePromptRewriteRequest(request: unknown): ValidationError[] {
  const errors: ValidationError[] = [];
  
  if (!request || typeof request !== 'object') {
    errors.push({ field: 'request', message: 'Request must be an object' });
    return errors;
  }
  
  const req = request as Record<string, unknown>;
  
  // Validate prompt
  if (!req.prompt || typeof req.prompt !== 'string') {
    errors.push({ field: 'prompt', message: 'Prompt must be a string', value: req.prompt });
  } else if (req.prompt.trim().length === 0) {
    errors.push({ field: 'prompt', message: 'Prompt cannot be empty', value: req.prompt });
  } else if (req.prompt.length > 2000) {
    errors.push({ field: 'prompt', message: 'Prompt must be less than 2000 characters', value: req.prompt });
  }
  
  return errors;
}

/**
 * Runtime validation for PromptRewriteResponse
 */
export function validatePromptRewriteResponse(response: unknown): ValidationError[] {
  const errors: ValidationError[] = [];
  
  if (!response || typeof response !== 'object') {
    errors.push({ field: 'response', message: 'Response must be an object' });
    return errors;
  }
  
  const res = response as Record<string, unknown>;
  
  // Validate success field
  if (typeof res.success !== 'boolean') {
    errors.push({ field: 'success', message: 'Success field must be a boolean', value: res.success });
  }
  
  // If it's an error response, validate error fields
  if (res.success === false) {
    if (!res.error || typeof res.error !== 'string') {
      errors.push({ field: 'error', message: 'Error message must be a string', value: res.error });
    }
    return errors;
  }
  
  // If it's a success response, validate success fields
  if (res.success === true) {
    // Validate original_prompt
    if (!res.original_prompt || typeof res.original_prompt !== 'string') {
      errors.push({ field: 'original_prompt', message: 'Original prompt must be a string', value: res.original_prompt });
    }
    
    // Validate enhanced_prompt
    if (!res.enhanced_prompt || typeof res.enhanced_prompt !== 'string') {
      errors.push({ field: 'enhanced_prompt', message: 'Enhanced prompt must be a string', value: res.enhanced_prompt });
    }
    
    // Validate message
    if (!res.message || typeof res.message !== 'string') {
      errors.push({ field: 'message', message: 'Message must be a string', value: res.message });
    }
    
    // Validate optional warning field
    if (res.warning !== undefined && typeof res.warning !== 'string') {
      errors.push({ field: 'warning', message: 'Warning must be a string', value: res.warning });
    }
  }
  
  return errors;
}

/**
 * Type-safe request builder with validation
 */
export function createImageGenerationRequest(
  prompt: string,
  ratio: string,
  resolution: string,
  style: string,
  contentType?: string,
  colorTone?: string,
  lighting?: string,
  composition?: string,
  numImages?: number
): ImageGenerationRequest {
  const request: any = { prompt, ratio, resolution, style };
  
  // Only include optional filters if they are provided and not "none"
  if (contentType && contentType !== "none") {
    request.contentType = contentType;
  }
  if (colorTone && colorTone !== "none") {
    request.colorTone = colorTone;
  }
  if (lighting && lighting !== "none") {
    request.lighting = lighting;
  }
  if (composition && composition !== "none") {
    request.composition = composition;
  }
  if (numImages !== undefined) {
    request.numImages = numImages;
  }
  
  const errors = validateImageGenerationRequest(request);
  
  if (errors.length > 0) {
    throw new Error(`Invalid request: ${errors.map(e => `${e.field}: ${e.message}`).join(', ')}`);
  }
  
  return request as ImageGenerationRequest;
}

/**
 * Type-safe prompt rewrite request builder with validation
 */
export function createPromptRewriteRequest(prompt: string): PromptRewriteRequest {
  const request = { prompt };
  const errors = validatePromptRewriteRequest(request);
  
  if (errors.length > 0) {
    throw new Error(`Invalid rewrite request: ${errors.map(e => `${e.field}: ${e.message}`).join(', ')}`);
  }
  
  return request as PromptRewriteRequest;
}/**

 * Valid edit mode values for image editing
 */
export const EDIT_MODES = [
  "EDIT_MODE_INPAINT_INSERTION",
  "EDIT_MODE_INPAINT_REMOVAL", 
  "EDIT_MODE_BGSWAP",
  "EDIT_MODE_OUTPAINT"
] as const;
export type EditMode = typeof EDIT_MODES[number];

/**
 * Valid mask mode values for image editing
 */
export const MASK_MODES = ["foreground", "background", "semantic", "prompt"] as const;
export type MaskMode = typeof MASK_MODES[number];

/**
 * Request payload for image editing API
 */
export interface ImageEditRequest {
  prompt: string;           // Edit prompt describing the changes
  editMode: EditMode;       // Type of edit operation
  maskMode: MaskMode;       // Mask generation mode
  numImages?: number;       // Number of edited images to generate (1-4)
}

/**
 * Response from image editing API
 */
export interface ImageEditResponse {
  images: string[];         // Array of signed URLs for edited images
  success: boolean;         // Indicates if the request was successful
  message?: string;         // Optional success or informational message
  requestId?: string;       // Optional request tracking identifier
  model_used?: string;      // Optional model name used for editing
  enhanced_prompt?: string; // Optional enhanced prompt used for editing
  edit_mode?: string;       // Edit mode that was used
  mask_mode?: string;       // Mask mode that was used
  expires_in_hours?: number; // Optional expiration time for signed URLs
  brand_guidelines_applied?: boolean; // Optional flag indicating brand guidelines were applied
}

/**
 * Runtime validation for ImageEditRequest
 */
export function validateImageEditRequest(request: unknown): ValidationError[] {
  const errors: ValidationError[] = [];
  
  if (!request || typeof request !== 'object') {
    errors.push({ field: 'request', message: 'Request must be an object' });
    return errors;
  }
  
  const req = request as Record<string, unknown>;
  
  // Validate prompt
  if (!req.prompt || typeof req.prompt !== 'string') {
    errors.push({ field: 'prompt', message: 'Prompt must be a string', value: req.prompt });
  } else if (req.prompt.trim().length === 0) {
    errors.push({ field: 'prompt', message: 'Prompt cannot be empty', value: req.prompt });
  } else if (req.prompt.length > 2000) {
    errors.push({ field: 'prompt', message: 'Prompt must be less than 2000 characters', value: req.prompt });
  }
  
  // Validate editMode
  if (!req.editMode || typeof req.editMode !== 'string') {
    errors.push({ field: 'editMode', message: 'Edit mode must be a string', value: req.editMode });
  } else if (!EDIT_MODES.includes(req.editMode as EditMode)) {
    errors.push({ 
      field: 'editMode', 
      message: `Edit mode must be one of: ${EDIT_MODES.join(', ')}`, 
      value: req.editMode 
    });
  }
  
  // Validate maskMode
  if (!req.maskMode || typeof req.maskMode !== 'string') {
    errors.push({ field: 'maskMode', message: 'Mask mode must be a string', value: req.maskMode });
  } else if (!MASK_MODES.includes(req.maskMode as MaskMode)) {
    errors.push({ 
      field: 'maskMode', 
      message: `Mask mode must be one of: ${MASK_MODES.join(', ')}`, 
      value: req.maskMode 
    });
  }
  
  // Validate optional numImages
  if (req.numImages !== undefined) {
    if (typeof req.numImages !== 'number') {
      errors.push({ field: 'numImages', message: 'Number of images must be a number', value: req.numImages });
    } else if (req.numImages < 1 || req.numImages > 4) {
      errors.push({ 
        field: 'numImages', 
        message: 'Number of images must be between 1 and 4', 
        value: req.numImages 
      });
    }
  }
  
  return errors;
}

/**
 * Type-safe edit request builder with validation
 */
export function createImageEditRequest(
  prompt: string,
  editMode: string,
  maskMode: string,
  numImages?: number
): ImageEditRequest {
  const request: any = { prompt, editMode, maskMode };
  
  if (numImages !== undefined) {
    request.numImages = numImages;
  }
  
  const errors = validateImageEditRequest(request);
  
  if (errors.length > 0) {
    throw new Error(`Invalid edit request: ${errors.map(e => `${e.field}: ${e.message}`).join(', ')}`);
  }
  
  return request as ImageEditRequest;
}

// --- NEW TYPES FOR VIDEO GENERATION WORKFLOW ---
export interface PromptGenerationRequest {
  mode: 'text_to_video' | 'image_to_video';
  duration: number;
  subject?: string;
  action?: string;
  scene?: string;
  camera_angles?: string;
  camera_movements?: string;
  visual_style?: string;
  lens_effects?: string;
  temporal_elements?: string;
  sound_effects?: string;
  dialogue?: string;
  number_of_scenes?:number;
  image?: {
    gcsUri: string;
  };
}

export interface Scene {
  id: number;
  duration: number;
  prompt: string;
}

export interface StoryboardResponse {
  data: {
    scenes?: Scene[];
    prompt?: Scene;
  };
}

export interface FinalVideoResponse {
  data: {
    final_video: {
      public_url: string;
      gs_uri: string;
    };
    tracked_video?: {
      public_url: string;
      gs_uri: string;
    };
    clips: {
      id: number;
      public_url: string;
      gs_uri: string;
    }[];
  };
}