# Copyright 2024 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# import json

# from google.cloud.aiplatform import telemetry
# from typing import TypedDict # Remove if not used elsewhere in this file

import base64
import uuid

# from models.model_setup import (
#    ImagenModelSetup,
# )
from typing import Optional

from dotenv import load_dotenv
from google import genai
from google.cloud import aiplatform
from google.genai import types
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from app.common.storage import store_to_gcs
from app.config.default import Default

# class ImageModel(TypedDict): # Remove this definition
#     """Defines Models For Image Generation."""
#
#     display: str
#     model_name: str


class ImagenModelSetup:
    """Imagen model setup"""

    @staticmethod
    def init(
        project_id: Optional[str] = None,
        location: Optional[str] = None,
        model_id: Optional[str] = None,
    ):
        """Init method"""
        config = Default()
        if not project_id:
            project_id = config.PROJECT_ID
        if not location:
            location = config.LOCATION
        if not model_id:
            model_id = config.MODEL_ID
        if None in [project_id, location, model_id]:
            raise ValueError("All parameters must be set.")
        print(f"initiating genai client with {project_id} in {location}")
        client = genai.Client(
            vertexai=config.INIT_VERTEX,
            project=project_id,
            location=location,
        )
        return client


@retry(
    wait=wait_exponential(
        multiplier=1, min=1, max=10
    ),  # Exponential backoff (1s, 2s, 4s... up to 10s)
    stop=stop_after_attempt(3),  # Stop after 3 attempts
    retry=retry_if_exception_type(Exception),  # Retry on all exceptions for robustness
    reraise=True,  # re-raise the last exception if all retries fail
)
def generate_images(
    model: str,
    prompt: str,
    number_of_images: int,
    aspect_ratio: str,
    negative_prompt: str,
):
    """Imagen image generation with Google GenAI client"""

    client = ImagenModelSetup.init(model_id=model)
    cfg = Default()  # Instantiate Default config to access IMAGE_BUCKET

    # Define a GCS path for outputting generated images
    gcs_output_directory = f"gs://{cfg.IMAGE_BUCKET}/{cfg.IMAGEN_GENERATED_SUBFOLDER}"

    try:
        print(
            f"models.image_models.generate_images: Requesting {number_of_images} images for model {model} with output to {gcs_output_directory}"
        )
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

        # Diagnostic logging for the response
        if (
            response
            and hasattr(response, "generated_images")
            and response.generated_images
        ):
            print(
                f"models.image_models.generate_images: Received {len(response.generated_images)} generated_images."
            )
            for i, gen_img in enumerate(response.generated_images):
                if hasattr(gen_img, "image") and gen_img.image:
                    if not gen_img.image.gcs_uri:
                        print(
                            f"models.image_models.generate_images: Image {i} has NO gcs_uri. Image object: {gen_img.image}"
                        )
                    else:
                        print(
                            f"models.image_models.generate_images: Image {i} has gcs_uri: {gen_img.image.gcs_uri}"
                        )
                    if not gen_img.image.image_bytes:
                        print(
                            f"models.image_models.generate_images: Image {i} has NO image_bytes."
                        )
                elif hasattr(gen_img, "error"):
                    print(
                        f"models.image_models.generate_images: GeneratedImage {i} has an error: {getattr(gen_img, 'error', 'Unknown error')}"
                    )
                else:
                    print(
                        f"models.image_models.generate_images: GeneratedImage {i} has no .image attribute or it's None. Full GeneratedImage object: {gen_img}"
                    )
        elif response and hasattr(response, "error"):
            print(
                f"models.image_models.generate_images: API response contains an error: {getattr(response, 'error', 'Unknown error')}"
            )
        else:
            print(
                f"models.image_models.generate_images: Response has no generated_images or is empty. Full response: {response}"
            )

        return response
    except Exception as e:
        print(f"models.image_models.generate_images: API call failed: {e}")
        raise


