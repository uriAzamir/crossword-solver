import os
import logging

from flask import Blueprint, jsonify, request
from supabase import create_client

logger = logging.getLogger(__name__)
users_bp = Blueprint('users', __name__)


def _get_supabase():
    return create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_SERVICE_KEY'))


@users_bp.route('/users', methods=['POST'])
def create_user():
    data = request.get_json()
    username = (data or {}).get('username', '').strip()
    if not username:
        return jsonify({'error': 'username required'}), 400

    db = _get_supabase()
    try:
        result = db.table('users').insert({'username': username}).execute()
        return jsonify(result.data[0]), 201
    except Exception as e:
        if '23505' in str(e) or 'unique' in str(e).lower() or 'duplicate' in str(e).lower():
            return jsonify({'error': 'username_taken'}), 409
        logger.error(f'Error creating user: {e}')
        return jsonify({'error': 'server_error'}), 500


@users_bp.route('/users/by-name/<username>', methods=['GET'])
def get_user_by_name(username):
    db = _get_supabase()
    result = (
        db.table('users')
        .select('*')
        .eq('username', username)
        .single()
        .execute()
    )
    if not result.data:
        return jsonify({'error': 'not_found'}), 404
    return jsonify(result.data)


@users_bp.route('/users/<user_id>/progress', methods=['GET'])
def get_user_progress(user_id):
    db = _get_supabase()
    result = (
        db.table('user_progress')
        .select('puzzle_id,letters')
        .eq('user_id', user_id)
        .execute()
    )
    # Return as {puzzle_id: {letters: {...}}} for easy frontend lookup
    progress = {row['puzzle_id']: {'letters': row['letters']} for row in result.data}
    return jsonify(progress)


@users_bp.route('/users/<user_id>/progress/<puzzle_id>', methods=['PUT'])
def save_user_progress(user_id, puzzle_id):
    data = request.get_json()
    if data is None or 'letters' not in data:
        return jsonify({'error': 'letters required'}), 400

    db = _get_supabase()
    db.table('user_progress').upsert({
        'user_id': user_id,
        'puzzle_id': puzzle_id,
        'letters': data['letters'],
        'updated_at': 'now()',
    }, on_conflict='user_id,puzzle_id').execute()
    return jsonify({'ok': True})


@users_bp.route('/users/<user_id>/progress/bulk', methods=['POST'])
def bulk_import_progress(user_id):
    data = request.get_json()
    if not isinstance(data, list):
        return jsonify({'error': 'expected array'}), 400

    if not data:
        return jsonify({'ok': True, 'imported': 0})

    db = _get_supabase()
    rows = [
        {
            'user_id': user_id,
            'puzzle_id': entry['puzzle_id'],
            'letters': entry['letters'],
        }
        for entry in data
        if entry.get('puzzle_id') and entry.get('letters')
    ]
    if rows:
        db.table('user_progress').upsert(
            rows, on_conflict='user_id,puzzle_id'
        ).execute()
    return jsonify({'ok': True, 'imported': len(rows)})
