const databaseKey = 'vicom-demo-database';
const sessionKey = 'vicom-session';
const database = getDatabase();
const session = getSession();
const user = database.users.find((item) => item.id === session?.userId || item.email === session?.email);
const form = document.querySelector('#profile-form');
const error = document.querySelector('#form-error');
const toast = document.querySelector('#toast');

function getDatabase() {
  try {
    return JSON.parse(localStorage.getItem(databaseKey)) || { users: [] };
  } catch {
    return { users: [] };
  }
}

function getSession() {
  try {
    return JSON.parse(localStorage.getItem(sessionKey));
  } catch {
    return null;
  }
}

function workspaceUrl(role) {
  return role === 'artist' ? '../Artist%20Side/index.html' : '../User%20Side/index.html';
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}

function downloadDatabase() {
  const file = new Blob([JSON.stringify(database, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(file);
  link.download = 'database.json';
  link.click();
  URL.revokeObjectURL(link.href);
}

if (!user) {
  window.location.href = 'auth.html?mode=signin';
} else {
  document.querySelector('#name').value = user.name || '';
  document.querySelector('#email').value = user.email || '';
  if (user.role === 'artist') {
    document.querySelector('.artist-only').hidden = false;
    document.querySelector('#specialty').value = user.specialty || '';
    document.querySelector('#profile-description').textContent = 'Update your artist details and account information.';
  }
  document.querySelector('#back-link').href = workspaceUrl(user.role);
}

document.querySelector('#logout').addEventListener('click', () => {
  localStorage.removeItem(sessionKey);
  window.location.href = '../Landing%20Page/index.html';
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  error.textContent = '';
  if (!user) return;
  const name = document.querySelector('#name').value.trim();
  const email = document.querySelector('#email').value.trim().toLowerCase();
  const password = document.querySelector('#password').value;
  const specialty = document.querySelector('#specialty').value.trim();
  const duplicate = database.users.find((item) => item.email === email && item.id !== user.id);

  if (!name || !email) {
    error.textContent = 'Name and email are required.';
    return;
  }
  if (duplicate) {
    error.textContent = 'That email is already being used by another account.';
    return;
  }
  if (password && password.length < 6) {
    error.textContent = 'Use a password with at least 6 characters.';
    return;
  }
  user.name = name;
  user.email = email;
  if (user.role === 'artist') user.specialty = specialty;
  if (password) user.password = password;
  localStorage.setItem(databaseKey, JSON.stringify(database));
  downloadDatabase();
  localStorage.setItem(sessionKey, JSON.stringify({ userId: user.id, email: user.email, role: user.role }));
  showToast('Profile updated');
  setTimeout(() => { window.location.href = workspaceUrl(user.role); }, 350);
});
