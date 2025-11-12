/**
 * STOCK HISTORY RESTRUCTURING PROJECT
 * Phase 5: Frontend Components - Year Selector
 */

import React, { useState, useEffect } from 'react';
import config from '../../config';

const YearSelector = ({ 
  productId, 
  selectedYear, 
  onYearChange, 
  className = '',
  disabled = false 
}) => {
  const [availableYears, setAvailableYears] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (productId) {
      fetchAvailableYears();
    }
  }, [productId]);

  const fetchAvailableYears = async () => {
    try {
      setLoading(true);
      setError('');

      const token = localStorage.getItem('authToken');
      const response = await fetch(
        config.helpers.getApiUrl(`/stock-history/${productId}/years`), 
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
      setAvailableYears(data.data.availableYears);

      // Auto-select current year if available and no year is selected
      if (!selectedYear && data.data.availableYears.length > 0) {
        const currentYear = new Date().getFullYear();
        if (data.data.availableYears.includes(currentYear)) {
          onYearChange(currentYear);
        } else {
          // Select the most recent year
          onYearChange(Math.max(...data.data.availableYears));
        }
      }
  } catch (error) {

      setError('Failed to load available years');
    } finally {
      setLoading(false);
    }
  };

  const handleYearChange = (event) => {
    const year = parseInt(event.target.value);
    onYearChange(year);
  };

  return (
    <div className={`year-selector ${className}`}>
      <label htmlFor="year-select">
        📅 Select Year:
      </label>
      
      <select
        id="year-select"
        value={selectedYear || ''}
        onChange={handleYearChange}
        disabled={disabled || loading}
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
          {loading ? 'Loading years...' : 'Select Year'}
        </option>
        {availableYears.map(year => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>

      {error && (
        <div className="error-message" style={{ color: '#ef4444', fontSize: '14px', marginTop: '4px' }}>
          {error}
        </div>
      )}

      {!loading && availableYears.length === 0 && !error && (
        <div className="info-message" style={{ color: '#666', fontSize: '14px', marginTop: '4px' }}>
          No stock history available
        </div>
      )}

      <div className="year-info" style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
        {availableYears.length > 0 && `${availableYears.length} year(s) available`}
      </div>
    </div>
  );
};

export default YearSelector;