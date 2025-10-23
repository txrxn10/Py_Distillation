import os
import uuid
from flask import current_app
from datetime import datetime, timezone
from app.services.gcs_service import download_from_gcs, upload_to_gcs
from app.utils.stitch_videos import _generate_thumbnail

def create_video_job_document(scenes: list, parameters: dict, image: dict = None,model_name=None):
    """
    Creates the initial job document in Firestore when a video generation is requested.

    This function maps the incoming request data to a structure similar to the reference 'MediaItem'.

    Args:
        scenes (list): The array of scene prompts and durations.
        parameters (dict): The global settings for the generation (e.g., aspectRatio).
        image (dict, optional): The initial reference image for image-to-video.

    Returns:
        tuple: A tuple containing the job_id (str) and the Firestore document reference (DocumentReference).
    """
    firestore_client = current_app.firestore_client
    job_id = str(uuid.uuid4()).replace("-", "")
    jobs_collection_name = current_app.config['GENMEDIA_COLLECTION_NAME']
    job_ref = firestore_client.collection(jobs_collection_name).document(job_id)
    
    # Calculate total duration from all scenes
    total_duration = sum(scene.get('duration', 0) for scene in scenes)
    
    # Combine all prompts into a single string for the main 'prompt' field
    full_prompt = " | ".join([scene.get('prompt', '') for scene in scenes])
     
    initial_job_data = {
        # Core Metadata
        "id": job_id,
        "media_type": "video",
        "status": "PENDING",
        "timestamp": datetime.now(timezone.utc),
        "model": model_name,
        
        # Prompt & Input Data
        "prompt": full_prompt,
        "original_prompt":full_prompt,
        "veo_prompt":full_prompt,
        "scenes": scenes, # Store the detailed scene-by-scene breakdown
        "negative_prompt": parameters.get('negativePrompt'),
        "reference_image": image.get('gcsUri') if image else None,
        

        # Parameters
        "aspect": parameters.get('aspectRatio'),
        "resolution": parameters.get('resolution'),
        "duration": total_duration,
        "parameters": parameters, # Store all other parameters for reference
        "mime_type":"video/mp4",
        
        # Fields to be populated on completion/failure
        "completed_at": None,
        "error_message": None,
        "generation_time": None,
        "final_video_url": None,  
        "clip_uris": [],          
        
    }
    
    job_ref.set(initial_job_data)
    print(f"Firestore job document created in '{jobs_collection_name}' with ID: {job_id}")
    return job_id, job_ref

def update_video_job_document(job_ref, status: str, start_time, result: dict = None, error: Exception = None):
    """
    Updates the Firestore job document with the final status and results.

    Args:
        job_ref (DocumentReference): The reference to the Firestore document.
        status (str): The final status, either 'COMPLETED' or 'FAILED'.
        start_time (datetime): The time the job started, for calculating duration.
        result (dict, optional): The result dictionary from the processing logic.
        error (Exception, optional): The exception object if the job failed.
    """
    end_time = datetime.now(timezone.utc)
    execution_time = (end_time - start_time).total_seconds()
    
    update_data = {
        "status": status,
        "completed_at": end_time,
        "generation_time": execution_time
    }

    if status == 'COMPLETED' and result:
        final_video_info = result.get('final_video', {})
        final_video_url = final_video_info.get("public_url")

        # Convert public URL to gs:// format for signing
        if final_video_url and final_video_url.startswith("https://storage.googleapis.com/"):
            gs_uri = final_video_url.replace(
                "https://storage.googleapis.com/",
                "gs://"
            )
        else:
            gs_uri = final_video_url 

        # Store in Firestore
        update_data["gcsuri"] = gs_uri  # Ensures consistency with MediaItem
        update_data["gcs_uris"] = [clip['gs_uri'] for clip in result.get('clips', [])]

        # --- Generate thumbnail from final video ---
        try:
            if gs_uri and gs_uri.startswith("gs://"):
                print(f"Generating thumbnail from {gs_uri}")

                local_video_path = f"/tmp/{job_ref.id}_video.mp4"
                local_thumb_path = f"/tmp/{job_ref.id}_thumbnail.jpg"

                # Download video from GCS
                download_from_gcs(gs_uri, local_video_path)

                # Generate thumbnail
                _generate_thumbnail(local_video_path, local_thumb_path)

                # Upload thumbnail to GCS
                object_name = f"thumbnails/{job_ref.id}/final.jpg"
                bucket_name = current_app.config['BUCKET_NAME']
                uploaded = upload_to_gcs(local_thumb_path, bucket_name, object_name, content_type="image/jpeg")

                # Save thumbnail GCS URI
                update_data["thumbnail_uri"] = uploaded["gs_uri"]

                # Clean up temp files
                if os.path.exists(local_video_path):
                    os.remove(local_video_path)
                if os.path.exists(local_thumb_path):
                    os.remove(local_thumb_path)
            else:
                print(f"Skipping thumbnail generation, invalid URI: {gs_uri}")

        except Exception as e:
            print(f"Thumbnail generation failed for {job_ref.id}: {e}")

    elif status == 'FAILED' and error:
        update_data["error_message"] = str(error)

    job_ref.update(update_data)
    print(f" Firestore job {job_ref.id} updated with status: {status}")