'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from '@/components/ui/textarea';
import { Scene } from '@/lib/types';
import { Video, RefreshCw, Sparkles } from 'lucide-react';
import { enhancePrompt } from '@/lib/videoApiService';

interface StoryboardViewProps {
    scenes: Scene[];
    onUpdateScene: (id: number, newPrompt: string) => void;
    onGenerateVideo: () => void;
    isLoading: boolean;
}

export function StoryboardView({ scenes, onUpdateScene, onGenerateVideo, isLoading }: StoryboardViewProps) {
    const [isEnhancing, setIsEnhancing] = useState<number | null>(null);

    const handleEnhanceClick = async (sceneId: number, currentPrompt: string) => {
        setIsEnhancing(sceneId);
        try {
            const response = await enhancePrompt(currentPrompt);
            onUpdateScene(sceneId, response.data.enhanced_prompt);
        } catch (error) {
            console.error("Failed to enhance prompt:", error);
        } finally {
            setIsEnhancing(null);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    {scenes.length > 1 ? '2. Edit Your Storyboard' : '2. Refine Your Prompt'}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {scenes.map(scene => (
                    <div key={scene.id} className="bg-background/50 p-3 rounded-lg border">
                        <div className="flex justify-between items-center mb-2">
                            
                            {scenes.length > 1 && (
                                <h3 className="font-bold text-md">Scene {scene.id} ({scene.duration}s)</h3>
                            )}

                            <Button
                                size="sm"
                                variant="outline"
                                className={scenes.length === 1 ? 'ml-auto' : ''}
                                onClick={() => handleEnhanceClick(scene.id, scene.prompt)}
                                disabled={isEnhancing === scene.id || isLoading}
                            >
                                {isEnhancing === scene.id ? (
                                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <Sparkles className="w-4 h-4 mr-2" />
                                )}
                                Enhance
                            </Button>
                        </div>
                        <Textarea
                            value={scene.prompt}
                            onChange={(e) => onUpdateScene(scene.id, e.target.value)}
                            rows={scenes.length > 1 ? 5 : 8}
                            className="w-full"
                        />
                    </div>
                ))}
                <Button 
                    onClick={onGenerateVideo} 
                    disabled={isLoading || isEnhancing !== null} 
                    size="lg" 
                    className="w-full"
                >
                    {isLoading ? 
                        <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Generating Final Video...</> : 
                        <><Video className="w-4 h-4 mr-2" /> Generate Final Video</>
                    }
                </Button>
            </CardContent>
        </Card>
    );
}