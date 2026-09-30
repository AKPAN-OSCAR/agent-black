/* ============================================
   DELTA BLACK — STORAGE LAYER
   All Firebase Realtime DB reads/writes.
   Real-time cross-device sync.
   ============================================ */
const DB_Storage = {

    currentUser: null,
    _listeners:  {},

    /* ── USERS ─────────────────────────────── */

    getUsers: function() {
        return DB_Ref.users().once('value').then(function(s) {
            return Object.values(s.val() || {});
        });
    },

    getUserByAgentNumber: function(id) {
        return DB_Ref.user(id).once('value').then(function(s) {
            return s.val() || null;
        });
    },

    addUser:    function(u) { return DB_Ref.user(u.agentNumber).set(u); },
    saveUser:   function(u) { return DB_Ref.user(u.agentNumber).set(u); },
    updateUser: function(u) { return DB_Ref.user(u.agentNumber).update(u); },

    deleteUserByAgentNumber: function(id) {
        var self = this;
        return DB_Ref.user(id).remove().then(function() {
            return self.getResponses();
        }).then(function(rs) {
            return Promise.all(rs
                .filter(function(r){ return r.agentNumber === id; })
                .map(function(r){ return DB_Ref.response(r.id).remove(); })
            );
        });
    },

    listenForUsers: function(cb) {
        var ref = DB_Ref.users();
        var fn  = ref.on('value', function(s) { cb(Object.values(s.val() || {})); });
        this._listeners['users'] = { ref: ref, fn: fn };
    },

    /* ── QUESTIONS ─────────────────────────── */

    getQuestions: function() {
        return DB_Ref.questions().once('value').then(function(s) {
            return Object.values(s.val() || {}).sort(function(a,b){
                return new Date(a.sentAt) - new Date(b.sentAt);
            });
        });
    },

    addQuestion: function(q) { return DB_Ref.question(q.id).set(q); },

    getQuestionsForAgent: function(ag) {
        return this.getQuestions().then(function(qs) {
            return qs.filter(function(q) {
                return q.targetAgents.indexOf(ag) !== -1 ||
                       q.targetAgents.indexOf('all') !== -1;
            });
        });
    },

    listenForQuestions: function(ag, cb) {
        var ref = DB_Ref.questions();
        var fn  = ref.on('value', function(s) {
            var qs = Object.values(s.val() || {})
                .filter(function(q) {
                    return q.targetAgents.indexOf(ag) !== -1 ||
                           q.targetAgents.indexOf('all') !== -1;
                })
                .sort(function(a,b){ return new Date(a.sentAt) - new Date(b.sentAt); });
            cb(qs);
        });
        this._listeners['questions_' + ag] = { ref: ref, fn: fn };
    },

    /* ── RESPONSES ─────────────────────────── */

    getResponses: function() {
        return DB_Ref.responses().once('value').then(function(s) {
            return Object.values(s.val() || {});
        });
    },

    addResponse: function(r) { return DB_Ref.response(r.id).set(r); },

    getResponsesByAgent: function(ag) {
        return this.getResponses().then(function(rs) {
            return rs.filter(function(r){ return r.agentNumber === ag; });
        });
    },

    getAnsweredQuestionIds: function(ag) {
        return this.getResponsesByAgent(ag).then(function(rs) {
            return rs.map(function(r){ return r.questionId; });
        });
    },

    listenForResponses: function(cb) {
        var ref = DB_Ref.responses();
        var fn  = ref.on('value', function(s) { cb(Object.values(s.val() || {})); });
        this._listeners['responses'] = { ref: ref, fn: fn };
    },

    /* ── READ RECEIPTS ─────────────────────── */

    markSeen: function(questionId, agentNumber) {
        return DB_Ref.receipt(questionId, agentNumber).update({
            agentNumber: agentNumber,
            seenAt:      new Date().toISOString()
        });
    },

    getReceipts: function(questionId) {
        return DB_Ref.receipts(questionId).once('value').then(function(s) {
            return s.val() || {};
        });
    },

    /* ── MESSAGES ──────────────────────────── */

    getConversations: function() {
        return DB_Ref.messages().once('value').then(function(s) {
            return Object.values(s.val() || {});
        });
    },

    getConversation: function(convId) {
        return DB_Ref.conversation(convId).once('value').then(function(s) {
            return s.val() || null;
        });
    },

    sendMessage: function(convId, msg) {
        return DB_Ref.message(convId, msg.id).set(msg).then(function() {
            /* Safe preview — handle file-only messages with no text */
            var preview = (msg.text || msg.fileName || '').substring(0, 80);
            return DB_Ref.conversation(convId).update({
                lastMessage: preview,
                lastAt:      msg.sentAt,
                agentNumber: msg.toAgent !== '001' ? msg.toAgent : msg.fromAgent
            });
        });
    },

    markMessageRead: function(convId, msgId) {
        return DB_Ref.conversation(convId).child('msgs').child(msgId)
            .update({ readAt: new Date().toISOString() });
    },

    listenForMessages: function(agentNumber, cb) {
        var ref = DB_Ref.messages();
        var fn  = ref.on('value', function(s) {
            var all  = Object.values(s.val() || {});
            var mine = all.filter(function(c) {
                return c.agentNumber === agentNumber;
            });
            cb(mine);
        });
        this._listeners['messages_' + agentNumber] = { ref: ref, fn: fn };
    },

    listenForAllMessages: function(cb) {
        var ref = DB_Ref.messages();
        var fn  = ref.on('value', function(s) { cb(Object.values(s.val() || {})); });
        this._listeners['messages_all'] = { ref: ref, fn: fn };
    },

    /* ── ALERTS ────────────────────────────── */

    getAlerts: function() {
        return DB_Ref.alerts().once('value').then(function(s) {
            return Object.values(s.val() || {}).sort(function(a,b){
                return new Date(b.sentAt) - new Date(a.sentAt);
            });
        });
    },

    sendAlert: function(alert) { return DB_Ref.alert(alert.id).set(alert); },

    acknowledgeAlert: function(alertId, agentNumber) {
        return DB_Ref.alert(alertId).child('acks').child(agentNumber)
            .set({ agentNumber: agentNumber, ackedAt: new Date().toISOString() });
    },

    listenForAlerts: function(cb) {
        var ref = DB_Ref.alerts();
        var fn  = ref.on('value', function(s) {
            cb(Object.values(s.val() || {}).sort(function(a,b){
                return new Date(b.sentAt) - new Date(a.sentAt);
            }));
        });
        this._listeners['alerts'] = { ref: ref, fn: fn };
    },

    /* ── ACTIVITY LOG ──────────────────────── */

    logActivity: function(agentNumber, event, detail) {
        var id   = DB_Utils.generateId();
        var item = {
            id:          id,
            agentNumber: agentNumber,
            event:       event,
            detail:      detail || '',
            timestamp:   new Date().toISOString()
        };
        return DB_Ref.activityItem(agentNumber, id).set(item);
    },

    getActivity: function(agentNumber) {
        return DB_Ref.activity(agentNumber).once('value').then(function(s) {
            return Object.values(s.val() || {}).sort(function(a,b){
                return new Date(b.timestamp) - new Date(a.timestamp);
            });
        });
    },

    getAllActivity: function() {
        return DB.ref('activity').once('value').then(function(s) {
            var data  = s.val() || {};
            var items = [];
            Object.values(data).forEach(function(agentLogs) {
                Object.values(agentLogs).forEach(function(item) { items.push(item); });
            });
            return items.sort(function(a,b){
                return new Date(b.timestamp) - new Date(a.timestamp);
            });
        });
    },

    /* ── USER DATA ─────────────────────────── */

    getUserData: function(agentNumber) {
        return DB_Ref.userdata(agentNumber).once('value').then(function(s) {
            return Object.values(s.val() || {});
        });
    },

    saveUserDataItem: function(agentNumber, item) {
        return DB_Ref.userdataItem(agentNumber, item.id).set(item);
    },

    updateUserDataItem: function(agentNumber, itemId, updates) {
        return DB_Ref.userdataItem(agentNumber, itemId).update(updates);
    },

    deleteUserDataItem: function(agentNumber, itemId) {
        return DB_Ref.userdataItem(agentNumber, itemId).remove();
    },

    /* ── WELCOME MESSAGE ───────────────────── */

    getWelcomeMessage: function() {
        return DB_Ref.welcomeMessage().once('value').then(function(s) {
            return s.val() || DB_CONFIG.DEFAULT_WELCOME;
        });
    },

    setWelcomeMessage: function(m) { return DB_Ref.welcomeMessage().set(m); },

    /* ── SESSION ───────────────────────────── */

    getCurrentUser: function() {
        try {
            var d = localStorage.getItem(DB_CONFIG.STORAGE_KEYS.currentUser);
            return d ? JSON.parse(d) : null;
        } catch(e) { return null; }
    },

    setCurrentUser: function(u) {
        this.currentUser = u;
        try { localStorage.setItem(DB_CONFIG.STORAGE_KEYS.currentUser, JSON.stringify(u)); }
        catch(e) {}
    },

    clearCurrentUser: function() {
        this.currentUser = null;
        try { localStorage.removeItem(DB_CONFIG.STORAGE_KEYS.currentUser); } catch(e) {}
        this._detachAllListeners();
    },

    /* ── MEDIA ─────────────────────────────── */

    uploadMedia: function(file, path, onProgress) {
        var self = this;
        return new Promise(function(resolve, reject) {

            /* For images under 10MB — compress before upload for speed */
            if (file.type.startsWith('image/') && file.size > 200 * 1024) {
                self._compressImage(file, function(compressed) {
                    self._doFirebaseUpload(compressed, path, onProgress, resolve, reject);
                });
            } else {
                self._doFirebaseUpload(file, path, onProgress, resolve, reject);
            }
        });
    },

    /* Image compression — reduces size up to 80% before upload */
    _compressImage: function(file, callback) {
        var canvas = document.createElement('canvas');
        var ctx    = canvas.getContext('2d');
        var img    = new Image();
        var url    = URL.createObjectURL(file);

        img.onload = function() {
            URL.revokeObjectURL(url);

            /* Max dimension 1920px — preserves quality for viewing */
            var MAX  = 1920;
            var w    = img.width;
            var h    = img.height;
            if (w > MAX || h > MAX) {
                if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
                else        { w = Math.round(w * MAX / h); h = MAX; }
            }
            canvas.width  = w;
            canvas.height = h;
            ctx.drawImage(img, 0, 0, w, h);

            canvas.toBlob(function(blob) {
                if (blob && blob.size < file.size) {
                    /* Use compressed version */
                    var compressed = new File([blob], file.name,
                        { type: 'image/jpeg', lastModified: Date.now() });
                    callback(compressed);
                } else {
                    /* Compressed is bigger — use original */
                    callback(file);
                }
            }, 'image/jpeg', 0.82);
        };

        img.onerror = function() {
            URL.revokeObjectURL(url);
            callback(file); /* fallback to original */
        };
        img.src = url;
    },

    _doFirebaseUpload: function(file, path, onProgress, resolve, reject) {
        var ref      = STORAGE.ref().child(path);
        var metadata = {
            contentType:  file.type || 'application/octet-stream',
            cacheControl: 'public,max-age=31536000',
            customMetadata: {
                originalName: file.name,
                uploadedAt:   new Date().toISOString()
            }
        };

        var task = ref.put(file, metadata);

        task.on('state_changed',
            function(snapshot) {
                var pct = Math.round(
                    (snapshot.bytesTransferred / snapshot.totalBytes) * 100
                );
                if (typeof onProgress === 'function') onProgress(pct);
            },
            function(err) {
                console.error('[Delta Black] Upload error:', err.code, err.message);
                reject(err);
            },
            function() {
                task.snapshot.ref.getDownloadURL().then(resolve).catch(reject);
            }
        );
    },

    /* ── DUSTBIN ───────────────────────────── */

    getDustbinItems: function() {
        return DB.ref('dustbin').once('value').then(function(s) {
            return Object.values(s.val() || {});
        });
    },

    addDustbinItem: function(item) {
        return DB.ref('dustbin/' + item.id).set(item);
    },

    deleteDustbinItem: function(id) {
        return DB.ref('dustbin/' + id).remove();
    },

    clearDustbin: function() {
        return DB.ref('dustbin').remove();
    },

    /* ── INIT ──────────────────────────────── */

    initialize: function() {
        return new Promise(function(resolve) {
            var done    = false;
            var timeout = setTimeout(function() {
                if (!done) { done = true; resolve(); }
            }, 6000);

            DB.ref('.info/connected').once('value')
                .then(function() {
                    clearTimeout(timeout);
                    return DB_Ref.welcomeMessage().once('value');
                })
                .then(function(s) {
                    if (!s.val()) {
                        return DB_Ref.welcomeMessage().set(DB_CONFIG.DEFAULT_WELCOME);
                    }
                })
                .then(function() { if (!done) { done = true; resolve(); } })
                .catch(function(err) {
                    clearTimeout(timeout);
                    console.warn('[Delta Black] Firebase init warning:', err.message);
                    if (!done) { done = true; resolve(); }
                });
        });
    },

    /* ── LISTENERS CLEANUP ─────────────────── */

    _detachAllListeners: function() {
        var self = this;
        Object.keys(this._listeners).forEach(function(k) {
            var e = self._listeners[k];
            if (e && e.ref && e.fn) {
                try { e.ref.off('value', e.fn); } catch(x) {}
            }
        });
        this._listeners = {};
    }
};
