import axios from 'axios';

const BASE = process.env.REACT_APP_BACKEND_URL || '';

export const api = axios.create({ baseURL: `${BASE}/api` });

api.interceptors.request.use((config) => {
  const t = localStorage.getItem('mlm_token');
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401 && !String(err.config?.url).includes('/auth/login')) {
      localStorage.removeItem('mlm_token');
      localStorage.removeItem('mlm_user');
      if (window.location.pathname !== '/login') window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const errMsg = (e) =>
  e?.response?.data?.detail || e?.message || 'Terjadi kesalahan, coba lagi';

export const downloadCsv = async (path, filename) => {
  const t = localStorage.getItem('mlm_token');
  const res = await fetch(`${BASE}/api${path}`, { headers: { Authorization: `Bearer ${t}` } });
  if (!res.ok) throw new Error('Gagal mengunduh');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};
