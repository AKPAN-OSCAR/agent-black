/* ============================================
   DELTA BLACK — USER MANAGEMENT
   ============================================ */
const DB_Users = {

    showAddForm: function() {
        var f = document.getElementById('add-user-form');
        if (f) f.classList.remove('hidden');
    },

    hideAddForm: function() {
        var f = document.getElementById('add-user-form');
        if (f) f.classList.add('hidden');
        DB_Utils.clearValue('new-agent-number');
        DB_Utils.clearValue('new-barcode');
        DB_Utils.clearValue('new-nickname');
    },

    addNew: function() {
        var ag = DB_Utils.getValue('new-agent-number');
        var bc = DB_Utils.getValue('new-barcode');
        var nn = DB_Utils.getValue('new-nickname');
        if (!ag || !bc || !nn) { DB_Utils.toast('All fields required', 'error'); return; }

        var self = this;
        DB_Storage.getUsers().then(function(users) {
            if (users.find(function(u){ return u.agentNumber === ag; })) {
                DB_Utils.toast('Agent number already exists', 'error'); return;
            }
            return DB_Storage.addUser({
                id: DB_Utils.generateId(),
                agentNumber: ag, barCode: bc, nickname: nn,
                role: 'user', profile: '',
                grades: [], levels: [], badges: [],
                createdAt: new Date().toISOString()
            }).then(function() {
                self.hideAddForm();
                self.loadTable();
                DB_Content.updateSelects();
                document.dispatchEvent(new CustomEvent('usersUpdated'));
                DB_Utils.toast('Agent ' + ag + ' registered', 'success');
                DB_Storage.logActivity('001','AGENT_REGISTERED','Agent '+ag+' — '+nn).catch(function(){});
            });
        });
    },

    loadTable: function() {
        DB_Storage.getUsers().then(function(users) {
            var agents = users.filter(function(u){ return u.role !== 'admin'; });
            var tbody  = document.getElementById('users-table-body');
            if (!tbody) return;

            if (!agents.length) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-dark);padding:2rem;">No agents registered.</td></tr>';
                return;
            }

            Promise.all([DB_Storage.getQuestions(), DB_Storage.getResponses()])
                .then(function(res) {
                    var questions = res[0];
                    var responses = res[1];

                    tbody.innerHTML = agents.map(function(u) {
                        var myQs  = questions.filter(function(q){
                            return q.targetAgents.indexOf(u.agentNumber) !== -1 ||
                                   q.targetAgents.indexOf('all') !== -1;
                        });
                        var ans   = responses.filter(function(r){ return r.agentNumber === u.agentNumber; }).length;
                        var total = myQs.length;

                        return '<tr>' +
                            '<td>' + DB_Utils.escapeHtml(u.agentNumber) + '</td>' +
                            '<td>' + DB_Utils.escapeHtml(u.nickname) + '</td>' +
                            '<td style="letter-spacing:0.1em;">••••••••</td>' +
                            '<td class="' + (u.lastLogin ? 'status-online' : 'status-offline') + '">' +
                                (u.lastLogin ? '● ACTIVE' : '○ INACTIVE') + '</td>' +
                            '<td>' + ans + '/' + total + '</td>' +
                            '<td>' +
                                '<button class="btn-cancel del-btn" data-agent="' + u.agentNumber + '" style="padding:0.25rem 0.6rem;font-size:0.7rem;">DELETE</button>' +
                            '</td>' +
                        '</tr>';
                    }).join('');

                    tbody.querySelectorAll('.del-btn').forEach(function(btn) {
                        btn.addEventListener('click', function() {
                            DB_Users.deleteHandler(btn.dataset.agent);
                        });
                    });
                });
        });
    },

    deleteHandler: function(ag) {
        if (!confirm('Delete Agent ' + ag + '? All their data will be removed. This cannot be undone.')) return;
        DB_Storage.deleteUserByAgentNumber(ag).then(function() {
            DB_Users.loadTable();
            DB_Content.updateSelects();
            document.dispatchEvent(new CustomEvent('usersUpdated'));
            DB_Utils.toast('Agent ' + ag + ' deleted', 'success');
        });
    }
};
