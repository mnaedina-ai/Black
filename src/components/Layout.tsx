import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Wallet, Users, User, LogOut, ShieldCheck, Gift, Landmark, Menu, Search, X, Bell, MessageSquare } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { auth, db } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { formatCurrency, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userData, isAdmin, settings } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    if (!userData) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', 'in', [userData.uid, 'all']),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsubscribe();
  }, [userData]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const markAsRead = async (id: string) => {
    await updateDoc(doc(db, 'notifications', id), { isRead: true });
  };

  const deleteNotification = async (id: string) => {
    await deleteDoc(doc(db, 'notifications', id));
  };

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/auth');
  };

  const navItems = [
    { path: '/', icon: Home, label: 'Início' },
    { path: '/referral', icon: Gift, label: 'Promoção' },
    { path: '/wallet', icon: Landmark, label: 'Depósito', isCenter: true },
    { path: '/withdraw', icon: Wallet, label: 'Saque' },
    { path: '/profile', icon: User, label: 'Perfil' },
  ];

  if (isAdmin) {
    navItems.push({ path: '/admin', icon: ShieldCheck, label: 'Admin' });
  }

  const Logo = () => (
    <Link to="/" className="flex items-center gap-1">
      {settings?.logoUrl ? (
        <img src={settings.logoUrl} alt="Logo" className="h-8 w-auto object-contain" referrerPolicy="no-referrer" />
      ) : (
        <div className="text-2xl font-black italic tracking-tighter flex items-center gap-1">
          <span className="text-white">234</span>
          <span className="text-casino-primary">VIP</span>
          <span className="text-white">.NET</span>
        </div>
      )}
    </Link>
  );

  return (
    <div className="flex flex-col min-h-screen pb-32 md:pb-0 md:pl-64">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-64 bg-[#0a0e17] border-r border-white/10 p-6 z-50">
        <div className="mb-8">
          <Logo />
        </div>

        <div className="mb-8 p-4 bg-[#161d2b] rounded-2xl border border-white/5">
          <p className="text-xs text-white/50 uppercase font-bold mb-1">Saldo Total</p>
          <p className="text-xl font-black text-casino-accent">
            {userData ? formatCurrency(userData.balance) : 'R$ 0,00'}
          </p>
        </div>

        <nav className="flex-1 space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
                location.pathname === item.path 
                  ? "bg-casino-primary text-white shadow-lg shadow-casino-primary/20" 
                  : "text-white/60 hover:bg-white/5 hover:text-white"
              )}
            >
              <item.icon size={20} />
              <span className="font-semibold">{item.label}</span>
            </Link>
          ))}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('openChat'))}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-white/60 hover:bg-white/5 hover:text-white transition-all"
          >
            <MessageSquare size={20} />
            <span className="font-semibold">Chat Ao Vivo</span>
          </button>
          {isAdmin && (
            <Link
              to="/admin"
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
                location.pathname === '/admin' 
                  ? "bg-red-500 text-white shadow-lg shadow-red-500/20" 
                  : "text-white/60 hover:bg-white/5 hover:text-white"
              )}
            >
              <ShieldCheck size={20} />
              <span className="font-semibold">Painel Admin</span>
            </Link>
          )}
        </nav>

        <button 
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-400/10 transition-all mt-auto"
        >
          <LogOut size={20} />
          <span className="font-semibold">Sair</span>
        </button>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between p-4 sticky top-0 z-50 bg-[#0a0e17]/80 backdrop-blur-lg border-b border-white/5">
        <div className="flex items-center gap-4">
          <motion.button 
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsMenuOpen(true)}
            className="text-white/80"
          >
            <Menu size={24} />
          </motion.button>
          <Logo />
        </div>
        
        <div className="flex items-center gap-3">
          {userData && (
            <div className="flex items-center gap-1">
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  // We need a way to open the chat from Layout
                  // Since chat state is in Home, we might need to move it or use a custom event
                  window.dispatchEvent(new CustomEvent('openChat'));
                }}
                className="p-2 text-white/60 hover:text-white"
              >
                <MessageSquare size={24} />
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsNotificationsOpen(true)}
                className="p-2 text-white/60 hover:text-white relative"
              >
                <Bell size={24} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </motion.button>
            </div>
          )}
          {!userData ? (
            <div className="flex items-center gap-2">
              <Link to="/auth" className="px-3 py-1.5 bg-casino-primary text-white text-[10px] font-black rounded-lg uppercase shadow-lg shadow-casino-primary/20 animate-bounce-subtle">Entrar</Link>
              <Link to="/auth" className="px-3 py-1.5 bg-green-500 text-white text-[10px] font-black rounded-lg uppercase shadow-lg shadow-green-500/20">Registro</Link>
            </div>
          ) : (
            <motion.div 
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/wallet')}
              className="px-3 py-1.5 bg-[#161d2b] rounded-full flex items-center gap-2 border border-white/5 cursor-pointer hover:border-casino-primary/30 transition-all"
            >
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm font-black text-casino-accent italic tracking-tighter">
                {formatCurrency(userData.balance)}
              </span>
            </motion.div>
          )}
        </div>
      </header>

      {/* Mobile Menu Drawer */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] md:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 bottom-0 w-72 bg-[#0a0e17] z-[101] p-6 flex flex-col md:hidden border-r border-white/10"
            >
              <div className="flex items-center justify-between mb-8">
                <Logo />
                <button onClick={() => setIsMenuOpen(false)} className="text-white/40 hover:text-white">
                  <X size={24} />
                </button>
              </div>

              <div className="mb-8 p-4 bg-[#161d2b] rounded-2xl border border-white/5">
                <p className="text-xs text-white/50 uppercase font-bold mb-1">Saldo Total</p>
                <p className="text-xl font-black text-casino-accent">
                  {userData ? formatCurrency(userData.balance) : 'R$ 0,00'}
                </p>
              </div>

              <nav className="flex-1 space-y-2">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
                      location.pathname === item.path 
                        ? "bg-casino-primary text-white" 
                        : "text-white/60 hover:bg-white/5"
                    )}
                  >
                    <item.icon size={20} />
                    <span className="font-semibold">{item.label}</span>
                  </Link>
                ))}
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    window.dispatchEvent(new CustomEvent('openChat'));
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-white/60 hover:bg-white/5 transition-all"
                >
                  <MessageSquare size={20} />
                  <span className="font-semibold">Chat Ao Vivo</span>
                </button>
              </nav>

              <button 
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-400/10 transition-all mt-auto"
              >
                <LogOut size={20} />
                <span className="font-semibold">Sair</span>
              </button>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          key={location.pathname}
        >
          {children}
        </motion.div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#101726]/90 backdrop-blur-xl border-t border-white/5 px-2 py-2 flex justify-around items-end z-50 h-20">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              "flex flex-col items-center gap-1 transition-all relative pb-2",
              item.isCenter ? "z-10" : "",
              location.pathname === item.path ? "text-casino-primary" : "text-white/40"
            )}
          >
            {item.isCenter ? (
              <div className="flex flex-col items-center -translate-y-4">
                <motion.div 
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  whileTap={{ scale: 0.9 }}
                  className="w-14 h-14 bg-gradient-to-b from-yellow-400 to-orange-600 rounded-2xl shadow-lg shadow-orange-600/40 flex items-center justify-center text-white mb-1 border-4 border-[#101726] animate-glow"
                >
                  <item.icon size={28} className="animate-float" />
                </motion.div>
                <span className="text-[10px] font-black uppercase tracking-wider text-casino-primary">Depósito</span>
              </div>
            ) : (
              <motion.div 
                whileTap={{ scale: 0.8 }}
                className="flex flex-col items-center gap-1"
              >
                <item.icon size={22} className={cn(location.pathname === item.path && "animate-bounce-subtle")} />
                <span className="text-[10px] font-black uppercase tracking-wider">{item.label}</span>
              </motion.div>
            )}
            {location.pathname === item.path && !item.isCenter && (
              <motion.div 
                layoutId="nav-indicator"
                className="absolute bottom-0 w-1 h-1 bg-casino-primary rounded-full"
              />
            )}
          </Link>
        ))}
      </nav>

      {/* Notifications Drawer */}
      <AnimatePresence>
        {isNotificationsOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsNotificationsOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-[#0a0e17] z-[101] flex flex-col border-l border-white/10"
            >
              <div className="p-6 border-b border-white/10 flex items-center justify-between bg-[#161d2b]">
                <div className="flex items-center gap-3">
                  <Bell size={20} className="text-casino-primary" />
                  <h3 className="text-xl font-black italic tracking-tighter uppercase">Notificações</h3>
                </div>
                <button onClick={() => setIsNotificationsOpen(false)} className="text-white/40 hover:text-white">
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {notifications.length === 0 ? (
                  <div className="text-center py-20">
                    <Bell size={48} className="mx-auto text-white/10 mb-4" />
                    <p className="text-white/40 font-bold uppercase tracking-widest text-xs">Nenhuma notificação</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div 
                      key={n.id} 
                      className={cn(
                        "glass p-4 rounded-2xl border transition-all relative group",
                        n.isRead ? "border-white/5 opacity-60" : "border-casino-primary/30 bg-casino-primary/5"
                      )}
                      onClick={() => !n.isRead && markAsRead(n.id)}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="font-bold text-sm">{n.title}</h4>
                        <button 
                          onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-white/20 hover:text-red-500 transition-all"
                        >
                          <X size={14} />
                        </button>
                      </div>
                      <p className="text-xs text-white/60 leading-relaxed">{n.message}</p>
                      <p className="text-[10px] text-white/20 font-bold uppercase mt-2">
                        {new Date(n.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Layout;