def generate_images_from_prompt(
    input_txt: str,
    current_model_name: str,
    image_count: int,
    negative_prompt: str,
    prompt_modifiers_segment: str,
    aspect_ratio: str,
) -> list[str]:
    """
    Generates images based on the input prompt and parameters.
    Returns a list of image URIs. Does not directly modify PageState.
    """
    full_prompt = f"{input_txt}, {prompt_modifiers_segment}"
    response = generate_images(
        model=current_model_name,
        prompt=full_prompt,
        number_of_images=image_count,
        aspect_ratio=aspect_ratio,
        negative_prompt=negative_prompt,
    )
    generated_uris = [
        img.image.gcs_uri
        for img in response.generated_images
        if hasattr(img, "image") and hasattr(img.image, "gcs_uri")
    ]
    return generated_uris


def generate_virtual_models(prompt: str, num_images: int) -> list[str]:
    """
    Generates multiple virtual model images and saves them to GCS.

    Args:
        prompt: The prompt to generate the images.
        num_images: The number of images to generate.

    Returns:
        A list of GCS URIs for the generated images.
    """
    response = generate_images(
        model=Default().MODEL_IMAGEN4_FAST,
        prompt=prompt,
        number_of_images=num_images,
        aspect_ratio="1:1",
        negative_prompt="",  # Assuming no negative prompt for this case
    )
    generated_uris = [
        img.image.gcs_uri
        for img in response.generated_images
        if hasattr(img, "image") and hasattr(img.image, "gcs_uri")
    ]
    return generated_uris


def generate_image_for_vto(prompt: str) -> bytes:
    """
    Generates a single, randomized virtual model and returns the image bytes.
    This function is designed to be a non-breaking replacement for the original VTO
    workflow, ensuring backward compatibility.
    """
    # Use the VirtualModelGenerator to create a single random prompt
    # from app.models.virtual_model_generator import VirtualModelGenerator, DEFAULT_PROMPT
    
    # The VTO page passes a simple prompt, so we use the generator with the default template
    generator = VirtualModelGenerator(DEFAULT_PROMPT)
    generator.randomize_all()
    # Set a default variant for the VTO page
    generator.set_value("variant", "facing forward with a natural, relaxed posture and a neutral expression")

    random_prompt = generator.build_prompt()
    
    print(f"Generated random prompt for VTO: {random_prompt}")

    cfg = Default()
    client = ImagenModelSetup.init(model_id=cfg.MODEL_IMAGEN4_FAST)
    response = client.models.generate_images(
        model=cfg.MODEL_IMAGEN4_FAST,
        prompt=random_prompt,
        config=types.GenerateImagesConfig(
            number_of_images=1,
            aspect_ratio="1:1",
        ),
    )
    if response.generated_images and response.generated_images[0].image.image_bytes:
        return response.generated_images[0].image.image_bytes
    else:
        raise ValueError("Image generation failed or returned no data.")


def recontextualize_product_in_scene(
    image_uris_list: list[str], prompt: str, sample_count: int
) -> list[str]:
    """Recontextualizes a product in a scene and returns a list of GCS URIs."""
    cfg = Default()
    client_options = {"api_endpoint": f"{cfg.LOCATION}-aiplatform.googleapis.com"}
    client = aiplatform.gapic.PredictionServiceClient(client_options=client_options)

    model_endpoint = f"projects/{cfg.PROJECT_ID}/locations/{cfg.LOCATION}/publishers/google/models/{cfg.MODEL_IMAGEN_PRODUCT_RECONTEXT}"

    instance = {"productImages": []}
    for product_image_uri in image_uris_list:
        product_image = {"image": {"gcsUri": product_image_uri}}
        instance["productImages"].append(product_image)

    if prompt:
        instance["prompt"] = prompt

    parameters = {"sampleCount": sample_count}

    response = client.predict(
        endpoint=model_endpoint, instances=[instance], parameters=parameters
    )

    gcs_uris = []
    for prediction in response.predictions:
        if prediction.get("bytesBase64Encoded"):
            encoded_mask_string = prediction["bytesBase64Encoded"]
            mask_bytes = base64.b64decode(encoded_mask_string)

            gcs_uri = store_to_gcs(
                folder="recontext_results",
                file_name=f"recontext_result_{uuid.uuid4()}.png",
                mime_type="image/png",
                contents=mask_bytes,
                decode=False,
            )
            gcs_uris.append(gcs_uri)

    return gcs_uris


