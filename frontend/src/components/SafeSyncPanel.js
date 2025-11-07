import React, { useState } from 'react';
import { useSyncUtility } from '../hooks/useSyncUtility';

/**
 * Safe Sync Component with Preview
 * Shows exactly what will change before making changes
 */
export const SafeSyncPanel = ({ theaterId, productTypeId }) => {
  const { previewSync, autoFixAll, isLoading, error } = useSyncUtility();
  const [preview, setPreview] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  const handlePreview = async () => {
    try {
      const previewData = await previewSync({ theaterId, productTypeId });
      setPreview(previewData);
      setShowPreview(true);
    } catch (error) {
  }
  };

  const handleConfirmedSync = async () => {
    if (!preview || preview.needsUpdate === 0) return;
    
    const confirmed = window.confirm(
      `This will update ${preview.needsUpdate} products. Are you sure you want to continue?`
    );
    
    if (confirmed) {
      try {
        await autoFixAll({ theaterId, productTypeId });
        alert('Sync completed successfully!');
        setShowPreview(false);
        setPreview(null);
      } catch (error) {
  }
    }
  };

  return (
    <div style={{ 
      border: '1px solid #e0e0e0', 
      borderRadius: '8px', 
      padding: '20px', 
      margin: '10px 0',
      backgroundColor: 'white'
    }}>
      <h3 style={{ color: '#8B5CF6', margin: '0 0 15px 0' }}>
        🛡️ Safe Sync (Preview First)
      </h3>

      {error && (
        <div style={{
          background: '#f8d7da',
          color: '#721c24', 
          padding: '10px',
          borderRadius: '4px',
          margin: '10px 0'
        }}>
          ❌ {error}
        </div>
      )}

      {!showPreview ? (
        <div>
          <p>Preview changes before applying them to ensure safety.</p>
          <button 
            onClick={handlePreview}
            disabled={isLoading}
            style={{
              background: '#8B5CF6',
              color: 'white',
              border: 'none',
              padding: '10px 16px',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            {isLoading ? '🔍 Analyzing...' : '🔍 Preview Changes'}
          </button>
        </div>
      ) : (
        <div>
          {preview && (
            <div>
              <h4>📊 Preview Results:</h4>
              <div style={{ 
                background: '#f8f9fa', 
                padding: '15px', 
                borderRadius: '6px',
                margin: '10px 0'
              }}>
                <p><strong>Total Products:</strong> {preview.totalProducts}</p>
                <p><strong>Already in Sync:</strong> {preview.alreadySynced} ✅</p>
                <p><strong>Need Updates:</strong> {preview.needsUpdate} ⚠️</p>
                <p><strong>Orphaned:</strong> {preview.orphaned} 🔗</p>
              </div>

              {preview.needsUpdate === 0 ? (
                <div style={{ color: '#28a745', fontWeight: 'bold' }}>
                  ✅ All data is already in perfect sync!
                </div>
              ) : (
                <div>
                  <h5>🔄 Products that will be updated:</h5>
                  <div style={{
                    maxHeight: '300px',
                    overflowY: 'auto',
                    border: '1px solid #dee2e6',
                    borderRadius: '4px',
                    padding: '10px',
                    background: 'white'
                  }}>
                    {preview.changes.slice(0, 10).map((change, index) => (
                      <div key={index} style={{ 
                        marginBottom: '15px', 
                        paddingBottom: '10px',
                        borderBottom: '1px solid #f0f0f0'
                      }}>
                        <strong>Product {change.productId}:</strong>
                        {change.changes.map((fieldChange, idx) => (
                          <div key={idx} style={{ 
                            marginLeft: '20px', 
                            fontSize: '14px',
                            color: '#6c757d'
                          }}>
                            📝 <strong>{fieldChange.field}:</strong> "{fieldChange.current}" → "{fieldChange.newValue}"
                          </div>
                        ))}
                      </div>
                    ))}
                    {preview.changes.length > 10 && (
                      <div style={{ color: '#6c757d', fontStyle: 'italic' }}>
                        ... and {preview.changes.length - 10} more products
                      </div>
                    )}
                  </div>

                  <div style={{ margin: '20px 0' }}>
                    <h5>🔒 Fields that will NOT change:</h5>
                    <ul style={{ color: '#6c757d', fontSize: '14px' }}>
                      <li>Product prices (sellingPrice, costPrice)</li>
                      <li>Stock quantities</li>
                      <li>Theater assignments</li>
                      <li>Categories</li>
                      <li>Discounts and tax rates</li>
                      <li>All other product-specific data</li>
                    </ul>
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button 
                      onClick={handleConfirmedSync}
                      disabled={isLoading}
                      style={{
                        background: '#28a745',
                        color: 'white',
                        border: 'none',
                        padding: '10px 16px',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      ✅ Apply Changes ({preview.needsUpdate} products)
                    </button>
                    
                    <button 
                      onClick={() => setShowPreview(false)}
                      style={{
                        background: '#6c757d',
                        color: 'white',
                        border: 'none',
                        padding: '10px 16px',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SafeSyncPanel;