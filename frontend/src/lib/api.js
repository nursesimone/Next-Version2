import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API_BASE = `${BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('nurse_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('nurse_token');
      localStorage.removeItem('nurse_data');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
};

// Patients API
export const patientsAPI = {
  list: () => api.get('/patients'),
  get: (id) => api.get(`/patients/${id}`),
  create: (data) => api.post('/patients', data),
  update: (id, data) => api.put(`/patients/${id}`, data),
  delete: (id) => api.delete(`/patients/${id}`),
};

// Visits API
export const visitsAPI = {
  list: (patientId) => api.get(`/patients/${patientId}/visits`),
  get: (visitId) => api.get(`/visits/${visitId}`),
  getLast: (patientId) => api.get(`/patients/${patientId}/visits/last`),
  create: (patientId, data) => api.post(`/patients/${patientId}/visits`, data),
  update: (visitId, data) => api.put(`/visits/${visitId}`, data),
  delete: (visitId) => api.delete(`/visits/${visitId}`),
};

// Unable to Contact API
export const unableToContactAPI = {
  list: (patientId) => api.get(`/patients/${patientId}/unable-to-contact`),
  get: (recordId) => api.get(`/unable-to-contact/${recordId}`),
  create: (data) => api.post('/unable-to-contact', data),
  delete: (recordId) => api.delete(`/unable-to-contact/${recordId}`),
};

// Interventions API
export const interventionsAPI = {
  list: (patientId) => api.get(`/patients/${patientId}/interventions`),
  get: (interventionId) => api.get(`/interventions/${interventionId}`),
  create: (data) => api.post('/interventions', data),
  update: (interventionId, data) => api.put(`/interventions/${interventionId}`, data),
  delete: (interventionId) => api.delete(`/interventions/${interventionId}`),
};

// Reports API
export const reportsAPI = {
  getMonthly: (data) => api.post('/reports/monthly', data),
};

export default api;
