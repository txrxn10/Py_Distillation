import os
import re
import wave
import contextlib
import subprocess
import shlex

# ---- Optional: Google Cloud TTS ----
# pip install google-cloud-texttospeech
from google.cloud import texttospeech

# ---------------- FFmpeg helper ----------------
def _run(cmd: list):
    print("FFmpeg:", shlex.join(cmd))
    subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

def _wav_duration_seconds(path: str) -> float:
    with contextlib.closing(wave.open(path, 'rb')) as wf:
        frames = wf.getnframes()
        rate = wf.getframerate()
        return frames / float(rate)

# ---------------- SSML helpers ----------------
_CEAT_REGEX = re.compile(r"\b(C[Ee][Aa][Tt])\b")

def ssml_force_ceat(text: str, alias: str = "Seeat") -> str:
    """
    Wrap every 'CEAT/CeAt/ceat' in SSML <sub> so it's spoken as one smooth word: 'Seeat'.
    """
    def _wrap(m):
        return f"<sub alias=\"{alias}\">{m.group(1)}</sub>"

    safe = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    safe = _CEAT_REGEX.sub(_wrap, safe)
    # Basic SSML envelope
    return f"<speak>{safe}</speak>"

# ---------------- Google TTS ----------------
def synthesize_ssml_to_wav(ssml: str,
                           out_wav: str,
                           voice_name: str = "en-IN-Neural2-C",   # good Indian male
                           speaking_rate: float = 1.0,
                           pitch_semitones: float = 0.0):
    client = texttospeech.TextToSpeechClient()

    synthesis_input = texttospeech.SynthesisInput(ssml=ssml)

    voice = texttospeech.VoiceSelectionParams(
        language_code="en-IN",
        name=voice_name,
        ssml_gender=texttospeech.SsmlVoiceGender.MALE
    )

    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.LINEAR16,  # WAV
        speaking_rate=speaking_rate,
        pitch=pitch_semitones
    )

    response = client.synthesize_speech(
        input=synthesis_input, voice=voice, audio_config=audio_config
    )

    os.makedirs(os.path.dirname(out_wav), exist_ok=True)
    with open(out_wav, "wb") as f:
        f.write(response.audio_content)

    print(f"[TTS] Wrote: {out_wav} ({_wav_duration_seconds(out_wav):.2f}s)")
    return out_wav

# ---------------- Timing helpers ----------------
def fit_wav_to_duration(in_wav: str, target_seconds: float, out_wav: str):
    """
    Stretch/compress voice to fit target_seconds using atempo (0.5..2.0).
    If outside that range, we clamp and pad with roomtone.
    """
    current = _wav_duration_seconds(in_wav)
    if current <= 0.01 or target_seconds <= 0.01:
        # trivial copy
        _run(["ffmpeg", "-y", "-i", in_wav, out_wav])
        return out_wav

    ratio = target_seconds / current

    # 1) time-stretch within [0.5, 2.0]
    if 0.5 <= ratio <= 2.0:
        _run([
            "ffmpeg", "-y", "-i", in_wav,
            "-filter:a", f"atempo={ratio}",
            out_wav
        ])
    else:
        # 2) clamp stretch, then pad/crop to exact length
        clamped = max(0.5, min(2.0, ratio))
        tmp = out_wav.replace(".wav", "_tmp.wav")
        _run(["ffmpeg", "-y", "-i", in_wav, "-filter:a", f"atempo={clamped}", tmp])

        # pad or trim to exact length
        _run([
            "ffmpeg", "-y", "-i", tmp,
            "-af", f"apad=pad_dur={max(0.0, target_seconds)}",
            "-t", str(target_seconds),
            out_wav
        ])

    print(f"[TTS] Fitted to {target_seconds:.2f}s → {out_wav}")
    return out_wav

def concat_wavs(wav_paths, out_wav):
    """
    Concatenate multiple WAVs cleanly (re-encode to match).
    """
    # Build concat filter
    inputs = []
    amix = ""
    for i, p in enumerate(wav_paths):
        inputs += ["-i", p]
        amix += f"[{i}:a]"
    amix += f"concat=n={len(wav_paths)}:v=0:a=1[aout]"
    _run([
        "ffmpeg", "-y", *inputs,
        "-filter_complex", amix,
        "-map", "[aout]",
        "-ar", "44100", "-ac", "2",
        out_wav
    ])
    return out_wav

# ---------------- Muxing ----------------
def mux_replace_audio(video_in: str, voice_wav: str, out_mp4: str):
    """
    Replace any existing audio with the synthesized VO.
    """
    _run([
        "ffmpeg", "-y",
        "-i", video_in, "-i", voice_wav,
        "-map", "0:v", "-map", "1:a",
        "-c:v", "copy",
        "-c:a", "aac", "-b:a", "192k",
        "-shortest",
        out_mp4
    ])
    return out_mp4

def mux_mix_with_music(video_in: str,
                       voice_wav: str,
                       music_in: str,
                       music_gain_db: float,
                       out_mp4: str):
    """
    Optional: mix VO with music (ducked). Keeps video stream untouched.
    """
    _run([
        "ffmpeg", "-y",
        "-i", video_in,     # 0
        "-i", voice_wav,    # 1
        "-i", music_in,     # 2
        "-filter_complex",
        # lower music, then mix 2->1 (music->voice) with a simple sidechainduck if desired
        f"[2:a]volume={music_gain_db}dB[m];"
        f"[1:a][m]amix=inputs=2:duration=first:dropout_transition=0[aout]",
        "-map", "0:v", "-map", "[aout]",
        "-c:v", "copy",
        "-c:a", "aac", "-b:a", "192k",
        "-shortest",
        out_mp4
    ])
    return out_mp4
