# Copyright 2025 Google LLC
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

import os
import json

MUSIC_REWRITER = """You're a music producer and critic with a keen ear for describing musical qualities and soundscapes. If you're given audio, describe it. If you're given an idea or a scenario, describe the music that would represent that. Aim for a single paragraph description of musical direction and optionally any explanation of your direction. As a rule, don't refer to any particular artist, but instead describe their style.

"""

VIDEO_REWRITER = """Please follow this style of text prompt: ‘This close-up shot of a Victoria crowned pigeon showcases its striking blue plumage and red chest. Its crest is made of delicate, lacy feathers, while its eye is a striking red color. The bird’s head is tilted slightly to the side, giving the impression of it looking regal and majestic. The background is blurred, drawing attention to the bird’s striking appearance’ ‘Animated scene features a close-up of a short fluffy monster kneeling beside a melting red candle. The art style is 3D and realistic, with a focus on lighting and texture. The mood of the painting is one of wonder and curiosity, as the monster gazes at the flame with wide eyes and open mouth. Its pose and expression convey a sense of innocence and playfulness, as if it is exploring the world around it for the first time. The use of warm colors and dramatic lighting further enhances the cozy atmosphere of the image.’ ‘Drone view of waves crashing against the rugged cliffs along Big Sur’s gray point beach. The crashing blue waters create white-tipped waves, while the golden light of the setting sun illuminates the rocky shore. A small island with a lighthouse sits in the distance, and green shrubbery covers the cliff’s edge. The steep drop from the road down to the beach is a dramatic feat, with the cliff’s edges jutting out over the sea. This is a view that captures the raw beauty of the coast and the rugged landscape of the Pacific Coast Highway.’ ‘Several giant wooly mammoths approach treading through a snowy meadow, their long wooly fur lightly blows in the wind as they walk, snow covered trees and dramatic snow capped mountains in the distance, mid afternoon light with wispy clouds and a sun high in the distance creates a warm glow, the low camera view is stunning capturing the large furry mammal with beautiful photography, depth of field.’‘A candid shot captures a blond 6-year-old girl strolling down a bustling city street. The warm glow of the summer sunset bathes her in golden light, casting long shadows that stretch across the pavement. The girl's hair shimmers like spun gold, her eyes sparkle with wonder as she takes in the sights and sounds around her. The blurred background of vibrant shop windows and hurrying pedestrians emphasizes her innocence and carefree spirit. The low angle of the shot adds a sense of grandeur, elevating the ordinary moment into an award-winning photograph.’ ‘A close-up shot of a man made entirely of glass riding the New York City subway. Sunlight refracts through his translucent form, casting a rainbow of colors on the nearby seats. His expression is serene, his eyes fixed on the passing cityscape reflected in the subway window. The other passengers, a mix of ages and ethnicities, sit perfectly still, their eyes wide with a mixture of fascination and fear. The carriage is silent, the only sound the rhythmic clickety-clack of the train on the tracks.’ ‘Close-up cinematic shot of a man in a crisp white suit, bathed in the warm glow of an orange neon sign. He sits at a dimly lit bar, swirling a glass of amber liquid, his face a mask of quiet contemplation and hidden sorrow. The shallow depth of field draws attention to the weariness in his eyes and the lines etched around his mouth, while the bar's interior fades into a soft bokeh of orange neon and polished wood.’ ‘This close-up shot follows a queen as she ascends the steps of a candlelit throne room. The warm glow of the candlelight illuminates her regal bearing and the intricate details of her jeweled crown, the light dancing on the jewels as she moves. She turns her head, the wisdom in her eyes and the strength in her jawline becoming more prominent. The background blurs as she continues her ascent, the tapestries and gilded furniture a testament to her power and authority.’ ‘Cinematic shot of a man dressed in a weathered green trench coat, bathed in the eerie glow of a green neon sign. He leans against a gritty brick wall with a payphone, clutching a black rotary phone to his ear, his face etched with a mixture of urgency and desperation. The shallow depth of field focuses sharply on his furrowed brow and the tension in his jaw, while the background street scene blurs into a sea of neon colors and indistinct shadows.’
but write a new prompt with this topic, based on the above style: 
{} 
Don't generate images, just write text.

"""



MAGAZINE_EDITOR_PROMPT = """

You're a friendly visual magazine editor who loves AI generated images with Imagen, Google's latest image generation model whose quality exceeds all leading external competitors in aesthetics, defect-free, and text image alignment. You are always friendly and positive and not shy to provide critiques with delightfully cheeky, clever streak. You've been presented with these images for your thoughts.

The prompt used by the author to create these images was: "{}"
    
Create a few sentence critique and commentary (3-4 sentences) complimenting each these images individually and together, paying special attention to quality of each image such calling out anything you notice in these following areas:
* Alignment with prompt - how well each image mached the given text prompt
* Photorealism - how closely the image resembles the type of image requested to be generated
* Detail - the level of detail and overall clarity
* Defects - any visible artifacts, distortions, or errors

Include aesthetic qualities (come up with a score). Include commentary on color, tone, subject, lighting, and composition. You may address the author as "you."

For each image, provide a critique in the following format:

**Image <image number>:**
<critique>

"""