@retry(
    wait=wait_exponential(multiplier=1, min=1, max=10),
    stop=stop_after_attempt(3),
    retry=retry_if_exception_type(Exception),
    reraise=True,
)
def edit_image(
    model: str,
    prompt: str,
    edit_mode: str,
    mask_mode: str,
    reference_image_bytes: bytes,
    number_of_images: int,
    mime_type: str,
):
    """Edits an image using the Google GenAI client."""
    client = ImagenModelSetup.init(model_id=model)
    cfg = Default()
    gcs_output_directory = f"gs://{cfg.IMAGE_BUCKET}/{cfg.IMAGEN_EDITED_SUBFOLDER}"

    # raw_ref_image = types.RawReferenceImage(
    #     reference_id=1,
    #     reference_image=reference_image_bytes,
    # )

    # Create the reference image in the correct format with mime type
    reference_image = types.Image(
        image_bytes=reference_image_bytes,
        mime_type=mime_type
    )
    
    raw_ref_image = types.RawReferenceImage(
        reference_id=1,
        reference_image=reference_image,
    )

    # Create mask reference image with proper configuration
    mask_ref_image = types.MaskReferenceImage(
        reference_id=2,
        reference_image=None,
        config=types.MaskReferenceConfig(
            mask_mode=mask_mode,
            mask_dilation=0.03,
        ),
    )

    try:
        print(
            f"models.image_models.edit_image: Requesting {number_of_images} edited images for model {model} with output to {gcs_output_directory}"
        )
        response = client.models.edit_image(
            model=model,
            prompt=prompt,
            reference_images=[raw_ref_image],
            config=types.EditImageConfig(
                # edit_mode=edit_mode,
                edit_mode=types.EditMode.EDIT_MODE_DEFAULT,
                number_of_images=number_of_images,
                include_rai_reason=True,
                output_gcs_uri=gcs_output_directory,
                output_mime_type="image/jpeg",
            ),
        )

        if (
            response
            and hasattr(response, "generated_images")
            and response.generated_images
        ):
            print(
                f"models.image_models.edit_image: Received {len(response.generated_images)} edited images."
            )
            edited_uris = [
                img.image.gcs_uri
                for img in response.generated_images
                if hasattr(img, "image") and hasattr(img.image, "gcs_uri")
            ]
            return edited_uris
        elif response and hasattr(response, "error"):
            print(
                f"models.image_models.edit_image: API response contains an error: {getattr(response, 'error', 'Unknown error')}"
            )
            return []
        else:
            print(
                f"models.image_models.edit_image: Response has no generated_images or is empty. Full response: {response}"
            )
            return []

    except Exception as e:
        print(f"models.image_models.edit_image: API call failed: {e}")
        raise


