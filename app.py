import os
import re
import io
import uuid
import threading
import subprocess
import urllib.request
from datetime import datetime
from flask import Flask, render_template, request, jsonify, send_file
from flask_cors import CORS
from PIL import Image
import yt_dlp
import mutagen
from mutagen.mp3 import MP3
from mutagen.id3 import ID3, APIC, TIT2, TPE1, error

app = Flask(__name__)
CORS(app)

# Default download folder: User's Downloads/RipNexus
DOWNLOAD_DIR = os.path.join(os.path.expanduser('~'), 'Downloads', 'RipNexus')
os.makedirs(DOWNLOAD_DIR, exist_ok=True)

# Active download tasks and history
# { task_id: { status, percent, speed, eta, filename, filepath, format, error } }
TASKS = {}
HISTORY = []

def make_square_cover(image_bytes):
    """Crops the center of an image into a 1:1 high-resolution square album cover art"""
    img = Image.open(io.BytesIO(image_bytes)).convert('RGB')
    w, h = img.size
    min_dim = min(w, h)
    left = (w - min_dim) // 2
    top = (h - min_dim) // 2
    square_img = img.crop((left, top, left + min_dim, top + min_dim))
    out = io.BytesIO()
    square_img.save(out, format='JPEG', quality=95)
    return out.getvalue()

def load_existing_files():
    """Populate history with existing files in RipNexus download directory on startup"""
    if not os.path.exists(DOWNLOAD_DIR):
        return
    try:
        files = [f for f in os.listdir(DOWNLOAD_DIR) if os.path.isfile(os.path.join(DOWNLOAD_DIR, f))]
        files.sort(key=lambda f: os.path.getmtime(os.path.join(DOWNLOAD_DIR, f)), reverse=True)
        for fname in files:
            if fname.endswith(('.part', '.ytdl', '.tmp')):
                continue
            fpath = os.path.join(DOWNLOAD_DIR, fname)
            ext = os.path.splitext(fname)[1].lower()
            if ext == '.mp3':
                fmt = 'MP3'
            elif ext in ('.jpg', '.jpeg', '.png', '.webp'):
                fmt = 'COVER' if 'cover' in fname.lower() else 'THUMBNAIL'
            else:
                fmt = 'MP4'

            file_size = os.path.getsize(fpath)
            size_str = f"{file_size / (1024 * 1024):.1f} MB" if file_size >= 1024 * 1024 else f"{file_size / 1024:.1f} KB"
            task_id = str(uuid.uuid4())[:8]
            mod_time = datetime.fromtimestamp(os.path.getmtime(fpath)).strftime('%H:%M:%S')
            
            # Clean title
            title = os.path.splitext(fname)[0]
            if '-' in title and len(title.split('-')[-1]) == 11:
                title = '-'.join(title.split('-')[:-1])

            HISTORY.append({
                'id': task_id,
                'title': title,
                'filename': fname,
                'filepath': fpath,
                'filesize': size_str,
                'format': fmt,
                'thumbnail': '',
                'date': mod_time
            })
    except Exception as e:
        print(f"Error loading existing files: {e}")

load_existing_files()

def format_duration(seconds):
    if not seconds:
        return "Live / Unknown"
    m, s = divmod(int(seconds), 60)
    h, m = divmod(m, 60)
    if h > 0:
        return f"{h}:{m:02d}:{s:02d}"
    return f"{m}:{s:02d}"

def format_number(num):
    if not num:
        return "0"
    num = int(num)
    if num >= 1_000_000:
        return f"{num / 1_000_000:.1f}M"
    if num >= 1_000:
        return f"{num / 1_000:.1f}K"
    return str(num)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/inspect', methods=['POST'])
