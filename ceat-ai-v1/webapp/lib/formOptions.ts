export const textVideoSelectData = {
  camera_angle: { label: "Camera Angles", options: ["Eye-Level Shot", "Low-Angle Shot", "High-Angle Shot", "Bird's-Eye View", "Top-Down Shot", "Worm's-Eye View", "Dutch Angle", "Canted Angle", "Close-Up", "Extreme Close-Up", "Medium Shot", "Full Shot", "Long Shot", "Wide Shot", "Establishing Shot", "Over-the-Shoulder Shot", "Point-of-View (POV) Shot","Custom..."] },
  camera_movement: { label: "Camera Movements", options: ["Static Shot (or fixed)", "Pan (left)", "Pan (right)", "Tilt (up)", "Tilt (down)", "Dolly (In)", "Dolly (Out)", "Zoom (In)", "Zoom (Out)", "Truck (Left)", "Truck (Right)", "Pedestal (Up)", "Pedestal (Down)", "Crane Shot", "Aerial Shot", "Drone Shot", "Handheld", "Shaky Cam", "Whip Pan", "Arc Shot","Custom..."] },
  lens_effect: { label: "Lens & Optical Effects", options: ["Wide-Angle Lens (e.g., 24mm)", "Telephoto Lens (e.g., 85mm)", "Shallow Depth of Field", "Bokeh", "Deep Depth of Field", "Lens Flare", "Rack Focus", "Fisheye Lens Effect", "Vertigo Effect (Dolly Zoom)","Custom..."] },
  visual_style: { label: "Visual Style & Aesthetics", options: ["Photorealistic", "Cinematic", "Vintage", "Japanese anime style", "Claymation style", "Stop-motion animation", "In the style of Van Gogh", "Surrealist painting", "Monochromatic black and white", "Vibrant and saturated", "Film noir style", "High-key lighting", "Low-key lighting", "Golden hour glow", "Volumetric lighting", "Backlighting to create a silhouette","Custom..."] },
  temporal_element: { label: "Temporal Elements", options: ["Slow-motion", "Fast-paced action", "Time-lapse", "Hyperlapse", "Pulsating light", "Rhythmic movement","Custom..."] },
  sound_effects: { label: "Sound Effects & Ambience", options: ["Sound of a phone ringing", "Water splashing", "Soft house sounds", "Ticking clock", "City traffic and sirens", "Waves crashing", "Quiet office hum","Custom..."] },
  number_of_scenes: { label: "No of scenes(each scene will be of 8s)", options: ["1", "2","3","4"] }
};

export const globalSettingsSelectData = {
    aspectRatio: {
        label: "Aspect Ratio",
        options: ["16:9", "9:16"],
        labels: {
            "16:9": "Landscape (16:9)",
            "9:16": "Portrait (9:16)"
        }
    },
    resolution: {
        label: "Resolution",
        options: ["720p", "1080p"],
        labels: {
            "720p": "720p HD",
            "1080p": "1080p Full HD"
        }
    },
    personGeneration: {
        label: "Person Generation",
        options: ["allow_adult", "dont_allow"],
        labels: {
            "allow_adult": "Allow Adults Only",
            "dont_allow": "Don't Allow People"
        }
    }
};