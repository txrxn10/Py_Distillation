"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { 
  getBrandGuidelines, 
  updateBrandGuidelines, 
  ApiServiceError,
  UpdateBrandGuidelinesRequest 
} from "@/lib/api";
import {
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  X,
  FileText,
  Video,
  ArrowLeft
} from "lucide-react";

export default function EditBrandGuidelinesPage() {
  const [imageGuidelines, setImageGuidelines] = useState("");
  const [videoGuidelines, setVideoGuidelines] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalImageGuidelines, setOriginalImageGuidelines] = useState("");
  const [originalVideoGuidelines, setOriginalVideoGuidelines] = useState("");
  const router = useRouter();

  // Load brand guidelines on component mount
  useEffect(() => {
    loadBrandGuidelines();
  }, []);

  // Track changes
  useEffect(() => {
    const hasImageChanges = imageGuidelines !== originalImageGuidelines;
    const hasVideoChanges = videoGuidelines !== originalVideoGuidelines;
    setHasChanges(hasImageChanges || hasVideoChanges);
  }, [imageGuidelines, videoGuidelines, originalImageGuidelines, originalVideoGuidelines]);

  const loadBrandGuidelines = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await getBrandGuidelines();
      
      if (response.success && response.data) {
        const imageContent = response.data.image_guidelines || "";
        const videoContent = response.data.video_guidelines || "";
        
        setImageGuidelines(imageContent);
        setVideoGuidelines(videoContent);
        setOriginalImageGuidelines(imageContent);
        setOriginalVideoGuidelines(videoContent);
      } else {
        setError(response.error || "Failed to load brand guidelines");
      }
    } catch (error) {
      console.error("Load error:", error);
      
      let errorMessage = "Failed to load brand guidelines. Please try again.";
      
      if (error instanceof ApiServiceError) {
        switch (error.code) {
          case 'NETWORK_ERROR':
            errorMessage = "Network error. Please check your connection and try again.";
            break;
          case 'FETCH_ERROR':
            errorMessage = "Failed to fetch brand guidelines from server.";
            break;
          default:
            errorMessage = error.message || errorMessage;
        }
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const request: UpdateBrandGuidelinesRequest = {
        image_guidelines: imageGuidelines,
        video_guidelines: videoGuidelines
      };

      const response = await updateBrandGuidelines(request);
      
      if (response.success) {
        setSuccess(response.message || "Brand guidelines updated successfully!");
        setOriginalImageGuidelines(imageGuidelines);
        setOriginalVideoGuidelines(videoGuidelines);
        setHasChanges(false);
        
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(response.error || "Failed to update brand guidelines");
      }
    } catch (error) {
      console.error("Save error:", error);
      
      let errorMessage = "Failed to save brand guidelines. Please try again.";
      
      if (error instanceof ApiServiceError) {
        switch (error.code) {
          case 'NETWORK_ERROR':
            errorMessage = "Network error. Please check your connection and try again.";
            break;
          case 'UPDATE_ERROR':
            errorMessage = "Failed to update brand guidelines on server.";
            break;
          default:
            errorMessage = error.message || errorMessage;
        }
      }
      
      setError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setImageGuidelines(originalImageGuidelines);
    setVideoGuidelines(originalVideoGuidelines);
    setHasChanges(false);
    setError(null);
    setSuccess(null);
  };

  const handleRefresh = () => {
    loadBrandGuidelines();
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Edit Brand Guidelines
            </h1>
            <p className="text-muted-foreground">
              Loading brand guidelines...
            </p>
          </div>
        </div>
        <div className="flex items-center justify-center h-96">
          <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Edit Brand Guidelines
          </h1>
          <p className="text-muted-foreground">
            Manage brand guidelines for image and video generation
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={isSaving}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => router.back()}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>
      </div>

      {/* Success Alert */}
      {success && (
        <Alert className="border-green-200 bg-green-50 text-green-800">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription className="pr-16">
            {success}
          </AlertDescription>
          <button
            className="absolute right-2 top-2 p-1 rounded-full hover:bg-green-200"
            onClick={() => setSuccess(null)}
            aria-label="Dismiss success message"
          >
            <X className="h-4 w-4" />
          </button>
        </Alert>
      )}

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="relative">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="pr-16">
            {error}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Image Guidelines */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Image Guidelines
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="image-guidelines">
                Brand guidelines for image generation
              </Label>
              <Textarea
                id="image-guidelines"
                placeholder="Enter image brand guidelines..."
                value={imageGuidelines}
                onChange={(e) => setImageGuidelines(e.target.value)}
                className="min-h-[400px] resize-none font-mono text-sm"
                disabled={isSaving}
              />
              <p className="text-xs text-muted-foreground">
                {imageGuidelines.length} characters
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Video Guidelines */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="w-5 h-5 text-primary" />
              Video Guidelines
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="video-guidelines">
                Brand guidelines for video generation
              </Label>
              <Textarea
                id="video-guidelines"
                placeholder="Enter video brand guidelines..."
                value={videoGuidelines}
                onChange={(e) => setVideoGuidelines(e.target.value)}
                className="min-h-[400px] resize-none font-mono text-sm"
                disabled={isSaving}
              />
              <p className="text-xs text-muted-foreground">
                {videoGuidelines.length} characters
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          {hasChanges && (
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={isSaving}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Reset Changes
            </Button>
          )}
        </div>
        
        <div className="flex gap-2">
          {hasChanges && (
            <span className="text-sm text-muted-foreground flex items-center">
              <AlertCircle className="w-4 h-4 mr-1" />
              You have unsaved changes
            </span>
          )}
          
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            size="lg"
            className="min-w-[120px]"
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Guidelines Info */}
      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-lg">Guidelines Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            • <strong>Image Guidelines:</strong> Used to enhance prompts for image generation with brand-specific context
          </p>
          <p>
            • <strong>Video Guidelines:</strong> Used to enhance prompts for video generation with brand-specific context
          </p>
          <p>
            • Changes are saved to <code>brand-guidelines-image.txt</code> and <code>brand-guidelines-video.txt</code>
          </p>
          <p>
            • Guidelines are automatically applied to generation requests to maintain brand consistency
          </p>
        </CardContent>
      </Card>
    </div>
  );
}