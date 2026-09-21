const uploads = [
];
const sessionKey = 'vicom-session';
const grid = document.querySelector('#upload-grid');
const empty = document.querySelector('#uploads-empty');
const toast = document.querySelector('#toast');
const filters = document.querySelectorAll('.upload-filter');
const filterButton = document.querySelector('#filter-button');
const priceFilterPanel = document.querySelector('#price-filter-panel');
const minPriceInput = document.querySelector('#min-price');
const maxPriceInput = document.querySelector('#max-price');
const clearPriceFilter = document.querySelector('#clear-price-filter');
let toastTimer;
let activeCategory = 'all';
let minimumPrice = null;
let maximumPrice = null;
let allUploads = [];

function hasSession() {
  try {
    const session = JSON.parse(localStorage.getItem(sessionKey));
    return Boolean(session?.userId || session?.email);
  } catch (error) {
    return false;
  }
}

if (!hasSession()) {
  window.location.href = '../Account%20functions/auth.html?mode=signin';
}

async function getPublishedUploads() {
  try {
    const response = await fetch('../Account%20functions/api.php?action=artworks');
    if (!response.ok) throw new Error('Artwork API unavailable');
    const result = await response.json();
    return result.artworks || [];
  } catch (error) {
    try {
      const database = JSON.parse(localStorage.getItem('vicom-demo-database')) || {};
      const legacy = JSON.parse(localStorage.getItem('vicom-portfolio')) || [];
      return Array.isArray(database.artworks) && database.artworks.length ? database.artworks : legacy;
    } catch (fallbackError) {
      return [];
    }
  }
}

function shuffled(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function parsePrice(value) {
  const parsed = Number(String(value || '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

async function renderUploads() {
  const visibleUploads = shuffled(allUploads).filter((upload) => {
    const matchesCategory = activeCategory === 'all' || String(upload.category).toLowerCase() === activeCategory;
    const price = parsePrice(upload.price);
    const matchesMinimum = minimumPrice === null || (price !== null && price >= minimumPrice);
    const matchesMaximum = maximumPrice === null || (price !== null && price <= maximumPrice);
    return matchesCategory && matchesMinimum && matchesMaximum;
  });
  grid.innerHTML = visibleUploads.map((upload) => `
    <article class="upload-card">
      <div class="upload-image" style="background-image:url('${upload.image}')">${upload.artistId ? `<a class="artist-photo-link" href="../Account%20functions/artist.html?id=${encodeURIComponent(upload.artistId)}" aria-label="View ${upload.artist} profile"></a>` : ''}<span class="category">${upload.category}</span><button class="heart" type="button" aria-label="Save ${upload.title}" data-title="${upload.title}">♡</button></div>
      <div class="upload-meta"><div><h3>${upload.title}</h3><p>by ${upload.artistId ? `<a class="artist-link" href="../Account%20functions/artist.html?id=${encodeURIComponent(upload.artistId)}">${upload.artist}</a>` : upload.artist} · ${upload.detail}</p></div><strong>from ${upload.price}</strong></div>
    </article>
  `).join('');
  empty.hidden = visibleUploads.length > 0;
  grid.querySelectorAll('.heart').forEach((heart) => heart.addEventListener('click', () => {
    heart.classList.toggle('saved');
    heart.textContent = heart.classList.contains('saved') ? '♥' : '♡';
    showToast(heart.classList.contains('saved') ? `Saved ${heart.dataset.title}` : 'Removed from your collection');
  }));
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

filters.forEach((filter) => filter.addEventListener('click', async () => {
  filters.forEach((item) => item.classList.remove('active'));
  filter.classList.add('active');
  activeCategory = filter.dataset.category;
  await renderUploads();
}));

filterButton.addEventListener('click', () => {
  const isOpen = !priceFilterPanel.hidden;
  priceFilterPanel.hidden = isOpen;
  filterButton.setAttribute('aria-expanded', String(!isOpen));
});

function updatePriceFilter() {
  minimumPrice = minPriceInput.value === '' ? null : Number(minPriceInput.value);
  maximumPrice = maxPriceInput.value === '' ? null : Number(maxPriceInput.value);
  renderUploads();
}

minPriceInput.addEventListener('input', updatePriceFilter);
maxPriceInput.addEventListener('input', updatePriceFilter);
clearPriceFilter.addEventListener('click', () => {
  minPriceInput.value = '';
  maxPriceInput.value = '';
  minimumPrice = null;
  maximumPrice = null;
  renderUploads();
});

document.querySelector('#shuffle-button').addEventListener('click', async () => {
  await renderUploads();
  showToast('Fresh uploads shuffled');
});
document.querySelector('#logout').addEventListener('click', () => {
  localStorage.removeItem(sessionKey);
  window.location.href = '../LandingPage/index.html';
});

getPublishedUploads().then((publishedUploads) => {
  allUploads = [...uploads, ...publishedUploads];
  renderUploads();
});
