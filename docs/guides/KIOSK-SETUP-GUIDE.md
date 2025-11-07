# Kiosk Mode Setup Guide

## 🖥️ Hardware Requirements

### Recommended Kiosk Displays:
- **Landscape Mode**: 1920x1080 (Full HD) or higher
- **Portrait Mode**: 1080x1920 (Rotated Full HD)
- **Touch Screen**: Capacitive multi-touch support
- **Stand**: Floor-standing or wall-mounted kiosk enclosure

### Minimum Requirements:
- Display: 1280x720 or higher
- Touch: 10-point multi-touch
- CPU: Dual-core 2.0 GHz or better
- RAM: 4GB minimum, 8GB recommended
- Storage: 64GB SSD/eMMC

## 🚀 Software Setup

### 1. Browser Configuration

#### Chrome/Chromium (Recommended for Kiosks)
```bash
# Windows - Launch in kiosk mode
chrome.exe --kiosk --app=http://your-domain.com/online-pos/THEATER_ID --start-fullscreen --disable-pinch --overscroll-history-navigation=0

# Linux
chromium-browser --kiosk --app=http://your-domain.com/online-pos/THEATER_ID --start-fullscreen --disable-pinch

# Additional flags for kiosk hardening:
--no-first-run
--disable-translate
--disable-features=TranslateUI
--disable-session-crashed-bubble
--disable-infobars
--disable-suggestions-service
--disable-save-password-bubble
```

#### Edge Kiosk Mode
```bash
msedge.exe --kiosk --app=http://your-domain.com/online-pos/THEATER_ID --edge-kiosk-type=fullscreen
```

### 2. Windows Kiosk Setup

#### Using Windows 10/11 Kiosk Mode:
1. Settings → Accounts → Family & other users
2. Set up kiosk → Choose "Assigned Access"
3. Select user account → Choose app (Microsoft Edge or Chrome)
4. Configure kiosk to launch your app URL

#### Auto-login Configuration:
```cmd
netplwiz
# Uncheck "Users must enter username and password"
# Set kiosk user to auto-login
```

### 3. Linux Kiosk Setup (Ubuntu/Debian)

#### Install Chromium:
```bash
sudo apt update
sudo apt install chromium-browser unclutter
```

#### Auto-start Kiosk on Boot:
Create `/home/kiosk/.config/autostart/kiosk.desktop`:
```ini
[Desktop Entry]
Type=Application
Name=Kiosk
Exec=chromium-browser --kiosk --app=http://your-domain.com/online-pos/THEATER_ID
X-GNOME-Autostart-enabled=true
```

#### Hide Cursor (Optional):
```bash
unclutter -idle 0 &
```

### 4. Raspberry Pi Kiosk Setup

```bash
# Install Chromium
sudo apt install chromium-browser unclutter

# Edit autostart
nano ~/.config/lxsession/LXDE-pi/autostart

# Add these lines:
@chromium-browser --kiosk --app=http://your-domain.com/online-pos/THEATER_ID
@unclutter -idle 0
@xset s off
@xset -dpms
@xset s noblank
```

## 🎨 Kiosk Page URLs

### View Cart (Kiosk)
```
http://your-domain.com/kiosk-view-cart/THEATER_ID
```

### Checkout
```
http://your-domain.com/kiosk-checkout/THEATER_ID
```

### Payment
```
http://your-domain.com/kiosk-payment/THEATER_ID
```

### Online POS (Main Interface)
```
http://your-domain.com/online-pos/THEATER_ID
```

## ⚙️ Features Optimized for Kiosk

### ✅ Touch Optimizations:
- **56px minimum touch targets** (exceeds 48px accessibility standard)
- **Larger fonts**: 18-32px for easy reading from distance
- **Enhanced visual feedback**: Scale animations on touch
- **No hover dependencies**: Works perfectly on touch-only devices

### ✅ Display Optimizations:
- **Landscape mode support**: 1920x1080, 1280x720
- **Portrait mode support**: 1080x1920 with bottom navigation
- **High DPI displays**: Retina-optimized images
- **Fullscreen mode**: Automatic detection and optimization

### ✅ Kiosk Security:
- **Disabled text selection**: Prevents accidental copying
- **Disabled right-click menu**: Prevents access to browser controls
- **Touch-only navigation**: No keyboard dependencies
- **Auto-logout on idle**: 5-minute timeout (configurable)

### ✅ Performance:
- **React.memo**: Prevents unnecessary re-renders
- **useCallback**: Optimized event handlers
- **Lazy loading**: Images load on demand
- **LocalStorage caching**: Fast cart restoration

## 🔧 JavaScript Kiosk Helpers

### Enable Full Kiosk Mode:
```javascript
import { enableKioskMode } from './utils/kioskHelper';

// On component mount
useEffect(() => {
  enableKioskMode();
  
  return () => {
    disableKioskMode();
  };
}, []);
```

### Auto-Idle Timeout:
```javascript
import { setupIdleTimeout } from './utils/kioskHelper';

// Redirect to home after 5 minutes of inactivity
useEffect(() => {
  const cleanup = setupIdleTimeout(300000, () => {
    navigate(`/online-pos/${theaterId}`);
  });
  
  return cleanup;
}, []);
```

### Haptic Feedback:
```javascript
import { hapticFeedback } from './utils/kioskHelper';

const handleButtonClick = () => {
  hapticFeedback('medium'); // Vibrate on touch
  // ... rest of handler
};
```

## 📱 Screen Sizes Supported

| Device Type | Resolution | Orientation | Status |
|------------|------------|-------------|--------|
| Large Kiosk | 1920x1080 | Landscape | ✅ Optimized |
| Medium Kiosk | 1280x720 | Landscape | ✅ Optimized |
| Portrait Kiosk | 1080x1920 | Portrait | ✅ Optimized |
| Tablet | 1024x768 | Both | ✅ Supported |
| Mobile | 375x667+ | Portrait | ✅ Fallback |

## 🌙 Dark Mode Support

Automatically adapts to:
- System dark mode preference
- Evening/night usage in theaters
- High contrast mode for accessibility

## ♿ Accessibility

- **WCAG 2.1 AA Compliant**: Touch targets, contrast ratios
- **High Contrast Mode**: Enhanced visibility
- **Font Scaling**: Responsive to system settings
- **Screen Reader**: Semantic HTML structure

## 🔐 Security Best Practices

1. **Disable Browser DevTools**: Use kiosk flags
2. **Network Restrictions**: Firewall to allow only your domain
3. **Auto-Update**: Keep browser updated
4. **Watchdog Script**: Auto-restart on crash
5. **Remote Management**: TeamViewer/AnyDesk for support

## 📊 Performance Benchmarks

- **First Paint**: < 1.5s on typical hardware
- **Touch Response**: < 50ms
- **Smooth Animations**: 60 FPS on modern hardware
- **Memory Usage**: ~150-200 MB per tab

## 🆘 Troubleshooting

### Screen Not Fullscreen:
- Check browser kiosk flags
- Verify F11 is not blocked by OS
- Try `--start-fullscreen` flag

### Touch Not Working:
- Update touch drivers
- Calibrate touch screen in Windows
- Check USB connection for touch controller

### Performance Issues:
- Close other browser tabs
- Disable browser extensions
- Update graphics drivers
- Reduce animation complexity in settings

### App Crashes/Freezes:
- Clear browser cache
- Check network connectivity
- Review browser console for errors
- Restart kiosk device

## 📞 Support

For kiosk-specific issues, contact your system administrator or check the main application documentation.

---

**Last Updated**: October 2025  
**Version**: 1.0.0
