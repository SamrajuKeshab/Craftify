import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AdminDashboard from './admin/AdminDashboard';
import BuyerDashboard from './buyer/BuyerDashboard';
import ToastBanner from './components/common/ToastBanner';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import BecomeSellerPage from './pages/BecomeSellerPage';
import CartPage from './pages/CartPage';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import StorefrontPage from './pages/StorefrontPage';
import ProtectedRoute from './routes/ProtectedRoute';
import SellerDashboard from './seller/SellerDashboard';

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Customer Storefront & Cart */}
            <Route path="/" element={<StorefrontPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/become-seller" element={<BecomeSellerPage />} />

            {/* Strict Unified Auth Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/sign-up" element={<SignUpPage />} />

            {/* Role-Protected Dashboards */}
            <Route
              path="/buyer/dashboard"
              element={
                <ProtectedRoute allowedRoles={['BUYER', 'SELLER', 'ADMIN']}>
                  <BuyerDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/seller/dashboard"
              element={
                <ProtectedRoute allowedRoles={['SELLER', 'ADMIN']}>
                  <SellerDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <ToastBanner />
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}
