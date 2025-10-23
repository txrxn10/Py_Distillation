from marshmallow import Schema, fields, validate

class GlobalSettingsSchema(Schema):
    """Schema for all possible generation parameters."""
    aspectRatio = fields.Str(required=False, allow_none=True)
    resolution = fields.Str(required=False, allow_none=True)
    enhancePrompt = fields.Bool(required=False, allow_none=True)
    generateAudio = fields.Bool(required=False, allow_none=True)
    personGeneration = fields.Str(required=False, allow_none=True)
    negativePrompt = fields.Str(required=False, allow_none=True)
    seed = fields.Int(required=False, allow_none=True)
    sampleCount = fields.Int(required=False, allow_none=True, validate=validate.Range(min=1, max=4))
    compressionQuality = fields.Str(required=False, allow_none=True, validate=validate.OneOf(["optimized", "lossless"]))
    model = fields.Str(required=False, allow_none=True)
    personAge = fields.Str(required=False, allow_none=True)
 

class MultiSceneSchema(Schema):
    """Schema for multi-scene or image-to-video generation."""
    class SceneItemSchema(Schema):
        id = fields.Int(required=True)
        duration = fields.Int(required=True, validate=validate.Range(min=1, max=8, error="Scene duration must be between 1 and 8 seconds."))
        prompt = fields.Str(required=True)
    
    scenes = fields.List(fields.Nested(SceneItemSchema), required=True)
    image = fields.Nested({"gcsUri": fields.Str(required=True)}, required=False, allow_none=True)
    
    parameters = fields.Nested(GlobalSettingsSchema, load_default={})
    
    # Post-processing flags
    stitch = fields.Boolean(load_default=True)
    transitions = fields.Boolean(load_default=True)
    apply_motion_tracking = fields.Boolean(load_default=False)


class ProcessExistingVideoSchema(Schema):
    """Schema for processing videos that already exist in GCS."""
    input_uris = fields.List(
        fields.Str(required=True, validate=validate.Regexp(r'^gs://.*')),
        required=True,
        validate=validate.Length(min=1, error="At least one GCS URI is required.")
    )
    stitch = fields.Boolean(load_default=True)
    transitions = fields.Boolean(load_default=False)
    # Adding flags for the new finalization steps
    apply_logo_overlay = fields.Boolean(load_default=True)
    apply_end_card = fields.Boolean(load_default=True)
    apply_motion_tracking = fields.Boolean(load_default=False)    