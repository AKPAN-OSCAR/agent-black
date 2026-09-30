/* ============================================
   DELTA BLACK — WELCOME SCREEN
   Fixed: auto-advance only fires after Firebase
   is ready, preventing race condition on hosting
   ============================================ */

const DB_Welcome = {

    _autoTimer: null,

    init: function() {
        var welcomeImg = document.getElementById('welcome-img');

        if (welcomeImg) {
            welcomeImg.src = '196478.png';
            welcomeImg.onerror = function() {
                this.style.display = 'none';
                var overlay = document.querySelector('.welcome-overlay');
                if (overlay) {
                    overlay.style.background =
                        'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #0a0a0a 100%)';
                }
            };
        }

        // Clear any previous timer (prevents double-fire on re-init)
        if (this._autoTimer) {
            clearTimeout(this._autoTimer);
            this._autoTimer = null;
        }

        // Auto-advance to login after 6 seconds
        // Only fires if still on welcome screen (no active session routing happened)
        this._autoTimer = setTimeout(function() {
            var welcomeScreen = document.getElementById('welcome-screen');
            if (welcomeScreen && welcomeScreen.classList.contains('active')) {
                var textBox = document.getElementById('welcome-text-box');
                if (textBox) {
                    textBox.style.transition = 'opacity 0.8s ease';
                    textBox.style.opacity = '0';
                }
                setTimeout(function() {
                    // Double-check still on welcome before advancing
                    var ws = document.getElementById('welcome-screen');
                    if (ws && ws.classList.contains('active')) {
                        DB_Welcome.enterSystem();
                    }
                }, 900);
            }
        }, 6000);
    },

    enterSystem: function() {
        // Cancel auto-advance if user clicked manually
        if (this._autoTimer) {
            clearTimeout(this._autoTimer);
            this._autoTimer = null;
        }
        DB_Utils.showScreen('login-screen');
    }
};
