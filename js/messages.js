/* ============================================
   DELTA BLACK — DIRECT MESSAGES (FINAL)
   Fixes:
   - Back button always visible in thread header
   - No double message (send guard + safe text)
   - closeAdminPanel resets state fully
   - Mobile: back returns to agent list
   - File-only messages don't crash
   - Real-time listener single render
   ============================================ */
const DB_Messages = {

    _threadListener:  null,
    _currentConvId:   null,
    _currentAgentNum: null,
    _attachedFile:    null,
    _sending:         false,   /* Guard against double-send */

    /* ══════════════════════════════════════
       OPEN / CLOSE
    ══════════════════════════════════════ */

    openAdminPanel: function() {
        var overlay = document.getElementById('admin-dm-overlay');
        if (!overlay) return;
        overlay.classList.remove('hidden');
        this._showAgentList();
        this._loadAgentList();
    },

    closeAdminPanel: function() {
        var overlay = document.getElementById('admin-dm-overlay');
        if (overlay) overlay.classList.add('hidden');
        this._detachThreadListener();
        this._currentConvId   = null;
        this._currentAgentNum = null;
        this._sending         = false;
        this._clearAttachment();
    },

    /* ══════════════════════════════════════
       PANEL NAVIGATION
    ══════════════════════════════════════ */

    _showAgentList: function() {
        /* Show left panel (mobile: full screen) */
        var left = document.querySelector('.dm-left-panel');
        if (left) left.classList.remove('dm-panel-hidden');

        /* Hide thread, show no-selection on right */
        var thread = document.getElementById('admin-dm-thread');
        var noSel  = document.getElementById('dm-no-selection');
        if (thread) { thread.classList.add('hidden'); thread.style.display = ''; }
        if (noSel)  { noSel.classList.remove('hidden'); noSel.style.display = ''; }

        /* Clear active highlight */
        document.querySelectorAll('.dm-agent-item').forEach(function(el){
            el.classList.remove('dm-agent-active');
        });

        this._detachThreadListener();
        this._currentConvId   = null;
        this._currentAgentNum = null;
    },

    _showThread: function() {
        /* On mobile: hide left panel, show thread full screen */
        var left = document.querySelector('.dm-left-panel');
        if (left && window.innerWidth <= 700) left.classList.add('dm-panel-hidden');

        var noSel  = document.getElementById('dm-no-selection');
        var thread = document.getElementById('admin-dm-thread');
        if (noSel) { noSel.classList.add('hidden'); noSel.style.display = 'none'; }
        if (thread) {
            thread.classList.remove('hidden');
            thread.style.display       = 'flex';
            thread.style.flexDirection = 'column';
            thread.style.flex          = '1';
            thread.style.minHeight     = '0';
            thread.style.height        = '100%';
        }
    },

    backToList: function() {
        this._showAgentList();
        this._loadAgentList(
            document.getElementById('dm-agent-search')
                ? document.getElementById('dm-agent-search').value : ''
        );
    },

    /* ══════════════════════════════════════
       LEFT PANEL — AGENT LIST
    ══════════════════════════════════════ */

    _loadAgentList: function(filter) {
        var self = this;
        var list = document.getElementById('admin-dm-agent-list');
        if (!list) return;

        Promise.all([
            DB_Storage.getUsers(),
            DB_Storage.getConversations()
        ]).then(function(res) {
            var users   = res[0].filter(function(u){ return u.role !== 'admin'; });
            var convs   = res[1];
            var convMap = {};
            convs.forEach(function(c){ convMap[c.agentNumber] = c; });

            /* Filter by agent number, nickname or barCode */
            if (filter && filter.trim()) {
                var f = filter.toLowerCase();
                users = users.filter(function(u){
                    return (u.agentNumber || '').toLowerCase().indexOf(f) !== -1 ||
                           (u.nickname    || '').toLowerCase().indexOf(f) !== -1 ||
                           (u.barCode     || '').toLowerCase().indexOf(f) !== -1;
                });
            }

            if (!users.length) {
                list.innerHTML = '<p class="dm-empty-hint">' +
                    (filter ? 'No agents match search.' : 'No agents registered.') + '</p>';
                return;
            }

            /* Sort by most recent message */
            users.sort(function(a, b) {
                var ta = convMap[a.agentNumber] ? new Date(convMap[a.agentNumber].lastAt || 0) : new Date(0);
                var tb = convMap[b.agentNumber] ? new Date(convMap[b.agentNumber].lastAt || 0) : new Date(0);
                return tb - ta;
            });

            list.innerHTML = users.map(function(u) {
                var conv    = convMap[u.agentNumber];
                var msgs    = conv ? Object.values(conv.msgs || {}) : [];
                var unread  = msgs.filter(function(m){
                    return !m.readAt && m.fromAgent !== '001';
                }).length;
                var preview = conv ? (conv.lastMessage || 'Start conversation') : 'Start conversation';
                var time    = conv && conv.lastAt ? DB_Utils.formatDateShort(conv.lastAt) : '';
                var active  = self._currentAgentNum === u.agentNumber;

                return '<div class="dm-agent-item' + (active ? ' dm-agent-active' : '') +
                    '" onclick="DB_Messages.openThread(\'' + u.agentNumber + '\')" ' +
                    'id="dm-agent-item-' + u.agentNumber + '">' +
                    '<div class="dm-agent-avatar">◆</div>' +
                    '<div class="dm-agent-info">' +
                        '<div class="dm-agent-name-row">' +
                            '<span class="dm-agent-name">Agent ' + DB_Utils.escapeHtml(u.agentNumber) +
                                ' — ' + DB_Utils.escapeHtml(u.nickname) + '</span>' +
                            (time ? '<span class="dm-agent-time">' + time + '</span>' : '') +
                        '</div>' +
                        '<div class="dm-agent-preview-row">' +
                            '<span class="dm-agent-preview">' +
                                DB_Utils.escapeHtml(preview.substring(0, 38)) +
                            '</span>' +
                            (unread ? '<span class="unread-badge">' + unread + '</span>' : '') +
                        '</div>' +
                    '</div>' +
                '</div>';
            }).join('');
        });
    },

    searchAgents: function() {
        var input = document.getElementById('dm-agent-search');
        this._loadAgentList(input ? input.value : '');
    },

    /* ══════════════════════════════════════
       OPEN THREAD
    ══════════════════════════════════════ */

    openThread: function(agentNumber) {
        var self   = this;
        var convId = 'conv_' + agentNumber;

        this._currentConvId   = convId;
        this._currentAgentNum = agentNumber;
        this._sending         = false;

        /* Store on DOM */
        var thread = document.getElementById('admin-dm-thread');
        if (thread) {
            thread.dataset.convId   = convId;
            thread.dataset.agentNum = agentNumber;
        }

        /* Highlight agent in list */
        document.querySelectorAll('.dm-agent-item').forEach(function(el){
            el.classList.remove('dm-agent-active');
        });
        var activeItem = document.getElementById('dm-agent-item-' + agentNumber);
        if (activeItem) activeItem.classList.add('dm-agent-active');

        /* Show thread panel */
        this._showThread();

        /* Set header */
        DB_Storage.getUserByAgentNumber(agentNumber).then(function(u) {
            DB_Utils.setText('dm-thread-title',
                u ? 'Agent ' + u.agentNumber + ' — ' + u.nickname : 'Agent ' + agentNumber);
            DB_Utils.setText('dm-thread-status',
                u && u.lastLogin ? '● Active' : '○ Inactive');
        });

        /* Detach old listener before attaching new */
        self._detachThreadListener();

        /* Loading state */
        DB_Utils.setHtml('dm-thread-messages',
            '<div class="loading-state">Loading messages...</div>');

        /* Attach real-time listener */
        var ref = DB_Ref.conversation(convId);
        var fn  = ref.on('value', function(snap) {
            self._renderMessages(snap.val(), convId, agentNumber);
        });
        self._threadListener = { ref: ref, fn: fn };

        /* Reset compose */
        DB_Utils.clearValue('admin-dm-compose');
        self._clearAttachment();
        setTimeout(function(){
            var ta = document.getElementById('admin-dm-compose');
            if (ta) ta.focus();
        }, 300);
    },

    /* ══════════════════════════════════════
       RENDER MESSAGES
    ══════════════════════════════════════ */

    _renderMessages: function(conv, convId, agentNumber) {
        var container = document.getElementById('dm-thread-messages');
        if (!container) return;

        /* Remember scroll position — only auto-scroll if already at bottom */
        var atBottom = (container.scrollHeight - container.scrollTop - container.clientHeight) < 60;

        if (!conv || !Object.keys(conv.msgs || {}).length) {
            container.innerHTML =
                '<div class="dm-empty-thread">' +
                    '<div class="dm-empty-icon">💬</div>' +
                    '<p>No messages yet.</p>' +
                    '<span>Send the first message below.</span>' +
                '</div>';
            return;
        }

        var msgs = Object.values(conv.msgs || {})
            .sort(function(a,b){ return new Date(a.sentAt) - new Date(b.sentAt); });

        var html     = '';
        var lastDate = '';

        msgs.forEach(function(m) {
            var msgDate = new Date(m.sentAt).toLocaleDateString('en-US',{
                weekday:'long', month:'short', day:'numeric'
            });
            if (msgDate !== lastDate) {
                html += '<div class="dm-date-divider"><span>' + msgDate + '</span></div>';
                lastDate = msgDate;
            }

            var isAdmin = m.fromAgent === '001';
            var timeStr = new Date(m.sentAt).toLocaleTimeString('en-US',{
                hour:'2-digit', minute:'2-digit'
            });

            html += '<div class="dm-msg-row ' + (isAdmin ? 'dm-msg-row-admin' : 'dm-msg-row-agent') +
                '" id="msg-' + m.id + '">';

            if (!isAdmin) html += '<div class="dm-msg-avatar dm-msg-avatar-agent">◆</div>';

            html += '<div class="dm-msg-content">';
            html += '<div class="dm-msg-sender">' + (isAdmin ? 'You' : 'Agent ' + agentNumber) + '</div>';
            html += '<div class="dm-msg-bubble ' + (isAdmin ? 'dm-bubble-admin' : 'dm-bubble-agent') + '">';

            /* File */
            if (m.fileUrl) {
                var mt = m.fileType || '';
                if (mt.indexOf('image/') === 0) {
                    html += '<img src="' + m.fileUrl + '" class="dm-msg-img" ' +
                        'onclick="window.open(\'' + m.fileUrl + '\')">';
                } else if (mt.indexOf('video/') === 0) {
                    html += '<video controls src="' + m.fileUrl + '" class="dm-msg-media"></video>';
                } else if (mt.indexOf('audio/') === 0) {
                    html += '<audio controls src="' + m.fileUrl +
                        '" style="width:100%;margin-bottom:0.3rem;"></audio>';
                } else {
                    html += '<a href="' + m.fileUrl + '" target="_blank" class="dm-msg-file">' +
                        '📎 ' + DB_Utils.escapeHtml(m.fileName || 'Download File') + '</a>';
                }
            }

            /* Text */
            if (m.text && m.text.trim()) {
                html += '<div class="dm-msg-text">' + DB_Utils.escapeHtml(m.text) + '</div>';
            }

            html += '</div>'; /* end bubble */

            html += '<div class="dm-msg-meta">' +
                '<span class="dm-msg-time">' + timeStr + '</span>' +
                (m.readAt ? '<span class="dm-msg-read">✓ Read</span>' : '') +
                (m.savedToUserData ? '<span class="dm-msg-saved">💾</span>' : '') +
                '<span class="dm-msg-options" onclick="DB_Messages.toggleMsgMenu(\'' +
                    m.id + '\',\'' + convId + '\',\'' + agentNumber + '\',' + isAdmin + ')">•••</span>' +
                '</div>';

            html += '<div class="dm-msg-menu hidden" id="menu-' + m.id + '">' +
                (!isAdmin ? '<button onclick="DB_Messages.saveToUserData(\'' + convId +
                    '\',\'' + m.id + '\',\'' + agentNumber + '\')">💾 Save to UserData</button>' : '') +
                '<button onclick="DB_Messages.deleteMessage(\'' + convId + '\',\'' +
                    m.id + '\')">🗑 Delete Message</button>' +
                '</div>';

            html += '</div>'; /* end content */
            if (isAdmin) html += '<div class="dm-msg-avatar dm-msg-avatar-admin">★</div>';
            html += '</div>'; /* end row */
        });

        container.innerHTML = html;

        /* Only scroll to bottom if user was already at bottom */
        if (atBottom) container.scrollTop = container.scrollHeight;

        /* Refresh agent list previews silently */
        var search = document.getElementById('dm-agent-search');
        this._loadAgentList(search ? search.value : '');
    },

    toggleMsgMenu: function(msgId, convId, agentNumber, isAdmin) {
        document.querySelectorAll('.dm-msg-menu').forEach(function(el){
            if (el.id !== 'menu-' + msgId) el.classList.add('hidden');
        });
        var menu = document.getElementById('menu-' + msgId);
        if (menu) menu.classList.toggle('hidden');

        /* Close menu when clicking anywhere else */
        setTimeout(function(){
            document.addEventListener('click', function handler(e){
                if (!e.target.classList.contains('dm-msg-options')) {
                    document.querySelectorAll('.dm-msg-menu').forEach(function(el){
                        el.classList.add('hidden');
                    });
                }
                document.removeEventListener('click', handler);
            });
        }, 10);
    },

    /* ══════════════════════════════════════
       SEND MESSAGE — guarded against double-send
    ══════════════════════════════════════ */

    sendAdminMessage: function() {
        var self = this;

        /* Double-send guard */
        if (this._sending) return;

        var text = (document.getElementById('admin-dm-compose') || {}).value || '';
        text = text.trim();

        /* Recover convId from DOM if needed */
        var thread = document.getElementById('admin-dm-thread');
        if (!this._currentConvId && thread && thread.dataset.convId) {
            this._currentConvId   = thread.dataset.convId;
            this._currentAgentNum = thread.dataset.agentNum;
        }

        var convId = this._currentConvId;
        var ag     = this._currentAgentNum;

        if (!convId || !ag) { DB_Utils.toast('Select an agent first', 'error'); return; }
        if (!text && !this._attachedFile) {
            DB_Utils.toast('Type a message or attach a file', 'error'); return;
        }

        this._sending = true;
        var btn = document.getElementById('btn-send-admin-dm');
        if (btn) { btn.disabled = true; btn.textContent = '...'; }

        var done = function() {
            self._sending = false;
            if (btn) { btn.disabled = false; btn.textContent = '➤'; }
        };

        var buildAndSend = function(fileUrl, fileType, fileName) {
            var msg = {
                id:        DB_Utils.generateId(),
                fromAgent: '001',
                toAgent:   ag,
                sentAt:    new Date().toISOString(),
                readAt:    null
            };
            /* Only set text if non-empty */
            if (text) msg.text = text;
            if (fileUrl)  msg.fileUrl  = fileUrl;
            if (fileType) msg.fileType = fileType;
            if (fileName) msg.fileName = fileName;

            DB_Storage.sendMessage(convId, msg).then(function() {
                DB_Utils.clearValue('admin-dm-compose');
                self._clearAttachment();
                DB_Storage.logActivity('001', 'MESSAGE_SENT', 'To Agent ' + ag).catch(function(){});
                done();
            }).catch(function(e) {
                DB_Utils.toast('Send failed: ' + e.message, 'error');
                done();
            });
        };

        if (this._attachedFile) {
            var file = this._attachedFile;
            var path = 'messages/' + DB_Utils.generateId() + '_' + file.name;

            /* Show progress */
            var track = document.querySelector('.dm-upload-track');
            var bar   = document.getElementById('dm-upload-progress');
            if (track) track.classList.remove('hidden');

            DB_Storage.uploadMedia(file, path, function(pct) {
                if (bar) bar.style.width = pct + '%';
            }).then(function(url) {
                if (track) track.classList.add('hidden');
                if (bar)   bar.style.width = '0%';
                buildAndSend(url, file.type, file.name);
            }).catch(function(e) {
                if (track) track.classList.add('hidden');
                DB_Utils.toast('Upload failed: ' + e.message, 'error');
                done();
            });
        } else {
            buildAndSend(null, null, null);
        }
    },

    onComposeKeydown: function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            DB_Messages.sendAdminMessage();
        }
    },

    /* ══════════════════════════════════════
       FILE ATTACHMENT
    ══════════════════════════════════════ */

    handleFileAttach: function() {
        var input = document.getElementById('dm-file-input');
        var file  = input ? input.files[0] : null;
        if (!file) return;
        this._attachedFile = file;

        var prev = document.getElementById('dm-file-preview');
        if (!prev) return;
        prev.classList.remove('hidden');

        var sizeMB = (file.size / (1024 * 1024)).toFixed(2);
        var inner  = '';

        if (file.type.indexOf('image/') === 0) {
            inner = '<img src="' + URL.createObjectURL(file) +
                '" style="max-height:70px;max-width:100px;object-fit:cover;">';
        } else if (file.type.indexOf('video/') === 0) {
            inner = '<video src="' + URL.createObjectURL(file) +
                '" style="max-height:70px;max-width:120px;" controls></video>';
        } else {
            inner = '<span class="dm-file-name">📎 ' + DB_Utils.escapeHtml(file.name) + '</span>';
        }
        inner += '<span class="dm-file-size">' + sizeMB + ' MB</span>';
        inner += '<button class="dm-remove-file" onclick="DB_Messages._clearAttachment()">✕</button>';
        inner += '<div class="dm-upload-track hidden">' +
            '<div id="dm-upload-progress" style="width:0%;height:3px;background:var(--accent);transition:width 0.2s;"></div>' +
            '</div>';
        prev.innerHTML = inner;
    },

    _clearAttachment: function() {
        this._attachedFile = null;
        var prev  = document.getElementById('dm-file-preview');
        var input = document.getElementById('dm-file-input');
        if (prev)  { prev.innerHTML = ''; prev.classList.add('hidden'); }
        if (input) input.value = '';
    },

    /* ══════════════════════════════════════
       DELETE / CLEAR
    ══════════════════════════════════════ */

    deleteMessage: function(convId, msgId) {
        document.querySelectorAll('.dm-msg-menu').forEach(function(el){ el.classList.add('hidden'); });
        if (!confirm('Delete this message?')) return;

        DB_Ref.conversation(convId).child('msgs').child(msgId).remove().then(function() {
            DB_Utils.toast('Message deleted', 'success');
            /* Update last message preview */
            DB_Storage.getConversation(convId).then(function(conv) {
                if (!conv) return;
                var remaining = Object.values(conv.msgs || {})
                    .sort(function(a,b){ return new Date(b.sentAt) - new Date(a.sentAt); });
                var last = remaining[0];
                DB_Ref.conversation(convId).update({
                    lastMessage: last ? ((last.text || last.fileName || '').substring(0, 80)) : '',
                    lastAt:      last ? last.sentAt : conv.lastAt
                });
            });
        }).catch(function(e){ DB_Utils.toast('Delete failed: ' + e.message, 'error'); });
    },

    clearChat: function() {
        var thread = document.getElementById('admin-dm-thread');
        var convId = this._currentConvId ||
            (thread ? thread.dataset.convId : null);
        if (!convId) return;
        if (!confirm('Clear entire conversation? This cannot be undone.')) return;

        DB_Ref.conversation(convId).child('msgs').remove().then(function() {
            DB_Ref.conversation(convId).update({
                lastMessage: '',
                lastAt: new Date().toISOString()
            });
            DB_Utils.toast('Conversation cleared', 'success');
        }).catch(function(e){ DB_Utils.toast('Clear failed: ' + e.message, 'error'); });
    },

    /* ══════════════════════════════════════
       SAVE TO USER DATA
    ══════════════════════════════════════ */

    saveToUserData: function(convId, msgId, agentNumber) {
        document.querySelectorAll('.dm-msg-menu').forEach(function(el){ el.classList.add('hidden'); });
        DB_Storage.getConversation(convId).then(function(conv) {
            if (!conv) return;
            var msg = (conv.msgs || {})[msgId];
            if (!msg) return;
            var item = {
                id:          DB_Utils.generateId(),
                type:        'message_response',
                source:      'Direct Message',
                content:     msg.text || msg.fileName || '',
                savedAt:     new Date().toISOString(),
                status:      'saved',
                allowedView: false
            };
            return DB_Storage.saveUserDataItem(agentNumber, item).then(function() {
                return DB_Ref.conversation(convId).child('msgs').child(msgId)
                    .update({ savedToUserData: true });
            }).then(function() {
                DB_Utils.toast('Saved to UserData for Agent ' + agentNumber, 'success');
            });
        });
    },

    /* ══════════════════════════════════════
       LISTENER CLEANUP
    ══════════════════════════════════════ */

    _detachThreadListener: function() {
        if (this._threadListener) {
            try { this._threadListener.ref.off('value', this._threadListener.fn); } catch(e){}
            this._threadListener = null;
        }
    },

    /* ══════════════════════════════════════
       AGENT UNREAD BADGE
    ══════════════════════════════════════ */

    startAgentListener: function(agentNumber) {
        DB_Storage.listenForMessages(agentNumber, function(convs) {
            var total = 0;
            convs.forEach(function(c) {
                total += Object.values(c.msgs || {})
                    .filter(function(m){ return !m.readAt && m.fromAgent === '001'; }).length;
            });
            var badge = document.getElementById('user-dm-badge');
            if (badge) {
                badge.textContent   = total;
                badge.style.display = total > 0 ? 'inline-block' : 'none';
            }
        });
    },

    /* ══════════════════════════════════════
       AGENT INBOX
    ══════════════════════════════════════ */

    openAgentInbox: function() {
        var overlay = document.getElementById('agent-dm-overlay');
        if (!overlay) return;
        overlay.classList.remove('hidden');
        var user = DB_Storage.getCurrentUser();
        if (!user) return;

        var convId = 'conv_' + user.agentNumber;
        DB_Storage.getConversation(convId).then(function(conv) {
            var container = document.getElementById('agent-dm-messages');
            if (!conv || !Object.keys(conv.msgs || {}).length) {
                if (container) container.innerHTML =
                    '<p class="empty-hint">No messages from Command yet.</p>';
                return;
            }
            var msgs = Object.values(conv.msgs || {})
                .sort(function(a,b){ return new Date(a.sentAt) - new Date(b.sentAt); });

            msgs.forEach(function(m) {
                if (!m.readAt && m.fromAgent === '001') {
                    DB_Storage.markMessageRead(convId, m.id).catch(function(){});
                }
            });
            DB_Storage.logActivity(user.agentNumber, 'MESSAGES_READ', 'Opened inbox')
                .catch(function(){});

            if (!container) return;
            container.innerHTML = msgs.map(function(m) {
                var isAdmin = m.fromAgent === '001';
                var html = '<div class="msg-bubble ' + (isAdmin ? 'msg-admin' : 'msg-agent-reply') + '">' +
                    '<div class="msg-label">' + (isAdmin ? 'Command' : 'You') + '</div>';
                if (m.fileUrl) {
                    var mt = m.fileType || '';
                    if (mt.indexOf('image/') === 0)
                        html += '<img src="' + m.fileUrl + '" class="dm-msg-img">';
                    else if (mt.indexOf('video/') === 0)
                        html += '<video controls src="' + m.fileUrl + '" class="dm-msg-media"></video>';
                    else if (mt.indexOf('audio/') === 0)
                        html += '<audio controls src="' + m.fileUrl + '" style="width:100%"></audio>';
                    else
                        html += '<a href="' + m.fileUrl + '" target="_blank" class="q-file-link">' +
                            '📎 ' + DB_Utils.escapeHtml(m.fileName || 'Download') + '</a>';
                }
                if (m.text) html += '<div class="msg-text">' + DB_Utils.escapeHtml(m.text) + '</div>';
                html += '<div class="msg-meta">' + DB_Utils.formatDate(m.sentAt) + '</div></div>';
                return html;
            }).join('');
            container.scrollTop = container.scrollHeight;
        });
    },

    sendAgentReply: function() {
        var user = DB_Storage.getCurrentUser();
        if (!user) return;
        var text = DB_Utils.getValue('agent-dm-reply');
        if (!text) return;
        var convId = 'conv_' + user.agentNumber;
        var msg = {
            id:        DB_Utils.generateId(),
            text:      text,
            fromAgent: user.agentNumber,
            toAgent:   '001',
            sentAt:    new Date().toISOString(),
            readAt:    null
        };
        DB_Storage.sendMessage(convId, msg).then(function() {
            DB_Utils.clearValue('agent-dm-reply');
            DB_Storage.logActivity(user.agentNumber, 'REPLY_SENT', 'Replied to Command')
                .catch(function(){});
            DB_Messages.openAgentInbox();
        });
    }
};
