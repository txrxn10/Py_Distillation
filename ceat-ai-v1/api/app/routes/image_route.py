from flask import Blueprint, jsonify, request
import base64
import io
import random
import traceback
import requests
import time
import datetime
from app.models.image_models import generate_images_from_prompt, edit_image
from app.config.default import Default
from app.common.error_handling import GenerationError
from app.common.storage import generate_signed_urls
from app.common.metadata import MediaItem, add_media_item_to_firestore
from app.utils.helper import create_brand_enhanced_image_prompt
from app.utils.auth_decorator import require_auth
from google.genai.types import Content, Part
from PIL import Image
import requests
from io import BytesIO
import os
from google.cloud import storage
image_bp = Blueprint('image', __name__)

def enhance_prompt_with_brand_guidelines(prompt: str, style: str, content_type=None, color_tone=None, lighting=None, composition=None) -> str:
    """Enhance the user prompt with brand guidelines context and filter-specific modifiers"""
    
    base_prompt = prompt
    
    # Add filter-specific enhancements
    filter_modifiers = []
    
    # Content type modifiers
    if content_type and content_type != "none":
        content_modifiers = {
            "photo": "photographic style, high-quality photography",
            "art": "artistic style, fine art composition"
        }
        if content_type in content_modifiers:
            filter_modifiers.append(content_modifiers[content_type])
    
    # Color and tone modifiers
    if color_tone and color_tone != "none":
        color_modifiers = {
            "black and white": "black and white, monochrome",
            "cool tone": "cool color temperature, blue tones",
            "golden": "golden hour lighting, warm golden tones",
            "monochromatic": "monochromatic color scheme",
            "muted color": "muted colors, desaturated palette",
            "pastel color": "pastel colors, soft color palette",
            "toned image": "color graded, cinematic color toning"
        }
        if color_tone in color_modifiers:
            filter_modifiers.append(color_modifiers[color_tone])
    
    # Lighting modifiers
    if lighting and lighting != "none":
        lighting_modifiers = {
            "backlighting": "backlighting, rim lighting",
            "dramatic light": "dramatic lighting, high contrast",
            "long-time exposure": "long exposure, motion blur effects",
            "low lighting": "low light, moody atmosphere",
            "multiexposure": "multiple exposure, layered lighting",
            "studio light": "studio lighting, professional lighting setup",
            "surreal lighting": "surreal lighting, artistic lighting effects"
        }
        if lighting in lighting_modifiers:
            filter_modifiers.append(lighting_modifiers[lighting])
    
    # Composition modifiers
    if composition and composition != "none":
        composition_modifiers = {
            "closeup": "close-up shot, macro photography",
            "knolling": "knolling composition, organized flat lay",
            "landscape photography": "landscape composition, wide vista",
            "photographed through window": "shot through window, framed composition",
            "shallow depth of field": "shallow depth of field, bokeh background",
            "shot from above": "overhead shot, bird's eye view",
            "shot from below": "low angle shot, dramatic perspective",
            "surface details": "detailed surface textures, macro details",
            "wide angle": "wide angle lens, expansive view"
        }
        if composition in composition_modifiers:
            filter_modifiers.append(composition_modifiers[composition])
    
    # Combine base prompt with filter modifiers
    if filter_modifiers:
        enhanced_prompt = f"{base_prompt}, {', '.join(filter_modifiers)}"
    else:
        enhanced_prompt = base_prompt

    brand_enhanced_prompt = create_brand_enhanced_image_prompt(enhanced_prompt)
    
    print(f"Enhanced prompt with filters: {brand_enhanced_prompt[:100]}...")
    return brand_enhanced_prompt

@image_bp.route('/image/health', methods=['GET'])
def health_check():
    """Health check endpoint to verify API is running"""
    return jsonify({
        "status": "healthy",
        "message": "Image generation API is running",
        "version": "1.0.0"
    })

@image_bp.route('/image/generate', methods=['GET'])
@require_auth
def image():
    return jsonify({"message": "This is the image generation endpoint"})

@image_bp.route('/image/generate', methods=['OPTIONS'])
def image_options():
    """Handle preflight OPTIONS requests for CORS"""
    return '', 200

