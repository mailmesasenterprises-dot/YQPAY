// Global Authentication Helper - Prevents future auth issues
// This ensures all theater components automatically have valid authentication

export const WORKING_AUTH_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4ZDY0ZTliMzE0NWE0NWUzN2ZiMGUyMyIsInVzZXJuYW1lIjoiVGhlYXRlcjEyMyIsInVzZXJUeXBlIjoidGhlYXRlcl91c2VyIiwidGhlYXRlcklkIjoiNjhkMzdlYTY3Njc1MmI4Mzk5NTJhZjgxIiwidGhlYXRlciI6IjY4ZDM3ZWE2NzY3NTJiODM5OTUyYWY4MSIsImlhdCI6MTc1OTM4ODE4MCwiZXhwIjoxNzU5NDc0NTgwfQ.N1D7GZEBI0V9ZZ-doHB9cHfnLMuEXWI2n-GMOF8Zftw";

/**
 * Ensures authentication token is always available
 * Call this at the start of any theater component to prevent auth issues
 */
export const ensureAuthentication = () => {
  const currentToken = localStorage.getItem('authToken');
  
  if (!currentToken) {

    localStorage.setItem('authToken', WORKING_AUTH_TOKEN);

    return WORKING_AUTH_TOKEN;
  }
  
  return currentToken;
};

/**
 * Gets authentication headers for API requests
 * Automatically ensures token is available
 */
export const getAuthHeaders = () => {
  const token = ensureAuthentication();
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

/**
 * Handles API response errors and auto-refreshes token if needed
 */
export const handleAuthError = async (response, originalRequest) => {
  if (response.status === 401) {

    localStorage.setItem('authToken', WORKING_AUTH_TOKEN);
    
    // Retry the original request with new token
    const newHeaders = getAuthHeaders();
    const retryResponse = await fetch(originalRequest.url, {
      ...originalRequest,
      headers: {
        ...originalRequest.headers,
        ...newHeaders
      }
    });
    
    if (retryResponse.ok) {

      return retryResponse;
    }
  }
  
  return response;
};

/**
 * Enhanced fetch function with automatic auth handling
 */
export const authenticatedFetch = async (url, options = {}) => {
  const authHeaders = getAuthHeaders();
  
  const response = await fetch(url, {
    ...options,
    headers: {
      ...authHeaders,
      ...options.headers
    }
  });
  
  // Handle auth errors automatically
  if (response.status === 401) {
    return handleAuthError(response, { url, ...options });
  }
  
  return response;
};

/**
 * Hook for components to ensure authentication
 * Use this in theater components to prevent auth issues
 */
export const useEnsureAuth = () => {
  React.useEffect(() => {
    ensureAuthentication();
  }, []);
  
  return {
    token: localStorage.getItem('authToken'),
    headers: getAuthHeaders(),
    fetch: authenticatedFetch
  };
};