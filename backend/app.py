import os
import threading
import logging

from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO)

app = Flask(__name__)

# Allow origins from env var (comma-separated) or fall back to permissive for local dev
_raw_origins = os.getenv('ALLOWED_ORIGINS', '')
_origins = [o.strip() for o in _raw_origins.split(',') if o.strip()] or '*'
CORS(app, origins=_origins)

from routes.puzzle import puzzle_bp
from routes.archive import archive_bp
app.register_blueprint(puzzle_bp, url_prefix='/api')
app.register_blueprint(archive_bp, url_prefix='/api')


@app.route('/api/health')
def health():
    return jsonify({
        'status': 'ok',
        'claude_configured': bool(os.getenv('ANTHROPIC_API_KEY')),
        'supabase_configured': bool(os.getenv('SUPABASE_URL')),
    })


def _start_scheduler():
    """Start APScheduler for Monday/Wednesday syncs + an immediate catch-up run."""
    if not os.getenv('SUPABASE_URL'):
        return  # Don't start scheduler if Supabase isn't configured

    from apscheduler.schedulers.background import BackgroundScheduler
    from services.scraper import fetch_new_puzzles

    scheduler = BackgroundScheduler(timezone='Asia/Jerusalem')
    # Check on puzzle days: 9 AM, 1 PM, 5 PM, 9 PM, then midnight (start of Tue/Thu) as end-of-day sweep
    scheduler.add_job(fetch_new_puzzles, 'cron', day_of_week='mon,wed', hour='9,13,17,21', minute=0)
    scheduler.add_job(fetch_new_puzzles, 'cron', day_of_week='tue,thu', hour=0, minute=0)
    scheduler.start()

    # Catch-up: run once on startup in background to pick up any missed posts
    threading.Thread(target=fetch_new_puzzles, daemon=True).start()


# Only start the scheduler in the main process (not in Flask's reloader child process)
if os.environ.get('WERKZEUG_RUN_MAIN') != 'true':
    _start_scheduler()


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)
