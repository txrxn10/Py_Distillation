import os
import json
import re
from flask import current_app

def build_prompt_text_for_chaining(fields: dict, number_of_scenes: int, scene_durations: list[int], task_instruction: str, tire_profile_json: dict = None) -> str:
    """
    Builds a prompt for Gemini with visual-first multi-frame continuity approach.
    No detailed tire descriptions needed - visual inputs handle consistency.
    """
    user_input = "\n".join([f"{key.replace('_', ' ').title()}: {value}" for key, value in fields.items() if value and key not in ['mode', 'number_of_scenes', 'image']])
    visual_style = fields.get('visual_style', 'cinematic style')
    temporal_elements = fields.get('temporal_elements', '')
    sound_effects = fields.get('sound_effects', '')
    
    prompt = (
        f"You are an AI prompt writer specialized in creating continuous video prompts for Google Veo 3 using a visual-first multi-frame continuity approach.\n\n"
    )
    
    if tire_profile_json:
        prompt += "TIRE VISUAL REFERENCE (FOR CONTEXT ONLY - DO NOT DESCRIBE IN PROMPTS):\n"
        prompt += f"```json\n{json.dumps(tire_profile_json, indent=2)}\n```\n\n"
        
        prompt += f"VISUAL-FIRST CONTINUITY APPROACH:\n"
        prompt += f"1. The reference image/frame provides all visual tire information - NO NEED for detailed descriptions\n"
        prompt += f"2. Each scene must have multiple clear, stable shots in the final 3 seconds\n"
        prompt += f"3. Ensure at least 2-3 frames show the tire clearly with good composition\n"
        prompt += f"4. The tire should be prominently visible and well-lit in the ending sequence\n"
        prompt += f"5. Include both dynamic shots and stable compositions\n"
        prompt += f"6. Avoid excessive motion blur in the final seconds\n\n"
    
    # Enhanced section for temporal and audio elements
    if temporal_elements:
        prompt += f"TEMPORAL ELEMENTS (APPLY TO ALL SCENES):\n"
        prompt += f"- {temporal_elements}\n\n"
    
    if sound_effects:
        prompt += f"AUDIO ELEMENTS (INCLUDE IN ALL SCENES):\n"
        prompt += f"- {sound_effects}\n\n"
    
    prompt += (
        f"PROMPT SIMPLIFICATION RULES:\n"
        f"1. DO NOT include detailed tire descriptions in any scene prompts\n"
        f"2. The reference image/frame provides all visual tire information needed\n"
        f"3. Focus prompts on action, camera movements, and multi-frame readiness\n"
        f"4. Keep prompts concise and cinematic (under 200 words)\n\n"
        
        f"SCENE STRUCTURE FOR VISUAL CONTINUITY:\n"
        f"1. First 5 seconds: Dynamic action and camera movements\n"
        f"2. Final 3 seconds: Clear, stable shots suitable for frame extraction\n"
        f"3. Ensure multiple high-quality frames are available for continuity\n"
        f"4. All visual consistency comes from frame extraction, not text descriptions\n\n"
        
        f"Task: {task_instruction}\n\n"
        
        f"USER INPUT:\n1. Main Scene Description: {user_input}\n2. Number of Scenes: {number_of_scenes}\n3. Visual Style: {visual_style}\n"
        f"4. Supported Durations: Use 8 seconds per scene for Veo 3 compatibility.\n\n"
        
        f"YOUR TASKS:\n"
        f"1. Create Scene 1 with dynamic action first, then clear stable shots in final 3 seconds\n"
        f"2. Create Scene 2 following the same structure\n"
        f"3. Every scene must specify it includes multiple clear frames for continuity\n"
        f"4. Each follow-up scene must start with: 'Cinematic continuation with the EXACT SAME tire. Now...'\n"
        f"5. DO NOT include any detailed tire descriptions - focus on action and cinematography\n"
        f"6. Keep prompts concise and focused on cinematic action (under 150 words)\n"
        f"7. Add camera movement and environmental changes\n"
        f"8. Apply temporal elements consistently in EVERY scene\n"
        f"9. Include audio/sound descriptions in EVERY scene\n"
        f"10. Output a STRICT JSON object with a 'scenes' array. Each object must have 'id', 'duration', and 'prompt' ONLY - no other keys\n"
        f"11. Each scene description must emphasize frame extraction readiness without tire details\n"
    )
    return prompt

def safe_json_parse(raw_text: str) -> dict:
    """Cleans and parses the AI model's text output into a dictionary."""
    json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', raw_text, re.DOTALL)
    if json_match:
        cleaned = json_match.group(1).strip()
    else:
        cleaned = re.sub(r"^```(?:json)?|```$", "", raw_text.strip(), flags=re.MULTILINE).strip()
    
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        raise ValueError(f"AI did not return valid JSON. Raw response:\n{raw_text}\nParse error: {e}")

