/* ============================================
   DELTA BLACK — ALERTS / BROADCAST
   Admin sends full-screen alerts to selected agents.
   Agents must acknowledge. Admin sees live ack status.
   ============================================ */
const DB_Alerts = {

    /* ── ADMIN: compose & send ─────────────── */
    openAdminPanel: function() {
        var overlay = document.getElementById('admin-alerts-overlay');
        if (overlay) overlay.classList.remove('hidden');
        this.loadSentAlerts();
    },

    closeAdminPanel: function() {
        var overlay = document.getElementById('admin-alerts-overlay');
        if (overlay) overlay.classList.add('hidden');
    },

    sendAlert: function() {
        var title   = DB_Utils.getValue('alert-title');
        var body    = DB_Utils.getValue('alert-body');
        var tSelect = document.getElementById('alert-target');
        var targets = tSelect
            ? Array.from(tSelect.selectedOptions).map(function(o){ return o.value; })
            : ['all'];
        if (!title || !body) { DB_Utils.toast('Alert title and message required', 'error'); return; }

        var alert = {
            id:           DB_Utils.generateId(),
            title:        title,
            body:         body,
            targetAgents: (targets.indexOf('all') !== -1 || !targets.length) ? ['all'] : targets,
            sentBy:       '001',
            sentAt:       new Date().toISOString(),
            acks:         {}
        };

        DB_Storage.sendAlert(alert).then(function() {
            DB_Utils.clearValue('alert-title');
            DB_Utils.clearValue('alert-body');
            DB_Utils.toast('Alert broadcast sent', 'success');
            DB_Storage.logActivity('001', 'ALERT_SENT', title).catch(function(){});
            DB_Alerts.loadSentAlerts();
        });
    },

    loadSentAlerts: function() {
        var list = document.getElementById('sent-alerts-list');
        if (!list) return;
        DB_Storage.getAlerts().then(function(alerts) {
            if (!alerts.length) { list.innerHTML = '<p class="empty-hint">No alerts sent yet.</p>'; return; }
            list.innerHTML = alerts.map(function(a) {
                var ackCount  = Object.keys(a.acks || {}).length;
                var targets   = a.targetAgents.indexOf('all') !== -1 ? 'ALL' : a.targetAgents.length + ' agents';
                return '<div class="alert-sent-item">' +
                    '<div class="alert-sent-header">' +
                        '<span class="alert-title-text">' + DB_Utils.escapeHtml(a.title) + '</span>' +
                        '<span class="alert-ack-count">✓ ' + ackCount + ' acknowledged</span>' +
                    '</div>' +
                    '<div class="alert-body-text">' + DB_Utils.escapeHtml(a.body) + '</div>' +
                    '<div class="alert-meta">' + DB_Utils.formatDate(a.sentAt) + ' → ' + targets + '</div>' +
                '</div>';
            }).join('');
        });
    },

    /* ── AGENT: listener & overlay ─────────── */
    startAgentListener: function(agentNumber) {
        DB_Storage.listenForAlerts(function(alerts) {
            var unacked = alerts.filter(function(a) {
                var forMe = a.targetAgents.indexOf('all') !== -1 ||
                            a.targetAgents.indexOf(agentNumber) !== -1;
                var acked = (a.acks || {})[agentNumber];
                return forMe && !acked;
            });

            /* Update badge */
            var badge = document.getElementById('user-alert-badge');
            if (badge) {
                badge.textContent = unacked.length;
                badge.style.display = unacked.length > 0 ? 'inline-block' : 'none';
            }

            /* Show full-screen overlay for newest unacked alert */
            if (unacked.length > 0) {
                var newest = unacked[0];
                var existing = document.getElementById('alert-overlay');
                if (existing && existing.dataset.alertId === newest.id) return;
                DB_Alerts.showAlertOverlay(newest, agentNumber);
            }
        });
    },

    showAlertOverlay: function(alert, agentNumber) {
        var existing = document.getElementById('alert-overlay');
        if (existing) existing.remove();

        var overlay = document.createElement('div');
        overlay.id = 'alert-overlay';
        overlay.dataset.alertId = alert.id;
        overlay.className = 'alert-fullscreen-overlay';
        overlay.innerHTML =
            '<div class="alert-fullscreen-box">' +
                '<div class="alert-fullscreen-header">⚠ INCOMING ALERT</div>' +
                '<h2 class="alert-fullscreen-title">' + DB_Utils.escapeHtml(alert.title) + '</h2>' +
                '<div class="alert-fullscreen-body">' + DB_Utils.escapeHtml(alert.body) + '</div>' +
                '<div class="alert-fullscreen-time">' + DB_Utils.formatDate(alert.sentAt) + '</div>' +
                '<button class="btn-acknowledge" onclick="DB_Alerts.acknowledge(\'' + alert.id + '\',\'' + agentNumber + '\')">' +
                    'ACKNOWLEDGE' +
                '</button>' +
            '</div>';
        document.body.appendChild(overlay);
    },

    acknowledge: function(alertId, agentNumber) {
        DB_Storage.acknowledgeAlert(alertId, agentNumber).then(function() {
            var overlay = document.getElementById('alert-overlay');
            if (overlay) overlay.remove();
            DB_Storage.logActivity(agentNumber, 'ALERT_ACKNOWLEDGED', alertId).catch(function(){});
        });
    },

    /* ── AGENT: alerts history panel ─────── */
    openAgentPanel: function() {
        var overlay = document.getElementById('agent-alerts-overlay');
        if (!overlay) return;
        overlay.classList.remove('hidden');
        var user = DB_Storage.getCurrentUser();
        if (!user) return;

        DB_Storage.getAlerts().then(function(alerts) {
            var mine = alerts.filter(function(a) {
                return a.targetAgents.indexOf('all') !== -1 ||
                       a.targetAgents.indexOf(user.agentNumber) !== -1;
            });
            var list = document.getElementById('agent-alerts-list');
            if (!list) return;
            if (!mine.length) { list.innerHTML = '<p class="empty-hint">No alerts received.</p>'; return; }
            list.innerHTML = mine.map(function(a) {
                var acked = (a.acks || {})[user.agentNumber];
                return '<div class="alert-history-item' + (acked ? '' : ' unacked') + '">' +
                    '<div class="alert-history-title">' + DB_Utils.escapeHtml(a.title) + '</div>' +
                    '<div class="alert-history-body">' + DB_Utils.escapeHtml(a.body) + '</div>' +
                    '<div class="alert-history-meta">' + DB_Utils.formatDate(a.sentAt) +
                        ' · ' + (acked ? '✓ Acknowledged' : '⚠ Pending acknowledgement') +
                    '</div>' +
                    (!acked ? '<button class="btn-acknowledge-sm" onclick="DB_Alerts.acknowledge(\'' + a.id + '\',\'' + user.agentNumber + '\')">' +
                        'ACKNOWLEDGE</button>' : '') +
                '</div>';
            }).join('');
        });
    }
};
