// API Configuration for production deployment
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost';

export const API_ENDPOINTS = {
  // Authentication Service (Port 7005)
  AUTH: `${API_BASE_URL}:7005`,
  LOGIN: `${API_BASE_URL}:7005/auth/login`,
  LOGOUT: `${API_BASE_URL}:7005/auth/logout`,
  REGISTER: `${API_BASE_URL}:7005/auth/register`,
  
  // Client Service (Port 6001) 
  CLIENT: `${API_BASE_URL}:6001`,
  EVENTS: `${API_BASE_URL}:6001/api/events`,
  BOOKINGS: `${API_BASE_URL}:6001/api/bookings`,
  
  // Admin Service (Port 5001)
  ADMIN: `${API_BASE_URL}:5001`,
  ADMIN_EVENTS: `${API_BASE_URL}:5001/api/admin/events`,
  
  // LLM Service (Port 5003)
  LLM: `${API_BASE_URL}:5003`,
  CHAT: `${API_BASE_URL}:5003/api/chat`
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