@image_bp.route('/image/download', methods=['OPTIONS'])
def download_options():
    """Handle preflight OPTIONS requests for CORS"""
    return '', 200

@image_bp.route('/image/download', methods=['POST'])
@require_auth
def download_image():
    """
    Download an image from a signed URL or GCS URI.
    Expects a JSON payload with the image URL.
    """
    try:
        # Get request data
        data = request.get_json()
        
        if not data:
            return jsonify({
                "success": False,
                "error": "No data provided",
                "code": "INVALID_REQUEST"
            }), 400
        
        # Validate required fields
        if 'image_url' not in data or not data['image_url']:
            return jsonify({
                "success": False,
                "error": "Missing required field: image_url",
                "code": "INVALID_REQUEST"
            }), 400
        
        image_url = data['image_url'].strip()
        filename = data.get('filename', 'generated_image.png')
        
        # Validate URL format
        if not image_url.startswith(('http://', 'https://', 'gs://')):
            return jsonify({
                "success": False,
                "error": "Invalid image URL format",
                "code": "INVALID_URL"
            }), 400
        
        print(f"Download request for: {image_url}")
        
        try:
            # If it's a GCS URI, convert to signed URL first
            if image_url.startswith('gs://'):
                from app.common.storage import generate_signed_url
                signed_url = generate_signed_url(image_url, expiration_hours=1)  # Short expiration for download
                download_url = signed_url
            else:
                download_url = image_url
            
            # Fetch the image data
            import requests
            response = requests.get(download_url, timeout=30)
            
            if response.status_code != 200:
                return jsonify({
                    "success": False,
                    "error": f"Failed to fetch image: HTTP {response.status_code}",
                    "code": "DOWNLOAD_FAILED"
                }), 500
            
            # Validate content type
            content_type = response.headers.get('content-type', '')
            if not content_type.startswith('image/'):
                return jsonify({
                    "success": False,
                    "error": "URL does not point to a valid image",
                    "code": "INVALID_IMAGE"
                }), 400
            
            # Determine file extension from content type
            extension_map = {
                'image/png': '.png',
                'image/jpeg': '.jpg',
                'image/jpg': '.jpg',
                'image/gif': '.gif',
                'image/webp': '.webp'
            }
            
            extension = extension_map.get(content_type, '.png')
            
            # Ensure filename has correct extension
            if not filename.lower().endswith(tuple(extension_map.values())):
                filename = f"{filename.rsplit('.', 1)[0] if '.' in filename else filename}{extension}"
            
            # Return the image data with appropriate headers for download
            from flask import Response
            
            response_headers = {
                'Content-Type': content_type,
                'Content-Disposition': f'attachment; filename="{filename}"',
                'Content-Length': str(len(response.content)),
                'Cache-Control': 'no-cache'
            }
            
            print(f"Successfully prepared download for: {filename}")
            
            return Response(
                response.content,
                headers=response_headers,
                status=200
            )
            
        except requests.exceptions.RequestException as e:
            print(f"Network error downloading image: {e}")
            return jsonify({
                "success": False,
                "error": "Failed to download image from URL",
                "code": "NETWORK_ERROR"
            }), 500
            
        except Exception as download_error:
            print(f"Download error: {download_error}")
            print(f"Traceback: {traceback.format_exc()}")
            return jsonify({
                "success": False,
                "error": "Failed to process image download",
                "code": "DOWNLOAD_ERROR"
            }), 500
        
    except Exception as e:
        print(f"Unexpected error in download endpoint: {e}")
        print(f"Traceback: {traceback.format_exc()}")
        return jsonify({
            "success": False,
            "error": f"Internal server error: {str(e)}",
            "code": "INTERNAL_ERROR"
        }), 500

