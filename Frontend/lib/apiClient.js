import { apiUrl } from '../constants';

/**
 * Centralized API client with error handling and retry logic
 */
class ApiClient {
  constructor() {
    this.baseURL = apiUrl('');
    this.defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
      },
    };
  }

  /**
   * Generic request method with retry logic
   */
  async request(endpoint, options = {}, retries = 2) {
    const url = endpoint.startsWith('http') ? endpoint : apiUrl(endpoint);
    
    for (let i = 0; i <= retries; i++) {
      try {
        const response = await fetch(url, {
          ...this.defaultOptions,
          ...options,
          headers: {
            ...this.defaultOptions.headers,
            ...options.headers,
          },
        });

        if (!response.ok) {
          const error = await this.handleError(response);
          
          // Don't retry on client errors (4xx)
          if (response.status >= 400 && response.status < 500) {
            throw error;
          }
          
          // Retry on server errors (5xx)
          if (i === retries) {
            throw error;
          }
          
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
          continue;
        }

        return await response.json();
      } catch (error) {
        // Network error or other exception
        if (i === retries) {
          throw new Error(`Network error: ${error.message}`);
        }
        
        // Exponential backoff for network errors
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
      }
    }
  }

  /**
   * Handle API errors
   */
  async handleError(response) {
    let errorMessage = 'An error occurred';
    
    try {
      const data = await response.json();
      errorMessage = data.message || data.error || errorMessage;
    } catch (e) {
      errorMessage = response.statusText || errorMessage;
    }
    
    const error = new Error(errorMessage);
    error.status = response.status;
    error.response = response;
    return error;
  }

  /**
   * GET request
   */
  async get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  /**
   * POST request
   */
  async post(endpoint, data, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * PUT request
   */
  async put(endpoint, data, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * DELETE request
   */
  async delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }

  /**
   * POST request with FormData (for file uploads)
   */
  async postFormData(endpoint, formData, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : apiUrl(endpoint);
    
    try {
      const response = await fetch(url, {
        ...options,
        method: 'POST',
        body: formData,
        // Don't set Content-Type for FormData - browser sets it with boundary
      });

      if (!response.ok) {
        const error = await this.handleError(response);
        throw error;
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Network error: ${error.message}`);
    }
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export convenience methods
export const api = {
  get: (endpoint, options) => apiClient.get(endpoint, options),
  post: (endpoint, data, options) => apiClient.post(endpoint, data, options),
  put: (endpoint, data, options) => apiClient.put(endpoint, data, options),
  delete: (endpoint, options) => apiClient.delete(endpoint, options),
  postFormData: (endpoint, formData, options) => apiClient.postFormData(endpoint, formData, options),
};

export default api;