def generate_enhanced_prompt(fields: dict) -> dict:
    """
    Orchestrates the generation of a storyboard with visual-first multi-frame continuity.
    """
    vertex_client = current_app.vertex_client
    
    number_of_scenes = int(fields.get("number_of_scenes", 1))
    scene_durations = [8] * number_of_scenes
    
    image_gcs_uri = None
    task_instruction = "Generate cinematic storytelling with visual-first multi-frame continuity."
    tire_profile_json = None

    if fields.get("mode") == "image_to_video" and fields.get("image"):
        image_gcs_uri = fields["image"].get("gcsUri")
        task_instruction = (
            "Analyze the provided tire image and generate a cinematic storyboard using visual-first multi-frame continuity. "
            "DO NOT include detailed tire descriptions in prompts - the visual input provides all needed information. "
            "Each scene must include multiple clear, stable shots in the final 3 seconds for reliable frame extraction. "
            "Keep prompts concise, cinematic, and focused on action (under 200 words each)."
        )
        if not image_gcs_uri:
            raise ValueError("Image mode selected but no 'gcsUri' was provided.")
        
        # Simplified tire profile extraction - for context only, not for descriptions
        tire_profile_prompt = (
            "As an automotive specialist, analyze this tire and extract ONLY the most distinctive visual features in JSON format:\n"
            "{\n"
            "  'most_distinctive_features': [\n"
            "    'list 2-3 most visually unique elements for recognition only'\n"
            "  ],\n"
            "  'frame_extraction_guidance': {\n"
            "    'optimal_angles': 'which views show tire best',\n"
            "    'lighting_notes': 'optimal lighting for clear frames'\n"
            "  }\n"
            "}\n"
            "Focus ONLY on features needed for visual recognition and frame extraction. Output ONLY valid JSON."
        )
        
        try:
            raw_profile = vertex_client.generate_multimodal_content(tire_profile_prompt, image_gcs_uri)
            print(f"Raw tire profile response: {raw_profile}")
            
            tire_profile_json = safe_json_parse(raw_profile)
            print(f"Generated tire profile JSON: {tire_profile_json}")
            
        except (json.JSONDecodeError, ValueError) as e:
            print(f"Failed to parse tire profile: {e}")
            tire_profile_json = None
    
    final_prompt_text = build_prompt_text_for_chaining(fields, number_of_scenes, scene_durations, task_instruction, tire_profile_json)
    
    print(f"Calling Gemini with image context: {bool(image_gcs_uri)}")
    raw_text = vertex_client.generate_multimodal_content(final_prompt_text, image_gcs_uri)
    print("Generated prompts:")
    print(raw_text)
    
    # Parse the response and ensure clean output
    raw_response = safe_json_parse(raw_text)
    
    # Clean the response - remove any tire descriptions and ensure correct structure
    if 'scenes' in raw_response:
        for scene in raw_response['scenes']:
            # Remove any tire description fields if present
            for key in list(scene.keys()):
                if 'tire' in key.lower() or 'description' in key.lower():
                    if key not in ['id', 'duration', 'prompt']:
                        del scene[key]
            
            # Ensure correct field names
            if 'scene_number' in scene:
                scene['id'] = scene['scene_number']
                del scene['scene_number']
            elif 'id' not in scene:
                scene_index = raw_response['scenes'].index(scene)
                scene['id'] = scene_index + 1
    
    return raw_response

def enhance_existing_prompt(base_prompt: str) -> str:
    """Uses Gemini to enhance a simple prompt with more cinematic detail."""
    vertex_client = current_app.vertex_client

    enhancement_instruction = f"""
    You are a cinematic storyteller and creative director.
    Your task is to take a user's simple prompt for a single scene and rewrite it
    to be more detailed, visually rich, and cinematic for a generative video model.

    Follow these strict rules:

    1. **Do not change** the subject or main action of the original prompt.
    2. Add rich cinematic context: camera angles, motion, lighting, and environment tone.
    3. Make it youthful, energetic, and confident in tone.
    4. Do **not** add any on-screen logos, text, or branding graphics.
    5. The final result must feel cinematic and professional, focused on tyre visuals and movement.
    6. The final output must be **only one cinematic paragraph** (no JSON, no bullet points, no markdown).
    7. Keep it concise (under 150 words).
    8. DO NOT include detailed technical descriptions of the tire - focus on action and cinematography.

    ---
    User's Basic Prompt:
    "{base_prompt}"
    ---
    Your Enhanced Cinematic Prompt:
    """

    return vertex_client.generate_text_prompt(enhancement_instruction)