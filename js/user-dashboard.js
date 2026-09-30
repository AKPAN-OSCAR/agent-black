/* ============================================
   DELTA BLACK — USER DASHBOARD
   Fixed:
   - Each question renders by its OWN type
   - Batch questions show all sub-questions inside one card
   - Flag no longer blocks — advances after flagging
   - New questions from admin appear immediately
   - Mixed media fully rendered
   ============================================ */
const DB_User = {

    _currentQuestions: [],
    _currentIndex:     0,

    showDashboard: function(user) {
        var self = this;
        DB_Storage.setCurrentUser(user);
        DB_Utils.showScreen('user-dashboard');
        DB_Utils.setText('user-display-name', user.nickname);
        DB_Storage.getWelcomeMessage().then(function(msg) {
            DB_Utils.setText('welcome-message', msg);
            DB_Utils.setText('welcome-subtitle', 'Agent ' + user.agentNumber + ' — ' + user.nickname);
        });
        self.updateMenu(user);
        self.loadQuestions(user);
        self.startQuestionListener(user.agentNumber);
        DB_Alerts.startAgentListener(user.agentNumber);
        DB_Messages.startAgentListener(user.agentNumber);
    },

    startQuestionListener: function(ag) {
        var self = this;
        DB_Storage.listenForQuestions(ag, function() {
            var u = DB_Storage.getCurrentUser();
            if (u) self.loadQuestions(u);
        });
    },

    loadQuestions: function(user) {
        var self = this;
        DB_Storage.getQuestionsForAgent(user.agentNumber).then(function(questions) {
            return DB_Storage.getAnsweredQuestionIds(user.agentNumber).then(function(done) {
                var pending = questions.filter(function(q) {
                    if (done.indexOf(q.id) !== -1) return false;
                    if (q.deadline && new Date(q.deadline) < new Date()) return false;
                    return true;
                });

                self._currentQuestions = pending;
                self._currentIndex     = 0;

                if (!pending.length) {
                    DB_Utils.setHtml('question-content',
                        '<p class="no-questions">' +
                        (done.length ? 'All directives completed. Awaiting further orders.'
                                     : 'No active directives at this time. Stand by.') +
                        '</p>');
                    DB_Utils.setText('question-counter', '');
                    DB_Utils.setText('question-type', 'STANDBY');
                    DB_Utils.addClass('answer-section', 'hidden');
                    return;
                }

                self.renderQuestion(0, pending);
            });
        });
    },

    /* Master render — routes each question by its own type */
    renderQuestion: function(index, questions) {
        var self = this;
        questions = questions || this._currentQuestions;
        if (!questions.length) return;

        /* Clamp index */
        if (index >= questions.length) index = questions.length - 1;
        this._currentIndex = index;

        var q     = questions[index];
        var total = questions.length;
        var user  = DB_Storage.getCurrentUser();

        DB_Utils.setText('question-counter', 'Directive ' + (index + 1) + ' of ' + total);
        DB_Utils.setText('question-type', q.type.toUpperCase());

        /* Fire read receipt */
        if (user) {
            DB_Storage.markSeen(q.id, user.agentNumber).catch(function(){});
            DB_Storage.logActivity(user.agentNumber, 'QUESTION_OPENED',
                'Opened ' + q.type + ' directive').catch(function(){});
        }

        var html = '';

        /* ── BATCH: show all sub-questions in one card ── */
        if (q.type === 'batch') {
            html += '<div class="batch-card">';
            html += '<div class="batch-card-title">📋 BATCH DIRECTIVE — ' +
                (q.questions || []).length + ' questions</div>';
            (q.questions || []).forEach(function(bq, bi) {
                html += '<div class="sub-question">' +
                    '<div class="sub-q-num">Q' + (bi + 1) + '</div>' +
                    '<p class="q-text">' + DB_Utils.escapeHtml(bq) + '</p>' +
                    '<textarea class="batch-sub-answer" data-qid="' + q.id +
                    '" data-idx="' + bi + '" placeholder="Your answer..."></textarea>' +
                    '</div>';
            });
            html += '<button class="btn-submit-all" onclick="DB_User.submitBatchAnswer(\'' +
                q.id + '\')">SUBMIT ALL ANSWERS</button>';
            html += '</div>';

        /* ── POLL ── */
        } else if (q.type === 'poll') {
            html += '<p class="q-text">' + DB_Utils.escapeHtml(q.content) + '</p>';
            html += self._pollHtml(q);

        /* ── MULTIPLE CHOICE ── */
        } else if (q.type === 'mc') {
            html += '<p class="q-text">' + DB_Utils.escapeHtml(q.content) + '</p>';
            html += self._mcHtml(q);

        /* ── MIXED MEDIA ── */
        } else if (q.type === 'mixed') {
            if (q.content) html += '<p class="q-text">' + DB_Utils.escapeHtml(q.content) + '</p>';
            if (q.mediaUrl) {
                if (q.mediaType === 'image')
                    html += '<img src="' + q.mediaUrl + '" class="q-media">';
                else if (q.mediaType === 'video')
                    html += '<video controls src="' + q.mediaUrl + '" class="q-media"></video>';
                else if (q.mediaType === 'audio')
                    html += '<audio controls src="' + q.mediaUrl + '" style="width:100%"></audio>';
                else
                    html += '<a href="' + q.mediaUrl + '" target="_blank" class="q-file-link">' +
                        '📎 ' + DB_Utils.escapeHtml(q.fileName || 'Download File') + '</a>';
            }
            html += self._textAnswerHtml(q);

        /* ── IMAGE ── */
        } else if (q.type === 'image') {
            html += '<img src="' + q.content + '" class="q-media">';
            html += self._textAnswerHtml(q);

        /* ── VIDEO ── */
        } else if (q.type === 'video') {
            html += '<video controls src="' + q.content + '" class="q-media"></video>';
            html += self._textAnswerHtml(q);

        /* ── AUDIO ── */
        } else if (q.type === 'audio') {
            html += '<audio controls src="' + q.content + '" style="width:100%"></audio>';
            html += self._textAnswerHtml(q);

        /* ── TEXT (default) ── */
        } else {
            html += '<p class="q-text">' + DB_Utils.escapeHtml(q.content || '') + '</p>';
            html += self._textAnswerHtml(q);
        }

        /* Deadline timer */
        if (q.deadline) {
            html += self._deadlineHtml(q.deadline, q.id);
        }

        /* Navigation row */
        html += '<div class="q-nav-row">';
        if (index > 0) {
            html += '<button class="btn-q-nav" onclick="DB_User.renderQuestion(' +
                (index - 1) + ')">← Previous</button>';
        }
        /* Flag button — advances after flagging */
        html += '<button class="btn-flag" onclick="DB_User.flagQuestion(\'' +
            q.id + '\',' + index + ')">⚑ FLAG FOR CLARIFICATION</button>';
        if (index < total - 1) {
            html += '<button class="btn-q-nav" onclick="DB_User.renderQuestion(' +
                (index + 1) + ')">Next →</button>';
        }
        html += '</div>';

        DB_Utils.setHtml('question-content', html);
        DB_Utils.addClass('answer-section', 'hidden');
        if (q.deadline) self._startDeadlineTimer(q.id, q.deadline);
    },

    _textAnswerHtml: function(q) {
        return '<textarea class="inline-answer" id="user-answer-' + q.id +
            '" placeholder="Enter your response..."></textarea>' +
            '<button class="btn-submit" onclick="DB_User.submitCurrentAnswer(\'' +
            q.id + '\')">SUBMIT RESPONSE</button>';
    },

    _pollHtml: function(q) {
        var html = '<div class="poll-options" data-qid="' + q.id + '">';
        (q.options || []).forEach(function(opt, i) {
            html += '<button class="poll-option-btn" onclick="DB_User.submitPollAnswer(\'' +
                q.id + '\',' + i + ',this)">' + DB_Utils.escapeHtml(opt) + '</button>';
        });
        return html + '</div>';
    },

    _mcHtml: function(q) {
        var html = '<div class="mc-options" data-qid="' + q.id + '">';
        (q.options || []).forEach(function(opt, i) {
            html += '<button class="mc-option-btn" onclick="DB_User.submitMcAnswer(\'' +
                q.id + '\',' + i + ',this,' + q.correctIndex + ')">' +
                '<span class="mc-label">' + String.fromCharCode(65 + i) + '.</span> ' +
                DB_Utils.escapeHtml(opt) + '</button>';
        });
        return html + '</div>';
    },

    _deadlineHtml: function(deadline, qId) {
        return '<div class="deadline-timer" id="timer-' + qId +
            '">⏱ Time remaining: calculating...</div>';
    },

    _startDeadlineTimer: function(qId, deadline) {
        var el = document.getElementById('timer-' + qId);
        if (!el) return;
        function update() {
            var remaining = new Date(deadline) - new Date();
            if (remaining <= 0) {
                el.textContent = '⏱ TIME EXPIRED';
                el.style.color = 'var(--danger)';
                return;
            }
            var m = Math.floor(remaining / 60000);
            var s = Math.floor((remaining % 60000) / 1000);
            el.textContent = '⏱ ' + m + 'm ' + s + 's remaining';
            el.style.color = remaining < 300000 ? 'var(--danger)' : 'var(--warning)';
            setTimeout(update, 1000);
        }
        update();
    },

    submitCurrentAnswer: function(questionId) {
        var ta = document.getElementById('user-answer-' + questionId);
        var answer = ta ? ta.value.trim() : '';
        if (!answer) { DB_Utils.toast('Response cannot be empty', 'error'); return; }
        this._submitResponse(questionId, answer);
    },

    submitBatchAnswer: function(questionId) {
        var user = DB_Storage.getCurrentUser();
        var answers = [];
        document.querySelectorAll('.batch-sub-answer[data-qid="' + questionId + '"]')
            .forEach(function(ta, i) {
                answers.push('Q' + (i + 1) + ': ' + (ta.value.trim() || '(no answer)'));
            });
        var combined = answers.join('\n\n');
        if (!combined.trim()) { DB_Utils.toast('Answer at least one question', 'error'); return; }
        this._submitResponse(questionId, combined);
    },

    submitPollAnswer: function(questionId, optionIndex, btn) {
        var container = btn.closest('.poll-options');
        if (container) container.querySelectorAll('.poll-option-btn')
            .forEach(function(b){ b.disabled = true; });
        btn.classList.add('poll-selected');

        var q = this._currentQuestions.find(function(x){ return x.id === questionId; });
        var answerText = q ? (q.options[optionIndex] || String(optionIndex)) : String(optionIndex);

        var agentVotes = Object.assign({}, q ? (q.votes || {}) : {});
        var agentNum   = DB_Storage.getCurrentUser().agentNumber;
        agentVotes[agentNum] = optionIndex;
        if (q) DB_Storage.addQuestion(Object.assign({}, q, { votes: agentVotes })).catch(function(){});

        this._submitResponse(questionId, 'POLL: ' + answerText, optionIndex);
    },

    submitMcAnswer: function(questionId, optionIndex, btn, correctIndex) {
        var container = btn.closest('.mc-options');
        if (container) container.querySelectorAll('.mc-option-btn')
            .forEach(function(b){ b.disabled = true; });

        var isCorrect = (optionIndex === correctIndex);
        btn.classList.add(isCorrect ? 'mc-correct' : 'mc-wrong');
        if (!isCorrect) {
            var correctBtn = container
                ? container.querySelectorAll('.mc-option-btn')[correctIndex] : null;
            if (correctBtn) correctBtn.classList.add('mc-correct');
        }

        var q = this._currentQuestions.find(function(x){ return x.id === questionId; });
        var answerText = q ? (q.options[optionIndex] || String(optionIndex)) : String(optionIndex);
        this._submitResponse(questionId, 'MC: ' + answerText, optionIndex, isCorrect);
    },

    submitAnswer: function() {
        var q = this._currentQuestions[this._currentIndex];
        if (!q) return;
        this.submitCurrentAnswer(q.id);
    },

    _submitResponse: function(questionId, answer, optionIndex, isCorrect) {
        var self = this;
        var user = DB_Storage.getCurrentUser();
        if (!user || !questionId) return;

        var response = {
            id:          DB_Utils.generateId(),
            questionId:  questionId,
            agentNumber: user.agentNumber,
            answer:      answer,
            submittedAt: new Date().toISOString(),
            status:      'submitted'
        };
        if (optionIndex !== undefined) response.optionIndex = optionIndex;
        if (isCorrect   !== undefined) response.isCorrect   = isCorrect;

        DB_Storage.addResponse(response).then(function() {
            DB_Storage.logActivity(user.agentNumber, 'ANSWER_SUBMITTED',
                'Question ' + questionId).catch(function(){});

            /* Auto-grade MC correct */
            if (isCorrect) {
                DB_Storage.getUserByAgentNumber(user.agentNumber).then(function(u) {
                    if (!u) return;
                    u.grades = u.grades || [];
                    u.grades.push({
                        value: 'AUTO: Correct Answer',
                        notes: 'MC Question: ' + questionId,
                        date:  new Date().toLocaleDateString(),
                        assignedAt: new Date().toISOString()
                    });
                    DB_Storage.updateUser(u).catch(function(){});
                });
            }

            DB_Utils.toast('Response submitted', 'success');

            /* Advance to next question or reload */
            var nextIndex = self._currentIndex + 1;
            if (nextIndex < self._currentQuestions.length) {
                /* Remove answered question from local list and show next */
                self._currentQuestions.splice(self._currentIndex, 1);
                if (self._currentQuestions.length > 0) {
                    var newIndex = Math.min(self._currentIndex, self._currentQuestions.length - 1);
                    setTimeout(function(){ self.renderQuestion(newIndex); }, 600);
                } else {
                    setTimeout(function(){ self.loadQuestions(user); }, 600);
                }
            } else {
                setTimeout(function(){ self.loadQuestions(user); }, 600);
            }
        });
    },

    /* Flag — marks question, then advances to next without removing */
    flagQuestion: function(questionId, currentIndex) {
        var self = this;
        var user = DB_Storage.getCurrentUser();
        if (!user) return;

        DB_Storage.getQuestions().then(function(qs) {
            var q = qs.find(function(x){ return x.id === questionId; });
            if (!q) return;
            var flags = q.flaggedBy || [];
            if (flags.indexOf(user.agentNumber) !== -1) {
                DB_Utils.toast('Already flagged', 'info');
            } else {
                flags.push(user.agentNumber);
                DB_Storage.addQuestion(Object.assign({}, q, { flaggedBy: flags }))
                    .then(function() {
                        DB_Storage.logActivity(user.agentNumber, 'QUESTION_FLAGGED',
                            'Flagged question ' + questionId).catch(function(){});
                        DB_Utils.toast('Flagged — advancing to next directive', 'success');
                    });
            }

            /* Always advance to next question after flagging */
            var nextIndex = (currentIndex !== undefined ? currentIndex : self._currentIndex) + 1;
            if (nextIndex < self._currentQuestions.length) {
                setTimeout(function(){ self.renderQuestion(nextIndex); }, 800);
            } else {
                setTimeout(function(){ self.loadQuestions(user); }, 800);
            }
        });
    },

    showHistory: function() {
        var user = DB_Storage.getCurrentUser();
        if (!user) return;
        var overlay = document.getElementById('user-history-overlay');
        if (!overlay) return;
        overlay.classList.remove('hidden');

        Promise.all([
            DB_Storage.getQuestionsForAgent(user.agentNumber),
            DB_Storage.getResponsesByAgent(user.agentNumber)
        ]).then(function(res) {
            var qMap = {};
            res[0].forEach(function(q){ qMap[q.id] = q; });
            var responses = res[1].sort(function(a,b){
                return new Date(b.submittedAt) - new Date(a.submittedAt);
            });

            var html = responses.length
                ? responses.map(function(r) {
                    var q = qMap[r.questionId];
                    var qPreview = q
                        ? DB_Utils.escapeHtml((q.content || '[' + q.type + ' directive]').substring(0, 100))
                        : '[Directive removed]';
                    return '<div class="history-item">' +
                        '<div class="history-q">' + qPreview + '</div>' +
                        '<div class="history-a">' + DB_Utils.escapeHtml(r.answer) + '</div>' +
                        '<div class="history-meta">' + DB_Utils.formatDate(r.submittedAt) +
                            (r.isCorrect !== undefined
                                ? ' · ' + (r.isCorrect ? '✓ CORRECT' : '✗ INCORRECT') : '') +
                        '</div></div>';
                }).join('')
                : '<p class="empty-hint">No submitted answers yet.</p>';

            DB_Utils.setHtml('user-history-list', html);
        });
    },

    showMyData: function() {
        var user = DB_Storage.getCurrentUser();
        if (!user) return;
        var overlay = document.getElementById('user-mydata-overlay');
        if (!overlay) return;
        overlay.classList.remove('hidden');

        DB_Storage.getUserByAgentNumber(user.agentNumber).then(function(u) {
            if (!u) return;
            var html = '<div class="mydata-section"><h4>Profile</h4><p>' +
                DB_Utils.escapeHtml(u.profile || 'No profile set.') + '</p></div>';
            html += '<div class="mydata-section"><h4>Grades</h4>' +
                ((u.grades||[]).length
                    ? u.grades.map(function(g){
                        return '<div class="data-item">📊 ' + DB_Utils.escapeHtml(g.value) +
                            ' <small>' + g.date + '</small></div>';
                    }).join('')
                    : '<p class="empty-hint">No grades assigned.</p>') + '</div>';
            html += '<div class="mydata-section"><h4>Levels</h4>' +
                ((u.levels||[]).length
                    ? u.levels.map(function(l){
                        return '<div class="data-item">⬆ ' + DB_Utils.escapeHtml(l.value) +
                            ' <small>' + l.date + '</small></div>';
                    }).join('')
                    : '<p class="empty-hint">No levels assigned.</p>') + '</div>';
            html += '<div class="mydata-section"><h4>Badges</h4>' +
                ((u.badges||[]).length
                    ? u.badges.map(function(b){
                        return '<div class="data-item">' + (b.icon||'🏅') + ' ' +
                            DB_Utils.escapeHtml(b.name) + '</div>';
                    }).join('')
                    : '<p class="empty-hint">No badges awarded.</p>') + '</div>';
            DB_Utils.setHtml('user-mydata-content', html);
        });
    },

    toggleMenu: function() {
        var menu = document.getElementById('user-menu');
        if (menu) menu.classList.toggle('hidden');
    },

    updateMenu: function(user) {
        DB_Utils.setText('menu-user-name',    user.nickname);
        DB_Utils.setText('menu-agent-number', 'Agent ' + user.agentNumber);
    }
};