@retry(
    wait=wait_exponential(multiplier=1, min=1, max=10),
    stop=stop_after_attempt(3),
    retry=retry_if_exception_type(Exception),
    reraise=True,
)
def remove_objects_from_image(
    image_bytes: bytes,
    removal_prompt: str,
    mime_type: str,
    number_of_images: int = 1,
    model: str = None,
) -> list[str]:
    """
    Removes objects from an image using Imagen 3 inpainting capabilities.
    
    This function uses Google Cloud Vertex AI Imagen 3 model to automatically detect
    and remove objects from images based on text descriptions. It follows the official
    Google documentation for object removal using semantic masking and inpainting.
    
    Args:
        image_bytes: The input image as bytes
        removal_prompt: Text description of objects to remove (e.g., "remove the car", "delete the person")
        mime_type: MIME type of the input image (e.g., 'image/jpeg', 'image/png', 'image/webp')
        number_of_images: Number of variations to generate (default: 1)
        model: Imagen model to use (default: MODEL_IMAGEN_EDITING from config)
    
    Returns:
        List of GCS URIs for the processed images with objects removed
        
    Raises:
        ValueError: If image size exceeds limits or format is not supported
        Exception: If API call fails after retries
        
    Example:
        >>> image_data = open('photo.jpg', 'rb').read()
        >>> result_uris = remove_objects_from_image(
        ...     image_bytes=image_data,
        ...     removal_prompt="remove the car in the background",
        ...     mime_type="image/jpeg"
        ... )
        >>> print(f"Processed image saved to: {result_uris[0]}")
    """
    cfg = Default()
    
    # Validate image size
    if len(image_bytes) > cfg.MAX_OBJECT_REMOVAL_IMAGE_SIZE:
        raise ValueError(
            f"Image size ({len(image_bytes)} bytes) exceeds maximum allowed size "
            f"({cfg.MAX_OBJECT_REMOVAL_IMAGE_SIZE} bytes)"
        )
    
    # Validate image format
    if mime_type not in cfg.SUPPORTED_REMOVAL_FORMATS:
        raise ValueError(
            f"Unsupported image format: {mime_type}. "
            f"Supported formats: {', '.join(cfg.SUPPORTED_REMOVAL_FORMATS)}"
        )
    
    # Validate removal prompt
    if not removal_prompt or not removal_prompt.strip():
        raise ValueError("Removal prompt cannot be empty")
    
    # Use default model if not specified
    if not model:
        model = cfg.MODEL_IMAGEN_EDITING
    
    # Initialize client
    client = ImagenModelSetup.init(model_id=model)
    
    # Define GCS output directory for object removal results
    gcs_output_directory = f"gs://{cfg.IMAGE_BUCKET}/{cfg.IMAGEN_OBJECT_REMOVAL_SUBFOLDER}"
    
    try:
        print(
            f"models.image_models.remove_objects_from_image: Processing object removal "
            f"with prompt '{removal_prompt}' using model {model}"
        )
        
        # Create the reference image
        reference_image = types.Image(
            image_bytes=image_bytes,
            mime_type=mime_type
        )
        
        # Create raw reference image for inpainting
        raw_ref_image = types.RawReferenceImage(
            reference_id=1,
            reference_image=reference_image,
        )
        
        # Create mask reference image for automatic mask generation
        # Using MASK_MODE_SEMANTIC for automatic object detection and removal
        mask_ref_image = types.MaskReferenceImage(
            reference_id=2,
            reference_image=None,  # Let Imagen generate the mask automatically based on prompt
            config=types.MaskReferenceConfig(
                mask_mode="MASK_MODE_SEMANTIC",  # Automatically detect objects based on text prompt
                mask_dilation=0.03,  # Slight dilation for better edge handling
            ),
        )
        
        # Call the edit_image API with inpainting mode
        response = client.models.edit_image(
            model=model,
            prompt=removal_prompt,
            reference_images=[raw_ref_image, mask_ref_image],
            config=types.EditImageConfig(
                edit_mode="EDIT_MODE_INPAINTING_INSERT",  # Inpainting mode for object removal
                number_of_images=number_of_images,
                include_rai_reason=True,
                output_gcs_uri=gcs_output_directory,
                output_mime_type="image/jpeg",  # Standardize output format
            ),
        )
        
        # Process response
        if (
            response
            and hasattr(response, "generated_images")
            and response.generated_images
        ):
            print(
                f"models.image_models.remove_objects_from_image: Successfully generated "
                f"{len(response.generated_images)} images with objects removed"
            )
            
            # Extract GCS URIs from successful generations
            processed_uris = []
            for i, img in enumerate(response.generated_images):
                if hasattr(img, "image") and hasattr(img.image, "gcs_uri") and img.image.gcs_uri:
                    processed_uris.append(img.image.gcs_uri)
                    print(f"models.image_models.remove_objects_from_image: Image {i} saved to {img.image.gcs_uri}")
                elif hasattr(img, "error"):
                    print(f"models.image_models.remove_objects_from_image: Image {i} generation failed: {img.error}")
                else:
                    print(f"models.image_models.remove_objects_from_image: Image {i} has no valid GCS URI")
            
            if not processed_uris:
                raise Exception("No images were successfully generated")
                
            return processed_uris
            
        elif response and hasattr(response, "error"):
            error_msg = getattr(response, "error", "Unknown error")
            print(f"models.image_models.remove_objects_from_image: API response error: {error_msg}")
            raise Exception(f"Object removal failed: {error_msg}")
        else:
            print(f"models.image_models.remove_objects_from_image: Empty or invalid response: {response}")
            raise Exception("Object removal failed: Empty response from API")
            
    except ValueError as ve:
        # Re-raise validation errors as-is
        print(f"models.image_models.remove_objects_from_image: Validation error: {ve}")
        raise
    except Exception as e:
        print(f"models.image_models.remove_objects_from_image: API call failed: {e}")
        raise Exception(f"Object removal failed: {str(e)}")


