# Pagination Component Usage Guide

## Overview
The Pagination component is a reusable, corporate-styled pagination component with the exact same UI/UX design as the original TheaterOrderHistory pagination. It provides professional navigation controls for data tables and lists.

## Import
```javascript
import Pagination from '../components/Pagination';
```

## Basic Usage
```javascript
import React, { useState } from 'react';
import Pagination from '../components/Pagination';

const MyComponent = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(5);
  const [totalItems, setTotalItems] = useState(50);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    // Load your data for the new page
    loadData(newPage, itemsPerPage);
  };

  return (
    <div>
      {/* Your data table/list here */}
      
      {/* Pagination Component */}
      <Pagination 
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalItems}
        itemsPerPage={itemsPerPage}
        onPageChange={handlePageChange}
        itemType="products"
      />
    </div>
  );
};
```

## Props

### Required Props
- `currentPage` (number): Current active page (1-based)
- `totalPages` (number): Total number of pages
- `totalItems` (number): Total number of items across all pages
- `itemsPerPage` (number): Number of items displayed per page
- `onPageChange` (function): Callback function called when page changes

### Optional Props
- `itemType` (string): Type of items being paginated (default: 'items')
  - Examples: 'orders', 'products', 'users', 'theaters', etc.

## Features

### 🎨 Exact Corporate Design
- **Violet Primary Colors**: Consistent with corporate theme (#8B5CF6)
- **Gradient Backgrounds**: Professional depth and modern appearance
- **Box Shadows**: Proper elevation and hover effects
- **Rounded Corners**: 16px radius for contemporary look
- **Hover Animations**: Smooth transform effects and button movements

### 📊 Professional Information Display
- **Smart Summary**: Shows "Showing 1 to 10 of 50 orders" format
- **Highlighted Numbers**: Important numbers in violet color
- **Page Indicator**: Clean "Page X of Y" display
- **Dynamic Text**: Adapts to different item types

### 🎮 Navigation Controls
- **Previous Button**: Left arrow with smooth hover animation
- **Next Button**: Right arrow with smooth hover animation
- **Disabled States**: Proper styling when buttons can't be used
- **Touch-Friendly**: Large buttons for mobile interaction

### 📱 Mobile Responsive Design
- **Stacked Layout**: Vertical arrangement on mobile devices
- **Reordered Elements**: Controls on top, info at bottom on mobile
- **Icon-Only Mode**: Hides text on very small screens
- **Optimized Touch**: Larger touch targets for mobile

## Example Usage Scenarios

### 1. Basic Table Pagination
```javascript
<Pagination 
  currentPage={currentPage}
  totalPages={totalPages}
  totalItems={totalItems}
  itemsPerPage={itemsPerPage}
  onPageChange={handlePageChange}
  itemType="users"
/>
```

### 2. Products Listing
```javascript
<Pagination 
  currentPage={currentPage}
  totalPages={Math.ceil(totalProducts / productsPerPage)}
  totalItems={totalProducts}
  itemsPerPage={productsPerPage}
  onPageChange={loadProductsPage}
  itemType="products"
/>
```

### 3. Orders Management
```javascript
<Pagination 
  currentPage={currentPage}
  totalPages={orderPagination.totalPages}
  totalItems={orderPagination.totalItems}
  itemsPerPage={orderPagination.itemsPerPage}
  onPageChange={fetchOrdersPage}
  itemType="orders"
/>
```

## Integration with API Calls
```javascript
const loadData = async (page, limit) => {
  try {
    const response = await fetch(`/api/data?page=${page}&limit=${limit}`);
    const data = await response.json();
    
    // Update your state with the received data
    setItems(data.items);
    setCurrentPage(data.pagination.currentPage);
    setTotalPages(data.pagination.totalPages);
    setTotalItems(data.pagination.totalItems);
    setItemsPerPage(data.pagination.itemsPerPage);
  } catch (error) {
    console.error('Failed to load data:', error);
  }
};

const handlePageChange = (newPage) => {
  loadData(newPage, itemsPerPage);
};
```

## CSS Classes
All styles are encapsulated within the component:
- `.professional-pagination-container`
- `.pagination-info-section`
- `.pagination-summary` 
- `.pagination-controls-section`
- `.pagination-nav-btn`
- `.pagination-numbers`

## File Structure
```
components/
  Pagination/
    ├── Pagination.js      // Main component
    ├── Pagination.css     // Exact same styles
    ├── index.js          // Export file
    └── README.md         // This usage guide
```

## Responsive Breakpoints
- **Desktop (>768px)**: Full horizontal layout
- **Tablet (≤768px)**: Vertical layout with reordered elements
- **Mobile (≤480px)**: Icon-only buttons, compact design
- **Small Mobile (≤360px)**: Ultra-compact with minimal padding

## Visual States
- **Normal**: Full violet gradient with shadows
- **Hover**: Elevated with increased shadow and arrow movement
- **Disabled**: Gray background, no interaction
- **Active**: Current page highlighted in violet

## Advantages
- ✅ **Exact Same Design**: Identical to original TheaterOrderHistory pagination
- ✅ **Reusable**: Use across multiple pages consistently
- ✅ **Mobile Optimized**: Perfect responsive behavior
- ✅ **Professional**: Corporate-grade styling and UX
- ✅ **Accessible**: Proper disabled states and hover feedback
- ✅ **Customizable**: Flexible itemType prop for different contexts
- ✅ **Performance**: Optimized component with minimal re-renders

## Browser Support
- ✅ Chrome/Chromium (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Edge (latest)
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)