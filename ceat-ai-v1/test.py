from typing import Dict, List, Optional
import enum
from dataclasses import dataclass

class CEATImageType(enum.Enum):
    CORPORATE = "corporate"
    PRODUCT = "product" 
    RETAIL = "retail"
    LIFESTYLE = "lifestyle"
    ADVERTISING = "advertising"

@dataclass
class CEATGenerationRequest:
    subject: str
    context: str
    mood: str
    image_type: CEATImageType
    composition: Optional[str] = None
    additional_requirements: Optional[str] = None

class CEATBrandImagen4Generator:
    def __init__(self):
        self.brand_guidelines = self._load_ceat_guidelines()
        self.templates = self._setup_prompt_templates()
    
    def _load_ceat_guidelines(self) -> Dict:
        """Load CEAT brand guidelines for prompt generation"""
        return {
            "brand_voice": "Strong, stable, dynamic, youthful, contemporary, innovative",
            "core_colors": {
                "ceat_blue": "#0055aa",
                "ceat_orange": "#ff8200"
            },
            "imagery_style": "Unusual and dynamic angles, extreme close-ups, predominantly blue and orange colors, movement and energy, youthful and fresh",
            "inspiration": "Roads, dividers, chevrons, bright reflective colours"
        }
    
    def _setup_prompt_templates(self) -> Dict:
        """Setup CEAT-specific prompt templates"""
        return {
            CEATImageType.CORPORATE: {
                "positive": "Professional corporate image of {subject} in {context}. Style: {style} with predominant CEAT Blue (#0055aa) and strategic CEAT Orange (#ff8200) accents. {composition} Mood: {mood}, innovative, trustworthy. Include subtle road-inspired design elements like dividers or chevrons. Brand voice: {brand_voice}.",
                "negative": "corporate clichés, static poses, muted colors, traditional office settings, competing brands, predictable automotive imagery"
            },
            CEATImageType.PRODUCT: {
                "positive": "Extreme close-up product shot of {subject}. Dominant CEAT color palette: Blue #0055aa and Orange #ff8200. Style: {style} with sense of motion. {composition} Highlight product features with unusual angles. Mood: {mood}, robust, cutting-edge. Include road/driving context. Technical photography with professional lighting.",
                "negative": "blurry product shots, poor lighting, generic backgrounds, static composition, incorrect colors, vintage styling"
            },
            CEATImageType.RETAIL: {
                "positive": "Bright, energetic retail environment featuring {subject} in {context}. Predominant CEAT Blue (#0055aa) branding with Orange (#ff8200) accents. Style: {style} with clean lines. {composition} Mood: {mood}, welcoming, professional. Show clear brand environment with proper signage. Include subtle chevron patterns.",
                "negative": "dark retail spaces, cluttered displays, poor signage, outdated styling, competing brand elements, muted colors"
            },
            CEATImageType.LIFESTYLE: {
                "positive": "Lifestyle image of {subject} in {context}. Warm, friendly imagery with emotional connection. CEAT colors dominant: Blue #0055aa and Orange #ff8200. Style: {style}. {composition} Mood: {mood}, authentic, energetic. Focus on genuine interactions and contemporary settings. Avoid predictable poses.",
                "negative": "posed stock photography, artificial expressions, muted colors, predictable scenarios, clichéd automotive imagery, vintage styling"
            },
            CEATImageType.ADVERTISING: {
                "positive": "Dynamic advertising image of {subject} in {context}. Style: {style} with predominant CEAT Blue (#0055aa) and Orange (#ff8200). {composition} Mood: {mood}, contemporary, impactful. Use unusual angles and movement. Include brand elements following CEAT advertising grid principles. Emotional connection with viewer.",
                "negative": "predictable advertising clichés, static composition, incorrect colors, outdated styling, poor visual hierarchy"
            }
        }
    
    def generate_ceat_prompt(self, request: CEATGenerationRequest) -> tuple[str, str]:
        """Generate CEAT brand-compliant prompt and negative prompt"""
        
        template = self.templates[request.image_type]
        
        # Build composition text
        composition_text = f"Composition: {request.composition}. " if request.composition else "Composition: dynamic, unusual angles with professional framing. "
        
        # Build positive prompt
        positive_prompt = template["positive"].format(
            subject=request.subject,
            context=request.context,
            style=self.brand_guidelines["imagery_style"],
            composition=composition_text,
            mood=request.mood,
            brand_voice=self.brand_guidelines["brand_voice"]
        )
        
        # Add additional requirements if provided
        if request.additional_requirements:
            positive_prompt += f" Additional requirements: {request.additional_requirements}"
        
        # Build negative prompt
        negative_prompt = template["negative"]
        
        return positive_prompt, negative_prompt
    
    def generate_images(self, 
                       client, 
                       model: str,
                       request: CEATGenerationRequest,
                       number_of_images: int = 1,
                       aspect_ratio: str = "16:9",
                       gcs_output_directory: str = None) -> any:
        """
        Generate images using Imagen 4 with CEAT brand compliance
        
        Args:
            client: Initialized ImagenModelSetup client
            model: Model ID
            request: CEAT generation request
            number_of_images: Number of images to generate
            aspect_ratio: Output aspect ratio
            gcs_output_directory: GCS output directory
        """
        
        # Generate brand-compliant prompts
        prompt, negative_prompt = self.generate_ceat_prompt(request)
        
        print(f"Generated CEAT Prompt: {prompt}")
        print(f"Negative Prompt: {negative_prompt}")
        
        # Call Imagen 4 API
        response = client.models.generate_images(
            model=model,
            prompt=prompt,
            config=types.GenerateImagesConfig(
                number_of_images=number_of_images,
                include_rai_reason=True,
                output_gcs_uri=gcs_output_directory,
                aspect_ratio=aspect_ratio,
                negative_prompt=negative_prompt,
            ),
        )
        
        return response