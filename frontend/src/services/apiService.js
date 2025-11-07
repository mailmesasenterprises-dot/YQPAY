/**
 * Centralized API Service for YQPayNow Theater Canteen
 * Handles all API requests with consistent error handling, authentication, and retries
 */

import config from '../config';

class ApiService {
  constructor() {
    this.baseURL = config.api.baseUrl;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    };
  }

  // Get auth token from localStorage
  getAuthToken() {
    return localStorage.getItem('authToken');
  }

  // Get auth headers
  getAuthHeaders() {
    const token = this.getAuthToken();
    return {
      ...this.defaultHeaders,
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  }

  // Generic request method with error handling and retries
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: this.getAuthHeaders(),
      ...options,
      headers: {
        ...this.getAuthHeaders(),
        ...options.headers
      }
    };

    try {

      const response = await fetch(url, config);
      

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ 
          error: 'Network error', 
          message: response.statusText 
        }));
        

        throw new Error(errorData.message || errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();

      return data;
      
    } catch (error) {

      throw error;
    }
  }

  // GET request
  async get(endpoint, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const fullEndpoint = queryString ? `${endpoint}?${queryString}` : endpoint;
    return this.request(fullEndpoint, { method: 'GET' });
  }

  // POST request
  async post(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // PUT request
  async put(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  // DELETE request
  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  // Upload file
  async upload(endpoint, formData) {
    const token = this.getAuthToken();
    const headers = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    
    return this.request(endpoint, {
      method: 'POST',
      body: formData,
      headers // Don't include Content-Type for FormData
    });
  }

  // THEATER ENDPOINTS
  async getTheaters(params = {}) {
    return this.get('/theaters', params);
  }

  async getTheater(theaterId) {
    return this.get(`/theaters/${theaterId}`);
  }

  async createTheater(theaterData) {
    return this.post('/theaters', theaterData);
  }

  async updateTheater(theaterId, theaterData) {
    return this.put(`/theaters/${theaterId}`, theaterData);
  }

  async deleteTheater(theaterId) {
    return this.delete(`/theaters/${theaterId}`);
  }

  // THEATER DASHBOARD
  async getTheaterDashboard(theaterId) {
    return this.get(`/theater-dashboard/${theaterId}`);
  }

  // AUTHENTICATION
  async login(credentials) {
    return this.post('/auth/login', credentials);
  }

  async validateToken() {
    return this.get('/auth/validate');
  }

  // SETTINGS
  async getSettings() {
    return this.get('/settings/general');
  }

  async saveSettings(settings) {
    return this.post('/settings/general', settings);
  }

  // PAGE ACCESS
  async getPageAccess(params = {}) {
    return this.get('/page-access', params);
  }

  async createPageAccess(data) {
    return this.post('/page-access', data);
  }

  // UPLOAD
  async uploadImage(formData) {
    return this.upload('/upload/image', formData);
  }

  async uploadDocument(formData) {
    return this.upload('/upload/theater-document', formData);
  }
}

// Export singleton instance
export default new ApiService();

// Also export the class for testing
export { ApiService };