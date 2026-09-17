'use strict';

const SESSION_KEY = 'vicom-session';
const API_BASE = '../Account%20functions/api.php';
const STAGES = [
  { id:'rough', label:'Rough Sketch', icon:'[1]' },
  { id:'clean', label:'Clean Sketch', icon:'[2]' },
  { id:'line', label:'Lineart', icon:'[3]' },
  { id:'color', label:'Coloring', icon:'[4]' },
  { id:'final', label:'Final Delivery', icon:'[5]' }
];

function session() { try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; } }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char])); }
function initials(value) { return (value || '?').split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(); }
function formatDate(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-US', { month:'short', day:'numeric' }); }
async function api(action, method = 'GET', body = null, query = {}) {
  const params = new URLSearchParams({ action, ...query });
  const options = { method, headers:{ 'Content-Type':'application/json' } };
  if (body) options.body = JSON.stringify(body);
  const response = await fetch(`${API_BASE}?${params}`, options);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Request failed.');
  return result;
}
function toast(message) { const element = document.querySelector('#toast'); if (!element) return; element.textContent = message; element.classList.add('show'); window.clearTimeout(toast.timer); toast.timer = window.setTimeout(() => element.classList.remove('show'), 2400); }

class CommissionTracker {
  constructor({ role }) { this.role = role; this.user = session(); this.commissions = []; this.active = 0; this.pollers = []; this.feedback = null; }

  async mount() {
    if (!this.user) { window.location.href = '../Account%20functions/auth.html?mode=signin'; return; }
    document.querySelector('#logout')?.addEventListener('click', () => { localStorage.removeItem(SESSION_KEY); window.location.href = '../LandingPage/index.html'; });
    await this.load();
    this.renderSidebar();
    this.renderMain();
    this.bindFeedback();
  }

  async load() {
    try { const result = await api('commissions', 'GET', null, { userId:this.user.userId, role:this.role }); this.commissions = result.commissions || []; }
    catch (error) { this.commissions = []; toast(error.message); }
  }

  renderSidebar() {
    const sidebar = document.querySelector('#comm-sidebar');
    if (!sidebar) return;
    if (!this.commissions.length) { sidebar.innerHTML = '<p class="comm-empty">No commissions yet.</p>'; return; }
    const groups = [['PENDING', 'pending'], ['ACTIVE', 'active'], ['COMPLETED', 'done']];
    sidebar.innerHTML = groups.map(([label, status]) => {
      const entries = this.commissions.map((commission, index) => ({ commission, index })).filter(({ commission }) => commission.status === status);
      if (!entries.length) return '';
      return `<p class="comm-section-label">${label}</p>${entries.map(({ commission, index }) => this.sidebarItem(commission, index)).join('')}`;
    }).join('');
    sidebar.querySelectorAll('.comm-item').forEach((item) => item.addEventListener('click', () => { this.active = Number(item.dataset.index); this.renderSidebar(); this.renderMain(); }));
    sidebar.querySelector(`.comm-item[data-index="${this.active}"]`)?.classList.add('selected');
    if (!sidebar.querySelector('.selected')) { this.active = Number(sidebar.querySelector('.comm-item')?.dataset.index || 0); sidebar.querySelector('.comm-item')?.classList.add('selected'); }
  }

  sidebarItem(commission, index) {
    const partner = this.role === 'artist' ? commission.clientName : commission.artistName;
    return `<button class="comm-item${index === this.active ? ' selected' : ''}" data-index="${index}" type="button"><span class="comm-avatar">${escapeHtml(initials(partner))}</span><span class="comm-item-info"><strong>${escapeHtml(commission.title)}</strong><small>from ${escapeHtml(partner)}</small></span>${commission.status === 'pending' ? '<span class="status-badge">Pending</span>' : `<span class="comm-dot${commission.status === 'active' ? ' dot-active' : ''}"></span>`}</button>`;
  }

  renderMain() {
    this.pollers.forEach((timer) => clearInterval(timer)); this.pollers = [];
    const main = document.querySelector('#comm-main');
    const commission = this.commissions[this.active];
    if (!main) return;
    if (!commission) { main.innerHTML = '<div class="comm-empty">Select a commission to begin.</div>'; return; }
    main.innerHTML = `<header class="comm-header"><div><h1>${escapeHtml(commission.title)}</h1><p>Client: ${escapeHtml(commission.clientName)}${commission.description ? ` - ${escapeHtml(commission.description)}` : ''}</p></div><span class="status-pill status-${commission.status}"><span class="status-dot"></span>${escapeHtml(this.statusLabel(commission))}</span></header>`;
    if (commission.status === 'pending') { main.insertAdjacentHTML('beforeend', this.pendingMarkup(commission)); this.bindPending(commission); return; }
    const approvals = commission.clientApproval || Array(5).fill(false);
    const statuses = commission.stageStatus || Array(5).fill(false);
    const stageData = commission.stageData || Array.from({ length:5 }, () => ({ uploads:[], note:null }));
    const current = commission.currentStage || 0;
    main.insertAdjacentHTML('beforeend', `<div class="stage-track">${STAGES.map((stage, index) => `<div class="stage-seg ${approvals[index] ? 'done' : index === current && commission.status === 'active' ? 'active' : ''}"><div class="stage-num">${String(index + 1).padStart(2, '0')}</div><div class="stage-name">${stage.label}</div></div>`).join('')}</div><div class="stage-list"></div>`);
    const list = main.querySelector('.stage-list');
    STAGES.forEach((stage, index) => list.appendChild(this.stageCard(commission, stage, index, stageData[index] || {}, statuses[index], approvals[index], current)));
  }

  pendingMarkup(commission) {
    if (this.role === 'artist') return `<div class="new-request-card"><div class="request-icon">[+]</div><h2>New commission request</h2><p>${escapeHtml(commission.clientName)} sent you a request.</p>${commission.description ? `<blockquote>${escapeHtml(commission.description)}</blockquote>` : ''}<div class="request-actions"><button class="btn-primary" data-action="accept">Accept commission</button><button class="btn-revise" data-action="decline">Decline</button></div></div>`;
    return `<div class="new-request-card"><div class="request-icon">[...]</div><h2>Waiting for artist</h2><p>${escapeHtml(commission.artistName)} has not accepted your request yet.</p></div>`;
  }

  bindPending(commission) {
    document.querySelector('[data-action="accept"]')?.addEventListener('click', () => this.changeStatus(commission, 'active'));
    document.querySelector('[data-action="decline"]')?.addEventListener('click', () => { if (window.confirm('Decline this commission request?')) this.changeStatus(commission, 'declined'); });
  }

  stageCard(commission, stage, index, data, ready, approved, current) {
    const isCurrent = commission.status === 'active' && current === index;
    const uploads = Array.isArray(data.uploads) ? data.uploads : [];
    const card = document.createElement('article');
    card.className = `stage-card ${approved ? 'completed' : isCurrent ? 'current' : 'future'}`;
    const badge = approved ? 'Approved' : ready ? 'Ready for review' : isCurrent ? 'In progress' : 'Upcoming';
    card.innerHTML = `<div class="stage-header"><span class="stage-icon">${stage.icon}</span><strong>${stage.label}</strong><span class="stage-badge ${approved ? 'approved' : ready ? 'ready' : isCurrent ? 'in-progress' : ''}">${badge}</span></div>`;
    if (!uploads.length && !data.note && !isCurrent && !approved) return card;
    const body = document.createElement('div'); body.className = 'stage-body';
    if (uploads.length) { const gallery = document.createElement('div'); gallery.className = 'upload-gallery'; uploads.forEach((upload, uploadIndex) => { const item = document.createElement('div'); item.className = 'upload-thumb'; item.innerHTML = `<img src="${escapeHtml(upload.src)}" alt="${escapeHtml(upload.name)}"><small>${escapeHtml(upload.name)} - ${formatDate(upload.uploaded)}</small>${this.role === 'artist' && isCurrent && !approved ? '<button class="upload-remove" type="button">x</button>' : ''}`; item.querySelector('.upload-remove')?.addEventListener('click', () => this.removeUpload(commission, index, uploadIndex)); gallery.appendChild(item); }); body.appendChild(gallery); }
    if (data.note) body.insertAdjacentHTML('beforeend', `<div class="artist-note"><strong>Artist note</strong><p>${escapeHtml(data.note)}</p></div>`);
    const feed = document.createElement('div'); feed.className = 'stage-chat-feed'; body.appendChild(feed); this.refreshMessages(commission.id, feed); const timer = setInterval(() => { if (document.body.contains(feed)) this.refreshMessages(commission.id, feed); }, 3000); this.pollers.push(timer);
    const messageForm = document.createElement('form'); messageForm.className = 'stage-msg-form'; messageForm.innerHTML = `<textarea class="stage-msg-input" rows="2" placeholder="Add a message..."></textarea><div class="stage-msg-actions"><button class="btn-primary" type="submit">Send message</button>${this.role === 'artist' && isCurrent && !approved ? '<button class="btn-secondary" type="button" data-note>Edit note</button>' : ''}</div>`; messageForm.addEventListener('submit', (event) => { event.preventDefault(); this.sendMessage(commission, messageForm, feed); }); messageForm.querySelector('[data-note]')?.addEventListener('click', () => this.noteForm(body, commission, index, data.note || '')); body.appendChild(messageForm);
    if (this.role === 'artist' && isCurrent && !approved) { const actions = document.createElement('div'); actions.className = 'action-row'; actions.innerHTML = `<label class="btn-primary">${uploads.length ? 'Add file' : 'Upload artwork'}<input type="file" accept="image/*"></label>${uploads.length && !ready ? '<button class="btn-approve" type="button">Submit for review</button>' : ready ? '<span>Waiting for client approval...</span>' : ''}`; actions.querySelector('input')?.addEventListener('change', (event) => this.upload(event, commission, index)); actions.querySelector('.btn-approve')?.addEventListener('click', () => this.markReady(commission, index)); body.appendChild(actions); }
    if (this.role === 'customer' && uploads.length) { const review = document.createElement('div'); review.className = 'review-bar'; review.innerHTML = approved ? '<p class="approved">Approved and locked.</p>' : ready ? '<p>The artist marked this stage ready for review.</p><button class="btn-revise" type="button">Request revision</button><button class="btn-approve" type="button">Approve</button>' : '<p>Work in progress - review will open when submitted.</p>'; if (ready && !approved) { review.querySelector('.btn-approve').addEventListener('click', () => this.approve(commission, index)); review.querySelector('.btn-revise').addEventListener('click', () => this.openFeedback(commission, index)); } card.appendChild(review); }
    card.appendChild(body); return card;
  }

  async refreshMessages(commissionId, container) { try { const result = await api('messages', 'GET', null, { commissionId, t:Date.now() }); container.innerHTML = (result.messages || []).map((message) => `<div class="note-block ${message.senderRole === 'artist' ? 'note-block-artist' : ''}"><span class="note-label">${message.senderRole === 'artist' ? 'Artist' : 'Client'}</span><p class="note-text">${escapeHtml(message.message)}</p><span class="note-ts">${formatDate(message.createdAt)}</span></div>`).join(''); } catch {} }
  async sendMessage(commission, form, feed) { const input = form.querySelector('textarea'); const message = input.value.trim(); if (!message) return; try { await api('send_message', 'POST', { commissionId:commission.id, senderId:this.user.userId, senderName:this.user.name || this.user.email, senderRole:this.role, message }); input.value = ''; await this.refreshMessages(commission.id, feed); toast('Message sent'); } catch (error) { toast(error.message); } }
  async changeStatus(commission, status) { try { await api('update_commission_status', 'POST', { id:commission.id, status }); await this.reload(); toast(status === 'active' ? 'Commission accepted' : 'Commission declined'); } catch (error) { toast(error.message); } }
  async upload(event, commission, index) { const file = event.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = async () => { const data = commission.stageData || Array.from({ length:5 }, () => ({ uploads:[], note:null })); const stage = data[index] || { uploads:[], note:null }; data[index] = { ...stage, uploads:[...(stage.uploads || []), { name:file.name.replace(/\.[^.]+$/, ''), src:reader.result, uploaded:new Date().toISOString() }] }; try { await api('update_commission_stage', 'POST', { id:commission.id, stageData:data }); await this.reload(); toast('Artwork uploaded'); } catch (error) { toast(error.message); } }; reader.readAsDataURL(file); }
  async removeUpload(commission, stageIndex, uploadIndex) { if (!window.confirm('Remove this file?')) return; const data = commission.stageData || []; data[stageIndex].uploads = data[stageIndex].uploads.filter((_, index) => index !== uploadIndex); try { await api('update_commission_stage', 'POST', { id:commission.id, stageData:data }); await this.reload(); } catch (error) { toast(error.message); } }
  noteForm(body, commission, index, existing) { if (body.querySelector('.note-form')) return; const form = document.createElement('div'); form.className = 'note-form'; form.innerHTML = `<textarea>${escapeHtml(existing)}</textarea><div class="note-form-actions"><button class="btn-primary" type="button">Save note</button><button class="btn-secondary" type="button">Cancel</button></div>`; form.querySelector('.btn-primary').addEventListener('click', async () => { const data = commission.stageData || []; data[index] = { ...(data[index] || { uploads:[] }), note:form.querySelector('textarea').value.trim() }; if (!data[index].note) return; try { await api('update_commission_stage', 'POST', { id:commission.id, stageData:data }); await this.reload(); } catch (error) { toast(error.message); } }); form.querySelector('.btn-secondary').addEventListener('click', () => form.remove()); body.prepend(form); }
  async markReady(commission, index) { const statuses = [...(commission.stageStatus || Array(5).fill(false))]; statuses[index] = true; try { await api('update_commission_stage', 'POST', { id:commission.id, stageStatus:statuses, notify:{ userId:commission.clientId, type:'stage_submitted', text:`${commission.artistName} submitted a stage for review.` } }); await this.reload(); } catch (error) { toast(error.message); } }
  async approve(commission, index) { const approvals = [...(commission.clientApproval || Array(5).fill(false))]; approvals[index] = true; const next = Math.min(index + 1, 4); try { await api('update_commission_stage', 'POST', { id:commission.id, clientApproval:approvals, currentStage:next, status:approvals.every(Boolean) ? 'done' : undefined, notify:{ userId:commission.artistId, type:'stage_approved', text:`${commission.clientName} approved a stage.` } }); await this.reload(); toast('Stage approved'); } catch (error) { toast(error.message); } }
  openFeedback(commission, index) { this.feedback = { commission, index }; document.querySelector('#feedback-overlay')?.classList.add('open'); }
  bindFeedback() { const overlay = document.querySelector('#feedback-overlay'); if (!overlay) return; const close = () => overlay.classList.remove('open'); document.querySelector('#feedback-close')?.addEventListener('click', close); document.querySelector('#feedback-cancel')?.addEventListener('click', close); document.querySelector('#feedback-send')?.addEventListener('click', async () => { const text = document.querySelector('#feedback-text').value.trim(); if (!text || !this.feedback) return; const { commission, index } = this.feedback; try { await api('send_message', 'POST', { commissionId:commission.id, senderId:this.user.userId, senderName:this.user.name || this.user.email, senderRole:this.role, message:`Revision request for ${STAGES[index].label}: ${text}` }); const statuses = [...(commission.stageStatus || Array(5).fill(false))]; statuses[index] = false; await api('update_commission_stage', 'POST', { id:commission.id, stageStatus:statuses, notify:{ userId:commission.artistId, type:'revision_requested', text:'A revision was requested.' } }); document.querySelector('#feedback-text').value = ''; close(); await this.reload(); } catch (error) { toast(error.message); } }); }
  async reload() { await this.load(); this.renderSidebar(); this.renderMain(); }
  statusLabel(commission) { if (commission.status === 'pending') return 'Pending'; if (commission.status === 'declined') return 'Declined'; if (commission.status === 'done') return 'Completed'; return `In progress - ${STAGES[commission.currentStage || 0].label}`; }
}

window.CommissionTracker = CommissionTracker;
window.startCommissionRequest = async function startCommissionRequest(artistId, artistName) {
  const user = session();
  if (!user || user.role !== 'customer') { window.location.href = `../Account%20functions/auth.html?mode=signin&redirect=artist.html?id=${encodeURIComponent(artistId)}`; return; }
  const title = window.prompt(`Commission ${artistName}: title`, 'My commission');
  if (!title) return;
  const description = window.prompt('Describe your request (optional):', '') || '';
  try { await api('create_commission', 'POST', { artistId, clientId:user.userId, title:title.trim(), description:description.trim() }); window.location.href = '../User%20Side/commissions.html'; } catch (error) { window.alert(error.message); }
};
