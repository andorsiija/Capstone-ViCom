const artistId = new URLSearchParams(window.location.search).get('id');
const apiUrl = 'api.php?action=artist&id=';
const nameElement = document.querySelector('#artist-name');
const specialtyElement = document.querySelector('#artist-specialty');
const avatarElement = document.querySelector('#artist-avatar');
const grid = document.querySelector('#portfolio-grid');
const empty = document.querySelector('#empty-state');
const count = document.querySelector('#work-count');
const toast = document.querySelector('#toast');
const imageLightbox = document.querySelector('#image-lightbox');
const imageLightboxPicture = document.querySelector('#image-lightbox-picture');

function closeImageLightbox() {
  imageLightbox.classList.remove('open');
  imageLightbox.setAttribute('aria-hidden', 'true');
  imageLightboxPicture.style.backgroundImage = '';
}

function getFallbackProfile() {
  try {
    const database = JSON.parse(localStorage.getItem('vicom-demo-database')) || {};
    const artist = (database.users || []).find((user) => user.id === artistId && user.role === 'artist');
    const artworks = (database.artworks || []).filter((work) => work.artistId === artistId);
    const profileViews = incrementFallbackViews();
    if (artist) return { artist: { ...artist, profileViews }, artworks };
    
    return null;
  } catch (error) {
    return null;
  }
}

function incrementFallbackViews() {
  try {
    const views = JSON.parse(localStorage.getItem('vicom-profile-views')) || {};
    views[artistId] = Number(views[artistId] || 0) + 1;
    localStorage.setItem('vicom-profile-views', JSON.stringify(views));
    return views[artistId];
  } catch (error) {
    return 0;
  }
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}

function renderProfile(profile) {
  const { artist, artworks } = profile;
  _currentArtistId   = artist.id   || artistId;
  _currentArtistName = artist.name || '';
  document.title = `ViCom | ${artist.name}`;
  nameElement.textContent = artist.name;
  specialtyElement.textContent = artist.specialty || 'Original commissions';
  avatarElement.textContent = artist.name.trim().charAt(0).toUpperCase();
  count.textContent = `${artworks.length} ${artworks.length === 1 ? 'piece' : 'pieces'}`;
  grid.innerHTML = artworks.map((work) => `<article class="work-card"><div class="work-image" style="background-image:url('${work.image}')"></div><div class="work-meta"><div><h3>${work.title}</h3><p>${work.detail || work.category}</p></div><strong>from ${work.price}</strong></div></article>`).join('');
  empty.hidden = artworks.length > 0;
}

async function loadProfile() {
  if (!artistId) {
    nameElement.textContent = 'Artist not found';
    empty.hidden = false;
    empty.textContent = 'Choose an artist from Discover to view their profile.';
    return;
  }
  try {
    const response = await fetch(`${apiUrl}${encodeURIComponent(artistId)}`);
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { throw new Error('API unavailable'); }
    if (!response.ok) throw new Error('Profile unavailable');
    _currentArtistId   = data.artist?.id   || artistId;
    _currentArtistName = data.artist?.name || '';
    renderProfile(data);
  } catch (error) {
    const fallback = getFallbackProfile();
    if (fallback) {
      _currentArtistId   = fallback.artist?.id   || artistId;
      _currentArtistName = fallback.artist?.name || '';
      renderProfile(fallback);
    }
    else {
      nameElement.textContent = 'Artist not found';
      empty.hidden = false;
      empty.textContent = 'This artist profile is not available right now.';
    }
  }
}

/* ── COMMISSION REQUEST FLOW ── */
let _currentArtistId   = null;
let _currentArtistName = null;

function openCommissionModal(aId, aName) {
  _currentArtistId   = aId;
  _currentArtistName = aName;
  const nameEl = document.querySelector('#modal-artist-name');
  if (nameEl) nameEl.textContent = aName || 'the artist';
  document.querySelector('#commission-modal-overlay').classList.add('open');
  document.querySelector('#commission-title').value = '';
  document.querySelector('#commission-brief').value = '';
  const refInput = document.querySelector('#commission-reference');
  const preview = document.querySelector('#commission-reference-preview');
  if (refInput) refInput.value = '';
  if (preview) {
    preview.src = '';
    preview.hidden = true;
  }
}

