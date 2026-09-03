const tabs = document.querySelectorAll('.tab');
const cards = document.querySelectorAll('.art-card');
const toast = document.querySelector('#toast');
let toastTimer;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    tabs.forEach((item) => item.classList.remove('active'));
    tab.classList.add('active');
    const category = tab.dataset.category;
    cards.forEach((card) => {
      card.classList.toggle('hidden', category !== 'all' && card.dataset.category !== category);
    });
  });
});

document.querySelectorAll('[data-toast]').forEach((button) => {
  button.addEventListener('click', () => showToast(button.dataset.toast));
});

document.querySelectorAll('.heart').forEach((button) => {
  button.addEventListener('click', () => {
    button.classList.toggle('saved');
    button.textContent = button.classList.contains('saved') ? '♥' : '♡';
    showToast(button.classList.contains('saved') ? 'Saved to your collection' : 'Removed from your collection');
  });
});

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
