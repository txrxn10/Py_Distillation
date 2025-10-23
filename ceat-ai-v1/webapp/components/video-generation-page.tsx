'use client';

import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RotateCcw, Video, Upload, RefreshCw, X } from "lucide-react";

// Import your components and services
import { PromptForm } from '@/components/video/PromptForm';
import { StoryboardView } from '@/components/video/StoryboardView';
import { VideoResult } from '@/components/video/VideoResult';
import { generateStoryboardPrompts, generateFinalVideo, uploadFileViaProxy, getDownloadUrl } from '@/lib/videoApiService';
import { Scene, PromptGenerationRequest, FinalVideoResponse } from '@/lib/types';
import { globalSettingsSelectData } from "@/lib/formOptions";

type ViewState = 'FORM' | 'STORYBOARD' | 'RESULT';

export function VideoGenerationPage() {
    // STATE for workflow management
    const [view, setView] = useState<ViewState>('FORM');
    const [scenes, setScenes] = useState<Scene[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
    const [error, setError] = useState<string>('');
    
    // STATE for UI tabs
    const [activeTab, setActiveTab] = useState("text_to_video");
    
    // STATE for image-to-video workflow
    const [uploadedImageFile, setUploadedImageFile] = useState<File | null>(null);
    const [uploadedImagePreview, setUploadedImagePreview] = useState<string | null>(null);
    const [uploadedImageGcsPath, setUploadedImageGcsPath] = useState<string | null>(null);
    const [finalResult, setFinalResult] = useState<FinalVideoResponse['data'] | null>(null);

    
    // STATE for global settings panel
   const [globalSettings, setGlobalSettings] = useState({
        aspectRatio: "16:9",
        resolution: "1080p",
        personGeneration: "allow_adult",
        negativePrompt: "blurry, low quality, text, watermark, signature",
    });

    // --- HANDLER FUNCTIONS ---
    
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Store the File object for later upload
        setUploadedImageFile(file);

        // Create a temporary local URL for an instant preview
        if (uploadedImagePreview) {
            URL.revokeObjectURL(uploadedImagePreview); // Clean up old preview URL to prevent memory leaks
        }
        setUploadedImagePreview(URL.createObjectURL(file));
        
        // Reset the workflow to the form state but keep the image selected
        setView('FORM');
        setError('');
        setScenes([]);
        setUploadedImageGcsPath(null); // Clear any old GCS path from a previous run
    };
    
    const handleGenerateStoryboard = async (formData: Omit<PromptGenerationRequest, 'mode' | 'image'>) => {
        setIsLoading(true);
        setError('');
        let imageGcsUri: string | null = null;
        
        try {
            // This is the "upload-first" workflow for image-to-video
            if (activeTab === 'image_to_video') {
                if (!uploadedImageFile) throw new Error("An image must be uploaded first.");
                
                setLoadingMessage('Uploading Image...');
                const uploadInfo = await uploadFileViaProxy(uploadedImageFile);
                imageGcsUri = uploadInfo.gs_uri;
                setUploadedImageGcsPath(imageGcsUri); // Save the GCS path for the final generation step
            }

            setLoadingMessage('Generating Storyboard...');
            const requestData: PromptGenerationRequest = {
                ...formData,
                mode: activeTab as 'text_to_video' | 'image_to_video',
            };
            if (imageGcsUri) {
                requestData.image = { gcsUri: imageGcsUri };
            }

            const response = await generateStoryboardPrompts(requestData);
            const responseData = response.data;
            
            if (responseData?.scenes) {
                setScenes(responseData.scenes);
            } else if (responseData?.prompt) {
                setScenes([responseData]);
            } else {
                throw new Error('Invalid API response: Could not find scenes.');
            }
            setView('STORYBOARD');

        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred.');
            setView('FORM');  
        } finally {
            setIsLoading(false);
        }
    };

    // const handleGenerateVideo = async () => {
    //     setIsLoading(true);
    //     setLoadingMessage('Generating Final Video...');
    //     setError('');
    //     try {
         
    //       const response = await generateFinalVideo(scenes, globalSettings, uploadedImageGcsPath);
    //         setFinalVideoUrl(response.data.final_video.public_url);
    //         setView('RESULT');
    //     } catch (err) {
    //         setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    //         setView('STORYBOARD');
    //     } finally {
    //         setIsLoading(false);
    //     }
    // };

    const handleGenerateVideo = async () => {
        setIsLoading(true);
        setLoadingMessage('Generating Final Video...');
        setError('');
        try {
            // Step 1: Generate the video and get the private GCS paths
            const response = await generateFinalVideo(scenes, globalSettings, uploadedImageGcsPath);
            const resultData = response.data;

            // Step 2: Get a secure, viewable URL for the main final_video
            if (resultData.final_video?.gs_uri) {
                setLoadingMessage('Preparing final video for viewing...');
                const { signedUrl } = await getDownloadUrl(resultData.final_video.gs_uri);
                resultData.final_video.public_url = signedUrl; // Replace the non-working URL
            }
            
            // (Optional) Get viewable URLs for individual clips if you want to display them
            if (resultData.clips) {
                 setLoadingMessage('Preparing clips for viewing...');
                 for (const clip of resultData.clips) {
                     const { signedUrl } = await getDownloadUrl(clip.gs_uri);
                     clip.public_url = signedUrl;
                 }
            }

            setFinalResult(resultData);
            setView('RESULT');
            
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred.');
            setView('STORYBOARD');
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleReset = () => {
        setView('FORM');
        setScenes([]);
        setFinalVideoUrl(null);
        setError('');
        setUploadedImageFile(null);
        if (uploadedImagePreview) {
            URL.revokeObjectURL(uploadedImagePreview);
        }
        setUploadedImagePreview(null);
        setUploadedImageGcsPath(null);
    };

    const handleUpdateScene = (id: number, newPrompt: string) => {
        setScenes(currentScenes =>
            currentScenes.map(scene => (scene.id === id ? { ...scene, prompt: newPrompt } : scene))
        );
    };

    const handleSettingsChange = (settingName: keyof typeof globalSettings, value: string) => {
        setGlobalSettings(prev => ({ ...prev, [settingName]: value }));
    };

    // --- RENDER LOGIC ---
    const renderWorkflowContent = () => {
        if (error) {
            return (
                 <div className="bg-destructive/10 border border-destructive/50 text-destructive p-4 rounded-lg">
                    <h3 className="font-bold">Error</h3>
                    <p>{error}</p>
                    <Button onClick={handleReset} variant="outline" className="mt-4">Try Again</Button>
                </div>
            );
        }
        if (isLoading && view !== 'FORM') {
            return (
                <div className="text-center py-20 flex flex-col items-center justify-center h-full min-h-[400px]">
                    <RefreshCw className="w-8 h-8 animate-spin mb-4" />
                    <p className="text-lg font-semibold">{loadingMessage}</p>
                    <p className="text-sm text-muted-foreground mt-2">This may take several minutes.</p>
                </div>
            );
        }
        switch (view) {
            case 'STORYBOARD':
                return <StoryboardView scenes={scenes} onUpdateScene={handleUpdateScene} onGenerateVideo={handleGenerateVideo} isLoading={isLoading} />;
            case 'RESULT':
                return <VideoResult result={finalResult!} onReset={handleReset} />;
            case 'FORM':
            default:
                if (activeTab === 'text_to_video') return <PromptForm onGenerate={handleGenerateStoryboard} isLoading={isLoading} mode="text" />;
                if (activeTab === 'image_to_video' && uploadedImageFile) return <PromptForm onGenerate={handleGenerateStoryboard} isLoading={isLoading} mode="image" />;
                return null;
        }
    };


    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold">Video Generation</h1>
                <p className="text-muted-foreground">Create a professional video using a dynamic storyboard workflow.</p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                <div className="lg:col-span-2">
                    <Tabs value={activeTab} onValueChange={(tab) => { handleReset(); setActiveTab(tab); }} className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="text_to_video">Text-to-Video</TabsTrigger>
                            <TabsTrigger value="image_to_video">Image-to-Video</TabsTrigger>
                            {/* <TabsTrigger value="interpolation" disabled>Interpolation</TabsTrigger> */}
                        </TabsList>

                        <TabsContent value="text_to_video" className="mt-6">
                            {renderWorkflowContent()}
                        </TabsContent>

                        <TabsContent value="image_to_video" className="mt-6 space-y-6">
                            <Card>
                                <CardHeader><CardTitle>1. Upload Reference Image</CardTitle></CardHeader>
                                <CardContent>
                                    <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                                        {uploadedImagePreview ? (
                                            <div className="relative w-48 mx-auto">
                                                <img src={uploadedImagePreview} alt="Uploaded preview" className="object-cover rounded-lg" />
                                                <Button variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6 rounded-full" onClick={handleReset}>
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ) : isLoading ? (
                                            <div className="text-center py-4"><RefreshCw className="w-8 h-8 mx-auto animate-spin" /><p className="mt-2 text-sm text-muted-foreground">{loadingMessage}</p></div>
                                        ) : (
                                            <div><Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" /><p className="text-sm text-muted-foreground mb-2">Upload an image to animate</p><Input type="file" accept="image/png, image/jpeg" onChange={handleImageUpload} className="hidden" id="image-upload" /><Label htmlFor="image-upload" className="cursor-pointer"><Button variant="outline" size="sm" asChild><span>Choose File</span></Button></Label></div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                            {renderWorkflowContent()}
                        </TabsContent>
                    </Tabs>
                </div>
                <div className="space-y-4">
                     <Card>
                        <CardHeader><CardTitle>Global Settings</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            {/* --- CHANGE 3: DYNAMIC Global Settings Panel --- */}
                            {Object.entries(globalSettingsSelectData).map(([key, setting]) => (
                                <div className="space-y-2" key={key}>
                                    <Label>{setting.label}</Label>
                                    <Select
                                        value={globalSettings[key as keyof typeof globalSettings]}
                                       onValueChange={(value) => handleSettingsChange(key as keyof typeof globalSettings, value)}
                                    >
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {setting.options.map((option) => (
                                                <SelectItem key={option} value={option}>
                                                    {setting.labels[option as keyof typeof setting.labels]}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            ))}
                            <div className="space-y-2">
                                <Label>Negative Prompt</Label>
                                <Input
                                    value={globalSettings.negativePrompt}
                                    onChange={(e) => handleSettingsChange('negativePrompt', e.target.value)}
                                    placeholder="e.g., blurry, text, watermark"
                                />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}