# Customer Pages - Global Styling System

## 📋 Overview

All customer-facing pages now share a **unified global styling system** that ensures:
- ✅ Consistent design across all pages
- ✅ iOS safe area support (no white gaps)
- ✅ Automatic styling for new pages
- ✅ AddTheater purple theme (#6B0E9B)
- ✅ Responsive design

---

## 🎨 File Structure

```
src/styles/customer/
├── customer-global.css       ← GLOBAL STYLES (Applied to all pages)
├── CustomerLanding.css        ← Landing page specific
├── CustomerHome.css           ← Home page specific (custom header)
├── CustomerCart.css           ← Cart page specific
├── CustomerCheckout.css       ← Checkout page specific
└── README_CUSTOMER_STYLES.md  ← This file
```

---

## 🌍 Global Styles (`customer-global.css`)

### Automatically Applied To:
- All pages with class `customer-landing`, `customer-home`, `customer-cart`, etc.
- Any element with class starting with `customer-`

### What's Included:

#### 1. **Safe Area Support**
```css
/* Automatically handles iOS notch and home bar */
padding-top: env(safe-area-inset-top);
padding-bottom: env(safe-area-inset-bottom);
```

#### 2. **Color Variables**
```css
--customer-primary: #6B0E9B;
--customer-primary-dark: #5A0C82;
--customer-primary-light: #7C1BAB;
--customer-bg-white: #ffffff;
--customer-text-dark: #1f2937;
/* ... and more */
```

#### 3. **Button Styles**
```css
.customer-btn-primary
.view-cart-btn
.checkout-btn
.quantity-btn.plus
/* All use consistent purple gradient */
```

#### 4. **Card Styles**
```css
.product-card
.cart-item-card
.customer-card
/* Consistent shadow and hover effects */
```

#### 5. **Layout Components**
```css
.customer-header (global default)
.customer-main (content area)
.floating-cart-button
.fixed-bottom-button
```

---

## 🏠 Home Page Exception

The **Home page** has a **custom header design** that differs from the global header:

### CustomerHome.css Features:
- ✅ Purple luxury gradient header
- ✅ QR code & seat information display
- ✅ Theater name centered
- ✅ Search bar with mic
- ✅ Category chips with images
- ✅ Custom floating cart button (transparent background)

### Global styles still apply:
- Color variables
- Button gradients
- Quantity buttons
- Card styles
- Safe area support

---

## 🆕 Creating a New Customer Page

### Step 1: Create Component
```jsx
// CustomerProfile.js
import React from 'react';
import '../../styles/customer/CustomerProfile.css';

function CustomerProfile() {
  return (
    <div className="customer-profile">
      <header className="customer-header">
        <h1>Profile</h1>
      </header>
      
      <main className="customer-main">
        {/* Your content */}
      </main>
      
      <div className="fixed-bottom-button">
        <button className="customer-btn-primary">Save Changes</button>
      </div>
    </div>
  );
}
```

### Step 2: Create Minimal CSS (Optional)
```css
/* CustomerProfile.css */
/* USES GLOBAL STYLES from customer-global.css */

/* Only add page-specific overrides here */
.profile-avatar {
  width: 100px;
  height: 100px;
  border-radius: 50%;
}
```

### Step 3: Done! 🎉
Global styles automatically apply:
- Safe area support ✅
- Header styling ✅
- Button styling ✅
- Colors & shadows ✅
- Responsive design ✅

---

## 🎯 Common Patterns

### Pattern 1: Standard Page with Header
```jsx
<div className="customer-orders">
  <header className="customer-header">
    <h1>My Orders</h1>
  </header>
  <main className="customer-main">
    {/* Content automatically has proper spacing */}
  </main>
</div>
```

### Pattern 2: Page with Fixed Bottom Button
```jsx
<div className="customer-settings">
  <header className="customer-header">...</header>
  <main className="customer-main">...</main>
  
  <div className="fixed-bottom-button">
    <button className="customer-btn-primary">Save</button>
  </div>
</div>
```

### Pattern 3: Page with Floating Cart Button
```jsx
<div className="customer-menu">
  <header className="customer-header">...</header>
  <main className="customer-main">
    {/* Products */}
  </main>
  
  {cart.items.length > 0 && (
    <div className="floating-cart-button">
      <button className="view-cart-btn">View Cart</button>
    </div>
  )}
</div>
```

---

## 🎨 Using Global Utilities

### Layout
```jsx
<div className="customer-container">
  <div className="customer-section">
    {/* Content */}
  </div>
  <div className="customer-divider" />
</div>
```

### Text Alignment
```jsx
<p className="text-left">Left aligned</p>
<h2 className="text-center">Centered</h2>
<span className="text-right">Right aligned</span>
```

### Spacing
```jsx
<div className="mt-20 mb-10">
  {/* 20px margin top, 10px margin bottom */}
</div>
```

---

## 🔧 Customization

### Override Global Styles
If you need to customize for a specific page:

```css
/* CustomerSpecial.css */

/* Override global header for this page only */
.customer-special .customer-header {
  background: linear-gradient(135deg, #FF6B6B, #4ECDC4);
  /* Your custom styles */
}

/* Override global button for this page only */
.customer-special .customer-btn-primary {
  background: red;
}
```

### Use Global Variables
```css
.custom-element {
  color: var(--customer-primary);
  box-shadow: var(--customer-shadow-md);
  background: var(--customer-bg-light);
}
```

---

## 📱 iOS Safe Area Support

### Automatic Support
All customer pages automatically handle iOS safe areas:
- Top notch area
- Bottom home gesture bar
- No white gaps

### Manual Override (if needed)
```css
.special-element {
  padding-top: calc(20px + env(safe-area-inset-top));
  padding-bottom: calc(20px + env(safe-area-inset-bottom));
}
```

---

## 🐛 Troubleshooting

### Problem: Styles not applying
**Solution:** Ensure your component has the correct class:
```jsx
<div className="customer-mypage"> {/* Must start with "customer-" */}
```

### Problem: Bottom button hidden on iOS
**Solution:** Use the global class:
```jsx
<div className="fixed-bottom-button"> {/* Auto handles safe area */}
```

### Problem: Header overlapping content
**Solution:** Use global `.customer-main` class:
```jsx
<main className="customer-main"> {/* Auto adds proper padding */}
```

### Problem: Want different header style
**Solution:** Override in your page-specific CSS:
```css
.customer-mypage .customer-header {
  /* Your custom header styles */
}
```

---

## ✅ Checklist for New Pages

- [ ] Component has `customer-` prefix class
- [ ] Uses `.customer-header` for header
- [ ] Uses `.customer-main` for content
- [ ] Uses `.fixed-bottom-button` or `.floating-cart-button` for bottom elements
- [ ] Uses `.customer-btn-primary` for primary buttons
- [ ] Uses `.quantity-btn.plus` for quantity buttons
- [ ] Page-specific CSS imports global styles comment
- [ ] Tested on iOS for safe area gaps
- [ ] Tested on Android for compatibility
- [ ] Tested responsive design

---

## 📚 Reference

### Global Classes Available:
```css
/* Layout */
.customer-header
.customer-main
.customer-container
.customer-section
.customer-divider

/* Buttons */
.customer-btn-primary
.view-cart-btn
.checkout-btn
.order-button
.quantity-btn.plus
.quantity-btn.minus

/* Cards */
.product-card
.cart-item-card
.customer-card

/* Bottom Elements */
.floating-cart-button
.fixed-bottom-button
.customer-bottom-nav

/* Loading */
.customer-loading
.customer-spinner

/* Utilities */
.text-left, .text-center, .text-right
.mt-10, .mt-20, .mb-10, .mb-20
.p-10, .p-20
```

### Global CSS Variables:
```css
--customer-primary
--customer-primary-dark
--customer-primary-light
--customer-bg-white
--customer-bg-light
--customer-text-dark
--customer-text-medium
--customer-border
--customer-shadow-sm
--customer-shadow-md
--customer-shadow-lg
--customer-shadow-primary
--customer-gradient-primary
--customer-gradient-primary-hover
```

---

## 🎉 Benefits

1. **Consistency** - All pages look and feel the same
2. **Fast Development** - New pages need minimal CSS
3. **iOS Compatible** - No white gaps on iPhone
4. **Maintainable** - Change colors once, applies everywhere
5. **Responsive** - Works on all screen sizes
6. **Accessible** - Proper contrast and spacing

---

## 📝 Notes

- Home page has unique header (preserved intentionally)
- Landing page has dark purple theme (different from other pages)
- All other pages share white theme
- Global styles loaded before page-specific styles
- Safe area support works on iOS 11+

---

**Last Updated:** 2025-10-16  
**Maintained By:** Development Team  
**Questions?** Check `customer-global.css` for implementation details