def validate_image_for_object_removal(image_bytes: bytes, mime_type: str) -> dict:
    """
    Validates an image for object removal processing.
    
    Args:
        image_bytes: The input image as bytes
        mime_type: MIME type of the input image
    
    Returns:
        Dictionary with validation results:
        {
            "valid": bool,
            "error": str or None,
            "size_mb": float,
            "format": str
        }
    """
    cfg = Default()
    
    result = {
        "valid": True,
        "error": None,
        "size_mb": round(len(image_bytes) / (1024 * 1024), 2),
        "format": mime_type
    }
    
    # Check file size
    if len(image_bytes) > cfg.MAX_OBJECT_REMOVAL_IMAGE_SIZE:
        max_size_mb = cfg.MAX_OBJECT_REMOVAL_IMAGE_SIZE / (1024 * 1024)
        result["valid"] = False
        result["error"] = f"Image size ({result['size_mb']} MB) exceeds maximum allowed size ({max_size_mb} MB)"
        return result
    
    # Check format
    if mime_type not in cfg.SUPPORTED_REMOVAL_FORMATS:
        result["valid"] = False
        result["error"] = f"Unsupported format: {mime_type}. Supported formats: {', '.join(cfg.SUPPORTED_REMOVAL_FORMATS)}"
        return result
    
    return result


def process_object_removal_request(
    image_bytes: bytes,
    removal_prompt: str,
    mime_type: str,
    number_of_images: int = 1
) -> dict:
    """
    High-level function to process object removal requests with comprehensive error handling.
    
    Args:
        image_bytes: The input image as bytes
        removal_prompt: Text description of objects to remove
        mime_type: MIME type of the input image
        number_of_images: Number of variations to generate
    
    Returns:
        Dictionary with processing results:
        {
            "success": bool,
            "gcs_uris": list[str] or None,
            "error": str or None,
            "validation": dict
        }
    """
    # Validate input
    validation = validate_image_for_object_removal(image_bytes, mime_type)
    
    result = {
        "success": False,
        "gcs_uris": None,
        "error": None,
        "validation": validation
    }
    
    if not validation["valid"]:
        result["error"] = validation["error"]
        return result
    
    # Validate prompt
    if not removal_prompt or not removal_prompt.strip():
        result["error"] = "Removal prompt cannot be empty"
        return result
    
    try:
        # Process the image
        gcs_uris = remove_objects_from_image(
            image_bytes=image_bytes,
            removal_prompt=removal_prompt.strip(),
            mime_type=mime_type,
            number_of_images=number_of_images
        )
        
        result["success"] = True
        result["gcs_uris"] = gcs_uris
        
        print(f"models.image_models.process_object_removal_request: Successfully processed object removal, generated {len(gcs_uris)} images")
        
    except Exception as e:
        result["error"] = str(e)
        print(f"models.image_models.process_object_removal_request: Failed to process object removal: {e}")
    
    return result


