"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { X, Loader2, RefreshCw } from "lucide-react"
import { HistoryItem } from "@/lib/api"

/**
 * Props interface for MediaViewerModal component
 */
export interface MediaViewerModalProps {
  /** The history item to display in the modal */
  item: HistoryItem | null
  /** Whether the modal is open */
  isOpen: boolean
  /** Callback function to close the modal */
  onClose: () => void
}

/**
 * Internal state interface for the modal component
 */
interface MediaViewerState {
  /** Whether media content is currently loading */
  isLoading: boolean
  /** Whether there was an error loading the media */
  hasError: boolean
  /** Index of current media item (for future multi-media support) */
  currentMediaIndex: number
  /** Current media URL being attempted */
  currentMediaUrl: string
  /** Array of failed URLs to avoid retry loops */
  failedUrls: string[]
}

/**
 * Viewport size interface for responsive behavior
 */
interface ViewportSize {
  width: number
  height: number
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
}

/**
 * Get the primary media URL from a history item with fallback hierarchy
 * Priority: mediaUrls[0] > mediaUrls[1] > ... > thumbnail > fallback placeholder
 */
const getMediaUrl = (item: HistoryItem | null): string => {
  if (!item) return "/placeholder.svg"
  
  // Try all available media URLs in order
  if (item.mediaUrls && item.mediaUrls.length > 0) {
    for (const url of item.mediaUrls) {
      if (url && url.trim() !== "") {
        return url
      }
    }
  }
  
  // Fallback to thumbnail if available
  if (item.thumbnail && item.thumbnail.trim() !== "") {
    return item.thumbnail
  }
  
  // Final fallback to placeholder
  return "/placeholder.svg"
}

/**
 * Determine if the media URL is a video based on file extension or MIME type
 */
const isVideoUrl = (url: string, mimeType?: string): boolean => {
  if (mimeType) {
    return mimeType.startsWith('video/')
  }
  
  const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv']
  const urlLower = url.toLowerCase()
  return videoExtensions.some(ext => urlLower.includes(ext))
}

/**
 * Get appropriate MIME type for video element
 */
const getVideoMimeType = (url: string, itemMimeType?: string): string => {
  if (itemMimeType && itemMimeType.startsWith('video/')) {
    return itemMimeType
  }
  
  const urlLower = url.toLowerCase()
  if (urlLower.includes('.webm')) return 'video/webm'
  if (urlLower.includes('.ogg')) return 'video/ogg'
  if (urlLower.includes('.mov')) return 'video/quicktime'
  
  // Default to mp4
  return 'video/mp4'
}

/**
 * Custom hook to track viewport size and device type
 */
const useViewportSize = (): ViewportSize => {
  const [viewportSize, setViewportSize] = useState<ViewportSize>({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
    isMobile: typeof window !== 'undefined' ? window.innerWidth < 640 : false,
    isTablet: typeof window !== 'undefined' ? window.innerWidth >= 640 && window.innerWidth < 1024 : false,
    isDesktop: typeof window !== 'undefined' ? window.innerWidth >= 1024 : true,
  })

  const updateViewportSize = useCallback(() => {
    const width = window.innerWidth
    const height = window.innerHeight
    
    setViewportSize({
      width,
      height,
      isMobile: width < 640,
      isTablet: width >= 640 && width < 1024,
      isDesktop: width >= 1024,
    })
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Update on mount
    updateViewportSize()

    // Add resize listener with debouncing
    let timeoutId: NodeJS.Timeout
    const debouncedResize = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(updateViewportSize, 100)
    }

    window.addEventListener('resize', debouncedResize)
    window.addEventListener('orientationchange', debouncedResize)

    return () => {
      window.removeEventListener('resize', debouncedResize)
      window.removeEventListener('orientationchange', debouncedResize)
      clearTimeout(timeoutId)
    }
  }, [updateViewportSize])

  return viewportSize
}