def inspect_url():
    data = request.get_json() or {}
    url = data.get('url', '').strip()
    if not url:
        return jsonify({'error': 'Please provide a valid URL'}), 400

    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': False,
        'skip_download': True
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            if not info:
                return jsonify({'error': 'Could not extract media info'}), 404

            # Detect available resolutions
            formats = info.get('formats', [])
            has_4k = any(f.get('height') and f.get('height') >= 2160 for f in formats)
            has_1440 = any(f.get('height') and f.get('height') >= 1440 for f in formats)
            has_1080 = any(f.get('height') and f.get('height') >= 1080 for f in formats)
            has_720 = any(f.get('height') and f.get('height') >= 720 for f in formats)

            best_thumb = info.get('thumbnail')
            if not best_thumb and info.get('thumbnails'):
                best_thumb = info['thumbnails'][-1].get('url')

            return jsonify({
                'title': info.get('title', 'Unknown Title'),
                'author': info.get('uploader') or info.get('channel') or info.get('creator') or 'Creator',
                'thumbnail': best_thumb,
                'duration': format_duration(info.get('duration')),
                'views': format_number(info.get('view_count')),
                'platform': info.get('extractor_key', 'Web'),
                'has_4k': has_4k,
                'has_1440': has_1440,
                'has_1080': has_1080,
                'has_720': has_720,
                'original_url': url
            })
    except Exception as e:
        print(f"Inspect error: {e}")
        return jsonify({'error': f"Could not inspect URL: {str(e)}"}), 500