@retry(
    wait=wait_exponential(multiplier=1, min=1, max=10),
    stop=stop_after_attempt(3),
    retry=retry_if_exception_type(Exception),
    reraise=True,
)
def remove_objects_with_mask(
    image_bytes: bytes,
    mask_bytes: bytes,
    removal_prompt: str,
    image_mime_type: str,
    mask_mime_type: str,
    number_of_images: int = 1,
    model: str = None,
) -> list[str]:
    """
    Removes objects from an image using a user-provided mask (BYOM - Bring Your Own Mask).
    
    This function uses Google Cloud Vertex AI Imagen 3 model with a user-defined mask
    to precisely control which areas of the image should be inpainted. This follows the
    official Google documentation for inpainting with user-provided masks.
    
    Args:
        image_bytes: The input image as bytes
        mask_bytes: The mask image as bytes (white areas will be inpainted, black areas preserved)
        removal_prompt: Text description for inpainting the masked areas
        image_mime_type: MIME type of the input image (e.g., 'image/jpeg', 'image/png')
        mask_mime_type: MIME type of the mask image (e.g., 'image/png')
        number_of_images: Number of variations to generate (default: 1)
        model: Imagen model to use (default: MODEL_IMAGEN_EDITING from config)
    
    Returns:
        List of GCS URIs for the processed images with masked areas inpainted
        
    Raises:
        ValueError: If image/mask size exceeds limits or formats are not supported
        Exception: If API call fails after retries
        
    Example:
        >>> image_data = open('photo.jpg', 'rb').read()
        >>> mask_data = open('mask.png', 'rb').read()  # White areas = inpaint, black = preserve
        >>> result_uris = remove_objects_with_mask(
        ...     image_bytes=image_data,
        ...     mask_bytes=mask_data,
        ...     removal_prompt="fill with natural background",
        ...     image_mime_type="image/jpeg",
        ...     mask_mime_type="image/png"
        ... )
        >>> print(f"Processed image saved to: {result_uris[0]}")
    """
    cfg = Default()
    
    # Validate image size
    if len(image_bytes) > cfg.MAX_OBJECT_REMOVAL_IMAGE_SIZE:
        raise ValueError(
            f"Image size ({len(image_bytes)} bytes) exceeds maximum allowed size "
            f"({cfg.MAX_OBJECT_REMOVAL_IMAGE_SIZE} bytes)"
        )
    
    # Validate mask size
    if len(mask_bytes) > cfg.MAX_OBJECT_REMOVAL_IMAGE_SIZE:
        raise ValueError(
            f"Mask size ({len(mask_bytes)} bytes) exceeds maximum allowed size "
            f"({cfg.MAX_OBJECT_REMOVAL_IMAGE_SIZE} bytes)"
        )
    
    # Validate image format
    if image_mime_type not in cfg.SUPPORTED_REMOVAL_FORMATS:
        raise ValueError(
            f"Unsupported image format: {image_mime_type}. "
            f"Supported formats: {', '.join(cfg.SUPPORTED_REMOVAL_FORMATS)}"
        )
    
    # Validate mask format (typically PNG for masks)
    supported_mask_formats = ["image/png", "image/jpeg"]
    if mask_mime_type not in supported_mask_formats:
        raise ValueError(
            f"Unsupported mask format: {mask_mime_type}. "
            f"Supported mask formats: {', '.join(supported_mask_formats)}"
        )
    
    # Validate removal prompt
    if not removal_prompt or not removal_prompt.strip():
        raise ValueError("Removal prompt cannot be empty")
    
    # Use default model if not specified
    if not model:
        model = cfg.MODEL_IMAGEN_EDITING
    
    # Initialize client
    client = ImagenModelSetup.init(model_id=model)
    
    # Define GCS output directory for object removal results
    gcs_output_directory = f"gs://{cfg.IMAGE_BUCKET}/{cfg.IMAGEN_OBJECT_REMOVAL_SUBFOLDER}"
    
    try:
        print(
            f"models.image_models.remove_objects_with_mask: Processing masked object removal "
            f"with prompt '{removal_prompt}' using model {model}"
        )
        
        # Create the reference image
        reference_image = types.Image(
            image_bytes=image_bytes,
            mime_type=image_mime_type
        )
        
        # Create the mask image
        mask_image = types.Image(
            image_bytes=mask_bytes,
            mime_type=mask_mime_type
        )
        
        # Create raw reference image for inpainting
        raw_ref_image = types.RawReferenceImage(
            reference_id=1,
            reference_image=reference_image,
        )
        
        # Create mask reference image with user-provided mask
        # Using MASK_MODE_USER_PROVIDED for BYOM (Bring Your Own Mask)
        mask_ref_image = types.MaskReferenceImage(
            reference_id=2,
            reference_image=mask_image,  # User-provided mask
            config=types.MaskReferenceConfig(
                mask_mode="MASK_MODE_USER_PROVIDED",  # Use the provided mask
                mask_dilation=0.03,  # Slight dilation for better edge handling
            ),
        )
        
        # Call the edit_image API with inpainting mode
        response = client.models.edit_image(
            model=model,
            prompt=removal_prompt,
            reference_images=[raw_ref_image, mask_ref_image],
            config=types.EditImageConfig(
                edit_mode="EDIT_MODE_INPAINTING_INSERT",  # Inpainting mode for masked areas
                number_of_images=number_of_images,
                include_rai_reason=True,
                output_gcs_uri=gcs_output_directory,
                output_mime_type="image/jpeg",  # Standardize output format
            ),
        )
        
        # Process response
        if (
            response
            and hasattr(response, "generated_images")
            and response.generated_images
        ):
            print(
                f"models.image_models.remove_objects_with_mask: Successfully generated "
                f"{len(response.generated_images)} images with masked areas inpainted"
            )
            
            # Extract GCS URIs from successful generations
            processed_uris = []
            for i, img in enumerate(response.generated_images):
                if hasattr(img, "image") and hasattr(img.image, "gcs_uri") and img.image.gcs_uri:
                    processed_uris.append(img.image.gcs_uri)
                    print(f"models.image_models.remove_objects_with_mask: Image {i} saved to {img.image.gcs_uri}")
                elif hasattr(img, "error"):
                    print(f"models.image_models.remove_objects_with_mask: Image {i} generation failed: {img.error}")
                else:
                    print(f"models.image_models.remove_objects_with_mask: Image {i} has no valid GCS URI")
            
            if not processed_uris:
                raise Exception("No images were successfully generated")
                
            return processed_uris
            
        elif response and hasattr(response, "error"):
            error_msg = getattr(response, "error", "Unknown error")
            print(f"models.image_models.remove_objects_with_mask: API response error: {error_msg}")
            raise Exception(f"Masked object removal failed: {error_msg}")
        else:
            print(f"models.image_models.remove_objects_with_mask: Empty or invalid response: {response}")
            raise Exception("Masked object removal failed: Empty response from API")
            
    except ValueError as ve:
        # Re-raise validation errors as-is
        print(f"models.image_models.remove_objects_with_mask: Validation error: {ve}")
        raise
    except Exception as e:
        print(f"models.image_models.remove_objects_with_mask: API call failed: {e}")
        raise Exception(f"Masked object removal failed: {str(e)}")