/**
 * MediaViewerModal Component
 * 
 * A modal dialog for viewing full-size images and videos from history items.
 * Displays the media content along with the original generation prompt.
 * 
 * Features:
 * - Full-size media display with proper aspect ratios
 * - Video controls for video content
 * - Scrollable prompt display
 * - Loading states and error handling
 * - Keyboard navigation (Escape to close)
 * - Click outside to close
 * - Background scroll prevention
 * - Focus management and accessibility
 */
export function MediaViewerModal({ item, isOpen, onClose }: MediaViewerModalProps) {
  // Ref to store the previously focused element
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null)
  // Track viewport size for responsive behavior
  const viewport = useViewportSize()
  
  const [state, setState] = useState<MediaViewerState>({
    isLoading: true,
    hasError: false,
    currentMediaIndex: 0,
    currentMediaUrl: "",
    failedUrls: []
  })

  // Get the media URL for the current item, avoiding failed URLs
  const getNextAvailableUrl = (): string => {
    if (!item) return "/placeholder.svg"
    
    // Try all available media URLs that haven't failed
    if (item.mediaUrls && item.mediaUrls.length > 0) {
      for (const url of item.mediaUrls) {
        if (url && url.trim() !== "" && !state.failedUrls.includes(url)) {
          return url
        }
      }
    }
    
    // Try thumbnail if not failed
    if (item.thumbnail && item.thumbnail.trim() !== "" && !state.failedUrls.includes(item.thumbnail)) {
      return item.thumbnail
    }
    
    return "/placeholder.svg"
  }
  
  const mediaUrl = state.currentMediaUrl || getNextAvailableUrl()
  
  // Determine if this is a video based on item type, MIME type, or URL
  const isVideo = item?.type === "video" || isVideoUrl(mediaUrl, item?.mimeType)
  
  // Get video MIME type if needed
  const videoMimeType = isVideo ? getVideoMimeType(mediaUrl, item?.mimeType) : undefined

  // Handle media load success
  const handleMediaLoad = () => {
    setState((prev: MediaViewerState) => ({
      ...prev,
      isLoading: false,
      hasError: false
    }))
  }

  // Handle media load error with automatic fallback to next URL
  const handleMediaError = () => {
    const currentUrl = state.currentMediaUrl || mediaUrl
    const newFailedUrls = [...state.failedUrls, currentUrl]
    
    // Find next available URL that hasn't failed
    let nextUrl = "/placeholder.svg"
    
    if (item) {
      // Try remaining media URLs
      if (item.mediaUrls && item.mediaUrls.length > 0) {
        for (const url of item.mediaUrls) {
          if (url && url.trim() !== "" && !newFailedUrls.includes(url)) {
            nextUrl = url
            break
          }
        }
      }
      
      // Try thumbnail if no media URLs worked
      if (nextUrl === "/placeholder.svg" && item.thumbnail && item.thumbnail.trim() !== "" && !newFailedUrls.includes(item.thumbnail)) {
        nextUrl = item.thumbnail
      }
    }
    
    // If we have another URL to try
    if (nextUrl !== "/placeholder.svg") {
      setState((prev: MediaViewerState) => ({
        ...prev,
        failedUrls: newFailedUrls,
        currentMediaUrl: nextUrl,
        isLoading: true,
        hasError: false
      }))
    } else {
      // No more URLs to try, show error
      setState((prev: MediaViewerState) => ({
        ...prev,
        isLoading: false,
        hasError: true,
        failedUrls: newFailedUrls
      }))
    }
  }
  
  // Handle retry for failed media loads
  const handleRetry = () => {
    // Reset failed URLs and try again from the beginning
    const firstUrl = getMediaUrl(item)
    setState((prev: MediaViewerState) => ({
      ...prev,
      isLoading: true,
      hasError: false,
      failedUrls: [],
      currentMediaUrl: firstUrl
    }))
  }

  // Reset state when item changes
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose()
    } else if (item) {
      // Reset state when opening with new item
      const initialUrl = getMediaUrl(item)
      setState({
        isLoading: true,
        hasError: false,
        currentMediaIndex: 0,
        currentMediaUrl: initialUrl,
        failedUrls: []
      })
    }
  }
  
  // Update current media URL when item changes
  useEffect(() => {
    if (item && isOpen) {
      const initialUrl = getMediaUrl(item)
      setState((prev: MediaViewerState) => ({
        ...prev,
        currentMediaUrl: initialUrl,
        failedUrls: [],
        isLoading: true,
        hasError: false
      }))
    }
  }, [item?.id, isOpen])

  // Background scroll prevention and focus management
  useEffect(() => {
    if (isOpen) {
      // Store the currently focused element
      previouslyFocusedElementRef.current = document.activeElement as HTMLElement
      
      // Prevent background scrolling - enhanced for mobile
      const originalStyle = window.getComputedStyle(document.body).overflow
      const originalPosition = document.body.style.position
      const originalTop = document.body.style.top
      const scrollY = window.scrollY
      
      // For mobile devices, use position fixed to prevent scroll issues
      if (viewport.isMobile) {
        document.body.style.position = 'fixed'
        document.body.style.top = `-${scrollY}px`
        document.body.style.width = '100%'
      } else {
        document.body.style.overflow = 'hidden'
      }
      
      // Let the Dialog component handle focus management
      
      // Cleanup function
      return () => {
        // Restore background scrolling
        if (viewport.isMobile) {
          document.body.style.position = originalPosition
          document.body.style.top = originalTop
          document.body.style.width = ''
          window.scrollTo(0, scrollY)
        } else {
          document.body.style.overflow = originalStyle
        }
        
        // Restore focus to previously focused element
        if (previouslyFocusedElementRef.current) {
          previouslyFocusedElementRef.current.focus()
        }
      }
    }
  }, [isOpen, viewport.isMobile])

  // Enhanced keyboard event handling
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return
      
      // Handle Escape key
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
      
      // Handle Tab key for focus trapping (basic implementation)
      if (event.key === 'Tab') {
        // Let the Dialog component handle focus trapping
        // The shadcn/ui Dialog already implements proper focus management
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => {
        document.removeEventListener('keydown', handleKeyDown)
      }
    }
  }, [isOpen, onClose])

  // Don't render anything if no item is provided
  if (!item) {
    return null
  }

  // Calculate dynamic classes based on viewport
  const getModalClasses = () => {
  const baseClasses = "p-0 overflow-y-auto"
  if (viewport.isMobile) {
    return `${baseClasses} w-screen h-screen max-w-none max-h-none rounded-none border-0 m-0 translate-x-0 translate-y-0`
  } else if (viewport.isTablet) {
    return `${baseClasses} !max-w-[80vw] w-[80vw] max-h-[95vh]`
  } else {
    return `${baseClasses} !max-w-[80vw] w-[80vw] max-h-[95vh]`
  }
}

  // Calculate media container classes based on viewport and content
  const getMediaContainerClasses = () => {
    const baseClasses = "relative bg-muted rounded-lg overflow-hidden"
    return baseClasses
    // if (viewport.isMobile) {
    //   return `${baseClasses} min-h-[300px] w-full`
    // } else if (viewport.isTablet) {
    //   return `${baseClasses} min-h-[400px] w-full`
    // } else {
    //   return `${baseClasses} min-h-[300px] w-full`
    // }
  }

  // Calculate media element classes for optimal display
  const getMediaClasses = () => {
    const baseClasses = "w-full object-contain"
    return baseClasses
    // if (viewport.isMobile) {
    //   return `${baseClasses} h-[300px] object-scale-down`
    // } else if (viewport.isTablet) {
    //   return `${baseClasses} h-[400px] object-scale-down`
    // } else {
    //   return `${baseClasses} h-[500px] object-scale-down`
    // }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent 
        className={getModalClasses()}
        aria-describedby="media-viewer-description"
      >
        <DialogHeader className={`${viewport.isMobile ? 'p-3' : 'p-4 sm:p-6'} pb-2 flex-shrink-0`}>
          <DialogTitle className={`${viewport.isMobile ? 'text-sm' : 'text-base sm:text-lg'} font-semibold`}>
            {item.type === "video" ? "Video" : "Image"}
          </DialogTitle>
          <p id="media-viewer-description" className="sr-only">
            Modal dialog displaying {isVideo ? 'video' : 'image'} content with generation prompt. 
            Use Escape key or click outside to close.
          </p>
        </DialogHeader>

        <div className={`flex flex-col gap-6 ${viewport.isMobile ? 'px-3 pb-3' : 'px-4 sm:px-6 pb-4 sm:pb-6'}`}>
          {/* Media Display Section */}
          <div className={getMediaContainerClasses()}>
            {/* Loading Overlay */}
            {state.isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted/80 backdrop-blur-sm z-10">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-muted-foreground" />
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Loading {isVideo ? 'video' : 'image'}...
                  </p>
                </div>
              </div>
            )}

            {/* Error State */}
            {state.hasError ? (
              <div className="flex items-center justify-center h-full bg-muted p-4">
                <div className="text-center text-muted-foreground max-w-sm">
                  <div className="mb-4">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-2 rounded-full bg-destructive/10 flex items-center justify-center">
                      <X className="h-6 w-6 sm:h-8 sm:w-8 text-destructive" />
                    </div>
                    <p className="text-xs sm:text-sm font-medium">Failed to load {isVideo ? 'video' : 'image'}</p>
                    <p className="text-xs mt-1 text-muted-foreground/80">
                      The media file could not be displayed. This might be due to a network error or the file being unavailable.
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleRetry}
                    className="mt-2"
                  >
                    <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                    Try Again
                  </Button>
                </div>
              </div>
            ) : isVideo ? (
              /* Video Display */
              <video
                key={`${item.id}-${mediaUrl}`} // Force re-render on URL change
                className={`${getMediaClasses()} bg-black`}
                controls
                preload="metadata"
                onLoadedData={handleMediaLoad}
                onError={handleMediaError}
                onLoadStart={() => setState((prev: MediaViewerState) => ({ ...prev, isLoading: true }))}
                poster={item.thumbnail || undefined}
                playsInline
                controlsList="nodownload"
                aria-label={`Generated video: ${item.title || 'Untitled'}`}
                tabIndex={0}
              >
                <source src={mediaUrl} type={videoMimeType} />
                {/* Add additional sources from mediaUrls if available */}
                {item.mediaUrls && item.mediaUrls.length > 1 && (
                  item.mediaUrls
                    .filter(url => url !== mediaUrl && url && url.trim() !== "")
                    .map((url, index) => (
                      <source key={index} src={url} type={getVideoMimeType(url, item.mimeType)} />
                    ))
                )}
                <div className="flex items-center justify-center h-full bg-muted text-muted-foreground p-4">
                  <div className="text-center">
                    <p className="text-xs sm:text-sm">Your browser does not support video playback</p>
                    <p className="text-xs mt-1">Please try downloading the video or use a different browser</p>
                  </div>
                </div>
              </video>
            ) : (
              /* Image Display */
              <img
                key={`${item.id}-${mediaUrl}`} // Force re-render on URL change
                src={mediaUrl}
                alt={item.title || 'Generated content'}
                className={getMediaClasses()}
                onLoad={handleMediaLoad}
                onError={handleMediaError}
                loading="eager"
                decoding="async"
                draggable={false}
                tabIndex={0}
                role="img"
                aria-describedby="media-viewer-description"
              />
            )}
          </div>

          {/* Prompt Display Section */}
          <div className="space-y-4">
            <h3 
              id="prompt-heading" 
              className={`${viewport.isMobile ? 'text-base' : 'text-lg sm:text-xl'} font-semibold text-foreground`}
            >
              Generation Prompt
            </h3>
            <div className="w-full rounded-md border bg-background p-6">
              <p 
                className={`${viewport.isMobile ? 'text-sm' : 'text-base sm:text-lg'} text-foreground leading-relaxed whitespace-pre-wrap`}
                role="region"
                aria-label="Generation prompt text"
                tabIndex={0}
              >
                {item.prompt || "No prompt available"}
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}