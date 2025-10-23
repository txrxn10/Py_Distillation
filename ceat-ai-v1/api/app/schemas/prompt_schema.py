from marshmallow import Schema, fields, validate, validates_schema, ValidationError

class ImageInputSchema(Schema):
    gcsUri = fields.Str(required=True, validate=validate.Regexp(r'^gs://.*'))


class PromptSchema(Schema):
    mode = fields.Str(
        required=True,
        validate=validate.OneOf(["text_to_video", "image_to_video"]),
        metadata={"description": "Whether to generate video from text or an image reference."}
    )
    subject = fields.Str(
        required=False, allow_none=True,
        metadata={"description": "The main person, object, or character of the scene."}
    )
    action = fields.Str(
        required=False, allow_none=True,
        metadata={"description": "The primary action the subject is performing."}
    )
    scene = fields.Str(
        required=False, allow_none=True,
        metadata={"description": "The environment, setting, or background context."}
    )
    camera_angles = fields.Str(
        required=False, allow_none=True,
        metadata={"description": "e.g., 'low-angle shot', 'aerial view', 'over-the-shoulder'."}
    )
    camera_movements = fields.Str(
        required=False, allow_none=True,
        metadata={"description": "e.g., 'smooth pan left', 'fast tracking shot', 'static'."}
    )
    visual_style = fields.Str(
        required=False, allow_none=True,
        metadata={"description": "Overall look and feel, e.g., 'cinematic', 'hyper-realistic', 'vintage film'."}
    )
    lens_effects = fields.Str(
        required=False, allow_none=True,
        metadata={"description": "Optical effects, e.g., 'anamorphic lens flare', 'bokeh', 'shallow depth of field'."}
    )
    temporal_elements = fields.Str(
        required=False, allow_none=True,
        metadata={"description": "Time-based effects, e.g., 'slow-motion', 'time-lapse'."}
    )
    sound_effects = fields.Str(
        required=False, allow_none=True,
        metadata={"description": "Ambient sounds or specific audio cues to imply in the scene."}
    )
    dialogue = fields.Str(
        required=False, allow_none=True,
        metadata={"description": "Any spoken words to be implied in the scene."}
    )
    # image = fields.Str(
    #     required=False, allow_none=True,
    #     validate=validate.URL(error="Please provide a valid URL for the image."),
    #     metadata={"description": "URL to a reference image. Required for 'image_to_video' mode."}
    # )
    # duration = fields.Int(
    #     required=False,
    #     allow_none=True,
    #     validate=validate.Range(min=1, max=35, error="Duration must be between 1 and 35 seconds."),
    #     metadata={"description": "Total desired duration in seconds (will be split into <=8s scenes)."}
    # )
    number_of_scenes = fields.Int(required=True, validate=validate.Range(min=1, max=5, error="Number of scenes must be between 1 and 5."))
    
    image = fields.Nested(ImageInputSchema, required=False, allow_none=True)

    @validates_schema
    def validate_image_dependency(self, data, **kwargs):
        if data.get("mode") == "image_to_video" and not data.get("image"):
            raise ValidationError("The 'image' object with a 'gcsUri' is required for image_to_video mode.", "image")
        

class EnhancePromptSchema(Schema):
    prompt = fields.Str(required=True, validate=validate.Length(min=1))       