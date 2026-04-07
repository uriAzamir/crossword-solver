import os
import re
import logging
import requests
from datetime import datetime, timezone
from urllib.parse import unquote, quote

from bs4 import BeautifulSoup
from supabase import create_client

from services.image_processor import process_image

logger = logging.getLogger(__name__)

BASE = 'https://groups.google.com'
GROUP = 'tartey_mashma'
IMAGE_EXTS = ('.jpg', '.jpeg', '.png')
TITLE_PREFIXES = ('דקל בנו שני', 'דקל בנו רביעי')

HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) '
        'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    ),
    'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}


def _get_supabase():
    url = os.getenv('SUPABASE_URL')
    key = os.getenv('SUPABASE_SERVICE_KEY')
    if not url or not key:
        raise RuntimeError('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set')
    return create_client(url, key)


def fetch_new_puzzles() -> dict:
    """
    Main entry point. Scrapes the Google Group, downloads new puzzle images,
    processes them, and stores everything in Supabase.
    Returns {'new_count': int, 'errors': list}.
    """
    db = _get_supabase()
    posts = _search_posts()
    logger.info(f'Found {len(posts)} relevant posts on Google Group')

    new_count = 0
    errors = []

    for post in posts:
        try:
            # Skip if already stored
            existing = (
                db.table('puzzles')
                .select('id')
                .eq('google_group_post_id', post['post_id'])
                .execute()
            )
            if existing.data:
                logger.debug(f'Already stored: {post["title"]}')
                continue

            logger.info(f'Processing new post: {post["title"]}')

            image_bytes = _download_image(post['post_url'])
            if not image_bytes:
                raise ValueError('No image attachment found in post')

            storage_path, public_url = _upload_image(db, image_bytes, post['post_id'])
            processed_data = process_image(image_bytes)
            _insert_puzzle(db, post, storage_path, public_url, processed_data)

            new_count += 1
            logger.info(f'Stored: {post["title"]}')

        except Exception as e:
            logger.error(f'Error processing "{post.get("title", "?")}": {e}')
            errors.append({'title': post.get('title', '?'), 'error': str(e)})

    logger.info(f'Sync complete: {new_count} new, {len(errors)} errors')
    if errors:
        _send_error_email(errors)
    return {'new_count': new_count, 'errors': errors}


def _search_posts() -> list[dict]:
    """
    Search the Google Group for posts matching either title prefix.
    Returns a deduplicated list of post dicts keyed by thread ID.
    """
    posts = {}

    for prefix in TITLE_PREFIXES:
        url = f'{BASE}/g/{GROUP}/search?q={quote(prefix)}'
        try:
            r = requests.get(url, headers=HEADERS, timeout=20)
            r.raise_for_status()
        except requests.RequestException as e:
            logger.error(f'Search request failed for "{prefix}": {e}')
            continue

        soup = BeautifulSoup(r.text, 'lxml')

        for a in soup.find_all('a', href=True):
            href = a['href']
            text = a.get_text(strip=True)

            if '/c/' not in href or GROUP not in href:
                continue

            # Only keep links whose visible text starts with a known prefix
            if not any(text.startswith(p) for p in TITLE_PREFIXES):
                continue

            # Extract thread ID from ./g/tartey_mashma/c/{thread_id}/m/{msg_id}
            match = re.search(r'/c/([^/]+)', href)
            if not match:
                continue
            thread_id = match.group(1)

            if thread_id in posts:
                continue

            # Normalize the post URL (strip leading ./ if relative)
            if href.startswith('./'):
                href = href[2:]
            post_url = BASE + '/' + href.lstrip('/')

            # Extract clean title: just the "דקל בנו שני DD.MM.YY" part
            title = _extract_title(text)

            posts[thread_id] = {
                'post_id': thread_id,
                'post_url': post_url,
                'title': title,
                'day_of_week': 'monday' if 'שני' in title else 'wednesday',
                'published_at': _parse_date(title),
            }

    return list(posts.values())


