/* Artist side – script.js
 * Now pulls live counts from MySQL via api.php
 * and shows real badges on Commissions & Messages nav links.
 */

const API = '../Account%20functions/api.php';
const toast = document.querySelector('#toast');
let timer;
let loggedInArtist = null;

function notify(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(timer);
  timer = setTimeout(() => toast.classList.remove('show'), 2200);
}

/* ── SESSION ──────────────────────────────────────── */
function getSession() {
  try { return JSON.parse(localStorage.getItem('vicom-session')); }
  catch { return null; }
}

function loadLoggedInArtist() {
  try {
    const session = getSession();
    if (!session) return;

    // Use session data directly (no more localStorage DB lookup)
    loggedInArtist = { id: session.userId, name: session.name || session.email, role: 'artist' };

    if (loggedInArtist.name) {
      const displayName = loggedInArtist.name;
      const el_name     = document.querySelector('#artist-name');
      const el_greeting = document.querySelector('#artist-greeting');
      const el_initials = document.querySelector('#artist-initials');
      if (el_name)     el_name.textContent     = displayName;
      if (el_greeting) el_greeting.textContent = displayName;
      if (el_initials) el_initials.textContent = displayName
        .split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase();
    }
  } catch (error) {
    loggedInArtist = null;
  }
}

/* ── PORTFOLIO (still uses api.php) ──────────────── */
async function fetchPortfolio() {
  if (!loggedInArtist) return [];
  try {
    const res  = await fetch(`${API}?action=artworks`);
    const json = await res.json();
    return (json.artworks || []).filter(a => a.artistId === loggedInArtist.id);
  } catch { return []; }
}

function renderPortfolio(portfolio) {
  const grid  = document.querySelector('#portfolio-grid');
  const empty = document.querySelector('#portfolio-empty');
  if (!grid || !empty) return;
  grid.innerHTML = portfolio
    .map(w => `<div class="work" style="background-image:url('${w.image}')" title="${w.title}"></div>`)
    .join('');
  empty.hidden = portfolio.length > 0;
}

async function savePortfolio(work) {
  const response = await fetch(`${API}?action=create_artwork`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(work),
  });
  const text = await response.text();
  let result;
  try { result = JSON.parse(text); }
  catch { throw new Error('Could not connect to XAMPP. Start Apache and open the project through localhost.'); }
  if (!response.ok) throw new Error(result.error || 'Artwork could not be published.');
}

/* ── DASHBOARD COUNTS (live from DB) ─────────────── */
async function loadDashboardCounts() {
  if (!loggedInArtist) return;

  try {
    const res  = await fetch(`${API}?action=dashboard_counts&userId=${encodeURIComponent(loggedInArtist.id)}&role=artist`);
    const data = await res.json();

    const active  = data.active  || 0;
    const pending = data.pending || 0;
    const unread  = data.unreadMessages || 0;
    const notifs  = data.notifications  || 0;

    const totalCommissions = active + pending;

    /* ── Stat card: Active commissions ── */
    const statEl = document.querySelector('.stat-card strong');
    if (statEl) {
      statEl.textContent = active;
      const smallEl = statEl.nextElementSibling;
      if (smallEl) smallEl.textContent = active === 0 ? 'No active commissions' : `${active} in progress`;
    }

    /* ── Nav badge: Commissions ── */
    updateNavBadge('commissions.html', totalCommissions);

    /* ── Nav badge: Messages ── */
    updateNavBadge('#messages', unread);

    /* ── Messages panel heading count ── */
    const msgCount = document.querySelector('.messages .count');
    if (msgCount) msgCount.textContent = unread;

    /* ── Notification bell ── */
    const notifBtn = document.querySelector('#notification');
    if (notifBtn) {
      notifBtn.style.position = 'relative';
      let badge = notifBtn.querySelector('.notif-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'notif-badge';
        notifBtn.appendChild(badge);
      }
      badge.textContent = notifs > 9 ? '9+' : notifs;
      badge.style.display = notifs > 0 ? 'flex' : 'none';
    }

    /* ── Active commissions panel ── */
    loadActiveCommissionsPanel(active + pending);

  } catch (err) {
    console.warn('Dashboard counts unavailable:', err.message);
  }
}

