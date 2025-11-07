// Example: How to integrate sync functionality into AddProduct.js or any other page

import React, { useState } from 'react';
import SyncPanel from '../components/SyncPanel';
import { useSyncUtility } from '../hooks/useSyncUtility';

const AddProductWithSync = () => {
  const [productType, setProductType] = useState('');
  
  // Option 1: Use the full SyncPanel component
  const WithFullPanel = () => (
    <div>
      <h2>Add Product</h2>
      
      {/* Your existing Add Product form */}
      <div className="product-form">
        {/* Your form fields here */}
      </div>
      
      {/* Drop in the sync panel */}
      <SyncPanel 
        theaterId="your-theater-id" 
        productTypeId={productType}
        showDetails={true}
      />
    </div>
  );

  // Option 2: Use compact sync panel
  const WithCompactPanel = () => (
    <div>
      <div className="page-header">
        <h2>Add Product</h2>
        <SyncPanel compact={true} theaterId="your-theater-id" />
      </div>
      
      {/* Your form */}
    </div>
  );

  // Option 3: Use the hook directly for custom implementation
  const WithCustomSync = () => {
    const { quickSync, isLoading, syncStatus } = useSyncUtility();
    
    const handleFormSubmit = async (formData) => {
      // Submit your form
      await submitProduct(formData);
      
      // Auto-sync after adding product
      await quickSync();
    };

    const handleRefresh = async () => {
      // Quick sync before loading data
      await quickSync();
      // Refresh your dropdowns/data
      loadProductTypes();
    };

    return (
      <div>
        <div className="form-actions">
          <button onClick={handleRefresh} disabled={isLoading}>
            {isLoading ? '🔄 Syncing...' : '🔄 Refresh & Sync'}
          </button>
          
          {syncStatus && syncStatus.overall.syncPercentage < 100 && (
            <div className="sync-warning">
              ⚠️ Data may be out of sync ({syncStatus.overall.syncPercentage}%)
            </div>
          )}
        </div>
        
        {/* Your form */}
      </div>
    );
  };

  // Option 4: Background sync on page load
  const WithBackgroundSync = () => {
    const { quickSync } = useSyncUtility();
    
    React.useEffect(() => {
      // Silently sync when page loads
      quickSync().catch(console.error);
    }, [quickSync]);

    return (
      <div>
        {/* Your regular page content - sync happens silently */}
      </div>
    );
  };
  return <WithFullPanel />;
};

// API Usage Examples (for non-React usage or direct API calls):

// 1. Quick sync all data
fetch('/api/sync/fix-all', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({})
});

// 2. Sync specific theater
fetch('/api/sync/products', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ theaterId: 'theater-id-here' })
});

// 3. Sync specific ProductType
fetch('/api/sync/product-type/product-type-id-here', {
  method: 'POST'
});

// 4. Get sync status
fetch('/api/sync/status')
  .then(res => res.json())
  .then(data => );

// Server-side usage in your Node.js routes:
const SyncUtility = require('../utils/syncUtility');

// In any route where you update ProductType
router.put('/product-type/:id', async (req, res) => {
  // Update the ProductType
  await ProductType.findByIdAndUpdate(req.params.id, req.body);
  
  // Force sync related products
  await SyncUtility.forceSyncProductType(req.params.id);
  
  res.json({ success: true });
});

export default AddProductWithSync;