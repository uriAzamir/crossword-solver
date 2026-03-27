from flask import Blueprint, request, jsonify
from services.image_processor import process_image

puzzle_bp = Blueprint('puzzle', __name__)


@puzzle_bp.route('/process', methods=['POST'])
def process():
    if 'image' not in request.files:
        return jsonify({'error': 'invalid_input', 'message': 'No image file provided'}), 400

    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': 'invalid_input', 'message': 'Empty filename'}), 400

    image_bytes = file.read()

    try:
        result = process_image(image_bytes)
        return jsonify(result)
    except ValueError as e:
        return jsonify({'error': 'grid_extraction_failed', 'message': str(e)}), 422
    except Exception as e:
        return jsonify({'error': 'processing_failed', 'message': str(e)}), 500
