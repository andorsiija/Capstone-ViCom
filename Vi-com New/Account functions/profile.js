const sessionKey = 'vicom-session';
const databaseKey = 'vicom-demo-database';
const form = document.querySelector('#profile-form');
const error = document.querySelector('#form-error');
const toast = document.querySelector('#toast');
const nameInput = document.querySelector('#name');
const emailInput = document.querySelector('#email');
const specialtyInput = document.querySelector('#specialty');
const passwordInput = document.querySelector('#password');

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
  setTimeout(() => toast.classList.remove('show'), 2400);
}

function cacheUser(user) {
  try {
    const database = JSON.parse(localStorage.getItem(databaseKey) || '{"users":[]}');
    database.users = database.users || [];
    const index = database.users.findIndex((item) => item.id === user.id);
    const cachedUser = { ...user, password: '' };
    if (index >= 0) database.users[index] = { ...database.users[index], ...cachedUser };
    else database.users.push(cachedUser);
    localStorage.setItem(databaseKey, JSON.stringify(database));
  } catch {}
}

function fillProfile(user) {
  nameInput.value = user.name || '';
  emailInput.value = user.email || '';
  specialtyInput.value = user.specialty || '';
  document.querySelectorAll('.artist-only').forEach((field) => {
    field.hidden = user.role !== 'artist';
  });
}

async function loadProfile(session) {
  const response = await fetch(`api.php?action=profile&id=${encodeURIComponent(session.userId)}`);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Could not load your profile.');
  fillProfile(result.user);
  cacheUser(result.user);
  return result.user;
}

const session = getSession();
if (!session?.userId) {
  window.location.href = 'auth.html?mode=signin';
} else {
  loadProfile(session).catch(() => {
    if (session.name || session.email) fillProfile({ ...session, specialty: session.specialty || '' });
    else error.textContent = 'Could not load your profile. Start XAMPP and try again.';
  });
}

document.querySelector('#back-link').href = session?.role === 'artist'
  ? '../Artist%20Side/index.html'
  : '../User%20Side/index.html';

document.querySelector('#logout').addEventListener('click', () => {
  localStorage.removeItem(sessionKey);
  window.location.href = '../LandingPage/index.html';
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  error.textContent = '';

  const name = nameInput.value.trim();
  const email = emailInput.value.trim().toLowerCase();
  const specialty = specialtyInput.value.trim();
  const password = passwordInput.value;
  if (!name || !email) {
    error.textContent = 'Name and email are required.';
    return;
  }
  if (password && password.length < 6) {
    error.textContent = 'Use a password with at least 6 characters.';
    return;
  }

  const submitButton = form.querySelector('.submit-button');
  submitButton.disabled = true;
  try {
    const response = await fetch('api.php?action=update_profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: session.userId, name, email, specialty, password }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Could not save your profile.');

    const user = { ...result.user, role: session.role };
    cacheUser(user);
    localStorage.setItem(sessionKey, JSON.stringify({
      ...session,
      email: user.email,
      name: user.name,
      specialty: user.specialty || '',
    }));
    passwordInput.value = '';
    fillProfile(user);
    showToast('Profile updated');
  } catch (requestError) {
    error.textContent = requestError.message.includes('Failed to fetch')
      ? 'Could not connect to XAMPP. Start Apache/MySQL and open the project through localhost.'
      : requestError.message;
  } finally {
    submitButton.disabled = false;
  }
});
