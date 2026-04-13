import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Auth from './pages/Auth';
import Home from './pages/Home';
import GamePage from './pages/GamePage';
import Wallet from './pages/Wallet';
import Referral from './pages/Referral';
import Profile from './pages/Profile';
import Withdraw from './pages/Withdraw';
import Admin from './pages/Admin';
import { Loader2 } from 'lucide-react';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, userData } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-casino-bg">
        <Loader2 className="text-casino-primary animate-spin" size={48} />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" />;
  }

  if (userData?.isBanned && user?.email !== 'mnaedina@gmail.com') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-casino-bg p-8 text-center">
        <div className="glass p-12 rounded-[40px] max-w-md">
          <h1 className="text-4xl font-black text-red-500 mb-4 italic tracking-tighter">CONTA BLOQUEADA</h1>
          <p className="text-white/60 font-medium leading-relaxed">
            Sua conta foi suspensa por violar nossos termos de uso. Entre em contato com o suporte para mais informações.
          </p>
        </div>
      </div>
    );
  }

  return <Layout>{children}</Layout>;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          
          <Route path="/" element={<Layout><Home /></Layout>} />
          <Route path="/game/:id" element={<ProtectedRoute><GamePage /></ProtectedRoute>} />
          <Route path="/wallet" element={<ProtectedRoute><Wallet /></ProtectedRoute>} />
          <Route path="/referral" element={<ProtectedRoute><Referral /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/withdraw" element={<ProtectedRoute><Withdraw /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;
