/* ============================================
   DELTA BLACK — MAIN ENTRY POINT
   Clean boot sequence. No IIFE. No race conditions.
   Events bound synchronously. Firebase async.
   ============================================ */

function deltaBlackBoot() {
    DB_Utils.showScreen('welcome-screen');
    deltaBlackBindEvents();

    DB_Storage.initialize().then(function() {
        var session = DB_Auth.checkExistingSession();
        if (!session) { DB_Welcome.init(); return; }

        /* Admin session — validate from config directly */
        if (session.user.role === 'admin') {
            DB_Admin.showDashboard(session.user);
            return;
        }

        /* Agent session — re-validate against Firebase */
        DB_Storage.getUserByAgentNumber(session.user.agentNumber)
            .then(function(fresh) {
                if (fresh && fresh.barCode === session.user.barCode) {
                    DB_User.showDashboard(fresh);
                } else {
                    DB_Storage.clearCurrentUser();
                    DB_Welcome.init();
                }
            })
            .catch(function() { DB_Welcome.init(); });

    }).catch(function(e) {
        console.error('[Delta Black] Boot error:', e);
        DB_Welcome.init();
    });
}

function deltaBlackBindEvents() {
    /* Welcome */
    var btnEnter = document.getElementById('btn-enter');
    if (btnEnter) btnEnter.addEventListener('click', function() { DB_Welcome.enterSystem(); });

    /* Login button */
    var btnAuth = document.getElementById('btn-auth');
    if (btnAuth) btnAuth.addEventListener('click', deltaBlackDoLogin);

    /* Login Enter key + clear error on input */
    ['agent-number','barcode','nickname'].forEach(function(id) {
        var el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('keydown', function(e){ if (e.key === 'Enter') deltaBlackDoLogin(); });
        el.addEventListener('input',   function(){ DB_Utils.setText('login-error',''); });
    });

    /* User dashboard */
    var btnUM = document.getElementById('btn-user-menu');
    if (btnUM) btnUM.addEventListener('click', function(e){ e.stopPropagation(); DB_User.toggleMenu(); });

    var btnSub = document.getElementById('btn-submit-answer');
    if (btnSub) btnSub.addEventListener('click', function(){ DB_User.submitAnswer(); });

    var textarea = document.getElementById('user-answer');
    if (textarea) textarea.addEventListener('keydown', function(e){
        if (e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); DB_User.submitAnswer(); }
    });

    var btnUL = document.getElementById('btn-user-logout');
    if (btnUL) btnUL.addEventListener('click', function(){ DB_Auth.logout(); });

    /* User menu items */
    var btnUDM = document.getElementById('btn-user-direct-messages');
    if (btnUDM) btnUDM.addEventListener('click', function(){ DB_User.toggleMenu(); DB_Messages.openAgentInbox(); });

    var btnUAlerts = document.getElementById('btn-user-alerts');
    if (btnUAlerts) btnUAlerts.addEventListener('click', function(){ DB_User.toggleMenu(); DB_Alerts.openAgentPanel(); });

    var btnUHistory = document.getElementById('btn-user-history');
    if (btnUHistory) btnUHistory.addEventListener('click', function(){ DB_User.toggleMenu(); DB_User.showHistory(); });

    var btnUMyData = document.getElementById('btn-user-mydata');
    if (btnUMyData) btnUMyData.addEventListener('click', function(){ DB_User.toggleMenu(); DB_User.showMyData(); });

    /* Admin menu items */
    var btnADM = document.getElementById('btn-admin-direct-messages');
    if (btnADM) btnADM.addEventListener('click', function(){ DB_Admin.toggleMenu(); DB_Messages.openAdminPanel(); });

    var btnAAlerts = document.getElementById('btn-admin-alerts');
    if (btnAAlerts) btnAAlerts.addEventListener('click', function(){ DB_Admin.toggleMenu(); DB_Alerts.openAdminPanel(); });

    var btnAUD = document.getElementById('btn-admin-userdata');
    if (btnAUD) btnAUD.addEventListener('click', function(){ DB_Admin.toggleMenu(); DB_UserData.openPanel(); });

    /* Admin init (binds all admin-specific events) */
    DB_Admin.init();

    /* Overlay close buttons (user side) */
    document.querySelectorAll('.overlay-close').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var target = btn.dataset.close;
            var el = document.getElementById(target);
            if (el) el.classList.add('hidden');
        });
    });

    /* Global: close menus on outside click */
    document.addEventListener('click', function(e) {
        var um = document.getElementById('user-menu');
        var ub = document.getElementById('btn-user-menu');
        var am = document.getElementById('admin-menu');
        var ab = document.getElementById('btn-admin-menu');
        if (um && ub && !um.contains(e.target) && !ub.contains(e.target)) um.classList.add('hidden');
        if (am && ab && !am.contains(e.target) && !ab.contains(e.target)) am.classList.add('hidden');
    });
}

function deltaBlackDoLogin() {
    var btn = document.getElementById('btn-auth');
    if (btn) { btn.disabled = true; btn.textContent = 'AUTHENTICATING...'; }

    DB_Auth.authenticate()
        .then(function(result) {
            if (btn) { btn.disabled = false; btn.textContent = 'AUTHENTICATE'; }
            if (!result) return;
            if (result.role === 'admin') {
                DB_Admin.showDashboard(result.user);
            } else {
                DB_User.showDashboard(result.user);
            }
        })
        .catch(function(e) {
            if (btn) { btn.disabled = false; btn.textContent = 'AUTHENTICATE'; }
            console.error('[Delta Black] Login error:', e);
            DB_Utils.setText('login-error', 'SYSTEM ERROR — TRY AGAIN');
        });
}

/* Boot */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', deltaBlackBoot);
} else {
    deltaBlackBoot();
}
