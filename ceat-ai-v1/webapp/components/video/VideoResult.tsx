'use client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RotateCcw, Download } from 'lucide-react';
import { FinalVideoResponse } from '@/lib/types';

interface VideoResultProps {
    result: FinalVideoResponse['data'];
    onReset: () => void;
}

export function VideoResult({ result, onReset }: VideoResultProps) {
    return (
        <Card>
            <CardHeader><CardTitle>3. Your Video is Ready!</CardTitle></CardHeader>
            <CardContent className="space-y-6">
                {result.final_video && (
                    <div className="text-center space-y-4">
                        <h4 className="font-semibold text-lg">Final Stitched Video</h4>
                        <video controls autoPlay src={result.final_video.public_url} className="w-full rounded-lg border" />
                    </div>
                )}

                {result.clips && result.clips.length > 0 && (
                    <div className="space-y-4">
                        <h4 className="font-semibold text-lg">Individual Clips</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {result.clips.map(clip => (
                                <div key={clip.id}>
                                    <p className="text-sm font-medium mb-1">Clip {clip.id}</p>
                                    <video controls src={clip.public_url} className="w-full rounded-lg border" />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                
                <div className="flex gap-4 justify-center pt-4">
                    <Button onClick={onReset} variant="outline"><RotateCcw className="w-4 h-4 mr-2" /> Start Over</Button>
                </div>
            </CardContent>
        </Card>
    );
}