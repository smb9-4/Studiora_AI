import os
import json
import sqlite3
import hashlib
from flask import Flask, render_template, request, redirect, url_for, session, jsonify, send_from_directory, Response
from jinja2 import ChoiceLoader, FileSystemLoader
from ai_service_client import (list_chats, create_chat, get_chat_history, stream_chat,
                               list_generated_documents, upload_file, list_chat_files, delete_chat,
                               ensure_user, get_user_stats)
from prof_ai_service_client import (ensure_user as prof_ensure_user,
                                    get_user_stats as prof_get_user_stats,
                                    list_chats as prof_list_chats,
                                    list_generated_documents as prof_list_docs)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = Flask(
    __name__,
    static_folder=os.path.join(BASE_DIR, 'studyoff'),
    static_url_path='/static',
    template_folder=os.path.join(BASE_DIR, 'templates')
)
app.jinja_loader = ChoiceLoader([
    FileSystemLoader(os.path.join(BASE_DIR, 'templates')),
    FileSystemLoader(os.path.join(BASE_DIR, 'templates', 'templates_student')),
    FileSystemLoader(os.path.join(BASE_DIR, 'templates', 'templates_prof')),
])
app.secret_key = os.environ.get("Studiora_SECRET", "dev-secret-change-in-production-fixed-key-for-dev")

DB_PATH = os.path.join(BASE_DIR, 'users.db')

DASHBOARD_STATS = {
    'total_students': 0,
    'total_documents': 0,
    'total_ai_chats': 0,
    'active_today': 0,
    'documents_this_week': 0,
    'avg_chat_session_min': 0,
}

RECENT_ACTIVITY = [
    # cleared dummy recent activity
]

STUDENTS = [
    # cleared dummy students
]

DOCUMENTS = [
    # cleared dummy documents
]

CHAT_MESSAGES = [
    # cleared dummy chat messages
]

ACTIVITY_TIMELINE = [
    # cleared activity timeline
]

PROFESSOR_PROFILE = {
    # keep profile minimal; no dummy values
    'name': '',
    'email': '',
    'department': '',
}

