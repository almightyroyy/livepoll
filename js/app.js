/**
 * app.js — LivePoll main application controller
 */
const App = {
  role: null,           // 'host' | 'participant'
  currentCode: null,
  pollData: null,
  listeners: [],        // cleanup functions
  myAnswer: null,

  // ── Init ──────────────────────────────────────────────

  async init() {
    await Sync.init();

    // Check URL for ?join=CODE
    const params = new URLSearchParams(window.location.search);
    const code = params.get('join');
    if (code) {
      window.history.replaceState({}, '', window.location.pathname);
      setTimeout(() => this.startJoin(code), 200);
    } else {
      this.showScreen('home');
    }

    this._bindHome();
    this._bindCreate();
    this._bindHost();
    this._bindJoin();
    this._bindMisc();
  },

  // ── Screen Management ────────────────────────────────

  showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById(`screen-${id}`);
    if (el) el.classList.add('active');
  },

  // ── Home ─────────────────────────────────────────────

  _bindHome() {
    document.getElementById('btnCreatePoll').onclick = () => this.showScreen('create');

    document.getElementById('btnHomeJoin').onclick = () => {
      const code = document.getElementById('homeJoinCode').value.trim();
      if (code.length === 6) this.startJoin(code);
      else this.showScreen('join');
    };

    document.getElementById('homeJoinCode').addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('btnHomeJoin').click();
    });

    document.getElementById('homeJoinCode').addEventListener('input', e => {
      e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
    });
  },

  // ── Create ────────────────────────────────────────────

  _bindCreate() {
    document.getElementById('btnBackFromCreate').onclick = () => this.showScreen('home');

    document.getElementById('btnAddQuestion').onclick = () => this._addQuestion();

    document.getElementById('btnLaunchPoll').onclick = () => this.launchPoll();

    // Start with one question
    this._addQuestion();
  },

  _addQuestion() {
    const list = document.getElementById('questionsList');
    const idx  = list.children.length + 1;
    const card = document.createElement('div');
    card.className = 'question-card';
    card.dataset.idx = idx;
    card.innerHTML = `
      <div class="question-card-header">
        <span class="question-number">Question ${idx}</span>
        <button class="btn-remove-q" title="Remove">×</button>
      </div>
      <div class="form-section">
        <input type="text" class="input-field q-text" placeholder="Ask a question…" maxlength="200">
      </div>
      <div class="options-list"></div>
      <button class="btn-add-option">+ Add option</button>
    `;

    card.querySelector('.btn-remove-q').onclick = () => {
      card.remove();
      this._renumberQuestions();
    };

    card.querySelector('.btn-add-option').onclick = () => {
      this._addOption(card.querySelector('.options-list'));
    };

    // Add 2 default options
    this._addOption(card.querySelector('.options-list'), 'Option A');
    this._addOption(card.querySelector('.options-list'), 'Option B');

    list.appendChild(card);
  },

  _addOption(list, val = '') {
    const row = document.createElement('div');
    row.className = 'option-row';
    row.innerHTML = `
      <input type="text" class="option-input" placeholder="Option…" value="${val}" maxlength="100">
      <button class="btn-remove-opt" title="Remove">×</button>
    `;
    row.querySelector('.btn-remove-opt').onclick = () => row.remove();
    list.appendChild(row);
  },

  _renumberQuestions() {
    document.querySelectorAll('.question-card .question-number').forEach((el, i) => {
      el.textContent = `Question ${i + 1}`;
    });
  },

  _collectQuestions() {
    const cards = document.querySelectorAll('.question-card');
    const questions = [];
    for (const card of cards) {
      const text = card.querySelector('.q-text').value.trim();
      const options = [...card.querySelectorAll('.option-input')]
        .map(i => i.value.trim()).filter(Boolean);
      if (!text) { alert('Please fill in all question texts.'); return null; }
      if (options.length < 2) { alert('Each question needs at least 2 options.'); return null; }
      questions.push({ text, options });
    }
    if (!questions.length) { alert('Add at least one question.'); return null; }
    return questions;
  },

  async launchPoll() {
    const title = document.getElementById('pollTitle').value.trim() || 'Untitled Poll';
    const questions = this._collectQuestions();
    if (!questions) return;

    const btn = document.getElementById('btnLaunchPoll');
    btn.textContent = 'Launching…'; btn.disabled = true;

    try {
      const code = await Poll.create(title, questions);
      this.role = 'host';
      this.currentCode = code;
      this.pollData = await Poll.get(code);
      this._openLobby();
    } catch (e) {
      console.error(e);
      alert('Failed to create poll. Check Firebase setup.');
    } finally {
      btn.textContent = 'Launch Poll →'; btn.disabled = false;
    }
  },

  // ── LOBBY (Host) ──────────────────────────────────────

  _openLobby() {
    const code = this.currentCode;
    document.getElementById('lobbyPollTitle').textContent = this.pollData.title;
    document.getElementById('lobbyRoomCode').textContent = code;

    const url = `${location.origin}${location.pathname}?join=${code}`;
    document.getElementById('lobbyUrl').textContent = url;

    const qrEl = document.getElementById('lobbyQr');
    qrEl.innerHTML = '';
    if (typeof QRCode !== 'undefined') {
      new QRCode(qrEl, { text: url, width: 140, height: 140, colorDark: '#0f0f0f', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
    }

    // Listen for participant count
    const off = Sync.on(`polls/${code}/participants`, data => {
      const count = data ? Object.keys(data).length : 0;
      document.getElementById('lobbyParticipantCount').textContent = count;
    });
    this.listeners.push(off);

    this.showScreen('lobby');
  },

  _bindHost() {
    document.getElementById('btnStartPoll').onclick = async () => {
      await Poll.setQuestion(this.currentCode, 0);
      this._openHostQuestion(0);
    };

    document.getElementById('btnHostReveal').onclick = async () => {
      await Poll.showResults(this.currentCode);
    };

    document.getElementById('btnHostNext').onclick = async () => {
      const next = (this.pollData.currentQuestion || 0) + 1;
      if (next >= this.pollData.questions.length) {
        await Poll.endPoll(this.currentCode);
        this.showScreen('ended');
      } else {
        this.pollData.currentQuestion = next;
        await Poll.setQuestion(this.currentCode, next);
        this._openHostQuestion(next);
      }
    };
  },

  _openHostQuestion(idx) {
    const q    = this.pollData.questions[idx];
    const code = this.currentCode;
    const total = this.pollData.questions.length;

    document.getElementById('hostProgress').textContent = `Q${idx + 1} of ${total}`;
    document.getElementById('hostQuestionText').textContent = q.text;
    document.getElementById('hostRoomCode').textContent = `Room: ${code}`;
    document.getElementById('hostVoteCount').textContent = '0';

    const isLast = idx === total - 1;
    document.getElementById('btnHostNext').textContent = isLast ? 'End Poll' : 'Next →';
    document.getElementById('btnHostReveal').style.display = 'inline-flex';

    // Clear old listeners
    this.listeners.forEach(off => typeof off === 'function' && off());
    this.listeners = [];

    // Live vote tally
    const off = Sync.on(`polls/${code}/responses/${q.id}`, data => {
      const counts = Poll.tallyVotes(data, q.options);
      const total  = Object.values(counts).reduce((a, b) => a + b, 0);
      document.getElementById('hostVoteCount').textContent = total;
      Charts.render(document.getElementById('hostChart'), q.options, counts, total || 1);
    });
    this.listeners.push(off);

    this.showScreen('host-active');
  },

  // ── JOIN (Participant) ────────────────────────────────

  _bindJoin() {
    document.getElementById('btnJoinBack').onclick = () => this.showScreen('home');

    document.getElementById('btnJoinPoll').onclick = async () => {
      const code = document.getElementById('joinCode').value.trim();
      const btn  = document.getElementById('btnJoinPoll');
      btn.textContent = 'Joining…'; btn.disabled = true;
      await this.startJoin(code);
      btn.textContent = 'Join →'; btn.disabled = false;
    };

    document.getElementById('joinCode').addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('btnJoinPoll').click();
    });

    document.getElementById('joinCode').addEventListener('input', e => {
      e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
      document.getElementById('joinError').style.display = 'none';
    });
  },

  async startJoin(code) {
    if (!code || code.length !== 6) {
      this.showScreen('join');
      return;
    }

    if (!Sync.db) await Sync.init();
    const poll = await Poll.get(code);
    if (!poll || poll.status === 'ended') {
      document.getElementById('joinError').style.display = 'block';
      document.getElementById('joinCode').value = code;
      this.showScreen('join');
      return;
    }

    this.role = 'participant';
    this.currentCode = code;
    this.pollData = poll;
    this.myAnswer = null;

    await Poll.joinParticipant(code);

    // Watch poll status
    const off = Sync.on(`polls/${code}`, data => {
      if (!data) return;
      this.pollData = data;
      this._handlePollChange(data);
    });
    this.listeners.push(off);

    document.getElementById('waitingRoomCode').textContent = `Room: ${code}`;
    this.showScreen('waiting');
  },

  _handlePollChange(poll) {
    if (this.role !== 'participant') return;

    if (poll.status === 'ended') {
      this.showScreen('ended');
      return;
    }

    if (poll.status === 'lobby') {
      this.showScreen('waiting');
      return;
    }

    const idx = poll.currentQuestion || 0;
    const q   = poll.questions[idx];

    if (poll.status === 'active') {
      this.myAnswer = null;
      this._openVote(q, idx, poll.questions.length);
    }

    if (poll.status === 'showing_results') {
      this._showParticipantResults(q, poll.responses?.[q.id]);
    }
  },

  _openVote(q, idx, total) {
    document.getElementById('voteProgress').textContent = `Q${idx + 1} of ${total}`;
    document.getElementById('voteRoom').textContent = `Room: ${this.currentCode}`;
    document.getElementById('voteQuestionText').textContent = q.text;

    const container = document.getElementById('voteOptions');
    container.innerHTML = '';

    q.options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'vote-option';
      btn.textContent = opt;
      btn.onclick = async () => {
        if (this.myAnswer) return;
        this.myAnswer = opt;
        container.querySelectorAll('.vote-option').forEach(b => {
          b.classList.toggle('selected', b.textContent === opt);
          b.disabled = true;
        });
        await Poll.submitVote(this.currentCode, q.id, opt);
        setTimeout(() => this.showScreen('voted'), 400);
      };
      container.appendChild(btn);
    });

    this.showScreen('vote');
  },

  _showParticipantResults(q, responses) {
    const counts = Poll.tallyVotes(responses, q.options);
    const total  = Object.values(counts).reduce((a, b) => a + b, 0);

    document.getElementById('pResultsQuestion').textContent = q.text;

    const waiting = document.getElementById('pResultsWaiting');
    const isLast  = (this.pollData.currentQuestion || 0) >= (this.pollData.questions.length - 1);
    waiting.textContent = isLast ? 'Poll ending soon…' : 'Waiting for next question…';

    Charts.render(
      document.getElementById('pResultsChart'),
      q.options, counts, total || 1,
      this.myAnswer
    );

    this.showScreen('p-results');
  },

  // ── Misc ──────────────────────────────────────────────

  _bindMisc() {
    document.getElementById('btnEndedHome').onclick = () => {
      this.listeners.forEach(off => typeof off === 'function' && off());
      this.listeners = [];
      this.role = null; this.currentCode = null; this.pollData = null;
      // Reset create screen
      document.getElementById('questionsList').innerHTML = '';
      document.getElementById('pollTitle').value = '';
      this._addQuestion();
      this.showScreen('home');
    };
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
