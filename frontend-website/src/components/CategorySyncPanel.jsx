import React, { useState } from 'react';
import { useSyncUtility } from '../hooks/useSyncUtility';

/**
 * Enhanced Category Sync Panel Component
 * Drop this into any Category management page for comprehensive sync functionality
 */
export const CategorySyncPanel = ({ theaterId, categoryId, showDetails = true, compact = false }) => {
  const {
    syncCategory,
    syncCategories,
    verifyCategoryConsistency,
    isLoading,
    error,
    clearError
  } = useSyncUtility();

  const [categoryReport, setCategoryReport] = useState(null);
  const [showReport, setShowReport] = useState(false);

  const handleVerifyCategories = async () => {
    try {
      const report = await verifyCategoryConsistency({ theaterId, categoryId });
      setCategoryReport(report);
      setShowReport(true);
    } catch (error) {
  }
  };

  const handleSyncCategories = async () => {
    try {
      const result = await syncCategories({ theaterId, categoryId });
      alert(`Category sync completed: ${result.successfulSyncs} products updated`);
      setShowReport(false);
    } catch (error) {
  }
  };

  const handleSyncSpecificCategory = async () => {
    if (!categoryId) {
      alert('Category ID is required for this operation');
      return;
    }
    
    try {
      const result = await syncCategory(categoryId);
      alert(`Synced ${result.productsUpdated} products for category "${result.categoryName}"`);
    } catch (error) {
  }
  };

  if (compact) {
    return (
      <div className="sync-panel compact" style={{ 
        padding: '10px', 
        background: '#f8f9fa', 
        border: '1px solid #dee2e6',
        borderRadius: '6px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }}>
        <button 
          onClick={handleSyncCategories} 
          disabled={isLoading}
          style={{
            background: '#8B5CF6',
            color: 'white',
            border: 'none',
            padding: '8px 12px',
            borderRadius: '4px',
            fontSize: '12px'
          }}
        >
          {isLoading ? '⏳' : '🏷️'} Sync Categories
        </button>
        
        {error && <span style={{ color: '#dc3545', fontSize: '12px' }}>❌ {error}</span>}
      </div>
    );
  }

  return (
    <div style={{ 
      background: 'white',
      border: '1px solid #e0e0e0',
      borderRadius: '8px',
      padding: '20px',
      margin: '10px 0'
    }}>
      <h3 style={{ color: '#8B5CF6', margin: '0 0 15px 0' }}>
        🏷️ Category Data Synchronization
      </h3>

      {error && (
        <div style={{
          background: '#f8d7da',
          color: '#721c24',
          padding: '10px',
          borderRadius: '4px',
          margin: '10px 0',
          display: 'flex',
          justifyContent: 'space-between'
        }}>
          ❌ {error}
          <button onClick={clearError} style={{ background: 'none', border: 'none' }}>×</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <button 
          onClick={handleVerifyCategories}
          disabled={isLoading}
          style={{
            background: '#17a2b8',
            color: 'white',
            border: 'none',
            padding: '10px 16px',
            borderRadius: '6px'
          }}
        >
          🔍 Verify Category Sync
        </button>
        
        <button 
          onClick={handleSyncCategories}
          disabled={isLoading}
          style={{
            background: '#28a745',
            color: 'white',
            border: 'none',
            padding: '10px 16px',
            borderRadius: '6px'
          }}
        >
          🔄 Sync All Categories
        </button>
        
        {categoryId && (
          <button 
            onClick={handleSyncSpecificCategory}
            disabled={isLoading}
            style={{
              background: '#8B5CF6',
              color: 'white',
              border: 'none',
              padding: '10px 16px',
              borderRadius: '6px'
            }}
          >
            🎯 Sync This Category
          </button>
        )}
      </div>

      {showReport && categoryReport && (
        <div style={{
          background: '#f8f9fa',
          border: '1px solid #dee2e6',
          borderRadius: '6px',
          overflow: 'hidden'
        }}>
          <div style={{
            background: '#8B5CF6',
            color: 'white',
            padding: '12px 16px',
            display: 'flex',
            justifyContent: 'space-between'
          }}>
            <h4 style={{ margin: 0 }}>📊 Category Sync Report</h4>
            <button 
              onClick={() => setShowReport(false)}
              style={{ background: 'none', border: 'none', color: 'white' }}
            >
              ×
            </button>
          </div>
          
          <div style={{ padding: '16px' }}>
            <div style={{ marginBottom: '15px' }}>
              <p><strong>Total Products with Categories:</strong> {categoryReport.totalChecked}</p>
              <p><strong>✅ In Sync:</strong> {categoryReport.summary.consistent}</p>
              <p><strong>⚠️ Out of Sync:</strong> {categoryReport.summary.inconsistent}</p>
              <p><strong>🔗 No Category Link:</strong> {categoryReport.summary.orphaned}</p>
            </div>

            {categoryReport.inconsistencies.length > 0 && (
              <div>
                <h5>🔄 Categories that need sync:</h5>
                <div style={{
                  maxHeight: '200px',
                  overflowY: 'auto',
                  border: '1px solid #dee2e6',
                  borderRadius: '4px',
                  padding: '10px',
                  background: 'white'
                }}>
                  {categoryReport.inconsistencies.slice(0, 5).map((issue, index) => (
                    <div key={index} style={{ marginBottom: '10px', fontSize: '14px' }}>
                      <strong>Product {issue.productId}:</strong>
                      {Object.keys(issue.differences).map(field => {
                        const diff = issue.differences[field];
                        if (!diff.match) {
                          return (
                            <div key={field} style={{ marginLeft: '15px', color: '#6c757d' }}>
                              📝 {field}: "{diff.product}" → "{diff.category}"
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  ))}
                  {categoryReport.inconsistencies.length > 5 && (
                    <div style={{ fontStyle: 'italic', color: '#6c757d' }}>
                      ... and {categoryReport.inconsistencies.length - 5} more issues
                    </div>
                  )}
                </div>

                <button 
                  onClick={handleSyncCategories}
                  disabled={isLoading}
                  style={{
                    background: '#28a745',
                    color: 'white',
                    border: 'none',
                    padding: '10px 16px',
                    borderRadius: '6px',
                    marginTop: '10px'
                  }}
                >
                  ✅ Fix All Issues ({categoryReport.summary.inconsistent} products)
                </button>
              </div>
            )}

            {categoryReport.summary.inconsistent === 0 && (
              <div style={{ color: '#28a745', fontWeight: 'bold', textAlign: 'center' }}>
                🎉 All category data is perfectly synchronized!
              </div>
            )}
          </div>
        </div>
      )}

      {showDetails && (
        <div style={{ marginTop: '20px', fontSize: '14px', color: '#6c757d' }}>
          <h5>📋 Category Fields Synced:</h5>
          <ul>
            <li>✅ Category Name (name → categoryText)</li>
            <li>✅ Category Description (description → categoryDescription)</li>
            <li>✅ Category Image (imageUrl → categoryImage)</li>
            <li>✅ Category Status (isActive → categoryActive)</li>
          </ul>
          
          <h5>🔒 Protected Fields:</h5>
          <ul>
            <li>Product names, prices, and stock</li>
            <li>ProductType associations</li>
            <li>Theater assignments</li>
            <li>All other product-specific data</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default CategorySyncPanel;