PREVIEW_DOCS = {}


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    conn.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT,
            username TEXT UNIQUE,
            password TEXT NOT NULL,
            name TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('student', 'professor')),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS student_profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER UNIQUE,
            email TEXT,
            phone TEXT,
            education_level TEXT,
            degree TEXT,
            year_semester TEXT,
            academic_goals TEXT,
            avatar TEXT,
            updated_at TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS activity_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            event_type TEXT,
            detail TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS ai_chat_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            chat_id INTEGER NOT NULL,
            title TEXT DEFAULT 'New chat',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ''')
    try:
        conn.execute('ALTER TABLE users ADD COLUMN department TEXT')
    except sqlite3.OperationalError:
        pass
    conn.commit()
    conn.close()


init_db()


def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()


def get_student_profile(user_id):
    conn = get_db()
    row = conn.execute(
        '''
        SELECT u.username,
               u.name AS full_name,
               p.email,
               p.phone,
               p.education_level,
               p.degree,
               p.year_semester,
               p.academic_goals,
               p.avatar,
               p.updated_at
        FROM users u
        LEFT JOIN student_profiles p ON u.id = p.user_id
        WHERE u.id = ? AND u.role = 'student'
        ''',
        (user_id,)
    ).fetchone()
    conn.close()
    if not row:
        return None
    return {
        'username': row['username'],
        'full_name': row['full_name'],
        'email': row['email'] or '',
        'phone': row['phone'] or '',
        'education_level': row['education_level'] or '',
        'degree': row['degree'] or '',
        'year_semester': row['year_semester'] or '',
        'academic_goals': row['academic_goals'] or '',
        'avatar': row['avatar'] or None,
        'updated_at': row['updated_at'],
    }


def get_professor_profile(user_id):
    conn = get_db()
    row = conn.execute(
        '''
        SELECT email, name, department
        FROM users
        WHERE id = ? AND role = 'professor'
        ''',
        (user_id,)
    ).fetchone()
    conn.close()
    if not row:
        return None
    return {
        'email': row['email'] or '',
        'name': row['name'] or '',
        'department': row['department'] or '',
    }


def log_activity(user_id, event_type, detail):
    conn = get_db()
    conn.execute(
        'INSERT INTO activity_logs (user_id, event_type, detail) VALUES (?, ?, ?)',
        (user_id, event_type, detail)
    )
    conn.commit()
    conn.close()


def get_recent_activity(limit=10):
    conn = get_db()
    rows = conn.execute(
        '''
        SELECT a.event_type, a.detail, a.created_at, u.name AS user_name
        FROM activity_logs a
        JOIN users u ON u.id = a.user_id
        ORDER BY a.created_at DESC
        LIMIT ?
        ''',
        (limit,)
    ).fetchall()
    conn.close()
    return [
        {
            'type': row['event_type'],
            'detail': row['detail'],
            'time': row['created_at'],
            'user_name': row['user_name'],
        }
        for row in rows
    ]


def get_dashboard_stats():
    conn = get_db()
    total_students = conn.execute("SELECT COUNT(*) FROM users WHERE role = 'student'").fetchone()[0]
    active_today = conn.execute(
        "SELECT COUNT(DISTINCT user_id) FROM activity_logs WHERE DATE(created_at) = DATE('now')"
    ).fetchone()[0]
    total_documents = conn.execute("SELECT COUNT(*) FROM student_profiles WHERE degree IS NOT NULL").fetchone()[0]
    recent_logs = conn.execute(
        "SELECT COUNT(*) FROM activity_logs WHERE event_type = 'chat' AND DATE(created_at) = DATE('now')"
    ).fetchone()[0]
    conn.close()
    return {
        'total_students': total_students,
        'total_documents': total_documents,
        'total_ai_chats': recent_logs,
        'active_today': active_today,
        'documents_this_week': 0,
        'avg_chat_session_min': 0,
    }


def get_all_students():
    conn = get_db()
    rows = conn.execute(
        """
        SELECT
            u.name AS full_name,
            u.username,
            COALESCE(u.email, p.email, '') AS email,
            COALESCE(u.department, '') AS department,
            CASE
                WHEN EXISTS(
                    SELECT 1 FROM activity_logs a WHERE a.user_id = u.id
                ) THEN 'Active'
                ELSE 'Pending'
            END AS status
        FROM users u
        LEFT JOIN student_profiles p ON u.id = p.user_id
        WHERE u.role = 'student'
        ORDER BY u.name COLLATE NOCASE
        """
    ).fetchall()
    conn.close()
    return [
        {
            'name': row['full_name'] or row['username'],
            'username': row['username'] or '',
            'email': row['email'] or '',
            'department': row['department'] or '',
            'status': row['status'] or 'Pending',
        }
        for row in rows
    ]


@app.route('/professor/static/<path:filename>')
def professor_static(filename):
    return send_from_directory(os.path.join(BASE_DIR, 'studyoff', 'static_prof'), filename)


@app.route('/student/static/<path:filename>')
def student_static(filename):
    return send_from_directory(os.path.join(BASE_DIR, 'studyoff', 'static_student'), filename)


@app.route('/')
def landing():
    return render_template('index.html')


@app.route('/student_login', methods=['GET'])
def student_login():
    return render_template('student_login.html')


@app.route('/student_signup', methods=['GET'])
def student_signup():
    return render_template('student_signup.html')


@app.route('/professor_signup', methods=['GET'])
def professor_signup():
    return render_template('professor_signup.html')


@app.route('/professor_login', methods=['GET'])
def professor_login():
    return render_template('professor_login.html')


@app.route('/login', methods=['GET'])
def login():
    return redirect(url_for('student_login'))


@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.form
    password = data.get('password', '')
    role = data.get('role', '')

    if not password or not role:
        return jsonify({'error': 'All fields are required'}), 400

    conn = get_db()
    user = None

    if role == 'student':
        username = data.get('username', '').strip().lower()
        if not username:
            conn.close()
            return jsonify({'error': 'Username is required.'}), 400
        user = conn.execute(
            'SELECT * FROM users WHERE username = ? AND role = ?',
            (username, role)
        ).fetchone()
    else:
        email = data.get('email', '').strip().lower()
        if not email:
            conn.close()
            return jsonify({'error': 'Email is required.'}), 400
        user = conn.execute(
            'SELECT * FROM users WHERE email = ? AND role = ?',
            (email, role)
        ).fetchone()

    conn.close()

    if not user or user['password'] != hash_password(password):
        return jsonify({'error': 'Invalid credentials.'}), 401

    if not user['username'] and user['email']:
        # Backfill username from email for professor accounts
        derived = user['email'].split('@')[0]
        conn = get_db()
        conn.execute('UPDATE users SET username = ? WHERE id = ?', (derived, user['id']))
        conn.commit()
        conn.close()
        user['username'] = derived

    session['user_id'] = user['id']
    session['role'] = user['role']
    session['name'] = user['name']
    session['username'] = user['username']

    if user['role'] == 'student':
        log_activity(user['id'], 'login', f"{user['name']} logged in")

    return jsonify({
        'success': True,
        'role': user['role'],
        'redirect': url_for('student_dashboard') if user['role'] == 'student' else url_for('professor_dashboard')
    })


@app.route('/api/professor/profile', methods=['GET'])
def api_get_professor_profile():
    if session.get('role') != 'professor':
        return jsonify({'error': 'Unauthorized'}), 401

    profile = get_professor_profile(session['user_id'])
    return jsonify({'success': True, 'profile': profile or {'email': '', 'name': '', 'department': ''}})


@app.route('/api/professor/profile', methods=['POST'])
def api_update_professor_profile():
    if session.get('role') != 'professor':
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.get_json(silent=True) or request.form
    name = (data.get('name') or '').strip()
    department = (data.get('department') or '').strip()
    current_password = (data.get('current_password') or '').strip()
    new_password = (data.get('new_password') or '').strip()
    confirm_password = (data.get('confirm_password') or '').strip()

    if not name:
        return jsonify({'error': 'Name is required'}), 400
    if not department:
        return jsonify({'error': 'Department is required'}), 400

    user_id = session['user_id']
    conn = get_db()

    if new_password or confirm_password:
        if not current_password:
            conn.close()
            return jsonify({'error': 'Current password is required to change password'}), 400
        user = conn.execute('SELECT password FROM users WHERE id = ?', (user_id,)).fetchone()
        if not user or user['password'] != hash_password(current_password):
            conn.close()
            return jsonify({'error': 'Current password is incorrect'}), 401
        if new_password != confirm_password:
            conn.close()
            return jsonify({'error': 'Passwords do not match'}), 400
        conn.execute('UPDATE users SET password = ? WHERE id = ?', (hash_password(new_password), user_id))

    conn.execute(
        'UPDATE users SET name = ?, department = ? WHERE id = ?',
        (name, department, user_id)
    )
    conn.commit()
    conn.close()

    session['name'] = name
    log_activity(user_id, 'profile_update', f"{name} updated professor profile")
    profile = get_professor_profile(user_id)
    return jsonify({'success': True, 'profile': profile})


@app.route('/api/register', methods=['POST'])
def api_register():
    data = request.form
    name = data.get('name', '').strip()
    password = data.get('password', '')
    role = data.get('role', '')

    if not name or not password or not role:
        return jsonify({'error': 'All fields are required'}), 400

    if role not in ('student', 'professor'):
        return jsonify({'error': 'Invalid role'}), 400

    conn = get_db()

    if role == 'student':
        username = data.get('username', '').strip().lower()
        if not username:
            conn.close()
            return jsonify({'error': 'Username is required.'}), 400
        existing = conn.execute(
            'SELECT id FROM users WHERE username = ?', (username,)
        ).fetchone()
        if existing:
            conn.close()
            return jsonify({'error': 'Username already taken.'}), 409
        conn.execute(
            'INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)',
            (username, hash_password(password), name, role)
        )
    else:
        email = data.get('email', '').strip().lower()
        if not email:
            conn.close()
            return jsonify({'error': 'Email is required.'}), 400
        existing = conn.execute(
            'SELECT id FROM users WHERE email = ?', (email,)
        ).fetchone()
        if existing:
            conn.close()
            return jsonify({'error': 'Email already registered.'}), 409
        prof_username = email.split('@')[0]
        conn.execute(
            'INSERT INTO users (email, username, password, name, role) VALUES (?, ?, ?, ?, ?)',
            (email, prof_username, hash_password(password), name, role)
        )

    conn.commit()
    conn.close()

    return jsonify({'success': True, 'message': 'Registration successful. Please log in.'})


@app.route('/api/student/profile', methods=['GET'])
def api_get_student_profile():
    if session.get('role') != 'student':
        return jsonify({'error': 'Unauthorized'}), 401

    profile = get_student_profile(session['user_id'])
    if not profile:
        profile = {
            'username': '',
            'full_name': session.get('name', ''),
            'email': '',
            'phone': '',
            'education_level': '',
            'degree': '',
            'year_semester': '',
            'academic_goals': '',
            'avatar': None,
            'updated_at': None,
        }
    return jsonify({'success': True, 'profile': profile})


@app.route('/api/student/profile', methods=['POST'])
def api_update_student_profile():
    if session.get('role') != 'student':
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.get_json(silent=True) or request.form
    full_name = (data.get('full_name') or '').strip()
    email = (data.get('email') or '').strip()
    phone = (data.get('phone') or '').strip()
    education_level = (data.get('education_level') or '').strip()
    degree = (data.get('degree') or '').strip()
    year_semester = (data.get('year_semester') or '').strip()
    academic_goals = (data.get('academic_goals') or '').strip()
    current_password = (data.get('current_password') or '').strip()
    new_password = (data.get('new_password') or '').strip()
    confirm_password = (data.get('confirm_password') or '').strip()
    avatar = data.get('avatar')

    if not full_name:
        return jsonify({'error': 'Full name is required'}), 400
    if not email:
        return jsonify({'error': 'Email is required'}), 400

    user_id = session['user_id']
    conn = get_db()

    if new_password or confirm_password:
        if not current_password:
            conn.close()
            return jsonify({'error': 'Current password is required to change password'}), 400
        user = conn.execute('SELECT password FROM users WHERE id = ?', (user_id,)).fetchone()
        if not user or user['password'] != hash_password(current_password):
            conn.close()
            return jsonify({'error': 'Current password is incorrect'}), 401
        if new_password != confirm_password:
            conn.close()
            return jsonify({'error': 'Passwords do not match'}), 400
        conn.execute('UPDATE users SET password = ? WHERE id = ?', (hash_password(new_password), user_id))

    conn.execute(
        'UPDATE users SET name = ? WHERE id = ?',
        (full_name, user_id)
    )

    existing = conn.execute(
        'SELECT id FROM student_profiles WHERE user_id = ?',
        (user_id,)
    ).fetchone()

    if existing:
        conn.execute(
            '''
            UPDATE student_profiles
            SET email = ?, phone = ?, education_level = ?, degree = ?,
                year_semester = ?, academic_goals = ?, avatar = ?, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
            ''',
            (email, phone, education_level, degree, year_semester, academic_goals, avatar, user_id)
        )
    else:
        conn.execute(
            '''
            INSERT INTO student_profiles
                (user_id, email, phone, education_level, degree, year_semester, academic_goals, avatar, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ''',
            (user_id, email, phone, education_level, degree, year_semester, academic_goals, avatar)
        )

    conn.commit()
    conn.close()

    log_activity(user_id, 'profile_update', f"{full_name} updated profile")

    profile = get_student_profile(user_id)
    session['name'] = full_name
    return jsonify({'success': True, 'profile': profile})


@app.route('/api/logout')
def api_logout():
    session.clear()
    return redirect(url_for('login'))


def get_student_user():
    profile = get_student_profile(session['user_id'])
    initials = ''.join(w[0].upper() for w in (session.get('name', 'S').split()) if w)[:2] or 'S'
    name = session.get('name', 'Student')
    username = session.get('username', '')
    return {
        'name': name,
        'initials': initials,
        'username': username,
        'email': profile['email'] if profile else '',
    }


@app.route('/dashboard/student')
def student_dashboard():
    if session.get('role') != 'student':
        return redirect(url_for('login'))
    user = get_student_user()
    profile = get_student_profile(session['user_id'])
    username = session.get('username', '')
    name = session.get('name', '')

    if username:
        ensure_user(username, name)
    ai_chats = list_chats(username, name) if username else []
    ai_docs = list_generated_documents(username) if username else []
    stats_data = get_user_stats(username, name) if username else {}
    recent_activity = []
    continue_learning = []
    recent_ai = []

    for chat in ai_chats[-5:]:
        recent_ai.append({
            'title': chat.get('title', 'AI Chat'),
            'preview': f"Updated: {chat.get('updated_at', 'recently')}",
            'time': chat.get('updated_at', ''),
        })

    for item in (stats_data.get('recent') or []):
        if item['kind'] == 'chat':
            recent_activity.append({
                'icon': '🤖',
                'title': f"Chat: {item['title']}",
                'time': item['ts'] or '',
            })
        elif item['kind'] == 'doc':
            recent_activity.append({
                'icon': '📝',
                'title': f"Generated: {item['title']}",
                'time': item['ts'] or '',
            })

    return render_template(
        'templates_student/dashboard.html',
        user=user,
        page_title='Dashboard',
        active_page='dashboard',
        stats={
            'ai_chats_count': stats_data.get('chats', len(ai_chats)),
            'generated_notes_count': stats_data.get('generated_docs', len(ai_docs)),
            'learning_progress': 0,
            'total_documents': stats_data.get('uploaded_files', 0),
        },
        recent_activity=recent_activity,
        continue_learning=continue_learning,
        recent_ai=recent_ai,
    )


@app.route('/ai-assistant')
def student_ai_assistant():
    if session.get('role') != 'student':
        return redirect(url_for('login'))
    user = get_student_user()
    username = session.get('username', '')
    name = session.get('name', '')
    if username:
        ensure_user(username, name)
    ai_chats = list_chats(username, name) if username else []
    return render_template(
        'templates_student/ai_chat.html',
        user=user,
        page_title='AI Chat Assistant',
        active_page='chat',
        chat_history=[{
            'id': c.get('id'),
            'title': c.get('title', 'Chat'),
            'date': c.get('updated_at', ''),
        } for c in ai_chats],
        messages=[],
        suggested_prompts=[
            "Summarize my latest uploaded document",
            "Explain binary search trees",
            "Create MCQs for Operating Systems",
            "Generate flashcards for DBMS",
            "Help me understand recursion",
        ],
    )


# ── AI Chat API Proxy Routes ──
@app.route('/api/ai/chats', methods=['GET'])
def api_ai_list_chats():
    if session.get('role') != 'student':
        return jsonify({'error': 'Unauthorized'}), 401
    username = session.get('username', '')
    if not username:
        return jsonify({'chats': []})
    chats = list_chats(username) if username else []
    return jsonify({'chats': chats})


@app.route('/api/ai/chats', methods=['POST'])
def api_ai_create_chat():
    if session.get('role') != 'student':
        return jsonify({'error': 'Unauthorized'}), 401
    username = session.get('username', '')
    name = session.get('name', '')
    data = request.get_json(silent=True) or {}
    title = data.get('title', 'New chat')
    result = create_chat(username, title, name)
    return jsonify(result)


@app.route('/api/ai/chats/<chat_id>', methods=['DELETE'])
def api_ai_delete_chat(chat_id):
    if session.get('role') != 'student':
        return jsonify({'error': 'Unauthorized'}), 401
    username = session.get('username', '')
    result = delete_chat(username, chat_id)
    return jsonify(result)


@app.route('/api/ai/chats/<chat_id>/history')
def api_ai_chat_history(chat_id):
    if session.get('role') != 'student':
        return jsonify({'error': 'Unauthorized'}), 401
    username = session.get('username', '')
    name = session.get('name', '')
    messages = get_chat_history(username, chat_id, name)
    resp = jsonify({'messages': messages})
    resp.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    resp.headers['Pragma'] = 'no-cache'
    resp.headers['Expires'] = '0'
    return resp


@app.route('/api/ai/chats/<chat_id>/chat', methods=['POST'])
def api_ai_chat_message(chat_id):
    if session.get('role') != 'student':
        return jsonify({'error': 'Unauthorized'}), 401
    username = session.get('username', '')
    name = session.get('name', '')
    data = request.get_json(force=True)
    message = (data.get('message') or '').strip()
    if not message:
        return jsonify({'error': 'Empty message'}), 400

    def generate():
        for event in stream_chat(username, chat_id, message, name):
            yield event

    return Response(generate(), mimetype='text/event-stream',
                    headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'})


@app.route('/api/ai/chats/<chat_id>/upload', methods=['POST'])
def api_ai_upload_file(chat_id):
    if session.get('role') != 'student':
        return jsonify({'error': 'Unauthorized'}), 401
    username = session.get('username', '')
    file = request.files.get('file')
    if not file:
        return jsonify({'error': 'No file'}), 400
    result = upload_file(username, chat_id, file)
    return jsonify(result)


@app.route('/api/ai/chats/<chat_id>/files', methods=['GET'])
def api_ai_list_files(chat_id):
    if session.get('role') != 'student':
        return jsonify({'error': 'Unauthorized'}), 401
    username = session.get('username', '')
    files = list_chat_files(username, chat_id)
    return jsonify({'files': files})


@app.route('/documents')
def student_documents():
    if session.get('role') != 'student':
        return redirect(url_for('login'))
    user = get_student_user()
    return render_template(
        'templates_student/documents.html',
        user=user,
        page_title='My Documents',
        active_page='documents',
        documents=[],
    )


@app.route('/generated')
def student_generated():
    if session.get('role') != 'student':
        return redirect(url_for('login'))
    user = get_student_user()
    return render_template(
        'templates_student/generated.html',
        user=user,
        page_title='Generated Content',
        active_page='generated',
    )


@app.route('/learning-history')
def student_history():
    if session.get('role') != 'student':
        return redirect(url_for('login'))
    user = get_student_user()
    return render_template(
        'templates_student/history.html',
        user=user,
        page_title='Learning History',
        active_page='history',
        history=[],
    )


@app.route('/help-support')
def student_help():
    if session.get('role') != 'student':
        return redirect(url_for('login'))
    user = get_student_user()
    return render_template(
        'templates_student/help.html',
        user=user,
        page_title='Help & Support',
        active_page='help',
        faqs=[],
        help_categories=[],
    )


@app.route('/profile')
def student_profile():
    if session.get('role') != 'student':
        return redirect(url_for('login'))
    user = get_student_user()
    sp = get_student_profile(session['user_id']) or {}
    return render_template(
        'templates_student/profile.html',
        user=user,
        page_title='Profile & Settings',
        active_page='profile',
        student_profile=sp,
    )


@app.route('/student/logout')
def student_logout():
    session.clear()
    return redirect(url_for('student_login'))


@app.route('/dashboard/professor')
def professor_dashboard():
    if session.get('role') != 'professor':
        return redirect(url_for('login'))
    stats = dict(DASHBOARD_STATS)
    username = session.get('username', '')
    name = session.get('name', '')
    if username:
        prof_ensure_user(username, name)
        pstats = prof_get_user_stats(username, name)
        stats['prof_ai_chats'] = pstats.get('chats', 0)
        stats['prof_docs'] = pstats.get('generated_docs', 0)
        stats['prof_uploads'] = pstats.get('uploaded_files', 0)
    return render_template(
        'templates_prof/dashboard.html',
        name=name,
        active_page='dashboard',
        stats=stats,
        recent_activity=RECENT_ACTIVITY,
    )


@app.route('/professor')
def professor_home():
    return redirect(url_for('dashboard'))


@app.route('/professor/dashboard')
def dashboard():
    if session.get('role') != 'professor':
        return redirect(url_for('login'))
    stats = get_dashboard_stats()
    recent_activity = get_recent_activity(8)
    formatted_activity = [
        {
            'type': item['type'],
            'text': f"{item['user_name']} — {item['detail']}",
            'time': item['time'],
        }
        for item in recent_activity
    ]
    # Pull AI stats from prof_model
    username = session.get('username', '')
    name = session.get('name', '')
    if username:
        prof_ensure_user(username, name)
        pstats = prof_get_user_stats(username, name)
        stats['prof_ai_chats'] = pstats.get('chats', 0)
        stats['prof_docs'] = pstats.get('generated_docs', 0)
        stats['prof_uploads'] = pstats.get('uploaded_files', 0)
    return render_template(
        'templates_prof/dashboard.html',
        name=name,
        active_page='dashboard',
        stats=stats,
        recent_activity=formatted_activity,
    )


@app.route('/professor/students')
def students():
    if session.get('role') != 'professor':
        return redirect(url_for('login'))
    students = get_all_students()
    return render_template(
        'templates_prof/students.html',
        active_page='students',
        students=students,
    )


@app.route('/professor/documents')
def documents():
    if session.get('role') != 'professor':
        return redirect(url_for('login'))
    return render_template(
        'templates_prof/documents.html',
        active_page='documents',
        documents=DOCUMENTS,
    )


@app.route('/professor/preview')
@app.route('/professor/preview/<int:doc_id>')
def preview(doc_id=1):
    if session.get('role') != 'professor':
        return redirect(url_for('login'))
    document = PREVIEW_DOCS.get(doc_id, DOCUMENTS[0] if DOCUMENTS else {'name': 'No document', 'type': 'PDF', 'size': '0 KB', 'uploaded': 'N/A', 'student': 'N/A', 'id': 0})
    return render_template(
        'templates_prof/preview.html',
        active_page='documents',
        document=document,
    )


@app.route('/professor/chat')
def chat():
    if session.get('role') != 'professor':
        return redirect(url_for('login'))
    return render_template(
        'templates_prof/chat.html',
        active_page='chat',
        messages=CHAT_MESSAGES,
    )


@app.route('/professor/activity')
def activity():
    if session.get('role') != 'professor':
        return redirect(url_for('login'))
    timeline = get_recent_activity(20)
    formatted = [
        {
            'icon': 'login' if item['type'] == 'login' else 'upload' if item['type'] == 'profile_update' else 'doc',
            'title': f"{item['user_name']}",
            'detail': item['detail'],
            'time': item['time'],
        }
        for item in timeline
    ]
    return render_template(
        'templates_prof/activity.html',
        active_page='activity',
        timeline=formatted,
    )


@app.route('/professor/profile')
def profile():
    if session.get('role') != 'professor':
        return redirect(url_for('login'))
    profile = get_professor_profile(session['user_id']) or {'email': '', 'name': session.get('name', ''), 'department': ''}
    return render_template(
        'templates_prof/profile.html',
        active_page='profile',
        profile=profile,
    )


@app.route('/professor/logout')
def logout():
    session.clear()
    return redirect(url_for('professor_login'))


@app.route('/dashboard')
def dashboard_redirect():
    role = session.get('role')
    if role == 'student':
        return redirect(url_for('student_dashboard'))
    elif role == 'professor':
        return redirect(url_for('professor_dashboard'))
    return redirect(url_for('login'))


if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000)
