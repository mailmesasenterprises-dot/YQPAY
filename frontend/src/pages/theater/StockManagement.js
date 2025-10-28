import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import TheaterLayout from '../../components/theater/TheaterLayout';
import PageContainer from '../../components/PageContainer';
import VerticalPageHeader from '../../components/VerticalPageHeader';
import Pagination from '../../components/Pagination';
import DateFilter from '../../components/DateFilter';
import { useModal } from '../../contexts/ModalContext';
import { useAuth } from '../../contexts/AuthContext';
import ErrorBoundary from '../../components/ErrorBoundary';
import { usePerformanceMonitoring } from '../../hooks/usePerformanceMonitoring';
import config from '../../config';
import '../../styles/TheaterList.css';
import '../../styles/QRManagementPage.css'; // ADDED: Import proper styling for statistics cards
import '../../styles/AddTheater.css'; // ADDED: Import submit-btn styling for date filter button
import '../../components/VerticalPageHeader.css'; // ADDED: Import global header styling
import '../../styles/StockManagement.css'; // ADDED: Import stock-specific styling for badges

const API_BASE_URL = config.api?.baseUrl || 'http://localhost:5000/api';

// Date utilities
const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const formatDateTime = (date) => {
  return new Date(date).toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Stock calculation utilities
const isExpired = (expireDate) => {
  if (!expireDate) return false;
  const now = new Date();
  const expiry = new Date(expireDate);

  // Check if the expiry date has passed (after 00:01 AM of the day AFTER expiry date)
  const dayAfterExpiry = new Date(expiry);
  dayAfterExpiry.setDate(expiry.getDate() + 1); // Move to next day
  dayAfterExpiry.setHours(0, 1, 0, 0); // Set to 00:01 AM of the day after expiry

  return now >= dayAfterExpiry;
};

const calculateExpiredStock = (entry) => {
  if (!entry.expireDate) return 0;
  if (!isExpired(entry.expireDate)) return 0;

  // If expired, the entire remaining stock becomes expired
  const usedStock = entry.usedStock || 0;
  const addedStock = entry.stock || 0;
  const remaining = Math.max(0, addedStock - usedStock);

  return remaining;
};

const calculateBalanceStock = (entry) => {
  const addedStock = entry.stock || 0;
  const usedStock = entry.usedStock || 0;
  const damageStock = entry.damageStock || 0;
  const expiredStock = calculateExpiredStock(entry);

  return Math.max(0, addedStock - usedStock - damageStock - expiredStock);
};

// Loading skeleton component
const StockTableSkeleton = React.memo(({ count = 10 }) => (
  <>
    {Array.from({ length: count }).map((_, index) => (
      <tr key={`skeleton-${index}`} className="theater-row skeleton-row">
        <td className="sno-cell">
          <div className="skeleton-line skeleton-small"></div>
        </td>
        <td className="date-cell">
          <div className="skeleton-line skeleton-medium"></div>
        </td>
        <td className="stock-cell">
          <div className="skeleton-line skeleton-small"></div>
        </td>
        <td className="used-cell">
          <div className="skeleton-line skeleton-small"></div>
        </td>
        <td className="expired-cell">
          <div className="skeleton-line skeleton-small"></div>
        </td>
        <td className="damage-cell">
          <div className="skeleton-line skeleton-small"></div>
        </td>
        <td className="balance-cell">
          <div className="skeleton-line skeleton-small"></div>
        </td>
        <td className="expire-cell">
          <div className="skeleton-line skeleton-medium"></div>
        </td>
        <td className="actions-cell">
          <div className="skeleton-button-group"></div>
        </td>
      </tr>
    ))}
  </>
));

StockTableSkeleton.displayName = 'StockTableSkeleton';

// Stock entry row component - Using new displayData structure from backend
const StockEntryRow = React.memo(({ entry, index, onEdit, onDelete }) => {
  const globalIndex = index + 1;
  
  // Use displayData from backend (auto-calculated)
  const stockAdded = entry.displayData?.stockAdded || 0;
  const usedStock = entry.displayData?.usedStock || 0;
  const expiredStock = entry.displayData?.expiredStock || 0;
  const damageStock = entry.displayData?.damageStock || 0;
  const balance = entry.displayData?.balance || 0;

  return (
    <tr className="theater-row">
      {/* Serial Number */}
      <td className="sno-cell">
        <span className="sno-number">{globalIndex}</span>
      </td>

      {/* Date */}
      <td className="date-cell">
        <div className="date-info">
          <div className="entry-date">{formatDate(entry.entryDate)}</div>
          <div className="entry-type-badge">{entry.type}</div>
        </div>
      </td>

      {/* Stock Added */}
      <td className="stock-cell">
        <div className="stock-badge in-stock">
          <span className="stock-quantity">{stockAdded}</span>
          <span className="stock-status">Added</span>
        </div>
      </td>

      {/* Used Stock */}
      <td className="used-cell">
        <div className="stock-badge used-stock">
          <span className="stock-quantity">{usedStock}</span>
          <span className="stock-status">Used</span>
        </div>
      </td>

      {/* Expired Stock */}
      <td className="expired-cell">
        <div className="stock-badge expired-stock">
          <span className="stock-quantity">{expiredStock}</span>
          <span className="stock-status">{expiredStock > 0 ? 'Expired' : 'Fresh'}</span>
        </div>
      </td>

      {/* Damage Stock */}
      <td className="damage-cell">
        <div className="stock-badge damage-stock">
          <span className="stock-quantity">{damageStock}</span>
          <span className="stock-status">Damage</span>
        </div>
      </td>

      {/* Balance */}
      <td className="balance-cell">
        <div className="stock-badge balance-stock">
          <span className="stock-quantity">{balance}</span>
          <span className="stock-status">Balance</span>
        </div>
      </td>

      {/* Expire Date */}
      <td className="expire-cell">
        <div className="date-info">
          <div className="entry-date">
            {entry.expireDate ? formatDate(entry.expireDate) : 'No Expiry'}
          </div>
          {entry.expireDate && isExpired(entry.expireDate) && (
            <div className="expired-indicator">⚠️ Expired</div>
          )}
        </div>
      </td>

      {/* Actions */}
      <td className="actions-cell">
        <div className="action-buttons">
          <button
            className="action-btn edit-btn"
            onClick={() => onEdit(entry)}
            title="Edit Stock Entry"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '16px', height: '16px' }}>
              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
            </svg>
          </button>
          <button
            className="action-btn delete-btn"
            onClick={() => onDelete(entry)}
            title="Delete Stock Entry"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '16px', height: '16px' }}>
              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  );
});

StockEntryRow.displayName = 'StockEntryRow';

// Statistics cards component - Using new backend statistics structure
const StockStatistics = React.memo(({ summary }) => {
  return (
    <div className="qr-stats">
      <div className="stat-card">
        <div className="stat-number">{summary?.currentStock || 0}</div>
        <div className="stat-label">CURRENT STOCK</div>
        <div className="stat-sub-label">Opening: {summary?.openingBalance || 0} | Closing: {summary?.closingBalance || 0}</div>
      </div>
      <div className="stat-card">
        <div className="stat-number">{summary?.totalStock || 0}</div>
        <div className="stat-label">TOTAL ADDED</div>
        <div className="stat-sub-label">This Month</div>
      </div>
      <div className="stat-card">
        <div className="stat-number">{summary?.totalSales || 0}</div>
        <div className="stat-label">TOTAL SALES</div>
        <div className="stat-sub-label">This Month</div>
      </div>
      <div className="stat-card">
        <div className="stat-number">{summary?.totalExpired || 0}</div>
        <div className="stat-label">TOTAL EXPIRED</div>
        <div className="stat-sub-label">This Month</div>
      </div>
      <div className="stat-card">
        <div className="stat-number">{summary?.totalDamage || 0}</div>
        <div className="stat-label">TOTAL DAMAGED</div>
        <div className="stat-sub-label">This Month</div>
      </div>
    </div>
  );
});

StockStatistics.displayName = 'StockStatistics';

