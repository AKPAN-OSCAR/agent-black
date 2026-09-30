/* ============================================
   DELTA BLACK — ACTIVITY LOG
   Per-agent timeline + full admin view.
   Searchable. Timestamped.
   ============================================ */
const DB_Activity = {

    openPanel: function() {
        var overlay = document.getElementById('activity-overlay');
        if (overlay) overlay.classList.remove('hidden');
        this.load();
    },

    closePanel: function() {
        var overlay = document.getElementById('activity-overlay');
        if (overlay) overlay.classList.add('hidden');
    },

    load: function(filterAgent) {
        var list = document.getElementById('activity-list');
        if (!list) return;
        list.innerHTML = '<div class="loading-state">Loading activity...</div>';

        var promise = filterAgent
            ? DB_Storage.getActivity(filterAgent)
            : DB_Storage.getAllActivity();

        promise.then(function(items) {
            if (!items.length) { list.innerHTML = '<p class="empty-hint">No activity recorded.</p>'; return; }

            var search = DB_Utils.getValue('activity-search').toLowerCase();
            if (search) {
                items = items.filter(function(i) {
                    return (i.agentNumber||'').toLowerCase().includes(search) ||
                           (i.event||'').toLowerCase().includes(search) ||
                           (i.detail||'').toLowerCase().includes(search);
                });
            }

            list.innerHTML = items.map(function(item) {
                var icon = {
                    LOGIN:               '🔐',
                    LOGOUT:              '🚪',
                    QUESTION_OPENED:     '👁',
                    ANSWER_SUBMITTED:    '✓',
                    BATCH_SUBMITTED:     '📋',
                    QUESTION_FLAGGED:    '⚑',
                    MESSAGES_READ:       '💬',
                    REPLY_SENT:          '↩',
                    MESSAGE_SENT:        '📨',
                    ALERT_SENT:          '⚠',
                    ALERT_ACKNOWLEDGED:  '✓',
                    QUESTION_SENT:       '📤'
                }[item.event] || '●';

                return '<div class="activity-item">' +
                    '<div class="activity-icon">' + icon + '</div>' +
                    '<div class="activity-body">' +
                        '<div class="activity-event">' + DB_Utils.escapeHtml(item.event.replace(/_/g,' ')) + '</div>' +
                        '<div class="activity-agent">Agent ' + DB_Utils.escapeHtml(item.agentNumber) + '</div>' +
                        (item.detail ? '<div class="activity-detail">' + DB_Utils.escapeHtml(item.detail) + '</div>' : '') +
                    '</div>' +
                    '<div class="activity-time">' + DB_Utils.formatDate(item.timestamp) + '</div>' +
                '</div>';
            }).join('');
        });
    },

    search: function() {
        var filter = document.getElementById('activity-agent-filter');
        this.load(filter && filter.value !== 'all' ? filter.value : null);
    }
};
