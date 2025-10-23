import os
import subprocess
import tempfile
import shlex
from typing import List


def extract_last_frame(input_video_path: str, output_image_path: str) -> str:
    """
    Extracts the very last frame of a video and saves it as a JPEG image.
    """
    print(f" Extracting last frame from {input_video_path}...")
    command = [
        "ffmpeg", "-y",
        "-sseof", "-0.1",
        "-i", input_video_path,
        "-vsync", "vfr",       
        "-frames:v", "1",       
        "-q:v", "2",
        output_image_path
    ]
    run_ffmpeg_command(command)
    print(f"Last frame saved to {output_image_path}")
    return output_image_path

def run_ffmpeg_command(cmd: list):
    """Runs an FFmpeg command and raises an error if it fails."""
    try:
        print("Running FFmpeg command:", shlex.join(cmd))
        subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"FFmpeg failed.\nSTDERR:\n{e.stderr.decode()}")

def get_video_duration(path: str) -> float:
    """Gets the duration of a video file using ffprobe."""
    cmd = ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", path]
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
    return float(result.stdout.decode().strip())

def stitch_videos(video_paths: List[str], output_path: str) -> str:
    """Stitches videos together, with a robust re-encode fallback."""
    if not video_paths: raise ValueError("No video paths provided.")
    if len(video_paths) == 1:
        run_ffmpeg_command(["ffmpeg", "-y", "-i", video_paths[0], "-c", "copy", "-movflags", "+faststart", output_path])
        return output_path
    list_file_path = None
    try:
        with tempfile.NamedTemporaryFile('w', delete=False, suffix='.txt') as list_file:
            list_file_path = list_file.name
            for path in video_paths: list_file.write(f"file '{os.path.abspath(path)}'\n")
        run_ffmpeg_command(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", list_file_path, "-c", "copy", "-movflags", "+faststart", output_path])
    except RuntimeError:
        print("Stream copy failed. Falling back to robust re-encode with concat filter...")
        inputs = [arg for path in video_paths for arg in ["-i", path]]
        stream_specifiers = "".join([f"[{i}:v:0][{i}:a:0]" for i in range(len(video_paths))])
        filter_complex = f"{stream_specifiers}concat=n={len(video_paths)}:v=1:a=1[v][a]"
        run_ffmpeg_command(["ffmpeg", "-y", *inputs, "-filter_complex", filter_complex, "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", output_path])
    finally:
        if list_file_path and os.path.exists(list_file_path): os.remove(list_file_path)
    return output_path

def stitch_with_transitions(video_paths: List[str], output_path: str, transition_duration: float = 1.0) -> str:
    """Stitches videos together with a crossfade transition."""
    if len(video_paths) <= 1: return stitch_videos(video_paths, output_path)
    inputs, filter_complex_parts = [], []
    durations = [get_video_duration(p) for p in video_paths]
    for i, path in enumerate(video_paths):
        inputs.extend(["-i", path])
        filter_complex_parts.append(f"[{i}:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,setpts=PTS-STARTPTS,fps=30[v{i}]")
        filter_complex_parts.append(f"[{i}:a]aresample=async=1:min_hard_comp=0.100000:first_pts=0,asetpts=PTS-STARTPTS[a{i}]")
    last_v, last_a, timeline_duration = "[v0]", "[a0]", durations[0]
    for i in range(1, len(video_paths)):
        v_in, a_in, v_out, a_out = f"[v{i}]", f"[a{i}]", f"[vout{i}]", f"[aout{i}]"
        offset = timeline_duration - transition_duration
        filter_complex_parts.append(f"{last_v}{v_in}xfade=transition=fade:duration={transition_duration}:offset={offset}{v_out}")
        filter_complex_parts.append(f"{last_a}{a_in}acrossfade=d={transition_duration}{a_out}")
        last_v, last_a = v_out, a_out
        timeline_duration += durations[i] - transition_duration
    filter_complex = ";".join(filter_complex_parts)
    run_ffmpeg_command(["ffmpeg", "-y", *inputs, "-vsync", "cfr", "-filter_complex", filter_complex, "-map", last_v, "-map", last_a, "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", output_path])
    return output_path

def finalize_video(input_video_path: str, logo_path: str, end_card_path: str, output_path: str, **kwargs) -> str:
    """Adds a corner logo watermark and a branded end card to a video."""
    if not os.path.exists(logo_path): raise FileNotFoundError(f"Logo file not found: {logo_path}")
    if not os.path.exists(end_card_path): raise FileNotFoundError(f"End card file not found: {end_card_path}")
    with tempfile.TemporaryDirectory() as tmp_dir:
        video_with_logo_path = os.path.join(tmp_dir, "video_with_logo.mp4")
        run_ffmpeg_command(["ffmpeg", "-y", "-i", input_video_path, "-i", logo_path, "-filter_complex", "[1:v]scale=200:-1[logo];[0:v][logo]overlay=main_w-overlay_w-20:20", "-c:a", "copy", video_with_logo_path])
        end_card_video_path = os.path.join(tmp_dir, "end_card_video.mp4")
        run_ffmpeg_command(["ffmpeg", "-y", "-loop", "1", "-i", end_card_path, "-f", "lavfi", "-i", "anullsrc=cl=stereo:r=44100", "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=#0055aa", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-t", str(kwargs.get("end_card_duration", 3)), "-r", "30", end_card_video_path])
        main_duration = get_video_duration(video_with_logo_path)
        transition_duration = float(kwargs.get("transition_duration", 0.5))
        offset = main_duration - transition_duration
        filter_complex = f"[0:v]setpts=PTS-STARTPTS,fps=30[v0];[0:a]asetpts=PTS-STARTPTS[a0];[1:v]setpts=PTS-STARTPTS,fps=30[v1];[1:a]asetpts=PTS-STARTPTS[a1];[v0][v1]xfade=transition=fade:duration={transition_duration}:offset={offset}[vout];[a0][a1]acrossfade=d={transition_duration}[aout]"
        run_ffmpeg_command(["ffmpeg", "-y", "-i", video_with_logo_path, "-i", end_card_video_path, "-filter_complex", filter_complex, "-map", "[vout]", "-map", "[aout]", "-movflags", "+faststart", output_path])
    return output_path

def recombine_audio(original_video: str, silent_video: str, output_video: str):
    """
    Takes the video from `silent_video` and the audio from `original_video`
    and combines them into a new `output_video`.
    """
    print("Recombining video with original audio...")
    cmd = ["ffmpeg", "-y", "-i", silent_video, "-i", original_video, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", output_video]
    run_ffmpeg_command(cmd)
    print(f"Final video with audio saved: {output_video}")


def _generate_thumbnail(local_video_path: str, local_thumbnail_path: str):
    """
    Generates a thumbnail image from a local video using ffmpeg.
    """
    os.makedirs(os.path.dirname(local_thumbnail_path), exist_ok=True)
    try:
        subprocess.run([
            "ffmpeg",
            "-y",
            "-i", local_video_path,
            "-ss", "00:00:01",   # capture at 1s
            "-vframes", "1",
            local_thumbnail_path
        ], check=True)
        print(f"Generated thumbnail at {local_thumbnail_path}")
        return local_thumbnail_path
    except subprocess.CalledProcessError as e:
        print(f"FFmpeg thumbnail generation failed: {e}")
        return None   