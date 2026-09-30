/* ============================================
   DELTA BLACK — DUSTBIN
   Admin moves questions, responses, activities,
   user data items to dustbin. Items stay saved
   until permanently deleted from dustbin.
   ============================================ */
const DB_Dustbin = {

    openPanel: function() {
        var overlay = document.getElementById('dustbin-overlay');
        if (overlay) overlay.classList.remove('hidden');
        this.load();
    },

    closePanel: function() {
        var overlay = document.getElementById('dustbin-overlay');
        if (overlay) overlay.classList.add('hidden');
    },

    load: function() {
        var self     = this;
        var typeFilter = document.getElementById('dustbin-type-filter');
        var filterVal  = typeFilter ? typeFilter.value : 'all';
        var list       = document.getElementById('dustbin-list');
        if (!list) return;
        list.innerHTML = '<div class="loading-state">Loading dustbin...</div>';

        DB_Storage.getDustbinItems().then(function(items) {
            if (filterVal !== 'all') {
                items = items.filter(function(i){ return i.itemType === filterVal; });
            }
            if (!items.length) {
                list.innerHTML = '<p class="empty-hint">Dustbin is empty.</p>';
                return;
            }
            items.sort(function(a,b){ return new Date(b.deletedAt) - new Date(a.deletedAt); });

            list.innerHTML = items.map(function(item) {
                return '<div class="dustbin-item" id="dbin-' + item.id + '">' +
                    '<div class="dustbin-item-header">' +
                        '<span class="dustbin-type-badge">' + item.itemType.toUpperCase() + '</span>' +
                        '<span class="dustbin-date">' + DB_Utils.formatDate(item.deletedAt) + '</span>' +
                    '</div>' +
                    '<div class="dustbin-item-label">' +
                        DB_Utils.escapeHtml((item.label || item.content || '').substring(0, 120)) +
                    '</div>' +
                    '<div class="dustbin-item-actions">' +
                        '<button class="ud-btn" onclick="DB_Dustbin.restore(\'' + item.id + '\')">↩ RESTORE</button>' +
                        '<button class="ud-btn ud-btn-delete" onclick="DB_Dustbin.permanentDelete(\'' + item.id + '\')">🗑 DELETE PERMANENTLY</button>' +
                    '</div>' +
                '</div>';
            }).join('');
        });
    },

    /* Move any item to dustbin */
    moveTobin: function(itemType, itemId, label, originalRef) {
        var item = {
            id:          DB_Utils.generateId(),
            itemType:    itemType,   /* 'question' | 'response' | 'activity' | 'userdata' | 'user' */
            originalId:  itemId,
            originalRef: originalRef,
            label:       label,
            deletedAt:   new Date().toISOString()
        };
        return DB_Storage.addDustbinItem(item);
    },

    restore: function(dustbinId) {
        DB_Utils.toast('Restore not yet implemented — item preserved in dustbin', 'info');
    },

    permanentDelete: function(dustbinId) {
        if (!confirm('Permanently delete this item? This CANNOT be undone.')) return;
        DB_Storage.deleteDustbinItem(dustbinId).then(function() {
            DB_Utils.toast('Permanently deleted', 'success');
            DB_Dustbin.load();
        });
    },

    clearAll: function() {
        if (!confirm('Empty entire dustbin? All items will be permanently deleted.')) return;
        DB_Storage.clearDustbin().then(function() {
            DB_Utils.toast('Dustbin emptied', 'success');
            DB_Dustbin.load();
        });
    },

    /* ── QUICK SEND TO DUSTBIN helpers ── */
    deleteQuestion: function(questionId, preview) {
        var self = this;
        this.moveTobin('question', questionId, 'Question: ' + (preview||questionId),
            'questions/' + questionId)
            .then(function() {
                return DB_Ref.question(questionId).remove();
            })
            .then(function() {
                DB_Utils.toast('Question moved to dustbin', 'success');
                DB_Questions.loadSent();
            });
    },

    deleteActivity: function(agentNumber, activityId, detail) {
        this.moveTobin('activity', activityId,
            'Activity [Agent ' + agentNumber + ']: ' + (detail||activityId),
            'activity/' + agentNumber + '/' + activityId)
            .then(function() {
                return DB_Ref.activityItem(agentNumber, activityId).remove();
            })
            .then(function() {
                DB_Utils.toast('Activity moved to dustbin', 'success');
                DB_Activity.load();
            });
    },

    deleteUserDataItem: function(agentNumber, itemId, content) {
        this.moveTobin('userdata', itemId,
            'UserData [Agent ' + agentNumber + ']: ' + (content||itemId),
            'userdata/' + agentNumber + '/' + itemId)
            .then(function() {
                return DB_Storage.deleteUserDataItem(agentNumber, itemId);
            })
            .then(function() {
                DB_Utils.toast('Item moved to dustbin', 'success');
                DB_UserData.loadAgent(agentNumber);
            });
    }
};