def validate_mask_for_object_removal(
    image_bytes: bytes, 
    mask_bytes: bytes, 
    image_mime_type: str, 
    mask_mime_type: str
) -> dict:
    """
    Validates an image and mask for masked object removal processing.
    
    Args:
        image_bytes: The input image as bytes
        mask_bytes: The mask image as bytes
        image_mime_type: MIME type of the input image
        mask_mime_type: MIME type of the mask image
    
    Returns:
        Dictionary with validation results:
        {
            "valid": bool,
            "error": str or None,
            "image_size_mb": float,
            "mask_size_mb": float,
            "image_format": str,
            "mask_format": str
        }
    """
    cfg = Default()
    
    result = {
        "valid": True,
        "error": None,
        "image_size_mb": round(len(image_bytes) / (1024 * 1024), 2),
        "mask_size_mb": round(len(mask_bytes) / (1024 * 1024), 2),
        "image_format": image_mime_type,
        "mask_format": mask_mime_type
    }
    
    # Check image file size
    if len(image_bytes) > cfg.MAX_OBJECT_REMOVAL_IMAGE_SIZE:
        max_size_mb = cfg.MAX_OBJECT_REMOVAL_IMAGE_SIZE / (1024 * 1024)
        result["valid"] = False
        result["error"] = f"Image size ({result['image_size_mb']} MB) exceeds maximum allowed size ({max_size_mb} MB)"
        return result
    
    # Check mask file size
    if len(mask_bytes) > cfg.MAX_OBJECT_REMOVAL_IMAGE_SIZE:
        max_size_mb = cfg.MAX_OBJECT_REMOVAL_IMAGE_SIZE / (1024 * 1024)
        result["valid"] = False
        result["error"] = f"Mask size ({result['mask_size_mb']} MB) exceeds maximum allowed size ({max_size_mb} MB)"
        return result
    
    # Check image format
    if image_mime_type not in cfg.SUPPORTED_REMOVAL_FORMATS:
        result["valid"] = False
        result["error"] = f"Unsupported image format: {image_mime_type}. Supported formats: {', '.join(cfg.SUPPORTED_REMOVAL_FORMATS)}"
        return result
    
    # Check mask format
    supported_mask_formats = ["image/png", "image/jpeg"]
    if mask_mime_type not in supported_mask_formats:
        result["valid"] = False
        result["error"] = f"Unsupported mask format: {mask_mime_type}. Supported formats: {', '.join(supported_mask_formats)}"
        return result
    
    return result


