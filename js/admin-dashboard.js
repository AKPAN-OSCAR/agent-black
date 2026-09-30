/* ============================================
   DELTA BLACK — ADMIN DASHBOARD
   ============================================ */
const DB_Admin = {

    showDashboard: function(user) {
        DB_Storage.setCurrentUser(user);
        DB_Utils.showScreen('admin-dashboard');
        DB_Utils.setText('admin-display-name', user.nickname || 'Delta Black');
        this.loadSidebar();
        DB_Questions.loadSent();
        DB_Users.loadTable();
        DB_Content.updateSelects();
        DB_Responses.load();
        this.startSidebarListener();
    },

    loadSidebar: function() {
        var list = document.getElementById('agents-list');
        if (!list) return;
        Promise.all([DB_Storage.getUsers(), DB_Storage.getQuestions(), DB_Storage.getResponses()])
            .then(function(res) {
                var users     = res[0].filter(function(u){ return u.role !== 'admin'; });
                var questions = res[1];
                var responses = res[2];
                if (!users.length) {
                    list.innerHTML = '<div class="sidebar-empty">No agents registered.</div>'; return;
                }
                list.innerHTML = users.map(function(u) {
                    var myQs  = questions.filter(function(q){
                        return q.targetAgents.indexOf(u.agentNumber) !== -1 ||
                               q.targetAgents.indexOf('all') !== -1;
                    });
                    var ans   = responses.filter(function(r){ return r.agentNumber === u.agentNumber; }).length;
                    var total = myQs.length;
                    var pct   = total ? Math.round((ans/total)*100) : 0;
                    var color = !total ? 'var(--text-dark)'
                              : pct === 100 ? 'var(--accent)'
                              : pct > 0 ? 'var(--warning)' : 'var(--danger)';

                    return '<div class="agent-item">' +
                        '<div class="agent-num">AGENT ' + DB_Utils.escapeHtml(u.agentNumber) + '</div>' +
                        '<div class="agent-name">' + DB_Utils.escapeHtml(u.nickname) + '</div>' +
                        '<div class="agent-status" style="color:' + color + '">' +
                            (u.lastLogin ? '● ACTIVE' : '○ INACTIVE') +
                            ' &nbsp; ' + ans + '/' + total + ' answered' +
                        '</div>' +
                        '<div class="agent-progress-bar"><div class="agent-progress-fill" style="width:' + pct + '%;background:' + color + '"></div></div>' +
                    '</div>';
                }).join('');
            });
    },

    startSidebarListener: function() {
        var self = this;
        DB_Storage.listenForUsers(function(){ self.loadSidebar(); });
        DB_Storage.listenForResponses(function(){ self.loadSidebar(); });
    },

    switchTab: function(tabName) {
        document.querySelectorAll('.tab-btn').forEach(function(b){ b.classList.remove('active'); });
        document.querySelectorAll('.tab-content').forEach(function(p){ p.classList.remove('active'); });
        var btn   = document.querySelector('[data-tab="' + tabName + '"]');
        var panel = document.getElementById('tab-' + tabName);
        if (btn)   btn.classList.add('active');
        if (panel) panel.classList.add('active');
        if      (tabName === 'questions') DB_Questions.loadSent();
        else if (tabName === 'users')     DB_Users.loadTable();
        else if (tabName === 'content')   DB_Content.updateSelects();
        else if (tabName === 'responses') DB_Responses.load();
        else if (tabName === 'activity')  DB_Activity.load();
        else if (tabName === 'dustbin')   DB_Dustbin.load();
    },

    toggleMenu: function() {
        var menu = document.getElementById('admin-menu');
        if (menu) menu.classList.toggle('hidden');
    },

    bindEvents: function() {
        var self = this;

        var btnMenu = document.getElementById('btn-admin-menu');
        if (btnMenu) btnMenu.addEventListener('click', function(e){ e.stopPropagation(); self.toggleMenu(); });

        var btnLogout = document.getElementById('btn-admin-logout');
        if (btnLogout) btnLogout.addEventListener('click', function(){ DB_Auth.logout(); });

        document.querySelectorAll('.tab-btn').forEach(function(btn) {
            btn.addEventListener('click', function(){ self.switchTab(btn.dataset.tab); });
        });

        var qType = document.getElementById('question-type-select');
        if (qType) qType.addEventListener('change', function(){ DB_Questions.toggleInput(); });

        var mediaUp = document.getElementById('media-upload');
        if (mediaUp) mediaUp.addEventListener('change', function(){ DB_Questions.handleMediaUpload(); });

        var btnSend = document.getElementById('btn-send-question');
        if (btnSend) btnSend.addEventListener('click', function(){ DB_Questions.send(); });

        var btnAddPoll = document.getElementById('btn-add-poll-option');
        if (btnAddPoll) btnAddPoll.addEventListener('click', function(){ DB_Questions.addPollOption(); });

        var btnAddMc = document.getElementById('btn-add-mc-option');
        if (btnAddMc) btnAddMc.addEventListener('click', function(){ DB_Questions.addMcOption(); });

        var btnShowAdd = document.getElementById('btn-show-add-user');
        if (btnShowAdd) btnShowAdd.addEventListener('click', function(){ DB_Users.showAddForm(); });

        var btnCancelAdd = document.getElementById('btn-cancel-add-user');
        if (btnCancelAdd) btnCancelAdd.addEventListener('click', function(){ DB_Users.hideAddForm(); });

        var btnAddUser = document.getElementById('btn-add-user');
        if (btnAddUser) btnAddUser.addEventListener('click', function(){ DB_Users.addNew(); });

        var btnProfile = document.getElementById('btn-update-profile');
        if (btnProfile) btnProfile.addEventListener('click', function(){ DB_Content.updateProfile(); });

        var btnGrade = document.getElementById('btn-assign-grade');
        if (btnGrade) btnGrade.addEventListener('click', function(){ DB_Content.assignGrade(); });

        var btnLevel = document.getElementById('btn-set-level');
        if (btnLevel) btnLevel.addEventListener('click', function(){ DB_Content.setLevel(); });

        var btnBadge = document.getElementById('btn-award-badge');
        if (btnBadge) btnBadge.addEventListener('click', function(){ DB_Content.awardBadge(); });

        /* Overlays close buttons */
        document.querySelectorAll('.overlay-close').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var target = btn.dataset.close;
                var el = document.getElementById(target);
                if (el) el.classList.add('hidden');
            });
        });

        /* Activity search */
        var actSearch = document.getElementById('activity-search');
        if (actSearch) actSearch.addEventListener('input', function(){ DB_Activity.search(); });

        var actFilter = document.getElementById('activity-agent-filter');
        if (actFilter) actFilter.addEventListener('change', function(){ DB_Activity.search(); });

        /* UserData agent select */
        var udSelect = document.getElementById('userdata-agent-select');
        if (udSelect) udSelect.addEventListener('change', function(){ DB_UserData.loadAgent(udSelect.value); });

        var udSearch = document.getElementById('userdata-search');
        if (udSearch) udSearch.addEventListener('input', function(){ DB_UserData.search(); });

        /* DM admin — send button (also wired inline but binding here as fallback) */
        var btnSendDM = document.getElementById('btn-send-admin-dm');
        if (btnSendDM) btnSendDM.addEventListener('click', function(){ DB_Messages.sendAdminMessage(); });

        /* Alert admin */
        var btnSendAlert = document.getElementById('btn-send-alert');
        if (btnSendAlert) btnSendAlert.addEventListener('click', function(){ DB_Alerts.sendAlert(); });

        /* Agent DM reply */
        var btnAgentReply = document.getElementById('btn-agent-dm-reply');
        if (btnAgentReply) btnAgentReply.addEventListener('click', function(){ DB_Messages.sendAgentReply(); });
    },

    init: function() {
        this.bindEvents();
        DB_Content.init();
        DB_Responses.init();
    }
};
