const uploads = [
  { title: 'After the rain', artist: 'Mara Velez', detail: 'Watercolor portrait', price: '$95', category: 'Portrait', style: 'upload-one' },
  { title: 'Tiny universes', artist: 'Noah Kim', detail: 'Editorial illustration', price: '$70', category: 'Illustration', style: 'upload-two' },
  { title: 'Soft machinery', artist: 'Studio Sola', detail: 'Identity and art direction', price: '$120', category: 'Design', style: 'upload-three' },
  { title: 'A room for Sunday', artist: 'Lina Aoki', detail: 'Oil and digital collage', price: '$140', category: 'Painting', style: 'upload-four' },
  { title: 'Moonflower club', artist: 'Theo March', detail: 'Ink and character art', price: '$60', category: 'Illustration', style: 'upload-five' },
  { title: 'Things we carry', artist: 'Ines Studio', detail: 'Fine line and lettering', price: '$110', category: 'Tattoo design', style: 'upload-six' }
];

const grid = document.querySelector('#upload-grid');
const toast = document.querySelector('#toast');
let toastTimer;

function shuffled(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function renderUploads() {
  grid.innerHTML = shuffled(uploads).map((upload) => `
    <article class="upload-card">
      <div class="upload-image ${upload.style}"><span class="category">${upload.category}</span><button class="heart" type="button" aria-label="Save ${upload.title}" data-title="${upload.title}">♡</button></div>
      <div class="upload-meta"><div><h3>${upload.title}</h3><p>by ${upload.artist} · ${upload.detail}</p></div><strong>from ${upload.price}</strong></div>
    </article>
  `).join('');
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

document.querySelector('#shuffle-button').addEventListener('click', () => {
  renderUploads();
  showToast('Fresh uploads shuffled');
});
document.querySelectorAll('[data-toast]').forEach((button) => button.addEventListener('click', () => showToast(button.dataset.toast)));
renderUploads();
