import cv2
import numpy as np
import os
from ultralytics import YOLO
import traceback

_yolo_model = None
def get_yolo_model():
    """Loads the YOLO model from a local file, using a singleton pattern."""
    global _yolo_model
    if _yolo_model is None:
        # Assumes yolov8n.pt is in the root of the project (/api in Docker)
        model_path = os.path.join(os.getcwd(), 'yolov8n.pt')
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"YOLO model not found at {model_path}. Make sure it's in your project root.")
        print("Loading YOLO model from local file...")
        _yolo_model = YOLO(model_path)
        print("YOLO model loaded successfully.")
    return _yolo_model

def apply_logo_tracking_to_video(
    input_video_path: str, 
    transparent_logo_path: str, 
    reference_logo_path: str, 
    output_video_path: str
) -> str:
    """
    Applies realistic 3D perspective logo tracking to a video using YOLOv8 tracking
    and OpenCV perspective warp. The output video will be SILENT.
    """
    if not os.path.exists(transparent_logo_path):
        raise FileNotFoundError(f"Transparent logo file not found: {transparent_logo_path}")
    if not os.path.exists(reference_logo_path):
        raise FileNotFoundError(f"Reference logo file for tracking not found: {reference_logo_path}")

    video_cap = cv2.VideoCapture(input_video_path)
    logo_image_bgra = cv2.imread(transparent_logo_path, cv2.IMREAD_UNCHANGED)
    if logo_image_bgra.shape[2] != 4:
        raise ValueError("The 'transparent_logo_path' must point to a PNG with a transparent alpha channel.")

    logo_bgr, logo_alpha = logo_image_bgra[:, :, :3], logo_image_bgra[:, :, 3]
    logo_ref_gray = cv2.imread(reference_logo_path, cv2.IMREAD_GRAYSCALE)

    # Initialize feature detector for perspective warp
    orb = cv2.ORB_create(nfeatures=2000)
    kp_ref, des_ref = orb.detectAndCompute(logo_ref_gray, None)
    bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)

    # Setup video writer
    width = int(video_cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(video_cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = video_cap.get(cv2.CAP_PROP_FPS)
    writer = cv2.VideoWriter(output_video_path, cv2.VideoWriter_fourcc(*'mp4v'), fps, (width, height))

    frame_count = 0
    yolo_model = get_yolo_model()

    # Use the efficient YOLO track method in stream mode for memory efficiency
    results_generator = yolo_model.track(input_video_path, persist=True, classes=[2, 7], stream=True, verbose=False)

    for results in results_generator:
        frame = results.orig_img
        frame_count += 1

        # Check if there are any tracked objects in the current frame
        if results.boxes.id is not None:
            # Get the bounding box of the first tracked object
            box = results.boxes.xyxy[0].cpu().numpy()
            x1, y1, x2, y2 = map(int, box)
            w, h = x2 - x1, y2 - y1

            if w > 0 and h > 0:
                try:
                    # --- Advanced Perspective Warp Logic ---
                    roi_gray = cv2.cvtColor(frame[y1:y2, x1:x2], cv2.COLOR_BGR2GRAY)
                    kp_frame, des_frame = orb.detectAndCompute(roi_gray, None)
                    
                    if des_frame is not None and len(des_frame) > 20:
                        matches = sorted(bf.match(des_ref, des_frame), key=lambda x: x.distance)
                        
                        if len(matches) > 10:
                            src_pts = np.float32([kp_ref[m.queryIdx].pt for m in matches]).reshape(-1, 1, 2)
                            dst_pts = np.float32([kp_frame[m.trainIdx].pt for m in matches]).reshape(-1, 1, 2)
                            matrix, _ = cv2.findHomography(src_pts, dst_pts, cv2.RANSAC, 5.0)

                            if matrix is not None:
                                # Warp color and alpha channels separately
                                warped_bgr = cv2.warpPerspective(logo_bgr, matrix, (w, h))
                                warped_alpha = cv2.warpPerspective(logo_alpha, matrix, (w, h))
                                
                                # Composite the warped logo onto the frame
                                roi = frame[y1:y2, x1:x2]
                                inv_alpha_mask = cv2.bitwise_not(warped_alpha)
                                roi_bg = cv2.bitwise_and(roi, roi, mask=inv_alpha_mask)
                                logo_fg = cv2.bitwise_and(warped_bgr, warped_bgr, mask=warped_alpha)
                                frame[y1:y2, x1:x2] = cv2.add(roi_bg, logo_fg)
                except Exception:
                    print(f"Warning: Could not compute perspective for frame {frame_count}.")
                    traceback.print_exc(limit=1)
        
        writer.write(frame)

    video_cap.release()
    writer.release()
    print(f"Silent motion tracking video saved to {output_video_path}")
    return output_video_path