function readReferenceImage(file) {
  if (!file) return Promise.resolve('');
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file for your reference.');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Reference image must be under 5 MB.');
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the selected image.'));
    reader.readAsDataURL(file);
  });
}

const referenceInput = document.querySelector('#commission-reference');
const referencePreview = document.querySelector('#commission-reference-preview');
referenceInput?.addEventListener('change', () => {
  const file = referenceInput.files?.[0];
  if (!file) {
    if (referencePreview) {
      referencePreview.src = '';
      referencePreview.hidden = true;
    }
    return;
  }
  if (!file.type.startsWith('image/')) {
    showToast('Please choose an image file for your reference.');
    referenceInput.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    if (referencePreview) {
      referencePreview.src = String(reader.result);
      referencePreview.hidden = false;
    }
  };
  reader.readAsDataURL(file);
});

function closeCommissionModal() {
  document.querySelector('#commission-modal-overlay').classList.remove('open');
}

document.querySelector('#commission-button').addEventListener('click', () => {
  // Check if logged in as customer
  try {
    const sess = JSON.parse(localStorage.getItem('vicom-session'));
    if (!sess) {
      window.location.href = `auth.html?mode=signin`;
      return;
    }
    if (sess.role === 'artist') {
      showToast('Log in as a client to commission artists.');
      return;
    }
  } catch {
    window.location.href = 'auth.html?mode=signin';
    return;
  }
  openCommissionModal(_currentArtistId || artistId, _currentArtistName || document.querySelector('#artist-name')?.textContent || 'Artist');
});

document.querySelector('#commission-modal-close')?.addEventListener('click', closeCommissionModal);
document.querySelector('#commission-modal-cancel')?.addEventListener('click', closeCommissionModal);
document.querySelector('#commission-modal-overlay')?.addEventListener('click', e => {
  if (e.target.id === 'commission-modal-overlay') closeCommissionModal();
});

document.querySelector('#commission-submit')?.addEventListener('click', async () => {
  const btn   = document.querySelector('#commission-submit');
  const title = document.querySelector('#commission-title').value.trim();
  const brief = document.querySelector('#commission-brief').value.trim();
  if (!title) { showToast('Add a project title first.'); return; }

  const sess = JSON.parse(localStorage.getItem('vicom-session') || 'null');
  if (!sess) { window.location.href = 'auth.html?mode=signin'; return; }
  if (sess.role === 'artist') { showToast('Log in as a client to commission artists.'); return; }

  const targetArtistId = _currentArtistId || artistId;
  if (!targetArtistId) { showToast('Could not identify this artist.'); return; }

  btn.disabled = true;

  try {
    // Prevent duplicate pending request to the same artist (checked against the DB)
    const existing = await fetch(
      `api.php?action=commissions&userId=${encodeURIComponent(sess.userId)}&role=customer`
    ).then(r => r.json());

    const dup = (existing.commissions || []).some(c =>
      c.artistId === targetArtistId && c.status === 'pending'
    );
    if (dup) {
      showToast('You already have a pending request with this artist.');
      closeCommissionModal();
      return;
    }

    const res = await fetch('api.php?action=create_commission', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        artistId:    targetArtistId,
        clientId:    sess.userId,
        title:       title,
        description: brief,
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || 'Request failed.');

    closeCommissionModal();
    showToast('\u2705 Commission request sent! Redirecting\u2026');
    setTimeout(() => { window.location.href = '../User%20Side/commissions.html'; }, 1400);
  } catch (err) {
    showToast('Could not send request: ' + err.message);
  } finally {
    btn.disabled = false;
  }
});

loadProfile();

grid.addEventListener('click', (event) => {
  const image = event.target.closest('.work-image');
  if (!image) return;
  imageLightboxPicture.style.backgroundImage = image.style.backgroundImage;
  imageLightbox.classList.add('open');
  imageLightbox.setAttribute('aria-hidden', 'false');
});

document.querySelector('#image-lightbox-close').addEventListener('click', closeImageLightbox);
imageLightbox.addEventListener('click', (event) => {
  if (event.target === imageLightbox) closeImageLightbox();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && imageLightbox.classList.contains('open')) closeImageLightbox();
});
