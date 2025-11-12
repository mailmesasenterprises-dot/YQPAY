/**
 * STOCK HISTORY RESTRUCTURING PROJECT
 * Phase 5: Frontend Components - Month Selector
 */

import React, { useState, useEffect } from 'react';
import config from '../../config';

const MonthSelector = ({ 
  productId, 
  selectedYear,
  selectedMonth, 
  onMonthChange, 
  className = '',
  disabled = false 
}) => {
  const [availableMonths, setAvailableMonths] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  useEffect(() => {
    if (productId && selectedYear) {
      fetchAvailableMonths();
    } else {
      setAvailableMonths([]);
      onMonthChange(null);
    }
  }, [productId, selectedYear]);

  const fetchAvailableMonths = async () => {
    try {
      setLoading(true);
      setError('');

      const token = localStorage.getItem('authToken');
      const response = await fetch(
        config.helpers.getApiUrl(`/stock-history/${productId}/months?year=${selectedYear}`), 
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setAvailableMonths(data.data.availableMonths);

      // Auto-select current month if available and no month is selected
      if (!selectedMonth && data.data.availableMonths.length > 0) {
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth() + 1;

        if (selectedYear === currentYear && data.data.availableMonths.includes(currentMonth)) {
          onMonthChange(currentMonth);
        } else {
          // Select the most recent month
          onMonthChange(Math.max(...data.data.availableMonths));
        }
      }
  } catch (error) {

      setError('Failed to load available months');
    } finally {
      setLoading(false);
    }
  };

  const handleMonthChange = (event) => {
    const month = parseInt(event.target.value);
    onMonthChange(month);
  };

  const formatMonthOption = (monthNum) => {
    return `${monthNum.toString().padStart(2, '0')} - ${monthNames[monthNum - 1]}`;
  };

  return (
    <div className={`month-selector ${className}`}>
      <label htmlFor="month-select">
        🗓️ Select Month:
      </label>
      
      <select
        id="month-select"
        value={selectedMonth || ''}
        onChange={handleMonthChange}
        disabled={disabled || loading || !selectedYear}
        className="form-control"
        style={{
          appearance: 'none',
          WebkitAppearance: 'none',
          MozAppearance: 'none',
          backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6,9 12,15 18,9\'%3e%3c/polyline%3e%3c/svg%3e")',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 12px center',
          backgroundSize: '20px',
          paddingRight: '45px'
        }}
      >
        <option value="">
          {loading ? 'Loading months...' : 
           !selectedYear ? 'Select year first' : 'Select Month'}
        </option>
        {availableMonths.map(month => (
          <option key={month} value={month}>
            {formatMonthOption(month)}
          </option>
        ))}
      </select>

      {error && (
        <div className="error-message" style={{ color: '#ef4444', fontSize: '14px', marginTop: '4px' }}>
          {error}
        </div>
      )}

      {!loading && availableMonths.length === 0 && !error && selectedYear && (
        <div className="info-message" style={{ color: '#666', fontSize: '14px', marginTop: '4px' }}>
          No stock history for {selectedYear}
        </div>
      )}

      <div className="month-info" style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
        {availableMonths.length > 0 && `${availableMonths.length} month(s) available in ${selectedYear}`}
      </div>
    </div>
  );
};

export default MonthSelector;