def run_download_thread(task_id, url, format_type):
    fmt_display = {
        'mp3': 'MP3 AUDIO',
        '4k': '4K VIDEO',
        '1080p': '1080P VIDEO',
        '720p': '720P VIDEO',
        'thumbnail': 'HD THUMBNAIL (16:9)',
        'cover': 'SONG COVER ART (1:1)'
    }.get(format_type, format_type.upper())

    TASKS[task_id] = {
        'status': 'starting',
        'percent': 0,
        'speed': '0 MB/s',
        'eta': 'Calculating...',
        'filename': '',
        'filepath': '',
        'format': fmt_display
    }

    # 1. SPECIAL CASE: IMAGE DOWNLOADS (THUMBNAIL OR SQUARE SONG COVER)
    if format_type in ('thumbnail', 'cover'):
        try:
            TASKS[task_id].update({'status': 'downloading', 'percent': 40, 'speed': 'Fetching image...', 'eta': '1s'})
            ydl_opts = {'quiet': True, 'skip_download': True}
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                best_thumb_url = info.get('thumbnail')
                if not best_thumb_url and info.get('thumbnails'):
                    best_thumb_url = info['thumbnails'][-1].get('url')

                req = urllib.request.Request(best_thumb_url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req) as resp:
                    raw_img = resp.read()

                clean_title = re.sub(r'[\\/*?:"<>|]', "", info.get('title', 'Media'))[:70]
                vid_id = info.get('id', task_id)

                if format_type == 'cover':
                    img_bytes = make_square_cover(raw_img)
                    out_filename = f"{clean_title}-{vid_id}-Cover.jpg"
                else:
                    img_obj = Image.open(io.BytesIO(raw_img)).convert('RGB')
                    out_buf = io.BytesIO()
                    img_obj.save(out_buf, format='JPEG', quality=95)
                    img_bytes = out_buf.getvalue()
                    out_filename = f"{clean_title}-{vid_id}-Thumbnail.jpg"

                out_filepath = os.path.join(DOWNLOAD_DIR, out_filename)
                with open(out_filepath, 'wb') as f:
                    f.write(img_bytes)

                size_str = f"{len(img_bytes) / 1024:.1f} KB"
                TASKS[task_id].update({
                    'status': 'finished',
                    'percent': 100,
                    'speed': 'Completed',
                    'eta': '0s',
                    'filename': out_filename,
                    'filepath': out_filepath,
                    'filesize': size_str,
                    'format': fmt_display,
                    'title': info.get('title', 'Media'),
                    'thumbnail': best_thumb_url
                })

                HISTORY.insert(0, {
                    'id': task_id,
                    'title': info.get('title', 'Media'),
                    'filename': out_filename,
                    'filepath': out_filepath,
                    'filesize': size_str,
                    'format': 'COVER' if format_type == 'cover' else 'THUMBNAIL',
                    'thumbnail': best_thumb_url,
                    'date': datetime.now().strftime('%H:%M:%S')
                })
                return
        except Exception as e:
            print(f"Image download error: {e}")
            TASKS[task_id].update({'status': 'error', 'error': str(e)})
            return

    # 2. MEDIA STREAM DOWNLOADS (VIDEO OR MP3)
    def progress_hook(d):
        if d['status'] == 'downloading':
            total = d.get('total_bytes') or d.get('total_bytes_estimate') or 1
            downloaded = d.get('downloaded_bytes') or 0
            percent = round((downloaded / total) * 100, 1)
            speed = d.get('speed') or 0
            speed_str = f"{round(speed / (1024 * 1024), 2)} MB/s" if speed else "Calculating..."
            eta = d.get('eta') or 0
            TASKS[task_id].update({
                'status': 'downloading',
                'percent': percent,
                'speed': speed_str,
                'eta': f"{eta}s"
            })
        elif d['status'] == 'finished':
            TASKS[task_id].update({
                'status': 'processing',
                'percent': 100,
                'speed': 'Embedding album art & finalizing...',
                'eta': 'Finishing up'
            })

    outtmpl = os.path.join(DOWNLOAD_DIR, '%(title).100s-%(id)s.%(ext)s')

    if format_type == 'mp3':
        ydl_opts = {
            'format': 'bestaudio/best',
            'outtmpl': outtmpl,
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '320',
            }],
            'progress_hooks': [progress_hook],
            'quiet': True,
            'no_warnings': True
        }
    elif format_type == '4k':
        ydl_opts = {
            'format': 'bestvideo+bestaudio/best',
            'outtmpl': outtmpl,
            'merge_output_format': 'mp4',
            'progress_hooks': [progress_hook],
            'quiet': True,
            'no_warnings': True
        }
    elif format_type == '720p':
        ydl_opts = {
            'format': 'bestvideo[height<=720]+bestaudio/best[height<=720]/best',
            'outtmpl': outtmpl,
            'merge_output_format': 'mp4',
            'progress_hooks': [progress_hook],
            'quiet': True,
            'no_warnings': True
        }
    else:  # Default 1080p
        ydl_opts = {
            'format': 'bestvideo[height<=1080]+bestaudio/best[height<=1080]/best',
            'outtmpl': outtmpl,
            'merge_output_format': 'mp4',
            'progress_hooks': [progress_hook],
            'quiet': True,
            'no_warnings': True
        }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            filename = ydl.prepare_filename(info)

            # MP3 POST-PROCESSING: EMBED 1:1 SQUARE ALBUM COVER ART
            if format_type == 'mp3':
                base, _ = os.path.splitext(filename)
                filename = f"{base}.mp3"
                try:
                    best_thumb = info.get('thumbnail')
                    if not best_thumb and info.get('thumbnails'):
                        best_thumb = info['thumbnails'][-1].get('url')

                    if best_thumb:
                        req = urllib.request.Request(best_thumb, headers={'User-Agent': 'Mozilla/5.0'})
                        with urllib.request.urlopen(req) as r:
                            raw_thumb_data = r.read()

                        square_cover_bytes = make_square_cover(raw_thumb_data)

                        # Embed album cover in ID3 tags (APIC frame)
                        audio = MP3(filename, ID3=ID3)
                        try:
                            audio.add_tags()
                        except error:
                            pass

                        audio.tags.add(APIC(
                            encoding=3,
                            mime='image/jpeg',
                            type=3,  # Front cover
                            desc='Cover',
                            data=square_cover_bytes
                        ))

                        artist = info.get('uploader') or info.get('channel') or info.get('creator') or ''
                        song_title = info.get('title') or ''
                        if artist:
                            audio.tags.add(TPE1(encoding=3, text=artist))
                        if song_title:
                            audio.tags.add(TIT2(encoding=3, text=song_title))

                        audio.save(v2_version=3)

                        # Also save standalone high-res cover art in the folder!
                        cover_save_path = f"{base}-Cover.jpg"
                        with open(cover_save_path, 'wb') as cf:
                            cf.write(square_cover_bytes)
                except Exception as cover_err:
                    print(f"Cover embed warning: {cover_err}")

            file_size_bytes = os.path.getsize(filename) if os.path.exists(filename) else 0
            size_mb = f"{file_size_bytes / (1024 * 1024):.1f} MB"

            TASKS[task_id].update({
                'status': 'finished',
                'percent': 100,
                'speed': 'Completed',
                'eta': '0s',
                'filename': os.path.basename(filename),
                'filepath': filename,
                'filesize': size_mb,
                'format': fmt_display,
                'title': info.get('title', 'Video'),
                'thumbnail': info.get('thumbnail')
            })

            # Add to history at top
            HISTORY.insert(0, {
                'id': task_id,
                'title': info.get('title', 'Video'),
                'filename': os.path.basename(filename),
                'filepath': filename,
                'filesize': size_mb,
                'format': 'MP3' if format_type == 'mp3' else 'MP4',
                'thumbnail': info.get('thumbnail'),
                'date': datetime.now().strftime('%H:%M:%S')
            })
    except Exception as e:
        print(f"Download thread error: {e}")
        TASKS[task_id].update({
            'status': 'error',
            'error': str(e)
        })

