// ═══════════════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════════════
let chats       = [];   // loaded from server, not localStorage
let activeChatId = null;
let isStreaming  = false;
let currentUser  = null;
let currentAbortController = null;
let pendingImage = null; // {file, dataUrl} — set when an image is attached, cleared on send

// ═══════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', async () => {
  await loadUser();
  await loadChats();
  if (chats.length === 0) await newChat();
  else await loadChat(chats[0].id);
  document.getElementById('msgInput').focus();
});

async function loadUser() {
  try {
    const r = await fetch('/api/auth/me', {credentials:'include'});
    const d = await r.json();
    if (!d.authenticated) { window.location.href = '/login'; return; }
    currentUser = d;
    const initials = d.name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
    document.getElementById('userAvatar').textContent = initials;
    document.getElementById('userName').textContent   = d.name;
    document.getElementById('userRole').textContent   = d.role;
  } catch(e) {}
}

async function logout() {
  await fetch('/api/auth/logout', {method:'POST', credentials:'include'}).catch(()=>{});
  window.location.href = '/login';
}

// ═══════════════════════════════════════════════════════
//  CHAT MANAGEMENT
// ═══════════════════════════════════════════════════════
async function loadChats() {
  try {
    const r = await fetch('/api/chats', {credentials:'include'});
    const d = await r.json();
    chats = d.chats || [];
  } catch(e) { chats = []; }
  renderChatList();
}

async function newChat() {
  try {
    const r = await fetch('/api/chats', {
      method:'POST', credentials:'include',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({title:'New chat'})
    });
    const d = await r.json();
    if (!r.ok) { showToast(d.error || 'Could not create chat.','error'); return; }
    chats.unshift({id:d.chat_id, title:d.title});
    await loadChat(d.chat_id);
  } catch(e) {
    showToast('Could not reach server.','error');
  }
}

async function loadChat(id) {
  id = Number(id);
  activeChatId = id;
  const chat = chats.find(c => c.id === id);
  if (!chat) return;

  document.getElementById('topbarTitle').textContent = chat.title;
  renderChatList();

  const inner = document.getElementById('messagesInner');
  inner.innerHTML = '';

  try {
    const r = await fetch(`/api/chats/${id}/history`, {credentials:'include'});
    const d = await r.json();
    const history = d.history || [];
    if (history.length === 0) {
      inner.appendChild(makeWelcome());
    } else {
      history.forEach(m => {
        const el = appendMessage(m.role, m.content, null, false);
        if (m.image_url) {
          const img = document.createElement('img');
          img.src = m.image_url;
          img.style.cssText = 'max-width:240px;max-height:240px;border-radius:10px;display:block;margin-top:8px;object-fit:cover;';
          el.querySelector('.msg-bubble').appendChild(img);
        }
      });
    }
  } catch(e) {
    inner.appendChild(makeWelcome());
  }

  await loadFiles();
  scrollBottom();
}

async function deleteChat(id, e) {
  id = Number(id);
  e.stopPropagation();
  try {
    await fetch(`/api/chats/${id}`, {method:'DELETE', credentials:'include'});
  } catch(e) {}
  chats = chats.filter(c => c.id !== id);
  if (activeChatId === id) {
    if (chats.length === 0) await newChat();
    else await loadChat(chats[0].id);
  }
  renderChatList();
}

function renderChatList() {
  const list = document.getElementById('chatList');
  if (chats.length === 0) {
    list.innerHTML = '<div class="no-files" style="padding:16px 10px">No conversations yet</div>';
    return;
  }
  list.innerHTML = chats.map(c => `
    <div class="chat-item ${c.id===activeChatId?'active':''}" onclick="loadChat('${c.id}')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
      </svg>
      <span class="chat-item-title">${esc(c.title)}</span>
      <span class="chat-item-del" onclick="deleteChat('${c.id}',event)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </span>
    </div>
  `).join('');
}

