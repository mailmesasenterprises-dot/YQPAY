# DateFilter Component Usage Guide

## Overview
The DateFilter component is a reusable, corporate-styled date filtering modal that can be used across multiple pages in your application.

## Import
```javascript
import DateFilter from '../components/DateFilter';
```

## Basic Usage
```javascript
import React, { useState } from 'react';
import DateFilter from '../components/DateFilter';

const MyComponent = () => {
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [dateFilter, setDateFilter] = useState({
    type: 'all', // or 'date', 'month'
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    selectedDate: null,
    startDate: null,
    endDate: null
  });

  const handleDateFilterApply = (newFilter) => {
    setDateFilter(newFilter);
    // Apply your filtering logic here
    console.log('Applied filter:', newFilter);
  };

  return (
    <div>
      {/* Your trigger button */}
      <button 
        className="submit-btn date-filter-btn"
        onClick={() => setShowDateFilter(true)}
      >
        <span className="btn-icon">📅</span>
        {dateFilter.type === 'all' ? 'Date Filter' : 
         dateFilter.type === 'date' ? `Today (${new Date().toLocaleDateString()})` :
         dateFilter.type === 'month' ? `${new Date(dateFilter.year, dateFilter.month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}` :
         'Date Filter'}
      </button>

      {/* DateFilter Modal */}
      <DateFilter 
        isOpen={showDateFilter}
        onClose={() => setShowDateFilter(false)}
        initialFilter={dateFilter}
        onApply={handleDateFilterApply}
      />
    </div>
  );
};
```

## Props

### Required Props
- `isOpen` (boolean): Controls modal visibility
- `onClose` (function): Called when modal should be closed
- `onApply` (function): Called when filter is applied with new filter object

### Optional Props
- `initialFilter` (object): Initial filter state
  ```javascript
  {
    type: 'all' | 'date' | 'month',
    month: number (1-12),
    year: number,
    selectedDate: string | null (YYYY-MM-DD format),
    startDate: string | null,
    endDate: string | null
  }
  ```

## Filter Types

### 1. All Records (`type: 'all'`)
Shows all records without date filtering.

### 2. Specific Date (`type: 'date'`)
Filters by a specific date. The `selectedDate` will be in YYYY-MM-DD format.

### 3. Month Filter (`type: 'month'`)
Filters by a specific month and year using `month` and `year` properties.

## Features

### 🎨 Corporate Styling
- Violet primary color theme
- Gradient backgrounds
- Professional shadows and animations
- Consistent with corporate design

### 📅 Interactive Calendar
- Click to select specific dates
- Current date highlighted in orange
- Selected date highlighted in violet
- Hover effects and animations

### 📱 Mobile Responsive
- Adapts to different screen sizes
- Touch-friendly buttons
- Stacked layout on mobile

### ⏰ Current Date Display
- Shows today's date and time
- Real-time clock display
- Professional info card design

## CSS Classes
All styles are prefixed with `date-filter-` to avoid conflicts:
- `.date-filter-modal-overlay`
- `.date-filter-modal-content`
- `.date-filter-calendar-day`
- etc.

## Example Integration in API Calls
```javascript
const loadData = async (filter) => {
  const params = new URLSearchParams();
  
  if (filter.type === 'month') {
    params.append('month', filter.month);
    params.append('year', filter.year);
  } else if (filter.type === 'date') {
    params.append('date', filter.selectedDate);
  }
  
  const response = await fetch(`/api/data?${params.toString()}`);
  // Handle response
};
```

## File Structure
```
components/
  DateFilter/
    ├── DateFilter.js      // Main component
    ├── DateFilter.css     // Styles
    └── index.js          // Export file
```

## Advantages
- ✅ Reusable across multiple pages
- ✅ Consistent corporate styling
- ✅ Mobile responsive
- ✅ Professional animations
- ✅ Easy to integrate
- ✅ Customizable initial state
- ✅ Today's date highlighting
- ✅ Multiple filter types support