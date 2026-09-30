/* ============================================
   DELTA BLACK — QUESTIONS MODULE
   Types: text, poll, multiple-choice, batch,
          mixed-media, image, video, audio
   Features: deadline, target agents, delivery mode
   ============================================ */
const DB_Questions = {

    uploadedMediaFile: null,

    toggleInput: function() {
        var type = document.getElementById('question-type-select');
        if (!type) return;
        var v = type.value;

        document.getElementById('text-input-group')    && DB_Utils[ v==='text'||v==='batch'||v==='mixed' ?'removeClass':'addClass' ]('text-input-group','hidden');
        document.getElementById('poll-input-group')    && DB_Utils[ v==='poll'?'removeClass':'addClass' ]('poll-input-group','hidden');
        document.getElementById('mc-input-group')      && DB_Utils[ v==='mc'  ?'removeClass':'addClass' ]('mc-input-group','hidden');
        document.getElementById('batch-input-group')   && DB_Utils[ v==='batch'?'removeClass':'addClass']('batch-input-group','hidden');
        document.getElementById('file-input-group')    && DB_Utils[ v==='image'||v==='video'||v==='audio'||v==='mixed'?'removeClass':'addClass']('file-input-group','hidden');
    },

    addPollOption: function() {
        var container = document.getElementById('poll-options-container');
        if (!container) return;
        var count = container.querySelectorAll('.poll-option-input').length;
        if (count >= 6) { DB_Utils.toast('Maximum 6 options', 'error'); return; }
        var div = document.createElement('div');
        div.className = 'poll-option-row';
        div.innerHTML = '<input type="text" class="poll-option-input" placeholder="Option ' + (count+1) + '">' +
            '<button onclick="this.parentElement.remove()" class="btn-remove-option">✕</button>';
        container.appendChild(div);
    },

    addMcOption: function() {
        var container = document.getElementById('mc-options-container');
        if (!container) return;
        var count = container.querySelectorAll('.mc-option-row').length;
        if (count >= 6) { DB_Utils.toast('Maximum 6 options', 'error'); return; }
        var div = document.createElement('div');
        div.className = 'mc-option-row';
        div.innerHTML = '<input type="radio" name="mc-correct" value="' + count + '"> ' +
            '<input type="text" class="mc-option-input" placeholder="Option ' + (count+1) + '"> ' +
            '<button onclick="this.parentElement.remove()" class="btn-remove-option">✕</button>';
        container.appendChild(div);
    },

    handleMediaUpload: function() {
        var fi   = document.getElementById('media-upload');
        var prev = document.getElementById('media-preview');
        var file = fi ? fi.files[0] : null;
        if (!file || !prev) return;
        this.uploadedMediaFile = file;

        var sizeMB = (file.size / (1024 * 1024)).toFixed(2);
        var type   = file.type || 'application/octet-stream';

        /* Show preview for images only (small files) — use blob URL, no memory spike */
        if (type.startsWith('image/')) {
            var blobUrl = URL.createObjectURL(file);
            prev.innerHTML = '<img src="' + blobUrl + '" style="max-width:100%;max-height:180px;border:1px solid var(--border);">';
        } else if (type.startsWith('video/')) {
            var vUrl = URL.createObjectURL(file);
            prev.innerHTML = '<video controls src="' + vUrl + '" style="max-width:100%;max-height:180px;"></video>';
        } else if (type.startsWith('audio/')) {
            var aUrl = URL.createObjectURL(file);
            prev.innerHTML = '<audio controls src="' + aUrl + '" style="width:100%;"></audio>';
        } else {
            /* Any other file type — show file info card */
            prev.innerHTML =
                '<div style="padding:0.8rem;background:var(--secondary);border:1px solid var(--border);' +
                'font-family:"Share Tech Mono",monospace;font-size:0.8rem;color:var(--text-dim);">' +
                '📎 ' + DB_Utils.escapeHtml(file.name) + '<br>' +
                '<span style="color:var(--text-dark);">' + sizeMB + ' MB · ' + type + '</span>' +
                '</div>';
        }

        /* Show file size info */
        var info = document.getElementById('upload-file-info');
        if (info) info.textContent = file.name + ' (' + sizeMB + ' MB)';
    },

    send: function() {
        var tSelect = document.getElementById('target-agent');
        var targets = tSelect
            ? Array.from(tSelect.selectedOptions).map(function(o){ return o.value; })
            : ['all'];
        if (!targets.length) targets = ['all'];

        var type         = (document.getElementById('question-type-select') || {}).value || 'text';
        var deliveryMode = (document.getElementById('delivery-mode') || {}).value || 'sequential';
        var deadlineVal  = DB_Utils.getValue('question-deadline');
        var deadline     = deadlineVal ? new Date(Date.now() + parseInt(deadlineVal) * 60000).toISOString() : null;
        var self         = this;

        if (type === 'poll') {
            var pollQ    = DB_Utils.getValue('poll-question-text');
            var pollOpts = Array.from(document.querySelectorAll('.poll-option-input'))
                              .map(function(i){ return i.value.trim(); })
                              .filter(Boolean);
            if (!pollQ)           { DB_Utils.toast('Enter poll question', 'error'); return; }
            if (pollOpts.length < 2) { DB_Utils.toast('Add at least 2 options', 'error'); return; }
            this._save({ type:'poll', content: pollQ, options: pollOpts, votes:{} }, targets, deliveryMode, deadline);

        } else if (type === 'mc') {
            var mcQ    = DB_Utils.getValue('mc-question-text');
            var mcOpts = Array.from(document.querySelectorAll('.mc-option-input'))
                            .map(function(i){ return i.value.trim(); })
                            .filter(Boolean);
            var checked = document.querySelector('input[name="mc-correct"]:checked');
            if (!mcQ)            { DB_Utils.toast('Enter question text', 'error'); return; }
            if (mcOpts.length < 2){ DB_Utils.toast('Add at least 2 options', 'error'); return; }
            this._save({ type:'mc', content: mcQ, options: mcOpts,
                correctIndex: checked ? parseInt(checked.value) : 0 }, targets, deliveryMode, deadline);

        } else if (type === 'batch') {
            var batchText = DB_Utils.getValue('batch-questions-text');
            if (!batchText) { DB_Utils.toast('Enter questions (one per line)', 'error'); return; }
            var lines = batchText.split('\n').map(function(l){ return l.trim(); }).filter(Boolean);
            if (!lines.length) { DB_Utils.toast('No questions found', 'error'); return; }
            this._save({ type:'batch', content: batchText, questions: lines }, targets, deliveryMode, deadline);

        } else if (type === 'mixed') {
            var mixedText = DB_Utils.getValue('admin-question-text');
            if (!this.uploadedMediaFile && !mixedText) {
                DB_Utils.toast('Add text or media for mixed package', 'error'); return;
            }
            if (this.uploadedMediaFile) {
                var path = 'questions/' + DB_Utils.generateId() + '_' + this.uploadedMediaFile.name;
                DB_Questions._doUpload(self.uploadedMediaFile, path, function(url) {
                    self._save({ type:'mixed', content: mixedText, mediaUrl: url,
                        mediaType: self.uploadedMediaFile.type.split('/')[0],
                        fileName:  self.uploadedMediaFile.name }, targets, deliveryMode, deadline);
                });
            } else {
                this._save({ type:'mixed', content: mixedText }, targets, deliveryMode, deadline);
            }

        } else if (type === 'text') {
            var txt = DB_Utils.getValue('admin-question-text');
            if (!txt) { DB_Utils.toast('Enter question text', 'error'); return; }
            this._save({ type:'text', content: txt }, targets, deliveryMode, deadline);

        } else {
            if (!this.uploadedMediaFile) { DB_Utils.toast('Upload a media file', 'error'); return; }
            var mpath = 'questions/' + DB_Utils.generateId() + '_' + self.uploadedMediaFile.name;
            DB_Questions._doUpload(self.uploadedMediaFile, mpath, function(url) {
                self._save({ type: type, content: url,
                    fileName: self.uploadedMediaFile.name }, targets, deliveryMode, deadline);
            });
        }
    },

    _doUpload: function(file, path, onSuccess) {
        var btn = document.getElementById('btn-send-question');
        var bar = document.getElementById('upload-progress-bar');
        var wrap= document.getElementById('upload-progress-wrap');
        var lbl = document.getElementById('upload-progress-label');

        if (btn)  { btn.disabled = true; btn.textContent = 'UPLOADING...'; }
        if (wrap) wrap.classList.remove('hidden');

        DB_Storage.uploadMedia(file, path, function(pct) {
            if (bar) bar.style.width = pct + '%';
            if (lbl) lbl.textContent = pct + '%';
        }).then(function(url) {
            if (btn)  { btn.disabled = false; btn.textContent = 'TRANSMIT DIRECTIVE'; }
            if (wrap) wrap.classList.add('hidden');
            if (bar)  bar.style.width = '0%';
            onSuccess(url);
        }).catch(function(err) {
            if (btn)  { btn.disabled = false; btn.textContent = 'TRANSMIT DIRECTIVE'; }
            if (wrap) wrap.classList.add('hidden');
            console.error('[Delta Black] Upload failed:', err);
            var msg = err.code === 'storage/unauthorized'
                ? 'Upload blocked — set Firebase Storage rules to allow writes'
                : 'Upload failed: ' + (err.message || err.code);
            DB_Utils.toast(msg, 'error');
        });
    },

    _save: function(data, targets, deliveryMode, deadline) {
        var targetAgents = (targets.indexOf('all') !== -1 || !targets.length) ? ['all'] : targets;
        var q = Object.assign({
            id:           DB_Utils.generateId(),
            targetAgents: targetAgents,
            deliveryMode: deliveryMode,
            deadline:     deadline,
            sentBy:       'Delta Black',
            sentAt:       new Date().toISOString(),
            status:       'active',
            flaggedBy:    []
        }, data);

        DB_Storage.addQuestion(q).then(function() {
            /* clear all inputs */
            DB_Utils.clearValue('admin-question-text');
            DB_Utils.clearValue('poll-question-text');
            DB_Utils.clearValue('mc-question-text');
            DB_Utils.clearValue('batch-questions-text');
            DB_Utils.clearValue('question-deadline');
            var fi = document.getElementById('media-upload');
            if (fi) fi.value = '';
            var prev = document.getElementById('media-preview');
            if (prev) prev.innerHTML = '';
            DB_Questions.uploadedMediaFile = null;
            var pc = document.getElementById('poll-options-container');
            if (pc) pc.innerHTML = '';
            var mc = document.getElementById('mc-options-container');
            if (mc) mc.innerHTML = '';
            DB_Questions.loadSent();
            DB_Utils.toast('Directive transmitted to ' +
                (targetAgents.indexOf('all') !== -1 ? 'ALL AGENTS' : targetAgents.join(', ')), 'success');
            /* Log activity */
            DB_Storage.logActivity('001', 'QUESTION_SENT',
                'Type: ' + q.type + ' → ' + (targetAgents.indexOf('all') !== -1 ? 'All' : targetAgents.join(','))
            ).catch(function(){});
        }).catch(function(e){ DB_Utils.toast('Send failed: ' + e.message, 'error'); });
    },

    loadSent: function() {
        var list = document.getElementById('sent-questions-list');
        if (!list) return;
        list.innerHTML = '<div class="loading-state">Loading...</div>';

        Promise.all([DB_Storage.getQuestions(), DB_Storage.getResponses()]).then(function(res) {
            var questions = res[0].slice().reverse();
            var responses = res[1];
            if (!questions.length) {
                list.innerHTML = '<p class="empty-hint">No directives sent yet.</p>';
                return;
            }
            list.innerHTML = questions.map(function(q) {
                var answered = responses.filter(function(r){ return r.questionId === q.id; }).length;
                var targets  = q.targetAgents.indexOf('all') !== -1 ? 'ALL AGENTS' : q.targetAgents.join(', ');
                var typeLabel= q.type.toUpperCase();
                var flags    = (q.flaggedBy || []).length;
                var deadlineStr = q.deadline
                    ? '<span class="q-deadline">⏱ ' + DB_Utils.formatDate(q.deadline) + '</span>' : '';
                var flagStr  = flags > 0
                    ? '<span class="q-flag-count">⚑ ' + flags + ' FLAG' + (flags>1?'S':'') + '</span>' : '';
                var preview  = q.type === 'text' ? DB_Utils.escapeHtml((q.content||'').substring(0,100))
                             : q.type === 'poll' ? '📊 ' + DB_Utils.escapeHtml(q.content||'')
                             : q.type === 'mc'   ? '☑ '  + DB_Utils.escapeHtml(q.content||'')
                             : q.type === 'batch'? '📋 Batch (' + (q.questions||[]).length + ' questions)'
                             : q.type === 'mixed'? '📦 Mixed Media Package'
                             : '[' + typeLabel + ' ATTACHMENT]';

                return '<div class="question-item admin-item">' +
                    '<div class="question-header">' +
                        '<span class="type-badge type-' + q.type + '">' + typeLabel + '</span>' +
                        '<span class="q-target">→ ' + targets + '</span>' +
                        '<span class="q-stats">✓ ' + answered + ' answered</span>' +
                    '</div>' +
                    '<div class="question-body">' + preview + '</div>' +
                    '<div class="question-footer">' +
                        '<span class="q-date">' + DB_Utils.formatDate(q.sentAt) + '</span>' +
                        deadlineStr + flagStr +
                    '</div>' +
                '</div>';
            }).join('');
        });
    }
};
