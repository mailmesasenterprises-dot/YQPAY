import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import config from '../config';

const PageDiagnostic = ({ pageName }) => {
  const { user, userType, isAuthenticated } = useAuth();
  const [apiStatus, setApiStatus] = useState('checking...');

  useEffect(() => {
    // Test API connectivity
    const testAPI = async () => {
      try {
        const response = await fetch(`${config.api.baseUrl}/health`);
        const data = await response.json();
        setApiStatus(data.success ? 'connected' : 'error');
      } catch (error) {
        setApiStatus('error: ' + error.message);
      }
    };
    testAPI();
  }, []);

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      background: '#fff',
      border: '2px solid #8b5cf6',
      borderRadius: '8px',
      padding: '15px',
      fontSize: '12px',
      zIndex: 9999,
      maxWidth: '300px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
    }}>
      <div style={{ fontWeight: 'bold', color: '#8b5cf6', marginBottom: '8px' }}>
        🔍 {pageName} Diagnostic
      </div>
      <div><strong>Auth Status:</strong> {isAuthenticated ? '✅ Logged In' : '❌ Not Logged In'}</div>
      <div><strong>User Type:</strong> {userType || 'Unknown'}</div>
      <div><strong>User Role:</strong> {user?.role || 'Unknown'}</div>
      <div><strong>API Status:</strong> {apiStatus}</div>
      <div><strong>Page Mount:</strong> ✅ Loaded</div>
      <div style={{ marginTop: '8px', fontSize: '10px', color: '#666' }}>
        If you see this, the page component is working
      </div>
    </div>
  );
};

export default PageDiagnostic;