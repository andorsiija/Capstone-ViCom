const artistId = new URLSearchParams(window.location.search).get('id');
const apiUrl = 'api.php?action=artist&id=';
const nameElement = document.querySelector('#artist-name');
const specialtyElement = document.querySelector('#artist-specialty');
const avatarElement = document.querySelector('#artist-avatar');
const grid = document.querySelector('#portfolio-grid');
const empty = document.querySelector('#empty-state');
const count = document.querySelector('#work-count');
const toast = document.querySelector('#toast');

async function getFallbackProfile() {
  try {
    const storedDatabase = JSON.parse(localStorage.getItem('vicom-demo-database')) || {};
    let seedDatabase = {};
    try {
      const response = await fetch('../Account%20functions/database.json');
      if (response.ok) seedDatabase = await response.json();
    } catch (error) {
      seedDatabase = {};
    }

    const users = [...(seedDatabase.users || []), ...(storedDatabase.users || [])];
    const artworks = [...(seedDatabase.artworks || []), ...(storedDatabase.artworks || [])];
    const artist = [...users].reverse().find((user) => user.id === artistId && user.role === 'artist');
    const artistArtworks = artworks.filter((work) => (work.artistId || work.artist_id) === artistId);
    const profileViews = incrementFallbackViews();
    if (artist) return { artist: { ...artist, profileViews }, artworks: artistArtworks };
    if (artistId === 'artist_studio_sola') {
      return {
        artist: { id: artistId, name: 'Studio Sola', specialty: 'Warm visual identity system', role: 'artist', profileViews },
        artworks: [{ title: 'Brand, but human', detail: 'Warm visual identity system', price: '$120', category: 'Design', image: 'https://images.unsplash.com/photo-1561214115-f2f134cc4912?w=700&q=85' }]
      };
    }
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
    if (!response.ok) throw new Error('Profile unavailable');
    renderProfile(await response.json());
  } catch (error) {
    const fallback = await getFallbackProfile();
    if (fallback) renderProfile(fallback);
    else {
      nameElement.textContent = 'Artist not found';
      empty.hidden = false;
      empty.textContent = 'This artist profile is not available right now.';
    }
  }
}

document.querySelector('#commission-button').addEventListener('click', () => {
  if (typeof window.startCommissionRequest === 'function') {
    window.startCommissionRequest(artistId, nameElement.textContent);
  }
});
loadProfile();
