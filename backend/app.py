from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import os

load_dotenv()

app = Flask(__name__)

# Allow origins from env var (comma-separated) or fall back to permissive for local dev
_raw_origins = os.getenv('ALLOWED_ORIGINS', '')
_origins = [o.strip() for o in _raw_origins.split(',') if o.strip()] or '*'
CORS(app, origins=_origins)

from routes.puzzle import puzzle_bp
app.register_blueprint(puzzle_bp, url_prefix='/api')


@app.route('/api/health')
def health():
    return jsonify({
        'status': 'ok',
        'claude_configured': bool(os.getenv('ANTHROPIC_API_KEY'))
    })


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)
