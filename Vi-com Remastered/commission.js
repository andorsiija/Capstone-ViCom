/**
 * commission.js — shared commission tracker (MySQL-backed via api.php)
 * Works for both client (role='customer') and artist (role='artist').
 * Reads role from vicom-session in localStorage.
 *
 * All commission data is now persisted in MySQL through api.php.
 * localStorage is only used for the session (login token).
 */

'use strict';

/* ── CONSTANTS ──────────────────────────────────────── */
const SESSION_KEY = 'vicom-session';
const API_BASE    = '../Account%20functions/api.php';

const STAGES = [
  { id: 'rough',  label: 'Rough Sketch',           icon: '✏️',  color: '#b8d4c8' },
  { id: 'clean',  label: 'Clean Sketch',            icon: '🖊️',  color: '#8abcaa' },
  { id: 'line',   label: 'Lineart',                 icon: '🖋️',  color: '#5da08a' },
  { id: 'color',  label: 'Coloring & Rendering',    icon: '🎨',  color: '#3f8061' },
  { id: 'final',  label: 'Final Review & Delivery', icon: '✅',  color: '#1d3027' },
];

/* ── SESSION ────────────────────────────────────────── */
function getSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)); }
  catch { return null; }
}

/* ── API HELPER ─────────────────────────────────────── */
async function api(action, method = 'GET', body = null, query = {}) {
  const params = new URLSearchParams({ action, ...query });
  const opts   = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res  = await fetch(`${API_BASE}?${params}`, opts);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'API error');
  return json;
}

