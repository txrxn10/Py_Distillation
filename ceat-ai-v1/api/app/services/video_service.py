import os
import uuid
import tempfile
import cv2
import numpy as np
from datetime import datetime, timezone
from typing import List, Dict, Any
from flask import current_app
from app.utils.stitch_videos import stitch_videos, stitch_with_transitions, finalize_video, extract_last_frame, recombine_audio
from app.utils.motion_tracker import apply_logo_tracking_to_video
from . import gcs_service
from . import firestore_service

# ------------------------------------------------------------
#                MULTI-FRAME EXTRACTION CLASS
# ------------------------------------------------------------

class MultiFrameExtractor:
    def __init__(self):
        self.quality_weights = {
            'sharpness': 0.4,
            'contrast': 0.3,
            'brightness': 0.2,
            'composition': 0.1
        }
    
    def extract_best_frames(self, video_path: str, num_frames: int = 3, scene_duration: int = 8) -> List[Dict[str, Any]]:
        """
        Extract multiple high-quality frames from the end of a video for continuity.
        """
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Video file not found: {video_path}")
        
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Cannot open video file: {video_path}")
        
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        
        if total_frames == 0 or fps == 0:
            cap.release()
            raise ValueError("Invalid video file - cannot read frame count or FPS")
        
        # Calculate frames to extract (last 3 seconds)
        end_frame = total_frames - 1
        start_extract_frame = max(0, end_frame - int(3 * fps))
        
        print(f"Video: {total_frames} frames, {fps} FPS")
        print(f"Extracting frames from {start_extract_frame} to {end_frame}")
        
        # Extract frames at intervals from the last 3 seconds
        frame_interval = max(1, (end_frame - start_extract_frame) // (num_frames * 2))
        extraction_frames = range(start_extract_frame, end_frame, frame_interval)
        
        scored_frames = []
        for frame_idx in extraction_frames[:num_frames * 3]:  # Get more frames than needed
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
            ret, frame = cap.read()
            
            if ret and frame is not None:
                quality_score = self._calculate_frame_quality(frame)
                timestamp = frame_idx / fps
                
                scored_frames.append({
                    'frame': frame.copy(),
                    'score': quality_score,
                    'index': frame_idx,
                    'timestamp': timestamp,
                    'file_path': None
                })
        
        cap.release()
        
        if not scored_frames:
            raise ValueError("No frames could be extracted from the video")
        
        # Sort by quality and return best frames
        scored_frames.sort(key=lambda x: x['score'], reverse=True)
        best_frames = scored_frames[:num_frames]
        
        #print(f"Extracted {len(best_frames)} frames with scores: {[f['score']:.2f for f in best_frames]}")
        return best_frames
    
    def _calculate_frame_quality(self, frame) -> float:
        """
        Calculate frame quality based on multiple metrics.
        """
        if frame is None:
            return 0.0
        
        # Convert to grayscale for analysis
        if len(frame.shape) == 3:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        else:
            gray = frame
        
        height, width = gray.shape
        
        # 1. Sharpness (Laplacian variance)
        try:
            sharpness = cv2.Laplacian(gray, cv2.CV_64F).var()
            # Normalize sharpness (typical values 0-1000+)
            sharpness_score = min(sharpness / 500.0, 1.0)
        except:
            sharpness_score = 0.1
        
        # 2. Contrast (standard deviation)
        try:
            contrast = np.std(gray)
            contrast_score = min(contrast / 80.0, 1.0)  # Normalize
        except:
            contrast_score = 0.1
        
        # 3. Brightness (avoid extremes)
        try:
            brightness = np.mean(gray)
            # Ideal brightness around middle gray (127)
            brightness_score = 1.0 - abs(brightness - 127) / 127
            brightness_score = max(0.1, brightness_score)  # Ensure minimum score
        except:
            brightness_score = 0.1
        
        # 4. Composition (simplified - center weighted)
        try:
            center_region = gray[height//4:3*height//4, width//4:3*width//4]
            center_brightness = np.mean(center_region)
            composition_score = min(center_brightness / 255.0, 1.0)
        except:
            composition_score = 0.1
        
        # Combined weighted score
        total_score = (
            sharpness_score * self.quality_weights['sharpness'] +
            contrast_score * self.quality_weights['contrast'] +
            brightness_score * self.quality_weights['brightness'] +
            composition_score * self.quality_weights['composition']
        )
        
        return total_score
    
    def select_best_continuity_frame(self, frames: List[Dict], previous_frame_path: str = None) -> Dict:
        """
        Select the best frame for continuity, optionally considering previous frame.
        """
        if not frames:
            raise ValueError("No frames provided for selection")
        
        # If no previous frame, just return the highest quality frame
        if not previous_frame_path or not os.path.exists(previous_frame_path):
            return max(frames, key=lambda x: x['score'])
        
        # Load previous frame for comparison
        try:
            prev_frame = cv2.imread(previous_frame_path)
            if prev_frame is None:
                return max(frames, key=lambda x: x['score'])
            
            # Calculate similarity scores (simplified)
            for frame_data in frames:
                similarity = self._calculate_frame_similarity(prev_frame, frame_data['frame'])
                frame_data['continuity_score'] = similarity
                frame_data['combined_score'] = (frame_data['score'] * 0.6 + similarity * 0.4)
            
            # Return frame with best combined score
            best_frame = max(frames, key=lambda x: x['combined_score'])
            print(f"Selected frame with continuity score: {best_frame['combined_score']:.2f} (quality: {best_frame['score']:.2f}, similarity: {best_frame['continuity_score']:.2f})")
            return best_frame
            
        except Exception as e:
            print(f"Error in continuity comparison: {e}")
            return max(frames, key=lambda x: x['score'])
    
    def _calculate_frame_similarity(self, frame1, frame2) -> float:
        """
        Calculate similarity between two frames (simplified version).
        """
        try:
            # Resize frames to same dimensions for comparison
            height, width = min(frame1.shape[0], frame2.shape[0]), min(frame1.shape[1], frame2.shape[1])
            frame1_resized = cv2.resize(frame1, (width, height))
            frame2_resized = cv2.resize(frame2, (width, height))
            
            # Convert to grayscale
            gray1 = cv2.cvtColor(frame1_resized, cv2.COLOR_BGR2GRAY)
            gray2 = cv2.cvtColor(frame2_resized, cv2.COLOR_BGR2GRAY)
            
            # Calculate structural similarity (simplified)
            diff = cv2.absdiff(gray1, gray2)
            similarity = 1.0 - (np.mean(diff) / 255.0)
            
            return max(0.0, similarity)
        except:
            return 0.5  # Default medium similarity on error

# ------------------------------------------------------------
#                VIDEO GENERATION ORCHESTRATION
# ------------------------------------------------------------

def generate_full_video(scenes: list, parameters: dict, image: dict = None, stitch: bool = True, transitions: bool = True, **kwargs) -> dict:
    """
    Orchestrates the entire video generation process from a storyboard, saving the job to Firestore.
    Uses multi-frame extraction for better continuity between scenes.
    """
    # --- Step 1: Create the job document in Firestore ---
    vertex_client = current_app.vertex_client
    model_name = vertex_client.veo_model_name 
    start_time = datetime.now(timezone.utc)
    job_id, job_ref = firestore_service.create_video_job_document(scenes, parameters, image, model_name)
    
    try:
        with tempfile.TemporaryDirectory() as tmp_dir:
            folder_id = str(uuid.uuid4()).replace("-", "")
            bucket_name = current_app.config['BUCKET_NAME']
            generated_uris = []
            frame_extractor = MultiFrameExtractor()
            previous_best_frame_path = None

            print(f"Starting 'Multi-Frame Chaining' generation in directory: {tmp_dir}")
            current_input_image = image
           
            if current_input_image and current_input_image.get("gcsUri") and not current_input_image.get("mimeType"):
                print("Initial image is missing mimeType. Fetching from GCS metadata...")
                gcs_uri = current_input_image["gcsUri"]
                
                storage_client = current_app.storage_client
                blob_name = gcs_uri.replace(f"gs://{bucket_name}/", "")
                blob = storage_client.bucket(bucket_name).get_blob(blob_name)
                
                if blob and blob.content_type:
                    current_input_image["mimeType"] = blob.content_type
                    print(f"Detected mimeType from GCS: {current_input_image['mimeType']}")
                else:
                    raise ValueError(f"Could not determine mimeType for GCS object: {gcs_uri}")
            
            # --- Step 2: Sequentially generate each video clip with multi-frame extraction ---
            for idx, scene in enumerate(scenes):
                scene_id, prompt, duration = scene.get("id", idx + 1), scene["prompt"], scene["duration"]
                print(f"Generating Scene {scene_id} ({duration}s)...")
                try:
                    object_name = f"video/{folder_id}/clip_{scene_id}.mp4"
                    output_gcs_uri = f"gs://{bucket_name}/{object_name}"
                    gs_uri = vertex_client.generate_video_clip(
                        prompt=prompt, image=current_input_image,
                        output_gcs_uri=output_gcs_uri, durationSeconds=duration, **parameters
                    )
                    generated_uris.append(gs_uri)
                    
                    # Multi-frame extraction for continuity (except for last scene)
                    if idx < len(scenes) - 1:
                        local_video_path = os.path.join(tmp_dir, f"clip_{scene_id}.mp4")
                        gcs_service.download_from_gcs(gs_uri, local_video_path)
                        
                        # Extract multiple frames and select best for continuity
                        print(f"Extracting multiple frames from Scene {scene_id} for continuity...")
                        candidate_frames = frame_extractor.extract_best_frames(local_video_path, num_frames=3)
                        
                        # Select best frame considering continuity with previous scene
                        best_frame_data = frame_extractor.select_best_continuity_frame(candidate_frames, previous_best_frame_path)
                        
                        # Save the selected frame
                        frame_filename = os.path.join(tmp_dir, f"continuity_frame_{scene_id}.jpg")
                        cv2.imwrite(frame_filename, best_frame_data['frame'])
                        
                        # Upload frame to GCS for next scene
                        frame_blob_name = f"uploads/{folder_id}/continuity_frame_{scene_id}.jpg"
                        upload_info = gcs_service.upload_to_gcs(
                            local_path=frame_filename, bucket_name=bucket_name,
                            object_name=frame_blob_name, content_type="image/jpeg"
                        )
                        
                        current_input_image = {"gcsUri": upload_info["gs_uri"], "mimeType": "image/jpeg"}
                        previous_best_frame_path = frame_filename
                        
                        print(f"Multi-frame continuity: Selected frame at {best_frame_data['timestamp']:.2f}s with score {best_frame_data.get('combined_score', best_frame_data['score']):.2f}")
                        print(f"Next scene will use: {current_input_image['gcsUri']}")
                        
                except Exception as e:
                    print(f"Scene {scene_id} failed, breaking the chain: {e}")
                    break

            if not generated_uris:
                raise RuntimeError("Video generation failed; no clips were created.")

            print(f"{len(generated_uris)} clips generated. Starting post-processing...")
            
            # --- Step 3: Call the post-processing logic INSIDE the same temp directory context ---
            result = _run_processing_logic(
                tmp_dir=tmp_dir,
                job_id=job_id,
                input_uris=generated_uris,
                stitch=stitch,
                transitions=transitions,
                apply_logo_overlay=True,
                apply_end_card=True,
                apply_motion_tracking=kwargs.get("apply_motion_tracking", False),
                upload_to_gcs=True,
            )
            
            # --- Step 4: Update Firestore with the successful result ---
            firestore_service.update_video_job_document(job_ref, 'COMPLETED', start_time, result=result)
            return result

    except Exception as e:
        # --- Step 5: Update Firestore if any part of the process fails ---
        print(f"Job {job_id} failed with a critical error: {e}")
        firestore_service.update_video_job_document(job_ref, 'FAILED', start_time, error=e)
        raise e

# ------------------------------------------------------------
#                  POST-PROCESSING PIPELINE
# ------------------------------------------------------------

def _run_processing_logic(tmp_dir, job_id, input_uris, stitch, transitions, apply_logo_overlay, apply_end_card, apply_motion_tracking, upload_to_gcs):
    """
    Helper containing the core post-processing logic.
    """
    folder_id = str(uuid.uuid4()).replace("-", "")
    bucket_name = current_app.config["BUCKET_NAME"]
    clips_metadata, local_clip_paths = [], []

    print(f"Downloading {len(input_uris)} clips...")
    for idx, uri in enumerate(input_uris):
        local_path = os.path.join(tmp_dir, f"clip_{idx}.mp4")
        gcs_service.download_from_gcs(uri, local_path)
        clips_metadata.append({"id": idx + 1, "gs_uri": uri})
        local_clip_paths.append(local_path)

    video_to_process_path = local_clip_paths[0]
    if stitch and len(local_clip_paths) > 1:
        stitched_path = os.path.join(tmp_dir, "stitched.mp4")
        print("Stitching clips...")
        video_to_process_path = stitch_with_transitions(local_clip_paths, stitched_path) if transitions else stitch_videos(local_clip_paths, stitched_path)

    if apply_logo_overlay or apply_end_card:
        print("Applying logo and end-card...")
        finalized_path = os.path.join(tmp_dir, "final_branded.mp4")
        logo_path = os.path.join(os.getcwd(), "app", "assets", "logo.png")
        end_card_path = os.path.join(os.getcwd(), "app", "assets", "end_card.jpg")
        video_to_process_path = finalize_video(video_to_process_path, logo_path, end_card_path, finalized_path)

    if upload_to_gcs:
        final_gcs_object_name = f"video/{folder_id}/processed_final.mp4"
        final_video_info = gcs_service.upload_to_gcs(video_to_process_path, bucket_name, final_gcs_object_name)
    else:
        final_video_info = {"local_path": video_to_process_path}

    tracked_video_info = None
    if apply_motion_tracking:
        print("Running motion tracking...")
        try:
            video_with_audio_path = video_to_process_path
            tracked_silent_path = os.path.join(tmp_dir, "tracked_silent.mp4")
            tracked_with_audio_path = os.path.join(tmp_dir, "final_tracked_with_audio.mp4")
            
            transparent_logo_path = os.path.join(os.getcwd(), "app", "assets", "logo.png")
            reference_logo_path = os.path.join(os.getcwd(), "app", "assets", "logo_reference.png")
            
            apply_logo_tracking_to_video(video_with_audio_path, transparent_logo_path, reference_logo_path, tracked_silent_path)
            recombine_audio(original_video=video_with_audio_path, silent_video=tracked_silent_path, output_video=tracked_with_audio_path)

            if upload_to_gcs:
                tracked_gcs_object = f"video/{folder_id}/processed_tracked.mp4"
                tracked_video_info = gcs_service.upload_to_gcs(tracked_with_audio_path, bucket_name, tracked_gcs_object)
            else:
                tracked_video_info = {"local_path": tracked_with_audio_path}
        except Exception as e:
            print(f"Motion tracking failed: {e}")

    result = {"clips": clips_metadata, "final_video": final_video_info}
    if tracked_video_info:
        result["tracked_video"] = tracked_video_info
    
    return result

def process_existing_videos(job_id, input_uris, stitch, transitions, apply_logo_overlay, apply_end_card, apply_motion_tracking, upload_to_gcs, keep_local_files=False, **kwargs):
    """
    Main entry point for post-processing. Manages directories and updates the Firestore job.
    """
    try:
        if keep_local_files:
            tmp_dir = tempfile.mkdtemp()
            print(f"--- KEEPING LOCAL FILES --- Output will be saved in: {tmp_dir}")
            result = _run_processing_logic(tmp_dir, job_id, input_uris, stitch, transitions, apply_logo_overlay, apply_end_card, apply_motion_tracking, upload_to_gcs)
            result['output_directory'] = tmp_dir
        else:
            with tempfile.TemporaryDirectory() as tmp_dir:
                result = _run_processing_logic(tmp_dir, job_id, input_uris, stitch, transitions, apply_logo_overlay, apply_end_card, apply_motion_tracking, upload_to_gcs)
        
        return result
    except Exception as e:
        raise e