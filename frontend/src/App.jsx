import React, { Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import PerformanceProvider from './components/PerformanceProvider';
import { SettingsProvider } from './contexts/SettingsContext';
import { ModalProvider } from './contexts/ModalContext';
import { AuthProvider } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import { ToastProvider } from './contexts/ToastContext';
import RoleBasedRoute from './components/RoleBasedRoute';
import CachePerformanceMonitor from './components/CachePerformanceMonitor'; // 📊 Global cache performance monitor
import './utils/withCaching'; // 🚀 AUTO-CACHING: Enables automatic caching for ALL fetch calls
import './utils/prefetch'; // 🚀 INSTANT NAVIGATION: Prefetch on route hover
import { showPerformanceReport } from './utils/withCaching';
import { clearOldImageCache, getImageCacheStats } from './utils/globalImageCache'; // 🖼️ Global image caching
import config from './config';
import './styles/App.css';
import './styles/action-buttons.css';

// Lazy load components for better performance
const HomePage = React.lazy(() => import('./home/pages/HomePage'));
const LoginPage = React.lazy(() => import('./pages/auth/LoginPage'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Settings = React.lazy(() => import('./pages/Settings'));
const ModalDemo = React.lazy(() => import('./pages/demo/ModalDemo'));
const AddTheater = React.lazy(() => import('./pages/AddTheater'));
const TheaterList = React.lazy(() => import('./pages/TheaterList'));
const TheaterUserManagement = React.lazy(() => import('./pages/TheaterUserManagement'));
const TheaterUserDetails = React.lazy(() => import('./pages/TheaterUserDetails'));
const TheaterUsersArray = React.lazy(() => import('./components/TheaterUsersArray'));
const QRGenerate = React.lazy(() => import('./pages/QRGenerate'));

const QRManagement = React.lazy(() => import('./pages/QRManagement'));
const TheaterQRDetail = React.lazy(() => import('./pages/TheaterQRDetail'));
const QRScanner = React.lazy(() => import('./pages/QRScanner'));
const CustomerLanding = React.lazy(() => import('./pages/customer/CustomerLanding'));
const CustomerHome = React.lazy(() => import('./pages/customer/CustomerHome'));
const CustomerCart = React.lazy(() => import('./pages/customer/CustomerCart'));
const CustomerOrderHistory = React.lazy(() => import('./pages/customer/CustomerOrderHistory'));
const CustomerOrderDetails = React.lazy(() => import('./pages/customer/CustomerOrderDetails'));
const CustomerFavorites = React.lazy(() => import('./pages/customer/CustomerFavorites'));
const CustomerHelpSupport = React.lazy(() => import('./pages/customer/CustomerHelpSupport'));
const CustomerCheckout = React.lazy(() => import('./pages/customer/CustomerCheckout'));
const CustomerPhoneEntry = React.lazy(() => import('./pages/customer/CustomerPhoneEntry'));
const CustomerOTPVerification = React.lazy(() => import('./pages/customer/CustomerOTPVerification'));
const CustomerPayment = React.lazy(() => import('./pages/customer/CustomerPayment'));
const CustomerOrderSuccess = React.lazy(() => import('./pages/customer/CustomerOrderSuccess'));
const QRServiceUnavailable = React.lazy(() => import('./pages/customer/QRServiceUnavailable'));
const RoleCreate = React.lazy(() => import('./pages/RoleCreate'));
const RoleManagementList = React.lazy(() => import('./pages/RoleManagementList'));
const QRCodeNameManagement = React.lazy(() => import('./pages/QRCodeNameManagement'));
const QRCodeNameList = React.lazy(() => import('./pages/QRCodeNameList'));
const RoleAccessManagement = React.lazy(() => import('./pages/RoleAccessManagement'));
const RoleAccessManagementList = React.lazy(() => import('./pages/RoleAccessManagementList'));
const PageAccessManagement = React.lazy(() => import('./pages/PageAccessManagement'));
const PageAccessManagementList = React.lazy(() => import('./pages/PageAccessManagementList'));
const Messages = React.lazy(() => import('./pages/Messages'));
const RoleNameManagementList = React.lazy(() => import('./pages/RoleNameManagementList'));
const RoleNameManagement = React.lazy(() => import('./pages/RoleNameManagement'));
const TransactionList = React.lazy(() => import('./pages/TransactionList'));
const TransactionDetail = React.lazy(() => import('./pages/TransactionDetail'));

// Theater Admin Pages
const TheaterDashboard = React.lazy(() => import('./pages/theater/TheaterDashboard'));
const TheaterSettings = React.lazy(() => import('./pages/theater/TheaterSettings'));
const TheaterMessages = React.lazy(() => import('./pages/theater/TheaterMessages'));
const TheaterAdminList = React.lazy(() => import('./pages/TheaterAdminList'));
const TheaterAdminManagement = React.lazy(() => import('./pages/TheaterAdminManagement'));
const TheaterCategories = React.lazy(() => import('./pages/theater/TheaterCategories'));
const TheaterKioskTypes = React.lazy(() => import('./pages/theater/TheaterKioskTypes'));
const TheaterProductTypes = React.lazy(() => import('./pages/theater/TheaterProductTypes'));
const TheaterOrderHistory = React.lazy(() => import('./pages/theater/TheaterOrderHistory'));
// const StaffOrderHistory = React.lazy(() => import('./pages/theater/StaffOrderHistory')); // ❌ File doesn't exist
const TheaterProductList = React.lazy(() => import('./pages/theater/TheaterProductList'));
const TheaterRoles = React.lazy(() => import('./pages/theater/TheaterRoles')); // ✅ Theater Roles Management
const TheaterRoleAccess = React.lazy(() => import('./pages/theater/TheaterRoleAccess')); // ✅ Theater Role Access Management
const TheaterQRCodeNames = React.lazy(() => import('./pages/theater/TheaterQRCodeNames')); // ✅ Theater QR Code Names
const TheaterGenerateQR = React.lazy(() => import('./pages/theater/TheaterGenerateQR')); // ✅ Theater Generate QR
const TheaterQRManagement = React.lazy(() => import('./pages/theater/TheaterQRManagement')); // ✅ Theater QR Management
const TheaterUserManagementPage = React.lazy(() => import('./pages/theater/TheaterUserManagement')); // ✅ Theater User Management
const TheaterBanner = React.lazy(() => import('./pages/theater/TheaterBanner')); // ✅ Theater Banner Management
const PaymentGatewayList = React.lazy(() => import('./pages/admin/PaymentGatewayList')); // ✅ Payment Gateway List
const TheaterPaymentGatewaySettings = React.lazy(() => import('./pages/admin/TheaterPaymentGatewaySettings')); // ✅ Theater Payment Gateway Settings
const CachingDemo = React.lazy(() => import('./pages/demo/CachingDemo')); // 🚀 Caching Performance Demo

const StockManagement = React.lazy(() => import('./pages/theater/StockManagement'));
const SimpleProductList = React.lazy(() => import('./pages/theater/SimpleProductList'));
const OnlinePOSInterface = React.lazy(() => import('./pages/theater/OnlinePOSInterface'));
const OfflinePOSInterface = React.lazy(() => import('./pages/theater/OfflinePOSInterface')); // 📶 Offline POS
const ViewCart = React.lazy(() => import('./pages/theater/ViewCart'));
const ProfessionalPOSInterface = React.lazy(() => import('./pages/theater/ProfessionalPOSInterface'));
const OnlineOrderHistory = React.lazy(() => import('./pages/theater/OnlineOrderHistory'));
const KioskOrderHistory = React.lazy(() => import('./pages/theater/KioskOrderHistory'));
const AddProduct = React.lazy(() => import('./pages/theater/AddProduct'));
const TestAddProductDropdowns = React.lazy(() => import('./components/TestAddProductDropdowns'));
const AuthDebugPage = React.lazy(() => import('./pages/auth/AuthDebugPage'));

// Kiosk Pages
const KioskCheckout = React.lazy(() => import('./pages/theater/KioskCheckout'));
const KioskPayment = React.lazy(() => import('./pages/theater/KioskPayment'));
const KioskViewCart = React.lazy(() => import('./pages/theater/KioskViewCart'));


// 🚀 INSTANT: No loader - show content immediately
const PageLoader = () => null; // Instant navigation - no loading screen

function App() {
  useEffect(() => {
    // Make performance report available globally for easy access in console
    window.showCacheStats = showPerformanceReport;
    window.getImageCacheStats = getImageCacheStats; // Image cache stats
    
    // Clear old cached images on app start (no-op now, cache persists 24 hours)
    clearOldImageCache();
    
    console.log('🚀 YQPAY Global Auto-Caching is ACTIVE!');
    console.log('🖼️  Global Image Caching: UNIFIED with Offline POS (24-hour cache)');
    console.log('⚡ Images load INSTANTLY from base64 cache (same as Offline POS)');
    console.log('📊 Cache Performance Monitor: Bottom-right corner (minimized by default)');
    console.log('⌨️  Keyboard Shortcut: Ctrl+Shift+P to toggle cache monitor');
    console.log('💡 Type window.showCacheStats() to see API cache stats');
    console.log('🎨 Type window.getImageCacheStats() to see image cache stats');
  }, []);

  return (
    <PerformanceProvider>
      <SettingsProvider>
        <ModalProvider>
          <ToastProvider>
            <CartProvider>
              <Router future={{ v7_relativeSplatPath: true }}>
                <AuthProvider>
                  <div className="App">
                    {/* 🚀 Global Cache Performance Monitor - Visible on ALL pages */}
                    <CachePerformanceMonitor position="bottom-right" minimized={true} />
                    
                    <Suspense fallback={<PageLoader />}>
                    <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/login" element={<LoginPage />} />
                
                {/* Customer Routes - Public Access */}
                <Route path="/customer" element={<CustomerLanding />} />
                <Route path="/customer/home" element={<CustomerHome />} />
                <Route path="/customer/cart" element={<CustomerCart />} />
                <Route path="/customer/order" element={<CustomerHome />} />
                <Route path="/customer/history" element={<CustomerOrderHistory />} />
                <Route path="/customer/order-history" element={<CustomerOrderHistory />} />
                <Route path="/customer/order-details/:orderId" element={<CustomerOrderDetails />} />
                <Route path="/customer/favorites" element={<CustomerFavorites />} />
                <Route path="/customer/help-support" element={<CustomerHelpSupport />} />
                <Route path="/customer/checkout" element={<CustomerCheckout />} />
                <Route path="/customer/phone-entry" element={<CustomerPhoneEntry />} />
                <Route path="/customer/otp-verification" element={<CustomerOTPVerification />} />
                <Route path="/customer/payment" element={<CustomerPayment />} />
                <Route path="/customer/order-success" element={<CustomerOrderSuccess />} />
                <Route path="/customer/:theaterId/:qrName/:seat/order-confirmation" element={<CustomerOrderHistory />} />
                
                {/* Caching Performance Demo */}
                <Route path="/caching-demo" element={<CachingDemo />} />
                <Route path="/qr-unavailable" element={<QRServiceUnavailable />} />
                
                {/* QR Code Redirect Route - Redirects scanned QR codes to customer landing */}
                <Route path="/menu/:theaterId" element={<CustomerLanding />} />
                
                {/* Super Admin Only Routes */}
                <Route path="/dashboard" element={<RoleBasedRoute allowedRoles={['super_admin']}><Dashboard /></RoleBasedRoute>} />
                <Route path="/settings" element={<RoleBasedRoute allowedRoles={['super_admin']}><Settings /></RoleBasedRoute>} />
                <Route path="/add-theater" element={<RoleBasedRoute allowedRoles={['super_admin']}><AddTheater /></RoleBasedRoute>} />
                <Route path="/theaters" element={<RoleBasedRoute allowedRoles={['super_admin']}><TheaterList /></RoleBasedRoute>} />
                <Route path="/theater-users" element={<RoleBasedRoute allowedRoles={['super_admin']}><TheaterUserManagement /></RoleBasedRoute>} />
                <Route path="/theater-users-array" element={<RoleBasedRoute allowedRoles={['super_admin']}><TheaterUsersArray /></RoleBasedRoute>} />
                <Route path="/theater-users/:theaterId" element={<RoleBasedRoute allowedRoles={['super_admin']}><TheaterUserDetails /></RoleBasedRoute>} />
                <Route path="/roles" element={<RoleBasedRoute allowedRoles={['super_admin']}><RoleManagementList /></RoleBasedRoute>} />
                <Route path="/roles/:theaterId" element={<RoleBasedRoute allowedRoles={['super_admin']}><RoleCreate /></RoleBasedRoute>} />
                <Route path="/email-notification" element={<RoleBasedRoute allowedRoles={['super_admin']}><RoleNameManagementList /></RoleBasedRoute>} />
                <Route path="/email-notification/:theaterId" element={<RoleBasedRoute allowedRoles={['super_admin']}><RoleNameManagement /></RoleBasedRoute>} />
                <Route path="/transactions" element={<RoleBasedRoute allowedRoles={['super_admin']}><TransactionList /></RoleBasedRoute>} />
                <Route path="/transactions/:theaterId" element={<RoleBasedRoute allowedRoles={['super_admin']}><TransactionDetail /></RoleBasedRoute>} />
                <Route path="/qr-names" element={<RoleBasedRoute allowedRoles={['super_admin']}><QRCodeNameList /></RoleBasedRoute>} />
                <Route path="/qr-names/:theaterId" element={<RoleBasedRoute allowedRoles={['super_admin']}><QRCodeNameManagement /></RoleBasedRoute>} />
                <Route path="/role-access" element={<RoleBasedRoute allowedRoles={['super_admin']}><RoleAccessManagementList /></RoleBasedRoute>} />
                <Route path="/role-access/:theaterId" element={<RoleBasedRoute allowedRoles={['super_admin']}><RoleAccessManagement /></RoleBasedRoute>} />
                <Route path="/page-access" element={<RoleBasedRoute allowedRoles={['super_admin']}><PageAccessManagementList /></RoleBasedRoute>} />
                <Route path="/page-access/:theaterId" element={<RoleBasedRoute allowedRoles={['super_admin']}><PageAccessManagement /></RoleBasedRoute>} />
                <Route path="/messages" element={<RoleBasedRoute allowedRoles={['super_admin']}><Messages /></RoleBasedRoute>} />
                <Route path="/payment-gateway-list" element={<RoleBasedRoute allowedRoles={['super_admin']}><PaymentGatewayList /></RoleBasedRoute>} />
                <Route path="/payment-gateway-settings/:theaterId" element={<RoleBasedRoute allowedRoles={['super_admin']}><TheaterPaymentGatewaySettings /></RoleBasedRoute>} />
                <Route path="/qr-generate" element={<RoleBasedRoute allowedRoles={['super_admin']}><QRGenerate /></RoleBasedRoute>} />

                <Route path="/qr-management" element={<RoleBasedRoute allowedRoles={['super_admin']}><QRManagement /></RoleBasedRoute>} />
                <Route path="/qr-theater/:theaterId" element={<RoleBasedRoute allowedRoles={['super_admin']}><TheaterQRDetail /></RoleBasedRoute>} />
                <Route path="/qr-scanner" element={<RoleBasedRoute allowedRoles={['super_admin']}><QRScanner /></RoleBasedRoute>} />
                <Route path="/modal-demo" element={<RoleBasedRoute allowedRoles={['super_admin']}><ModalDemo /></RoleBasedRoute>} />
                <Route path="/theater-admin" element={<RoleBasedRoute allowedRoles={['super_admin']}><TheaterAdminList /></RoleBasedRoute>} />
                <Route path="/theater-admin-management" element={<RoleBasedRoute allowedRoles={['super_admin']}><TheaterAdminManagement /></RoleBasedRoute>} />
                
                {/* Theater User Routes - WITH PROPER ROLE-BASED PAGE ACCESS CONTROL */}
                <Route path="/theater-dashboard/:theaterId" element={<RoleBasedRoute allowedRoles={['theater_user', 'theater_admin', 'super_admin']} requiredPermissions={['TheaterDashboardWithId']}><TheaterDashboard /></RoleBasedRoute>} />
                <Route path="/theater-settings/:theaterId" element={<RoleBasedRoute allowedRoles={['theater_user', 'theater_admin', 'super_admin']} requiredPermissions={['TheaterSettingsWithId']}><TheaterSettings /></RoleBasedRoute>} />
                <Route path="/theater-messages/:theaterId" element={<RoleBasedRoute allowedRoles={['theater_user', 'theater_admin', 'super_admin']} requiredPermissions={['TheaterMessages']}><TheaterMessages /></RoleBasedRoute>} />
                <Route path="/theater-categories/:theaterId" element={<RoleBasedRoute allowedRoles={['theater_user', 'theater_admin', 'super_admin']} requiredPermissions={['TheaterCategories']}><TheaterCategories /></RoleBasedRoute>} />
                <Route path="/theater-kiosk-types/:theaterId" element={<RoleBasedRoute allowedRoles={['theater_user', 'theater_admin', 'super_admin']} requiredPermissions={['TheaterKioskTypes']}><TheaterKioskTypes /></RoleBasedRoute>} />
                <Route path="/theater-product-types/:theaterId" element={<RoleBasedRoute allowedRoles={['theater_user', 'theater_admin', 'super_admin']} requiredPermissions={['TheaterProductTypes']}><TheaterProductTypes /></RoleBasedRoute>} />
                <Route path="/theater-order-history/:theaterId" element={<RoleBasedRoute allowedRoles={['theater_user', 'theater_admin', 'super_admin']} requiredPermissions={['TheaterOrderHistory']}><TheaterOrderHistory /></RoleBasedRoute>} />
                <Route path="/theater-banner/:theaterId" element={<RoleBasedRoute allowedRoles={['theater_user', 'theater_admin', 'super_admin']} requiredPermissions={['TheaterBanner']}><TheaterBanner /></RoleBasedRoute>} />
                <Route path="/theater-roles/:theaterId" element={<RoleBasedRoute allowedRoles={['theater_user', 'theater_admin', 'super_admin']} requiredPermissions={['TheaterRoles']}><TheaterRoles /></RoleBasedRoute>} />
                <Route path="/theater-role-access/:theaterId" element={<RoleBasedRoute allowedRoles={['theater_user', 'theater_admin', 'super_admin']} requiredPermissions={['TheaterRoleAccess']}><TheaterRoleAccess /></RoleBasedRoute>} />
                <Route path="/theater-qr-code-names/:theaterId" element={<RoleBasedRoute allowedRoles={['theater_user', 'theater_admin', 'super_admin']} requiredPermissions={['TheaterQRCodeNames']}><TheaterQRCodeNames /></RoleBasedRoute>} />
                {/* Theater Generate QR - QR Generation Form (like /qr-generate) */}
                <Route path="/theater-generate-qr/:theaterId" element={<RoleBasedRoute allowedRoles={['theater_user', 'theater_admin', 'super_admin']} requiredPermissions={['TheaterGenerateQR']}><TheaterGenerateQR /></RoleBasedRoute>} />
                {/* Theater QR Management - QR List/Management Page (like /theater-qr-detail) */}
                <Route path="/theater-qr-management/:theaterId" element={<RoleBasedRoute allowedRoles={['theater_user', 'theater_admin', 'super_admin']} requiredPermissions={['TheaterQRManagement']}><TheaterQRManagement /></RoleBasedRoute>} />
                <Route path="/theater-user-management/:theaterId" element={<RoleBasedRoute allowedRoles={['theater_user', 'theater_admin', 'super_admin']} requiredPermissions={['TheaterUserManagement']}><TheaterUserManagementPage /></RoleBasedRoute>} />
                <Route path="/theater-products/:theaterId" element={<RoleBasedRoute allowedRoles={['theater_user', 'theater_admin', 'super_admin']} requiredPermissions={['TheaterProductList']}><TheaterProductList /></RoleBasedRoute>} />
                <Route path="/theater-stock-management/:theaterId/:productId" element={<RoleBasedRoute allowedRoles={['theater_user', 'theater_admin', 'super_admin']} ><StockManagement /></RoleBasedRoute>} />
                {/* <Route path="/test-stock-management/:theaterId/:productId" element={<TestStockManagement />} /> */}
                <Route path="/simple-products/:theaterId" element={<RoleBasedRoute allowedRoles={['theater_user', 'theater_admin', 'super_admin']} requiredPermissions={['SimpleProductList']}><SimpleProductList /></RoleBasedRoute>} />
                <Route path="/pos/:theaterId" element={<RoleBasedRoute allowedRoles={['theater_user', 'theater_admin', 'super_admin']} requiredPermissions={['OnlinePOSInterface']}><OnlinePOSInterface /></RoleBasedRoute>} />
                <Route path="/offline-pos/:theaterId" element={<RoleBasedRoute allowedRoles={['theater_user', 'theater_admin', 'super_admin']} requiredPermissions={['OfflinePOSInterface']}><OfflinePOSInterface /></RoleBasedRoute>} />
                <Route path="/online-order-history/:theaterId" element={<RoleBasedRoute allowedRoles={['theater_user', 'theater_admin', 'super_admin']}><OnlineOrderHistory /></RoleBasedRoute>} />
                <Route path="/kiosk-order-history/:theaterId" element={<RoleBasedRoute allowedRoles={['theater_user', 'theater_admin', 'super_admin']}><KioskOrderHistory /></RoleBasedRoute>} />
                <Route path="/view-cart/:theaterId" element={<RoleBasedRoute allowedRoles={['theater_user', 'theater_admin', 'super_admin']}><ViewCart /></RoleBasedRoute>} />
                <Route path="/theater-order-pos/:theaterId" element={<RoleBasedRoute allowedRoles={['theater_user', 'theater_admin', 'super_admin']} requiredPermissions={['ProfessionalPOSInterface']}><ProfessionalPOSInterface /></RoleBasedRoute>} />
                <Route path="/theater-add-product/:theaterId" element={<RoleBasedRoute allowedRoles={['theater_user', 'theater_admin', 'super_admin']}><AddProduct /></RoleBasedRoute>} />
                <Route path="/test-add-product-dropdowns/:theaterId" element={<TestAddProductDropdowns />} />
                <Route path="/test-add-product-dropdowns" element={<TestAddProductDropdowns />} />
                <Route path="/auth-debug" element={<AuthDebugPage />} />
                
                {/* Kiosk Routes */}
                <Route path="/kiosk-products/:theaterId" element={<RoleBasedRoute allowedRoles={['theater_user', 'theater_admin', 'super_admin']} requiredPermissions={['KioskProductList']}><SimpleProductList /></RoleBasedRoute>} />
                <Route path="/kiosk-cart/:theaterId" element={<RoleBasedRoute allowedRoles={['theater_user', 'theater_admin', 'super_admin']} requiredPermissions={['KioskCart']}><KioskViewCart /></RoleBasedRoute>} />
                <Route path="/kiosk-checkout/:theaterId" element={<RoleBasedRoute allowedRoles={['theater_user', 'theater_admin', 'super_admin']} requiredPermissions={['KioskCheckout']}><KioskCheckout /></RoleBasedRoute>} />
                <Route path="/kiosk-payment/:theaterId" element={<RoleBasedRoute allowedRoles={['theater_user', 'theater_admin', 'super_admin']} requiredPermissions={['KioskPayment']}><KioskPayment /></RoleBasedRoute>} />
                <Route path="/kiosk-view-cart/:theaterId" element={<RoleBasedRoute allowedRoles={['theater_user', 'theater_admin', 'super_admin']} requiredPermissions={['KioskViewCart']}><KioskViewCart /></RoleBasedRoute>} />
          
                  </Routes>
                  </Suspense>
                </div>
              </AuthProvider>
            </Router>
          </CartProvider>
        </ToastProvider>
      </ModalProvider>
    </SettingsProvider>
  </PerformanceProvider>
  );
}

export default App;