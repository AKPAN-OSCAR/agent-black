/* ============================================
   DELTA BLACK — AUTHENTICATION
   Admin validated from config (no Firebase dependency).
   Agents validated from Firebase.
   ============================================ */
const DB_Auth = {

    isAdmin: function(ag, bc, nn) {
        return ag === DB_CONFIG.ADMIN.agentNumber &&
               bc === DB_CONFIG.ADMIN.barCode &&
               nn === DB_CONFIG.ADMIN.name;
    },

    authenticate: function() {
        var ag  = DB_Utils.getValue('agent-number');
        var bc  = DB_Utils.getValue('barcode');
        var nn  = DB_Utils.getValue('nickname');
        var err = document.getElementById('login-error');

        if (!ag || !bc || !nn) {
            if (err) err.textContent = 'ALL FIELDS REQUIRED — ACCESS DENIED';
            return Promise.resolve(null);
        }

        /* ── ADMIN ── direct config check, no Firebase needed */
        if (this.isAdmin(ag, bc, nn)) {
            var adminUser = {
                agentNumber: DB_CONFIG.ADMIN.agentNumber,
                barCode:     DB_CONFIG.ADMIN.barCode,
                nickname:    DB_CONFIG.ADMIN.name,
                name:        DB_CONFIG.ADMIN.name,
                role:        'admin',
                profile:     'System Administrator',
                grades: [], levels: [], badges: [],
                lastLogin: new Date().toISOString()
            };
            /* Save to Firebase best-effort — don't block login */
            DB_Storage.saveUser(adminUser).catch(function(){});
            DB_Storage.logActivity('001', 'LOGIN', 'Admin logged in').catch(function(){});
            DB_Storage.setCurrentUser(adminUser);
            return Promise.resolve({ user: adminUser, role: 'admin' });
        }

        /* ── AGENT ── must exist in Firebase */
        return DB_Storage.getUserByAgentNumber(ag)
            .then(function(user) {
                if (user && user.barCode === bc && user.nickname === nn) {
                    user.lastLogin = new Date().toISOString();
                    return DB_Storage.updateUser(user).then(function() {
                        DB_Storage.logActivity(user.agentNumber, 'LOGIN', 'Agent logged in').catch(function(){});
                        DB_Storage.setCurrentUser(user);
                        return { user: user, role: user.role || 'user' };
                    });
                }
                if (err) err.textContent = 'INVALID CREDENTIALS — ACCESS DENIED';
                var form = document.querySelector('.login-form');
                if (form) {
                    form.style.animation = 'none';
                    setTimeout(function(){ form.style.animation = 'shake 0.5s ease'; }, 10);
                }
                return null;
            })
            .catch(function(e) {
                console.error('[Delta Black] Auth error:', e);
                if (err) err.textContent = 'CONNECTION ERROR — CHECK NETWORK';
                return null;
            });
    },

    logout: function() {
        var u = DB_Storage.getCurrentUser();
        if (u) DB_Storage.logActivity(u.agentNumber, 'LOGOUT', 'Logged out').catch(function(){});
        DB_Storage.clearCurrentUser();
        ['agent-number','barcode','nickname'].forEach(function(id){ DB_Utils.clearValue(id); });
        DB_Utils.setText('login-error', '');
        var um = document.getElementById('user-menu');
        var am = document.getElementById('admin-menu');
        if (um) um.classList.add('hidden');
        if (am) am.classList.add('hidden');
        DB_Utils.showScreen('welcome-screen');
    },

    checkExistingSession: function() {
        var u = DB_Storage.getCurrentUser();
        return u ? { user: u, role: u.role || 'user' } : null;
    },

    init: function() { return DB_Storage.initialize(); }
};
