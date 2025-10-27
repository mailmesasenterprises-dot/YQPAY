import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import PerformanceProvider from './components/PerformanceProvider';
import { SettingsProvider } from './contexts/SettingsContext';
import { ModalProvider } from './contexts/ModalContext';
import { AuthProvider } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import RoleBasedRoute from './components/RoleBasedRoute';
import config from './config';
import './styles/App.css';
import './styles/action-buttons.css';

// Lazy load components for better performance
const HomePage = React.lazy(() => import('./home/pages/HomePage'));
const LoginPage = React.lazy(() => import('./pages/LoginPage'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Settings = React.lazy(() => import('./pages/Settings'));
const ModalDemo = React.lazy(() => import('./pages/ModalDemo'));
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
const CustomerCheckout = React.lazy(() => import('./pages/customer/CustomerCheckout'));
const CustomerPhoneEntry = React.lazy(() => import('./pages/customer/CustomerPhoneEntry'));
const CustomerOTPVerification = React.lazy(() => import('./pages/customer/CustomerOTPVerification'));
const CustomerPayment = React.lazy(() => import('./pages/customer/CustomerPayment'));
const CustomerOrderSuccess = React.lazy(() => import('./pages/customer/CustomerOrderSuccess'));
const RoleCreate = React.lazy(() => import('./pages/RoleCreate'));
const RoleManagementList = React.lazy(() => import('./pages/RoleManagementList'));
const QRCodeNameManagement = React.lazy(() => import('./pages/QRCodeNameManagement'));
const QRCodeNameList = React.lazy(() => import('./pages/QRCodeNameList'));
const RoleAccessManagement = React.lazy(() => import('./pages/RoleAccessManagement'));
const RoleAccessManagementList = React.lazy(() => import('./pages/RoleAccessManagementList'));
const PageAccessManagement = React.lazy(() => import('./pages/PageAccessManagement'));
const PageAccessManagementList = React.lazy(() => import('./pages/PageAccessManagementList'));

// Theater Admin Pages
const TheaterDashboard = React.lazy(() => import('./pages/theater/TheaterDashboard'));
const TheaterSettings = React.lazy(() => import('./pages/theater/TheaterSettings'));
const TheaterAdminList = React.lazy(() => import('./pages/TheaterAdminList'));
const TheaterAdminManagement = React.lazy(() => import('./pages/TheaterAdminManagement'));
const TheaterCategories = React.lazy(() => import('./pages/theater/TheaterCategories'));
const TheaterKioskTypes = React.lazy(() => import('./pages/theater/TheaterKioskTypes'));
const TheaterProductTypes = React.lazy(() => import('./pages/theater/TheaterProductTypes'));
const TheaterOrderHistory = React.lazy(() => import('./pages/theater/TheaterOrderHistory'));
// const StaffOrderHistory = React.lazy(() => import('./pages/theater/StaffOrderHistory')); // ❌ File doesn't exist
const TheaterProductList = React.lazy(() => import('./pages/theater/TheaterProductList'));
const TheaterReports = React.lazy(() => import('./pages/theater/TheaterReports')); // ✅ NEW
const TheaterRoles = React.lazy(() => import('./pages/theater/TheaterRoles')); // ✅ Theater Roles Management
const TheaterRoleAccess = React.lazy(() => import('./pages/theater/TheaterRoleAccess')); // ✅ Theater Role Access Management
const TheaterQRCodeNames = React.lazy(() => import('./pages/theater/TheaterQRCodeNames')); // ✅ Theater QR Code Names
const TheaterGenerateQR = React.lazy(() => import('./pages/theater/TheaterGenerateQR')); // ✅ Theater Generate QR
const TheaterQRManagement = React.lazy(() => import('./pages/theater/TheaterQRManagement')); // ✅ Theater QR Management
const TheaterUserManagementPage = React.lazy(() => import('./pages/theater/TheaterUserManagement')); // ✅ Theater User Management

const StockManagement = React.lazy(() => import('./pages/theater/StockManagement'));
const TestStockManagement = React.lazy(() => import('./pages/theater/TestStockManagement'));
const SimpleProductList = React.lazy(() => import('./pages/theater/SimpleProductList'));
const TheaterOrderInterface = React.lazy(() => import('./pages/theater/TheaterOrderInterface'));
const OnlinePOSInterface = React.lazy(() => import('./pages/theater/OnlinePOSInterface'));
const ViewCart = React.lazy(() => import('./pages/theater/ViewCart'));
const ProfessionalPOSInterface = React.lazy(() => import('./pages/theater/ProfessionalPOSInterface'));
const AddProduct = React.lazy(() => import('./pages/theater/AddProduct'));
const TestAddProductDropdowns = React.lazy(() => import('./components/TestAddProductDropdowns'));
const AuthDebugPage = React.lazy(() => import('./pages/AuthDebugPage'));
// const AuthTokenTest = React.lazy(() => import('./pages/AuthTokenTest')); // File not found
// const StockDataTest = React.lazy(() => import('./pages/StockDataTest')); // Unused
// const DirectStockTest = React.lazy(() => import('./pages/DirectStockTest')); // File not found
// const AddCategory = React.lazy(() => import('./pages/theater/AddCategory'));
// const EditCategory = React.lazy(() => import('./pages/theater/EditCategory'));
// const TheaterProducts = React.lazy(() => import('./pages/theater/TheaterProducts'));
// const EditProduct = React.lazy(() => import('./pages/theater/EditProduct'));


// Global loading component
const PageLoader = () => (
  <div className="page-loader">
    <div className="loader-container">
      <div className="loader-spinner"></div>
      <p>Loading {config.app.name}...</p>
    </div>
  </div>
);

function App() {
  return (
    <PerformanceProvider>
      <SettingsProvider>
        <ModalProvider>
          <CartProvider>
            <Router>
              <AuthProvider>
                <div className="App">
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
                <Route path="/customer/checkout" element={<CustomerCheckout />} />
                <Route path="/customer/phone-entry" element={<CustomerPhoneEntry />} />
                <Route path="/customer/otp-verification" element={<CustomerOTPVerification />} />
                <Route path="/customer/payment" element={<CustomerPayment />} />
                <Route path="/customer/order-success" element={<CustomerOrderSuccess />} />
                <Route path="/customer/:theaterId/:qrName/:seat/order-confirmation" element={<CustomerOrderHistory />} />
                
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
                <Route path="/qr-names" element={<RoleBasedRoute allowedRoles={['super_admin']}><QRCodeNameList /></RoleBasedRoute>} />
                <Route path="/qr-names/:theaterId" element={<RoleBasedRoute allowedRoles={['super_admin']}><QRCodeNameManagement /></RoleBasedRoute>} />
                <Route path="/role-access" element={<RoleBasedRoute allowedRoles={['super_admin']}><RoleAccessManagementList /></RoleBasedRoute>} />
                <Route path="/role-access/:theaterId" element={<RoleBasedRoute allowedRoles={['super_admin']}><RoleAccessManagement /></RoleBasedRoute>} />
                <Route path="/page-access" element={<RoleBasedRoute allowedRoles={['super_admin']}><PageAccessManagementList /></RoleBasedRoute>} />
                <Route path="/page-access/:theaterId" element={<RoleBasedRoute allowedRoles={['super_admin']}><PageAccessManagement /></RoleBasedRoute>} />
                <Route path="/qr-generate" element={<RoleBasedRoute allowedRoles={['super_admin']}><QRGenerate /></RoleBasedRoute>} />

                <Route path="/qr-management" element={<RoleBasedRoute allowedRoles={['super_admin']}><QRManagement /></RoleBasedRoute>} />
                <Route path="/qr-theater/:theaterId" element={<RoleBasedRoute allowedRoles={['super_admin']}><TheaterQRDetail /></RoleBasedRoute>} />
                <Route path="/qr-scanner" element={<RoleBasedRoute allowedRoles={['super_admin']}><QRScanner /></RoleBasedRoute>} />
                <Route path="/modal-demo" element={<RoleBasedRoute allowedRoles={['super_admin']}><ModalDemo /></RoleBasedRoute>} />
                <Route path="/theater-admin" element={<RoleBasedRoute allowedRoles={['super_admin']}><TheaterAdminList /></RoleBasedRoute>} />
                <Route path="/theater-admin-management" element={<RoleBasedRoute allowedRoles={['super_admin']}><TheaterAdminManagement /></RoleBasedRoute>} />
                
                {/* Theater User Routes - Role-based permissions will be checked within components */}
                <Route path="/theater-dashboard/:theaterId" element={<RoleBasedRoute allowedRoles={['theater_user', 'theater_admin', 'super_admin']}><TheaterDashboard /></RoleBasedRoute>} />
                <Route path="/theater-settings/:theaterId" element={<RoleBasedRoute allowedRoles={['theater_user', 'theater_admin', 'super_admin']}><TheaterSettings /></RoleBasedRoute>} />
                <Route path="/theater-categories/:theaterId" element={<RoleBasedRoute allowedRoles={['theater_user', 'theater_admin', 'super_admin']}><TheaterCategories /></RoleBasedRoute>} />
                <Route path="/theater-kiosk-types/:theaterId" element={<RoleBasedRoute allowedRoles={['theater_user', 'theater_admin', 'super_admin']}><TheaterKioskTypes /></RoleBasedRoute>} />
                <Route path="/theater-product-types/:theaterId" element={<RoleBasedRoute allowedRoles={['theater_user', 'theater_admin', 'super_admin']}><TheaterProductTypes /></RoleBasedRoute>} />
                <Route path="/theater-order-history/:theaterId" element={<RoleBasedRoute allowedRoles={['theater_user', 'theater_admin', 'super_admin']}><TheaterOrderHistory /></RoleBasedRoute>} />
                <Route path="/theater-reports/:theaterId" element={<RoleBasedRoute allowedRoles={['theater_user', 'theater_admin', 'super_admin']}><TheaterReports /></RoleBasedRoute>} /> {/* ✅ NEW */}
                <Route path="/theater-roles/:theaterId" element={<RoleBasedRoute allowedRoles={['theater_user', 'theater_admin', 'super_admin']}><TheaterRoles /></RoleBasedRoute>} /> {/* ✅ Theater Roles */}
                <Route path="/theater-role-access/:theaterId" element={<RoleBasedRoute allowedRoles={['theater_user', 'theater_admin', 'super_admin']}><TheaterRoleAccess /></RoleBasedRoute>} /> {/* ✅ Theater Role Access */}
                <Route path="/theater-qr-code-names/:theaterId" element={<RoleBasedRoute allowedRoles={['theater_user', 'theater_admin', 'super_admin']}><TheaterQRCodeNames /></RoleBasedRoute>} /> {/* ✅ Theater QR Code Names */}
                <Route path="/theater-generate-qr/:theaterId" element={<RoleBasedRoute allowedRoles={['theater_user', 'theater_admin', 'super_admin']}><TheaterGenerateQR /></RoleBasedRoute>} /> {/* ✅ Theater Generate QR */}
                <Route path="/theater-qr-management/:theaterId" element={<RoleBasedRoute allowedRoles={['theater_user', 'theater_admin', 'super_admin']}><TheaterQRManagement /></RoleBasedRoute>} /> {/* ✅ Theater QR Management */}
                <Route path="/theater-user-management/:theaterId" element={<RoleBasedRoute allowedRoles={['theater_user', 'theater_admin', 'super_admin']}><TheaterUserManagementPage /></RoleBasedRoute>} /> {/* ✅ Theater User Management */}
                {/* <Route path="/staff-order-history/:theaterId" element={<RoleBasedRoute allowedRoles={['theater_user', 'theater_admin', 'super_admin']}><StaffOrderHistory /></RoleBasedRoute>} /> */} {/* ❌ Component doesn't exist */}
                <Route path="/theater-products/:theaterId" element={<RoleBasedRoute allowedRoles={['theater_user', 'theater_admin', 'super_admin']}><TheaterProductList /></RoleBasedRoute>} />
                <Route path="/theater-stock-management/:theaterId/:productId" element={<RoleBasedRoute allowedRoles={['theater_user', 'theater_admin', 'super_admin']}><StockManagement /></RoleBasedRoute>} />
                <Route path="/test-stock-management/:theaterId/:productId" element={<TestStockManagement />} />
                <Route path="/simple-products/:theaterId" element={<RoleBasedRoute allowedRoles={['theater_user', 'theater_admin', 'super_admin']}><SimpleProductList /></RoleBasedRoute>} />
                <Route path="/theater-order/:theaterId" element={<RoleBasedRoute allowedRoles={['theater_user', 'theater_admin', 'super_admin']}><TheaterOrderInterface /></RoleBasedRoute>} />
                <Route path="/online-pos/:theaterId" element={<RoleBasedRoute allowedRoles={['theater_user', 'theater_admin', 'super_admin']}><OnlinePOSInterface /></RoleBasedRoute>} />
                <Route path="/view-cart/:theaterId" element={<RoleBasedRoute allowedRoles={['theater_user', 'theater_admin', 'super_admin']}><ViewCart /></RoleBasedRoute>} />
                <Route path="/theater-order-pos/:theaterId" element={<RoleBasedRoute allowedRoles={['theater_user', 'theater_admin', 'super_admin']}><ProfessionalPOSInterface /></RoleBasedRoute>} />
                <Route path="/theater-add-product/:theaterId" element={<RoleBasedRoute allowedRoles={['theater_user', 'theater_admin', 'super_admin']}><AddProduct /></RoleBasedRoute>} />
                <Route path="/test-add-product-dropdowns/:theaterId" element={<TestAddProductDropdowns />} />
                <Route path="/test-add-product-dropdowns" element={<TestAddProductDropdowns />} />
                <Route path="/auth-debug" element={<AuthDebugPage />} />
          
              </Routes>
              </Suspense>
              </div>
            </AuthProvider>
          </Router>
        </CartProvider>
      </ModalProvider>
    </SettingsProvider>
  </PerformanceProvider>
  );
}

export default App;