def process_masked_object_removal_request(
    image_bytes: bytes,
    mask_bytes: bytes,
    removal_prompt: str,
    image_mime_type: str,
    mask_mime_type: str,
    number_of_images: int = 1
) -> dict:
    """
    High-level function to process masked object removal requests with comprehensive error handling.
    
    Args:
        image_bytes: The input image as bytes
        mask_bytes: The mask image as bytes
        removal_prompt: Text description for inpainting the masked areas
        image_mime_type: MIME type of the input image
        mask_mime_type: MIME type of the mask image
        number_of_images: Number of variations to generate
    
    Returns:
        Dictionary with processing results:
        {
            "success": bool,
            "gcs_uris": list[str] or None,
            "error": str or None,
            "validation": dict
        }
    """
    # Validate input
    validation = validate_mask_for_object_removal(
        image_bytes, mask_bytes, image_mime_type, mask_mime_type
    )
    
    result = {
        "success": False,
        "gcs_uris": None,
        "error": None,
        "validation": validation
    }
    
    if not validation["valid"]:
        result["error"] = validation["error"]
        return result
    
    # Validate prompt
    if not removal_prompt or not removal_prompt.strip():
        result["error"] = "Removal prompt cannot be empty"
        return result
    
    try:
        # Process the image with mask
        gcs_uris = remove_objects_with_mask(
            image_bytes=image_bytes,
            mask_bytes=mask_bytes,
            removal_prompt=removal_prompt.strip(),
            image_mime_type=image_mime_type,
            mask_mime_type=mask_mime_type,
            number_of_images=number_of_images
        )
        
        result["success"] = True
        result["gcs_uris"] = gcs_uris
        
        print(f"models.image_models.process_masked_object_removal_request: Successfully processed masked object removal, generated {len(gcs_uris)} images")
        
    except Exception as e:
        result["error"] = str(e)
        print(f"models.image_models.process_masked_object_removal_request: Failed to process masked object removal: {e}")
    
    return result
