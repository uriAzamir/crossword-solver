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

    prompt = """This is the clue section of a Hebrew crossword puzzle image.
The RIGHT column (header: מאוזן) contains the ACROSS clues.
The LEFT column (header: מאונך) contains the DOWN clues.

Clue parsing rules:
1. Each clue starts with a number followed by a dot: "1."
2. Each clue ends with a semicolon ";" that comes after the letter count.
3. The letter count is the LAST parenthetical before the ";". It contains ONLY digits and commas, e.g. "(5)" or "(3,4)" or "(6,3)".
4. IMPORTANT: "(מ)" appearing inside the clue text is a wordplay hint that is PART OF THE CLUE TEXT — do NOT treat it as the letter count, and do NOT end the clue there.
5. Clues can span multiple lines. A new clue only starts when you see the next "N." pattern after a ";".
6. A new clue can begin mid-line immediately after the previous clue's ";".
7. The clue TEXT is everything between "N." and the final "(digits);".

Examples of correct extraction:
  Image text: "1. מושבה עקשנית עשויה למנוע חדירת גורמים עוינים (5,3);"
  → {"number": 1, "text": "מושבה עקשנית עשויה למנוע חדירת גורמים עוינים", "length": "5,3"}

  Image text: "6. מה אעשה אם ארצה לשכור שני תנורים? (מ) (5);"
  → {"number": 6, "text": "מה אעשה אם ארצה לשכור שני תנורים? (מ)", "length": "5"}

  Image text: "8. שימוש במברשת צבע אחרי תחילת הסיוד (מ) (5);"
  → {"number": 8, "text": "שימוש במברשת צבע אחרי תחילת הסיוד (מ)", "length": "5"}

Extract ALL clues from both columns and return ONLY valid JSON — no other text, no markdown, no code fences:
{"across": [{"number": 1, "text": "...", "length": "5,3"}], "down": [{"number": 1, "text": "...", "length": "3"}]}"""

    response = client.messages.create(
        model='claude-sonnet-4-6',
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
    with open(r'C:\Users\User\Desktop\clue_debug.txt', 'w', encoding='utf-8') as f:
        f.write(raw)
    clues = _parse_response(raw)

    # Retry once with stricter prompt if validation fails
    if not _validate_clues(clues):
        retry_prompt = prompt + '\n\nIMPORTANT: Your previous response was not valid JSON. Return ONLY the JSON object, starting with { and ending with }. Absolutely no other text.'
        response2 = client.messages.create(
            model='claude-sonnet-4-6',
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