/* ── HELPERS ────────────────────────────────────────── */
function initials(name) {
  return (name || '?').split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase();
}
function fmt(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return isNaN(d) ? ts : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
let _toastTimer;
function showToast(msg) {
  const t = document.querySelector('#toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ── COMMISSION REQUEST (from artist profile page) ─── */
async function startCommissionRequest(artistId, artistName) {
  const session = getSession();
  if (!session || session.role !== 'customer') {
    window.location.href = `auth.html?mode=signin&redirect=artist.html?id=${encodeURIComponent(artistId)}`;
    return;
  }
  const title = prompt(`Commission "${artistName}" — describe your request (title):`, 'My Commission');
  if (!title) return;
  const description = prompt('Add more detail (optional):') || '';

  try {
    await api('create_commission', 'POST', {
      artistId,
      clientId: session.userId,
      title: title.trim(),
      description: description.trim(),
    });
    showToast('✅ Commission request sent!');
    setTimeout(() => { window.location.href = 'commissions.html'; }, 1200);
  } catch (err) {
    alert('Could not send request: ' + err.message);
  }
}

/* ══════════════════════════════════════════════════════
   CommissionTracker class
══════════════════════════════════════════════════════ */
class CommissionTracker {
  constructor({ role }) {
    this.role         = role;
    this.session      = getSession();
    this.commissions  = [];
    this.active       = 0;
    this._feedbackIdx = 0;
    this._messagePollers = new Set();
  }

  /* ── PUBLIC: mount ───────────────────────────────── */
  async mount() {
    if (!this.session) { window.location.href = '../LandingPage/index.html'; return; }

    await this._load();
    this._renderSidebar();
    if (this.commissions.length) this._renderMain();
    this._bindFeedbackModal();
  }

  /* ── LOAD commissions from DB ─────────────────────── */
  async _load() {
    try {
      const res = await api('commissions', 'GET', null, {
        userId: this.session.userId,
        role:   this.role,
      });
      this.commissions = res.commissions || [];
    } catch (err) {
      console.error('Failed to load commissions:', err);
      this.commissions = [];
    }
  }

  /* ── RENDER SIDEBAR ──────────────────────────────── */
  _renderSidebar() {
    const el = document.querySelector('#comm-sidebar');
    if (!el) return;

    const pending = this.commissions.filter(c => c.status === 'pending');
    const active  = this.commissions.filter(c => c.status === 'active');
    const done    = this.commissions.filter(c => c.status === 'done');

    let html = '';

    if (pending.length) {
      html += `<p class="comm-section-label">PENDING</p>`;
      pending.forEach((c, i) => {
        const idx = this.commissions.indexOf(c);
        html += this._sidebarItem(c, idx);
      });
    }
    if (active.length) {
      html += `<p class="comm-section-label">ACTIVE</p>`;
      active.forEach(c => {
        html += this._sidebarItem(c, this.commissions.indexOf(c));
      });
    }
    if (done.length) {
      html += `<p class="comm-section-label">COMPLETED</p>`;
      done.forEach(c => {
        html += this._sidebarItem(c, this.commissions.indexOf(c));
      });
    }
    if (!html) {
      html = `<p class="comm-empty">No commissions yet.</p>`;
    }

    el.innerHTML = html;
    el.querySelectorAll('.comm-item').forEach(item => {
      item.addEventListener('click', () => {
        this.active = parseInt(item.dataset.idx);
        el.querySelectorAll('.comm-item').forEach(x => x.classList.remove('selected'));
        item.classList.add('selected');
        this._renderMain();
      });
    });

    // auto-select first
    const first = el.querySelector('.comm-item');
    if (first) {
      first.classList.add('selected');
      this.active = parseInt(first.dataset.idx);
    }
  }

  _sidebarItem(c, idx) {
    const name  = this.role === 'artist' ? c.clientName : c.artistName;
    const dot   = c.status === 'pending' ? ' dot-pending' : (c.status === 'active' ? ' dot-active' : '');
    return `<div class="comm-item${idx === this.active ? ' selected' : ''}" data-idx="${idx}">
      <span class="comm-avatar">${initials(name)}</span>
      <div class="comm-item-info">
        <strong>${c.title}</strong>
        <small>from ${name}</small>
      </div>
      ${c.status === 'pending' ? `<span class="status-badge pending">PENDING</span>` : `<span class="comm-dot${dot}"></span>`}
    </div>`;
  }

  /* ── RENDER MAIN PANEL ───────────────────────────── */
  _renderMain() {
    this._stopMessagePolling();
    const el = document.querySelector('#comm-main');
    if (!el || !this.commissions.length) { if (el) el.innerHTML = ''; return; }

    const c = this.commissions[this.active];
    if (!c) return;

    const partner = this.role === 'artist' ? c.clientName : c.artistName;
    el.innerHTML = '';

    /* header */
    const header = document.createElement('div');
    header.className = 'comm-header';
    header.innerHTML = `
      <div class="comm-header-copy">
        <h2>${c.title}</h2>
        <p>Client: ${c.clientName} · ${c.description || 'No description'}</p>
      </div>
      <span class="status-pill status-${c.status}">
        <span class="status-dot" style="background:${c.status === 'active' ? '#3f8061' : c.status === 'pending' ? '#d8b86a' : '#8aa396'}"></span>
        ${this._statusLabel(c)}
      </span>`;
    el.appendChild(header);

    /* ── PENDING: accept/decline card ── */
    if (c.status === 'pending' && this.role === 'artist') {
      const card = document.createElement('div');
      card.className = 'new-request-card';
      card.innerHTML = `
        <div class="request-icon">📬</div>
        <h3>New commission request</h3>
        <p>${c.clientName} has sent you a commission request.</p>
        ${c.description ? `<blockquote>${c.description}</blockquote>` : ''}
        <div class="request-actions">
          <button class="btn-approve accept-btn">Accept commission</button>
          <button class="btn-revise decline-btn">Decline</button>
        </div>`;
      card.querySelector('.accept-btn').addEventListener('click', () => this._acceptCommission(c));
      card.querySelector('.decline-btn').addEventListener('click', () => this._declineCommission(c));
      el.appendChild(card);
      return;
    }

    if (c.status === 'pending' && this.role === 'customer') {
      const card = document.createElement('div');
      card.className = 'new-request-card';
      card.innerHTML = `<div class="request-icon">⏳</div>
        <h3>Waiting for artist</h3>
        <p>${c.artistName} has not yet accepted your request.</p>`;
      el.appendChild(card);
      return;
    }

    /* ── ACTIVE: stage tracker ── */
    const stageData     = c.stageData || Array(5).fill({ uploads: [], note: null, comments: [] });
    const stageStatus   = c.stageStatus   || [false,false,false,false,false];
    const clientApproval= c.clientApproval|| [false,false,false,false,false];
    const currentStage  = c.currentStage  || 0;

    /* ── horizontal stage track (numbered segments) ── */
    const track = document.createElement('div');
    track.className = 'stage-track';
    STAGES.forEach((s, i) => {
      const done = clientApproval[i];
      const cur  = i === currentStage && c.status === 'active';
      const cls  = done ? 'done' : cur ? 'active' : 'upcoming';
      track.innerHTML += `<div class="stage-seg ${cls}">
        <div class="stage-num">${String(i + 1).padStart(2, '0')}</div>
        <div class="stage-name">${s.label}</div>
        ${done ? '<span class="stage-check">✓</span>' : ''}
      </div>`;
    });
    el.appendChild(track);

    /* stage list */
    const list = document.createElement('div');
    list.className = 'stage-list';

    STAGES.forEach((stage, i) => {
      const isCurrent  = i === currentStage && c.status === 'active';
      const isCompleted= clientApproval[i];
      const isFuture   = !isCurrent && !isCompleted;
      const stageD     = stageData[i] || { uploads: [], note: null, comments: [] };
      const markedReady= stageStatus[i];
      const approved   = clientApproval[i];
      const hasUploads = (stageD.uploads || []).length > 0;

      const card = document.createElement('div');
      card.className = `stage-card${isCurrent ? ' current' : isCompleted ? ' completed' : ' future'}`;
      const hdr = document.createElement('div');
      hdr.className = 'stage-header';
      hdr.innerHTML = `<span class="stage-icon">${stage.icon}</span>
        <strong>${stage.label}</strong>
        ${approved ? '<span class="stage-badge approved">✓ Approved</span>' :
          markedReady ? '<span class="stage-badge ready">Ready for review</span>' :
          isCurrent ? '<span class="stage-badge in-progress">In Progress</span>' :
          isFuture ? '<span class="stage-badge future">Upcoming</span>' : ''}`;
      card.appendChild(hdr);

      if (isFuture && !hasUploads) { list.appendChild(card); return; }

      const body = document.createElement('div');
      body.className = 'stage-body';

      /* uploads */
      const canEditUploads = this.role === 'artist' && isCurrent && !approved;
      if (hasUploads) {
        const gallery = document.createElement('div');
        gallery.className = 'upload-gallery';
        (stageD.uploads || []).forEach((u, uIdx) => {
          const thumb = document.createElement('div');
          thumb.className = 'upload-thumb';
          thumb.innerHTML = `<img src="${u.src}" alt="${u.name}" loading="lazy">
            <small>${u.name} · ${fmt(u.uploaded)}</small>
            ${canEditUploads ? `<button type="button" class="upload-remove" title="Remove this file">✕</button>` : ''}`;
          if (canEditUploads) {
            thumb.querySelector('.upload-remove').addEventListener('click', () =>
              this._removeUpload(c, i, uIdx, stageData, stageD));
          }
          gallery.appendChild(thumb);
        });
        body.appendChild(gallery);
      }
      if (approved && hasUploads) {
        const lockNote = document.createElement('p');
        lockNote.className = 'upload-locked-note';
        lockNote.innerHTML = '🔒 The client approved this stage — the submitted file(s) are now locked and can\'t be changed.';
        body.appendChild(lockNote);
      }

      /* artist note */
      if (stageD.note) {
        const noteEl = document.createElement('div');
        noteEl.className = 'artist-note';
        noteEl.innerHTML = `<strong>Artist note</strong><p>${stageD.note}</p>`;
        body.appendChild(noteEl);
      }

      /* ── messages displayed as note/feedback blocks ── */
      const chatWrap = document.createElement('div');
      chatWrap.className = 'stage-chat-feed';
      this._startMessagePolling(c.id, chatWrap, this.session.userId);
      body.appendChild(chatWrap);

      /* ── message input ── */
      const msgForm = document.createElement('div');
      msgForm.className = 'stage-msg-form';
      msgForm.innerHTML = `
        <textarea class="stage-msg-input" placeholder="Add a message…" rows="2"></textarea>
        <div class="stage-msg-actions">
          <button class="btn-primary send-msg">Send message</button>
          ${this.role === 'artist' ? `<button class="btn-secondary edit-note-btn">${stageD.note ? 'Edit note' : 'Edit note'}</button>` : ''}
        </div>`;
      msgForm.querySelector('.send-msg').addEventListener('click', async () => {
        const ta  = msgForm.querySelector('textarea');
        const txt = ta.value.trim();
        if (!txt) return;
        try {
          await api('send_message', 'POST', {
            commissionId: c.id,
            senderId:     this.session.userId,
            senderName:   this.session.name || this.session.email,
            senderRole:   this.role,
            message:      txt,
          });
          ta.value = '';
          showToast('💬 Message sent');
          this._refreshMessages(c.id, chatWrap);
        } catch (err) { showToast('Error: ' + err.message); }
      });
      if (this.role === 'artist') {
        msgForm.querySelector('.edit-note-btn')?.addEventListener('click', () =>
          this._toggleNoteForm(body, i, c, stageD.note || '', stageData, stageStatus, clientApproval));
      }
      body.appendChild(msgForm);

      /* ARTIST actions — only while this stage hasn't been client-approved yet */
      if (this.role === 'artist' && isCurrent && !approved) {
        const actionRow = document.createElement('div');
        actionRow.className = 'action-row';

        const uploadLabel = document.createElement('label');
        uploadLabel.className = 'btn-primary';
        uploadLabel.innerHTML = `📎 ${hasUploads ? 'Replace / add file' : 'Upload artwork'}`;
        const fileInput = document.createElement('input');
        fileInput.type = 'file'; fileInput.accept = 'image/*'; fileInput.style.display = 'none';
        fileInput.addEventListener('change', e => this._handleUpload(e, c, i, stageD, stageData, stageStatus, clientApproval));
        uploadLabel.appendChild(fileInput);
        actionRow.appendChild(uploadLabel);

        const noteBtn = document.createElement('button');
        noteBtn.className = 'btn-secondary';
        noteBtn.textContent = stageD.note ? 'Edit note' : '+ Add note';
        noteBtn.addEventListener('click', () =>
          this._toggleNoteForm(body, i, c, stageD.note || '', stageData, stageStatus, clientApproval));
        actionRow.appendChild(noteBtn);

        if (hasUploads && !markedReady) {
          const readyBtn = document.createElement('button');
          readyBtn.className = 'btn-approve';
          readyBtn.innerHTML = 'Submit for review ↗';
          readyBtn.addEventListener('click', () =>
            this._markStageReady(c, i, stageData, stageStatus, clientApproval));
          actionRow.appendChild(readyBtn);
        } else if (markedReady) {
          const wait = document.createElement('span');
          wait.className = 'waiting-label';
          wait.textContent = '⏳ Waiting for client approval… you can still swap the file until they confirm.';
          actionRow.appendChild(wait);
        }
        body.appendChild(actionRow);
      } else if (this.role === 'artist' && isCompleted) {
        const locked = document.createElement('p');
        locked.className = 'stage-locked-msg';
        locked.textContent = '🔒 Approved and locked.';
        body.appendChild(locked);
      }

      card.appendChild(body);

      /* CLIENT review bar */
      if (this.role === 'customer' && hasUploads) {
        const bar = document.createElement('div');
        bar.className = 'review-bar';
        if (approved) {
          bar.innerHTML = '<p class="approved">✓ You approved this stage.</p>';
        } else if (markedReady) {
          bar.innerHTML = `<p>The artist marked this stage ready for your review.</p>
            <button class="btn-revise">Request revision</button>
            <button class="btn-approve">Approve →</button>`;
          bar.querySelector('.btn-approve').addEventListener('click', () =>
            this._approveStage(c, i, stageData, stageStatus, clientApproval, currentStage));
          bar.querySelector('.btn-revise').addEventListener('click', () => {
            this._feedbackIdx = i;
            this._feedbackCommission = c;
            this._feedbackStageData  = stageData;
            this._feedbackStageStatus= stageStatus;
            this._feedbackClientApproval = clientApproval;
            document.querySelector('#feedback-overlay')?.classList.add('open');
          });
        } else {
          bar.innerHTML = `<p>Work in progress — you'll be able to approve once the artist submits.</p>`;
        }
        card.appendChild(bar);
      }

      list.appendChild(card);
    });

    el.appendChild(list);
  }

  /* ── LOAD MESSAGES ───────────────────────────────── */
  _stopMessagePolling() {
    this._messagePollers.forEach(timer => clearInterval(timer));
    this._messagePollers.clear();
  }

  _startMessagePolling(commissionId, container, currentUserId) {
    this._refreshMessages(commissionId, container, currentUserId);
    const timer = setInterval(() => {
      if (document.body.contains(container)) {
        this._refreshMessages(commissionId, container, currentUserId);
      }
    }, 2000);
    this._messagePollers.add(timer);
  }

  async _refreshMessages(commissionId, container, currentUserId = this.session.userId) {
    try {
      const res = await api('messages', 'GET', null, { commissionId, _t: Date.now() });
      const msgs = res.messages || [];
      if (!msgs.length) { container.innerHTML = ''; return; }
      container.innerHTML = msgs.map(m => {
        const isArtist = m.senderRole === 'artist';
        const label    = isArtist ? 'ARTIST NOTE' : 'CLIENT FEEDBACK';
        const cls      = isArtist ? 'note-block-artist' : 'note-block-client';
        return `<div class="note-block ${cls}">
          <span class="note-label">${label}</span>
          <p class="note-text">${m.message}</p>
          <span class="note-ts">${fmt(m.createdAt)}</span>
        </div>`;
      }).join('');
      // mark as read
      if (msgs.some(m => !m.isRead && m.senderId !== this.session.userId)) {
        api('mark_messages_read', 'POST', { commissionId, userId: this.session.userId });
      }
    } catch {}
  }

  /* ── ACCEPT / DECLINE ────────────────────────────── */
  async _acceptCommission(c) {
    try {
      await api('update_commission_status', 'POST', { id: c.id, status: 'active' });
      showToast('✅ Commission accepted!');
      await this._load();
      this._renderSidebar();
      this._renderMain();
    } catch (err) { showToast('Error: ' + err.message); }
  }

  async _declineCommission(c) {
    if (!confirm('Decline this commission request?')) return;
    try {
      await api('update_commission_status', 'POST', { id: c.id, status: 'declined' });
      showToast('Commission declined.');
      await this._load();
      this.active = 0;
      this._renderSidebar();
      this._renderMain();
    } catch (err) { showToast('Error: ' + err.message); }
  }

  /* ── UPLOAD ──────────────────────────────────────── */
  _handleUpload(event, c, stageIdx, stageD, stageData, stageStatus, clientApproval) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const uploads = [...(stageD.uploads || []), {
        name: file.name.replace(/\.[^.]+$/, ''),
        src: reader.result,
        uploaded: new Date().toISOString().slice(0, 10),
      }];
      const newStageData = [...stageData];
      newStageData[stageIdx] = { ...stageD, uploads };
      try {
        await api('update_commission_stage', 'POST', { id: c.id, stageData: newStageData });
        showToast('📎 File uploaded');
        await this._load();
        this._renderSidebar();
        this._renderMain();
      } catch (err) { showToast('Upload failed: ' + err.message); }
    };
    reader.readAsDataURL(file);
  }

  /* ── REMOVE UPLOAD (only allowed before client approval) ─── */
  async _removeUpload(c, stageIdx, uploadIdx, stageData, stageD) {
    if (!confirm('Remove this file? The client will no longer see it.')) return;
    const uploads = (stageD.uploads || []).filter((_, i) => i !== uploadIdx);
    const newStageData = [...stageData];
    newStageData[stageIdx] = { ...stageD, uploads };
    try {
      await api('update_commission_stage', 'POST', { id: c.id, stageData: newStageData });
      showToast('🗑️ File removed');
      await this._load();
      this._renderSidebar();
      this._renderMain();
    } catch (err) { showToast('Error: ' + err.message); }
  }

  /* ── NOTE FORM ───────────────────────────────────── */
  _toggleNoteForm(body, stageIdx, c, existing, stageData, stageStatus, clientApproval) {
    const existingForm = body.querySelector('.note-form');
    if (existingForm) { existingForm.remove(); return; }
    const form = document.createElement('div');
    form.className = 'note-form';
    form.innerHTML = `<textarea placeholder="Write a note for your client…">${existing}</textarea>
      <div style="display:flex;gap:8px">
        <button class="btn-primary save-note">Save note</button>
        <button class="btn-secondary cancel-note">Cancel</button>
      </div>`;
    form.querySelector('.cancel-note').addEventListener('click', () => form.remove());
    form.querySelector('.save-note').addEventListener('click', async () => {
      const txt = form.querySelector('textarea').value.trim();
      if (!txt) { showToast('Write something first'); return; }
      const newStageData = [...stageData];
      newStageData[stageIdx] = { ...stageData[stageIdx], note: txt };
      try {
        await api('update_commission_stage', 'POST', { id: c.id, stageData: newStageData });
        showToast('📝 Note saved');
        await this._load();
        this._renderMain();
      } catch (err) { showToast('Error: ' + err.message); }
    });
    const actionRow = body.querySelector('.action-row');
    actionRow ? body.insertBefore(form, actionRow) : body.appendChild(form);
  }

  /* ── MARK STAGE READY ────────────────────────────── */
  async _markStageReady(c, stageIdx, stageData, stageStatus, clientApproval) {
    const newStatus = [...stageStatus];
    newStatus[stageIdx] = true;
    try {
      await api('update_commission_stage', 'POST', {
        id: c.id,
        stageStatus: newStatus,
        notify: {
          userId: c.clientId,
          type: 'stage_submitted',
          text: `${c.artistName} submitted stage "${STAGES[stageIdx].label}" for your review on "${c.title}"`
        }
      });
      showToast('✅ Stage submitted — waiting for client approval');
      await this._load();
      this._renderSidebar();
      this._renderMain();
    } catch (err) { showToast('Error: ' + err.message); }
  }

  /* ── APPROVE STAGE ───────────────────────────────── */
  async _approveStage(c, stageIdx, stageData, stageStatus, clientApproval, currentStage) {
    const newApproval = [...clientApproval];
    newApproval[stageIdx] = true;
    let newStage = currentStage;
    if (stageIdx >= currentStage && currentStage < STAGES.length - 1) newStage = stageIdx + 1;
    const allDone = newApproval.every(Boolean);
    try {
      await api('update_commission_stage', 'POST', {
        id: c.id,
        clientApproval: newApproval,
        currentStage:   newStage,
        status:         allDone ? 'done' : undefined,
        notify: {
          userId: c.artistId,
          type: 'stage_approved',
          text: `${c.clientName} approved stage "${STAGES[stageIdx].label}" on "${c.title}"`
        }
      });
      showToast('✅ Stage approved! Moving to next step.');
      await this._load();
      this._renderSidebar();
      this._renderMain();
    } catch (err) { showToast('Error: ' + err.message); }
  }

  /* ── FEEDBACK MODAL ──────────────────────────────── */
  _bindFeedbackModal() {
    const overlay = document.querySelector('#feedback-overlay');
    if (!overlay) return;
    const close = () => overlay.classList.remove('open');
    overlay.querySelector('#feedback-close')?.addEventListener('click', close);
    overlay.querySelector('#feedback-cancel')?.addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    overlay.querySelector('#feedback-send')?.addEventListener('click', async () => {
      const text = overlay.querySelector('#feedback-text')?.value.trim();
      if (!text) { showToast('Please write your feedback first'); return; }
      const c   = this._feedbackCommission;
      const idx = this._feedbackIdx;
      const sd  = this._feedbackStageData;
      const ss  = this._feedbackStageStatus;

      // Send as a message
      try {
        await api('send_message', 'POST', {
          commissionId: c.id,
          senderId:     this.session.userId,
          senderName:   this.session.name || this.session.email,
          senderRole:   this.role,
          message:      `[Revision request for ${STAGES[idx].label}]: ${text}`,
        });
        // un-mark ready
        const newSS = [...(ss || [false,false,false,false,false])];
        newSS[idx] = false;
        await api('update_commission_stage', 'POST', {
          id: c.id,
          stageStatus: newSS,
          notify: {
            userId: c.artistId,
            type: 'revision_requested',
            text: `${c.clientName} requested a revision on "${STAGES[idx].label}" for "${c.title}"`
          }
        });
        close();
        showToast('💬 Revision request sent to artist');
        await this._load();
        this._renderSidebar();
        this._renderMain();
      } catch (err) { showToast('Error: ' + err.message); }
    });
  }

  /* ── STATUS LABEL ────────────────────────────────── */
  _statusLabel(c) {
    if (c.status === 'pending')  return 'Pending artist acceptance';
    if (c.status === 'declined') return 'Declined';
    if (c.status === 'done')     return '✓ Completed';
    const stageName = STAGES[c.currentStage]?.label || '';
    return `In progress · ${stageName}`;
  }
}

window.CommissionTracker = CommissionTracker;
window.startCommissionRequest = startCommissionRequest;