function makeWelcome() {
  const d = document.createElement('div');
  d.className = 'welcome'; d.id = 'welcomeScreen';
  d.innerHTML = `
    <div class="welcome-icon">🎓</div>
    <h2>Professor AI</h2>
    <p>Upload lecture slides, syllabi, or question papers and ask questions grounded in them — or generate lecture notes, quizzes, MCQs, question papers, answer keys, and rubric-based evaluations, ready to download.</p>
    <div class="welcome-pills">
      <div class="welcome-pill" onclick="usePill(this)">Generate a 10-question quiz on Normalization in DBMS</div>
      <div class="welcome-pill" onclick="usePill(this)">Create lecture notes on Process Scheduling in OS</div>
      <div class="welcome-pill" onclick="usePill(this)">Summarize this syllabus and flag any missing topics</div>
      <div class="welcome-pill" onclick="usePill(this)">Generate a rubric-based evaluation report for this submission</div>
    </div>`;
  return d;
}

// ═══════════════════════════════════════════════════════
//  SEND MESSAGE
// ═══════════════════════════════════════════════════════
function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}
function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 160) + 'px';
}
function usePill(el) {
  document.getElementById('msgInput').value = el.textContent;
  document.getElementById('msgInput').focus();
}

function handleSendClick() {
  if (isStreaming) {
    stopGeneration();
  } else {
    sendMessage();
  }
}

function stopGeneration() {
  if (currentAbortController) {
    currentAbortController.abort();
  }
}

function setSendButtonState(streaming) {
  const btn      = document.getElementById('sendBtn');
  const sendIcon = document.getElementById('sendIcon');
  const stopIcon = document.getElementById('stopIcon');
  btn.disabled = false;
  btn.title = streaming ? 'Stop generating' : 'Send message';
  btn.classList.toggle('stop-state', streaming);
  sendIcon.style.display = streaming ? 'none' : '';
  stopIcon.style.display = streaming ? '' : 'none';
}

