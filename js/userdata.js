/* ============================================
   DELTA BLACK — USER DATA PANEL (Admin Only)
   Per-agent data: archive, delete, save, allow.
   Search + scroll. Personal info from DMs saved here.
   ============================================ */
const DB_UserData = {

    _currentAgent: null,

    openPanel: function() {
        var overlay = document.getElementById('userdata-overlay');
        if (overlay) overlay.classList.remove('hidden');
        this.loadAgentSelector();
    },

    closePanel: function() {
        var overlay = document.getElementById('userdata-overlay');
        if (overlay) overlay.classList.add('hidden');
    },

    loadAgentSelector: function() {
        DB_Storage.getUsers().then(function(users) {
            var sel = document.getElementById('userdata-agent-select');
            if (!sel) return;
            var agents = users.filter(function(u){ return u.role !== 'admin'; });
            sel.innerHTML = '<option value="">— Select Agent —</option>' +
                agents.map(function(u) {
                    return '<option value="' + u.agentNumber + '">Agent ' +
                        DB_Utils.escapeHtml(u.agentNumber) + ' — ' + DB_Utils.escapeHtml(u.nickname) + '</option>';
                }).join('');
        });
    },

    loadAgent: function(agentNumber) {
        if (!agentNumber) return;
        this._currentAgent = agentNumber;
        var list = document.getElementById('userdata-list');
        if (!list) return;
        list.innerHTML = '<div class="loading-state">Loading...</div>';

        Promise.all([
            DB_Storage.getUserByAgentNumber(agentNumber),
            DB_Storage.getUserData(agentNumber),
            DB_Storage.getResponsesByAgent(agentNumber),
            DB_Storage.getQuestionsForAgent(agentNumber)
        ]).then(function(res) {
            var user      = res[0] || {};
            var dataItems = res[1];
            var responses = res[2];
            var questions = res[3];
            var qMap = {};
            questions.forEach(function(q){ qMap[q.id] = q; });

            var search = DB_Utils.getValue('userdata-search').toLowerCase();

            var html = '';

            /* — Profile card — */
            html += '<div class="ud-section-title">PROFILE</div>';
            html += '<div class="ud-card">' +
                '<span>' + DB_Utils.escapeHtml(user.profile || 'No profile set.') + '</span>' +
                '</div>';

            /* — Grades — */
            html += '<div class="ud-section-title">GRADES</div>';
            (user.grades || []).forEach(function(g) {
                html += DB_UserData._itemCard({
                    label: 'Grade: ' + g.value,
                    detail: g.notes || '',
                    date: g.date,
                    type: 'grade',
                    id: g.date // use date as key for grades
                }, agentNumber, 'grade');
            });
            if (!(user.grades||[]).length) html += '<p class="empty-hint">No grades.</p>';

            /* — Levels — */
            html += '<div class="ud-section-title">LEVELS</div>';
            (user.levels || []).forEach(function(l) {
                html += DB_UserData._itemCard({ label:'Level: '+l.value, date:l.date }, agentNumber, 'level');
            });
            if (!(user.levels||[]).length) html += '<p class="empty-hint">No levels.</p>';

            /* — Badges — */
            html += '<div class="ud-section-title">BADGES</div>';
            (user.badges || []).forEach(function(b) {
                html += DB_UserData._itemCard({ label: (b.icon||'🏅') + ' ' + b.name, date:b.date }, agentNumber, 'badge');
            });
            if (!(user.badges||[]).length) html += '<p class="empty-hint">No badges.</p>';

            /* — Responses — */
            html += '<div class="ud-section-title">QUESTION RESPONSES</div>';
            var filteredResponses = responses.filter(function(r) {
                if (!search) return true;
                var q = qMap[r.questionId];
                return (r.answer||'').toLowerCase().includes(search) ||
                       ((q && q.content)||'').toLowerCase().includes(search);
            });
            filteredResponses.forEach(function(r) {
                var q = qMap[r.questionId];
                html += DB_UserData._itemCard({
                    label: DB_Utils.escapeHtml((q && q.content || 'Unknown question').substring(0,80)),
                    detail: r.answer,
                    date: r.submittedAt,
                    id: r.id,
                    status: r.status
                }, agentNumber, 'response');
            });
            if (!filteredResponses.length) html += '<p class="empty-hint">No responses' + (search?' matching "'+search+'"':'') + '.</p>';

            /* — Saved UserData items (from DMs etc) — */
            if (dataItems.length) {
                html += '<div class="ud-section-title">SAVED DATA</div>';
                var filteredItems = dataItems.filter(function(item) {
                    if (!search) return true;
                    return (item.content||'').toLowerCase().includes(search) ||
                           (item.type||'').toLowerCase().includes(search);
                });
                filteredItems.forEach(function(item) {
                    html += DB_UserData._savedItemCard(item, agentNumber);
                });
                if (!filteredItems.length) html += '<p class="empty-hint">No saved items match.</p>';
            }

            list.innerHTML = html || '<p class="empty-hint">No data found.</p>';
        });
    },

    _itemCard: function(item, agentNumber, type) {
        return '<div class="ud-item">' +
            '<div class="ud-item-label">' + item.label + '</div>' +
            (item.detail ? '<div class="ud-item-detail">' + DB_Utils.escapeHtml(String(item.detail).substring(0,120)) + '</div>' : '') +
            '<div class="ud-item-meta">' + DB_Utils.formatDate(item.date) + '</div>' +
        '</div>';
    },

    _savedItemCard: function(item, agentNumber) {
        var statusBadge = {
            'saved':    '<span class="ud-badge ud-saved">SAVED</span>',
            'archived': '<span class="ud-badge ud-archived">ARCHIVED</span>',
            'allowed':  '<span class="ud-badge ud-allowed">ALLOWED</span>'
        }[item.status] || '';

        return '<div class="ud-item ud-saved-item" id="uditem-' + item.id + '">' +
            '<div class="ud-item-header">' +
                '<span class="ud-item-type">' + DB_Utils.escapeHtml(item.type||'data') + '</span>' +
                statusBadge +
            '</div>' +
            '<div class="ud-item-label">' + DB_Utils.escapeHtml(String(item.content||'').substring(0,200)) + '</div>' +
            '<div class="ud-item-meta">' + DB_Utils.formatDate(item.savedAt) + ' · ' + DB_Utils.escapeHtml(item.source||'') + '</div>' +
            '<div class="ud-item-actions">' +
                '<button class="ud-btn" onclick="DB_UserData.setStatus(\'' + agentNumber + '\',\'' + item.id + '\',\'saved\')">SAVE</button>' +
                '<button class="ud-btn" onclick="DB_UserData.setStatus(\'' + agentNumber + '\',\'' + item.id + '\',\'archived\')">ARCHIVE</button>' +
                '<button class="ud-btn ud-btn-allow" onclick="DB_UserData.toggleAllow(\'' + agentNumber + '\',\'' + item.id + '\',' + item.allowedView + ')">' +
                    (item.allowedView ? 'DISALLOW' : 'ALLOW') +
                '</button>' +
                '<button class="ud-btn ud-btn-delete" onclick="DB_UserData.deleteItem(\'' + agentNumber + '\',\'' + item.id + '\')">DELETE</button>' +
            '</div>' +
        '</div>';
    },

    setStatus: function(agentNumber, itemId, status) {
        DB_Storage.updateUserDataItem(agentNumber, itemId, { status: status }).then(function() {
            DB_Utils.toast('Status updated: ' + status, 'success');
            DB_UserData.loadAgent(agentNumber);
        });
    },

    toggleAllow: function(agentNumber, itemId, currentlyAllowed) {
        DB_Storage.updateUserDataItem(agentNumber, itemId, { allowedView: !currentlyAllowed }).then(function() {
            DB_Utils.toast('Visibility ' + (!currentlyAllowed ? 'allowed' : 'restricted'), 'success');
            DB_UserData.loadAgent(agentNumber);
        });
    },

    deleteItem: function(agentNumber, itemId) {
        if (!confirm('Delete this data item permanently?')) return;
        DB_Storage.deleteUserDataItem(agentNumber, itemId).then(function() {
            DB_Utils.toast('Item deleted', 'success');
            DB_UserData.loadAgent(agentNumber);
        });
    },

    search: function() {
        if (this._currentAgent) this.loadAgent(this._currentAgent);
    }
};
