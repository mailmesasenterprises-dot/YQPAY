/**
 * STOCK HISTORY RESTRUCTURING PROJECT
 * Phase 5: Frontend Components - New Stock History Manager
 */

import React, { useState, useEffect } from 'react';
import YearSelector from './YearSelector';
import MonthSelector from './MonthSelector';
import config from '../../config';

const StockHistoryManagerV2 = ({ productId, productName, onClose }) => {
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [stockEntries, setStockEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Form states
  const [newEntry, setNewEntry] = useState({
    date: '',
    quantity: '',
    pricePerUnit: '',
    supplier: '',
    batchNumber: '',
    expiryDate: '',
    notes: ''
  });
  const [editingEntry, setEditingEntry] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    if (productId && selectedYear && selectedMonth) {
      fetchStockEntries();
    } else {
      setStockEntries([]);
    }
  }, [productId, selectedYear, selectedMonth]);

  const fetchStockEntries = async () => {
    try {
      setLoading(true);
      setError('');

      const token = localStorage.getItem('authToken');
      const response = await fetch(
        config.helpers.getApiUrl(`/stock-history/${productId}/entries?year=${selectedYear}&month=${selectedMonth}`), 
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
      setStockEntries(data.data.stockEntries);
  } catch (error) {

      setError('Failed to load stock entries');
    } finally {
      setLoading(false);
    }
  };

  const handleAddEntry = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError('');

      const token = localStorage.getItem('authToken');
      const response = await fetch(
        config.helpers.getApiUrl(`/stock-history/${productId}/entries`), 
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(newEntry)
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Reset form
      setNewEntry({
        date: '',
        quantity: '',
        pricePerUnit: '',
        supplier: '',
        batchNumber: '',
        expiryDate: '',
        notes: ''
      });
      setShowAddForm(false);
      
      // Refresh entries
      await fetchStockEntries();
  } catch (error) {

      setError('Failed to add stock entry');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateEntry = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError('');

      const token = localStorage.getItem('authToken');
      const response = await fetch(
        config.helpers.getApiUrl(`/stock-history-v2/${productId}/entries/${editingEntry._id}`), 
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(editingEntry)
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Reset editing state
      setEditingEntry(null);
      
      // Refresh entries
      await fetchStockEntries();
  } catch (error) {

      setError('Failed to update stock entry');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEntry = async (entryId) => {
    if (!confirm('Are you sure you want to delete this stock entry?')) {
      return;
    }

    try {
      setLoading(true);
      setError('');

      const token = localStorage.getItem('authToken');
      const response = await fetch(
        config.helpers.getApiUrl(`/stock-history-v2/${productId}/entries/${entryId}`), 
        {
          method: 'DELETE',
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

      // Refresh entries
      await fetchStockEntries();
  } catch (error) {

      setError('Failed to delete stock entry');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatCurrency = (amount) => {
    return `₹${parseFloat(amount).toFixed(2)}`;
  };

  return (
    <div className="stock-history-manager-v2" style={{ padding: '20px' }}>
      <div className="header" style={{ marginBottom: '30px' }}>
        <h2 style={{ color: '#8B5CF6', marginBottom: '10px' }}>
          📦 Stock History - {productName}
        </h2>
        <p style={{ color: '#666', marginBottom: '20px' }}>
          Manage stock entries organized by year and month
        </p>
        
        <div className="selectors" style={{ 
          display: 'flex', 
          gap: '20px', 
          marginBottom: '20px',
          flexWrap: 'wrap'
        }}>
          <YearSelector
            productId={productId}
            selectedYear={selectedYear}
            onYearChange={setSelectedYear}
            className="selector-item"
          />
          
          <MonthSelector
            productId={productId}
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            onMonthChange={setSelectedMonth}
            className="selector-item"
          />
        </div>

        {selectedYear && selectedMonth && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="btn btn-primary"
            style={{ 
              backgroundColor: '#8B5CF6',
              borderColor: '#8B5CF6',
              marginBottom: '20px'
            }}
          >
            {showAddForm ? '❌ Cancel' : '➕ Add Stock Entry'}
          </button>
        )}
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      {/* Add Entry Form */}
      {showAddForm && (
        <div className="add-entry-form" style={{ 
          border: '2px solid #8B5CF6', 
          borderRadius: '8px', 
          padding: '20px', 
          marginBottom: '30px',
          backgroundColor: '#f8f9fa'
        }}>
          <h4 style={{ color: '#8B5CF6', marginBottom: '15px' }}>
            ➕ Add New Stock Entry
          </h4>
          
          <form onSubmit={handleAddEntry}>
            <div className="row">
              <div className="col-md-6">
                <div className="form-group">
                  <label>📅 Date:</label>
                  <input
                    type="date"
                    className="form-control"
                    value={newEntry.date}
                    onChange={(e) => setNewEntry({...newEntry, date: e.target.value})}
                    required
                  />
                </div>
              </div>
              
              <div className="col-md-6">
                <div className="form-group">
                  <label>📦 Quantity:</label>
                  <input
                    type="number"
                    className="form-control"
                    value={newEntry.quantity}
                    onChange={(e) => setNewEntry({...newEntry, quantity: e.target.value})}
                    required
                  />
                </div>
              </div>
              
              <div className="col-md-6">
                <div className="form-group">
                  <label>💰 Price Per Unit:</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    value={newEntry.pricePerUnit}
                    onChange={(e) => setNewEntry({...newEntry, pricePerUnit: e.target.value})}
                    required
                  />
                </div>
              </div>
              
              <div className="col-md-6">
                <div className="form-group">
                  <label>🏪 Supplier:</label>
                  <input
                    type="text"
                    className="form-control"
                    value={newEntry.supplier}
                    onChange={(e) => setNewEntry({...newEntry, supplier: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="col-md-6">
                <div className="form-group">
                  <label>🏷️ Batch Number:</label>
                  <input
                    type="text"
                    className="form-control"
                    value={newEntry.batchNumber}
                    onChange={(e) => setNewEntry({...newEntry, batchNumber: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="col-md-6">
                <div className="form-group">
                  <label>⏰ Expiry Date:</label>
                  <input
                    type="date"
                    className="form-control"
                    value={newEntry.expiryDate}
                    onChange={(e) => setNewEntry({...newEntry, expiryDate: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="col-md-12">
                <div className="form-group">
                  <label>📝 Notes:</label>
                  <textarea
                    className="form-control"
                    rows="2"
                    value={newEntry.notes}
                    onChange={(e) => setNewEntry({...newEntry, notes: e.target.value})}
                  ></textarea>
                </div>
              </div>
            </div>
            
            <button 
              type="submit" 
              className="btn btn-success"
              disabled={loading}
            >
              {loading ? '⏳ Adding...' : '✅ Add Entry'}
            </button>
          </form>
        </div>
      )}

      {/* Stock Entries List */}
      {selectedYear && selectedMonth && (
        <div className="stock-entries">
          <h4 style={{ color: '#8B5CF6', marginBottom: '15px' }}>
            📋 Stock Entries for {selectedMonth.toString().padStart(2, '0')}/{selectedYear}
          </h4>
          
          {loading && (
            <div className="text-center">
              <div className="spinner-border text-primary" role="status">
                <span className="sr-only">Loading...</span>
              </div>
              <p>Loading stock entries...</p>
            </div>
          )}
          
          {!loading && stockEntries.length === 0 && (
            <div className="alert alert-info">
              📭 No stock entries found for {selectedMonth.toString().padStart(2, '0')}/{selectedYear}
            </div>
          )}
          
          {!loading && stockEntries.length > 0 && (
            <div className="table-responsive">
              <table className="table table-striped table-bordered">
                <thead className="thead-dark">
                  <tr>
                    <th>📅 Date</th>
                    <th>📦 Quantity</th>
                    <th>💰 Price/Unit</th>
                    <th>💵 Total Value</th>
                    <th>🏪 Supplier</th>
                    <th>🏷️ Batch</th>
                    <th>⏰ Expiry</th>
                    <th>📝 Notes</th>
                    <th>🔧 Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {stockEntries.map((entry, index) => (
                    <tr key={entry._id || index}>
                      <td>{formatDate(entry.date)}</td>
                      <td>{entry.quantity}</td>
                      <td>{formatCurrency(entry.pricePerUnit)}</td>
                      <td>{formatCurrency(entry.quantity * entry.pricePerUnit)}</td>
                      <td>{entry.supplier || '-'}</td>
                      <td>{entry.batchNumber || '-'}</td>
                      <td>{entry.expiryDate ? formatDate(entry.expiryDate) : '-'}</td>
                      <td>{entry.notes || '-'}</td>
                      <td>
                        <button
                          className="btn btn-sm btn-warning mr-1"
                          onClick={() => setEditingEntry(entry)}
                          style={{ marginRight: '5px' }}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDeleteEntry(entry._id)}
                        >
                          🗑️ Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Edit Entry Modal */}
      {editingEntry && (
        <div className="modal" style={{ 
          display: 'block', 
          backgroundColor: 'rgba(0,0,0,0.5)',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1050
        }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">✏️ Edit Stock Entry</h5>
                <button 
                  type="button" 
                  className="close" 
                  onClick={() => setEditingEntry(null)}
                >
                  <span>&times;</span>
                </button>
              </div>
              
              <form onSubmit={handleUpdateEntry}>
                <div className="modal-body">
                  <div className="row">
                    <div className="col-md-6">
                      <div className="form-group">
                        <label>📅 Date:</label>
                        <input
                          type="date"
                          className="form-control"
                          value={editingEntry.date ? editingEntry.date.split('T')[0] : ''}
                          onChange={(e) => setEditingEntry({...editingEntry, date: e.target.value})}
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="col-md-6">
                      <div className="form-group">
                        <label>📦 Quantity:</label>
                        <input
                          type="number"
                          className="form-control"
                          value={editingEntry.quantity}
                          onChange={(e) => setEditingEntry({...editingEntry, quantity: e.target.value})}
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="col-md-6">
                      <div className="form-group">
                        <label>💰 Price Per Unit:</label>
                        <input
                          type="number"
                          step="0.01"
                          className="form-control"
                          value={editingEntry.pricePerUnit}
                          onChange={(e) => setEditingEntry({...editingEntry, pricePerUnit: e.target.value})}
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="col-md-6">
                      <div className="form-group">
                        <label>🏪 Supplier:</label>
                        <input
                          type="text"
                          className="form-control"
                          value={editingEntry.supplier || ''}
                          onChange={(e) => setEditingEntry({...editingEntry, supplier: e.target.value})}
                        />
                      </div>
                    </div>
                    
                    <div className="col-md-6">
                      <div className="form-group">
                        <label>🏷️ Batch Number:</label>
                        <input
                          type="text"
                          className="form-control"
                          value={editingEntry.batchNumber || ''}
                          onChange={(e) => setEditingEntry({...editingEntry, batchNumber: e.target.value})}
                        />
                      </div>
                    </div>
                    
                    <div className="col-md-6">
                      <div className="form-group">
                        <label>⏰ Expiry Date:</label>
                        <input
                          type="date"
                          className="form-control"
                          value={editingEntry.expiryDate ? editingEntry.expiryDate.split('T')[0] : ''}
                          onChange={(e) => setEditingEntry({...editingEntry, expiryDate: e.target.value})}
                        />
                      </div>
                    </div>
                    
                    <div className="col-md-12">
                      <div className="form-group">
                        <label>📝 Notes:</label>
                        <textarea
                          className="form-control"
                          rows="2"
                          value={editingEntry.notes || ''}
                          onChange={(e) => setEditingEntry({...editingEntry, notes: e.target.value})}
                        ></textarea>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="modal-footer">
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={() => setEditingEntry(null)}
                  >
                    ❌ Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={loading}
                  >
                    {loading ? '⏳ Updating...' : '✅ Update Entry'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <div className="footer-actions" style={{ marginTop: '30px', textAlign: 'center' }}>
        <button 
          className="btn btn-secondary"
          onClick={onClose}
        >
          🔙 Back to Product Management
        </button>
      </div>
    </div>
  );
};

export default StockHistoryManagerV2;