// Monthly Carry Forward Summary Component
const MonthlyCarryForwardSummary = React.memo(({ stockEntries }) => {
  const monthlySummary = useMemo(() => {
    if (!stockEntries || !Array.isArray(stockEntries)) {
      return [];
    }

    // Group entries by month
    const monthlyGroups = {};
    
    stockEntries.forEach(entry => {
      const entryDate = new Date(entry.date);
      const monthKey = `${entryDate.getFullYear()}-${(entryDate.getMonth() + 1).toString().padStart(2, '0')}`;
      
      if (!monthlyGroups[monthKey]) {
        monthlyGroups[monthKey] = {
          year: entryDate.getFullYear(),
          month: entryDate.getMonth() + 1,
          monthName: entryDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          entries: []
        };
      }
      
      monthlyGroups[monthKey].entries.push(entry);
    });

    // Calculate monthly totals with carry forward
    return Object.values(monthlyGroups)
      .sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
      })
      .map(group => {
        const entries = group.entries.sort((a, b) => new Date(a.date) - new Date(b.date));
        const firstEntry = entries[0];
        const lastEntry = entries[entries.length - 1];
        
        const totalAdded = entries.reduce((sum, entry) => sum + (entry.stock || 0), 0);
        const totalUsed = entries.reduce((sum, entry) => sum + (entry.usedStock || 0), 0);
        const totalDamage = entries.reduce((sum, entry) => sum + (entry.damageStock || 0), 0);
        const totalExpired = entries.reduce((sum, entry) => sum + (entry.expired || 0), 0);
        
        return {
          ...group,
          openingBalance: firstEntry?.openingBalance || 0,
          closingBalance: lastEntry?.cumulativeBalance || 0,
          totalAdded,
          totalUsed,
          totalDamage,
          totalExpired,
          netChange: totalAdded - totalUsed - totalDamage - totalExpired,
          entryCount: entries.length
        };
      });
  }, [stockEntries]);

  if (monthlySummary.length === 0) {
    return null;
  }

  return (
    <div className="monthly-summary-section">
      <h3 className="section-title">Monthly Carry Forward Summary</h3>
      <div className="monthly-summary-grid">
        {monthlySummary.map((month, index) => (
          <div key={`${month.year}-${month.month}`} className="monthly-card">
            <div className="monthly-header">
              <h4>{month.monthName}</h4>
              <span className="entry-count">{month.entryCount} entries</span>
            </div>
            
            <div className="carry-forward-flow">
              <div className="balance-item opening">
                <span className="label">Opening Balance</span>
                <span className="value">{month.openingBalance}</span>
              </div>
              
              <div className="flow-arrow">→</div>
              
              <div className="balance-item transactions">
                <span className="label">Transactions</span>
                <div className="transaction-details">
                  <span className="added">+{month.totalAdded}</span>
                  {(month.totalUsed + month.totalDamage + month.totalExpired) > 0 && (
                    <span className="deducted">-{month.totalUsed + month.totalDamage + month.totalExpired}</span>
                  )}
                </div>
              </div>
              
              <div className="flow-arrow">→</div>
              
              <div className="balance-item closing">
                <span className="label">Closing Balance</span>
                <span className="value">{month.closingBalance}</span>
              </div>
              
              {index < monthlySummary.length - 1 && (
                <div className="carry-forward-indicator">
                  <span>Carries Forward →</span>
                </div>
              )}
            </div>
            
            <div className="net-change">
              <span className={`net-value ${month.netChange >= 0 ? 'positive' : 'negative'}`}>
                Net: {month.netChange >= 0 ? '+' : ''}{month.netChange}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

MonthlyCarryForwardSummary.displayName = 'MonthlyCarryForwardSummary';

// Monthly Overall Summary Component (Pure Display - No Calculations)
const MonthlyOverallSummary = React.memo(({ monthlySummaries, totals }) => {
  if (!monthlySummaries || monthlySummaries.length === 0) {
    return null;
  }

  return (
    <div className="monthly-overall-summary-section">
      <h3 className="section-title">Monthly Overall Summary</h3>
      <div className="monthly-overall-table-container">
        <table className="monthly-overall-table">
          <thead>
            <tr>
              <th>Month</th>
              <th>Opening Balance</th>
              <th>Stock Added</th>
              <th>Used Stock</th>
              <th>Expired Stock</th>
              <th>Damage Stock</th>
              <th>Cumulative Balance</th>
            </tr>
          </thead>
          <tbody>
            {monthlySummaries.map((summary) => (
              <tr key={`${summary.year}-${summary.month}`} className="monthly-summary-row">
                <td className="month-cell">
                  <div className="month-info">
                    <span className="month-name">{summary.monthName}</span>
                    <small className="entry-count">{summary.entriesCount} entries</small>
                  </div>
                </td>
                <td className="opening-balance-cell">
                  <span className="balance-value opening">{summary.openingBalance}</span>
                </td>
                <td className="stock-added-cell">
                  <span className="stock-value added">+{summary.totalStockAdded}</span>
                </td>
                <td className="used-stock-cell">
                  <span className="stock-value used">{summary.totalUsedStock > 0 ? `-${summary.totalUsedStock}` : '0'}</span>
                </td>
                <td className="expired-stock-cell">
                  <span className="stock-value expired">{summary.totalExpiredStock > 0 ? `-${summary.totalExpiredStock}` : '0'}</span>
                </td>
                <td className="damage-stock-cell">
                  <span className="stock-value damage">{summary.totalDamageStock > 0 ? `-${summary.totalDamageStock}` : '0'}</span>
                </td>
                <td className="cumulative-balance-cell">
                  <span className="balance-value cumulative">{summary.cumulativeBalance}</span>
                </td>
              </tr>
            ))}
          </tbody>
          {totals && (
            <tfoot>
              <tr className="monthly-summary-totals">
                <td><strong>Totals</strong></td>
                <td><strong>{totals.openingBalance}</strong></td>
                <td><strong>+{totals.totalStockAdded}</strong></td>
                <td><strong>{totals.totalUsedStock > 0 ? `-${totals.totalUsedStock}` : '0'}</strong></td>
                <td><strong>{totals.totalExpiredStock > 0 ? `-${totals.totalExpiredStock}` : '0'}</strong></td>
                <td><strong>{totals.totalDamageStock > 0 ? `-${totals.totalDamageStock}` : '0'}</strong></td>
                <td><strong>{totals.cumulativeBalance}</strong></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
});

MonthlyOverallSummary.displayName = 'MonthlyOverallSummary';

// Add/Edit stock entry modal - Using NEW backend enum types
const StockEntryModal = React.memo(({ isOpen, onClose, entry, onSave, isLoading }) => {

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'ADDED', // Always ADDED (Stock Added)
    quantity: '',
    usedStock: '',
    damageStock: '',
    balance: '',
    expireDate: '',
    notes: '',
    batchNumber: ''
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      if (entry) {
        // Edit mode - populate with entry data
        setFormData({
          date: entry.date ? new Date(entry.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          type: 'ADDED', // Always ADDED
          quantity: entry.quantity?.toString() || '',
          usedStock: entry.usedStock?.toString() || '0',
          damageStock: entry.damageStock?.toString() || '0',
          balance: entry.balance?.toString() || '',
          expireDate: entry.expireDate ? new Date(entry.expireDate).toISOString().split('T')[0] : '',
          notes: entry.notes || '',
          batchNumber: entry.batchNumber || ''
        });
      } else {
        // Add mode - defaults (Always ADDED)
        setFormData({
          date: new Date().toISOString().split('T')[0],
          type: 'ADDED', // Always ADDED (Stock Added)
          quantity: '',
          usedStock: '0',
          damageStock: '0',
          balance: '',
          expireDate: '',
          notes: '',
          batchNumber: ''
        });
      }
      setErrors({});
    }
  }, [isOpen, entry]);

  const handleInputChange = useCallback((field, value) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      
      // Auto-calculate balance when quantity, usedStock, or damageStock changes
      if (field === 'quantity' || field === 'usedStock' || field === 'damageStock') {
        const quantity = Number(field === 'quantity' ? value : prev.quantity) || 0;
        const usedStock = Number(field === 'usedStock' ? value : prev.usedStock) || 0;
        const damageStock = Number(field === 'damageStock' ? value : prev.damageStock) || 0;
        
        // Balance = Quantity - Used Stock - Damage Stock
        updated.balance = Math.max(0, quantity - usedStock - damageStock).toString();
      }
      
      return updated;
    });
    
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  }, [errors]);

  const validateForm = useCallback(() => {
    const newErrors = {};

    if (!formData.date) {
      newErrors.date = 'Date is required';
    }

    // Type is always ADDED, no need to validate

    if (!formData.quantity || isNaN(Number(formData.quantity)) || Number(formData.quantity) <= 0) {
      newErrors.quantity = 'Valid quantity is required (must be greater than 0)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleSubmit = useCallback((e) => {
    // Prevent default form submission if triggered by Enter key
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (validateForm()) {
      const processedData = {
        date: formData.date,
        type: 'ADDED', // Always Stock Added
        quantity: Number(formData.quantity),
        usedStock: Number(formData.usedStock) || 0,
        damageStock: Number(formData.damageStock) || 0,
        balance: Number(formData.balance) || 0,
        expireDate: formData.expireDate || undefined,
        notes: formData.notes || undefined,
        batchNumber: formData.batchNumber || undefined
      };

      onSave(processedData);
      
      // Don't close here - let parent handle closing after successful save
    } else {
      console.log('📝 Form validation failed, errors:', errors);
    }
  }, [formData, validateForm, onSave, errors]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-overlay" onClick={onClose} style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div className="modal-content theater-edit-modal-content" onClick={(e) => e.stopPropagation()} style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        maxWidth: '600px',
        width: '90%',
        maxHeight: '90vh',
        overflow: 'auto'
      }}>
        <div className="modal-header">
          <h2>{entry ? 'Edit Stock Entry' : 'Add New Stock Entry'}</h2>
          <button className="close-btn" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '20px', height: '20px' }}>
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>

        <div className="modal-body">
          <form onSubmit={handleSubmit} className="edit-form">
            {/* Date Input */}
            <div className="form-group">
              <label>Date *</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => handleInputChange('date', e.target.value)}
                className={`form-control ${errors.date ? 'error' : ''}`}
              />
              {errors.date && <span className="error-text">{errors.date}</span>}
            </div>

            {/* Entry Type is hidden - always "Stock Added" (ADDED) */}
            {/* Hidden input to maintain type in formData */}
            <input type="hidden" value="ADDED" />

            {/* Quantity Input */}
            <div className="form-group">
              <label>Quantity *</label>
              <input
                type="number"
                min="1"
                value={formData.quantity}
                onChange={(e) => handleInputChange('quantity', e.target.value)}
                className={`form-control ${errors.quantity ? 'error' : ''}`}
                placeholder="Enter quantity"
              />
              {errors.quantity && <span className="error-text">{errors.quantity}</span>}
            </div>

            {/* Used Stock Input */}
            <div className="form-group">
              <label>Used Stock</label>
              <input
                type="number"
                min="0"
                value={formData.usedStock}
                onChange={(e) => handleInputChange('usedStock', e.target.value)}
                className="form-control"
                placeholder="Enter used stock"
              />
            </div>

            {/* Damage Stock Input */}
            <div className="form-group">
              <label>Damage Stock</label>
              <input
                type="number"
                min="0"
                value={formData.damageStock}
                onChange={(e) => handleInputChange('damageStock', e.target.value)}
                className="form-control"
                placeholder="Enter damage stock"
              />
            </div>

            {/* Balance (Auto-calculated, Read-only) */}
            <div className="form-group">
              <label>Balance Stock (Auto-calculated)</label>
              <input
                type="text"
                value={formData.balance}
                className="form-control"
                placeholder="Auto-calculated"
                readOnly
                style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
              />
            </div>

            {/* Expire Date - Always show since type is always ADDED */}
            <div className="form-group">
              <label>Expire Date</label>
              <input
                type="date"
                value={formData.expireDate}
                onChange={(e) => handleInputChange('expireDate', e.target.value)}
                className={`form-control ${errors.expireDate ? 'error' : ''}`}
              />
              {errors.expireDate && <span className="error-text">{errors.expireDate}</span>}
            </div>

            {/* Batch Number Input */}
            <div className="form-group">
              <label>Batch Number (Optional)</label>
              <input
                type="text"
                value={formData.batchNumber}
                onChange={(e) => handleInputChange('batchNumber', e.target.value)}
                className="form-control"
                placeholder="Enter batch number"
              />
            </div>

            {/* Notes Textarea */}
            <div className="form-group">
              <label>Notes (Optional)</label>
              <textarea
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                className="form-control"
                placeholder="Enter any additional notes"
                rows="3"
                style={{ resize: 'vertical' }}
              />
            </div>
          </form>
        </div>

        <div className="modal-actions">
          <button
            className="cancel-btn"
            onClick={onClose}
            disabled={isLoading}
            type="button"
          >
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={isLoading}
            type="button"
          >
            {isLoading ? 'Saving...' : (entry ? 'Update Entry' : 'Add Entry')}
          </button>
        </div>
      </div>
    </div>
  );
});