async function sendMessage() {
  const input = document.getElementById('msgInput');
  const text  = input.value.trim();
  const attachedImage = pendingImage;
  if ((!text && !attachedImage) || isStreaming) return;

  document.getElementById('welcomeScreen')?.remove();
  input.value = ''; input.style.height = 'auto';
  clearPendingImage();
  isStreaming = true;
  currentAbortController = new AbortController();
  setSendButtonState(true);

  const userEl = appendMessage('user', text || '📷 Analyze this image', null, true);
  if (attachedImage) {
    const img = document.createElement('img');
    img.src = attachedImage.dataUrl;
    img.style.cssText = 'max-width:240px;max-height:240px;border-radius:10px;display:block;margin-top:8px;object-fit:cover;';
    userEl.querySelector('.msg-bubble').appendChild(img);
  }
  autoTitleChat(text || (attachedImage ? `Image: ${attachedImage.file.name}` : ''));

  let typingEl = addTyping();
  scrollBottom();

  let aiEl = null, bubble = null, rawText = '', sources = [], renderTimer = null, stopped = false;

  function finalizeBubble() {
    if (renderTimer) { clearTimeout(renderTimer); renderTimer = null; }
    if (!bubble) return;
    bubble.innerHTML = mdToHtml(rawText);
    if (sources.length > 0) bubble.appendChild(buildSources(sources));
    bubble.querySelectorAll('pre code').forEach(el => hljs.highlightElement(el));
    if (window.MathJax) MathJax.typesetPromise([bubble]).catch(()=>{});
    if (stopped) {
      const tag = document.createElement('div');
      tag.className = 'stopped-tag';
      tag.innerHTML = `
        <svg viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>
        Stopped generating`;
      bubble.appendChild(tag);
    }
  }

  try {
    const resp = attachedImage
      ? await (() => {
          const fd = new FormData();
          fd.append('image', attachedImage.file);
          fd.append('message', text);
          return fetch(`/api/chats/${activeChatId}/chat-image`, {
            method:'POST', credentials:'include', body: fd,
            signal: currentAbortController.signal
          });
        })()
      : await fetch(`/api/chats/${activeChatId}/chat`, {
          method:'POST', credentials:'include',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({message: text}),
          signal: currentAbortController.signal
        });

    if (!resp.ok) {
      typingEl.remove();
      const err = await resp.json().catch(()=>({error:'Server error'}));
      if (resp.status === 401) { window.location.href = '/login'; return; }
      appendMessage('assistant', `⚠️ ${err.error || 'Something went wrong.'}`, null, true);
      finishStream(); return;
    }

    const reader  = resp.body.getReader();
    const decoder = new TextDecoder();
    typingEl.remove();

    aiEl   = appendMessage('assistant', '', null, true);
    bubble = aiEl.querySelector('.msg-bubble');

    // Throttled render — re-render at most every 80ms during streaming
    function scheduleRender() {
      if (renderTimer) return;
      renderTimer = setTimeout(() => {
        renderTimer = null;
        bubble.innerHTML = mdToHtml(rawText);
        scrollBottom();
      }, 80);
    }

    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      const lines = decoder.decode(value, {stream:true}).split('\n');
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const data = JSON.parse(line.slice(6));
          if (data.type === 'token') {
            rawText += data.content;
            scheduleRender();
          } else if (data.type === 'sources') {
            sources = data.sources;
          } else if (data.type === 'error') {
            rawText = `⚠️ ${data.content}`;
            bubble.innerHTML = mdToHtml(rawText);
          } else if (data.type === 'done') {
            // Final render
            finalizeBubble();
            // Server already persisted this exchange (add_message in chat_endpoint)
            scrollBottom();
          }
        } catch(e) {}
      }
    }
  } catch(e) {
    if (e.name === 'AbortError') {
      // User pressed stop mid-generation — keep whatever text arrived
      stopped = true;
      typingEl?.remove();
      if (!bubble) {
        aiEl   = appendMessage('assistant', '', null, true);
        bubble = aiEl.querySelector('.msg-bubble');
      }
      finalizeBubble();
      scrollBottom();
    } else {
      typingEl?.remove();
      appendMessage('assistant', '⚠️ Could not reach server. Make sure `python app.py` is running.', null, true);
    }
  }
  finishStream();
}

function finishStream() {
  isStreaming = false;
  currentAbortController = null;
  setSendButtonState(false);
  document.getElementById('msgInput').focus();
}

// ═══════════════════════════════════════════════════════
//  RENDER MESSAGES
// ═══════════════════════════════════════════════════════
function appendMessage(role, content, sources, animate) {
  document.getElementById('welcomeScreen')?.remove();
  const inner = document.getElementById('messagesInner');

  const div   = document.createElement('div');
  div.className = `msg msg-${role}`;
  if (!animate) div.style.animation = 'none';

  const avatar = role === 'user'
    ? `<div class="msg-avatar user">${currentUser ? currentUser.name[0].toUpperCase() : '👤'}</div>`
    : `<div class="msg-avatar ai">🤖</div>`;

  div.innerHTML = `
    <div class="msg-row">
      ${avatar}
      <div class="msg-bubble">${mdToHtml(content)}</div>
    </div>`;

  // Sources
  if (sources && sources.length > 0) {
    div.querySelector('.msg-bubble').appendChild(buildSources(sources));
  }

  inner.appendChild(div);

  // Highlight + math for pre-existing (non-streaming) messages
  if (!animate) {
    div.querySelectorAll('pre code').forEach(el => hljs.highlightElement(el));
    if (window.MathJax) MathJax.typesetPromise([div]).catch(()=>{});
  }

  if (animate) scrollBottom();
  return div;
}

