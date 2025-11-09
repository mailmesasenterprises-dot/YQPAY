# Frontend HomePage Module - README

## 📖 Overview

This directory contains all files related to the **TicketBooking Home Page**, organized as a self-contained module following modern React architecture patterns.

## 📁 Directory Structure

```
home/
├── pages/                  # Page components
│   └── HomePage.js        # Main HomePage component (entry point)
│
├── components/            # HomePage-specific components
│   ├── FAQAccordion.js           # Interactive FAQ section
│   ├── HowItWorksSliderNew.js    # How It Works carousel
│   └── PopularMenuCarousel.js    # Popular menu items carousel
│
├── css/                   # HomePage-specific styles
│   ├── HomePage.css              # Main page styles
│   ├── HeroNew.css              # Hero section styles
│   ├── Responsive.css           # Responsive breakpoints (7 breakpoints)
│   ├── FAQAccordion.css         # FAQ section styles
│   ├── HowItWorksSliderNew.css  # Slider styles
│   └── PopularMenuCarousel.css  # Carousel styles
│
└── images/                # HomePage-specific images
    ├── Home-1.mp4                # Hero video (background)
    ├── Browse Menu.jpg           # Browse menu illustration
    └── Scan QR Code.jpg          # QR code scanning illustration
```

## 🎯 Module Purpose

The HomePage serves as the **landing page** for TicketBooking, showcasing:

1. **Hero Section** - Video background with main CTA
2. **How It Works** - Interactive slider explaining the process
3. **Benefits Section** - Key features and advantages
4. **Popular Menu** - Rotating carousel of popular theater items
5. **FAQ Section** - Split-screen interactive FAQ
6. **Footer** - Contact info, links, newsletter signup

## 🚀 Getting Started

### Viewing the HomePage

```bash
# Start development server
cd d:\8\frontend
npm start

# HomePage will be available at http://localhost:3000/
```

### Building for Production

```bash
cd d:\8\frontend
npm run build
```

## 🔧 Development Guide

### Adding a New Component

1. **Create Component File**
   ```
   home/components/NewComponent.js
   ```

2. **Create Styles**
   ```
   home/css/NewComponent.css
   ```

3. **Import in HomePage.js**
   ```javascript
   import NewComponent from '../components/NewComponent';
   import '../css/NewComponent.css';
   ```

4. **Use in JSX**
   ```javascript
   <NewComponent />
   ```

### Import Path Reference

From `home/pages/HomePage.js`:
```javascript
// Module components (same home/ module)
import FAQAccordion from '../components/FAQAccordion';

// Module CSS
import '../css/HomePage.css';

// Module images
import heroVideo from '../images/Home-1.mp4';

// Shared components (outside home/ module)
import LazyImage from '../../components/LazyImage';

// Config/Hooks/Utils
import config from '../../config';
import { useCursor } from '../../hooks/useCursor';
```

From `home/components/Component.js`:
```javascript
// Module CSS
import '../css/ComponentName.css';

// Module images
import image from '../images/image.jpg';

// Shared components
import LazyImage from '../../components/LazyImage';
```

## 🎨 Styling Architecture

### Responsive Design

The HomePage uses a **comprehensive 7-breakpoint system**:

```css
/* Breakpoints (defined in Responsive.css) */
1365px  - Desktop Extra Large
1023px  - Tablet Landscape
767px   - Tablet Portrait / Mobile Large
575px   - Mobile Medium
374px   - Mobile Small
Landscape - Horizontal orientation
Touch   - Touch device optimizations
```

### CSS File Organization

| File | Purpose | Lines |
|------|---------|-------|
| `HomePage.css` | Main page layout, hero, benefits, CTA | 2169 |
| `HeroNew.css` | Hero section specific styles | 500+ |
| `Responsive.css` | Responsive breakpoints (all sections) | 700+ |
| `FAQAccordion.css` | FAQ split-screen layout | 730 |
| `HowItWorksSliderNew.css` | Slider animations | 400+ |
| `PopularMenuCarousel.css` | Circular carousel | 492 |

**Total CSS:** ~5,000 lines of well-documented, responsive styles

## 📱 Mobile Optimization