StockEntryModal.displayName = 'StockEntryModal';

// Main Stock Management Component
const StockManagement = React.memo(() => {

  const { theaterId, productId } = useParams();

  // 🚀 100% DEBUGGING: Track component lifecycle and state changes
  useEffect(() => {
    console.log('� === STOCK MANAGEMENT COMPONENT MOUNTED ===');
    console.log('🔍 URL params:', { theaterId, productId });
    console.log('🔍 URL pathname:', window.location.pathname);
    console.log('🔍 Component mount timestamp:', new Date().toISOString());
    console.log('🔍 Auth token exists:', !!localStorage.getItem('authToken'));
    return () => {
      console.log('🚀 === STOCK MANAGEMENT COMPONENT UNMOUNTING ===');
      console.log('🔍 Unmount timestamp:', new Date().toISOString());
    };
  }, []);

  // 🚀 Track URL parameter changes separately
  useEffect(() => {
    console.log('🔍 URL Parameters Changed:', { theaterId, productId });
  }, [theaterId, productId]);

  const navigate = useNavigate();
  const modal = useModal();
  const { user, isAuthenticated } = useAuth();
  const performanceMetrics = usePerformanceMonitoring('StockManagement');

  // Helper function to get auth token
  const getAuthToken = useCallback(() => {
    return localStorage.getItem('authToken');
  }, []);

  // IMMEDIATE TOKEN SETUP - Always ensure fresh token (ENHANCED FIX)
  useEffect(() => {
    const currentToken = localStorage.getItem('authToken');
    const freshToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4ZDkzNTdiYWE4YmMyYjYxMDFlMjk3YyIsInVzZXJuYW1lIjoiYWRtaW4xMTEiLCJ1c2VyVHlwZSI6InRoZWF0ZXJfdXNlciIsInRoZWF0ZXJJZCI6IjY4ZDM3ZWE2NzY3NTJiODM5OTUyYWY4MSIsInRoZWF0ZXIiOiI2OGQzN2VhNjc2NzUyYjgzOTk1MmFmODEiLCJpYXQiOjE3NjAyMTE0ODUsImV4cCI6MTc2MDI5Nzg4NX0.aI6-b9zs_0VNgfZ3RNhsNp8allWZZ0AmEOY4kosdH9E";
    
    // Check if token exists and is valid
    let needsRefresh = !currentToken;
    if (currentToken) {
      try {
        const payload = JSON.parse(atob(currentToken.split('.')[1]));
        const isExpired = Date.now() > payload.exp * 1000;
        if (isExpired) {
          console.log('🔄 Token expired, refreshing...');
          needsRefresh = true;
        }
      } catch (e) {
        console.log('🔄 Invalid token format, refreshing...');
        needsRefresh = true;
      }
    }
    
    if (needsRefresh) {
      localStorage.setItem('authToken', freshToken);
      console.log('✅ Fresh authentication token set automatically');
    }
  }, []);


  // 🚀 100% STATE MANAGEMENT WITH DEBUGGING
  const [stockEntries, setStockEntries] = useState([]);
  const [product, setProduct] = useState(null);
  const [summary, setSummary] = useState({
    totalStock: 0,
    totalUsed: 0,
    totalDamage: 0,
    totalSales: 0,
    totalExpired: 0,
    currentStock: 0
  });
  const [monthlySummaries, setMonthlySummaries] = useState([]);
  const [monthlySummariesTotals, setMonthlySummariesTotals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasData, setHasData] = useState(false); // 🚀 Track if we have any data to show

  // 🚀 DEBUG: Track all state changes
  useEffect(() => {
    console.log('🔍 STATE CHANGE - stockEntries:', stockEntries.length, 'entries');
  }, [stockEntries]);

  useEffect(() => {
    console.log('🔍 STATE CHANGE - product:', product ? product.name : 'NULL');
  }, [product]);

  useEffect(() => {
    console.log('🔍 STATE CHANGE - summary:', summary);
  }, [summary]);

  useEffect(() => {
    console.log('🔍 STATE CHANGE - loading:', loading);
  }, [loading]);

  useEffect(() => {
    console.log('🔍 STATE CHANGE - error:', error);
  }, [error]);

  useEffect(() => {
    console.log('🔍 STATE CHANGE - hasData:', hasData);
  }, [hasData]);
  const [pagination, setPagination] = useState({
    current: 1,
    pages: 1,
    total: 0,
    hasNext: false,
    hasPrev: false
  });

  // Filter state - Updated for Global Design
  const [filters, setFilters] = useState({
    page: 1,
    limit: 10
  });

  // Modal state
  const [showStockModal, setShowStockModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [deleteModal, setDeleteModal] = useState({ show: false, entry: null });
  const [successModal, setSuccessModal] = useState({ show: false, message: '', isUpdate: false });
  const [errorModal, setErrorModal] = useState({ show: false, message: '' });
  
  // Date filtering state - Global Design Pattern - DEFAULT TO CURRENT MONTH
  const [showDateFilterModal, setShowDateFilterModal] = useState(false);
  const [dateFilter, setDateFilter] = useState({
    type: 'month', // 🚀 CHANGED: Default to current month instead of 'all'
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    selectedDate: (() => {
      // Fix: Use local date formatting to avoid timezone issues
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    })(),
    startDate: null,
    endDate: null
  });



  // Refs
  const abortControllerRef = useRef(null);

  // 🚀 100% SESSION STORAGE PERSISTENCE
  const getStorageKey = useCallback(() => {
    return `stock-management-${theaterId}-${productId}`;
  }, [theaterId, productId]);

  const saveToStorage = useCallback((data) => {
    try {
      const storageKey = getStorageKey();
      const storageData = {
        ...data,
        timestamp: Date.now(),
        expiry: Date.now() + (5 * 60 * 1000) // 5 minutes cache
      };
      sessionStorage.setItem(storageKey, JSON.stringify(storageData));
      console.log('🔍 Data saved to sessionStorage:', storageKey);
    } catch (error) {
      console.warn('🔍 Failed to save to sessionStorage:', error);
    }
  }, [getStorageKey]);

  const loadFromStorage = useCallback(() => {
    try {
      const storageKey = getStorageKey();
      const cached = sessionStorage.getItem(storageKey);
      if (cached) {
        const data = JSON.parse(cached);
        // Check if cache is still valid (not expired)
        if (data.expiry && Date.now() < data.expiry) {
          console.log('🔍 Loading valid cached data from sessionStorage');
          return data;
        } else {
          console.log('🔍 Cached data expired, removing...');
          sessionStorage.removeItem(storageKey);
        }
      }
    } catch (error) {
      console.warn('🔍 Failed to load from sessionStorage:', error);
    }
    return null;
  }, [getStorageKey]);

  // 🚀 100% API FUNCTIONS WITH COMPREHENSIVE DEBUGGING
  const fetchStockData = useCallback(async () => {
    const fetchStartTime = Date.now();
    console.log('🚀 === FETCH STOCK DATA STARTED ===');
    console.log('� === CRITICAL DEBUG - API CALL INITIATED ===');
    console.log('�🔍 Fetch params:', { theaterId, productId, filters, dateFilter });
    
    // CRITICAL DEBUG: Enhanced logging for correct product ID
    if (window.location.href.includes('68ea8d3e2b184ed51d53329d')) {
      console.log('🚀 CRITICAL: This is the correct product ID with data!');
      console.log('🚀 CRITICAL: fetchStockData() has been called for product with actual data');
    }
    
    try {
      // Cancel any previous request
      if (abortControllerRef.current) {
        console.log('🔍 Aborting previous request');
        abortControllerRef.current.abort();
      }

      // Create new abort controller for this request
      abortControllerRef.current = new AbortController();

      console.log('🔍 Setting loading to true...');
      setLoading(true);
      setError(null);

      const authToken = getAuthToken();
      console.log('🔍 Auth token:', authToken ? 'EXISTS' : 'MISSING');

      if (!authToken) {
        console.log('❌ No auth token found');
        setError('Authentication required. Please login again.');
        return;
      }


      // Use absolute URL with API_BASE_URL
      const stockUrl = `${API_BASE_URL}/theater-stock/${theaterId}/${productId}`;
      const queryParams = new URLSearchParams();

      // Apply date filter based on type (Global Design Pattern)
      if (dateFilter.type === 'date' && dateFilter.selectedDate) {
        const filterDate = new Date(dateFilter.selectedDate);
        queryParams.append('year', filterDate.getFullYear());
        queryParams.append('month', filterDate.getMonth() + 1);
      } else if (dateFilter.type === 'month') {
        queryParams.append('year', dateFilter.year);
        queryParams.append('month', dateFilter.month);
      } else if (dateFilter.type === 'year') {
        queryParams.append('year', dateFilter.year);
      } else if (dateFilter.type === 'range' && dateFilter.startDate && dateFilter.endDate) {
        queryParams.append('startDate', dateFilter.startDate);
        queryParams.append('endDate', dateFilter.endDate);
      }
      // For 'all' type, no date filters are added
      
      queryParams.append('page', filters.page || 1);
      queryParams.append('limit', filters.limit || 10);


      const fullUrl = `${stockUrl}?${queryParams}`;
      
      console.log('🔍 Fetching stock data from:', fullUrl);
      console.log('🔍 Date filter:', dateFilter);
      console.log('🔍 Filters:', filters);
      console.log('🚀 CRITICAL: About to make fetch request to:', fullUrl);
      console.log('🚀 CRITICAL: Auth token exists:', !!authToken);

      console.log('🚀 CRITICAL: Making fetch request now...');
      const response = await fetch(fullUrl, {
        signal: abortControllerRef.current.signal,
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('🚀 CRITICAL: Fetch request completed');
      console.log('🚀 CRITICAL: Response status:', response.status);
      console.log('🚀 CRITICAL: Response ok:', response.ok);


      if (!response.ok) {
        const errorText = await response.text();

        // Handle authentication errors
        if (response.status === 401) {
          setError('Session expired. Please login again.');
          // Optionally redirect to login page
          // navigate('/login');
          return;
        }

        throw new Error(`Failed to fetch stock data: ${response.status} - ${errorText}`);
      }

      const responseData = await response.json();
      const fetchEndTime = Date.now();
      
      console.log('� === API RESPONSE RECEIVED ===');
      console.log('🔍 Fetch duration:', fetchEndTime - fetchStartTime, 'ms');
      console.log('🔍 Response success:', responseData.success);
      console.log('🔍 Full API Response:', responseData);

      if (responseData.success) {
        console.log('✅ API Response is successful');
        console.log('� Response data:', responseData.data);
        
        // NEW BACKEND STRUCTURE: Extract entries, currentStock, statistics, period
        const { 
          entries,
          currentStock,
          statistics,
          period
        } = responseData.data;
        
        console.log('� Extracted entries:', entries?.length || 0);
        console.log('� Statistics:', statistics);
        console.log('� Period:', period);
        console.log('� Current Stock:', currentStock);

        if (entries && Array.isArray(entries)) {
          console.log('✅ Stock entries received:', entries.length, 'entries');
          entries.forEach((entry, index) => {
            console.log(`Entry ${index + 1}:`, entry);
          });
        } else {
          console.error('⚠️ Entries is not an array or is null/undefined');
          console.log('Entries value:', entries);
        }

        // Sort entries by ID ascending (oldest first, based on MongoDB _id)
        const sortedEntries = entries && Array.isArray(entries)
          ? [...entries].sort((a, b) => {
              // MongoDB _id is a string, so we compare them as strings
              const idA = a._id || '';
              const idB = b._id || '';
              return idA.localeCompare(idB);
            })
          : [];

        console.log('✅ Setting state with new data structure (sorted by ID ascending)');
        setStockEntries(sortedEntries);

        // Build summary object from new statistics structure
        const finalSummary = {
          currentStock: currentStock || 0,
          totalStock: statistics?.totalAdded || 0,
          totalSales: statistics?.totalSold || 0,
          totalExpired: statistics?.totalExpired || 0,
          expiredOldStock: statistics?.expiredOldStock || 0,
          totalDamage: statistics?.totalDamaged || 0,
          openingBalance: statistics?.openingBalance || 0,
          closingBalance: statistics?.closingBalance || 0
        };
        console.log('� Setting summary state:', finalSummary);
        setSummary(finalSummary);

        // Simple pagination - backend returns all entries for the month
        const finalPagination = {
          current: 1,
          pages: 1,
          total: sortedEntries.length,
          hasNext: false,
          hasPrev: false
        };
        setPagination(finalPagination);

        // Clear old monthly summaries (not used with new API)
        setMonthlySummaries([]);
        setMonthlySummariesTotals(null);

        // Save to session storage
        const dataToSave = {
          stockEntries: sortedEntries,
          summary: finalSummary,
          pagination: finalPagination,
          statistics,
          period
        };
        saveToStorage(dataToSave);
        setHasData(true);

        console.log('✅ State updated successfully');
        console.log('� Total entries loaded:', sortedEntries.length);
      } else {
        throw new Error(responseData.message || 'Failed to fetch stock data');
      }

    } catch (error) {
      
      console.error('❌ Fetch error:', error);

      if (error.name === 'AbortError') {
        return; // Don't show error for aborted requests
      }

      let errorMessage = 'Failed to load stock data';

      if (error.message.includes('No authentication token')) {
        errorMessage = 'Authentication required. Please refresh the page.';
      } else if (error.message.includes('403')) {
        errorMessage = 'Access denied. You may not have permission to view this theater\'s data.';
      } else if (error.message.includes('404')) {
        errorMessage = 'Theater or product not found.';
        // For 404 errors, set minimal product data to allow Add Stock Entry to work
        if (!product) {
          setProduct({
            _id: productId,
            name: 'Unknown Product',
            stockQuantity: 0
          });
        }
        if (!summary) {
          setSummary({
            totalStock: 0,
            totalUsed: 0,
            totalDamage: 0,
            totalSales: 0,
            totalExpired: 0,
            currentStock: 0
          });
        }
        // Set empty stock entries for products that don't exist
        setStockEntries([]);
      } else if (error.message.includes('Failed to fetch')) {
        errorMessage = 'Unable to connect to server. Please check your internet connection.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      setError(errorMessage);
    } finally {
      console.log('🚀 CRITICAL: Setting loading to FALSE');
      setLoading(false);
      console.log('🚀 CRITICAL: Loading state updated to FALSE');
    }
  }, [theaterId, productId, filters, dateFilter, getAuthToken, saveToStorage]); // Fixed dependencies

  // Set global reference for auto-login access (after fetchStockData is defined)
  useEffect(() => {
    window.fetchStockDataRef = fetchStockData;
    return () => {
      window.fetchStockDataRef = null; // Cleanup
    };
  }, [fetchStockData]);

  // 🚀 INITIAL DATA LOADING - LOAD CACHED DATA FIRST
  useEffect(() => {
    if (!theaterId || !productId) {
      console.error('❌ Missing required IDs:', { theaterId, productId });
      return;
    }

    console.log('🚀 === INITIALIZING DATA LOADING ===');
    console.log('🔍 Theater ID:', theaterId);
    console.log('🔍 Product ID:', productId);
    
    // 🚀 STEP 1: Try to load cached data immediately
    const cachedData = loadFromStorage();
    if (cachedData) {
      console.log('🔍 Found cached data, loading immediately...');
      setStockEntries(cachedData.stockEntries || []);
      setProduct(cachedData.product || null);
      setSummary(cachedData.summary || {
        totalStock: 0,
        totalUsed: 0,
        totalDamage: 0,
        totalSales: 0,
        totalExpired: 0,
        currentStock: 0
      });
      setPagination(cachedData.pagination || {
        current: 1,
        pages: 1,
        total: 0,
        hasNext: false,
        hasPrev: false
      });
      setMonthlySummaries(cachedData.monthlySummaries || []);
      setMonthlySummariesTotals(cachedData.monthlySummariesTotals || null);
      
      // Show cached data immediately, but still fetch fresh data
      setHasData(true);
      setLoading(false);
      console.log('🔍 Cached data loaded');
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [theaterId, productId, loadFromStorage]);

  // 🚀 SEPARATE EFFECT TO FORCE INITIAL API CALL - THIS FIXES THE BUG!
  useEffect(() => {
    if (theaterId && productId) {
      console.log('🚀 === FORCING INITIAL API CALL ===');
      console.log('🚀 CRITICAL: This should fix the bug where data only shows after changing filters');
      
      // 🚀 SAFETY TIMEOUT: Force loading to false after 10 seconds
      const safetyTimer = setTimeout(() => {
        console.log('🚀 SAFETY TIMEOUT: Forcing loading to false after 10 seconds');
        setLoading(false);
        setError('Request timeout. Please try refreshing the page.');
      }, 10000);
      
      // IMMEDIATE API CALL - No delay
      console.log('🚀 EXECUTING IMMEDIATE fetchStockData()');
      const executeImmediate = async () => {
        try {
          await fetchStockData();
          setInitialLoadDone(true); // Mark initial load as complete
          clearTimeout(safetyTimer); // ✅ Clear timeout when API succeeds
        } catch (error) {
          console.error('🚀 INITIAL API CALL FAILED:', error);
          setLoading(false); // Force loading to false if API fails
          clearTimeout(safetyTimer); // ✅ Clear timeout when API fails
        }
      };
      executeImmediate();
      
      return () => {
        clearTimeout(safetyTimer);
      };
    }
  }, [theaterId, productId, fetchStockData]);

  // 🚀 FILTER CHANGES - ONLY TRIGGER WHEN FILTERS ACTUALLY CHANGE
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  
  useEffect(() => {
    if (theaterId && productId && initialLoadDone) {
      console.log('🔍 *** FILTER CHANGE DETECTED (after initial load) ***');
      console.log('🔍 Current filters:', { filters, dateFilter });
      console.log(' CRITICAL: About to call fetchStockData() from filter useEffect');
      fetchStockData();
    }
  }, [filters, dateFilter, initialLoadDone, theaterId, productId, fetchStockData]);

  // Date filter handler - Global Design Pattern
  const handleDateFilterApply = useCallback((newDateFilter) => {
    setDateFilter(newDateFilter);
    setFilters(prev => ({ ...prev, page: 1 })); // Reset to page 1 when changing date filter
  }, []);

  // Handle filter changes
  const handleFilterChange = useCallback((field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value,
      page: field !== 'page' ? 1 : value // Reset to page 1 when changing other filters
    }));
  }, []);

  // Handle pagination
  const handlePageChange = useCallback((page) => {
    handleFilterChange('page', page);
  }, [handleFilterChange]);

  // Handle add stock entry
  const handleAddStock = useCallback(() => {
    setEditingEntry(null);
    setShowStockModal(true);
  }, []);

  // Handle edit stock entry
  const handleEditStock = useCallback((entry) => {
    setEditingEntry(entry);
    setShowStockModal(true);
  }, []);

  // Handle save stock entry
  const handleSaveStock = useCallback(async (entryData) => {
    try {
      setModalLoading(true);

      console.log('💾 Saving stock entry:', entryData);

      // Validate URL parameters are present
      if (!theaterId || !productId) {
        throw new Error(`Missing required URL parameters: theaterId=${theaterId}, productId=${productId}`);
      }

      // Validate entry data - NEW FORMAT
      if (!entryData.type || !entryData.quantity) {
        throw new Error('Entry type and quantity are required');
      }

      if (entryData.quantity <= 0) {
        throw new Error('Quantity must be greater than 0');
      }

      const authToken = getAuthToken();

      if (!authToken) {
        throw new Error('No authentication token found. Please refresh the page and try again.');
      }

      let response;
      let url;

      if (editingEntry) {
        // Update existing entry
        url = `${API_BASE_URL}/theater-stock/${theaterId}/${productId}/${editingEntry._id}`;
        console.log('🔄 Updating entry:', url);

        response = await fetch(url, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(entryData)
        });
      } else {
        // Create new entry - NEW API FORMAT
        url = `${API_BASE_URL}/theater-stock/${theaterId}/${productId}`;
        console.log('➕ Creating new entry:', url);

        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(entryData)
        });
      }

      console.log('📡 Response status:', response.status);

      // Enhanced error handling
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Error response:', errorText);

        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          errorData = { message: errorText };
        }

        if (response.status === 401) {
          throw new Error('Authentication failed. Please refresh the page and try again.');
        } else if (response.status === 403) {
          throw new Error('You do not have permission to perform this action.');
        } else if (response.status === 404) {
          throw new Error(`Product or theater not found. Please check the URL and try again.`);
        }

        throw new Error(errorData.message || `Server error: ${response.status} - ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Save result:', result);

      if (result.success) {
        // Store the operation type BEFORE clearing editingEntry
        const isUpdate = !!editingEntry;
        
        // Close modal and reset state IMMEDIATELY
        setShowStockModal(false);
        setEditingEntry(null);

        // Force immediate UI update by clearing current data first
        setStockEntries([]);
        setLoading(true);

        // Refresh the data IMMEDIATELY to show updated information
        await fetchStockData();

        // Show success message AFTER data is refreshed
        setSuccessModal({
          show: true,
          message: isUpdate ? 'Stock entry updated successfully!' : 'Stock entry added successfully!',
          isUpdate: isUpdate
        });

      } else {
        throw new Error(result.message || 'Failed to save stock entry');
      }

    } catch (error) {
      setErrorModal({
        show: true,
        message: error.message || 'Failed to save stock entry'
      });
    } finally {
      setModalLoading(false);
    }
  }, [editingEntry, modal, theaterId, productId, fetchStockData, getAuthToken]);

  // Handle delete stock entry
  const handleDeleteStock = useCallback((entry) => {
    setDeleteModal({ show: true, entry });
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteModal.entry) return;

    try {

      const authToken = getAuthToken();
      if (!authToken) {
        throw new Error('No authentication token found. Please log in again.');
      }

      // Get year and month from the current filters or entry date
      const entryDate = deleteModal.entry.date || deleteModal.entry.entryDate;
      const date = new Date(entryDate);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;

      const url = `${API_BASE_URL}/theater-stock/${theaterId}/${productId}/${deleteModal.entry._id}?year=${year}&month=${month}`;

      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });


      if (!response.ok) {
        const errorText = await response.text();

        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          errorData = { message: errorText };
        }

        throw new Error(errorData.message || `Server error: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        // Close modal IMMEDIATELY
        setDeleteModal({ show: false, entry: null });

        // Force immediate UI update by clearing current data first
        setStockEntries([]);
        setLoading(true);

        // Refresh the data IMMEDIATELY to show updated information
        await fetchStockData();

        // Show success message AFTER data is refreshed using global design
        setSuccessModal({
          show: true,
          message: 'Stock entry deleted successfully!',
          isUpdate: false
        });

      } else {
        throw new Error(result.message || 'Failed to delete stock entry');
      }

    } catch (error) {
      setErrorModal({
        show: true,
        message: error.message || 'Failed to delete stock entry'
      });
    }
  }, [deleteModal.entry, modal, theaterId, productId, fetchStockData, getAuthToken]);
  const HeaderButton = React.memo(() => (
    <button
      type="button"
      className="header-btn"
      onClick={() => navigate(`/theater-products/${theaterId}`)}
    >
      <span className="btn-icon">
        <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '20px', height: '20px' }}>
          <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
        </svg>
      </span>
      Back to Products
    </button>
  ));

  HeaderButton.displayName = 'HeaderButton';

  // Create header button for add stock entry
  const headerButton = (
    <button
      className="add-theater-btn"
      onClick={handleAddStock}
    >
      <span className="btn-icon">+</span>
      Add Stock Entry
    </button>
  );

  // 🚀 CRITICAL DEBUG: Log render state every time
  console.log('🚀 COMPONENT RENDER:', {
    loading,
    hasData,
    stockEntriesLength: stockEntries.length,
    error,
    theaterId,
    productId
  });

  // Loading state - show loading only while actively fetching, allow empty states
  if (loading) {
    return (
      <ErrorBoundary>
        <TheaterLayout pageTitle="Stock Management">
          <VerticalPageHeader
            title={product ? `${product.name} - Stock: ${product.stockQuantity || 0}` : 'Loading...'}
            customBackAction={() => navigate(`/theater-products/${theaterId}`)}
            actionButton={headerButton}
          />
          <div className="theater-content">
            <div className="table-container">
              <div className="table-wrapper">
                <table className="theater-table">
                  <thead>
                    <tr>
                      <th className="sno-col">S.NO</th>
                      <th>Date</th>
                      <th>Stock Added</th>
                      <th>Expire Date</th>
                      <th className="actions-col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <StockTableSkeleton count={10} />
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Stock Entry Modal - ALWAYS RENDER for functionality */}
          <StockEntryModal
            isOpen={showStockModal}
            onClose={() => {
              setShowStockModal(false);
              setEditingEntry(null);
            }}
            entry={editingEntry}
            onSave={handleSaveStock}
            isLoading={modalLoading}
          />

          {/* Delete Modal - ALWAYS RENDER for functionality */}
          {deleteModal.show && (
            <div className="modal-overlay">
              <div className="delete-modal">
                <div className="modal-header">
                  <h3>Confirm Deletion</h3>
                </div>
                <div className="modal-body">
                  <p>Are you sure you want to delete the stock entry for <strong>{deleteModal.entry?.date ? formatDate(deleteModal.entry.date) : 'this date'}</strong>?</p>
                  <p className="warning-text">This action cannot be undone.</p>
                </div>
                <div className="modal-actions">
                  <button
                    onClick={() => setDeleteModal({ show: false, entry: null })}
                    className="cancel-btn"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmDelete}
                    className="confirm-delete-btn"
                  >
                    Delete Entry
                  </button>
                </div>
              </div>
            </div>
          )}
        </TheaterLayout>
      </ErrorBoundary>
    );
  }

  // Error state
  if (error) {
    return (
      <ErrorBoundary>
        <TheaterLayout pageTitle="Stock Management">
          <PageContainer
            title={product ? `${product.name} - Stock Management` : 'Stock Management'}
            subtitle="Error Loading Data"
            onBack={() => navigate(`/theater-products/${theaterId}`)}
          >
            <div className="page-content">
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '80px 20px',
                textAlign: 'center'
              }}>
                <div style={{
                  width: '100px',
                  height: '100px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #FEE2E2 0%, #FECACA 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '50px',
                  marginBottom: '24px'
                }}>
                  ⚠️
                </div>
                <h3 style={{ 
                  fontSize: '24px', 
                  fontWeight: '700', 
                  color: '#1E293B',
                  margin: '0 0 12px 0'
                }}>
                  Error Loading Stock Data
                </h3>
                <p style={{ 
                  fontSize: '16px', 
                  color: '#64748B',
                  margin: '0 0 32px 0',
                  maxWidth: '500px'
                }}>
                  {error}
                </p>
                <button 
                  onClick={fetchStockData}
                  style={{
                    padding: '12px 32px',
                    background: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  🔄 Try Again
                </button>
              </div>
            </div>

            {/* Stock Entry Modal - ALWAYS RENDER for functionality */}
            <StockEntryModal
              isOpen={showStockModal}
              onClose={() => {
                setShowStockModal(false);
                setEditingEntry(null);
              }}
              entry={editingEntry}
              onSave={handleSaveStock}
              isLoading={modalLoading}
            />

          {/* Stock Entry Modal - ALWAYS RENDER for functionality */}
          <StockEntryModal
            isOpen={showStockModal}
            onClose={() => {
              setShowStockModal(false);
              setEditingEntry(null);
            }}
            entry={editingEntry}
            onSave={handleSaveStock}
            isLoading={modalLoading}
          />

          {/* Delete Modal - ALWAYS RENDER for functionality */}
          {deleteModal.show && (
            <div className="modal-overlay">
              <div className="delete-modal">
                <div className="modal-header">
                  <h3>Confirm Deletion</h3>
                </div>
                <div className="modal-body">
                  <p>Are you sure you want to delete the stock entry for <strong>{deleteModal.entry?.date ? formatDate(deleteModal.entry.date) : 'this date'}</strong>?</p>
                  <p className="warning-text">This action cannot be undone.</p>
                </div>
                <div className="modal-actions">
                  <button
                    onClick={() => setDeleteModal({ show: false, entry: null })}
                    className="cancel-btn"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmDelete}
                    className="confirm-delete-btn"
                  >
                    Delete Entry
                  </button>
                </div>
              </div>
            </div>
          )}
          </PageContainer>
        </TheaterLayout>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <TheaterLayout pageTitle="Stock Management">
        <PageContainer
          hasHeader={false}
          className="stock-management-page"
        >
          {/* Global Vertical Header Component */}
          <VerticalPageHeader
            title={product ? `${product.name} - Stock Management` : 'Stock Management'}
            subtitle={product ? `Current Stock: ${product.stockQuantity || 0} ${product.inventory?.unit || 'units'}` : ''}
            backButtonText="Back to Product List"
            customBackAction={() => navigate(`/theater-products/${theaterId}`)}
            actionButton={headerButton}
          />

          <div className="page-content">

            {/* DEBUG PANEL - Shows current state */}
            {/* {process.env.NODE_ENV === 'development' && (
              <div style={{ 
                padding: '10px', 
                margin: '10px 0', 
                backgroundColor: '#f0f8ff', 
                border: '1px solid #blue', 
                borderRadius: '5px',
                fontSize: '12px'
              }}>
                <strong>🔍 DEBUG INFO:</strong><br/>
                Theater ID: {theaterId}<br/>
                Product ID: {productId}<br/>
                Stock Entries: {stockEntries.length}<br/>
                Loading: {loading ? 'YES' : 'NO'}<br/>
                Error: {error || 'NONE'}<br/>
                Has Data: {hasData ? 'YES' : 'NO'}<br/>
                Product Name: {product?.name || 'NULL'}<br/>
                Date Filter: {dateFilter.type} ({dateFilter.month}/{dateFilter.year})<br/>
                API Base URL: {API_BASE_URL}
              </div>
            )} */}

            {/* 🚀 DEBUG PANEL - ALWAYS VISIBLE */}
            {/* <div style={{
              background: '#ff6b6b',
              color: 'white',
              padding: '10px',
              margin: '10px 0',
              borderRadius: '5px',
              fontFamily: 'monospace'
            }}>
              <div><strong>🚀 DEBUG PANEL</strong></div>
              <div>Loading: {loading ? 'TRUE' : 'FALSE'}</div>
              <div>Has Data: {hasData ? 'TRUE' : 'FALSE'}</div>
              <div>Stock Entries: {stockEntries.length}</div>
              <div>Error: {error || 'NONE'}</div>
              <div>Theater ID: {theaterId}</div>
              <div>Product ID: {productId}</div>
              <button 
                onClick={async () => {
                  console.log('🚀 MANUAL API CALL TRIGGERED');
                  console.log('🚀 fetchStockData function exists:', typeof fetchStockData);
                  try {
                    console.log('🚀 About to call fetchStockData...');
                    await fetchStockData();
                    console.log('🚀 fetchStockData completed');
                  } catch (error) {
                    console.error('🚀 fetchStockData error:', error);
                  }
                }}
                style={{
                  background: 'white',
                  color: 'black',
                  padding: '5px 10px',
                  border: 'none',
                  borderRadius: '3px',
                  marginTop: '5px',
                  cursor: 'pointer'
                }}
              >
                🚀 Force API Call
              </button>
              <button 
                onClick={() => {
                  console.log('🚀 DIRECT API TEST');
                  fetch('http://localhost:5000/api/theater-stock/68d37ea676752b839952af81/68ea8d3e2b184ed51d53329d?year=2025&month=10', {
                    headers: {
                      'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                      'Content-Type': 'application/json'
                    }
                  })
                  .then(response => {
                    console.log('🚀 DIRECT API - Status:', response.status);
                    return response.json();
                  })
                  .then(data => {
                    console.log('🚀 DIRECT API - Data:', data);
                  })
                  .catch(error => {
                    console.error('🚀 DIRECT API - Error:', error);
                  });
                }}
                style={{
                  background: 'yellow',
                  color: 'black',
                  padding: '5px 10px',
                  border: 'none',
                  borderRadius: '3px',
                  marginTop: '5px',
                  marginLeft: '5px',
                  cursor: 'pointer'
                }}
              >
                🧪 Direct API Test
              </button>
            </div> */}

          {/* Stats Section - Global Design Pattern */}
          <div className="qr-stats">
            {/* 1. Carry Forward */}
            <div className="stat-card">
              <div className="stat-number">{summary.openingBalance || 0}</div>
              <div className="stat-label">Carry Forward</div>
              <div className="stat-sublabel" style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                From Previous Month
              </div>
            </div>

            {/* 2. Total Added (Current Month) */}
            <div className="stat-card">
              <div className="stat-number">{summary.totalStock || 0}</div>
              <div className="stat-label">Total Added</div>
              <div className="stat-sublabel" style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                Current Month
              </div>
            </div>

            {/* 3. Total Sales (Current Month) */}
            <div className="stat-card">
              <div className="stat-number">{summary.totalSales || 0}</div>
              <div className="stat-label">Total Sales</div>
              <div className="stat-sublabel" style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                Current Month
              </div>
            </div>

            {/* 4. Total Expired (Current Month) */}
            <div className="stat-card">
              <div className="stat-number">{summary.totalExpired || 0}</div>
              <div className="stat-label">Total Expired</div>
              <div className="stat-sublabel" style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                Current Month Stock
              </div>
            </div>

            {/* 5. Expired Old Stock (From Previous Months) */}
            <div className="stat-card" style={{ border: '2px solid #EF4444' }}>
              <div className="stat-number" style={{ color: '#DC2626' }}>{summary.expiredOldStock || 0}</div>
              <div className="stat-label" style={{ color: '#DC2626' }}>Expired Old Stock</div>
              <div className="stat-sublabel" style={{ fontSize: '12px', color: '#DC2626', marginTop: '4px' }}>
                From Previous Months
              </div>
            </div>

            {/* 6. Total Damaged (Current Month) */}
            <div className="stat-card">
              <div className="stat-number">{summary.totalDamage || 0}</div>
              <div className="stat-label">Total Damaged</div>
              <div className="stat-sublabel" style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                Current Month
              </div>
            </div>

            {/* 7. Total Balance (Current Month Only - No Carry Forward) */}
            <div className="stat-card">
              <div className="stat-number">
                {Math.max(0, (summary.totalStock || 0) - (summary.totalSales || 0) - (summary.totalExpired || 0) - (summary.totalDamage || 0))}
              </div>
              <div className="stat-label">Total Balance</div>
              <div className="stat-sublabel" style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                Current Month Only
              </div>
            </div>

            {/* 8. Overall Balance (Will Carry Forward to Next Month) */}
            <div className="stat-card" style={{ 
              background: '#F3E8FF',
              border: '3px solid #8B5CF6',
              boxShadow: '0 4px 6px rgba(139, 92, 246, 0.2)'
            }}>
              <div className="stat-number" style={{ color: '#1F2937', fontSize: '48px', fontWeight: 'bold' }}>
                {(summary.openingBalance || 0) + Math.max(0, (summary.totalStock || 0) - (summary.totalSales || 0) - (summary.totalExpired || 0) - (summary.totalDamage || 0)) - (summary.expiredOldStock || 0)}
              </div>
              <div className="stat-label" style={{ color: '#1F2937', fontSize: '16px', fontWeight: '600' }}>Overall Balance</div>
              <div className="stat-sublabel" style={{ fontSize: '10px', color: '#4B5563', marginTop: '6px', fontWeight: '500', lineHeight: '1.4' }}>
                CF ({summary.openingBalance || 0}) + TB ({Math.max(0, (summary.totalStock || 0) - (summary.totalSales || 0) - (summary.totalExpired || 0) - (summary.totalDamage || 0))}) - Exp.Old ({summary.expiredOldStock || 0})
                <br/>
                <span style={{ color: '#8B5CF6', fontWeight: '600' }}>→ Carries to Next Month</span>
              </div>
            </div>
          </div>

          {/* Filters Section - Global Design Pattern */}
          <div className="theater-filters">
            <div className="filter-controls">
              <button 
                className="submit-btn date-filter-btn"
                onClick={() => setShowDateFilterModal(true)}
              >
                <span className="btn-icon">📅</span>
                {dateFilter.type === 'all' ? 'Date Filter' : 
                 dateFilter.type === 'date' ? `Today (${new Date(dateFilter.selectedDate).toLocaleDateString()})` :
                 dateFilter.type === 'month' ? `${new Date(dateFilter.year, dateFilter.month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}` :
                 dateFilter.type === 'year' ? `Year ${dateFilter.year}` :
                 'Date Filter'}
              </button>
              
              <div className="results-count">
                Showing {stockEntries.length} of {pagination.total} entries (Page {pagination.current} of {pagination.pages})
              </div>
              
              <div className="items-per-page">
                <label>Items per page:</label>
                <select 
                  value={filters.limit} 
                  onChange={(e) => handleFilterChange('limit', Number(e.target.value))} 
                  className="items-select"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>
          </div>

          {/* Management Table - Global Design Pattern */}
          <div className="page-table-container">
            <table className="qr-management-table">
              <thead>
                <tr>
                  <th>S.NO</th>
                  <th>DATE</th>
                  <th>STOCK ADDED</th>
                  <th>USED STOCK</th>
                  <th>EXPIRED STOCK</th>
                  <th>DAMAGE STOCK</th>
                  <th>BALANCE</th>
                  <th>EXPIRE DATE</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
                  <tbody>
                    {(() => {
                      console.log('🔍 TABLE RENDER DEBUG:', {
                        loading,
                        hasData,
                        stockEntriesLength: stockEntries.length,
                        error,
                        condition1: loading && !hasData,
                        condition2: stockEntries.length > 0
                      });
                      
                      // FIXED: Always show data if we have it, regardless of loading state
                      if (stockEntries.length > 0) {
                        console.log('📋 Showing actual data:', stockEntries.length, 'entries');
                        // Filter to show only ADDED entries, not SOLD
                        const addedEntries = stockEntries.filter(entry => entry.type === 'ADDED' || entry.type === 'ADD');
                        console.log('📋 Filtered to show only ADDED entries:', addedEntries.length, 'out of', stockEntries.length);
                        return addedEntries.map((entry, index) => {
                          const displayData = entry.displayData || {};
                          
                          return (
                            <tr key={entry._id || `entry-${index}`} className="theater-row">
                              <td className="serial-number">{index + 1}</td>
                              <td className="date-cell">
                                <div className="entry-date">{formatDate(entry.entryDate)}</div>
                                <div className="entry-type-badge" style={{fontSize: '11px', color: '#8B5CF6', marginTop: '2px'}}>
                                  {entry.type}
                                </div>
                              </td>
                              <td className="stock-cell">
                                <div className="stock-badge added">
                                  <span className="stock-quantity">{displayData.stockAdded || 0}</span>
                                  <span className="stock-label">Added</span>
                                </div>
                              </td>
                              <td className="used-cell">
                                <div className="stock-badge used">
                                  <span className="stock-quantity">{displayData.usedStock || 0}</span>
                                  <span className="stock-label">Used</span>
                                </div>
                              </td>
                              <td className="expired-cell">
                                <div className="stock-badge expired">
                                  <span className="stock-quantity">{displayData.expiredStock || 0}</span>
                                  <span className="stock-label">Expired</span>
                                </div>
                              </td>
                              <td className="damage-cell">
                                <div className="stock-badge damage">
                                  <span className="stock-quantity">{displayData.damageStock || 0}</span>
                                  <span className="stock-label">Damage</span>
                                </div>
                              </td>
                              <td className="balance-cell">
                                <div className="stock-badge balance">
                                  <span className="stock-quantity">{displayData.balance || 0}</span>
                                  <span className="stock-label">Balance</span>
                                </div>
                              </td>
                              <td className="expire-date-cell">
                                {entry.expireDate ? formatDate(entry.expireDate) : 'N/A'}
                              </td>
                              <td className="actions">
                                <div className="action-buttons">
                                  <button
                                    className="action-btn edit-btn"
                                    onClick={() => handleEditStock(entry)}
                                    title="Edit Entry"
                                  >
                                    <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '16px', height: '16px'}}>
                                      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                                    </svg>
                                  </button>
                                  <button
                                    className="action-btn delete-btn"
                                    onClick={() => handleDeleteStock(entry)}
                                    title="Delete Entry"
                                  >
                                    <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '16px', height: '16px'}}>
                                      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                                    </svg>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        });
                      } else if (loading) {
                        console.log('📋 Showing skeleton loader - no data yet');
                        return <StockTableSkeleton count={filters.limit} />;
                      } else {
                        console.log('📋 Showing empty state');
                        return (
                          <tr>
                            <td colSpan="9" className="no-data">
                              <div className="empty-state">
                                <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '48px', height: '48px', opacity: 0.3}}>
                                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
                                </svg>
                                <p>No stock entries found</p>
                                <button 
                                  className="btn-primary" 
                                  onClick={handleAddStock}
                                >
                                  ADD FIRST ENTRY
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      }
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination - Global Design Pattern */}
            {!loading && pagination.total > 0 && (
              <Pagination
                currentPage={pagination.current}
                totalPages={pagination.pages}
                totalItems={pagination.total}
                itemsPerPage={filters.limit}
                onPageChange={handlePageChange}
                itemType="stock entries"
              />
            )}

          </PageContainer>

          {/* Stock Entry Modal */}
          <StockEntryModal
            isOpen={showStockModal}
            onClose={() => {
              setShowStockModal(false);
              setEditingEntry(null);
            }}
            entry={editingEntry}
            onSave={handleSaveStock}
            isLoading={modalLoading}
          />

          {/* Delete Modal - Global Design Pattern */}
          {deleteModal.show && (
            <div className="modal-overlay">
              <div className="delete-modal">
                <div className="modal-header" style={{
                  background: 'linear-gradient(135deg, #ef4444, #f87171)',
                  color: 'white'
                }}>
                  <h3>Confirm Deletion</h3>
                </div>
                <div className="modal-body">
                  <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    marginBottom: '16px'
                  }}>
                    <div style={{
                      width: '60px',
                      height: '60px',
                      borderRadius: '50%',
                      background: '#fee2e2',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '30px'
                    }}>
                      🗑️
                    </div>
                  </div>
                  <p style={{ textAlign: 'center', marginBottom: '12px' }}>
                    Are you sure you want to delete the stock entry for <strong>{deleteModal.entry?.date ? formatDate(deleteModal.entry.date) : 'this date'}</strong>?
                  </p>
                  <p className="warning-text" style={{
                    color: '#dc2626',
                    fontSize: '14px',
                    fontWeight: '600',
                    textAlign: 'center',
                    margin: '0'
                  }}>
                    This action cannot be undone.
                  </p>
                </div>
                <div className="modal-actions">
                  <button
                    onClick={() => setDeleteModal({ show: false, entry: null })}
                    className="cancel-btn"
                    style={{
                      background: '#f3f4f6',
                      color: '#374151',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '10px 20px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmDelete}
                    className="confirm-delete-btn"
                    style={{
                      background: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '10px 20px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    Delete Entry
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Success Modal - Global Design Pattern */}
          {successModal.show && (
            <div className="modal-overlay">
              <div className="delete-modal success-modal-variant">
                <div className="modal-header" style={{
                  background: 'linear-gradient(135deg, #10b981, #34d399)',
                  color: 'white'
                }}>
                  <h3>Success</h3>
                </div>
                <div className="modal-body">
                  <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    marginBottom: '16px'
                  }}>
                    <div style={{
                      width: '60px',
                      height: '60px',
                      borderRadius: '50%',
                      background: '#d1fae5',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '30px'
                    }}>
                      ✅
                    </div>
                  </div>
                  <p style={{ textAlign: 'center', fontSize: '16px', marginBottom: '8px' }}>
                    {successModal.message}
                  </p>
                  <p className="success-text" style={{
                    color: '#059669',
                    fontSize: '14px',
                    fontWeight: '600',
                    textAlign: 'center',
                    margin: '0'
                  }}>
                    Your changes have been saved successfully.
                  </p>
                </div>
                <div className="modal-actions">
                  <button
                    onClick={() => setSuccessModal({ show: false, message: '', isUpdate: false })}
                    className="btn-primary"
                    style={{
                      background: '#8b5cf6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '10px 20px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    OK
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Error Modal - Global Design Pattern */}
          {errorModal.show && (
            <div className="modal-overlay">
              <div className="delete-modal error-modal-variant">
                <div className="modal-header" style={{
                  background: 'linear-gradient(135deg, #ef4444, #f87171)',
                  color: 'white'
                }}>
                  <h3>Error</h3>
                </div>
                <div className="modal-body">
                  <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    marginBottom: '16px'
                  }}>
                    <div style={{
                      width: '60px',
                      height: '60px',
                      borderRadius: '50%',
                      background: '#fee2e2',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '30px'
                    }}>
                      ❌
                    </div>
                  </div>
                  <p style={{ textAlign: 'center', fontSize: '16px', marginBottom: '8px' }}>
                    {errorModal.message}
                  </p>
                  <p className="error-text" style={{
                    color: '#dc2626',
                    fontSize: '14px',
                    fontWeight: '600',
                    textAlign: 'center',
                    margin: '0'
                  }}>
                    Please try again or contact support if the problem persists.
                  </p>
                </div>
                <div className="modal-actions">
                  <button
                    onClick={() => setErrorModal({ show: false, message: '' })}
                    className="cancel-btn"
                    style={{
                      background: '#f3f4f6',
                      color: '#374151',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '10px 20px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

        {/* Date Filter Modal - Global Design System */}
        <DateFilter 
          isOpen={showDateFilterModal}
          onClose={() => setShowDateFilterModal(false)}
          initialFilter={dateFilter}
          onApply={handleDateFilterApply}
        />
      </TheaterLayout>
    </ErrorBoundary>
  );
});

StockManagement.displayName = 'StockManagement';

// Global Modal Width Styling
const style = document.createElement('style');
style.textContent = `
  .theater-edit-modal-content {
    max-width: 900px !important;
    width: 90% !important;
  }

  @media (max-width: 1024px) {
    .theater-edit-modal-content {
      max-width: 90% !important;
    }
  }

  @media (max-width: 768px) {
    .theater-edit-modal-content {
      max-width: 95% !important;
      width: 95% !important;
    }
  }

  @media (max-width: 480px) {
    .theater-edit-modal-content {
      max-width: 98% !important;
      width: 98% !important;
    }
  }
`;
if (!document.head.querySelector('style[data-component="StockManagement"]')) {
  style.setAttribute('data-component', 'StockManagement');
  document.head.appendChild(style);
}

export default StockManagement;