function buildSources(sources) {
  const seen = new Set(), unique = [];
  sources.forEach(s => { const k=`${s.filename}|${s.page}`; if(!seen.has(k)){seen.add(k);unique.push(s);} });
  const wrap = document.createElement('div');
  wrap.className = 'sources-block';
  wrap.innerHTML = `
    <div class="sources-label">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
      </svg>
      Sources
    </div>
    ${unique.map(s=>`<span class="source-chip">📄 ${esc(s.filename)} · p.${s.page}</span>`).join('')}`;
  return wrap;
}

function addTyping() {
  const inner = document.getElementById('messagesInner');
  const div   = document.createElement('div');
  div.className = 'msg msg-assistant';
  div.innerHTML = `
    <div class="msg-row">
      <div class="msg-avatar ai">🤖</div>
      <div class="typing-bubble">
        <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>
      </div>
    </div>`;
  inner.appendChild(div);
  scrollBottom();
  return div;
}

function autoTitleChat(text) {
  const chat = chats.find(c => c.id === activeChatId);
  if (!chat || chat.title !== 'New chat') return;
  chat.title = text.slice(0, 38) + (text.length > 38 ? '…' : '');
  document.getElementById('topbarTitle').textContent = chat.title;
  renderChatList();
  fetch(`/api/chats/${activeChatId}`, {
    method:'PATCH', credentials:'include',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({title: chat.title})
  }).catch(()=>{});
}

async function clearHistory() {
  await fetch(`/api/chats/${activeChatId}/history`, {method:'DELETE', credentials:'include'}).catch(()=>{});
  await loadChat(activeChatId);
  showToast('Chat cleared', 'info');
}

