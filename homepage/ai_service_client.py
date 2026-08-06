import json
import requests
from urllib.parse import urljoin

AI_SERVICE_URL = "http://localhost:5001"

def _headers(username, name=None):
    headers = {"X-Ai-Username": username, "Content-Type": "application/json"}
    if name:
        headers["X-Ai-Name"] = name
    return headers

def ensure_user(username, name):
    """Ensure user exists in model service — the login_required decorator auto-creates."""
    try:
        r = requests.get(urljoin(AI_SERVICE_URL, "/api/chats"), headers=_headers(username, name), timeout=10)
        return r.ok
    except Exception:
        return False

def list_chats(username, name=None):
    r = requests.get(urljoin(AI_SERVICE_URL, "/api/chats"), headers=_headers(username, name), timeout=10)
    return r.json().get("chats", [])

def create_chat(username, title="New chat", name=None):
    r = requests.post(urljoin(AI_SERVICE_URL, "/api/chats"), headers=_headers(username, name),
                      json={"title": title}, timeout=10)
    return r.json()

def rename_chat(username, chat_id, title):
    r = requests.patch(urljoin(AI_SERVICE_URL, f"/api/chats/{chat_id}"), headers=_headers(username),
                       json={"title": title}, timeout=10)
    return r.json()

def delete_chat(username, chat_id):
    r = requests.delete(urljoin(AI_SERVICE_URL, f"/api/chats/{chat_id}"), headers=_headers(username), timeout=10)
    return r.json()

def get_chat_history(username, chat_id, name=None):
    r = requests.get(urljoin(AI_SERVICE_URL, f"/api/chats/{chat_id}/history"), headers=_headers(username, name), timeout=10)
    return r.json().get("messages", [])

def clear_chat_history(username, chat_id):
    r = requests.delete(urljoin(AI_SERVICE_URL, f"/api/chats/{chat_id}/history"), headers=_headers(username), timeout=10)
    return r.json()

def upload_file(username, chat_id, file_obj):
    r = requests.post(urljoin(AI_SERVICE_URL, f"/api/chats/{chat_id}/upload"),
                      headers={"X-Ai-Username": username},
                      files={"file": file_obj}, timeout=120)
    return r.json()

def list_chat_files(username, chat_id):
    r = requests.get(urljoin(AI_SERVICE_URL, f"/api/chats/{chat_id}/files"), headers=_headers(username), timeout=10)
    return r.json().get("files", [])

def delete_file(username, chat_id, filename):
    r = requests.delete(urljoin(AI_SERVICE_URL, f"/api/chats/{chat_id}/files/{filename}"),
                        headers=_headers(username), timeout=10)
    return r.json()

def stream_chat(username, chat_id, message, name=None):
    """Generator that yields SSE events from the model service."""
    r = requests.post(urljoin(AI_SERVICE_URL, f"/api/chats/{chat_id}/chat"),
                      headers=_headers(username, name),
                      json={"message": message}, stream=True, timeout=300)
    if not r.ok:
        yield f"data: {json.dumps({'type': 'error', 'content': f'AI service error: {r.status_code}'})}\n\n"
        return
    for line in r.iter_lines():
        if line:
            yield line.decode("utf-8") + "\n\n"

def list_memories(username):
    r = requests.get(urljoin(AI_SERVICE_URL, "/api/memory"), headers=_headers(username), timeout=10)
    return r.json().get("memories", [])

def add_memory(username, text):
    r = requests.post(urljoin(AI_SERVICE_URL, "/api/memory"), headers=_headers(username),
                      json={"text": text}, timeout=10)
    return r.json()

def delete_memory(username, memory_id):
    r = requests.delete(urljoin(AI_SERVICE_URL, f"/api/memory/{memory_id}"),
                        headers=_headers(username), timeout=10)
    return r.json()

def list_generated_documents(username):
    r = requests.get(urljoin(AI_SERVICE_URL, "/api/documents"), headers=_headers(username), timeout=10)
    return r.json().get("documents", [])

def generate_document(username, prompt, doc_type="notes", doc_format="both"):
    r = requests.post(urljoin(AI_SERVICE_URL, "/api/generate-document"), headers=_headers(username),
                      json={"prompt": prompt, "doc_type": doc_type, "format": doc_format}, timeout=300)
    return r.json()

def download_document_url(filename):
    return urljoin(AI_SERVICE_URL, f"/download/{filename}")

def get_user_stats(username, name=None):
    try:
        r = requests.get(urljoin(AI_SERVICE_URL, "/api/stats"), headers=_headers(username, name), timeout=10)
        if r.ok:
            return r.json()
    except Exception:
        pass
    return {}
