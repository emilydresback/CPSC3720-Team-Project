// API Configuration for production deployment
const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://tigertix-production.up.railway.app';

export const API_ENDPOINTS = {
  // All services run on the same port in production
  AUTH: `${API_BASE_URL}`,
  LOGIN: `${API_BASE_URL}/api/auth/login`,
  LOGOUT: `${API_BASE_URL}/api/auth/logout`,
  REGISTER: `${API_BASE_URL}/api/auth/register`,
  
  // Client Service
  CLIENT: `${API_BASE_URL}`,
  EVENTS: `${API_BASE_URL}/api/events`,
  BOOKINGS: `${API_BASE_URL}/api/bookings`,
  
  // Admin Service
  ADMIN: `${API_BASE_URL}`,
  ADMIN_EVENTS: `${API_BASE_URL}/api/admin/events`,
  
  // LLM Service
  LLM: `${API_BASE_URL}`,
  CHAT: `${API_BASE_URL}/api/chat`
};

// Fetch wrapper with error handling
export const apiRequest = async (url, options = {}) => {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      credentials: 'include',
      ...options
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
};