// ═══════════════════════════════════════════════════════
//  MARKDOWN → HTML
//  Handles: headings, bold, italic, lists, blockquote,
//           inline code, fenced code blocks, hr, paragraphs
//  Math delimiters are LEFT INTACT for MathJax to process.
// ═══════════════════════════════════════════════════════
function mdToHtml(raw) {
  if (!raw) return '';

  // 1. Extract and protect fenced code blocks FIRST
  const codeBlocks = [];
  let s = raw.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push({lang: lang || 'plaintext', code: code.trimEnd()});
    return `\x00CODE${idx}\x00`;
  });

  // 2. Extract and protect inline code
  const inlineCodes = [];
  s = s.replace(/`([^`\n]+)`/g, (_, code) => {
    const idx = inlineCodes.length;
    inlineCodes.push(esc(code));
    return `\x00INLINE${idx}\x00`;
  });

  // 2.5 Extract and protect markdown links [text](url) -> real <a> tags.
  // Must run BEFORE the HTML-escape step below, or the [ ] ( ) characters
  // just get treated as literal text and never become a clickable link —
  // this was the actual bug: there was no link handling here at all.
  const links = [];
  s = s.replace(/\[([^\]\n]+)\]\((\/[^\s)]+|https?:\/\/[^\s)]+)\)/g, (_, text, url) => {
    const idx = links.length;
    const isDownload = /^\/download\//.test(url);
    const attrs = isDownload ? 'download' : 'target="_blank" rel="noopener noreferrer"';
    links.push(`<a href="${esc(url)}" ${attrs}>${esc(text)}</a>`);
    return `\x00LINK${idx}\x00`;
  });

  // 3. Escape remaining HTML (but not the placeholders or math delimiters)
  s = s
    .replace(/&(?!\x00)/g, '&amp;')
    .replace(/<(?!\x00)/g, '&lt;')
    .replace(/>(?!\x00)/g, '&gt;');

  // 4. Headings
  s = s.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  s = s.replace(/^## (.+)$/gm,  '<h2>$1</h2>');
  s = s.replace(/^# (.+)$/gm,   '<h1>$1</h1>');

  // 5. Bold & italic
  s = s.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  s = s.replace(/\*\*(.+?)\*\*/g,     '<strong>$1</strong>');
  s = s.replace(/\*(.+?)\*/g,         '<em>$1</em>');

  // 6. Blockquote
  s = s.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

  // 7. HR
  s = s.replace(/^---+$/gm, '<hr/>');

  // 8+9. Lists (ordered + unordered).
  //
  // The old approach ran two independent regexes: one that grabbed runs of
  // consecutive "- " lines into a <ul>, then one that grabbed runs of
  // consecutive "N. " lines into an <ol>. That breaks the moment a numbered
  // item is followed by its own bullet sub-points — e.g.
  //   1. Spirituality:
  //   - practices like meditation...
  //   - Resources: ...
  //
  //   1. Trading:
  //   - ...
  // The <ul> step runs FIRST and turns each bullet run into inline <ul> HTML,
  // which breaks up what was one contiguous run of "1. " lines into several
  // isolated single-line matches — so every "1. Heading" becomes its OWN
  // one-item <ol>, and since a fresh <ol> always starts counting at 1
  // regardless of the text that was in the markdown, every section prints
  // "1." instead of counting 1, 2, 3, 4.
  //
  // This walks the text line by line instead: a numbered line opens/extends
  // one continuous <ol>, and any bullet lines immediately under it nest as a
  // <ul> *inside* that <li> instead of becoming siblings. A blank line
  // doesn't end the list on its own — only if what follows isn't itself a
  // list line — so the blank line the model puts between "1. X" / "1. Y"
  // blocks (as in the example above) doesn't fragment the list either.
  s = (function renderLists(text) {
    const lines = text.split('\n');
    const out = [];
    let mode = null;      // null | 'ol' | 'ul' — the outer list currently open
    let liOpen = false;   // an outer <li> is open, awaiting its </li>
    let nestedUl = false; // (ol only) a <ul> is open inside the current <li>

    const closeNested = () => { if (nestedUl) { out.push('</ul>'); nestedUl = false; } };
    const closeLi = () => { closeNested(); if (liOpen) { out.push('</li>'); liOpen = false; } };
    const closeOuter = () => {
      closeLi();
      if (mode === 'ol') out.push('</ol>');
      else if (mode === 'ul') out.push('</ul>');
      mode = null;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const om = /^[ \t]*\d+\.\s+(.+)$/.exec(line);
      const um = /^[ \t]*[-*]\s+(.+)$/.exec(line);

      if (om) {
        if (mode !== 'ol') { closeOuter(); out.push('<ol>'); mode = 'ol'; }
        else { closeLi(); }
        out.push(`<li>${om[1].trim()}`);
        liOpen = true;
      } else if (um) {
        if (mode === 'ol' && liOpen) {
          if (!nestedUl) { out.push('<ul>'); nestedUl = true; }
          out.push(`<li>${um[1].trim()}</li>`);
        } else {
          if (mode !== 'ul') { closeOuter(); out.push('<ul>'); mode = 'ul'; }
          out.push(`<li>${um[1].trim()}</li>`);
        }
      } else if (line.trim() === '' && mode) {
        // Only swallow the blank line (keep the list open) if a list item
        // actually follows it — otherwise it's a real paragraph break: close
        // the list AND keep the blank line in the output, so the paragraph
        // step below still sees the \n\n it needs to wrap what comes next
        // in its own <p> instead of gluing it onto the closed list.
        let j = i + 1;
        while (j < lines.length && lines[j].trim() === '') j++;
        const next = lines[j];
        const nextIsListLine = next !== undefined &&
          (/^[ \t]*\d+\.\s+/.test(next) || /^[ \t]*[-*]\s+/.test(next));
        if (!nextIsListLine) { closeOuter(); out.push(''); }
      } else {
        closeOuter();
        out.push(line);
      }
    }
    closeOuter();
    return out.join('\n');
  })(s);

  // 10. Paragraphs (double newline = new paragraph)
  s = s.split(/\n{2,}/).map(block => {
    block = block.trim();
    if (!block) return '';
    if (/^<(h[1-3]|ul|ol|blockquote|hr)/.test(block)) return block;
    // single newlines → <br> inside paragraph
    return `<p>${block.replace(/\n/g, '<br/>')}</p>`;
  }).join('');

  // 11. Restore inline code
  s = s.replace(/\x00INLINE(\d+)\x00/g, (_, i) =>
    `<code>${inlineCodes[parseInt(i)]}</code>`
  );

  // 11.5 Restore links
  s = s.replace(/\x00LINK(\d+)\x00/g, (_, i) => links[parseInt(i)]);

  // 12. Restore fenced code blocks with copy button
  s = s.replace(/\x00CODE(\d+)\x00/g, (_, i) => {
    const {lang, code} = codeBlocks[parseInt(i)];
    const escaped = code.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    return `
      <div class="code-block-wrap">
        <div class="code-block-header">
          <span class="code-lang">${esc(lang)}</span>
          <button class="copy-btn" onclick="copyCode(this)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
            </svg>
            Copy
          </button>
        </div>
        <pre><code class="language-${esc(lang)}">${escaped}</code></pre>
      </div>`;
  });

  return s;
}

function copyCode(btn) {
  const code = btn.closest('.code-block-wrap').querySelector('code').innerText;
  navigator.clipboard.writeText(code).then(() => {
    btn.textContent = '✓ Copied';
    setTimeout(() => { btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copy`; }, 1800);
  });
}