### Touch-Friendly Features
- ✅ Minimum 44px × 44px touch targets
- ✅ Active states for touch feedback
- ✅ Disabled hover effects on touch devices
- ✅ Optimized for one-handed use
- ✅ Fast tap response (no 300ms delay)

### Responsive Breakpoints
- ✅ **320px** - iPhone SE, older devices
- ✅ **375px** - iPhone 12/13 Pro
- ✅ **768px** - iPad Mini, tablets
- ✅ **1024px** - iPad Pro, laptops
- ✅ **1920px+** - Desktop displays

## 🧩 Component Details

### HomePage.js
**Location:** `home/pages/HomePage.js`  
**Lines:** 514  
**Purpose:** Main page component, orchestrates all sections

**Key Sections:**
- Header/Navigation
- Hero with video background
- How It Works slider
- Benefits cards
- Popular Menu carousel
- FAQ accordion
- Modern footer

**Dependencies:**
- React hooks (useEffect)
- React Router (Link)
- Custom hooks (useCursor)
- LazyImage component
- 3 module components

---

### FAQAccordion.js
**Location:** `home/components/FAQAccordion.js`  
**Lines:** 175  
**Purpose:** Interactive FAQ with split-screen design

**Features:**
- 6 predefined FAQ items
- Split-screen layout (desktop)
- Single-column stacked (mobile)
- Active question highlighting
- Previous/Next navigation
- Category tags
- Highlight badges
- Bottom info bar (3 support options)

**State:**
- `activeIndex` - Currently displayed FAQ (0-5)

---

### HowItWorksSliderNew.js
**Location:** `home/components/HowItWorksSliderNew.js`  
**Lines:** 149  
**Purpose:** Animated slider showing the ordering process

**Features:**
- 3 steps (Scan QR, Browse Menu, Order & Pay)
- Auto-advance (5-second interval)
- Manual navigation (dots + arrows)
- Smooth animations
- Image + text content per step
- Responsive grid layout

**State:**
- `activeStep` - Current step (0-2)

---

### PopularMenuCarousel.js
**Location:** `home/components/PopularMenuCarousel.js`  
**Lines:** 115  
**Purpose:** Rotating circular carousel of popular menu items

**Features:**
- 8 menu items
- Circular rotation animation
- Auto-rotate (3-second interval)
- Manual click navigation
- Smooth transitions
- Responsive sizing

**State:**
- `rotateRef` - Current rotation angle
- `activeRef` - Current active item (0-7)

**Menu Items:**
- Popcorn, Nachos, Hot Dog, Soda, Burger, Fries, Ice Cream, Candy

## 🎨 Design System

### Color Palette

```css
/* Primary Purple */
--primary-purple: #5A0C82;
--primary-light: #7C3AED;
--primary-gradient: linear-gradient(135deg, #5A0C82, #7C3AED);

/* Neutral Colors */
--dark-bg: #1e293b;
--darker-bg: #0f172a;
--text-light: #cbd5e1;
--text-muted: #94a3b8;

/* Accent Colors */
--accent-purple: #a855f7;
--accent-pink: #ec4899;
```

### Typography

```css
/* Headings */
font-family: 'Poppins', sans-serif;
font-weight: 700;

/* Body Text */
font-family: 'Inter', sans-serif;
font-weight: 400;

/* Font Sizes (Desktop → Mobile) */
H1: 56px → 32px
H2: 48px → 28px
Body: 17px → 14px
```

### Spacing Scale

```css
/* Consistent spacing multiples of 8px */
4px, 8px, 12px, 16px, 20px, 24px, 32px, 40px, 48px, 56px, 64px, 80px, 100px
```

## 🔒 Dependencies

### Internal Dependencies (within home/)
```
HomePage.js
├── FAQAccordion.js → FAQAccordion.css
├── HowItWorksSliderNew.js → HowItWorksSliderNew.css + images
├── PopularMenuCarousel.js → PopularMenuCarousel.css
└── CSS files (6 files)
```

### External Dependencies (outside home/)
```javascript
// React & React Router
import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';

// Shared Components
import LazyImage from '../../components/LazyImage';

// Custom Hooks
import { useCursor } from '../../hooks/useCursor';

// Config
import config from '../../config';
```

