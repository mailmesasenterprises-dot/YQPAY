import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Chip } from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';
import config from '../../config';
import AdminLayout from '../../components/AdminLayout';
import { ActionButton, ActionButtons } from '../../components/ActionButton';
import Pagination from '../../components/Pagination';
import '../../styles/TheaterList.css';
import '../../styles/QRManagementPage.css';

const PaymentGatewayList = () => {
  const navigate = useNavigate();
  const [theaters, setTheaters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    fetchTheaters();
  }, []);

  const fetchTheaters = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${config.api.baseUrl}/theaters`, {
        headers: config.helpers.getAuthToken() 
          ? { 'Authorization': `Bearer ${config.helpers.getAuthToken()}` } 
          : {}
      });

      if (!response.ok) {
        throw new Error('Failed to fetch theaters');
      }

      const data = await response.json();
      const theatersList = Array.isArray(data) ? data : (data.theaters || data.data || []);
      setTheaters(theatersList);
      setError('');
    } catch (error) {
      console.error('Error fetching theaters:', error);
      setError('Failed to load theaters');
    } finally {
      setLoading(false);
    }
  };

  const handleConfigure = (theaterId) => {
    navigate(`/payment-gateway-settings/${theaterId}`);
  };

  const getGatewayStatus = (theater) => {
    const hasKiosk = theater.paymentGateway?.kiosk?.razorpay?.keyId ||
                     theater.paymentGateway?.kiosk?.phonepe?.merchantId ||
                     theater.paymentGateway?.kiosk?.paytm?.merchantId;
    
    const hasOnline = theater.paymentGateway?.online?.razorpay?.keyId ||
                      theater.paymentGateway?.online?.phonepe?.merchantId ||
                      theater.paymentGateway?.online?.paytm?.merchantId;
    
    return { hasKiosk: !!hasKiosk, hasOnline: !!hasOnline };
  };

  const getConfiguredGateways = (theater, channel) => {
    const gateways = [];
    if (theater.paymentGateway?.[channel]?.razorpay?.keyId) gateways.push('Razorpay');
    if (theater.paymentGateway?.[channel]?.phonepe?.merchantId) gateways.push('PhonePe');
    if (theater.paymentGateway?.[channel]?.paytm?.merchantId) gateways.push('Paytm');
    return gateways;
  };

  // Filter and search theaters
  const filteredTheaters = useMemo(() => {
    return theaters.filter(theater => {
      // Search filter
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || 
        theater.name?.toLowerCase().includes(searchLower) ||
        theater.location?.city?.toLowerCase().includes(searchLower) ||
        theater.location?.state?.toLowerCase().includes(searchLower) ||
        theater.address?.city?.toLowerCase().includes(searchLower) ||
        theater.address?.state?.toLowerCase().includes(searchLower);

      // Status filter
      const { hasKiosk, hasOnline } = getGatewayStatus(theater);
      const isConfigured = hasKiosk || hasOnline;
      const matchesStatus = filterStatus === 'all' ||
        (filterStatus === 'configured' && isConfigured) ||
        (filterStatus === 'not-configured' && !isConfigured);

      return matchesSearch && matchesStatus;
    });
  }, [theaters, searchTerm, filterStatus]);

  // Pagination
  const totalItems = filteredTheaters.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTheaters = filteredTheaters.slice(startIndex, endIndex);

  // Handlers
  const handleSearchChange = useCallback((e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  }, []);

  const handleFilterChange = useCallback((e) => {
    setFilterStatus(e.target.value);
    setCurrentPage(1);
  }, []);

  const handlePageChange = useCallback((newPage) => {
    setCurrentPage(newPage);
  }, []);

  const handleItemsPerPageChange = useCallback((e) => {
    setItemsPerPage(parseInt(e.target.value));
    setCurrentPage(1);
  }, []);

  if (loading) {
    return (
      <AdminLayout pageTitle="Payment Gateway Management" currentPage="payment-gateway">
        <div className="theater-list-container">
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading payment gateways...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout pageTitle="Payment Gateway Management" currentPage="payment-gateway">
        <div className="theater-list-container">
          <div className="error-state">
            <h3>Error Loading Payment Gateways</h3>
            <p>{error}</p>
            <button onClick={fetchTheaters} className="retry-btn">
              Try Again
            </button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout pageTitle="Payment Gateway Management" currentPage="payment-gateway">
      <div className="theater-list-container qr-management-page">
        {/* Main Container */}
        <div className="theater-main-container">
          {/* Header */}
          <div className="theater-list-header">
            <div className="header-content">
              <h1>Payment Gateway Management</h1>
            </div>
          </div>

          {/* Stats Section */}
          <div className="qr-stats">
            <div className="stat-card">
              <div className="stat-number">{totalItems || 0}</div>
              <div className="stat-label">Total Theaters</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">
                {theaters.filter(t => {
                  const { hasKiosk } = getGatewayStatus(t);
                  return hasKiosk;
                }).length || 0}
              </div>
              <div className="stat-label">Kiosk Configured</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">
                {theaters.filter(t => {
                  const { hasOnline } = getGatewayStatus(t);
                  return hasOnline;
                }).length || 0}
              </div>
              <div className="stat-label">Online Configured</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">
                {theaters.filter(t => {
                  const { hasKiosk, hasOnline } = getGatewayStatus(t);
                  return !hasKiosk && !hasOnline;
                }).length || 0}
              </div>
              <div className="stat-label">Not Configured</div>
            </div>
          </div>

          {/* Theater Content Container */}
          <div className="theater-content">
            {/* Filters and Search */}
            <div className="theater-filters">
              <div className="search-box">
                <input
                  type="text"
                  placeholder="Search theaters by name, city, or state..."
                  value={searchTerm}
                  onChange={handleSearchChange}
                  className="search-input"
                />
              </div>
              <div className="filter-controls">
                <select
                  value={filterStatus}
                  onChange={handleFilterChange}
                  className="status-filter"
                >
                  <option value="all">All Status</option>
                  <option value="configured">Configured Only</option>
                  <option value="not-configured">Not Configured Only</option>
                </select>
                <div className="results-count">
                  Showing {paginatedTheaters.length} of {totalItems} theaters (Page {currentPage} of {totalPages || 1})
                </div>
                <div className="items-per-page">
                  <label>Items per page:</label>
                  <select value={itemsPerPage} onChange={handleItemsPerPageChange} className="items-select">
                    <option value="5">5</option>
                    <option value="10">10</option>
                    <option value="20">20</option>
                    <option value="50">50</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Theater Table */}
            {paginatedTheaters.length === 0 && !loading ? (
              <div className="empty-state">
                <div className="empty-icon">
                  <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '48px', height: '48px', color: 'var(--text-gray)'}}>
                    <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z"/>
                  </svg>
                </div>
                <h3>No Theaters Found</h3>
                <p>
                  {searchTerm || filterStatus !== 'all' 
                    ? 'No theaters match your current filters.'
                    : 'No theaters available. Please add theaters first.'
                  }
                </p>
              </div>
            ) : (
              <>
                <div className="table-container">
                  <div className="table-wrapper">
                    <table className="theater-table">
                    <thead>
                      <tr>
                        <th className="sno-col">S NO</th>
                        <th className="photo-col">Photo</th>
                        <th className="name-col">Theater Name</th>
                        <th className="location-col">Location</th>
                        <th className="status-col">Kiosk API Status</th>
                        <th className="status-col">Online API Status</th>
                        <th className="gateway-col">Configured Gateways</th>
                        <th className="actions-col">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedTheaters.map((theater, index) => {
                        const { hasKiosk, hasOnline } = getGatewayStatus(theater);
                        const kioskGateways = getConfiguredGateways(theater, 'kiosk');
                        const onlineGateways = getConfiguredGateways(theater, 'online');
                        const allGateways = [...new Set([...kioskGateways, ...onlineGateways])];

                        return (
                          <tr key={theater._id} className="theater-row">
                            {/* S NO Column */}
                            <td className="sno-cell">
                              <div className="sno-number">{startIndex + index + 1}</div>
                            </td>

                          {/* Logo Column */}
                          <td className="theater-logo-cell">
                            {(theater.documents?.logo || theater.branding?.logo || theater.branding?.logoUrl) ? (
                              <img
                                src={theater.documents?.logo || theater.branding?.logo || theater.branding?.logoUrl}
                                alt={theater.name}
                                className="theater-logo"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.target.nextSibling.style.display = 'flex';
                                }}
                              />
                            ) : null}
                            <div className="no-logo" style={{display: (theater.documents?.logo || theater.branding?.logo || theater.branding?.logoUrl) ? 'none' : 'flex'}}>
                              <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '24px', height: '24px', color: '#8b5cf6'}}>
                                <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z"/>
                              </svg>
                            </div>
                          </td>

                          {/* Theater Name Column */}
                          <td className="theater-name-cell">
                            <div className="theater-name-full">{theater.name}</div>
                          </td>

                          {/* Location Column */}
                          <td className="location-cell">
                            <div className="location-info">
                              <div className="city">
                                {theater.location?.city || theater.address?.city || 'N/A'}
                              </div>
                              <div className="state">
                                {theater.location?.state || theater.address?.state || 'N/A'}
                              </div>
                            </div>
                          </td>

                          {/* Kiosk Status Column */}
                          <td className="status-cell">
                            {hasKiosk ? (
                              <Chip
                                icon={<CheckCircleIcon />}
                                label="Configured"
                                color="success"
                                size="small"
                                sx={{ 
                                  fontWeight: 500,
                                  '& .MuiChip-icon': { color: 'inherit' }
                                }}
                              />
                            ) : (
                              <Chip
                                icon={<CancelIcon />}
                                label="Not Configured"
                                color="default"
                                size="small"
                                sx={{ 
                                  bgcolor: '#fff3cd',
                                  color: '#856404',
                                  fontWeight: 500,
                                  '& .MuiChip-icon': { color: '#856404' }
                                }}
                              />
                            )}
                          </td>

                          {/* Online Status Column */}
                          <td className="status-cell">
                            {hasOnline ? (
                              <Chip
                                icon={<CheckCircleIcon />}
                                label="Configured"
                                color="success"
                                size="small"
                                sx={{ 
                                  fontWeight: 500,
                                  '& .MuiChip-icon': { color: 'inherit' }
                                }}
                              />
                            ) : (
                              <Chip
                                icon={<CancelIcon />}
                                label="Not Configured"
                                color="default"
                                size="small"
                                sx={{ 
                                  bgcolor: '#fff3cd',
                                  color: '#856404',
                                  fontWeight: 500,
                                  '& .MuiChip-icon': { color: '#856404' }
                                }}
                              />
                            )}
                          </td>

                          {/* Configured Gateways Column */}
                          <td className="gateway-cell">
                            <div className="gateway-chips">
                              {allGateways.length > 0 ? (
                                allGateways.map((gateway) => (
                                  <Chip
                                    key={gateway}
                                    label={gateway}
                                    size="small"
                                    sx={{
                                      bgcolor: '#e3f2fd',
                                      color: '#1976d2',
                                      fontWeight: 500,
                                      margin: '2px'
                                    }}
                                  />
                                ))
                              ) : (
                                <span style={{ color: '#999', fontSize: '14px' }}>None</span>
                              )}
                            </div>
                          </td>

                          {/* Actions Column */}
                          <td className="actions-cell">
                            <ActionButtons>
                              <ActionButton
                                type="settings"
                                onClick={() => handleConfigure(theater._id)}
                                title="Configure Payment Gateway"
                              />
                            </ActionButtons>
                          </td>
                        </tr>
                      );
                    })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
            )}

            {/* Pagination - Always show when there are theaters */}
            {!loading && filteredTheaters.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages || 1}
                onPageChange={handlePageChange}
              />
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default PaymentGatewayList;
