"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Shuffle,
  RotateCcw,
  Wand2,
  Download,
  Eye,
  RefreshCw,
  X,
  AlertCircle,
  Upload,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { editImage, downloadImage, rewritePrompt, ApiServiceError } from "@/lib/api";
import {
  EditMode,
  MaskMode,
  createImageEditRequest,
  createPromptRewriteRequest
} from "@/lib/types";

export default function EditImagePage() {
  const [prompt, setPrompt] = useState("");
  const [editMode, setEditMode] = useState<EditMode>("EDIT_MODE_INPAINT_INSERTION");
  const [maskMode, setMaskMode] = useState<MaskMode>("foreground");
  const [numImages, setNumImages] = useState(2);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const router = useRouter();

  const handleGenerate = async () => {
    if (!uploadedImage || !prompt.trim()) {
      setError("Please upload an image and enter a prompt");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Convert base64 to File object
      const response = await fetch(uploadedImage);
      const blob = await response.blob();
      const file = new File([blob], "uploaded-image.jpg", { type: blob.type });

      // Create edit request
      const editRequest = createImageEditRequest(
        prompt.trim(),
        editMode,
        maskMode,
        numImages
      );

      // Call the edit API
      const result = await editImage(file, editRequest);

      if (result.success && result.images) {
        setGeneratedImages(result.images);
      } else {
        setError("Failed to edit image. Please try again.");
      }
    } catch (error) {
      console.error("Edit error:", error);

      let errorMessage = "Failed to edit image. Please try again.";

      if (error instanceof ApiServiceError) {
        switch (error.code) {
          case 'NETWORK_ERROR':
            errorMessage = "Network error. Please check your connection and try again.";
            break;
          case 'INVALID_REQUEST':
            errorMessage = "Invalid request. Please check your inputs and try again.";
            break;
          case 'GENERATION_ERROR':
            errorMessage = "Image editing failed. Please try with a different prompt or image.";
            break;
          default:
            errorMessage = error.message || errorMessage;
        }
      }

      setError(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClear = () => {
    setPrompt("");
    setGeneratedImages([]);
    setError(null);
    setIsGenerating(false);
    setIsRewriting(false);
    setUploadedImage(null);
    setEditMode("EDIT_MODE_INPAINT_INSERTION");
    setMaskMode("foreground");
    setNumImages(2);
  };

  const handleRewrite = async () => {
    if (!prompt.trim()) return;

    setIsRewriting(true);
    setError(null);

    try {
      // Create rewrite request
      const rewriteRequest = createPromptRewriteRequest(prompt.trim());

      // Call the rewrite API
      const result = await rewritePrompt(rewriteRequest);

      if (result.success && result.enhanced_prompt) {
        setPrompt(result.enhanced_prompt);
      } else {
        setError("Failed to enhance prompt. Please try again.");
      }
    } catch (error) {
      console.error("Rewrite error:", error);

      let errorMessage = "Failed to enhance prompt. Please try again.";

      if (error instanceof ApiServiceError) {
        switch (error.code) {
          case 'NETWORK_ERROR':
            errorMessage = "Network error. Please check your connection and try again.";
            break;
          case 'INVALID_REQUEST':
            errorMessage = "Invalid prompt. Please check your input and try again.";
            break;
          default:
            errorMessage = error.message || errorMessage;
        }
      }

      setError(errorMessage);
    } finally {
      setIsRewriting(false);
    }
  };

  const handleRandom = () => {
    const randomPrompts = [
      "A futuristic tire with glowing accents",
      "Professional tire photo with dramatic lighting",
      "Modern workshop with tires displayed",
      "High-performance racing tire in motion",
    ];
    setPrompt(randomPrompts[Math.floor(Math.random() * randomPrompts.length)]);
  };

  const handleDownload = async (imageUrl: string, index: number) => {
    // Show confirmation dialog
    const confirmed = window.confirm(
      `Do you want to download edited image ${index + 1}?`
    )

    if (!confirmed) {
      return
    }

    try {
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const filename = `ceat-edited-image-${index + 1}-${timestamp}.png`

      console.log(`Downloading edited image ${index + 1}...`)

      // Call the download API
      await downloadImage(imageUrl, filename)

      console.log(`Successfully downloaded edited image ${index + 1}`)

    } catch (error) {
      console.error(`Failed to download edited image ${index + 1}:`, error)

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

      // Show error to user
      setError(`Download failed: ${errorMessage}`)
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setUploadedImage(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Edit Generated Image
          </h1>
          <p className="text-muted-foreground">
            Upload an image and edit it with advanced AI options
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          Back
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Input Panel */}
        <div className="lg:col-span-1 space-y-6">
          {/* Upload Image Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-primary" />
                Upload Image
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
              />
              {uploadedImage && (
                <div className="mt-4 relative">
                  <img
                    src={uploadedImage}
                    alt="Uploaded"
                    className="w-full rounded-lg"
                  />
                  <button
                    className="absolute top-2 right-2 bg-white rounded-full p-1 shadow"
                    onClick={() => setUploadedImage(null)}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Prompt Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wand2 className="w-5 h-5 text-primary" />
                Prompt
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Describe how you want to edit the image..."
                value={prompt}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value.length <= 2000) {
                    setPrompt(value);
                    if (error && error.includes("prompt")) {
                      setError(null);
                    }
                  }
                }}
                className="min-h-[120px] resize-none"
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
                  <RefreshCw
                    className={`w-4 h-4 ${isRewriting ? "animate-spin" : ""}`}
                  />
                  {isRewriting ? "Rewriting..." : "Rewrite"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Edit Mode</Label>
                <Select value={editMode} onValueChange={(value) => setEditMode(value as EditMode)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EDIT_MODE_INPAINT_INSERTION">Insert - Add a new object</SelectItem>
                    <SelectItem value="EDIT_MODE_INPAINT_REMOVAL">Remove - Erase selected object(s)</SelectItem>
                    <SelectItem value="EDIT_MODE_BGSWAP">Product showcase / Change the background</SelectItem>
                    <SelectItem value="EDIT_MODE_OUTPAINT">Outpainting - Extend the image</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Mask Mode</Label>
                <Select value={maskMode} onValueChange={(value) => setMaskMode(value as MaskMode)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="foreground">Foreground</SelectItem>
                    <SelectItem value="background">Background</SelectItem>
                    <SelectItem value="semantic">Semantic</SelectItem>
                    <SelectItem value="prompt">Descriptive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Number of Images</Label>
                <Select value={numImages.toString()} onValueChange={(value) => setNumImages(parseInt(value, 10))}>
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

          {/* Error Display */}
          {error && (
            <Alert variant="destructive" className="relative">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="pr-16">
                <div className="space-y-2">
                  <p>{error}</p>
                </div>
              </AlertDescription>
              <button
                className="absolute right-2 top-2 p-1 rounded-full hover:bg-destructive/20"
                onClick={() => setError(null)}
                aria-label="Dismiss error"
              >
                <X className="h-4 w-4" />
              </button>
            </Alert>
          )}

          {/* Generate Button */}
          {isGenerating ? (
            <div className="space-y-2">
              <Button disabled className="w-full" size="lg">
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleGenerate}
              disabled={!prompt.trim() || !uploadedImage || isGenerating}
              className="w-full"
              size="lg"
            >
              <Wand2 className="w-4 h-4 mr-2" />
              Edit Image
            </Button>
          )}
        </div>

        {/* Output Panel */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Edited Images</CardTitle>
              {generatedImages.length > 0 && (
                <Badge variant="secondary">
                  {generatedImages.length} images
                </Badge>
              )}
            </CardHeader>
            <CardContent>
              {generatedImages.length === 0 ? (
                <div className="flex items-center justify-center h-96 border-2 border-dashed border-border rounded-lg">
                  <div className="text-center">
                    <Wand2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      Edited images will appear here
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {generatedImages.map((image: string, index: number) => (
                    <div key={index} className="group relative">
                      <img
                        src={image || "/placeholder.svg"}
                        alt={`Edited image ${index + 1}`}
                        className="w-full aspect-square object-cover rounded-lg border border-border cursor-pointer"
                        onClick={() => setPreviewImage(image)}
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setPreviewImage(image)}
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
                  {/* Image preview modal */}
                  {previewImage && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                      <div className="relative bg-white rounded-lg shadow-xl p-4 max-w-lg w-full">
                        <button
                          className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
                          onClick={() => setPreviewImage(null)}
                        >
                          <X className="w-6 h-6" />
                        </button>
                        <img
                          src={previewImage}
                          alt="Preview"
                          className="w-full rounded-lg"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
