"""
Simplified Gemini integration for prompt rewriting
"""

from typing import Optional
from google.genai import types
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from app.config.default import Default
from app.config.rewriters import REWRITER_PROMPT
from app.models.model_setup import GeminiModelSetup

# Initialize client and default model ID for rewriter
client = GeminiModelSetup.init()
cfg = Default()
REWRITER_MODEL_ID = cfg.MODEL_ID


@retry(
    wait=wait_exponential(
        multiplier=1, min=1, max=10
    ),  # Exponential backoff (1s, 2s, 4s... up to 10s)
    stop=stop_after_attempt(3),  # Stop after 3 attempts
    retry=retry_if_exception_type(Exception),  # Retry on all exceptions for robustness
    reraise=True,  # re-raise the last exception if all retries fail
)
def rewriter(original_prompt: str, rewriter_prompt: str) -> str:
    """A Gemini rewriter.

    Args:
        original_prompt: The original prompt to be rewritten.
        rewriter_prompt: The rewriter prompt.

    Returns:
        The rewritten prompt text.
    """

    system_instruction = (
        "You are an expert creative assistant specializing in writing highly effective and "
        "descriptive prompts for image generation AI using Imagen model. "
        "Your task is to enhance the user's input by adding specific, aesthetic, and technical details."
        "Maintain the original intent and core subjects of the prompt without adding any irrelevant "
        "elements or conversational text. The enhanced prompt must be concise, well-structured, "
        "and slightly longer than the original not too long to maximize creative quality."
    )

    full_prompt = f"{original_prompt}"
    print(f"Rewriter: '{full_prompt}' with model {REWRITER_MODEL_ID}")

    # 4. Configure the Model with the System Instruction
    config = types.GenerateContentConfig(
        system_instruction=system_instruction,
        temperature=0.4,
    )

    try:
        response = client.models.generate_content(
            model=REWRITER_MODEL_ID,  # Explicitly use the configured model
            contents=full_prompt,
            config=config,
        )
        print(f"Rewriter success! {response.text}")
        return response.text
    except Exception as e:
        print(f"Rewriter error: {e}")
        raise


def rewrite_prompt_with_gemini(original_prompt: str) -> str:
    """
    Outputs a rewritten prompt using the Gemini model.
    Args:
        original_prompt (str): The user's original prompt.
    Returns:
        str: The rewritten prompt.
    Raises:
        Exception: If the rewriter service fails.
    """
    try:
        rewritten_text = rewriter(original_prompt, REWRITER_PROMPT)
        if not rewritten_text:
            print("Warning: Rewriter returned an empty prompt.")
            return original_prompt
        return rewritten_text
    except Exception as e:
        print(f"Gemini rewriter failed: {e}")
        raise