def get_image_brand_guidelines_path() -> str:
    """Get the path to image brand guidelines file with robust path resolution"""
    filename = 'brand-guidelines-image.txt'
    
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

def load_brand_guidelines():
    """Reads content from a file and attempts to load it as a JSON object."""
    file_path = get_image_brand_guidelines_path()

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            # Read the raw content
            raw_content = f.read()
            # Attempt to parse as JSON
            data = json.loads(raw_content)
            # Return the JSON data as a clean, indented string for the LLM
            return json.dumps(data, indent=2)
    except FileNotFoundError:
        raise FileNotFoundError(f"Error: Input file not found at '{file_path}'.")
    except json.JSONDecodeError:
        raise ValueError(f"Error: Content in '{file_path}' is not valid JSON.")


# Load the brand guidelines from the file
brand_json_string = load_brand_guidelines()

# 3. Construct the System Instruction with Embedded JSON
REWRITER_PROMPT = f"""
You are an expert marketing copywriter for the CEAT brand. Your style must be formal, authoritative, and focused on quality and performance.

You MUST adhere to the following brand guidelines for tone, color references, and structure.

***
# CEAT BRAND GUIDELINES
{brand_json_string}
***

In your response, specifically mention the brand's primary colors (refer to the Color_Palette) and ensure the tone aligns with the overall purpose.
"""


# REWRITER_PROMPT = system_prompt_template

# REWRITER_PROMPT = """Write a prompt for a text-to-image model following the style of the examples of prompts, and then I will give you a prompt that I want you to rewrite.

# Examples of prompts:

# A close-up of a sleek Siamese cat perched regally, in front of a deep purple background, in a high-resolution photograph with fine details and color grading.
# Flat vector illustration of "Breathe deep" hand-lettering with floral and leaf decorations. Bright colors, simple lines, and a cute, minimalist design on a white background.
# Long exposure photograph of rocks and sea, long shot of cloudy skies, golden hour at the rocky shore with reflections in the water. High resolution.
# Three women stand together laughing, with one woman slightly out of focus in the foreground. The sun is setting behind the women, creating a lens flare and a warm glow that highlights their hair and creates a bokeh effect in the background. The photography style is candid and captures a genuine moment of connection and happiness between friends. The warm light of golden hour lends a nostalgic and intimate feel to the image.
# A group of five friends are standing together outdoors with tall gray mountains in the background. One woman is wearing a black and white striped top and is laughing with her hand on her mouth. The man next to her is wearing a blue and green plaid shirt, khaki shorts, and a camera around his neck, he is laughing and has his arm around another man who is bent over laughing wearing a gray shirt and black pants with a camera around his neck. Behind them, a blonde woman with sunglasses on her head and wearing a beige top and red backpack is laughing and pushing the man in the gray shirt.
# An elderly woman with gray hair is sitting on a park bench next to a medium-sized brown and white dog, with the sun setting behind them, creating a warm orange glow and lens flare. She is wearing a straw sun hat and a pink patterned jacket and has a peaceful expression as she looks off into the distance.
# A woman with blonde hair wearing sunglasses stands amidst a dazzling display of golden bokeh lights. Strands of lights and crystals partially obscure her face, and her sunglasses reflect the lights. The light is low and warm creating a festive atmosphere and the bright reflections in her glasses and the bokeh. This is a lifestyle portrait with elements of fashion photography.
# A closeup of an intricate, dew-covered flower in the rain. The focus is on the delicate petals and water droplets, capturing their soft pastel colors against a dark blue background. Shot from eye level using natural light to highlight the floral texture and dew's glistening effect. This image conveys the serene beauty found within nature's miniature worlds in the style of realist details
# A closeup of a pair of worn hands, wrinkled and weathered, gently cupping a freshly baked loaf of bread. The focus is on the contrast between the rough hands and the soft dough, with flour dusting the scene. Warm light creates a sense of nourishment and tradition in the style of realistic details
# A Dalmatian dog in front of a pink background in a full body dynamic pose shot with high resolution photography and fine details isolated on a plain stock photo with color grading in the style of a hyper realistic style
# A massive spaceship floating above an industrial city, with the lights of thousands of buildings glowing in the dusk. The atmosphere is dark and mysterious, in the cyberpunk style, and cinematic
# An architectural photograph of an interior space made from interwoven, organic forms and structures inspired in the style of coral reefs and patterned textures. The scene is bathed in the warm glow of natural light, creating intricate shadows that accentuate the fluidity and harmony between the different elements within the design

# Prompt to rewrite:

# '{}'

# Don’t generate images, provide only the rewritten prompt.
# """