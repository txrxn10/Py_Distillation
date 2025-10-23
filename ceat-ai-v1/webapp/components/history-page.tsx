"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  Search,
  Filter,
  Grid3X3,
  List,
  Calendar,
  ImageIcon,
  Video,
  Eye,
  Download,
  RefreshCw,
  Trash2,
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  getHistory,
  deleteHistoryItem,
  downloadHistoryItem,
  getHistoryStats,
  ApiServiceError,
  type HistoryItem
} from "@/lib/api"
import { MediaViewerModal } from "@/components/media-viewer-modal"

export function HistoryPage() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [searchQuery, setSearchQuery] = useState("")
  const [filterType, setFilterType] = useState("all")
  const [sortBy, setSortBy] = useState("newest")

  // State for API data
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [totalItems, setTotalItems] = useState(0)

  // Modal state management
  const [modalState, setModalState] = useState<{
    selectedItem: HistoryItem | null
    isModalOpen: boolean
  }>({
    selectedItem: null,
    isModalOpen: false
  })

  // Download confirmation state
  const [downloadState, setDownloadState] = useState<{
    selectedItem: HistoryItem | null
    isConfirmOpen: boolean
    isDownloading: boolean
  }>({
    selectedItem: null,
    isConfirmOpen: false,
    isDownloading: false
  })

  // Load history data
  const loadHistory = async (page: number = 1, append: boolean = false) => {
    try {
      if (!append) {
        setIsLoading(true)
        setError(null)
      }

      const response = await getHistory({
        page,
        per_page: 20,
        type: filterType === "all" ? undefined : filterType as any,
        sort_by: sortBy as any,
        search: searchQuery || undefined
      })

      if (response.success && response.data) {
        if (append) {
          setHistoryItems(prev => [...prev, ...response.data!.items])
        } else {
          setHistoryItems(response.data.items)
        }
        setHasMore(response.data.has_more)
        setTotalItems(response.data.total_items)
        setCurrentPage(page)
      } else {
        setError(response.error || "Failed to load history")
      }
    } catch (err) {
      console.error("Error loading history:", err)
      let errorMessage = "Failed to load history"

      if (err instanceof ApiServiceError) {
        errorMessage = err.message
      }

      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  // Load data on component mount and when filters change
  useEffect(() => {
    loadHistory(1, false)
  }, [filterType, sortBy, searchQuery])

  // Handle delete item
  const handleDeleteItem = async (itemId: string) => {
    try {
      const response = await deleteHistoryItem(itemId)

      if (response.success) {
        // Remove item from local state
        setHistoryItems(prev => prev.filter(item => item.id !== itemId))
        setTotalItems(prev => prev - 1)
      } else {
        setError(response.error || "Failed to delete item")
      }
    } catch (err) {
      console.error("Error deleting item:", err)
      setError("Failed to delete item")
    }
  }

  // Handle view item in modal
  const handleViewItem = (item: HistoryItem) => {
    setModalState({
      selectedItem: item,
      isModalOpen: true
    })
  }

  // Handle modal close
  const handleCloseModal = () => {
    setModalState({
      selectedItem: null,
      isModalOpen: false
    })
  }

  // Handle download item - show confirmation dialog
  const handleDownloadItem = (item: HistoryItem) => {
    setDownloadState({
      selectedItem: item,
      isConfirmOpen: true,
      isDownloading: false
    })
  }

  // Handle confirmed download
  const handleConfirmDownload = async () => {
    const item = downloadState.selectedItem
    if (!item) return

    setDownloadState(prev => ({ ...prev, isDownloading: true }))

    try {
      const { blob, filename } = await downloadHistoryItem(item.id)

      // Create download link and trigger download
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()

      // Cleanup
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      // Close dialog
      setDownloadState({
        selectedItem: null,
        isConfirmOpen: false,
        isDownloading: false
      })

    } catch (err) {
      console.error("Error downloading item:", err)
      let errorMessage = "Failed to download media"

      if (err instanceof ApiServiceError) {
        errorMessage = err.message
      } else if (err instanceof Error) {
        errorMessage = `Download failed: ${err.message}`
      }

      setError(errorMessage)
      setDownloadState(prev => ({ ...prev, isDownloading: false }))
    }
  }

  // Handle cancel download
  const handleCancelDownload = () => {
    setDownloadState({
      selectedItem: null,
      isConfirmOpen: false,
      isDownloading: false
    })
  }

  // Mock history data (keeping as fallback)
  const mockHistoryItems: HistoryItem[] = [
    {
      id: "1",
      type: "image",
      title: "CEAT Racing Tire Concept",
      prompt: "A futuristic CEAT tire with glowing orange accents on a sleek sports car",
      thumbnail: "/placeholder-ry9lk.png",
      createdAt: "2024-01-15T10:30:00Z",
      settings: {
        aspectRatio: "16:9",
        resolution: "1024x1024",
      },
      mediaUrls: [],
      hasError: false
    }
  ]

  // Use real data if available, otherwise fall back to mock data
  const displayItems = historyItems.length > 0 ? historyItems : (isLoading ? [] : mockHistoryItems)

  const sortedItems = [...displayItems].sort((a, b) => {
    if (sortBy === "newest") {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    } else if (sortBy === "oldest") {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    } else if (sortBy === "name") {
      return a.title.localeCompare(b.title)
    }
    return 0
  })

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "image":
        return <ImageIcon className="w-4 h-4" />
      case "video":
        return <Video className="w-4 h-4" />
      default:
        return <ImageIcon className="w-4 h-4" />
    }
  }

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case "image":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
      case "video":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300"
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Generation History</h1>
        <p className="text-muted-foreground">View and manage all your AI-generated content</p>
      </div>

      {/* Filters and Controls */}
      <Card>
        <CardContent className="">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search history..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-40">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="images">Images</SelectItem>
                  <SelectItem value="videos">Videos</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-40">
                  <Calendar className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="name">Name A-Z</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === "grid" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("grid")}
              >
                <Grid3X3 className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("list")}
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            {error}
            <button
              onClick={() => loadHistory(1, false)}
              className="ml-2 underline hover:no-underline"
            >
              Try again
            </button>
          </AlertDescription>
        </Alert>
      )}

      {/* Results */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Loading..." : `${sortedItems.length} ${sortedItems.length === 1 ? "item" : "items"} found`}
            {totalItems > 0 && !isLoading && ` (Total: ${totalItems})`}
          </p>
          {hasMore && !isLoading && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadHistory(currentPage + 1, true)}
            >
              Load More
            </Button>
          )}
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="flex items-center justify-center h-64">
              <div className="text-center">
                <RefreshCw className="w-12 h-12 text-muted-foreground mx-auto mb-4 animate-spin" />
                <p className="text-muted-foreground">Loading your history...</p>
              </div>
            </CardContent>
          </Card>
        ) : sortedItems.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center h-64">
              <div className="text-center">
                <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No items found</p>
                <p className="text-sm text-muted-foreground mt-2">Try adjusting your search or filters</p>
              </div>
            </CardContent>
          </Card>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {sortedItems.map((item) => (
              <Card key={item.id} className="group hover:shadow-lg transition-shadow">
                <CardContent className="p-0">
                  <div className="relative">
                    {/* {item.type === "video" ? (
                      <video
                        src={item.thumbnail || "/placeholder.svg"}
                        className="w-full h-48 object-cover rounded-t-lg"
                        controls
                        preload="metadata"
                        poster={item?.preview_image || "/placeholder.svg"}
                      >
                        <source src={item.thumbnail || "/placeholder.svg"} type="video/mp4" />
                        Your browser does not support the video tag.
                      </video>
                    ) : (
                      <img
                        src={item.thumbnail || "/placeholder.svg"}
                        alt={item.title}
                        className="w-full h-48 object-cover rounded-t-lg"
                      />
                    )} */}
                    {item.type === "video" ? (
                        <div className="relative group">
                          <video
                            className="w-full h-48 object-cover rounded-t-lg"
                            src={item.thumbnail || "/placeholder.svg"}
                            poster={item.preview_image || "/placeholder.svg"}
                            preload="metadata"
                            controls
                          >
                            <source
                              src={item.thumbnail || "/placeholder.svg"}
                              type="video/mp4"
                            />
                            Your browser does not support the video tag.
                          </video>

                          {/* Graceful fallback if preview image is missing */}
                          {!item.preview_image && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-xs font-medium rounded-t-lg">
                              No preview available
                            </div>
                          )}
                        </div>
                      ) : (
                        <img
                          src={item.thumbnail || "/placeholder.svg"}
                          alt={item.title || "Generated media"}
                          className="w-full h-48 object-cover rounded-t-lg"
                          loading="lazy"
                        />
                      )}

                    <div className="absolute top-2 left-2">
                      <Badge className={`${getTypeBadgeColor(item.type)} border-0`}>
                        {getTypeIcon(item.type)}
                        <span className="ml-1 capitalize">{item.type}</span>
                      </Badge>
                    </div>
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="flex gap-1">
                        <Button size="sm" variant="secondary" onClick={() => handleViewItem(item)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => handleDownloadItem(item)}>
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-sm mb-2 line-clamp-1">{item.title}</h3>
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{item.prompt}</p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatDate(item.createdAt)}</span>
                      <span>{item.settings.resolution || item.settings.duration}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {sortedItems.map((item) => (
                  <div key={item.id} className="p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-4">
                      {item.type === "video" ? (
                        <video
                          src={item.thumbnail || "/placeholder.svg"}
                          className="w-16 h-16 object-cover rounded-lg"
                          controls
                          preload="metadata"
                          poster={item.thumbnail || "/placeholder.svg"}
                        >
                          <source src={item.thumbnail || "/placeholder.svg"} type="video/mp4" />
                          Your browser does not support the video tag.
                        </video>
                      ) : (
                        <img
                          src={item.thumbnail || "/placeholder.svg"}
                          alt={item.title}
                          className="w-16 h-16 object-cover rounded-lg"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-sm truncate">{item.title}</h3>
                          <Badge className={`${getTypeBadgeColor(item.type)} border-0 text-xs`}>
                            {getTypeIcon(item.type)}
                            <span className="ml-1 capitalize">{item.type}</span>
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-1 mb-2">{item.prompt}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>{formatDate(item.createdAt)}</span>
                          <span>{item.settings.aspectRatio}</span>
                          <span>{item.settings.resolution || item.settings.duration}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleViewItem(item)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleDownloadItem(item)}>
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Media Viewer Modal */}
      <MediaViewerModal
        item={modalState.selectedItem}
        isOpen={modalState.isModalOpen}
        onClose={handleCloseModal}
      />

      {/* Download Confirmation Dialog */}
      <AlertDialog open={downloadState.isConfirmOpen} onOpenChange={handleCancelDownload}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Download Media</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to download "{downloadState.selectedItem?.title}"?
              {downloadState.selectedItem?.type === "video"
                ? " This video file may be large and could take some time to download."
                : " This image will be saved to your device."
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={downloadState.isDownloading}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDownload}
              disabled={downloadState.isDownloading}
            >
              {downloadState.isDownloading ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Downloading...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
