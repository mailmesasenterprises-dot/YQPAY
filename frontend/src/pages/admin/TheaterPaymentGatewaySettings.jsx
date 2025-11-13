import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  TextField,
  Switch,
  FormControlLabel,
  MenuItem,
  CircularProgress,
  InputAdornment,
  IconButton,
  Chip
} from '@mui/material';
import {
  Save as SaveIcon,
  Visibility,
  VisibilityOff,
  Payment as PaymentIcon,
  Store as StoreIcon,
  ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import axios from 'axios';
import { optimizedFetch } from '../../utils/apiOptimizer';
import config from '../../config';
import AdminLayout from '../../components/AdminLayout';
import { useModal } from '../../contexts/ModalContext';
import PageContainer from '../../components/PageContainer';
import VerticalPageHeader from '../../components/VerticalPageHeader';
import '../../styles/TheaterList.css';
import '../../styles/QRManagementPage.css';
import '../../styles/AddTheater.css';
import '../../styles/TheaterUserDetails.css';

const TheaterPaymentGatewaySettings = () => {
  const { theaterId } = useParams();
  const navigate = useNavigate();
  const modal = useModal();
  
  const [selectedTheater, setSelectedTheater] = useState(theaterId || '');
  const [theaters, setTheaters] = useState([]);
  const [theaterInfo, setTheaterInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tabValue, setTabValue] = useState(0); // 0: Kiosk, 1: Online
  
  // Show/hide password states
  const [showPasswords, setShowPasswords] = useState({
    kiosk: { razorpay: false, phonepe: false, paytm: false },
    online: { razorpay: false, phonepe: false, paytm: false }
  });

  // Payment gateway configurations
  const [kioskConfig, setKioskConfig] = useState({
    razorpay: { enabled: false, keyId: '', keySecret: '' },
    phonepe: { enabled: false, merchantId: '', saltKey: '', saltIndex: '' },
    paytm: { enabled: false, merchantId: '', merchantKey: '' }
  });

  const [onlineConfig, setOnlineConfig] = useState({
    razorpay: { enabled: false, keyId: '', keySecret: '' },
    phonepe: { enabled: false, merchantId: '', saltKey: '', saltIndex: '' },
    paytm: { enabled: false, merchantId: '', merchantKey: '' }
  });

  const fetchTheaters = useCallback(async () => {
    try {
      const token = config.helpers.getAuthToken();
      // 🚀 PERFORMANCE: Use optimizedFetch for instant cache loading
      const data = await optimizedFetch(
        `${config.api.baseUrl}/theaters`,
        {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        },
        'payment_gateway_settings_theaters',
        120000 // 2-minute cache
      );
      
      if (!data) {
        modal?.showError?.('Failed to fetch theaters');
        return;
      }
      
      const theatersList = Array.isArray(data) ? data : 
                          (data.theaters || data.data || []);
      setTheaters(theatersList);
    } catch (error) {
      console.error('Error fetching theaters:', error);
      modal?.showError?.('Failed to fetch theaters');
    }
  }, [modal]);

  const fetchTheaterConfig = useCallback(async (theaterIdToFetch) => {
    try {
      setLoading(true);
      const token = config.helpers.getAuthToken();
      // 🚀 PERFORMANCE: Use optimizedFetch for instant cache loading
      const response = await optimizedFetch(
        `${config.api.baseUrl}/theaters/${theaterIdToFetch}`,
        {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        },
        `payment_gateway_settings_theater_${theaterIdToFetch}`,
        120000 // 2-minute cache
      );
      
      if (!response) {
        modal?.showError?.('Failed to load configuration');
        setLoading(false);
        return;
      }
      
      // Backend returns { success: true, data: theater }
      // optimizedFetch returns parsed JSON data directly
      const theater = (response.success && response.data) ? response.data : (response.data || response);
      
      console.log('Fetched theater data:', theater);
      console.log('Payment Gateway:', theater?.paymentGateway);
      
      setTheaterInfo(theater);
      
      if (theater?.paymentGateway) {
        console.log('Loading Kiosk Config:', theater.paymentGateway.kiosk);
        console.log('Loading Online Config:', theater.paymentGateway.online);
        
        if (theater.paymentGateway.kiosk) {
          setKioskConfig({
            razorpay: theater.paymentGateway.kiosk.razorpay || { enabled: false, keyId: '', keySecret: '' },
            phonepe: theater.paymentGateway.kiosk.phonepe || { enabled: false, merchantId: '', saltKey: '', saltIndex: '' },
            paytm: theater.paymentGateway.kiosk.paytm || { enabled: false, merchantId: '', merchantKey: '' }
          });
        }
        
        if (theater.paymentGateway.online) {
          setOnlineConfig({
            razorpay: theater.paymentGateway.online.razorpay || { enabled: false, keyId: '', keySecret: '' },
            phonepe: theater.paymentGateway.online.phonepe || { enabled: false, merchantId: '', saltKey: '', saltIndex: '' },
            paytm: theater.paymentGateway.online.paytm || { enabled: false, merchantId: '', merchantKey: '' }
          });
        }
      } else {
        console.log('No payment gateway data found in theater');
      }
    } catch (error) {
      console.error('Error fetching theater config:', error);
      modal?.showError?.('Failed to load configuration');
    } finally {
      setLoading(false);
    }
  }, [modal]);

  useEffect(() => {
    if (theaterId) {
      setSelectedTheater(theaterId);
      fetchTheaterConfig(theaterId);
    } else {
      fetchTheaters();
    }
  }, [theaterId, fetchTheaterConfig, fetchTheaters]);

  useEffect(() => {
    if (selectedTheater && !theaterId) {
      fetchTheaterConfig(selectedTheater);
    }
  }, [selectedTheater, theaterId, fetchTheaterConfig]);

  const handleSave = async () => {
    if (!selectedTheater) {
      modal?.showError?.('Please select a theater');
      return;
    }

    try {
      setSaving(true);
      
      const token = config.helpers.getAuthToken();
      if (!token) {
        modal?.showError?.('Authentication required. Please login again.');
        return;
      }
      
      await axios.put(`/api/theaters/${selectedTheater}`, {
        paymentGateway: {
          kiosk: kioskConfig,
          online: onlineConfig
        }
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      modal?.showSuccess?.('Payment gateway configuration saved successfully!');
    } catch (error) {
      console.error('Error saving configuration:', error);
      modal?.showError?.('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const togglePasswordVisibility = (channel, provider) => {
    setShowPasswords(prev => ({
      ...prev,
      [channel]: {
        ...prev[channel],
        [provider]: !prev[channel][provider]
      }
    }));
  };

  const renderGatewaySection = (channel, config, setConfig, provider, label) => {
    const enabled = config[provider]?.enabled || false;
    
    return (
      <div className="form-section" key={provider} style={{ opacity: enabled ? 1 : 0.7 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <PaymentIcon style={{ color: '#8b5cf6', fontSize: '24px' }} />
            <h2 style={{ margin: 0 }}>{label}</h2>
          </div>
          <FormControlLabel
            control={
              <Switch
                checked={enabled}
                onChange={(e) => {
                  const newEnabled = e.target.checked;
                  setConfig(prev => {
                    const currentProvider = prev[provider] || {};
                    return {
                      ...prev,
                      [provider]: { 
                        ...currentProvider,
                        enabled: newEnabled 
                      }
                    };
                  });
                }}
                color="primary"
              />
            }
            label={
              <span style={{ 
                fontWeight: 600, 
                color: enabled ? '#10b981' : '#6b7280',
                fontSize: '14px'
              }}>
                {enabled ? 'Enabled ✓' : 'Disabled'}
              </span>
            }
          />
        </div>
        
        {!enabled && (
          <div style={{ 
            padding: '12px 16px', 
            background: '#fef3c7', 
            border: '1px solid #fcd34d',
            borderRadius: '8px',
            marginBottom: '16px',
            fontSize: '14px',
            color: '#92400e'
          }}>
            ⚠️ Enable this gateway to configure API credentials
          </div>
        )}
        
        <div className="form-grid">
            {provider === 'razorpay' && (
              <>
                <div className="form-group">
                  <label htmlFor={`${channel}-razorpay-keyId`}>Key ID</label>
                  <input
                    id={`${channel}-razorpay-keyId`}
                    type="text"
                    value={config.razorpay?.keyId || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      setConfig(prev => ({
                        ...prev,
                        razorpay: { ...prev.razorpay, keyId: value }
                      }));
                    }}
                    disabled={!enabled}
                    placeholder="rzp_test_xxxxxxxxxxxxx"
                    className="form-control"
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor={`${channel}-razorpay-keySecret`}>Key Secret</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id={`${channel}-razorpay-keySecret`}
                      type={showPasswords[channel][provider] ? 'text' : 'password'}
                      value={config.razorpay?.keySecret || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        setConfig(prev => ({
                          ...prev,
                          razorpay: { ...prev.razorpay, keySecret: value }
                        }));
                      }}
                      disabled={!enabled}
                      placeholder="xxxxxxxxxxxxxxxxxxxxx"
                      className="form-control"
                      style={{ paddingRight: '40px' }}
                    />
                    <IconButton
                      onClick={() => togglePasswordVisibility(channel, provider)}
                      style={{
                        position: 'absolute',
                        right: '4px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        padding: '8px'
                      }}
                      size="small"
                    >
                      {showPasswords[channel][provider] ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </div>
                </div>
              </>
            )}
            
            {provider === 'phonepe' && (
              <>
                <div className="form-group">
                  <label htmlFor={`${channel}-phonepe-merchantId`}>Merchant ID</label>
                  <input
                    id={`${channel}-phonepe-merchantId`}
                    type="text"
                    value={config.phonepe?.merchantId || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      setConfig(prev => ({
                        ...prev,
                        phonepe: { ...prev.phonepe, merchantId: value }
                      }));
                    }}
                    disabled={!enabled}
                    placeholder="MERCHANTUAT"
                    className="form-control"
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor={`${channel}-phonepe-saltKey`}>Salt Key</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id={`${channel}-phonepe-saltKey`}
                      type={showPasswords[channel][provider] ? 'text' : 'password'}
                      value={config.phonepe?.saltKey || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        setConfig(prev => ({
                          ...prev,
                          phonepe: { ...prev.phonepe, saltKey: value }
                        }));
                      }}
                      disabled={!enabled}
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      className="form-control"
                      style={{ paddingRight: '40px' }}
                    />
                    <IconButton
                      onClick={() => togglePasswordVisibility(channel, provider)}
                      style={{
                        position: 'absolute',
                        right: '4px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        padding: '8px'
                      }}
                      size="small"
                    >
                      {showPasswords[channel][provider] ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </div>
                </div>
                
                <div className="form-group">
                  <label htmlFor={`${channel}-phonepe-saltIndex`}>Salt Index</label>
                  <input
                    id={`${channel}-phonepe-saltIndex`}
                    type="text"
                    value={config.phonepe?.saltIndex || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      setConfig(prev => ({
                        ...prev,
                        phonepe: { ...prev.phonepe, saltIndex: value }
                      }));
                    }}
                    disabled={!enabled}
                    placeholder="1"
                    className="form-control"
                  />
                </div>
              </>
            )}
            
            {provider === 'paytm' && (
              <>
                <div className="form-group">
                  <label htmlFor={`${channel}-paytm-merchantId`}>Merchant ID</label>
                  <input
                    id={`${channel}-paytm-merchantId`}
                    type="text"
                    value={config.paytm?.merchantId || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      setConfig(prev => ({
                        ...prev,
                        paytm: { ...prev.paytm, merchantId: value }
                      }));
                    }}
                    disabled={!enabled}
                    placeholder="MERCHANT_ID"
                    className="form-control"
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor={`${channel}-paytm-merchantKey`}>Merchant Key</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id={`${channel}-paytm-merchantKey`}
                      type={showPasswords[channel][provider] ? 'text' : 'password'}
                      value={config.paytm?.merchantKey || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        setConfig(prev => ({
                          ...prev,
                          paytm: { ...prev.paytm, merchantKey: value }
                        }));
                      }}
                      disabled={!enabled}
                      placeholder="xxxxxxxxxxxxxxxxxxxxx"
                      className="form-control"
                      style={{ paddingRight: '40px' }}
                    />
                    <IconButton
                      onClick={() => togglePasswordVisibility(channel, provider)}
                      style={{
                        position: 'absolute',
                        right: '4px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        padding: '8px'
                      }}
                      size="small"
                    >
                      {showPasswords[channel][provider] ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </div>
                </div>
              </>
            )}
        </div>
      </div>
    );
  };

  const renderChannelConfig = (channel, config, setConfig) => {
    const channelLabel = channel === 'kiosk' ? 'Kiosk / POS' : 'Online / QR';
    
    return (
      <div className="add-theater-form" style={{ marginTop: '24px' }}>
        <div className="form-section">
          <div className="info-card" style={{ marginBottom: '24px', background: '#f3f4f6', padding: '16px', borderRadius: '8px' }}>
            <p style={{ margin: 0, fontSize: '14px', color: '#374151' }}>
              <strong>{channelLabel} API:</strong> {channel === 'kiosk' 
                ? 'Used for counter orders and POS transactions within the theater premises.'
                : 'Used for QR code orders and mobile app transactions from customers.'}
            </p>
          </div>
        </div>
        
        {renderGatewaySection(channel, config, setConfig, 'razorpay', 'Razorpay')}
        {renderGatewaySection(channel, config, setConfig, 'phonepe', 'PhonePe')}
        {renderGatewaySection(channel, config, setConfig, 'paytm', 'Paytm')}
        
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '32px', paddingTop: '24px', borderTop: '1px solid var(--border-color)' }}>
          <button
            onClick={handleSave}
            disabled={saving}
            className="add-theater-btn"
            style={{ opacity: saving ? 0.6 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}
          >
            {saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <AdminLayout pageTitle="Payment Gateway Configuration" currentPage="payment-gateway">
      <div className="theater-list-container qr-management-page">
        <PageContainer
          hasHeader={false}
          className="payment-gateway-settings-vertical"
        >
          {/* Global Vertical Header Component */}
          <VerticalPageHeader
            title={theaterInfo?.name?.toUpperCase() || 'Payment Gateway Configuration'}
            backButtonText="Back to Payment Gateway List"
            backButtonPath="/payment-gateway-list"
            showBackButton={!!theaterId}
          />

          <div className="theater-content">
            {/* Theater Selection - Only show if no theaterId in URL */}
            {!theaterId && (
              <div className="theater-filters" style={{ padding: '30px', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ maxWidth: '600px' }}>
                  <label style={{ 
                    display: 'block', 
                    fontWeight: 600, 
                    marginBottom: '8px',
                    color: '#374151',
                    fontSize: '14px'
                  }}>
                    Select Theater to Configure Payment Gateway
                  </label>
                  <TextField
                    select
                    fullWidth
                    value={selectedTheater}
                    onChange={(e) => setSelectedTheater(e.target.value)}
                    placeholder="Choose a theater"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <StoreIcon sx={{ color: '#8b5cf6' }} />
                        </InputAdornment>
                      )
                    }}
                    sx={{ 
                      bgcolor: 'white',
                      '& .MuiOutlinedInput-root': {
                        '&:hover fieldset': {
                          borderColor: '#8b5cf6',
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#8b5cf6',
                        }
                      }
                    }}
                  >
                    <MenuItem value="">
                      <em>-- Select a Theater --</em>
                    </MenuItem>
                    {theaters.map((theater) => (
                      <MenuItem key={theater._id} value={theater._id}>
                        {theater.name} - {theater.location?.city || theater.address?.city || 'N/A'}
                      </MenuItem>
                    ))}
                  </TextField>
                </div>
              </div>
            )}

            {loading ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Loading configuration...</p>
              </div>
            ) : selectedTheater ? (
              <div className="theater-user-settings-container">
                {/* Left Sidebar - Gateway Selection */}
                <div className="theater-user-settings-tabs">
                  <button 
                    className={`theater-user-settings-tab ${tabValue === 0 ? 'active' : ''}`}
                    onClick={() => setTabValue(0)}
                  >
                    <span className="theater-user-tab-icon" style={{ fontSize: '20px' }}>🏪</span>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                      <span>Kiosk/POS Gateway</span>
                      <span style={{ fontSize: '12px', opacity: 0.7, fontWeight: 400 }}>Counter & Point of Sale</span>
                    </div>
                  </button>

                  <button 
                    className={`theater-user-settings-tab ${tabValue === 1 ? 'active' : ''}`}
                    onClick={() => setTabValue(1)}
                  >
                    <span className="theater-user-tab-icon" style={{ fontSize: '20px' }}>🌐</span>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                      <span>Online Gateway</span>
                      <span style={{ fontSize: '12px', opacity: 0.7, fontWeight: 400 }}>QR Code & Mobile Orders</span>
                    </div>
                  </button>
                </div>

                {/* Right Content - Credentials */}
                <div className="theater-user-settings-content">
                  {tabValue === 0 && renderChannelConfig('kiosk', kioskConfig, setKioskConfig)}
                  {tabValue === 1 && renderChannelConfig('online', onlineConfig, setOnlineConfig)}
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">
                  <PaymentIcon style={{ fontSize: 48, color: '#999' }} />
                </div>
                <h3>Select a Theater</h3>
                <p>Please select a theater from the dropdown above to configure payment gateways.</p>
              </div>
            )}
          </div>
        </PageContainer>
      </div>
    </AdminLayout>
  );
};

export default TheaterPaymentGatewaySettings;
