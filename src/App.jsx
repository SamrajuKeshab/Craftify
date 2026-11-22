import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AdminDashboard from './admin/AdminDashboard';
import BuyerDashboard from './buyer/BuyerDashboard';
import ToastBanner from './components/common/ToastBanner';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import BecomeSellerPage from './pages/BecomeSellerPage';
import CartPage from './pages/CartPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import LoginPage from './pages/LoginPage';
import ProductDetailPage from './pages/ProductDetailPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import SellerShopPage from './pages/SellerShopPage';
import ShopsDirectoryPage from './pages/ShopsDirectoryPage';
import SignUpPage from './pages/SignUpPage';
import StorefrontPage from './pages/StorefrontPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import ProtectedRoute from './routes/ProtectedRoute';
import SellerDashboard from './seller/SellerDashboard';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <CartProvider>
          <Routes>
            {/* Public Customer Storefront, Product Detail, Artisan Studios & Cart */}
            <Route path="/" element={<StorefrontPage />} />
            <Route path="/products/:slug" element={<ProductDetailPage />} />
            <Route path="/shops" element={<ShopsDirectoryPage />} />
            <Route path="/shops/:slug" element={<SellerShopPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/become-seller" element={<BecomeSellerPage />} />

            {/* Unified Auth, Email Verification & Password Recovery */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/sign-up" element={<SignUpPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

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
        </CartProvider>
      </BrowserRouter>
    </AuthProvider>
  );
}
