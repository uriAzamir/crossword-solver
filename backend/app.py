from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import os

load_dotenv()

app = Flask(__name__)
CORS(app)

from routes.puzzle import puzzle_bp
app.register_blueprint(puzzle_bp, url_prefix='/api')


@app.route('/api/health')
def health():
    return jsonify({
        'status': 'ok',
        'claude_configured': bool(os.getenv('ANTHROPIC_API_KEY'))
    })


if __name__ == '__main__':
    app.run(debug=True, port=5000)
