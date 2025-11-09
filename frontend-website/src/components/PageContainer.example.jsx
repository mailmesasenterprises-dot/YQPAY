// Example: How to use the Global PageContainer Component

import React from 'react';
import config from '../config';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import PageContainer from '../components/PageContainer';

const ExamplePage = () => {
  const navigate = useNavigate();

  // Example header button
  const headerButton = (
    <button 
      onClick={() => navigate('/add-item')} 
      className="header-btn"
    >
      <span className="btn-icon">
        <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '20px', height: '20px'}}>
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
        </svg>
      </span>
      Add New Item
    </button>
  );

  return (
    <AdminLayout pageTitle="Example Page" currentPage="example">
      <PageContainer
        title="Example Management"
        subtitle="Manage your items efficiently"
        headerButton={headerButton}
      >
        {/* Filters Section */}
        <div className="page-filters">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search items..."
              className="search-input"
            />
          </div>
          <div className="filter-controls">
            <select className="status-filter">
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>
        </div>

        {/* Main Content */}
        <div className="page-main-content">
          {/* Your table or form content here */}
          <div className="page-table-container">
            <table className="data-table">
              {/* Table content */}
            </table>
          </div>
        </div>
      </PageContainer>
    </AdminLayout>
  );
};

export default ExamplePage;

/*
USAGE EXAMPLES:

1. Basic Page with Header:
<PageContainer title="My Page" subtitle="Description">
  <div>Your content here</div>
</PageContainer>

2. Page with Custom Header Button:
<PageContainer 
  title="Management Page" 
  headerButton={<button className="header-btn">Add New</button>}
>
  <div>Your content here</div>
</PageContainer>

3. Page with Custom Header Content:
<PageContainer 
  headerContent={
    <div className="custom-header">
      <h1>Custom Title</h1>
      <div>Custom elements</div>
    </div>
  }
>
  <div>Your content here</div>
</PageContainer>

4. Page without Header:
<PageContainer hasHeader={false}>
  <div>Your content here</div>
</PageContainer>

5. Page with Custom Classes:
<PageContainer 
  className="my-custom-page" 
  title="Special Page"
>
  <div>Your content here</div>
</PageContainer>

CSS CLASSES AVAILABLE:
- .page-container (main wrapper)
- .page-main-container (unified container)
- .page-header (header section)
- .page-content (content wrapper)
- .page-filters (filters section)
- .page-main-content (main content area)
- .page-form-container (form container)
- .page-table-container (table container)
- .header-btn (header button styling)
*/