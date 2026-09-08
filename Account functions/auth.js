const databaseKey = 'vicom-demo-database';
const sessionKey = 'vicom-session';
const apiUrl = 'api.php';
const modes = {
  signin: { eyebrow: 'Welcome back', title: 'Sign in to ViCom', description: 'Continue exploring artists and managing your commissions.', submit: 'Sign in', switch: 'New to ViCom?', switchAction: 'Create an account', switchMode: 'signup' },
  signup: { eyebrow: 'Start creating', title: 'Create your account', description: 'Save artists and turn your next idea into a commission.', submit: 'Create account', switch: 'Already have an account?', switchAction: 'Sign in', switchMode: 'signin' },
  artist: { eyebrow: 'For independent creatives', title: 'Join as an artist', description: 'Create your artist profile and start receiving commission requests.', submit: 'Create artist profile', switch: 'Already have an account?', switchAction: 'Sign in', switchMode: 'signin' }
};

let currentMode = new URLSearchParams(window.location.search).get('mode') || 'signin';
if (!modes[currentMode]) currentMode = 'signin';
const form = document.querySelector('#auth-form');
const error = document.querySelector('#form-error');
const toast = document.querySelector('#toast');

function getDatabase() {
  try {
    return JSON.parse(localStorage.getItem(databaseKey)) || { users: [] };
  } catch {
    return { users: [] };
  }
}

function saveDatabase(database) {
  localStorage.setItem(databaseKey, JSON.stringify(database));
}

function downloadDatabase(database) {
  const file = new Blob([JSON.stringify(database, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(file);
  link.download = 'database.json';
  link.click();
  URL.revokeObjectURL(link.href);
}

function cacheUser(user) {
  const database = getDatabase();
  database.users = database.users || [];
  const index = database.users.findIndex((item) => item.id === user.id);
  const cachedUser = { ...user, password: '' };
  if (index >= 0) database.users[index] = { ...database.users[index], ...cachedUser };
  else database.users.push(cachedUser);
  localStorage.setItem(databaseKey, JSON.stringify(database));
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

function setMode(mode) {
  currentMode = mode;
  const copy = modes[mode];
  document.querySelectorAll('.mode-tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.mode === mode));
  document.querySelector('#form-eyebrow').innerHTML = `<span></span> ${copy.eyebrow}`;
  document.querySelector('#form-title').textContent = copy.title;
  document.querySelector('#form-description').textContent = copy.description;
  document.querySelector('#submit-button').innerHTML = `${copy.submit} <span>↗</span>`;
  document.querySelector('#switch-copy').innerHTML = `${copy.switch} <button type="button" data-mode="${copy.switchMode}">${copy.switchAction}</button>`;
  document.querySelectorAll('.artist-only').forEach((field) => { field.hidden = mode !== 'artist'; });
  document.querySelector('.name-field').hidden = mode === 'signin';
  document.querySelector('#password').autocomplete = mode === 'signin' ? 'current-password' : 'new-password';
  error.textContent = '';
  const url = new URL(window.location.href);
  url.searchParams.set('mode', mode);
  window.history.replaceState({}, '', url);
}

function redirectFor(role) {
  window.location.href = role === 'artist' ? '../Artist%20Side/index.html' : '../User%20Side/index.html';
}

document.addEventListener('click', (event) => {
  const trigger = event.target.closest('[data-mode]');
  if (trigger) setMode(trigger.dataset.mode);
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  error.textContent = '';
  const data = new FormData(form);
  const email = data.get('email').trim().toLowerCase();
  const password = data.get('password');
  if (!email || !password) {
    error.textContent = 'Enter your email and password to continue.';
    return;
  }
  if (currentMode === 'signin') {
    await submitAccount('login', { email, password });
    return;
  }
  const isArtist = currentMode === 'artist';
  const name = (isArtist ? data.get('artistName') : data.get('name')).trim();
  if (!name) {
    error.textContent = isArtist ? 'Add your artist or studio name.' : 'Add your name to create an account.';
    return;
  }
  if (password.length < 6) {
    error.textContent = 'Use a password with at least 6 characters.';
    return;
  }
  await submitAccount('register', { email, password, name, role: isArtist ? 'artist' : 'customer', specialty: isArtist ? data.get('specialty').trim() : '' });
});

async function submitAccount(action, payload) {
  try {
    const response = await fetch(`${apiUrl}?action=${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Account request failed.');
    const user = result.user;
    cacheUser(user);
    localStorage.setItem(sessionKey, JSON.stringify({ userId: user.id, email: user.email, role: user.role }));
    showToast(action === 'login' ? 'Signed in successfully' : user.role === 'artist' ? 'Artist profile created' : 'Account created');
    setTimeout(() => redirectFor(user.role), 350);
  } catch (requestError) {
    error.textContent = requestError.message.includes('Failed to fetch') ? 'Could not connect to XAMPP. Start Apache/MySQL and open the project through localhost.' : requestError.message;
  }
}

setMode(currentMode);
