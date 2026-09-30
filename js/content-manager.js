/* ============================================
   DELTA BLACK — CONTENT MANAGER
   Populates all agent selects across the app.
   Handles profile, grade, level, badge updates.
   ============================================ */
const DB_Content = {

    updateSelects: function() {
        DB_Storage.getUsers().then(function(users) {
            var agents = users.filter(function(u){ return u.role !== 'admin'; });

            /* All selects that need the agent list */
            var selectIds = [
                'target-agent',
                'profile-target',
                'grade-target',
                'level-target',
                'badge-target',
                'response-filter',
                'alert-target',
                'activity-agent-filter',
                'dm-target-agent',
                'userdata-agent-select'
            ];

            selectIds.forEach(function(id) {
                var sel = document.getElementById(id);
                if (!sel) return;

                var hasAll = ['target-agent','response-filter','alert-target','activity-agent-filter'].indexOf(id) !== -1;
                var current = sel.value;
                sel.innerHTML = '';

                if (hasAll) {
                    var opt = document.createElement('option');
                    opt.value = 'all';
                    opt.textContent = id === 'activity-agent-filter' ? 'All Agents' : 'All Agents';
                    sel.appendChild(opt);
                }

                if (id === 'dm-target-agent' || id === 'userdata-agent-select') {
                    var placeholder = document.createElement('option');
                    placeholder.value = '';
                    placeholder.textContent = '— Select Agent —';
                    sel.appendChild(placeholder);
                }

                agents.forEach(function(u) {
                    var opt = document.createElement('option');
                    opt.value = u.agentNumber;
                    opt.textContent = 'Agent ' + u.agentNumber + ' — ' + u.nickname;
                    sel.appendChild(opt);
                });

                /* Restore previous selection if still valid */
                if (current && !sel.multiple) sel.value = current;
            });
        });
    },

    updateProfile: function() {
        var target  = document.getElementById('profile-target');
        var content = DB_Utils.getValue('profile-content');
        if (!content) { DB_Utils.toast('Enter profile content', 'error'); return; }
        DB_Storage.getUserByAgentNumber(target ? target.value : '').then(function(user) {
            if (!user) { DB_Utils.toast('Agent not found', 'error'); return; }
            user.profile = content;
            return DB_Storage.updateUser(user).then(function() {
                DB_Utils.clearValue('profile-content');
                DB_Utils.toast('Profile updated for Agent ' + target.value, 'success');
            });
        });
    },

    assignGrade: function() {
        var target = document.getElementById('grade-target');
        var value  = DB_Utils.getValue('grade-value');
        var notes  = DB_Utils.getValue('grade-notes');
        if (!value) { DB_Utils.toast('Enter grade value', 'error'); return; }
        DB_Storage.getUserByAgentNumber(target ? target.value : '').then(function(user) {
            if (!user) return;
            user.grades = user.grades || [];
            user.grades.push({
                value: value, notes: notes,
                date: new Date().toLocaleDateString(),
                assignedAt: new Date().toISOString()
            });
            return DB_Storage.updateUser(user).then(function() {
                DB_Utils.clearValue('grade-value');
                DB_Utils.clearValue('grade-notes');
                DB_Utils.toast('Grade assigned to Agent ' + target.value, 'success');
                DB_Storage.logActivity('001','GRADE_ASSIGNED','Agent '+target.value+': '+value).catch(function(){});
            });
        });
    },

    setLevel: function() {
        var target = document.getElementById('level-target');
        var value  = DB_Utils.getValue('level-value');
        if (!value) { DB_Utils.toast('Enter level value', 'error'); return; }
        DB_Storage.getUserByAgentNumber(target ? target.value : '').then(function(user) {
            if (!user) return;
            user.levels = user.levels || [];
            user.levels.push({
                value: value,
                date: new Date().toLocaleDateString(),
                assignedAt: new Date().toISOString()
            });
            return DB_Storage.updateUser(user).then(function() {
                DB_Utils.clearValue('level-value');
                DB_Utils.toast('Level set for Agent ' + target.value, 'success');
            });
        });
    },

    awardBadge: function() {
        var target = document.getElementById('badge-target');
        var name   = DB_Utils.getValue('badge-name');
        var icon   = DB_Utils.getValue('badge-icon') || '🏅';
        if (!name) { DB_Utils.toast('Enter badge name', 'error'); return; }
        DB_Storage.getUserByAgentNumber(target ? target.value : '').then(function(user) {
            if (!user) return;
            user.badges = user.badges || [];
            user.badges.push({
                name: name, icon: icon,
                date: new Date().toLocaleDateString(),
                awardedAt: new Date().toISOString()
            });
            return DB_Storage.updateUser(user).then(function() {
                DB_Utils.clearValue('badge-name');
                DB_Utils.clearValue('badge-icon');
                DB_Utils.toast('Badge awarded to Agent ' + target.value, 'success');
            });
        });
    },

    init: function() {
        document.addEventListener('usersUpdated', this.updateSelects.bind(this));
    }
};
