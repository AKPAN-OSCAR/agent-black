/* ============================================
   DELTA BLACK — UTILITIES
   Core helper functions used across all modules
   ============================================ */

const DB_Utils = {

    // ============================================
    // DOM VALUE HELPERS
    // ============================================

    getValue: function(id) {
        var el = document.getElementById(id);
        return el ? el.value.trim() : '';
    },

    setValue: function(id, val) {
        var el = document.getElementById(id);
        if (el) el.value = val;
    },

    clearValue: function(id) {
        var el = document.getElementById(id);
        if (el) el.value = '';
    },

    getText: function(id) {
        var el = document.getElementById(id);
        return el ? el.textContent : '';
    },

    setText: function(id, text) {
        var el = document.getElementById(id);
        if (el) el.textContent = text;
    },

    setHtml: function(id, html) {
        var el = document.getElementById(id);
        if (el) el.innerHTML = html;
    },

    // ============================================
    // CLASS HELPERS
    // ============================================

    addClass: function(id, className) {
        var el = document.getElementById(id);
        if (el) el.classList.add(className);
    },

    removeClass: function(id, className) {
        var el = document.getElementById(id);
        if (el) el.classList.remove(className);
    },

    toggleClass: function(id, className) {
        var el = document.getElementById(id);
        if (el) el.classList.toggle(className);
    },

    hasClass: function(id, className) {
        var el = document.getElementById(id);
        return el ? el.classList.contains(className) : false;
    },

    // ============================================
    // SCREEN MANAGEMENT
    // ============================================

    showScreen: function(screenId) {
        // Hide all screens
        var screens = document.querySelectorAll('.screen');
        screens.forEach(function(screen) {
            screen.classList.remove('active');
        });

        // Show target screen
        var target = document.getElementById(screenId);
        if (target) {
            target.classList.add('active');
        }
    },

    // ============================================
    // ID GENERATION
    // ============================================

    generateId: function() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    },

    // ============================================
    // STRING HELPERS
    // ============================================

    escapeHtml: function(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    formatDate: function(isoString) {
        if (!isoString) return '—';
        try {
            var d = new Date(isoString);
            return d.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return isoString;
        }
    },

    formatDateShort: function(isoString) {
        if (!isoString) return '—';
        try {
            var d = new Date(isoString);
            return d.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
        } catch (e) {
            return isoString;
        }
    },

    // ============================================
    // SHOW / HIDE HELPERS
    // ============================================

    show: function(id) {
        var el = document.getElementById(id);
        if (el) el.classList.remove('hidden');
    },

    hide: function(id) {
        var el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    },

    // ============================================
    // DISABLE / ENABLE
    // ============================================

    disable: function(id) {
        var el = document.getElementById(id);
        if (el) el.disabled = true;
    },

    enable: function(id) {
        var el = document.getElementById(id);
        if (el) el.disabled = false;
    },

    // ============================================
    // NOTIFICATION / TOAST
    // ============================================

    toast: function(message, type) {
        // Remove any existing toast
        var existing = document.getElementById('db-toast');
        if (existing) existing.remove();

        var toast = document.createElement('div');
        toast.id = 'db-toast';
        toast.className = 'db-toast db-toast--' + (type || 'success');
        toast.textContent = message;

        document.body.appendChild(toast);

        // Trigger animation
        setTimeout(function() { toast.classList.add('db-toast--visible'); }, 10);

        // Auto-remove
        setTimeout(function() {
            toast.classList.remove('db-toast--visible');
            setTimeout(function() { toast.remove(); }, 400);
        }, 3000);
    },

    // ============================================
    // LOADING STATE
    // ============================================

    setLoading: function(id, loading) {
        var el = document.getElementById(id);
        if (!el) return;
        if (loading) {
            el.dataset.originalText = el.textContent;
            el.textContent = 'PROCESSING...';
            el.disabled = true;
        } else {
            el.textContent = el.dataset.originalText || el.textContent;
            el.disabled = false;
        }
    }
};

/* ============================================
   TOAST STYLES (injected dynamically)
   ============================================ */
(function() {
    var style = document.createElement('style');
    style.textContent = [
        '.db-toast {',
        '  position: fixed;',
        '  bottom: 2rem;',
        '  right: 2rem;',
        '  padding: 0.8rem 1.5rem;',
        '  font-family: "Share Tech Mono", monospace;',
        '  font-size: 0.85rem;',
        '  letter-spacing: 0.05em;',
        '  z-index: 9999;',
        '  opacity: 0;',
        '  transform: translateY(10px);',
        '  transition: opacity 0.3s ease, transform 0.3s ease;',
        '  pointer-events: none;',
        '  border-left: 3px solid;',
        '}',
        '.db-toast--visible {',
        '  opacity: 1;',
        '  transform: translateY(0);',
        '}',
        '.db-toast--success {',
        '  background: #111;',
        '  color: #00ff41;',
        '  border-color: #00ff41;',
        '  box-shadow: 0 0 20px rgba(0,255,65,0.2);',
        '}',
        '.db-toast--error {',
        '  background: #111;',
        '  color: #ff3333;',
        '  border-color: #ff3333;',
        '  box-shadow: 0 0 20px rgba(255,51,51,0.2);',
        '}',
        '.db-toast--info {',
        '  background: #111;',
        '  color: #00aaff;',
        '  border-color: #00aaff;',
        '  box-shadow: 0 0 20px rgba(0,170,255,0.2);',
        '}'
    ].join('\n');
    document.head.appendChild(style);
})();
