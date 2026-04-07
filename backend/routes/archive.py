import os
import logging
import threading

from flask import Blueprint, jsonify, request
from supabase import create_client

logger = logging.getLogger(__name__)
archive_bp = Blueprint('archive', __name__)

# Prevents concurrent scraper runs within the same worker process
_sync_lock = threading.Lock()


def _get_supabase():
    return create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_SERVICE_KEY'))


@archive_bp.route('/puzzles', methods=['GET'])
def list_puzzles():
    db = _get_supabase()
    result = (
        db.table('puzzles')
        .select('id,title,published_at,day_of_week,image_public_url,processing_status')
        .eq('processing_status', 'done')
        .order('published_at', desc=True)
        .execute()
    )
    return jsonify(result.data)


@archive_bp.route('/puzzles/sync', methods=['POST'])
def sync_puzzles():
    if not _sync_lock.acquire(blocking=False):
        return jsonify({'status': 'already_running'})

    def _run():
        try:
            from services.scraper import fetch_new_puzzles
            result = fetch_new_puzzles()
            logger.info(f'Sync finished: {result}')
        except Exception as e:
            logger.error(f'Sync failed: {e}')
        finally:
            _sync_lock.release()

    threading.Thread(target=_run, daemon=True).start()
    return jsonify({'status': 'started'})


@archive_bp.route('/puzzles/<puzzle_id>', methods=['GET'])
def get_puzzle(puzzle_id):
    db = _get_supabase()
    result = (
        db.table('puzzles')
        .select('*')
        .eq('id', puzzle_id)
        .single()
        .execute()
    )
    if not result.data:
        return jsonify({'error': 'not_found'}), 404
    return jsonify(result.data)


@archive_bp.route('/puzzles/<puzzle_id>/clues', methods=['PATCH'])
def update_clues(puzzle_id):
    data = request.get_json()
    if not data or 'clues' not in data:
        return jsonify({'error': 'clues required'}), 400

    db = _get_supabase()
    result = (
        db.table('puzzles')
        .select('processed_data')
        .eq('id', puzzle_id)
        .single()
        .execute()
    )
    if not result.data:
        return jsonify({'error': 'not_found'}), 404

    processed_data = result.data['processed_data']
    processed_data['clues'] = data['clues']
    db.table('puzzles').update({'processed_data': processed_data}).eq('id', puzzle_id).execute()
    return jsonify({'ok': True})
