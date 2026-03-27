import anthropic
import base64
import json
import re
import cv2
import numpy as np
from PIL import Image
import io


def extract_clues(clue_region: np.ndarray) -> dict:
    """
    Send the clue region image to Claude Haiku and extract structured clues.
    Returns: { across: [{number, text, length}], down: [{number, text, length}] }
    """
    image_b64 = _encode_image(clue_region)
    client = anthropic.Anthropic()

    prompt = """This is the clue section of a Hebrew crossword puzzle.
The RIGHT column (header: מאוזן) contains the ACROSS clues.
The LEFT column (header: מאונך) contains the DOWN clues.

Clue parsing rules:
- Each clue starts with a number followed by a dot: "1."
- Each clue ends with the letter count in parentheses followed by a semicolon: "(5);" or "(3,4);"
- Clues can span multiple lines — keep reading until you see ");"
- A new clue can start mid-line immediately after the previous ");"
- The clue text is everything between the "N." and the "(count);"

Extract ALL clues from both columns and return ONLY valid JSON — no other text, no markdown:
{"across": [{"number": 1, "text": "...", "length": "5"}], "down": [{"number": 1, "text": "...", "length": "3,4"}]}"""

    response = client.messages.create(
        model='claude-haiku-4-5-20251001',
        max_tokens=2048,
        messages=[{
            'role': 'user',
            'content': [
                {
                    'type': 'image',
                    'source': {
                        'type': 'base64',
                        'media_type': 'image/png',
                        'data': image_b64,
                    }
                },
                {'type': 'text', 'text': prompt}
            ]
        }]
    )

    raw = response.content[0].text.strip()
    clues = _parse_response(raw)

    # Retry once with stricter prompt if validation fails
    if not _validate_clues(clues):
        retry_prompt = prompt + '\n\nIMPORTANT: Your previous response was not valid JSON. Return ONLY the JSON object, starting with { and ending with }. Absolutely no other text.'
        response2 = client.messages.create(
            model='claude-haiku-4-5-20251001',
            max_tokens=2048,
            messages=[{
                'role': 'user',
                'content': [
                    {
                        'type': 'image',
                        'source': {
                            'type': 'base64',
                            'media_type': 'image/png',
                            'data': image_b64,
                        }
                    },
                    {'type': 'text', 'text': retry_prompt}
                ]
            }]
        )
        raw2 = response2.content[0].text.strip()
        clues = _parse_response(raw2)

    if not _validate_clues(clues):
        raise ValueError('Claude returned invalid clue structure after retry')

    return clues


def _encode_image(region: np.ndarray) -> str:
    """Convert OpenCV image array to base64 PNG string."""
    rgb = cv2.cvtColor(region, cv2.COLOR_BGR2RGB)
    pil_img = Image.fromarray(rgb)
    buffer = io.BytesIO()
    pil_img.save(buffer, format='PNG')
    return base64.b64encode(buffer.getvalue()).decode('utf-8')


def _parse_response(text: str) -> dict:
    """Try to parse JSON from Claude's response, with regex fallback."""
    # Direct parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Extract JSON object with regex
    match = re.search(r'\{.*\}', text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass

    return {}


def _validate_clues(clues: dict) -> bool:
    """Validate the clue structure has the required shape."""
    if not isinstance(clues, dict):
        return False
    if 'across' not in clues or 'down' not in clues:
        return False
    for direction in ('across', 'down'):
        if not isinstance(clues[direction], list):
            return False
        for item in clues[direction]:
            if not isinstance(item, dict):
                return False
            if 'number' not in item or 'text' not in item:
                return False
    return True