@image_bp.route('/image/generate', methods=['POST'])
@require_auth
def generate_image():
    """
    Generate images using Google Imagen model based on the provided prompt and parameters.
    """
    try:
        # Get request data
        data = request.get_json()
        
        if not data:
            return jsonify({
                "success": False,
                "error": "No data provided",
                "code": "INVALID_REQUEST"
            }), 400
        
        # Validate required fields
        required_fields = ['prompt', 'ratio', 'resolution', 'style']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({
                    "success": False,
                    "error": f"Missing required field: {field}",
                    "code": "INVALID_REQUEST"
                }), 400
        
        prompt = data['prompt']
        ratio = data['ratio']
        resolution = data['resolution']
        style = data['style']
        
        # Extract optional filter parameters
        content_type = data.get('contentType')
        color_tone = data.get('colorTone')
        lighting = data.get('lighting')
        composition = data.get('composition')
        num_images = data.get('numImages', 2)  # Default to 2 images if not specified
        
        # Validate aspect ratio format
        valid_ratios = ["1:1", "16:9", "9:16", "4:3"]
        if ratio not in valid_ratios:
            return jsonify({
                "success": False,
                "error": f"Invalid aspect ratio. Must be one of: {', '.join(valid_ratios)}",
                "code": "INVALID_RATIO"
            }), 400
        
        # Validate resolution format
        valid_resolutions = ["512x512", "1024x1024", "1536x1536", "2048x2048"]
        if resolution not in valid_resolutions:
            return jsonify({
                "success": False,
                "error": f"Invalid resolution. Must be one of: {', '.join(valid_resolutions)}",
                "code": "INVALID_RESOLUTION"
            }), 400
        
        # Validate style
        valid_styles = ["realistic", "artistic", "cartoon", "abstract"]
        if style not in valid_styles:
            return jsonify({
                "success": False,
                "error": f"Invalid style. Must be one of: {', '.join(valid_styles)}",
                "code": "INVALID_STYLE"
            }), 400
        
        # Validate optional filter parameters
        if content_type is not None:
            valid_content_types = ["none", "photo", "art"]
            if content_type not in valid_content_types:
                return jsonify({
                    "success": False,
                    "error": f"Invalid content type. Must be one of: {', '.join(valid_content_types)}",
                    "code": "INVALID_CONTENT_TYPE"
                }), 400
        
        if color_tone is not None:
            valid_color_tones = ["none", "black and white", "cool tone", "golden", "monochromatic", "muted color", "pastel color", "toned image"]
            if color_tone not in valid_color_tones:
                return jsonify({
                    "success": False,
                    "error": f"Invalid color tone. Must be one of: {', '.join(valid_color_tones)}",
                    "code": "INVALID_COLOR_TONE"
                }), 400
        
        if lighting is not None:
            valid_lighting = ["none", "backlighting", "dramatic light", "long-time exposure", "low lighting", "multiexposure", "studio light", "surreal lighting"]
            if lighting not in valid_lighting:
                return jsonify({
                    "success": False,
                    "error": f"Invalid lighting. Must be one of: {', '.join(valid_lighting)}",
                    "code": "INVALID_LIGHTING"
                }), 400
        
        if composition is not None:
            valid_composition = ["none", "closeup", "knolling", "landscape photography", "photographed through window", "shallow depth of field", "shot from above", "shot from below", "surface details", "wide angle"]
            if composition not in valid_composition:
                return jsonify({
                    "success": False,
                    "error": f"Invalid composition. Must be one of: {', '.join(valid_composition)}",
                    "code": "INVALID_COMPOSITION"
                }), 400
        
        if num_images is not None:
            if not isinstance(num_images, int) or num_images < 1 or num_images > 4:
                return jsonify({
                    "success": False,
                    "error": "Number of images must be between 1 and 4",
                    "code": "INVALID_NUM_IMAGES"
                }), 400
        
        # Get configuration
        cfg = Default()
        
        # Enhance prompt with brand guidelines and filters
        brand_enhanced_prompt = enhance_prompt_with_brand_guidelines(
            prompt, style, content_type, color_tone, lighting, composition
        )
        
        # Create enhanced prompt with style modifiers
        style_modifiers = {
            "realistic": "photorealistic, high quality, detailed, professional photography",
            "artistic": "artistic, creative, expressive, fine art style",
            "cartoon": "cartoon style, animated, colorful, stylized illustration",
            "abstract": "abstract art, creative interpretation, artistic expression"
        }
        
        # Combine brand guidelines with style modifiers
        enhanced_prompt = f"{brand_enhanced_prompt}, {style_modifiers.get(style, '')}"
        
        # Generate brand-aware negative prompt based on style and filters
        base_negative_prompts = {
            "realistic": "cartoon, anime, painting, drawing, sketch, low quality, blurry, off-brand colors, competitor logos, non-automotive themes",
            "artistic": "photorealistic, photograph, low quality, blurry, off-brand colors, competitor branding",
            "cartoon": "photorealistic, realistic, photograph, low quality, blurry, off-brand colors, competitor logos",
            "abstract": "photorealistic, realistic, photograph, low quality, blurry, off-brand colors, competitor branding, cluttered design"
        }
        
        negative_prompt_parts = [base_negative_prompts.get(style, "low quality, blurry, distorted, off-brand colors, competitor logos")]
        
        # Add filter-specific negative prompts
        if color_tone and color_tone != "none":
            if color_tone == "black and white":
                negative_prompt_parts.append("colorful, vibrant colors")
            elif color_tone in ["cool tone", "golden"]:
                negative_prompt_parts.append("wrong color temperature")
        
        if lighting and lighting != "none":
            if lighting == "low lighting":
                negative_prompt_parts.append("bright lighting, overexposed")
            elif lighting == "studio light":
                negative_prompt_parts.append("natural lighting, outdoor lighting")
        
        negative_prompt = ", ".join(negative_prompt_parts)
        
        print(f"Generating {num_images} images with Imagen model...")
        print(f"Enhanced prompt: {enhanced_prompt}")
        print(f"Aspect ratio: {ratio}")
        print(f"Negative prompt: {negative_prompt}")
        
        # return prompt
        
        # Use the Imagen model to generate images
        try:
            start_time = time.time()
            generated_uris = generate_images_from_prompt(
                input_txt=enhanced_prompt,
                current_model_name=cfg.MODEL_IMAGEN4_FAST,  # Use fast model for better performance
                image_count=num_images,
                negative_prompt=negative_prompt,
                prompt_modifiers_segment=style_modifiers.get(style, ''),
                aspect_ratio=ratio
            )
            
            if not generated_uris:
                return jsonify({
                    "success": False,
                    "error": "No images were generated. Please try again with a different prompt.",
                    "code": "GENERATION_FAILED"
                }), 500
            
            print(f"Successfully generated {len(generated_uris)} images")
            
   
            # storage_client = storage.Client()
      
            # bucket = storage_client.bucket("ceat-ai-media")
            # bucket_name = "ceat-ai-media"
            # current_file = os.path.abspath(__file__)
            # api_dir = os.path.dirname(os.path.dirname(os.path.dirname(current_file)))

            # logo_path = api_dir+"/CEAT-logo.png"
            
            # for gcs_uri in generated_uris:
            #     try:
                    
            #         for i, uri in enumerate(generated_uris):
                        
            #             # Input: GCS URI
            #             # uri = "gs://ceat-ai-media/generated_images/1760065828541/sample_1.png"
            #             # logo_path = "logo.png"

            #             # 1️⃣ Extract blob path from gs://
            #             blob_path = uri.replace(f"gs://{bucket_name}/", "")
            #             filename = os.path.basename(blob_path)
            #             print(f"Detected blob path: {blob_path}")

            #             # 2️⃣ Download image from GCS
            #             blob = bucket.blob(blob_path)
            #             image_bytes = blob.download_as_bytes()
            #             background = Image.open(BytesIO(image_bytes)).convert("RGBA")

            #             # 3️⃣ Load and resize logo
            #             logo = Image.open(logo_path).convert("RGBA")
            #             logo_width = int(background.width * 0.15)
            #             logo_height = int(logo_width * (logo.height / logo.width))
            #             logo = logo.resize((logo_width, logo_height))

            #             # 4️⃣ Paste logo (top-right)
            #             position = (background.width - logo.width - 20, 20)
            #             background.paste(logo, position, mask=logo)

            #             # 5️⃣ Save temporarily
            #             temp_path = f"/tmp/{filename}"
            #             background.save(temp_path, format="PNG")
            #             print("File save successfull in temp path :", temp_path)

            #             # 6️⃣ Upload back to SAME location (overwrite)
            #             blob.upload_from_filename(temp_path)
            #             # blob.make_public()  # Optional: make it public again if needed

            #             print(f"✅ Successfully replaced image at: {blob.public_url}")

            #         # Replace local list with updated URLs
            #         # generated_uris = updated_uris
            #     except Exception as e:
            #         print(f"Failed to generate URL for {gcs_uri}: {e}")
            #         # Add the original URI as fallback
                    
    
            
            # Convert GCS URIs to signed URLs for frontend access
            try:
                signed_urls = generate_signed_urls(generated_uris, expiration_hours=24)
                print(f"Generated {len(signed_urls)} signed URLs")
            except Exception as e:
                print(f"Warning: Failed to generate signed URLs: {e}")
                # Fallback to original URIs if signed URL generation fails
                signed_urls = generated_uris
            
            # Create filter summary for response
            applied_filters = []
            if content_type and content_type != "none":
                applied_filters.append(f"Content: {content_type}")
            if color_tone and color_tone != "none":
                applied_filters.append(f"Color: {color_tone}")
            if lighting and lighting != "none":
                applied_filters.append(f"Lighting: {lighting}")
            if composition and composition != "none":
                applied_filters.append(f"Composition: {composition}")
            
            filter_summary = f" with filters ({', '.join(applied_filters)})" if applied_filters else ""
            

            
            end_time = time.time()
            execution_time = end_time - start_time

            # Save to Firestore
            try:
                item = MediaItem(
                    user_email=None,  # Could be extracted from request headers or auth
                    timestamp=datetime.datetime.now(datetime.timezone.utc),
                    prompt=enhanced_prompt,  # The final enhanced prompt used
                    original_prompt=prompt,  # The original user prompt
                    rewritten_prompt=enhanced_prompt,
                    model=cfg.MODEL_IMAGEN4_FAST,
                    mime_type="image/png",  # Imagen typically generates PNG
                    generation_time=execution_time,
                    error_message=None,  # No error since generation was successful
                    gcs_uris=generated_uris,
                    aspect=ratio,
                    negative_prompt=negative_prompt,
                    num_images=int(num_images),
                    seed=None,  # Imagen doesn't expose seed control
                    critique=None,  # Could be added later with Gemini analysis
                    modifiers=applied_filters,  # Store the applied filters
                    enhanced_prompt_used=True  # Brand guidelines were applied
                )
                add_media_item_to_firestore(item)
                print(f"Successfully saved media item to Firestore with {len(generated_uris)} images")
            except Exception as firestore_error:
                print(f"Warning: Failed to save to Firestore: {firestore_error}")
                # Don't fail the request if Firestore save fails




            # Return the signed URLs that can be accessed by the frontend
            return jsonify({
                "success": True,
                "images": signed_urls,
                "message": f"Successfully generated {len(generated_uris)} images using Google Imagen with CEAT brand guidelines{filter_summary}",
                "requestId": f"img_{random.randint(10000, 99999)}",
                "model_used": cfg.MODEL_IMAGEN4_FAST,
                "enhanced_prompt": enhanced_prompt,
                "brand_guidelines_applied": True,
                "filters_applied": applied_filters,
                "expires_in_hours": 24
            })
            
        except GenerationError as ge:
            print(f"Generation error: {ge}")
            return jsonify({
                "success": False,
                "error": f"Image generation failed: {str(ge)}",
                "code": "GENERATION_ERROR"
            }), 500
            
        except Exception as model_error:
            print(f"Model error: {model_error}")
            print(f"Traceback: {traceback.format_exc()}")
            return jsonify({
                "success": False,
                "error": "Image generation service temporarily unavailable. Please try again.",
                "code": "MODEL_ERROR"
            }), 503
        
    except Exception as e:
        print(f"Unexpected error: {e}")
        print(f"Traceback: {traceback.format_exc()}")
        return jsonify({
            "success": False,
            "error": f"Internal server error: {str(e)}",
            "code": "INTERNAL_ERROR"
        }), 500