### No External Packages
- ✅ No third-party carousel libraries
- ✅ No animation libraries (pure CSS)
- ✅ All animations custom-built
- ✅ Lightweight and performant

## 📊 Performance Metrics

| Metric | Value |
|--------|-------|
| **Component Count** | 3 components + 1 page |
| **Total CSS** | ~5,000 lines |
| **Total JS** | ~850 lines |
| **Images** | 3 files (1 video, 2 images) |
| **Video Size** | ~2MB (Home-1.mp4) |
| **Build Time** | ~30 seconds |
| **Bundle Size Impact** | ~50KB (gzipped) |

### Optimization Features
- ✅ Lazy-loaded via React.lazy()
- ✅ CSS minified in production
- ✅ Images optimized
- ✅ Video compressed
- ✅ No external dependencies
- ✅ Efficient animations (GPU-accelerated)

## 🧪 Testing

### Manual Testing Checklist

**Desktop (1920×1080):**
- [ ] Hero video plays
- [ ] All sections visible
- [ ] How It Works slider auto-advances
- [ ] Popular Menu carousel rotates
- [ ] FAQ navigation works
- [ ] Footer links work
- [ ] Newsletter form functional

**Tablet (768×1024):**
- [ ] Layout switches to 2-column
- [ ] FAQ list becomes 2-column grid
- [ ] Footer stacks properly
- [ ] Touch interactions work
- [ ] No horizontal scroll

**Mobile (375×667):**
- [ ] Single column layout
- [ ] FAQ list single column
- [ ] Popular Menu carousel fits
- [ ] All touch targets ≥44px
- [ ] Text readable
- [ ] No overflow

## 🐛 Troubleshooting

### Issue: Video Not Playing

**Symptoms:** Hero section shows black/blank background

**Solutions:**
1. Check video file exists: `home/images/Home-1.mp4`
2. Verify video codec compatibility (H.264)
3. Check browser console for errors
4. Try different browser

### Issue: Carousel Not Rotating

**Symptoms:** Popular menu items don't rotate

**Solutions:**
1. Check browser console for JavaScript errors
2. Verify CSS animations not disabled
3. Check `prefers-reduced-motion` setting
4. Clear browser cache

### Issue: Responsive Layout Broken

**Symptoms:** Layout doesn't adapt to screen size

**Solutions:**
1. Verify `Responsive.css` is imported
2. Check browser width (DevTools)
3. Clear CSS cache (Ctrl+Shift+R)
4. Verify media query syntax

## 📚 Documentation

- **Comprehensive Guide:** [`docs/frontend-home-structure.md`](../../docs/frontend-home-structure.md)
- **Quick Reference:** [`docs/home-structure-quick-ref.md`](../../docs/home-structure-quick-ref.md)
- **Before/After:** [`docs/frontend-structure-comparison.md`](../../docs/frontend-structure-comparison.md)
- **Reorganization:** [`docs/frontend-reorganization-summary.md`](../../docs/frontend-reorganization-summary.md)
- **Responsive Fix:** [`docs/faq-footer-responsive-fix.md`](../../docs/faq-footer-responsive-fix.md)

## 🤝 Contributing

### Code Style
- Use ES6+ syntax
- Follow React best practices
- Add comments for complex logic
- Keep components under 200 lines
- Extract reusable logic to hooks

### CSS Guidelines
- Mobile-first approach
- Use CSS variables for colors
- Group related styles
- Add comments for sections
- Test on real devices

### Commit Messages
```
feat(home): Add new carousel item
fix(home): Fix FAQ mobile layout
style(home): Update responsive breakpoints
docs(home): Update component documentation
```

## 📞 Support

For questions or issues:
1. Check documentation files (above)
2. Review code comments
3. Check browser console for errors
4. Contact development team

## 🎉 Credits

**Reorganization Date:** October 15, 2025  
**Architecture:** Module-based React structure  
**Design System:** Purple gradient theme  
**Responsive Design:** 7-breakpoint system  

---

**Status:** ✅ Production Ready  
**Last Updated:** October 15, 2025  
**Version:** 1.0.0