// ═══════════════════════════════════════════════════════
//  FILES
// ═══════════════════════════════════════════════════════
async function handleUpload(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  e.target.value = '';
  if (!activeChatId) { showToast('No active chat selected.','error'); return; }

  const ext = '.' + file.name.split('.').pop().toLowerCase();
  const imageExts = ['.png','.jpg','.jpeg','.webp','.gif','.bmp'];

  if (imageExts.includes(ext)) {
    handleImageAttach(file);
    return;
  }

  if (!['.pdf','.txt','.docx','.pptx'].includes(ext)) { showToast('Use PDF, TXT, DOCX, PPTX, or an image (PNG/JPG/WEBP) for analysis.','error'); return; }
  if (file.size === 0) { showToast('File is empty.','error'); return; }
  if (file.size > 50*1024*1024) { showToast('Max file size is 50 MB.','error'); return; }

  const pid = 'p_' + Date.now();
  addProgressItem(pid, file.name);

  const fd = new FormData(); fd.append('file', file);
  try {
    const r = await fetch(`/api/chats/${activeChatId}/upload`, {method:'POST', credentials:'include', body:fd});
    removeProgressItem(pid);
    const d = await r.json();
    if (!r.ok) { showToast(d.error || 'Upload failed.','error'); return; }
    showToast(`✓ ${file.name} · ${d.chunks} chunks, ${d.pages} pages`, 'success');
    await loadFiles();
  } catch(e) {
    removeProgressItem(pid);
    showToast('Upload failed — is the server running?','error');
  }
}

// ── image attachment (Qwen2.5-VL analysis, not RAG) ──
// Images never go through /upload — there's nothing to chunk or embed.
// Instead they're held here and sent together with the next chat message
// to /api/chats/<id>/chat-image, same as attaching a photo in a normal
// chat app: pick it, optionally add a question, hit send.
function handleImageAttach(file) {
  if (file.size === 0) { showToast('Image is empty.','error'); return; }
  if (file.size > 15*1024*1024) { showToast('Max image size is 15 MB.','error'); return; }
  const reader = new FileReader();
  reader.onload = () => {
    pendingImage = { file, dataUrl: reader.result };
    renderImagePreview();
  };
  reader.onerror = () => showToast('Could not read that image.','error');
  reader.readAsDataURL(file);
}