@image_bp.route('/image/edit', methods=['OPTIONS'])
def edit_image_options():
    """Handle preflight OPTIONS requests for CORS"""
    return '', 200


@image_bp.route('/image/edit', methods=['POST'])
@require_auth
def edit_image_endpoint():
    """
    Edit an uploaded image using Google Imagen model based on the provided prompt and parameters.
    Supports all filters from edit-page.tsx: editMode, maskMode, and numImages.
    """
    try:
        # Check if file is present in the request
        if 'image' not in request.files:
            return jsonify({
                "success": False,
                "error": "No image file provided",
                "code": "INVALID_REQUEST"
            }), 400
        
        file = request.files['image']
        
        # Check if file is selected
        if file.filename == '':
            return jsonify({
                "success": False,
                "error": "No image file selected",
                "code": "INVALID_REQUEST"
            }), 400
        
        # Get form data for edit parameters (all filters from edit-page.tsx)
        prompt = request.form.get('prompt', '').strip()
        edit_mode = request.form.get('editMode', 'EDIT_MODE_INPAINT_INSERTION')
        mask_mode = request.form.get('maskMode', 'foreground')
        num_images = int(request.form.get('numImages', 2))
        
        # Validate required fields
        if not prompt:
            return jsonify({
                "success": False,
                "error": "Prompt is required",
                "code": "INVALID_REQUEST"
            }), 400
        
        # Validate edit mode (all modes from edit-page.tsx)
        valid_edit_modes = [
            "EDIT_MODE_INPAINT_INSERTION",  # Insert - Add a new object
            "EDIT_MODE_INPAINT_REMOVAL",    # Remove - Erase selected object(s)
            "EDIT_MODE_BGSWAP",             # Product showcase / Change the background
            "EDIT_MODE_OUTPAINT"            # Outpainting - Extend the image
        ]
        if edit_mode not in valid_edit_modes:
            return jsonify({
                "success": False,
                "error": f"Invalid edit mode. Must be one of: {', '.join(valid_edit_modes)}",
                "code": "INVALID_EDIT_MODE"
            }), 400
        
        # Validate and map mask mode (all modes from edit-page.tsx)
        mask_mode_mapping = {
            "foreground": "MASK_MODE_FOREGROUND",
            "background": "MASK_MODE_BACKGROUND", 
            "semantic": "MASK_MODE_SEMANTIC",
            "prompt": "MASK_MODE_SEMANTIC"  # Use semantic for prompt-based masking
        }
        
        if mask_mode not in mask_mode_mapping:
            return jsonify({
                "success": False,
                "error": f"Invalid mask mode. Must be one of: {', '.join(mask_mode_mapping.keys())}",
                "code": "INVALID_MASK_MODE"
            }), 400
        
        # Map to the API expected format
        api_mask_mode = mask_mode_mapping[mask_mode]
        
        # Validate number of images (from edit-page.tsx: 1-4 images)
        if num_images < 1 or num_images > 4:
            return jsonify({
                "success": False,
                "error": "Number of images must be between 1 and 4",
                "code": "INVALID_NUM_IMAGES"
            }), 400
        
        # Process the uploaded image file
        try:
            # Read the uploaded file contents
            file_contents = file.read()
            if len(file_contents) == 0:
                return jsonify({
                    "success": False,
                    "error": "Empty image file",
                    "code": "INVALID_IMAGE"
                }), 400
            
            # Get file info
            file_name = file.filename or "uploaded_image.jpg"
            mime_type = file.content_type or "image/jpeg"
            
            print(f"Processing file: {file_name}, size: {len(file_contents)}, type: {mime_type}")
            
            # For image editing, we work directly with the file bytes
            image_bytes = file_contents
            
            print(f"Successfully prepared {len(image_bytes)} bytes for image editing")
            
        except Exception as e:
            print(f"Error processing uploaded file: {e}")
            return jsonify({
                "success": False,
                "error": f"Failed to process image file: {str(e)}",
                "code": "INVALID_IMAGE"
            }), 400
        
        # Get configuration
        cfg = Default()
        
        # Enhance prompt with brand guidelines for editing
        # brand_context = load_brand_guidelines()
        
        # if brand_context:
        #     enhanced_prompt = f"{prompt}. {brand_context} Maintain CEAT brand colors (blue #0055aa and orange #f5822d) where appropriate. Professional automotive editing with clean, modern aesthetic."
        # else:
            # enhanced_prompt = prompt
        enhanced_prompt = prompt
        
        print(f"Editing image with Imagen model...")
        print(f"Enhanced prompt: {enhanced_prompt}")
        print(f"Edit mode: {edit_mode}")
        print(f"Mask mode: {mask_mode} -> {api_mask_mode}")
        print(f"Number of images: {num_images}")
        print(f"Model: {cfg.MODEL_IMAGEN_EDITING}")

        # image_part = Part.from_bytes(
        #     data=image_bytes, 
        #     mime_type=mime_type # Or 'image/png' etc.
        # )
        
        # Use the Imagen model to edit the image
        try:
            edited_uris = edit_image(
                model=cfg.MODEL_IMAGEN_EDITING,  # Use fast model for better performance
                prompt=enhanced_prompt,
                edit_mode=edit_mode,
                mask_mode=api_mask_mode,  # Use the mapped API format
                reference_image_bytes=image_bytes,
                number_of_images=num_images,
                mime_type=mime_type,
            )
            
            if not edited_uris:
                return jsonify({
                    "success": False,
                    "error": "No edited images were generated. Please try again with a different prompt or image.",
                    "code": "GENERATION_FAILED"
                }), 500
            
            print(f"Successfully edited image, generated {len(edited_uris)} images")
            
            # Convert GCS URIs to signed URLs for frontend access
            try:
                signed_urls = generate_signed_urls(edited_uris, expiration_hours=24)
                print(f"Generated {len(signed_urls)} signed URLs")
            except Exception as e:
                print(f"Warning: Failed to generate signed URLs: {e}")
                # Fallback to original URIs if signed URL generation fails
                signed_urls = edited_uris
            
            # Save to Firestore
            try:
                item = MediaItem(
                    user_email=None,  # Could be extracted from request headers or auth
                    timestamp=datetime.datetime.now(datetime.timezone.utc),
                    prompt=enhanced_prompt,  # The final enhanced prompt used
                    original_prompt=prompt,  # The original user prompt
                    rewritten_prompt=enhanced_prompt,
                    model=cfg.MODEL_IMAGEN_EDITING,
                    mime_type="image/png",  # Edited images are typically PNG
                    generation_time=None,  # Could add timing if needed
                    error_message=None,  # No error since editing was successful
                    gcs_uris=edited_uris,
                    aspect=None,  # Aspect ratio preserved from original
                    negative_prompt=None,  # Not used in editing
                    num_images=int(num_images),
                    seed=None,  # Not applicable for editing
                    critique=None,  # Could be added later
                    modifiers=[f"edit_mode:{edit_mode}", f"mask_mode:{mask_mode}"],  # Store edit parameters
                    enhanced_prompt_used=bool(brand_context),  # Brand guidelines applied
                    media_type="image_edit"  # Distinguish from generation
                )
                add_media_item_to_firestore(item)
                print(f"Successfully saved edited image to Firestore with {len(edited_uris)} variations")
            except Exception as firestore_error:
                print(f"Warning: Failed to save to Firestore: {firestore_error}")
                # Don't fail the request if Firestore save fails
            
            # Return the signed URLs that can be accessed by the frontend
            return jsonify({
                "success": True,
                "images": signed_urls,
                "message": f"Successfully edited image and generated {len(edited_uris)} variations using Google Imagen with CEAT brand guidelines",
                "requestId": f"edit_{random.randint(10000, 99999)}",
                "model_used": cfg.MODEL_IMAGEN4_FAST,
                "enhanced_prompt": enhanced_prompt,
                "edit_mode": edit_mode,
                "mask_mode": mask_mode,  # Return the original frontend format
                "brand_guidelines_applied": bool(brand_context),
                "expires_in_hours": 24
            })
            
        except GenerationError as ge:
            print(f"Generation error: {ge}")
            return jsonify({
                "success": False,
                "error": f"Image editing failed: {str(ge)}",
                "code": "GENERATION_ERROR"
            }), 500
            
        except Exception as model_error:
            print(f"Model error: {model_error}")
            print(f"Traceback: {traceback.format_exc()}")
            return jsonify({
                "success": False,
                "error": "Image editing service temporarily unavailable. Please try again.",
                "code": "MODEL_ERROR"
            }), 503
        
    except Exception as e:
        print(f"Unexpected error in edit endpoint: {e}")
        print(f"Traceback: {traceback.format_exc()}")
        return jsonify({
            "success": False,
            "error": f"Internal server error: {str(e)}",
            "code": "INTERNAL_ERROR"
        }), 500