# VerticalPageHeader Component

## Overview
A reusable React component that provides a professional vertical page header with gradient background, back button, title, and optional action buttons. Designed for consistent UI across the application.

## Features
- ✅ Vertical layout (back button on top, title and action on bottom)
- ✅ Corporate violet gradient background
- ✅ Responsive design for mobile and desktop
- ✅ Customizable back button text and navigation
- ✅ Support for multiple action buttons
- ✅ Professional hover effects and animations

## Usage

### Basic Usage
```jsx
import VerticalPageHeader from '../components/VerticalPageHeader';

<VerticalPageHeader
  title="Page Title"
  backButtonText="← Back"
  backButtonPath="/previous-page"
/>
```

### With Action Button
```jsx
<VerticalPageHeader
  title="Theater Management" 
  backButtonText="Back to Theater List"
  backButtonPath="/theater-users"
  actionButton={
    <button className="header-btn" onClick={handleAction}>
      <span>Add User</span>
    </button>
  }
/>
```

### With Multiple Action Buttons
```jsx
<VerticalPageHeader
  title="User Management"
  backButtonPath="/dashboard"
  actionButton={
    <>
      <button className="header-btn" onClick={handleAdd}>Add User</button>
      <button className="header-btn" onClick={handleExport}>Export</button>
    </>
  }
/>
```

### With Custom Back Action
```jsx
<VerticalPageHeader
  title="Settings"
  customBackAction={() => {
    // Custom logic before navigation
    if (hasUnsavedChanges) {
      showConfirmDialog();
    } else {
      navigate('/dashboard');
    }
  }}
/>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | **Required** | Main title text displayed in the header |
| `backButtonText` | `string` | `"← Back"` | Text shown on the back button |
| `backButtonPath` | `string` | `undefined` | Path to navigate when back button is clicked |
| `actionButton` | `React.ReactNode` | `undefined` | Action button(s) to display on the right |
| `showBackButton` | `boolean` | `true` | Whether to show the back button |
| `customBackAction` | `function` | `undefined` | Custom function to execute instead of navigation |
| `className` | `string` | `""` | Additional CSS classes to apply |

## Examples in Different Pages

### 1. Theater User Management
```jsx
<VerticalPageHeader
  title={theater?.name || 'Theater Management'}
  backButtonText="Back to Theater List" 
  backButtonPath="/theater-users"
  actionButton={
    <button className="header-btn" onClick={() => setShowCreateUserForm(true)}>
      Add User
    </button>
  }
/>
```

### 2. Product Management
```jsx
<VerticalPageHeader
  title="Product Management"
  backButtonText="Back to Dashboard"
  backButtonPath="/dashboard" 
  actionButton={
    <>
      <button className="header-btn" onClick={handleAddProduct}>Add Product</button>
      <button className="header-btn" onClick={handleImport}>Import CSV</button>
    </>
  }
/>
```

### 3. Settings Page
```jsx
<VerticalPageHeader
  title="System Settings"
  backButtonText="Back to Dashboard"
  backButtonPath="/dashboard"
  actionButton={
    <button className="header-btn" onClick={handleSave}>
      Save Changes
    </button>
  }
/>
```

### 4. QR Management
```jsx
<VerticalPageHeader
  title="QR Code Management"
  backButtonText="Back to Theater"
  customBackAction={() => navigate(`/theater-details/${theaterId}`)}
  actionButton={
    <button className="header-btn" onClick={handleGenerateQR}>
      Generate QR Code
    </button>
  }
/>
```

## Styling

The component comes with built-in CSS that matches your corporate design:
- Primary violet gradient background (`--primary-color` to `--primary-dark`)
- White text and proper contrast
- Responsive breakpoints for mobile
- Smooth hover animations
- Professional shadows and effects

### Custom Styling
You can add custom classes:
```jsx
<VerticalPageHeader
  title="Custom Page"
  className="my-custom-header-class"
/>
```

## Benefits

1. **Consistency**: Same header design across all pages
2. **Reusability**: Use anywhere with different props
3. **Maintainability**: Update design in one place
4. **Responsive**: Works on all screen sizes
5. **Professional**: Corporate violet gradient design
6. **Flexible**: Support for various button configurations

## Migration from Custom Headers

### Before (Custom CSS):
```jsx
<div className="custom-vertical-header">
  <div className="back-button-row">...</div>
  <div className="title-and-button-row">...</div>
</div>
```

### After (Global Component):
```jsx
<VerticalPageHeader
  title="Page Title"
  backButtonPath="/back-path"
  actionButton={<button>Action</button>}
/>
```

This reduces code duplication and ensures consistent styling across your application!