function renderImagePreview() {
  let chip = document.getElementById('imagePreviewChip');
  if (!pendingImage) { chip?.remove(); return; }
  if (!chip) {
    chip = document.createElement('div');
    chip.id = 'imagePreviewChip';
    chip.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 10px;'
      + 'margin-bottom:8px;background:rgba(127,127,127,0.08);border:1px solid var(--border,#333);'
      + 'border-radius:10px;';
    document.querySelector('.input-wrap').prepend(chip);
  }
  chip.innerHTML = `
    <img src="${pendingImage.dataUrl}" style="width:38px;height:38px;object-fit:cover;border-radius:6px;flex-shrink:0;"/>
    <span style="font-size:12.5px;color:var(--muted,#999);overflow:hidden;text-overflow:ellipsis;
      white-space:nowrap;flex:1;">${esc(pendingImage.file.name)} · ready to analyze</span>
    <button onclick="clearPendingImage()" title="Remove image"
      style="background:none;border:none;color:var(--muted,#999);cursor:pointer;font-size:16px;
      line-height:1;padding:2px 4px;">✕</button>`;
}

function clearPendingImage() {
  pendingImage = null;
  document.getElementById('imagePreviewChip')?.remove();
}

async function loadFiles() {
  if (!activeChatId) { renderFiles([]); return; }
  try {
    const r = await fetch(`/api/chats/${activeChatId}/files`, {credentials:'include'});
    const d = await r.json();
    renderFiles(d.files || []);
  } catch(e) { renderFiles([]); }
}

function renderFiles(files) {
  const list = document.getElementById('fileList');
  if (files.length === 0) {
    list.innerHTML = '<div class="no-files">No course material yet.<br/>Upload PDF, DOCX, PPTX, or TXT.</div>';
    return;
  }
  const icons = {pdf:'📄',txt:'📝',docx:'📋'};
  list.innerHTML = files.map(f => {
    const ext = f.name.split('.').pop().toLowerCase();
    return `
    <div class="file-item">
      <span class="file-icon">${icons[ext]||'📄'}</span>
      <div class="file-info">
        <div class="file-name" title="${esc(f.name)}">${esc(f.name)}</div>
        <div class="file-meta">${f.chunks} chunks · ${f.pages} pages</div>
      </div>
      <div class="file-actions">
        <button class="file-action-btn" title="Re-index" onclick="reindexFile('${esc(f.name)}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
          </svg>
        </button>
        <button class="file-action-btn" title="Delete" onclick="deleteFile('${esc(f.name)}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
          </svg>
        </button>
      </div>
    </div>`;
  }).join('');
}

async function deleteFile(name) {
  await fetch(`/api/chats/${activeChatId}/files/${encodeURIComponent(name)}`, {method:'DELETE', credentials:'include'});
  showToast(`Deleted ${name}`,'info');
  await loadFiles();
}

async function reindexFile(name) {
  showToast(`Re-indexing ${name}…`,'info');
  const r = await fetch(`/api/chats/${activeChatId}/files/${encodeURIComponent(name)}/reindex`, {method:'POST', credentials:'include'});
  const d = await r.json();
  if (d.error) { showToast(d.error,'error'); return; }
  showToast(`Re-indexed: ${d.chunks} chunks`,'success');
  await loadFiles();
}

function addProgressItem(id, name) {
  const list = document.getElementById('fileList');
  const none = list.querySelector('.no-files');
  if (none) none.remove();
  const div = document.createElement('div');
  div.id = id; div.className = 'upload-progress';
  div.innerHTML = `<div style="color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">⏳ ${esc(name)}</div><div class="upload-bar-track"><div class="upload-bar"></div></div>`;
  list.prepend(div);
}
function removeProgressItem(id) { document.getElementById(id)?.remove(); }

// ═══════════════════════════════════════════════════════
//  UTILS
// ═══════════════════════════════════════════════════════
function scrollBottom() {
  const wrap = document.getElementById('messagesWrap');
  requestAnimationFrame(() => { wrap.scrollTop = wrap.scrollHeight; });
}
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function showToast(msg, type='info') {
  const icons = {
    success:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`,
    error:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    info:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `${icons[type]||''}${esc(msg)}`;
  document.getElementById('toastContainer').appendChild(el);
  setTimeout(()=>el.style.opacity='0', 3400);
  setTimeout(()=>el.remove(), 3700);
}
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('show');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('show');
}