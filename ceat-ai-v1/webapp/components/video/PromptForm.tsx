'use client';
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { textVideoSelectData } from '@/lib/formOptions';
import { PromptGenerationRequest } from '@/lib/types';
import { RefreshCw } from 'lucide-react';

interface PromptFormProps {
    onGenerate: (formData: Omit<PromptGenerationRequest, 'mode' | 'image'>) => void;
    isLoading: boolean;
    mode: 'text' | 'image';
}

export function PromptForm({ onGenerate, isLoading, mode }: PromptFormProps) {
    const [duration, setDuration] = useState(15);
    const [fields, setFields] = useState({
        subject: "A modern CEAT tyre",
        action: "gripping a wet asphalt road",
        scene: "on a winding mountain pass at dusk",
        camera_angle: "dynamic low-angle tracking shot",
        camera_movement: "smooth arc",
        lens_effect: "Anamorphic lens flare",
        visual_style: "Hyper-realistic, cinematic",
        temporal_element: "Slow-motion",
        sound_effects: "Tires on wet asphalt",
        dialogue: "",
        number_of_scenes:1
    });

    const [customFields, setCustomFields] = useState({
        camera_angle: "",
        camera_movement: "",
        lens_effect: "",
        visual_style: "",
        temporal_element: "",
        sound_effects: "",
    });

    const handleFieldChange = (fieldName: string, value: string) => {
        setFields(prev => ({ ...prev, [fieldName]: value }));
    };
    const handleCustomFieldChange = (fieldName: keyof typeof customFields, value: string) => {
        setCustomFields(prev => ({ ...prev, [fieldName]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // If a dropdown is set to 'Custom...', use the value from the custom text input instead.
        const finalFields = { ...fields };
        for (const key in customFields) {
            if (fields[key as keyof typeof fields] === 'Custom...') {
                finalFields[key as keyof typeof fields] = customFields[key as keyof typeof customFields];
            }
        }
        const { camera_angle, camera_movement, lens_effect, visual_style, temporal_element, sound_effects, ...rest } = finalFields;
        onGenerate({
            //duration,
            ...rest,
            camera_angles: camera_angle,
            camera_movements: camera_movement,
            lens_effects: lens_effect,
            visual_style: visual_style,
            temporal_elements: temporal_element,
            sound_effects: sound_effects,
        });
    };

    return (
        <Card>
            <CardHeader><CardTitle>{mode === 'text' ? '1. Plan Your Video' : 'Enhance Your Animation'}</CardTitle></CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
                        {mode === 'text' && (
                            <div className="space-y-2">
                                <Label>Subject</Label>
                                <Input name="subject" value={fields.subject} onChange={(e) => handleFieldChange('subject', e.target.value)} />
                            </div>
                        )}
                        <div className="space-y-2"><Label>Action</Label><Input name="action" value={fields.action} onChange={(e) => handleFieldChange('action', e.target.value)} /></div>
                        <div className="space-y-2"><Label>Scene</Label><Input name="scene" value={fields.scene} onChange={(e) => handleFieldChange('scene', e.target.value)} /></div>
                        
                        {Object.entries(textVideoSelectData).map(([key, data]) => (
                            <div key={key} className="space-y-2">
                                <Label>{data.label}</Label>
                                <Select
                                    value={fields[key as keyof typeof fields]}
                                    onValueChange={(value) => handleFieldChange(key, value)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {data.options.map(opt => (
                                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {fields[key as keyof typeof fields] === 'Custom...' && (
                                    <Input
                                        placeholder={`Enter custom ${data.label.toLowerCase()}`}
                                        value={customFields[key as keyof typeof customFields]}
                                        onChange={(e) => handleCustomFieldChange(key as keyof typeof customFields, e.target.value)}
                                    />
                                )}
                            </div>
                        ))}
                        <div className="space-y-2"><Label>Dialogue</Label><Input name="dialogue" value={fields.dialogue} onChange={(e) => handleFieldChange('dialogue', e.target.value)} /></div>

                         {/* {mode === 'text' && (
                            <div className="space-y-2">
                                <Label>Total Duration (sec)</Label>
                                <Input type="number" value={duration} onChange={(e) => setDuration(parseInt(e.target.value, 10))} min="1" max="35" />
                            </div>
                         )} */}
                    </div>
                    <Button type="submit" disabled={isLoading} className="w-full mt-6">
                        {isLoading ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Working...</> : (mode === 'text' ? 'Create Storyboard' : 'Generate Enhanced Prompts')}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}