function updateNavBadge(href, count) {
  // Find the nav link that matches href or anchor
  const links = document.querySelectorAll('nav a');
  links.forEach(link => {
    if (link.getAttribute('href') === href) {
      let badge = link.querySelector('b');
      if (!badge) { badge = document.createElement('b'); link.appendChild(badge); }
      badge.textContent = count;
      badge.className   = count > 0 ? 'badge-active' : '';
      badge.style.display = 'inline';
    }
  });
}

/* ── ACTIVE COMMISSIONS PANEL ────────────────────── */
async function loadActiveCommissionsPanel(totalCount) {
  const listEl = document.querySelector('.commission-list');
  if (!listEl || !loggedInArtist) return;

  if (totalCount === 0) {
    listEl.innerHTML = '<p style="color:#8aa396;font-size:13px;padding:8px 0">No active commissions.</p>';
    return;
  }

  try {
    const res  = await fetch(`${API}?action=commissions&userId=${encodeURIComponent(loggedInArtist.id)}&role=artist`);
    const data = await res.json();
    const comms = (data.commissions || []).filter(c => c.status !== 'declined').slice(0, 4);

    listEl.innerHTML = comms.map(c => {
      const statusCls = c.status === 'pending' ? 'status-pending' : 'status-active';
      const statusTxt = c.status === 'pending' ? 'Pending' : `Stage ${(c.currentStage||0)+1}`;
      return `<a class="comm-preview-item" href="commissions.html">
        <span class="comm-avatar-sm">${initials(c.clientName)}</span>
        <div>
          <strong>${c.title}</strong>
          <small>from ${c.clientName}</small>
        </div>
        <span class="mini-badge ${statusCls}">${statusTxt}</span>
      </a>`;
    }).join('');
  } catch {
    listEl.innerHTML = '<p style="color:#8aa396;font-size:13px">Could not load commissions.</p>';
  }
}

function initials(name) {
  return (name || '?').split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase();
}

/* ── PROFILE VIEWS ───────────────────────────────── */
async function loadProfileViews() {
  if (!loggedInArtist) return;
  const el = document.querySelector('#profile-views');
  try {
    const res  = await fetch(`${API}?action=artist_stats&id=${encodeURIComponent(loggedInArtist.id)}`);
    const data = await res.json();
    if (el) el.textContent = Number(data.profileViews || 0).toLocaleString();
  } catch { if (el) el.textContent = '0'; }
}

/* ── MESSAGE PANEL ─────────────────────────────── */
async function loadMessagesPanel() {
  const panel = document.querySelector('#messages');
  if (!panel || !loggedInArtist) return;

  let list = panel.querySelector('.message-list');
  if (!list) {
    list = document.createElement('div');
    list.className = 'message-list';
    panel.appendChild(list);
  }

  try {
    const res  = await fetch(`${API}?action=commissions&userId=${encodeURIComponent(loggedInArtist.id)}&role=artist`);
    const data = await res.json();
    const comms = (data.commissions || []).filter(c => c.status !== 'declined').slice(0, 4);

    if (!comms.length) {
      list.innerHTML = '<p style="margin:12px 0 0;color:#8aa396;font-size:13px">No messages yet.</p>';
      return;
    }

    const items = [];
    for (const c of comms) {
      try {
        const msgRes  = await fetch(`${API}?action=messages&commissionId=${encodeURIComponent(c.id)}`);
        const msgData = await msgRes.json();
        const msgs = (msgData.messages || []).slice(-2);
        if (!msgs.length) continue;

        const last = msgs[msgs.length - 1];
        const from = last.senderRole === 'artist' ? 'You' : c.clientName;
        const preview = (last.message || '').replace(/\s+/g, ' ').trim();
        items.push(`
          <div class="message-item">
            <span class="msg-dot"></span>
            <div>
              <strong>${from}</strong>
              <p>${preview}</p>
              <small>${c.title}</small>
            </div>
          </div>`);
      } catch {}
    }

    list.innerHTML = items.length ? items.join('') : '<p style="margin:12px 0 0;color:#8aa396;font-size:13px">No messages yet.</p>';
  } catch {
    list.innerHTML = '<p style="margin:12px 0 0;color:#8aa396;font-size:13px">Could not load messages.</p>';
  }
}

