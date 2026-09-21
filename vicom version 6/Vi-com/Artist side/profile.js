const apiBase = '../Account%20functions/api.php';
const sessionKey = 'vicom-session';
const session = getSession();
const artistId = new URLSearchParams(window.location.search).get('id') || session?.userId;
const nameElement = document.querySelector('#artist-name');
const specialtyElement = document.querySelector('#artist-specialty');
const descriptionElement = document.querySelector('#profile-description');
const socialLinkElement = document.querySelector('#artist-social-link');
const avatarElement = document.querySelector('#artist-avatar');
const grid = document.querySelector('#portfolio-grid');
const empty = document.querySelector('#empty-state');
const count = document.querySelector('#work-count');
const toast = document.querySelector('#toast');
const descriptionPanel = document.querySelector('#description-panel');
const descriptionInput = document.querySelector('#description-input');
const socialLinkInput = document.querySelector('#social-link-input');
const formError = document.querySelector('#form-error');
let artist;

function getSession() {
  try {
    return JSON.parse(localStorage.getItem(sessionKey) || 'null');
  } catch {
    return null;
  }
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}

function renderProfile(profile) {
  artist = profile.artist;
  document.title = `ViCom | ${artist.name}`;
  nameElement.textContent = artist.name;
  specialtyElement.textContent = artist.specialty || 'Original commissions';
  descriptionElement.textContent = artist.description || 'Original work made with care, clarity, and a point of view.';
  renderSocialLink(artist.socialLink);
  avatarElement.textContent = artist.name.trim().charAt(0).toUpperCase();

  const artworks = profile.artworks || [];
  count.textContent = `${artworks.length} ${artworks.length === 1 ? 'piece' : 'pieces'}`;
  grid.innerHTML = artworks.map((work) => `
    <article class="work-card">
      <div class="work-image" style="background-image:url('${work.image}')" data-image="${work.image}" role="button" tabindex="0" aria-label="View ${work.title}"></div>
      <div class="work-meta"><div><h3>${work.title}</h3><p>${work.detail || work.category}</p></div><strong>from ${work.price}</strong></div>
    </article>`).join('');
  empty.hidden = artworks.length > 0;
}

function renderSocialLink(url) {
  if (url) {
    socialLinkElement.href = url;
    socialLinkElement.textContent = url;
    socialLinkElement.hidden = false;
  } else {
    socialLinkElement.removeAttribute('href');
    socialLinkElement.textContent = '';
    socialLinkElement.hidden = true;
  }
}

async function loadProfile() {
  if (!session?.userId || session.role !== 'artist') {
    window.location.href = '../Account%20functions/auth.html?mode=signin';
    return;
  }
  try {
    const response = await fetch(`${apiBase}?action=artist&id=${encodeURIComponent(artistId)}`);
    const profile = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(profile.error || 'Profile unavailable.');
    if (artistId !== session.userId) throw new Error('You can only edit your own profile.');
    renderProfile(profile);
    descriptionInput.value = artist.description || '';
    socialLinkInput.value = artist.socialLink || '';
  } catch (error) {
    nameElement.textContent = 'Profile unavailable';
    empty.hidden = false;
    empty.textContent = error.message;
    document.querySelector('#edit-description').hidden = true;
  }
}

document.querySelector('#edit-description').addEventListener('click', () => {
  descriptionPanel.hidden = false;
  descriptionInput.focus();
});

document.querySelector('#cancel-description').addEventListener('click', () => {
  descriptionPanel.hidden = true;
  formError.textContent = '';
  descriptionInput.value = artist?.description || '';
  socialLinkInput.value = artist?.socialLink || '';
});

document.querySelector('#save-description').addEventListener('click', async () => {
  const description = descriptionInput.value.trim();
  const socialLink = socialLinkInput.value.trim();
  const saveButton = document.querySelector('#save-description');
  formError.textContent = '';
  saveButton.disabled = true;
  try {
    const response = await fetch(`${apiBase}?action=update_profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: session.userId,
        email: session.email,
        name: session.name,
        specialty: session.specialty || artist.specialty || '',
        description,
        socialLink,
        password: '',
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Could not save description.');
    artist.description = result.user.description;
    artist.socialLink = result.user.socialLink;
    descriptionElement.textContent = description || 'Original work made with care, clarity, and a point of view.';
    renderSocialLink(artist.socialLink);
    descriptionPanel.hidden = true;
    showToast('Description updated');
  } catch (error) {
    formError.textContent = error.message;
  } finally {
    saveButton.disabled = false;
  }
});

const lightbox = document.querySelector('#lightbox');
const lightboxImage = document.querySelector('#lightbox-image');
function closeLightbox() {
  lightbox.classList.remove('open');
  lightbox.setAttribute('aria-hidden', 'true');
  lightboxImage.style.backgroundImage = '';
}
function openLightbox(image) {
  lightboxImage.style.backgroundImage = `url("${image}")`;
  lightbox.classList.add('open');
  lightbox.setAttribute('aria-hidden', 'false');
}
grid.addEventListener('click', (event) => {
  const image = event.target.closest('.work-image');
  if (image) openLightbox(image.dataset.image);
});
grid.addEventListener('keydown', (event) => {
  if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('.work-image')) {
    event.preventDefault();
    openLightbox(event.target.dataset.image);
  }
});
document.querySelector('#lightbox-close').addEventListener('click', closeLightbox);
lightbox.addEventListener('click', (event) => {
  if (event.target === lightbox) closeLightbox();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && lightbox.classList.contains('open')) closeLightbox();
});

loadProfile();
