import os
import json

def get_brand_guidelines_path(type: str) -> str:
    """Get the path to image brand guidelines file with robust path resolution"""
    filename = 'brand-guidelines-'+type+'.txt'
    
    # Try multiple path resolution strategies
    possible_paths = []
    
    # Strategy 1: Relative to this file (api/app/routes/image_route.py)
    current_file = os.path.abspath(__file__)
    api_dir = os.path.dirname(os.path.dirname(os.path.dirname(current_file)))
    possible_paths.append(os.path.join(api_dir, filename))
    
    # Strategy 2: Relative to current working directory
    possible_paths.append(os.path.join(os.getcwd(), 'api', filename))
    
    # Strategy 3: Just in api subdirectory of cwd
    possible_paths.append(os.path.join('api', filename))
    
    # Strategy 4: Directly in cwd (in case we're running from api directory)
    possible_paths.append(os.path.join(os.getcwd(), filename))
    
    # Strategy 5: Look for api directory in parent directories
    current_dir = os.path.dirname(current_file)
    for _ in range(5):  # Look up to 5 levels up
        parent_api = os.path.join(current_dir, 'api', filename)
        if parent_api not in possible_paths:
            possible_paths.append(parent_api)
        current_dir = os.path.dirname(current_dir)
    
    print(f"Looking for image brand guidelines file: {filename}")
    
    for path in possible_paths:
        abs_path = os.path.abspath(path)
        if os.path.exists(abs_path):
            print(f"✅ Found image brand guidelines at: {abs_path}")
            return abs_path
    
    # If no file found, return the first path (most likely correct one)
    fallback_path = possible_paths[0]
    print(f"❌ Image brand guidelines not found, using fallback: {fallback_path}")
    return fallback_path

def load_brand_guidelines(type: str):
    """Reads content from a file and attempts to load it as a JSON object."""
    file_path = get_brand_guidelines_path(type)

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            # Read the raw content
            raw_content = f.read()
            # Attempt to parse as JSON
            data = json.loads(raw_content)
            # Return the JSON data as a clean, indented string for the LLM
            return data
    except FileNotFoundError:
        raise FileNotFoundError(f"Error: Input file not found at '{file_path}'.")
    except json.JSONDecodeError:
        raise ValueError(f"Error: Content in '{file_path}' is not valid JSON.")

def extract_brand_image_attributes(brand_data: dict) -> str:
    """Convert brand attributes into a descriptive summary for the prompt."""
    brand_name = brand_data.get("brand_name", "CEAT")
    typography = brand_data.get("typography", {})
    colors = ", ".join(brand_data.get("color_palette", [])) or "brand-specific colors"

    tone = typography.get("tone", "professional and consistent")

    brand_summary = (
        f"The image must reflect {brand_name}'s brand identity — "
        f"tone: {tone}"
        f"color palette: {colors}. "
        "Maintain a clean, modern, and professional appearance."
    )
    return brand_summary


def create_brand_enhanced_image_prompt(user_prompt: str) -> str:
    """
    Combine user prompt with brand attributes to form a
    concise, professional, and brand-aligned prompt.
    """

    brand_data = load_brand_guidelines("image")

    brand_context = extract_brand_image_attributes(brand_data)

    logo_usage = brand_data.get("logo_usage", {})
    logo_position = logo_usage.get("position", "top-right corner")

    logo_instruction = (
        f"Leave a clean, empty area in the {logo_position} for logo placement, "
        "ensuring the background remains consistent with the rest of the image. "
        "Do not generate any logo, text, or watermark."
    )

    # Combine user input + brand tone + visual context + logo instruction
    final_prompt = (
        f"{user_prompt.strip()}. "
        f"{brand_context} "
        f"{logo_instruction}"
    )

    # Keep it concise but descriptive
    final_prompt = " ".join(final_prompt.split())  # Clean up spacing
    return final_prompt