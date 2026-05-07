const API_BASE_URL = (window.AURASLEEP_CONFIG?.API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
const TOKEN_KEY = 'aurasleep_token';

export function apiUrl(path) {
  return `${API_BASE_URL}${path}`;
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  // Reset các biến global hoặc gọi hàm reset từ các module khác nếu cần
  document.querySelectorAll('.header-greeting h2').forEach(el => {
    el.textContent = 'AURASLEEP';
  });
  document.querySelectorAll('.avatar').forEach(el => {
    el.textContent = 'AS';
  });
}

export async function apiFetch(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = getToken();

  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(apiUrl(path), { ...options, headers });

  if (response.status === 401) {
    clearSession();
    window.location.hash = 'login';
    location.reload();
  }

  return response;
}

// Gán vào window để debug nếu cần
window.apiFetch = apiFetch;