@app.route('/api/download', methods=['POST'])
def start_download():
    data = request.get_json() or {}
    url = data.get('url', '').strip()
    format_type = data.get('format', '1080p')

    if not url:
        return jsonify({'error': 'No URL provided'}), 400

    task_id = str(uuid.uuid4())[:8]
    thread = threading.Thread(target=run_download_thread, args=(task_id, url, format_type), daemon=True)
    thread.start()

    return jsonify({'task_id': task_id, 'status': 'started'})

@app.route('/api/progress/<task_id>')
def get_progress(task_id):
    task = TASKS.get(task_id)
    if not task:
        return jsonify({'status': 'not_found'}), 404
    return jsonify(task)

@app.route('/api/history')
def get_history():
    return jsonify({'history': HISTORY[:30], 'download_dir': DOWNLOAD_DIR})

@app.route('/api/stream/<task_id>')
def stream_file(task_id):
    """Native partial byte-range media stream for instant HTML5 video/audio/image playback and seeking"""
    filepath = None
    task = TASKS.get(task_id)
    if task and task.get('filepath') and os.path.exists(task['filepath']):
        filepath = task['filepath']
    else:
        for item in HISTORY:
            if item.get('id') == task_id and os.path.exists(item.get('filepath', '')):
                filepath = item['filepath']
                break

    if not filepath or not os.path.exists(filepath):
        return "File not found or expired", 404

    ext = os.path.splitext(filepath)[1].lower()
    mimetypes_map = {
        '.mp4': 'video/mp4',
        '.mkv': 'video/mp4',
        '.webm': 'video/webm',
        '.mov': 'video/quicktime',
        '.mp3': 'audio/mpeg',
        '.m4a': 'audio/mp4',
        '.opus': 'audio/opus',
        '.wav': 'audio/wav',
        '.flac': 'audio/flac',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp'
    }
    mimetype = mimetypes_map.get(ext, 'video/mp4')
    return send_file(filepath, mimetype=mimetype, as_attachment=False, conditional=True)

@app.route('/api/open_folder', methods=['POST'])
def open_folder():
    data = request.get_json() or {}
    filepath = data.get('filepath')
    try:
        if filepath and os.path.exists(filepath):
            subprocess.Popen(f'explorer.exe /select,"{os.path.abspath(filepath)}"')
        else:
            os.startfile(DOWNLOAD_DIR)
        return jsonify({'success': True})
    except Exception as e:
        print(f"Open folder error: {e}")
        try:
            os.system(f'start "" "{DOWNLOAD_DIR}"')
            return jsonify({'success': True})
        except:
            return jsonify({'error': str(e)}), 500

@app.route('/api/get_file/<task_id>')
def get_file(task_id):
    task = TASKS.get(task_id)
    filepath = None
    filename = 'media.mp4'
    if task and task.get('filepath') and os.path.exists(task['filepath']):
        filepath = task['filepath']
        filename = task.get('filename', 'media.mp4')
    else:
        for item in HISTORY:
            if item.get('id') == task_id and os.path.exists(item.get('filepath', '')):
                filepath = item['filepath']
                filename = item.get('filename', 'media.mp4')
                break

    if not filepath or not os.path.exists(filepath):
        return "File not found or expired", 404
    return send_file(filepath, as_attachment=True, download_name=filename)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5050))
    print("==================================================")
    print("   ⚡ RipNexus — Ad-Free High-Speed Downloader")
    print(f"   Saving files to: {DOWNLOAD_DIR}")
    print(f"   Web Dashboard: http://localhost:{port}")
    print("==================================================")
    app.run(host='0.0.0.0', port=port, debug=False)
