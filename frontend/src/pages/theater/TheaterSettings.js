import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import TheaterLayout from '../../components/theater/TheaterLayout';
import PageContainer from '../../components/PageContainer';
import { FormGroup, FormInput, FormSection, Button } from '../../components/GlobalDesignSystem';
import ErrorBoundary from '../../components/ErrorBoundary';
import config from '../../config';
import '../../styles/Settings.css';

function TheaterSettings() {
  const { theaterId } = useParams();
  const navigate = useNavigate();
  const { user, theaterId: userTheaterId, userType } = useAuth();
  
  // Add immediate debug logging

  const [activeTab, setActiveTab] = useState('profile');
  const [theaterData, setTheaterData] = useState({
    _id: '',
    name: '',
    location: {
      address: '',
      city: '',
      state: '',
      pincode: ''
    },
    contact: {
      email: '',
      phone: ''
    },
    description: ''
  });
  const [documents, setDocuments] = useState({
    logo: null,
    license: null,
    gstCertificate: null
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Function to clear all caches and refresh
  const handleRefreshAndClearCache = () => {

    // Clear localStorage
    const authToken = localStorage.getItem('authToken');
    const userId = localStorage.getItem('userId');
    const userType = localStorage.getItem('userType');
    const theaterId = localStorage.getItem('theaterId');
    
    localStorage.clear();
    
    // Restore essential auth data
    if (authToken) localStorage.setItem('authToken', authToken);
    if (userId) localStorage.setItem('userId', userId);
    if (userType) localStorage.setItem('userType', userType);
    if (theaterId) localStorage.setItem('theaterId', theaterId);
    
    // Clear sessionStorage
    sessionStorage.clear();
    
    // Clear browser cache using cache API if available
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => {
          caches.delete(name);
        });
      });
    }
    
    // Show success message
    alert('✅ Cache cleared successfully! Page will refresh.');
    
    // Reload the page to refresh everything
    window.location.reload();
  };

  // Header button for clearing cache
  const headerButton = (
    <button
      type="button"
      className="header-btn"
      onClick={handleRefreshAndClearCache}
      style={{
        backgroundColor: '#8B5CF6',
        color: 'white',
        border: 'none',
        padding: '10px 16px',
        borderRadius: '8px',
        fontSize: '14px',
        fontWeight: '600',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        transition: 'all 0.2s ease'
      }}
      onMouseOver={(e) => e.target.style.backgroundColor = '#7C3AED'}
      onMouseOut={(e) => e.target.style.backgroundColor = '#8B5CF6'}
    >
      <span style={{ fontSize: '16px' }}>🔄</span>
      Clear Cache & Refresh
    </button>
  );

  const tabs = [
    { id: 'profile', label: 'Theater Profile', icon: '🏢' },
    { id: 'documents', label: 'Documents', icon: '📄' },
    { id: 'preferences', label: 'Preferences', icon: '⚙️' }
  ];

  // Handle input changes for nested objects
  const handleInputChange = (field, value, nestedField = null) => {
    setTheaterData(prev => {
      if (nestedField) {
        return {
          ...prev,
          [field]: {
            ...prev[field],
            [nestedField]: value
          }
        };
      } else {
        return {
          ...prev,
          [field]: value
        };
      }
    });
  };

  useEffect(() => {

    // TEMPORARY: For existing sessions without theater ID, try to get it from user data
    let effectiveTheaterId = theaterId || userTheaterId;
    
    // If still no theater ID, try to extract from user data
    if (!effectiveTheaterId && user) {
      if (user.assignedTheater) {
        effectiveTheaterId = user.assignedTheater._id || user.assignedTheater;
  } else if (user.theater) {
        effectiveTheaterId = user.theater._id || user.theater;
  }
    }
    

    // Security check: Ensure user can only access their assigned theater
    if (userType === 'theater-admin' && userTheaterId && theaterId !== userTheaterId) {
      // Redirect to their own theater settings if trying to access another theater

      navigate(`/theater/settings/${userTheaterId}`);
      return;
    }

    // If no theaterId in URL but we found one, redirect to proper URL
    if (!theaterId && effectiveTheaterId) {

      navigate(`/theater/settings/${effectiveTheaterId}`);
      return;
    }

    // If theaterId exists, fetch that theater's data
    if (effectiveTheaterId) {

      fetchTheaterData(effectiveTheaterId);
    } else {

      setError('Theater ID not found. Please login again.');
      // For development: Show demo data if no theater ID
      setTheaterData({
        _id: 'demo-theater-id',
        name: 'Demo Theater',
        location: {
          address: '123 Theater Street',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400001'
        },
        contact: {
          email: 'theater@demo.com',
          phone: '9876543210'
        },
        description: 'Premier movie theater experience'
      });
    }
  }, [theaterId, userTheaterId, userType, navigate, user]);

  const fetchTheaterData = async (theaterIdToFetch) => {
    try {
      setLoading(true);
      setError('');
      

      const token = localStorage.getItem('authToken');
      const url = `${config.api.baseUrl}/theaters/${theaterIdToFetch}`;
      

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });


      if (!response.ok) {
        const errorData = await response.json();

        throw new Error(errorData.error || 'Failed to fetch theater data');
      }

      const data = await response.json();

      // ✅ FIX: Backend returns data.data, not data.theater
      if (data.success && data.data) {

        setTheaterData({
          _id: data.data._id || theaterIdToFetch,
          name: data.data.name || '',
          location: {
            address: data.data.location?.address || '',
            city: data.data.location?.city || '',
            state: data.data.location?.state || '',
            pincode: data.data.location?.pincode || ''
          },
          contact: {
            email: data.data.contact?.email || '',
            phone: data.data.contact?.phone || ''
          },
          description: data.data.description || ''
        });
      } else {

        setError('Invalid data received from server');
      }
    } catch (err) {

      setError(`Unable to load theater data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setError('');
      

      const token = localStorage.getItem('authToken');
      const url = `${config.api.baseUrl}/theaters/${theaterId}`;
      

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(theaterData),
      });


      if (!response.ok) {
        const errorData = await response.json();

        throw new Error(errorData.error || 'Failed to save theater data');
      }

      const data = await response.json();

      if (data.success) {
        alert('✅ Theater data saved successfully!');
        // Refresh the data
        fetchTheaterData(theaterId);
      } else {
        setError(data.message || 'Failed to save theater data');
      }
    } catch (error) {

      setError(`Unable to save theater data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (documentType, file) => {
    try {
      setLoading(true);
      // Google Cloud Storage upload will be implemented

      setDocuments(prev => ({ ...prev, [documentType]: file }));
    } catch (error) {
  } finally {
      setLoading(false);
    }
  };

  return (
    <ErrorBoundary>
      <TheaterLayout pageTitle="Theater Settings" currentPage="settings">
        <PageContainer
          title="Theater Settings"
          headerButton={headerButton}
        >
          <div className="settings-container">
            {/* Settings Tabs */}
            <div className="settings-tabs">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <span className="tab-icon">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Settings Content */}
            <div className="settings-content">
              {/* Theater Profile Tab */}
              {activeTab === 'profile' && (
                <div className="settings-section">
                  <div className="section-header">
                    <h3>Theater Profile</h3>
                  </div>
                  
                  <div className="config-grid">
                    <FormGroup label="Theater Name" required>
                      <FormInput
                        type="text"
                        value={theaterData.name}
                        onChange={(e) => setTheaterData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Enter theater name"
                      />
                    </FormGroup>

                    <FormGroup label="Contact Email" required>
                      <FormInput
                        type="email"
                        value={theaterData.contact.email}
                        onChange={(e) => setTheaterData(prev => ({ 
                          ...prev, 
                          contact: { ...prev.contact, email: e.target.value }
                        }))}
                        placeholder="Enter contact email"
                      />
                    </FormGroup>

                    <FormGroup label="Contact Phone" required>
                      <FormInput
                        type="tel"
                        value={theaterData.contact.phone}
                        onChange={(e) => setTheaterData(prev => ({ 
                          ...prev, 
                          contact: { ...prev.contact, phone: e.target.value }
                        }))}
                        placeholder="Enter contact phone"
                      />
                    </FormGroup>

                    <FormGroup label="City" required>
                      <FormInput
                        type="text"
                        value={theaterData.location.city}
                        onChange={(e) => setTheaterData(prev => ({ 
                          ...prev, 
                          location: { ...prev.location, city: e.target.value }
                        }))}
                        placeholder="Enter city"
                      />
                    </FormGroup>

                    <FormGroup label="State" required>
                      <FormInput
                        type="text"
                        value={theaterData.location.state}
                        onChange={(e) => setTheaterData(prev => ({ 
                          ...prev, 
                          location: { ...prev.location, state: e.target.value }
                        }))}
                        placeholder="Enter state"
                      />
                    </FormGroup>

                    <FormGroup label="Pincode" required>
                      <FormInput
                        type="text"
                        value={theaterData.location.pincode}
                        onChange={(e) => setTheaterData(prev => ({ 
                          ...prev, 
                          location: { ...prev.location, pincode: e.target.value }
                        }))}
                        placeholder="Enter pincode"
                      />
                    </FormGroup>
                  </div>

                  <FormGroup label="Address" required>
                    <textarea
                      className="form-input config-textarea"
                      value={theaterData.location.address}
                      onChange={(e) => setTheaterData(prev => ({ 
                        ...prev, 
                        location: { ...prev.location, address: e.target.value }
                      }))}
                      placeholder="Enter complete address"
                      rows="3"
                    />
                  </FormGroup>

                  <FormGroup label="Description">
                    <textarea
                      className="form-input config-textarea"
                      value={theaterData.description}
                      onChange={(e) => setTheaterData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Enter theater description"
                      rows="4"
                    />
                  </FormGroup>

                  <div className="action-buttons">
                    <Button 
                      variant="primary" 
                      onClick={handleSave}
                      disabled={loading}
                      className="btn-primary"
                    >
                      {loading ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Documents Tab */}
              {activeTab === 'documents' && (
                <div className="settings-section">
                  <div className="section-header">
                    <h3>Theater Documents</h3>
                  </div>
                  
                  <div className="documents-grid">
                    <div className="document-upload">
                      <h4>Theater Logo</h4>
                      <p>Upload your theater logo (PNG, JPG, GIF - Max 5MB)</p>
                      <div className="upload-area">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileUpload('logo', e.target.files[0])}
                          className="form-input"
                        />
                        <div style={{ marginTop: '8px', fontSize: '12px', color: '#6b7280' }}>
                          Recommended size: 200x200 pixels
                        </div>
                      </div>
                    </div>

                    <div className="document-upload">
                      <h4>Business License</h4>
                      <p>Upload business license document (PDF, JPG, PNG - Max 10MB)</p>
                      <div className="upload-area">
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => handleFileUpload('license', e.target.files[0])}
                          className="form-input"
                        />
                        <div style={{ marginTop: '8px', fontSize: '12px', color: '#6b7280' }}>
                          Official business registration document
                        </div>
                      </div>
                    </div>

                    <div className="document-upload">
                      <h4>GST Certificate</h4>
                      <p>Upload GST registration certificate (PDF, JPG, PNG - Max 10MB)</p>
                      <div className="upload-area">
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => handleFileUpload('gstCertificate', e.target.files[0])}
                          className="form-input"
                        />
                        <div style={{ marginTop: '8px', fontSize: '12px', color: '#6b7280' }}>
                          Valid GST registration document
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Preferences Tab */}
              {activeTab === 'preferences' && (
                <div className="settings-section">
                  <div className="section-header">
                    <h3>Theater Preferences</h3>
                  </div>
                  
                  <div className="config-grid">
                    <FormGroup label="Default Currency">
                      <select className="form-input">
                        <option value="INR">Indian Rupee (₹)</option>
                        <option value="USD">US Dollar ($)</option>
                      </select>
                    </FormGroup>

                    <FormGroup label="Operating Hours">
                      <div className="time-input-container">
                        <FormInput 
                          type="time" 
                          placeholder="Opening time"
                          defaultValue="09:00"
                        />
                        <span style={{ color: '#6b7280', fontSize: '14px' }}>to</span>
                        <FormInput 
                          type="time" 
                          placeholder="Closing time"
                          defaultValue="23:00"
                        />
                      </div>
                    </FormGroup>

                    <FormGroup label="Notifications">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                          <input type="checkbox" defaultChecked />
                          Email notifications for new orders
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                          <input type="checkbox" defaultChecked />
                          SMS alerts for urgent matters
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                          <input type="checkbox" />
                          Weekly performance reports
                        </label>
                      </div>
                    </FormGroup>
                  </div>

                  <div className="action-buttons">
                    <Button 
                      variant="primary" 
                      className="btn-primary"
                      disabled={loading}
                    >
                      {loading ? 'Saving...' : 'Save Preferences'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </PageContainer>

        <style jsx>{`
          .settings-container {
            max-width: 100%;
            margin: 0;
            background: transparent;
            border-radius: 0;
            box-shadow: none;
            overflow: hidden;
            display: flex;
            min-height: 600px;
            height: 100%;
          }

          .settings-tabs {
            display: flex;
            flex-direction: column;
            background: #f8f8f5;
            border-right: 1px solid #e5e5e0;
            width: 280px;
            min-width: 280px;
            height: 100%;
            min-height: 100%;
          }

          .settings-tab {
            padding: 20px 24px;
            background: none;
            border: none;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            color: #64748b;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            gap: 12px;
            text-align: left;
            border-bottom: 1px solid #e2e8f0;
            position: relative;
          }

          .settings-tab:hover {
            background: #f0f0ed;
            color: #374151;
            transition: all 0.2s ease;
          }

          .settings-tab.active {
            background: #fafaf8;
            color: #6B0E9B;
            border-right: 3px solid #6B0E9B;
            font-weight: 600;
            box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.3);
          }

          .settings-tab.active::before {
            content: '';
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            width: 4px;
            background: #6B0E9B;
          }

          .tab-icon {
            font-size: 18px;
            min-width: 20px;
          }

          .settings-content {
            flex: 1;
            padding: 32px;
            background: transparent;
            height: 100%;
            min-height: 100%;
          }

          .settings-section {
            max-width: 800px;
          }

          .section-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 24px;
            padding-bottom: 16px;
            border-bottom: 1px solid #e2e8f0;
          }

          .section-header h3 {
            margin: 0;
            color: #1e293b;
            font-size: 20px;
            font-weight: 600;
          }

          .config-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 24px;
          }

          .config-item {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .config-item.full-width {
            grid-column: 1 / -1;
          }

          .config-item label {
            font-weight: 500;
            color: #374151;
            font-size: 14px;
          }

          .config-item input,
          .config-item select,
          .config-item textarea {
            padding: 12px;
            border: 1px solid #d1d5db;
            border-radius: 8px;
            font-size: 14px;
            transition: border-color 0.2s;
            background: white;
          }

          .config-item input:focus,
          .config-item select:focus,
          .config-item textarea:focus {
            outline: none;
            border-color: #6B0E9B;
            box-shadow: 0 0 0 3px rgba(107, 14, 155, 0.1);
          }

          .config-item small {
            color: #6b7280;
            font-size: 12px;
          }

          .action-buttons {
            display: flex;
            gap: 12px;
            margin-top: 24px;
          }

          .btn-primary {
            background: #6B0E9B;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.2s;
          }

          .btn-primary:hover:not(:disabled) {
            background: #5A0C82;
          }

          .btn-primary:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          .btn-secondary {
            background: white;
            color: #6B0E9B;
            border: 1px solid #6B0E9B;
            padding: 12px 24px;
            border-radius: 8px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
          }

          .btn-secondary:hover:not(:disabled) {
            background: #6B0E9B;
            color: white;
          }

          .btn-secondary:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          .upload-area {
            border: 2px dashed #d1d5db;
            border-radius: 8px;
            padding: 24px;
            text-align: center;
            transition: all 0.2s;
            cursor: pointer;
            background: #f9fafb;
          }

          .upload-area:hover {
            border-color: #6B0E9B;
            background: rgba(107, 14, 155, 0.05);
          }

          .upload-area.dragover {
            border-color: #6B0E9B;
            background: rgba(107, 14, 155, 0.1);
          }

          /* Document Upload Specific Styles */
          .documents-grid {
            display: grid;
            gap: 24px;
          }

          .document-upload {
            margin-bottom: 24px;
            padding: 20px;
            background: #f8fafc;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
          }

          .document-upload h4 {
            margin: 0 0 8px 0;
            color: #1e293b;
            font-size: 16px;
            font-weight: 600;
          }

          .document-upload p {
            margin: 0 0 16px 0;
            color: #6b7280;
            font-size: 14px;
          }

          /* Time Input Flex Container */
          .time-input-container {
            display: flex;
            gap: 12px;
            align-items: center;
          }

          .time-input-container input {
            flex: 1;
          }

          /* Config Textarea Styling */
          .config-textarea {
            resize: vertical;
            min-height: 80px;
          }

          /* Checkbox Styling */
          input[type="checkbox"] {
            margin: 0;
            width: 16px;
            height: 16px;
            accent-color: #6B0E9B;
          }

          /* File Input Styling */
          input[type="file"] {
            padding: 8px;
            background: white;
            border: 1px dashed #d1d5db;
            border-radius: 6px;
            cursor: pointer;
          }

          input[type="file"]:hover {
            border-color: #6B0E9B;
            background: rgba(107, 14, 155, 0.02);
          }

          /* Responsive Design */
          @media (max-width: 768px) {
            .settings-container {
              flex-direction: column;
              min-height: auto;
            }

            .settings-tabs {
              width: 100%;
              min-width: 100%;
              flex-direction: row;
              overflow-x: auto;
              border-right: none;
              border-bottom: 1px solid #e5e5e0;
            }

            .settings-tab {
              min-width: 120px;
              flex-shrink: 0;
              border-bottom: none;
              border-right: 1px solid #e2e8f0;
            }

            .settings-tab.active {
              border-right: none;
              border-bottom: 3px solid #6B0E9B;
            }

            .settings-tab.active::before {
              display: none;
            }

            .settings-content {
              padding: 20px;
            }

            .config-grid {
              grid-template-columns: 1fr;
              gap: 16px;
            }
          }
        `}</style>
      </TheaterLayout>
    </ErrorBoundary>
  );
}

export default TheaterSettings;