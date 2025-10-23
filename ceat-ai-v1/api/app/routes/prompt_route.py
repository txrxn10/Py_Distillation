from flask import Blueprint, request
from app.services import prompt_service
from app.utils.response import success_response, error_response
from app.utils.auth_decorator import require_auth
from app.schemas.prompt_schema import PromptSchema, EnhancePromptSchema
from marshmallow import ValidationError

prompts_bp = Blueprint("prompts", __name__)

@prompts_bp.route("/prompts/generate", methods=["POST"])
@require_auth
def generate_prompt():
    json_data = request.get_json()
    if not json_data:
        return error_response("No input data provided.", 400)
    try:
        validated_data = PromptSchema().load(json_data)
        result = prompt_service.generate_enhanced_prompt(validated_data)
        return success_response(result, "Prompt generated successfully")
    except ValidationError as err:
        return error_response("Validation failed", 400, err.messages)
    except Exception as e:
        return error_response(str(e), 500)

@prompts_bp.route("/prompts/enhance", methods=["POST"])
@require_auth
def enhance_prompt():
    json_data = request.get_json()
    try:
        validated_data = EnhancePromptSchema().load(json_data)
        enhanced_prompt = prompt_service.enhance_existing_prompt(validated_data["prompt"])
        return success_response({"enhanced_prompt": enhanced_prompt}, "Prompt enhanced successfully")
    except ValidationError as err:
        return error_response("Validation failed", 400, err.messages)
    except Exception as e:
        return error_response(str(e), 500)