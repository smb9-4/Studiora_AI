(function() {
  'use strict';

  /* ── Sidebar Toggle (Mobile) ── */
  var sidebar = document.getElementById('app-sidebar');
  var overlay = document.getElementById('sidebar-overlay');
  var toggleBtn = document.getElementById('sidebar-toggle');

  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', function() {
      sidebar.classList.toggle('open');
      if (overlay) overlay.classList.toggle('visible');
    });
  }

  if (overlay) {
    overlay.addEventListener('click', function() {
      sidebar.classList.remove('open');
      overlay.classList.remove('visible');
    });
  }

  /* ── Scroll Reveal ── */
  var revealEls = document.querySelectorAll('.reveal');
  if (revealEls.length && 'IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    revealEls.forEach(function(el) { observer.observe(el); });
  } else {
    revealEls.forEach(function(el) { el.classList.add('visible'); });
  }

  /* ── Toggle Switches ── */
  document.querySelectorAll('.toggle-switch').forEach(function(toggle) {
    toggle.addEventListener('click', function() {
      toggle.classList.toggle('on');
    });
  });

  /* ── Chat Page ── */
  window.initChatPage = function() {
    var chatLayout = document.getElementById('chat-layout');
    var chatSidebarToggle = document.getElementById('chat-sidebar-toggle');
    var chatSidebarOverlay = document.getElementById('chat-sidebar-overlay');
    var chatInput = document.getElementById('chat-input');
    var sendBtn = document.getElementById('chat-send-btn');
    var attachBtn = document.getElementById('attach-btn');
    var fileInput = document.getElementById('file-input');
    var attachmentChips = document.getElementById('attachment-chips');
    var chatMessages = document.getElementById('chat-messages');
    var chatSearch = document.getElementById('chat-search-input');
    var attachments = [];
    var chatSidebarOpen = window.innerWidth > 768;

    function isMobileChat() {
      return window.innerWidth <= 768;
    }

    function setChatSidebarOpen(open) {
      chatSidebarOpen = open;
      if (!chatLayout) return;
      chatLayout.classList.toggle('sidebar-closed', !open);
      if (chatSidebarToggle) {
        chatSidebarToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      }
      if (chatSidebarOverlay) {
        chatSidebarOverlay.classList.toggle('visible', open && isMobileChat());
        chatSidebarOverlay.setAttribute('aria-hidden', open && isMobileChat() ? 'false' : 'true');
      }
    }

    function initChatSidebarState() {
      setChatSidebarOpen(window.innerWidth > 768);
    }

    if (chatSidebarToggle) {
      chatSidebarToggle.addEventListener('click', function() {
        setChatSidebarOpen(!chatSidebarOpen);
      });
    }

    if (chatSidebarOverlay) {
      chatSidebarOverlay.addEventListener('click', function() {
        setChatSidebarOpen(false);
      });
    }

    window.addEventListener('resize', function() {
      var nowMobile = isMobileChat();
      if (nowMobile !== wasMobileChatViewport) {
        setChatSidebarOpen(!nowMobile);
        wasMobileChatViewport = nowMobile;
        return;
      }
      if (chatSidebarOverlay) {
        chatSidebarOverlay.classList.toggle('visible', chatSidebarOpen && nowMobile);
      }
    });

    var wasMobileChatViewport = isMobileChat();
    initChatSidebarState();

    function getFileIcon(name) {
      var ext = name.split('.').pop().toLowerCase();
      if (['png', 'jpg', 'jpeg'].indexOf(ext) !== -1) return '🖼️';
      if (ext === 'pdf') return '📄';
      if (ext === 'docx') return '📄';
      return '📃';
    }

    function renderAttachments() {
      if (!attachmentChips) return;
      attachmentChips.innerHTML = '';
      attachments.forEach(function(file, idx) {
        var chip = document.createElement('div');
        chip.className = 'attachment-chip';
        chip.innerHTML = getFileIcon(file.name) + ' ' + file.name +
          ' <button class="attachment-chip-remove" data-idx="' + idx + '" type="button">&times;</button>';
        attachmentChips.appendChild(chip);
      });
      attachmentChips.querySelectorAll('.attachment-chip-remove').forEach(function(btn) {
        btn.addEventListener('click', function() {
          attachments.splice(parseInt(btn.dataset.idx), 1);
          renderAttachments();
        });
      });
    }

    if (attachBtn && fileInput) {
      attachBtn.addEventListener('click', function() { fileInput.click(); });
      fileInput.addEventListener('change', function() {
        Array.from(fileInput.files).forEach(function(f) { attachments.push(f); });
        renderAttachments();
        fileInput.value = '';
      });
    }

    function scrollToBottom() {
      if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function addMessage(role, content, type) {
      if (!chatMessages) return;
      var row = document.createElement('div');
      row.className = 'chat-msg-row ' + (role === 'user' ? 'user-row' : 'assistant-row');
      var label = document.createElement('div');
      label.className = 'chat-msg-label';
      label.textContent = role === 'user' ? 'You' : 'Studiora AI Tutor';
      row.appendChild(label);

      var msg = document.createElement('div');
      if (type === 'file') {
        msg.className = 'chat-msg user file-preview';
        msg.innerHTML = getFileIcon(content) + ' ' + content;
      } else if (role === 'assistant') {
        msg.className = 'chat-msg assistant';
        msg.innerHTML = mdToHtml(content);
        msg.querySelectorAll('pre code').forEach(function(el) { if (window.hljs) hljs.highlightElement(el); });
      } else {
        msg.className = 'chat-msg ' + role;
        msg.textContent = content;
      }
      row.appendChild(msg);
      chatMessages.appendChild(row);
      scrollToBottom();
    }

    var currentChatId = null;

    function createOrGetChat(callback) {
      var active = document.querySelector('.chat-history-item.active');
      if (active) {
        currentChatId = active.dataset.chatId;
        if (callback) callback();
        return;
      }
      fetch('/api/ai/chats', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({title: 'New chat'}) })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (data.chat_id) {
            currentChatId = data.chat_id;
            if (callback) callback();
          }
        });
    }

    function hideWelcome() {
      var welcome = document.getElementById('chat-welcome');
      if (welcome) welcome.style.display = 'none';
      var suggestions = document.getElementById('chat-suggestions-wrap');
      if (suggestions) suggestions.style.display = 'none';
    }

    function uploadAttachments(chatId, files, done) {
      var uploaded = 0;
      if (files.length === 0) { done(); return; }
      files.forEach(function(file) {
        var fd = new FormData();
        fd.append('file', file);
        fetch('/api/ai/chats/' + chatId + '/upload', { method: 'POST', body: fd })
          .then(function(r) { return r.json(); })
          .then(function() { uploaded++; if (uploaded >= files.length) done(); })
          .catch(function() { uploaded++; if (uploaded >= files.length) done(); });
      });
    }

    function sendMessage() {
      if (!chatInput) return;
      var text = chatInput.value.trim();
      var pendingFiles = attachments.slice();
      if (!text && pendingFiles.length === 0) return;

      createOrGetChat(function() {
        hideWelcome();
        attachments = [];
        renderAttachments();

        pendingFiles.forEach(function(f) { addMessage('user', f.name, 'file'); });

        uploadAttachments(currentChatId, pendingFiles, function() {
          if (text) {
            addMessage('user', text);
            chatInput.value = '';
            chatInput.style.height = 'auto';

            var typingRow = document.createElement('div');
            typingRow.className = 'chat-msg-row assistant-row';
            typingRow.id = 'typing-row';
            var typingLabel = document.createElement('div');
            typingLabel.className = 'chat-msg-label';
            typingLabel.textContent = 'Studiora AI Tutor';
            typingRow.appendChild(typingLabel);
            var typingBubble = document.createElement('div');
            typingBubble.className = 'typing-bubble';
            typingBubble.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
            typingRow.appendChild(typingBubble);
            chatMessages.appendChild(typingRow);
            scrollToBottom();

          fetch('/api/ai/chats/' + currentChatId + '/chat', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({message: text})
          }).then(function(response) {
            var typingEl = document.getElementById('typing-row');
            if (typingEl) typingEl.remove();

            if (!response.ok) {
              addMessage('assistant', 'Error: AI service returned ' + response.status + '. Make sure the model server is running on port 5001.');
              return;
            }

            var row = document.createElement('div');
            row.className = 'chat-msg-row assistant-row';
            var label = document.createElement('div');
            label.className = 'chat-msg-label';
            label.textContent = 'Studiora AI Tutor';
            row.appendChild(label);
            var msg = document.createElement('div');
            msg.className = 'chat-msg assistant';
            row.appendChild(msg);
            chatMessages.appendChild(row);
            scrollToBottom();

            var rawMarkdown = '';
            var buffer = '';
            var renderTimer = null;
            function scheduleRender() {
              if (renderTimer) return;
              renderTimer = setTimeout(function() {
                renderTimer = null;
                if (rawMarkdown) msg.innerHTML = mdToHtml(rawMarkdown);
                scrollToBottom();
              }, 80);
            }
            var reader = response.body.getReader();
            var decoder = new TextDecoder();
            function readStream() {
              reader.read().then(function(result) {
                if (result.done) return;
                buffer += decoder.decode(result.value, {stream: true});
                var lines = buffer.split('\n');
                buffer = lines.pop() || '';
                lines.forEach(function(line) {
                  if (line.startsWith('data: ')) {
                    try {
                      var data = JSON.parse(line.slice(6));
                      if (data.type === 'token') {
                        rawMarkdown += data.content;
                        scheduleRender();
                      } else if (data.type === 'done') {
                        if (renderTimer) { clearTimeout(renderTimer); renderTimer = null; }
                        msg.innerHTML = mdToHtml(rawMarkdown);
                        msg.querySelectorAll('pre code').forEach(function(el) { if (window.hljs) hljs.highlightElement(el); });
                        if (window.MathJax) MathJax.typesetPromise([msg]).catch(function(){});
                        scrollToBottom();
                      }
                    } catch(e) {}
                  }
                });
                readStream();
              });
            }
            readStream();
          });
        }
      });
      });
    }

    if (sendBtn) sendBtn.addEventListener('click', sendMessage);
    if (chatInput) {
      chatInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
      });
      chatInput.addEventListener('input', function() {
        chatInput.style.height = 'auto';
        chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
      });
    }

    var newChatBtn = document.querySelector('.chat-new-btn');
    if (newChatBtn) {
      newChatBtn.addEventListener('click', function() {
        fetch('/api/ai/chats', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({title: 'New chat'}) })
          .then(function(r) { return r.json(); })
          .then(function(data) {
            if (data.chat_id) { window.location.reload(); }
          });
      });
    }

    document.querySelectorAll('.chat-history-item').forEach(function(item) {
      item.addEventListener('click', function(e) {
        e.preventDefault();
        document.querySelectorAll('.chat-history-item').forEach(function(i) { i.classList.remove('active'); });
        item.classList.add('active');
        currentChatId = item.dataset.chatId;
        chatMessages.innerHTML = '';
        hideWelcome();
        fetch('/api/ai/chats/' + currentChatId + '/history')
          .then(function(r) {
            if (!r.ok) { console.error('History fetch failed:', r.status); return r.json().then(function(d) { console.error(d); }); }
            return r.json();
          })
          .then(function(data) {
            if (!data) return;
            (data.messages || []).forEach(function(msg) {
              addMessage(msg.role, msg.content);
            });
          })
          .catch(function(err) { console.error('History error:', err); });
      });
    });

    document.querySelectorAll('.chat-delete-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var chatId = btn.dataset.chatId;
        if (!confirm('Delete this chat?')) return;
        fetch('/api/ai/chats/' + chatId, { method: 'DELETE' })
          .then(function(r) { return r.json(); })
          .then(function(data) {
            if (data.success) window.location.reload();
          });
      });
    });

    document.querySelectorAll('.suggestion-chip').forEach(function(chip) {
      chip.addEventListener('click', function() {
        if (chatInput) {
          chatInput.value = chip.dataset.prompt || chip.textContent;
          chatInput.focus();
        }
      });
    });

    if (chatSearch) {
      chatSearch.addEventListener('input', function() {
        var q = chatSearch.value.toLowerCase();
        document.querySelectorAll('.chat-history-item').forEach(function(item) {
          var title = item.dataset.title || '';
          item.style.display = title.indexOf(q) !== -1 ? '' : 'none';
        });
      });
    }

    var activeItem = document.querySelector('.chat-history-item.active');
    if (activeItem) {
      currentChatId = activeItem.dataset.chatId;
      fetch('/api/ai/chats/' + currentChatId + '/history')
        .then(function(r) { return r.json(); })
        .then(function(data) {
          (data.messages || []).forEach(function(msg) {
            addMessage(msg.role, msg.content);
          });
        });
    }

    scrollToBottom();
  };

  /* ── Upload Page ── */
  window.initUploadPage = function() {
    var zone = document.getElementById('upload-zone');
    var input = document.getElementById('upload-input');
    var browseBtn = document.getElementById('browse-btn');
    var fileList = document.getElementById('upload-file-list');
    var uploadBtn = document.getElementById('upload-btn');
    var clearBtn = document.getElementById('clear-files-btn');
    var pendingFiles = [];

    function getType(name) {
      var ext = name.split('.').pop().toUpperCase();
      return ext === 'DOCX' ? 'DOCX' : ext === 'TXT' ? 'TXT' : 'PDF';
    }

    function formatSize(bytes) {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / 1048576).toFixed(1) + ' MB';
    }

    function renderFileList() {
      if (!fileList) return;
      fileList.innerHTML = '';
      pendingFiles.forEach(function(file, idx) {
        var item = document.createElement('div');
        item.className = 'upload-file-item glass-card';
        item.innerHTML =
          '<span class="upload-file-icon">📄</span>' +
          '<div class="upload-file-info">' +
            '<div class="upload-file-name">' + file.name + '</div>' +
            '<div class="upload-file-meta">' + getType(file.name) + ' · ' + formatSize(file.size) + '</div>' +
          '</div>' +
          '<div class="upload-progress"><div class="upload-progress-fill" data-idx="' + idx + '" style="width:0%"></div></div>';
        fileList.appendChild(item);
      });
    }

    function addFiles(files) {
      Array.from(files).forEach(function(f) { pendingFiles.push(f); });
      renderFileList();
    }

    if (browseBtn && input) browseBtn.addEventListener('click', function() { input.click(); });
    if (input) input.addEventListener('change', function() { addFiles(input.files); input.value = ''; });

    if (zone) {
      zone.addEventListener('click', function(e) {
        if (e.target === browseBtn || browseBtn.contains(e.target)) return;
        if (input) input.click();
      });
      zone.addEventListener('dragover', function(e) { e.preventDefault(); zone.classList.add('dragover'); });
      zone.addEventListener('dragleave', function() { zone.classList.remove('dragover'); });
      zone.addEventListener('drop', function(e) {
        e.preventDefault();
        zone.classList.remove('dragover');
        addFiles(e.dataTransfer.files);
      });
    }

    if (uploadBtn) {
      uploadBtn.addEventListener('click', function() {
        document.querySelectorAll('.upload-progress-fill').forEach(function(bar) {
          var progress = 0;
          var interval = setInterval(function() {
            progress += Math.random() * 20;
            if (progress >= 100) { progress = 100; clearInterval(interval); }
            bar.style.width = progress + '%';
          }, 200);
        });
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', function() {
        pendingFiles = [];
        renderFileList();
      });
    }
  };

  /* ── Documents Page ── */
  window.initDocumentsPage = function() {
    var search = document.getElementById('doc-search');
    var filter = document.getElementById('doc-filter');

    function filterDocs() {
      var q = search ? search.value.toLowerCase() : '';
      var type = filter ? filter.value : 'all';
      document.querySelectorAll('#documents-table tbody tr').forEach(function(row) {
        var name = row.dataset.name || '';
        var rowType = row.dataset.type || '';
        var matchSearch = !q || name.indexOf(q) !== -1;
        var matchType = type === 'all' || rowType === type;
        row.style.display = matchSearch && matchType ? '' : 'none';
      });
    }

    if (search) search.addEventListener('input', filterDocs);
    if (filter) filter.addEventListener('change', filterDocs);
  };

  /* ── Generator Page ── */
  window.initGeneratorPage = function(content) {
    var preview = document.getElementById('preview-content');
    var currentType = 'summary';

    document.querySelectorAll('.gen-option-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.gen-option-btn').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        currentType = btn.dataset.type;
        if (preview && content) preview.textContent = content[currentType] || '';
      });
    });

    var genBtn = document.getElementById('generate-btn');
    if (genBtn) {
      genBtn.addEventListener('click', function() {
        if (preview && content) {
          preview.style.opacity = '0.3';
          setTimeout(function() {
            preview.textContent = content[currentType] || 'Generated content will appear here.';
            preview.style.opacity = '1';
          }, 600);
        }
      });
    }

    var exportPdf = document.getElementById('export-pdf');
    var exportDocx = document.getElementById('export-docx');
    if (exportPdf) {
      exportPdf.addEventListener('click', function() {
        alert('Export as PDF – backend integration coming soon.');
      });
    }
    if (exportDocx) {
      exportDocx.addEventListener('click', function() {
        alert('Export as DOCX – backend integration coming soon.');
      });
    }
  };

  /* ── History Page ── */
  window.initHistoryPage = function() {
    var search = document.getElementById('history-search');
    var filter = document.getElementById('history-filter');

    function filterHistory() {
      var q = search ? search.value.toLowerCase() : '';
      var type = filter ? filter.value : 'all';
      document.querySelectorAll('.history-item').forEach(function(item) {
        var title = item.dataset.title || '';
        var itemType = item.dataset.type || '';
        var matchSearch = !q || title.indexOf(q) !== -1;
        var matchType = type === 'all' || itemType === type;
        item.style.display = matchSearch && matchType ? '' : 'none';
      });
    }

    if (search) search.addEventListener('input', filterHistory);
    if (filter) filter.addEventListener('change', filterHistory);
  };

  /* ── Profile Page ── */
  window.initProfilePage = function() {
    var saveBtn = document.getElementById('save-settings-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', function() {
        saveBtn.textContent = 'Saved ✓';
        setTimeout(function() { saveBtn.textContent = 'Save Settings'; }, 2000);
      });
    }
  };

  /* ── Help Page ── */
  window.initHelpPage = function() {
    document.querySelectorAll('.faq-question').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var item = btn.closest('.faq-item');
        var isOpen = item.classList.contains('open');
        document.querySelectorAll('.faq-item').forEach(function(f) { f.classList.remove('open'); });
        if (!isOpen) item.classList.add('open');
      });
    });

    var supportSubmit = document.getElementById('support-submit');
    if (supportSubmit) {
      supportSubmit.addEventListener('click', function() {
        alert('Support request submitted! We\'ll get back to you soon.');
      });
    }

    var feedbackSubmit = document.getElementById('feedback-submit');
    if (feedbackSubmit) {
      feedbackSubmit.addEventListener('click', function() {
        var text = document.getElementById('feedback-text');
        if (text && text.value.trim()) {
          alert('Thank you for your feedback!');
          text.value = '';
        }
      });
    }
  };

  /* ── Markdown → HTML renderer ── */
  window.mdToHtml = function mdToHtml(raw) {
    if (!raw) return '';
    var codeBlocks = [];
    var s = raw.replace(/```(\w*)\n?([\s\S]*?)```/g, function(_, lang, code) {
      var idx = codeBlocks.length;
      codeBlocks.push({lang: lang || 'plaintext', code: code.trimEnd()});
      return '\x00CODE' + idx + '\x00';
    });
    var inlineCodes = [];
    s = s.replace(/`([^`\n]+)`/g, function(_, code) {
      var idx = inlineCodes.length;
      inlineCodes.push(esc(code));
      return '\x00INLINE' + idx + '\x00';
    });
    var links = [];
    s = s.replace(/\[([^\]\n]+)\]\((\/[^\s)]+|https?:\/\/[^\s)]+)\)/g, function(_, text, url) {
      var idx = links.length;
      var isDownload = /^\/download\//.test(url);
      var attrs = isDownload ? 'download' : 'target="_blank" rel="noopener noreferrer"';
      links.push('<a href="' + esc(url) + '" ' + attrs + '>' + esc(text) + '</a>');
      return '\x00LINK' + idx + '\x00';
    });
    s = s.replace(/&(?!\x00)/g, '&amp;').replace(/<(?!\x00)/g, '&lt;').replace(/>(?!\x00)/g, '&gt;');
    s = s.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    s = s.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    s = s.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    s = s.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\*(.+?)\*/g, '<em>$1</em>');
    s = s.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
    s = s.replace(/^---+$/gm, '<hr/>');
    /* Lists */
    s = (function(text) {
      var lines = text.split('\n'), out = [], mode = null, liOpen = false, nestedUl = false;
      function closeNested() { if (nestedUl) { out.push('</ul>'); nestedUl = false; } }
      function closeLi() { closeNested(); if (liOpen) { out.push('</li>'); liOpen = false; } }
      function closeOuter() { closeLi(); if (mode === 'ol') out.push('</ol>'); else if (mode === 'ul') out.push('</ul>'); mode = null; }
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i], om = /^[ \t]*\d+\.\s+(.+)$/.exec(line), um = /^[ \t]*[-*]\s+(.+)$/.exec(line);
        if (om) {
          if (mode !== 'ol') { closeOuter(); out.push('<ol>'); mode = 'ol'; } else { closeLi(); }
          out.push('<li>' + om[1].trim()); liOpen = true;
        } else if (um) {
          if (mode === 'ol' && liOpen) {
            if (!nestedUl) { out.push('<ul>'); nestedUl = true; }
            out.push('<li>' + um[1].trim() + '</li>');
          } else {
            if (mode !== 'ul') { closeOuter(); out.push('<ul>'); mode = 'ul'; }
            out.push('<li>' + um[1].trim() + '</li>');
          }
        } else if (line.trim() === '' && mode) {
          var j = i + 1;
          while (j < lines.length && lines[j].trim() === '') j++;
          var next = lines[j];
          var nextIsList = next !== undefined && (/^[ \t]*\d+\.\s+/.test(next) || /^[ \t]*[-*]\s+/.test(next));
          if (!nextIsList) { closeOuter(); out.push(''); }
        } else { closeOuter(); out.push(line); }
      }
      closeOuter();
      return out.join('\n');
    })(s);
    /* Paragraphs */
    s = s.split(/\n{2,}/).map(function(block) {
      block = block.trim();
      if (!block) return '';
      if (/^<(h[1-3]|ul|ol|blockquote|hr)/.test(block)) return block;
      return '<p>' + block.replace(/\n/g, '<br/>') + '</p>';
    }).join('');
    s = s.replace(/\x00INLINE(\d+)\x00/g, function(_, i) { return '<code>' + inlineCodes[parseInt(i)] + '</code>'; });
    s = s.replace(/\x00LINK(\d+)\x00/g, function(_, i) { return links[parseInt(i)]; });
    s = s.replace(/\x00CODE(\d+)\x00/g, function(_, i) {
      var b = codeBlocks[parseInt(i)];
      var escaped = b.code.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      return '<div class="code-block-wrap"><div class="code-block-header"><span class="code-lang">' + esc(b.lang) + '</span><button class="copy-btn" onclick="copyCode(this)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copy</button></div><pre><code class="language-' + esc(b.lang) + '">' + escaped + '</code></pre></div>';
    });
    return s;
  };

  function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  window.copyCode = function copyCode(btn) {
    var code = btn.closest('.code-block-wrap').querySelector('code').innerText;
    navigator.clipboard.writeText(code).then(function() {
      btn.innerHTML = '\u2713 Copied';
      setTimeout(function() { btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copy'; }, 1800);
    });
  };
})();
