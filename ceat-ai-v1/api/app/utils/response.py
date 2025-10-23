from collections import OrderedDict
from flask import Response
import json


def success_response(data=None, message="Success", code=200):
    """
    Standardized success response with enforced key order
    """
    payload = OrderedDict([
        ("code", code),
        ("status", "success"),
        ("message", message),
        ("data", data or {})
    ])
    return Response(
        json.dumps(payload),
        status=code,
        mimetype="application/json"
    )


def error_response(message="Error", code=400, errors=None):
    """
    Standardized error response with enforced key order
    """
    payload = OrderedDict([
        ("code", code),
        ("status", "error"),
        ("message", message),
        ("errors", errors or {})
    ])
    return Response(
        json.dumps(payload),
        status=code,
        mimetype="application/json"
    )
