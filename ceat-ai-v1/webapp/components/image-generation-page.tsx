"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Shuffle, RotateCcw, Wand2, Download, Eye, RefreshCw, X, AlertCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { generateImages, rewritePrompt, downloadImage, ApiServiceError, safeAbort } from "@/lib/api"
import {
  ImageGenerationRequest,
  ImageGenerationResponse,
  PromptRewriteRequest,
  PromptRewriteResponse,
  AspectRatio,
  Resolution,
  Style,
  ContentType,
  ColorTone,
  Lighting,
  Composition,
  NumImages,
  ASPECT_RATIOS,
  RESOLUTIONS,
  STYLES,
  CONTENT_TYPES,
  COLOR_TONES,
  LIGHTING_OPTIONS,
  COMPOSITION_OPTIONS,
  NUM_IMAGES_OPTIONS,
  createImageGenerationRequest,
  createPromptRewriteRequest,
  ValidationError
} from "@/lib/types"

export function ImageGenerationPage() {
  const [prompt, setPrompt] = useState("")
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1")
  const [resolution, setResolution] = useState<Resolution>("1024x1024")
  const [style, setStyle] = useState<Style>("realistic")
  const [contentType, setContentType] = useState<ContentType>("none")
  const [colorTone, setColorTone] = useState<ColorTone>("none")
  const [lighting, setLighting] = useState<Lighting>("none")
  const [composition, setComposition] = useState<Composition>("none")
  const [numImages, setNumImages] = useState<NumImages>(2)

  // Type-safe setters with validation
  const setValidatedAspectRatio = (value: string) => {
    if (ASPECT_RATIOS.includes(value as AspectRatio)) {
      setAspectRatio(value as AspectRatio)
      // Clear validation errors when user changes selection
      if (error && error.includes('aspect ratio')) {
        setError(null)
      }
    }
  }

  const setValidatedResolution = (value: string) => {
    if (RESOLUTIONS.includes(value as Resolution)) {
      setResolution(value as Resolution)
      // Clear validation errors when user changes selection
      if (error && error.includes('resolution')) {
        setError(null)
      }
    }
  }

  const setValidatedStyle = (value: string) => {
    if (STYLES.includes(value as Style)) {
      setStyle(value as Style)
      // Clear validation errors when user changes selection
      if (error && error.includes('style')) {
        setError(null)
      }
    }
  }

  const setValidatedContentType = (value: string) => {
    if (CONTENT_TYPES.includes(value as ContentType)) {
      setContentType(value as ContentType)
      // Clear validation errors when user changes selection
      if (error && error.includes('content type')) {
        setError(null)
      }
    }
  }

  const setValidatedColorTone = (value: string) => {
    if (COLOR_TONES.includes(value as ColorTone)) {
      setColorTone(value as ColorTone)
      // Clear validation errors when user changes selection
      if (error && error.includes('color tone')) {
        setError(null)
      }
    }
  }

  const setValidatedLighting = (value: string) => {
    if (LIGHTING_OPTIONS.includes(value as Lighting)) {
      setLighting(value as Lighting)
      // Clear validation errors when user changes selection
      if (error && error.includes('lighting')) {
        setError(null)
      }
    }
  }

  const setValidatedComposition = (value: string) => {
    if (COMPOSITION_OPTIONS.includes(value as Composition)) {
      setComposition(value as Composition)
      // Clear validation errors when user changes selection
      if (error && error.includes('composition')) {
        setError(null)
      }
    }
  }

  const setValidatedNumImages = (value: string) => {
    const numValue = parseInt(value, 10)
    if (NUM_IMAGES_OPTIONS.includes(numValue as NumImages)) {
      setNumImages(numValue as NumImages)
      // Clear validation errors when user changes selection
      if (error && error.includes('number of images')) {
        setError(null)
      }
    }
  }
  const [isGenerating, setIsGenerating] = useState(false)
  const [isRewriting, setIsRewriting] = useState(false)
  const [generatedImages, setGeneratedImages] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  const [rewriteController, setRewriteController] = useState<AbortController | null>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  // Cleanup effect to cancel ongoing requests when component unmounts
  useEffect(() => {
    return () => {
      // Cancel any ongoing request when component unmounts
      safeAbort(abortController, 'Component unmounting')
      safeAbort(rewriteController, 'Component unmounting')
    }
  }, [abortController, rewriteController])

  // Additional cleanup effect to handle component unmount during any ongoing request
  // This captures the current controllers in closure to prevent stale state issues
  useEffect(() => {
    const currentController = abortController
    const currentRewriteController = rewriteController
    return () => {
      // Ensure cleanup happens even if controller state is stale
      safeAbort(currentController, 'Component cleanup to prevent memory leaks')
      safeAbort(currentRewriteController, 'Component cleanup to prevent memory leaks')
    }
  }, [])

  // Effect to handle browser page unload/refresh during ongoing requests
  useEffect(() => {
    const handleBeforeUnload = () => {
      safeAbort(abortController, 'Page unload detected')
      safeAbort(rewriteController, 'Page unload detected')
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [abortController, rewriteController])

  // Effect to handle keyboard navigation in image preview modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!previewImage) return

      switch (event.key) {
        case 'Escape':
          setPreviewImage(null)
          break
        case 'ArrowLeft':
          event.preventDefault()
          const currentIndex = generatedImages.indexOf(previewImage)
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : generatedImages.length - 1
          if (generatedImages.length > 1) {
            setPreviewImage(generatedImages[prevIndex])
          }
          break
        case 'ArrowRight':
          event.preventDefault()
          const currentIdx = generatedImages.indexOf(previewImage)
          const nextIndex = currentIdx < generatedImages.length - 1 ? currentIdx + 1 : 0
          if (generatedImages.length > 1) {
            setPreviewImage(generatedImages[nextIndex])
          }
          break
      }
    }

    if (previewImage) {
      window.addEventListener('keydown', handleKeyDown)
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden'
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'unset'
    }
  }, [previewImage, generatedImages])

  const validateInputs = (): string | null => {
    // Validate prompt
    const trimmedPrompt = prompt.trim()
    if (!trimmedPrompt) {
      return "Please enter a prompt to generate images."
    }

    if (trimmedPrompt.length < 3) {
      return "Prompt must be at least 3 characters long."
    }

    if (trimmedPrompt.length > 2000) {
      return "Prompt must be less than 2000 characters."
    }

    // Validate aspect ratio - ensure it's one of the allowed values
    if (!aspectRatio || !ASPECT_RATIOS.includes(aspectRatio.trim() as AspectRatio)) {
      return "Please select a valid aspect ratio."
    }

    // Validate resolution - ensure it's one of the allowed values
    if (!resolution || !RESOLUTIONS.includes(resolution.trim() as Resolution)) {
      return "Please select a valid resolution."
    }

    // Validate style - ensure it's one of the allowed values
    if (!style || !STYLES.includes(style.trim() as Style)) {
      return "Please select a valid style."
    }

    return null
  }

  const formatRequestPayload = (): ImageGenerationRequest => {
    try {
      // Ensure all values are properly formatted and sanitized
      const formattedPrompt = prompt.trim().replace(/\s+/g, ' ') // Normalize whitespace
      const formattedRatio = aspectRatio.trim() as AspectRatio
      const formattedResolution = resolution.trim() as Resolution
      const formattedStyle = style.trim() as Style
      const formattedContentType = contentType.trim() as ContentType
      const formattedColorTone = colorTone.trim() as ColorTone
      const formattedLighting = lighting.trim() as Lighting
      const formattedComposition = composition.trim() as Composition

      // Use type-safe request builder with validation
      return createImageGenerationRequest(
        formattedPrompt,
        formattedRatio,
        formattedResolution,
        formattedStyle,
        formattedContentType,
        formattedColorTone,
        formattedLighting,
        formattedComposition,
        numImages
      )
    } catch (validationError) {
      // If validation fails, throw a more specific error
      throw new Error(`Request validation failed: ${validationError instanceof Error ? validationError.message : 'Unknown validation error'}`)
    }
  }

  const processImageResponse = (response: ImageGenerationResponse): string[] => {
    try {
      // Type-safe validation of response structure
      if (!response || typeof response !== 'object') {
        throw new Error("Invalid response: response is not an object")
      }

      if (!('images' in response) || !Array.isArray(response.images)) {
        throw new Error("Invalid response: missing or invalid images array")
      }

      if (response.images.length === 0) {
        throw new Error("No images were generated. Please try again with a different prompt.")
      }

      // Handle different image formats (URLs vs base64) with better type safety
      return response.images.map((image: unknown, index: number): string => {
        try {
          // Strict type checking for image data
          if (typeof image !== 'string') {
            console.warn(`Invalid image at index ${index}: expected string, got ${typeof image}`)
            return "/placeholder.svg"
          }

          if (image.length === 0) {
            console.warn(`Invalid image at index ${index}: empty string`)
            return "/placeholder.svg"
          }

          // Check if image is already a valid URL
          if (isValidUrl(image)) {
            return image
          }

          // Check if image is base64 encoded
          if (isBase64Image(image)) {
            // If it already has data URL prefix, return as-is
            if (image.startsWith('data:image/')) {
              return image
            }
            // Add data URL prefix for base64 images
            return `data:image/png;base64,${image}`
          }

          // If neither URL nor base64, treat as potential relative path
          if (image.length > 0) {
            // Sanitize the path to prevent potential security issues
            const sanitizedImage = image.replace(/[^a-zA-Z0-9._/-]/g, '')

            // If it looks like a relative path, make it absolute
            if (sanitizedImage.startsWith('/') || sanitizedImage.startsWith('./')) {
              return sanitizedImage
            }
            // Otherwise assume it's a filename and make it relative to public
            return `/${sanitizedImage}`
          }

          // Fallback to placeholder for invalid/empty images
          console.warn(`Invalid image format at index ${index}:`, image)
          return "/placeholder.svg"
        } catch (imageError) {
          console.error(`Error processing image at index ${index}:`, imageError)
          return "/placeholder.svg"
        }
      })
    } catch (processingError) {
      console.error('Error processing image response:', processingError)
      throw new Error(`Failed to process generated images: ${processingError instanceof Error ? processingError.message : 'Unknown error'}`)
    }
  }

  const isValidUrl = (input: unknown): input is string => {
    if (typeof input !== 'string' || input.length === 0) {
      return false
    }

    try {
      const url = new URL(input)
      return url.protocol === 'http:' || url.protocol === 'https:'
    } catch {
      return false
    }
  }

  const isBase64Image = (input: unknown): input is string => {
    if (typeof input !== 'string' || input.length === 0) {
      return false
    }

    try {
      // Check if string looks like base64 (contains only valid base64 characters)
      const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/

      // Remove data URL prefix if present
      const base64Part = input.replace(/^data:image\/[^;]+;base64,/, '')

      // Check if it's a reasonable length for an image and matches base64 pattern
      // Also ensure it's not too large to prevent memory issues
      return base64Part.length > 100 &&
        base64Part.length < 10000000 && // Max ~7MB base64 string
        base64Regex.test(base64Part)
    } catch {
      return false
    }
  }

  const handleGenerate = async () => {
    // Clear any existing errors
    setError(null)

    // Validate inputs before making API request
    const validationError = validateInputs()
    if (validationError) {
      setError(validationError)
      return
    }

    // Cancel any existing request before starting a new one
    safeAbort(abortController, 'Starting new request')
    setAbortController(null)

    // Create new abort controller for this request
    const controller = new AbortController()
    setAbortController(controller)
    setIsGenerating(true)

    // Set up additional cleanup for this specific request
    const cleanup = () => {
      safeAbort(controller, 'Request completed or failed')
      setAbortController(null)
      setIsGenerating(false)
    }

    try {
      // Format the API request payload with proper validation
      let request: ImageGenerationRequest
      try {
        request = formatRequestPayload()
      } catch (formatError) {
        // Handle request formatting errors specifically
        throw new Error(`Request formatting failed: ${formatError instanceof Error ? formatError.message : 'Unknown formatting error'}`)
      }

      // Make the actual API call with abort signal
      const response = await generateImages(request, controller.signal)

      // Process successful API response and update generatedImages state
      try {
        const processedImages = processImageResponse(response)
        setGeneratedImages(processedImages)
      } catch (processingError) {
        // Handle image processing errors separately
        throw new Error(`Image processing failed: ${processingError instanceof Error ? processingError.message : 'Unknown processing error'}`)
      }

    } catch (error) {
      // Log error for debugging (in development)
      if (process.env.NODE_ENV === 'development') {
        console.error('Image generation error:', error)
      }

      // Handle AbortError specifically to avoid showing error messages for cancelled requests
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Request was cancelled by user or component unmount')
        return // Don't show error message for intentional cancellations
      }

      // Comprehensive error handling for different error types
      const errorMessage = handleApiError(error)
      setError(errorMessage)
    } finally {
      // Always reset loading state and cleanup abort controller
      cleanup()
    }
  }

  /**
   * Handle different types of API errors and return appropriate user-friendly messages
   * Enhanced with better type safety and validation error handling
   */
  const handleApiError = (error: unknown): string => {
    // Handle AbortError (request cancellation)
    if (error instanceof Error && error.name === 'AbortError') {
      return "Request was cancelled. Please try again."
    }

    // Handle ApiServiceError with specific error codes and validation errors
    if (error instanceof ApiServiceError) {
      // Handle validation errors specifically
      if (error.isValidationError()) {
        const validationMessages = error.getValidationMessages()
        if (validationMessages.length > 0) {
          return `Validation error: ${validationMessages.join(', ')}`
        }
      }

      switch (error.code) {
        case 'NETWORK_ERROR':
          return "Unable to connect to the server. Please check your internet connection and try again."

        case 'REQUEST_CANCELLED':
          return "Request timed out. The server may be busy. Please try again."

        case 'HTTP_400':
          return "Invalid request. Please check your inputs and try again."

        case 'HTTP_401':
          return "Authentication required. Please check your credentials."

        case 'HTTP_403':
          return "Access denied. You don't have permission to generate images."

        case 'HTTP_404':
          return "Image generation service not found. Please contact support."

        case 'HTTP_429':
          return "Too many requests. Please wait a moment before trying again."

        case 'HTTP_500':
        case 'HTTP_502':
        case 'HTTP_503':
        case 'HTTP_504':
          return "Server error. Please try again in a few moments."

        case 'INVALID_PROMPT':
          return "Please enter a valid prompt for image generation."

        case 'INVALID_RATIO':
          return "Please select a valid aspect ratio."

        case 'INVALID_RESOLUTION':
          return "Please select a valid resolution."

        case 'INVALID_STYLE':
          return "Please select a valid style."

        case 'VALIDATION_ERROR':
          return "Input validation failed. Please check your inputs and try again."

        case 'PARSE_ERROR':
          return "Received invalid response from server. Please try again."

        case 'INVALID_RESPONSE':
          return "Server returned unexpected data. Please try again."

        case 'API_ERROR':
          return "Image generation service error. Please try again."

        case 'UNKNOWN_ERROR':
        default:
          // Use the error message from ApiServiceError if available
          return error.message || "An unexpected error occurred. Please try again."
      }
    }

    // Handle TypeError (network errors, CORS issues)
    if (error instanceof TypeError) {
      return "Network error. Please check your connection and try again."
    }

    // Handle other Error instances with better type checking
    if (error instanceof Error) {
      // Check for specific error messages that might be user-friendly
      const message = error.message.toLowerCase()

      if (message.includes('network') || message.includes('fetch')) {
        return "Network error. Please check your connection and try again."
      }

      if (message.includes('timeout')) {
        return "Request timed out. Please try again."
      }

      if (message.includes('cors')) {
        return "Unable to connect to the image generation service. Please try again."
      }

      if (message.includes('validation')) {
        return "Input validation failed. Please check your inputs and try again."
      }

      // Return the original error message if it seems user-friendly
      if (error.message.length < 100 && !message.includes('undefined') && !message.includes('null')) {
        return error.message
      }
    }

    // Handle non-Error objects safely
    if (typeof error === 'object' && error !== null) {
      // Try to extract message from error-like objects
      const errorObj = error as Record<string, unknown>
      if (typeof errorObj.message === 'string') {
        return `Error: ${errorObj.message}`
      }
    }

    // Fallback for unknown errors with better logging
    if (typeof window !== 'undefined' && window.console) {
      console.error('Unknown error during image generation:', error)
    }
    return "An unexpected error occurred while generating images. Please try again."
  }

  const handleClear = () => {
    // Cancel any ongoing requests with proper cleanup
    safeAbort(abortController, 'User cleared form')
    safeAbort(rewriteController, 'User cleared form')
    setAbortController(null)
    setRewriteController(null)

    setPrompt("")
    setGeneratedImages([])
    setError(null)
    setIsGenerating(false)
    setIsRewriting(false)

    // Reset all filter states to default values
    setContentType("none")
    setColorTone("none")
    setLighting("none")
    setComposition("none")
    setNumImages(2)
  }

  const handleRandom = () => {
    const randomPrompts = [
      "A single, highly detailed, photorealistic car tire with a sophisticated multi-spoke alloy rim. The tire sidewall clearly displays the brand name 'CEAT SportDrive' in white lettering. The tire has a high-performance, asymmetrical tread pattern with distinct grooves. The rim is a sleek, dark metallic grey or silver finish, reflecting soft studio lights. The entire object is professionally lit with soft, even studio lighting, casting subtle shadows that define its form. The background is pure, seamless white, isolating the product. Rendered in ultra-high resolution with sharp focus on all textures and details",
      "A visually striking product advertisement for an electric vehicle tire. Dominating the midground is a single, photorealistic EV car tire with a sleek alloy rim. The tire's sidewall clearly displays 'CEAT' in white lettering. The tire is positioned on clean, marked pavement, resembling an EV charging station parking spot. In the background, there are modern, futuristic EV charging pedestals under a bright blue sky with soft white clouds. A subtle, glowing blue energy line emanates dynamically from the tire, extending towards the foreground",
      "A dynamic, high-performance product advertisement for a car tire. A single, photorealistic high-performance car tire with a sleek, multi-spoke alloy rim is prominently displayed in the midground. The tire's sidewall shows 'CEAT' in crisp white lettering. The background is a blurred, futuristic cityscape at night, with distant building lights. The primary feature of the background is a series of intense, long exposure light trails (red and white) streaking dynamically from the bottom of the frame and converging towards the tire, creating a powerful sense of speed and motion. The lighting is dramatic, high-contrast, typical of a professional nighttime shoot, making the tire stand out against the energetic light trails",
      "A powerful product advertisement for an all-terrain vehicle tire. A single, highly detailed, photorealistic all-terrain car tire with a rugged, multi-spoke alloy rim is prominently positioned. The tire's sidewall clearly shows 'CEAT'  in bold white lettering. The tire itself has an aggressive, deep, and open block tread pattern suitable for off-road conditions. The tire is expertly placed on a large, textured, jagged rock or elevated piece of dry, earthy terrain in the foreground, signifying its durability. The background features blurred, arid, mountainous, or rocky natural terrain under a bright, natural daylight sky, suggesting an adventurous outdoor setting",
    ]
    setPrompt(randomPrompts[Math.floor(Math.random() * randomPrompts.length)])
  }

  const handleRewrite = async () => {
    if (!prompt.trim()) return

    // Clear any existing errors
    setError(null)

    // Cancel any existing rewrite request before starting a new one
    safeAbort(rewriteController, 'Starting new rewrite request')
    setRewriteController(null)

    // Create new abort controller for this request
    const controller = new AbortController()
    setRewriteController(controller)
    setIsRewriting(true)

    // Set up cleanup for this specific request
    const cleanup = () => {
      safeAbort(controller, 'Rewrite request completed or failed')
      setRewriteController(null)
      setIsRewriting(false)
    }

    try {
      // Create the rewrite request
      const rewriteRequest = createPromptRewriteRequest(prompt.trim())

      // Make the API call to rewrite the prompt
      const response = await rewritePrompt(rewriteRequest, controller.signal)

      // Update the prompt with the enhanced version
      if (response.enhanced_prompt && response.enhanced_prompt.trim()) {
        setPrompt(response.enhanced_prompt.trim())

        // Show a success message if there was a warning
        if (response.warning) {
          console.warn('Rewrite warning:', response.warning)
        }
      } else {
        // Fallback to original prompt if enhanced prompt is empty
        console.warn('Enhanced prompt was empty, keeping original')
      }

    } catch (error) {
      // Log error for debugging
      if (process.env.NODE_ENV === 'development') {
        console.error('Prompt rewrite error:', error)
      }

      // Handle AbortError specifically to avoid showing error messages for cancelled requests
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Rewrite request was cancelled by user or component unmount')
        return // Don't show error message for intentional cancellations
      }

      // Handle rewrite errors gracefully - don't show error to user for rewrite failures
      // Just log the error and keep the original prompt
      const errorMessage = handleRewriteError(error)
      console.warn('Prompt rewrite failed:', errorMessage)

      // Optionally show a subtle notification that rewrite failed
      // For now, we'll just silently fail to avoid disrupting the user experience

    } finally {
      // Always reset loading state and cleanup abort controller
      cleanup()
    }
  }

  /**
   * Handle rewrite errors gracefully without disrupting user experience
   */
  const handleRewriteError = (error: unknown): string => {
    // Handle ApiServiceError with specific error codes
    if (error instanceof ApiServiceError) {
      switch (error.code) {
        case 'NETWORK_ERROR':
          return "Network error during prompt enhancement"

        case 'REQUEST_CANCELLED':
          return "Prompt enhancement timed out"

        case 'VALIDATION_ERROR':
          return "Invalid prompt for enhancement"

        case 'API_ERROR':
          return "Prompt enhancement service error"

        default:
          return error.message || "Prompt enhancement failed"
      }
    }

    // Handle other error types
    if (error instanceof Error) {
      return error.message
    }

    return "Unknown error during prompt enhancement"
  }

  const dismissError = () => {
    setError(null)
  }

  const handleDownload = async (imageUrl: string, index: number) => {
    // Show confirmation dialog
    const confirmed = window.confirm(
      `Do you want to download image ${index + 1}?`
    )

    if (!confirmed) {
      return
    }

    try {
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const filename = `ceat-generated-image-${index + 1}-${timestamp}.png`

      console.log(`Downloading image ${index + 1}...`)

      // Call the download API
      await downloadImage(imageUrl, filename)

      console.log(`Successfully downloaded image ${index + 1}`)

    } catch (error) {
      console.error(`Failed to download image ${index + 1}:`, error)

      // Show user-friendly error message
      let errorMessage = "Failed to download image. Please try again."

      if (error instanceof ApiServiceError) {
        switch (error.code) {
          case 'NETWORK_ERROR':
            errorMessage = "Network error. Please check your connection and try again."
            break
          case 'DOWNLOAD_ERROR':
            errorMessage = "Download failed. The image may no longer be available."
            break
          case 'INVALID_URL':
            errorMessage = "Invalid image URL. Please try generating new images."
            break
          default:
            errorMessage = error.message || errorMessage
        }
      }

      // Show error to user (you could use a toast notification here instead)
      alert(`Download failed: ${errorMessage}`)
    }
  }

  // Enhanced validation that includes error state
  const isGenerateDisabled = (): boolean => {
    const validationError = validateInputs()
    return validationError !== null || isGenerating
  }

  const router = useRouter();

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Image Generation</h1>
          <p className="text-muted-foreground">Create stunning AI-generated images with advanced customization options</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="ml-4"
          onClick={() => router.push("/edit-image")}
        >
          Edit Generated Images
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Input Panel */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wand2 className="w-5 h-5 text-primary" />
                Prompt
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Describe the image you want to generate..."
                value={prompt}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                  // Limit input length and sanitize
                  const value = e.target.value
                  if (value.length <= 2000) {
                    setPrompt(value)
                    // Clear validation errors when user starts typing
                    if (error && error.includes('prompt')) {
                      setError(null)
                    }
                  }
                }}
                className="max-h-[350px] overflow-y-auto resize-none"
                maxLength={2000}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClear}
                  className="flex items-center gap-1 bg-transparent"
                >
                  <RotateCcw className="w-4 h-4" />
                  Clear
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRandom}
                  className="flex items-center gap-1 bg-transparent"
                >
                  <Shuffle className="w-4 h-4" />
                  Random
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRewrite}
                  className="flex items-center gap-1 bg-transparent"
                  disabled={!prompt.trim() || isRewriting || isGenerating}
                >
                  <RefreshCw className={`w-4 h-4 ${isRewriting ? 'animate-spin' : ''}`} />
                  {isRewriting ? 'Rewriting...' : 'Rewrite'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive" className="relative">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="pr-16">
                <div className="space-y-2">
                  <p>{error}</p>
                  {/* Show retry button for certain error types */}
                  {(error.includes('network') || error.includes('server') || error.includes('timeout') || error.includes('connection')) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        dismissError()
                        handleGenerate()
                      }}
                      className="mt-2 bg-background hover:bg-muted"
                      disabled={isGenerating}
                    >
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Retry
                    </Button>
                  )}
                </div>
              </AlertDescription>
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-2 top-2 h-6 w-6 p-0 hover:bg-destructive/20"
                onClick={dismissError}
                aria-label="Dismiss error"
              >
                <X className="h-4 w-4" />
              </Button>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Aspect Ratio</label>
                <Select value={aspectRatio} onValueChange={setValidatedAspectRatio}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1:1">Square (1:1)</SelectItem>
                    <SelectItem value="16:9">Landscape (16:9)</SelectItem>
                    <SelectItem value="9:16">Portrait (9:16)</SelectItem>
                    <SelectItem value="4:3">Standard (4:3)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Resolution</label>
                <Select value={resolution} onValueChange={setValidatedResolution}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="512x512">512x512</SelectItem>
                    <SelectItem value="1024x1024">1024x1024</SelectItem>
                    <SelectItem value="1536x1536">1536x1536</SelectItem>
                    <SelectItem value="2048x2048">2048x2048</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Style</label>
                <Select value={style} onValueChange={setValidatedStyle}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="realistic">Realistic</SelectItem>
                    <SelectItem value="artistic">Artistic</SelectItem>
                    <SelectItem value="cartoon">Cartoon</SelectItem>
                    <SelectItem value="abstract">Abstract</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Content Type</label>
                <Select value={contentType} onValueChange={setValidatedContentType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="photo">Photo</SelectItem>
                    <SelectItem value="art">Art</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Color & Tone</label>
                <Select value={colorTone} onValueChange={setValidatedColorTone}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="black and white">Black and White</SelectItem>
                    <SelectItem value="cool tone">Cool Tone</SelectItem>
                    <SelectItem value="golden">Golden</SelectItem>
                    <SelectItem value="monochromatic">Monochromatic</SelectItem>
                    <SelectItem value="muted color">Muted Color</SelectItem>
                    <SelectItem value="pastel color">Pastel Color</SelectItem>
                    <SelectItem value="toned image">Toned Image</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Lighting</label>
                <Select value={lighting} onValueChange={setValidatedLighting}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="backlighting">Backlighting</SelectItem>
                    <SelectItem value="dramatic light">Dramatic Light</SelectItem>
                    <SelectItem value="long-time exposure">Long-time Exposure</SelectItem>
                    <SelectItem value="low lighting">Low Lighting</SelectItem>
                    <SelectItem value="multiexposure">Multiexposure</SelectItem>
                    <SelectItem value="studio light">Studio Light</SelectItem>
                    <SelectItem value="surreal lighting">Surreal Lighting</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Composition</label>
                <Select value={composition} onValueChange={setValidatedComposition}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="closeup">Closeup</SelectItem>
                    <SelectItem value="knolling">Knolling</SelectItem>
                    <SelectItem value="landscape photography">Landscape Photography</SelectItem>
                    <SelectItem value="photographed through window">Photographed Through Window</SelectItem>
                    <SelectItem value="shallow depth of field">Shallow Depth of Field</SelectItem>
                    <SelectItem value="shot from above">Shot from Above</SelectItem>
                    <SelectItem value="shot from below">Shot from Below</SelectItem>
                    <SelectItem value="surface details">Surface Details</SelectItem>
                    <SelectItem value="wide angle">Wide Angle</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Number of Images</label>
                <Select value={numImages.toString()} onValueChange={setValidatedNumImages}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 Image</SelectItem>
                    <SelectItem value="2">2 Images</SelectItem>
                    <SelectItem value="3">3 Images</SelectItem>
                    <SelectItem value="4">4 Images</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {isGenerating ? (
            <div className="space-y-2">
              <Button onClick={handleGenerate} disabled={true} className="w-full" size="lg">
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  safeAbort(abortController, 'User clicked Cancel button')
                  setAbortController(null)
                  setIsGenerating(false)
                  setError(null) // Clear any existing errors when user cancels
                }}
                className="w-full"
                size="sm"
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            </div>
          ) : (
            <Button onClick={handleGenerate} disabled={isGenerateDisabled()} className="w-full" size="lg">
              <Wand2 className="w-4 h-4 mr-2" />
              Generate Images
            </Button>
          )}
        </div>

        {/* Output Panel */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Generated Images</CardTitle>
              {generatedImages.length > 0 && <Badge variant="secondary">{generatedImages.length} images</Badge>}
            </CardHeader>
            <CardContent>
              {generatedImages.length === 0 ? (
                <div className="flex items-center justify-center h-96 border-2 border-dashed border-border rounded-lg">
                  <div className="text-center">
                    <Wand2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Generated images will appear here</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {generatedImages.map((image, index) => (
                    <div key={index} className="group relative coveredImage">
                      <img
                        src={image || "/placeholder.svg"}
                        alt={`Generated image ${index + 1}`}
                        className="w-full aspect-square object-cover rounded-lg border border-border"
                        onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                          // Handle image loading errors by falling back to placeholder with type safety
                          const target = e.currentTarget
                          if (target && target.src !== "/placeholder.svg") {
                            console.warn(`Failed to load image ${index + 1}:`, typeof image === 'string' ? image : 'invalid image data')
                            target.src = "/placeholder.svg"
                            target.alt = `Failed to load image ${index + 1}`
                          }
                        }}
                        onLoad={() => {
                          // Log successful image loads for debugging
                          console.log(`Successfully loaded image ${index + 1}`)
                        }}
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setPreviewImage(image)}
                          title={`Preview image ${index + 1}`}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleDownload(image, index)}
                          title={`Download image ${index + 1}`}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Image preview modal */}
              {previewImage && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
                  onClick={() => setPreviewImage(null)}
                >
                  <div
                    className="relative bg-white dark:bg-gray-900 rounded-lg shadow-2xl p-4 max-w-4xl max-h-[90vh] w-full mx-4 overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Modal Header */}
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-foreground">Image Preview</h3>
                      <button
                        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        onClick={() => setPreviewImage(null)}
                        aria-label="Close preview"
                      >
                        <X className="w-5 h-5 text-muted-foreground hover:text-foreground" />
                      </button>
                    </div>

                    {/* Modal Content */}
                    <div className="flex items-center justify-center max-h-[calc(90vh-8rem)] overflow-hidden">
                      <img
                        src={previewImage}
                        alt="Preview"
                        className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                        onError={(e) => {
                          const target = e.currentTarget
                          target.src = "/placeholder.svg"
                          target.alt = "Failed to load preview image"
                        }}
                      />
                    </div>

                    {/* Modal Footer */}
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const imageIndex = generatedImages.indexOf(previewImage)
                            if (imageIndex !== -1) {
                              handleDownload(previewImage, imageIndex)
                            }
                          }}
                          className="flex items-center gap-2"
                        >
                          <Download className="w-4 h-4" />
                          Download
                        </Button>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const currentIndex = generatedImages.indexOf(previewImage)
                            const prevIndex = currentIndex > 0 ? currentIndex - 1 : generatedImages.length - 1
                            setPreviewImage(generatedImages[prevIndex])
                          }}
                          disabled={generatedImages.length <= 1}
                        >
                          Previous
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const currentIndex = generatedImages.indexOf(previewImage)
                            const nextIndex = currentIndex < generatedImages.length - 1 ? currentIndex + 1 : 0
                            setPreviewImage(generatedImages[nextIndex])
                          }}
                          disabled={generatedImages.length <= 1}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
