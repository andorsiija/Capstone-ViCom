const uploads = [
  {
  }
];

const grid = document.querySelector('#upload-grid');
const toast = document.querySelector('#toast');
const empty = document.querySelector('#uploads-empty');
const filters = document.querySelectorAll('.upload-filter');
let toastTimer;
let activeCategory = 'all';

async function getPublishedUploads() {
  try {
    const response = await fetch('../Account%20functions/api.php?action=artworks');
    if (!response.ok) throw new Error('Artwork API unavailable');
    const result = await response.json();
    const portfolio = result.artworks || [];
    return portfolio.map((work) => ({ ...work, style: 'published-upload' }));
  } catch (error) {
    try {
      const database = JSON.parse(localStorage.getItem('vicom-demo-database')) || {};
      const legacy = JSON.parse(localStorage.getItem('vicom-portfolio')) || [];
      const portfolio = Array.isArray(database.artworks) && database.artworks.length ? database.artworks : legacy;
      return portfolio.map((work) => ({ ...work, style: 'published-upload' }));
    } catch (fallbackError) {
      return [];
    }
  }
}

function shuffled(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

async function renderUploads() {
  const publishedUploads = await getPublishedUploads();
  const visibleUploads = shuffled([...uploads, ...publishedUploads]).filter((upload) => activeCategory === 'all' || upload.category.toLowerCase() === activeCategory);
  grid.innerHTML = visibleUploads.map((upload) => `
    <article class="upload-card">
      <div class="upload-image ${upload.style}"${upload.image ? ` style="background-image:url('${upload.image}')"` : ''}>${upload.artistId ? `<a class="artist-photo-link" href="../Account%20functions/artist.html?id=${encodeURIComponent(upload.artistId)}" aria-label="View ${upload.artist} profile"></a>` : ''}<span class="category">${upload.category}</span><button class="heart" type="button" aria-label="Save ${upload.title}" data-title="${upload.title}">♡</button></div>
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

filters.forEach((filter) => filter.addEventListener('click', async () => {
  filters.forEach((item) => item.classList.remove('active'));
  filter.classList.add('active');
  activeCategory = filter.dataset.category;
  await renderUploads();
}));

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

document.querySelector('#shuffle-button').addEventListener('click', async () => {
  await renderUploads();
  showToast('Fresh uploads shuffled');
});
document.querySelectorAll('[data-toast]').forEach((button) => button.addEventListener('click', () => showToast(button.dataset.toast)));
renderUploads();
