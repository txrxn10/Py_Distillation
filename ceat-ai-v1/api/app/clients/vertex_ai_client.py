import vertexai
from vertexai.generative_models import GenerativeModel,Part
from google.genai.types import GenerateVideosConfig,Image
from google import genai
import time

class VertexAIClient:
    def __init__(self, config):
        project_id = config['PROJECT_ID']
        location = config['LOCATION']
        vertexai.init(project=project_id, location=location)
        self.gemini_model = GenerativeModel("gemini-2.5-pro")
        self.veo_model_name = "veo-3.0-generate-preview"
        self.image_video_model_name = "veo-3.0-generate-preview"
        self.genai_client = genai.Client(vertexai=True, project=project_id, location=location)
        print("Vertex AI Client Initialized.")

    def generate_text_prompt(self, prompt_text: str) -> str:
        response = self.gemini_model.generate_content(prompt_text)
        return response.text.strip()

    def generate_multimodal_content(self, prompt_text: str, image_gcs_uri: str = None) -> str:
        """
        Generates multimodal content (text + image) using Gemini.
       
        """
        parts = []

        if image_gcs_uri:
            print(f"Generating content with image: {image_gcs_uri}")
            mime_type = "image/png" if image_gcs_uri.lower().endswith(".png") else "image/jpeg"
            print(f"Detected MIME type: {mime_type}")
            image_part = Part.from_uri(uri=image_gcs_uri, mime_type=mime_type)
            parts.append(image_part)

        parts.append(prompt_text)

        print(f"Generating Gemini content with {len(parts)} parts (image + text).")
        response = self.gemini_model.generate_content(parts)

        return response.text.strip()
    
    def generate_video_clip(self, prompt: str, output_gcs_uri: str,image: dict = None, **kwargs) -> str:
        """
        Generates a video clip using Veo, accepting all documented configuration parameters.
        """
        # Build the configuration dictionary from keyword arguments, with defaults
        config_params = {
            # Core parameters
            "aspect_ratio": kwargs.get("aspectRatio", "16:9"),
            "duration_seconds": kwargs.get("durationSeconds", 8),
            "resolution": kwargs.get("resolution", "1080p"),
            "output_gcs_uri": output_gcs_uri,

            # Creative control parameters from documentation
            "enhance_prompt": kwargs.get("enhancePrompt", True),
            "generate_audio": kwargs.get("generateAudio", True),
            "negative_prompt": kwargs.get("negativePrompt","blurry, low quality, text, watermark, signature, damaged tires, poor condition, different tire pattern"),
            "seed": kwargs.get("seed"),
            "number_of_videos": kwargs.get("sampleCount", 1),

            # Technical & Safety parameters from documentation
            "person_generation": kwargs.get("personGeneration", "allow_adult"),
            "compression_quality": kwargs.get("compressionQuality"),
        }

        # Filter out any parameters that were not provided (are None)
        # This ensures we only send valid values to the API
        final_config_params = {k: v for k, v in config_params.items() if v is not None}
        call_args = {
            "prompt": prompt,
            "config": GenerateVideosConfig(**final_config_params)
        }
        if image and image.get('gcsUri') and image.get('mimeType'):
            call_args["image"] = Image(
                gcs_uri=image.get('gcsUri'),
                mime_type=image.get('mimeType')
            )
            call_args["model"] = self.image_video_model_name
        else:
            call_args["model"] = self.veo_model_name

        operation = self.genai_client.models.generate_videos(**call_args)

        print(f"Started Veo generation for clip. Operation: {operation.name}")
        
        while not operation.done:
            time.sleep(20)
            operation = self.genai_client.operations.get(operation)
            
        if not operation.response:
            raise RuntimeError("Veo did not return a video response.")
            
        # Assuming sampleCount is 1, return the first video's URI
        return operation.result.generated_videos[0].video.uri
        # max_wait_minutes = 10
        # polling_interval = 20
        # waited = 0

        # while not operation.done and waited < (max_wait_minutes * 60):
        #     time.sleep(polling_interval)
        #     waited += polling_interval
        #     operation = self.genai_client.operations.get(operation)
        #     print(f" Waiting for Veo… ({waited}s elapsed)")

        # if not operation.done:
        #     raise TimeoutError(f"Veo operation timed out after {max_wait_minutes} minutes.")

        # if (
        #         not getattr(operation, "result", None) or
        #         not getattr(operation.result, "generated_videos", None) or
        #         len(operation.result.generated_videos) == 0
        #     ):
        #         raise RuntimeError("Veo did not return a video response (possibly rejected or empty).")

        # video_uri = operation.result.generated_videos[0].video.uri
        # print(f"Video generated successfully → {video_uri}")
        # return video_uri
    
