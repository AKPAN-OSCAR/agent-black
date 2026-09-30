/* ============================================
   DELTA BLACK — RESPONSES MODULE
   ============================================ */
const DB_Responses = {

    load: function() {
        var filterEl  = document.getElementById('response-filter');
        var filter    = filterEl ? filterEl.value : 'all';
        var list      = document.getElementById('responses-list');
        if (!list) return;
        list.innerHTML = '<div class="loading-state">Loading responses...</div>';

        Promise.all([
            DB_Storage.getResponses(),
            DB_Storage.getQuestions(),
            DB_Storage.getUsers()
        ]).then(function(res) {
            var responses = res[0];
            var questions = res[1];
            var users     = res[2];

            if (filter !== 'all') {
                responses = responses.filter(function(r){ return r.agentNumber === filter; });
            }

            if (!responses.length) {
                list.innerHTML = '<p class="empty-hint">No responses recorded yet.</p>';
                return;
            }

            responses.sort(function(a,b){ return new Date(b.submittedAt) - new Date(a.submittedAt); });

            var qMap = {}, uMap = {};
            questions.forEach(function(q){ qMap[q.id] = q; });
            users.forEach(function(u){ uMap[u.agentNumber] = u; });

            list.innerHTML = responses.map(function(r) {
                var q    = qMap[r.questionId];
                var u    = uMap[r.agentNumber];
                var name = u ? 'Agent ' + u.agentNumber + ' — ' + u.nickname : 'Agent ' + r.agentNumber;
                var qPreview = q
                    ? (q.type === 'text' || q.type === 'poll' || q.type === 'mc'
                        ? DB_Utils.escapeHtml((q.content||'').substring(0, 100))
                        : '[' + q.type.toUpperCase() + ' DIRECTIVE]')
                    : '[Directive no longer available]';

                var gradeTag = r.isCorrect !== undefined
                    ? '<span style="color:' + (r.isCorrect ? 'var(--accent)' : 'var(--danger)') + ';font-family:\'Share Tech Mono\',monospace;font-size:0.72rem;">' +
                      (r.isCorrect ? '✓ CORRECT' : '✗ INCORRECT') + '</span>'
                    : '';

                return '<div class="response-item" style="background:var(--card-bg);border:1px solid var(--border);border-left:3px solid var(--accent);padding:1rem;margin-bottom:0.8rem;">' +
                    '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.6rem;">' +
                        '<span style="color:var(--info);font-family:\'Share Tech Mono\',monospace;font-size:0.8rem;">' + DB_Utils.escapeHtml(name) + '</span>' +
                        '<span style="color:var(--text-dark);font-family:\'Share Tech Mono\',monospace;font-size:0.72rem;">' + DB_Utils.formatDate(r.submittedAt) + '</span>' +
                    '</div>' +
                    '<div style="padding:0.4rem 0.6rem;background:var(--secondary);border-left:2px solid var(--border);margin-bottom:0.6rem;font-size:0.85rem;color:var(--text-dim);">' +
                        qPreview +
                    '</div>' +
                    '<div style="font-size:0.92rem;color:var(--text);line-height:1.5;">' +
                        DB_Utils.escapeHtml(r.answer) +
                    '</div>' +
                    '<div style="margin-top:0.6rem;display:flex;gap:0.8rem;align-items:center;">' +
                        '<span style="color:var(--accent);font-family:\'Share Tech Mono\',monospace;font-size:0.72rem;">● SUBMITTED</span>' +
                        gradeTag +
                    '</div>' +
                '</div>';
            }).join('');
        }).catch(function(e) {
            list.innerHTML = '<p class="empty-hint">Error loading responses.</p>';
            console.error('[Delta Black] Responses load error:', e);
        });
    },

    init: function() {
        var self = this;
        var filterEl = document.getElementById('response-filter');
        if (filterEl) filterEl.addEventListener('change', function(){ self.load(); });

        document.addEventListener('usersUpdated', function(){
            var tab = document.getElementById('tab-responses');
            if (tab && tab.classList.contains('active')) self.load();
        });

        DB_Storage.listenForResponses(function() {
            var tab = document.getElementById('tab-responses');
            if (tab && tab.classList.contains('active')) self.load();
        });
    }
};