def _extract_title(text: str) -> str:
    """
    Extract just the 'דקל בנו שני/רביעי DD.MM.YY(YY)' part from a
    search result snippet (which appends the message body after the title).
    """
    match = re.match(r'(דקל בנו (?:שני|רביעי)\s+\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4})', text)
    if match:
        return match.group(1).strip()
    # Fallback: take text up to first newline or non-title content
    return text.split('\n')[0][:60].strip()


def _parse_date(title: str):
    """Parse DD.MM.YY or DD.MM.YYYY from a title string."""
    match = re.search(r'(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})', title)
    if not match:
        return None
    d, m, y = match.groups()
    year = int(y)
    if year < 100:
        year += 2000
    try:
        return datetime(year, int(m), int(d), tzinfo=timezone.utc).isoformat()
    except ValueError:
        return None


def _is_image_url(url: str) -> bool:
    path = unquote(url).split('?')[0].lower()
    return any(path.endswith(ext) for ext in IMAGE_EXTS)


def _download_image(post_url: str) -> bytes | None:
    """Fetch the post page and download the image attachment."""
    try:
        r = requests.get(post_url, headers=HEADERS, timeout=20)
        r.raise_for_status()
    except requests.RequestException as e:
        logger.error(f'Failed to fetch post page {post_url}: {e}')
        return None

    soup = BeautifulSoup(r.text, 'lxml')
    attach_links = [
        a['href'] for a in soup.find_all('a', href=True)
        if 'attach' in a['href']
    ]
    img_links = [l for l in attach_links if _is_image_url(l)]

    if not img_links:
        logger.warning(f'No image attachment found at {post_url}')
        return None

    r2 = requests.get(img_links[0], headers=HEADERS, timeout=30, allow_redirects=True)
    if not r2.headers.get('Content-Type', '').startswith('image'):
        logger.warning(f'Attachment is not an image: {r2.headers.get("Content-Type")}')
        return None

    return r2.content


def _upload_image(db, image_bytes: bytes, post_id: str) -> tuple[str, str]:
    """Upload image bytes to Supabase Storage. Returns (storage_path, public_url)."""
    storage_path = f'puzzles/{post_id}.jpg'
    db.storage.from_('puzzle-images').upload(
        path=storage_path,
        file=image_bytes,
        file_options={'content-type': 'image/jpeg', 'upsert': 'true'},
    )
    public_url = db.storage.from_('puzzle-images').get_public_url(storage_path)
    return storage_path, public_url


def _send_error_email(errors: list):
    """Send an email notification when one or more puzzles fail to process."""
    import smtplib
    from email.mime.text import MIMEText

    smtp_host = os.getenv('SMTP_HOST', 'smtp.gmail.com')
    smtp_port = int(os.getenv('SMTP_PORT', '587'))
    smtp_user = os.getenv('SMTP_USER')
    smtp_password = os.getenv('SMTP_PASSWORD')
    notify_email = os.getenv('NOTIFY_EMAIL')

    if not all([smtp_user, smtp_password, notify_email]):
        logger.warning('Error email skipped: SMTP_USER, SMTP_PASSWORD, or NOTIFY_EMAIL not set')
        return

    lines = '\n'.join(f'- {e["title"]}: {e["error"]}' for e in errors)
    body = f'The following crossword puzzle(s) failed to upload:\n\n{lines}'

    msg = MIMEText(body, 'plain', 'utf-8')
    msg['Subject'] = f'Crossword solver: {len(errors)} puzzle(s) failed to upload'
    msg['From'] = smtp_user
    msg['To'] = notify_email

    try:
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.send_message(msg)
        logger.info(f'Error notification sent to {notify_email}')
    except Exception as e:
        logger.error(f'Failed to send error notification email: {e}')


def _insert_puzzle(db, post: dict, storage_path: str, public_url: str, processed_data: dict):
    """Insert a completed puzzle record into Supabase."""
    db.table('puzzles').insert({
        'google_group_post_id': post['post_id'],
        'post_url': post['post_url'],
        'title': post['title'],
        'published_at': post['published_at'],
        'day_of_week': post['day_of_week'],
        'image_storage_path': storage_path,
        'image_public_url': public_url,
        'processed_data': processed_data,
        'processing_status': 'done',
    }).execute()
