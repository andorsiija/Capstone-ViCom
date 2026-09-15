const tabs = document.querySelectorAll('.tab');
const grid = document.querySelector('#art-grid');
const empty = document.querySelector('#uploads-empty');
const toast = document.querySelector('#toast');
let toastTimer;
let cards = [];

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

function filterCards() {
  const category = document.querySelector('.tab.active').dataset.category;
  let visibleCount = 0;
  cards.forEach((card) => {
    const visible = category === 'all' || card.dataset.category.toLowerCase() === category;
    card.classList.toggle('hidden', !visible);
    if (visible) visibleCount += 1;
  });
  empty.hidden = visibleCount > 0;
}

function renderUploads(uploads) {
  grid.innerHTML = uploads.slice(0, 3).map((upload) => `
    <article class="art-card" data-category="${upload.category}">
      <div class="card-image published-upload" style="background-image:url('${upload.image}')">
        <a class="art-link" href="../Account%20functions/artist.html?id=${encodeURIComponent(upload.artistId)}" aria-label="View ${upload.artist} profile"></a>
        <button class="heart" type="button" aria-label="Save ${upload.title}">♡</button>
      </div>
      <div class="card-meta">
        <div>
          <h3>${upload.title}</h3>
          <p>by ${upload.artist}</p>
        </div>
        <strong>from ${upload.price}</strong>
      </div>
    </article>
  `).join('');
  cards = [...grid.querySelectorAll('.art-card')];
  grid.querySelectorAll('.heart').forEach((button) => button.addEventListener('click', (event) => {
    event.stopPropagation();
    button.classList.toggle('saved');
    button.textContent = button.classList.contains('saved') ? '♥' : '♡';
    showToast(button.classList.contains('saved') ? 'Saved to your collection' : 'Removed from your collection');
  }));
  filterCards();
}

async function loadUploads() {
  try {
    const response = await fetch('../Account%20functions/api.php?action=artworks');
    if (!response.ok) throw new Error('Artwork API unavailable');
    const result = await response.json();
    if (Array.isArray(result.artworks) && result.artworks.length) {
      renderUploads(result.artworks);
      return;
    }
    throw new Error('No database artwork found');
  } catch (error) {
    try {
      const database = JSON.parse(localStorage.getItem('vicom-demo-database')) || {};
      const legacy = JSON.parse(localStorage.getItem('vicom-portfolio')) || [];
      renderUploads(Array.isArray(database.artworks) && database.artworks.length ? database.artworks : legacy);
    } catch (fallbackError) {
      renderUploads([]);
    }
  }
}

tabs.forEach((tab) => tab.addEventListener('click', () => {
  tabs.forEach((item) => item.classList.remove('active'));
  tab.classList.add('active');
  filterCards();
}));

document.querySelector('#hero-search').addEventListener('click', () => {
  document.querySelector('#discover').scrollIntoView({ behavior: 'smooth' });
  showToast('Explore the ViCom edit below');
});

document.querySelector('#filter-button').addEventListener('click', () => showToast('More filters are coming soon'));

document.querySelector('.menu-button').addEventListener('click', (event) => {
  const button = event.currentTarget;
  button.setAttribute('aria-expanded', button.getAttribute('aria-expanded') !== 'true');
  showToast(button.getAttribute('aria-expanded') === 'true' ? 'Menu opened' : 'Menu closed');
});

loadUploads();