/* ── NOTIFICATIONS PANEL ─────────────────────────── */
async function showNotifications() {
  if (!loggedInArtist) { notify('Sign in to see notifications'); return; }
  try {
    const res  = await fetch(`${API}?action=notifications&userId=${encodeURIComponent(loggedInArtist.id)}`);
    const data = await res.json();
    const list = data.notifications || [];
    if (!list.length) { notify('No new notifications'); return; }
    // Mark as read
    fetch(`${API}?action=mark_notifications_read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: loggedInArtist.id }),
    });
    // Show newest
    const latest = list[0];
    notify('🔔 ' + latest.text);
    // Refresh counts
    loadDashboardCounts();
  } catch { notify('Could not load notifications'); }
}

/* ── MODAL ───────────────────────────────────────── */
function openWorkModal() {
  const modal = document.querySelector('#work-modal');
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
}
function closeWorkModal() {
  const modal = document.querySelector('#work-modal');
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  document.querySelector('#work-error').textContent = '';
}

/* ── INIT ────────────────────────────────────────── */
loadLoggedInArtist();
loadDashboardCounts();
loadMessagesPanel();
loadProfileViews();
fetchPortfolio().then(renderPortfolio);

/* ── EVENTS ──────────────────────────────────────── */
document.querySelector('#notification')?.addEventListener('click', showNotifications);
document.querySelector('#help')?.addEventListener('click', () => notify('Help center is opening soon'));
document.querySelector('#view-profile')?.addEventListener('click', () => {
  if (loggedInArtist?.id) window.location.href = `profile.html?id=${encodeURIComponent(loggedInArtist.id)}`;
});
document.querySelector('#logout')?.addEventListener('click', () => {
  localStorage.removeItem('vicom-session');
  window.location.href = '../LandingPage/index.html';
});
document.querySelector('#all-commissions')?.addEventListener('click', () => { window.location.href = 'commissions.html'; });
document.querySelector('#open-messages')?.addEventListener('click', () => { window.location.href = 'commissions.html'; });
document.querySelector('#add-work')?.addEventListener('click', openWorkModal);
document.querySelector('#close-work')?.addEventListener('click', closeWorkModal);
document.querySelector('#work-modal')?.addEventListener('click', e => { if (e.target.id === 'work-modal') closeWorkModal(); });
document.querySelector('.mobile-nav')?.addEventListener('click', () => notify('Navigation is available on desktop view'));

document.querySelector('#work-form')?.addEventListener('submit', async event => {
  event.preventDefault();
  const imageFile = document.querySelector('#work-image').files[0];
  const error     = document.querySelector('#work-error');
  if (!loggedInArtist) { error.textContent = 'Sign in as an artist before publishing artwork.'; return; }
  if (!imageFile)      { error.textContent = 'Choose an artwork image to publish.'; return; }

  const reader = new FileReader();
  reader.onload = async () => {
    const work = {
      id: `work_${Date.now()}`,
      artistId: loggedInArtist.id,
      artist:   loggedInArtist.name,
      title:    document.querySelector('#work-title').value.trim(),
      detail:   document.querySelector('#work-detail').value.trim() || 'Original artwork',
      price:    Number(document.querySelector('#work-price').value),
      category: document.querySelector('#work-category').value,
      image:    reader.result,
      createdAt: new Date().toISOString(),
    };
    if (!work.title || !work.price) { error.textContent = 'Add a title and starting price.'; return; }
    try {
      await savePortfolio(work);
      const portfolio = await fetchPortfolio();
      renderPortfolio(portfolio);
      closeWorkModal();
      event.target.reset();
      notify('Artwork published to Discover');
    } catch (err) {
      error.textContent = err.message.includes('Failed to fetch')
        ? 'Could not connect to XAMPP. Start Apache and open the project through localhost.'
        : err.message;
    }
  };
  reader.readAsDataURL(imageFile);
});
