import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Dices, Target, Coins, FerrisWheel, LayoutGrid, Flame, Zap, Trophy, Star, ChevronRight, ChevronLeft, Gift, Play, Loader2, Send, MessageSquare, X, Trash2, Pin, Settings } from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { DEFAULT_GAMES } from '../constants';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, doc, limit, addDoc, serverTimestamp, deleteDoc, updateDoc, getDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import LiveFeed from '../components/LiveFeed';
import Ranking from '../components/Ranking';

interface Banner {
  id: string;
  imageUrl: string;
  link?: string;
  title?: string;
  isActive: boolean;
  order: number;
}

const Home: React.FC = () => {
  const { userData, settings, loading: authLoading, isAdmin } = useAuth();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [carouselInterval, setCarouselInterval] = useState(4000);
  const [loadingBanners, setLoadingBanners] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [adminColor, setAdminColor] = useState('#8b5cf6');
  const [moderatingUser, setModeratingUser] = useState<{ id: string, name: string } | null>(null);

  const displayGames = DEFAULT_GAMES.map(defaultGame => {
    const customGame = settings?.games?.find((g: any) => g.id === defaultGame.id);
    return customGame ? { ...defaultGame, ...customGame } : defaultGame;
  });
  
  const finalGames = displayGames;

  useEffect(() => {
    const bannersQuery = query(
      collection(db, 'banners'),
      where('isActive', '==', true),
      orderBy('order', 'asc')
    );

    const unsubscribeBanners = onSnapshot(bannersQuery, (snapshot) => {
      const bannerData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Banner[];
      setBanners(bannerData);
      setLoadingBanners(false);
    }, (error) => {
      console.error('Error fetching banners:', error);
      setLoadingBanners(false);
    });

    const unsubscribeSettings = onSnapshot(doc(db, 'settings', 'global'), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        if (data.carouselInterval) {
          setCarouselInterval(data.carouselInterval * 1000);
        }
      }
    }, (error) => {
      console.error('Error fetching settings:', error);
    });

    // Chat listener
    const chatQuery = query(
      collection(db, 'chat'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribeChat = onSnapshot(chatQuery, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data({ serverTimestamps: 'estimate' })
      })).reverse();
      setChatMessages(messages);
    });

    const handleOpenChat = () => setIsChatOpen(true);
    window.addEventListener('openChat', handleOpenChat);

    return () => {
      unsubscribeBanners();
      unsubscribeSettings();
      unsubscribeChat();
      window.removeEventListener('openChat', handleOpenChat);
    };
  }, []);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !userData) return;
    if (userData.isChatBanned && !isAdmin) {
      alert('Você está banido do chat permanentemente.');
      return;
    }

    if (userData.chatMuteUntil && !isAdmin) {
      const muteUntil = new Date(userData.chatMuteUntil);
      if (muteUntil > new Date()) {
        alert(`Você está mutado até ${muteUntil.toLocaleString()}`);
        return;
      }
    }

    const messageText = newMessage;
    setNewMessage('');

    try {
      await addDoc(collection(db, 'chat'), {
        userId: userData.uid,
        userName: userData.name,
        text: messageText,
        role: isAdmin ? 'admin' : 'user',
        color: isAdmin ? adminColor : null,
        isPinned: false,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error('Chat error:', err);
    }
  };

  const deleteMessage = async (id: string, messageUserId: string) => {
    if (!isAdmin && messageUserId !== userData?.uid) return;
    await deleteDoc(doc(db, 'chat', id));
  };

  const pinMessage = async (id: string, isPinned: boolean) => {
    if (!isAdmin) return;
    await updateDoc(doc(db, 'chat', id), { isPinned: !isPinned });
  };

  const moderateUser = async (userId: string, action: 'mute' | 'ban', durationMinutes: number | 'permanent') => {
    if (!isAdmin) return;
    
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const data = userSnap.data();
      if (data.role === 'admin' || data.email === 'mnaedina@gmail.com') {
        alert('Não é possível moderar um administrador.');
        return;
      }
    }

    if (action === 'ban') {
      await updateDoc(userRef, { isChatBanned: true });
      alert('Usuário banido permanentemente do chat.');
    } else {
      const muteUntil = durationMinutes === 'permanent' 
        ? new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString()
        : new Date(Date.now() + (durationMinutes as number) * 60 * 1000).toISOString();
      
      await updateDoc(userRef, { chatMuteUntil: muteUntil });
      alert(`Usuário mutado até ${new Date(muteUntil).toLocaleString()}`);
    }
    setModeratingUser(null);
  };

  const nextBanner = useCallback(() => {
    if (banners.length === 0) return;
    setCurrentBannerIndex((prev) => (prev + 1) % banners.length);
  }, [banners.length]);

  const prevBanner = useCallback(() => {
    if (banners.length === 0) return;
    setCurrentBannerIndex((prev) => (prev - 1 + banners.length) % banners.length);
  }, [banners.length]);

  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(nextBanner, carouselInterval);
    return () => clearInterval(timer);
  }, [banners.length, carouselInterval, nextBanner]);

  // Touch support for swipe
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    if (isLeftSwipe) nextBanner();
    if (isRightSwipe) prevBanner();
  };

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="animate-spin text-casino-primary" size={40} />
        <p className="text-white/40 font-bold uppercase tracking-widest text-xs">Carregando Cassino...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Live Feed Section */}
      <div className="bg-[#161d2b]/30 py-1 rounded-3xl border border-white/5 shadow-inner">
        <LiveFeed />
      </div>

      {/* Banner Carousel */}
      <section 
        className="relative group h-[180px] sm:h-[300px] md:h-[400px] overflow-hidden rounded-3xl"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {banners.length > 0 ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={banners[currentBannerIndex].id}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0"
            >
              <Link to={banners[currentBannerIndex].link || '#'} className="block w-full h-full">
                <img 
                  src={banners[currentBannerIndex].imageUrl} 
                  alt={banners[currentBannerIndex].title || 'Banner'} 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                {banners[currentBannerIndex].title && (
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-6">
                    <h2 className="text-xl md:text-3xl font-black text-white uppercase italic">
                      {banners[currentBannerIndex].title}
                    </h2>
                  </div>
                )}
              </Link>
            </motion.div>
          </AnimatePresence>
        ) : (
          <div className="w-full h-full bg-[#161d2b] flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-casino-primary/20 to-transparent animate-pulse" />
            <div className="relative z-10 text-center">
              <div className="text-4xl md:text-6xl font-black italic tracking-tighter flex items-center gap-1 mb-2">
                <span className="text-white">234</span>
                <span className="text-casino-primary">VIP</span>
                <span className="text-white">.NET</span>
              </div>
              <p className="text-casino-primary font-black uppercase tracking-[0.4em] text-xs animate-bounce">O Melhor Casino Online</p>
            </div>
          </div>
        )}

        {banners.length > 1 && (
          <>
            <button 
              onClick={prevBanner}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
            >
              <ChevronLeft size={24} />
            </button>
            <button 
              onClick={nextBanner}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
            >
              <ChevronRight size={24} />
            </button>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
              {banners.map((_, i) => (
                <div 
                  key={i} 
                  className={cn(
                    "w-2 h-2 rounded-full transition-all",
                    i === currentBannerIndex ? "bg-casino-primary w-6" : "bg-white/20"
                  )}
                />
              ))}
            </div>
          </>
        )}
      </section>

      {/* Promo Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Link to="/referral" className="bg-gradient-to-br from-[#1a1f2e] to-[#0a0e17] p-4 rounded-2xl border border-white/5 flex items-center justify-between group cursor-pointer hover:border-casino-primary/50 transition-all hover:shadow-lg hover:shadow-casino-primary/10 animate-shine">
          <div>
            <p className="text-[10px] font-black text-casino-primary uppercase tracking-widest mb-1">Convide amigos</p>
            <p className="text-xs font-bold text-white">e ganhe bônus</p>
          </div>
          <Gift className="text-casino-primary group-hover:scale-125 group-hover:rotate-12 transition-transform duration-300" size={24} />
        </Link>
        <Link to="/wallet" className="bg-gradient-to-br from-[#1a1f2e] to-[#0a0e17] p-4 rounded-2xl border border-white/5 flex items-center justify-between group cursor-pointer hover:border-casino-accent/50 transition-all hover:shadow-lg hover:shadow-casino-accent/10 animate-shine">
          <div>
            <p className="text-[10px] font-black text-casino-accent uppercase tracking-widest mb-1">Depósito</p>
            <p className="text-xs font-bold text-white">Rápido via PIX</p>
          </div>
          <Trophy className="text-casino-accent group-hover:scale-125 group-hover:-rotate-12 transition-transform duration-300" size={24} />
        </Link>
      </div>

      {/* Game Grid Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="text-casino-primary" size={20} />
            <h3 className="text-lg font-black italic uppercase tracking-tighter">Jogos Populares</h3>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {finalGames.map((game, index) => (
            <motion.div
              key={game.id}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              whileInView={{ opacity: 1, scale: 1, y: 0 }}
              viewport={{ once: true }}
              whileHover={{ y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <Link 
                to={`/game/${game.id}`}
                className={cn(
                  "group block relative aspect-[3/4] rounded-2xl overflow-hidden bg-[#161d2b] border border-white/5 transition-all duration-300",
                  game.isMaintenance ? "grayscale cursor-not-allowed" : "hover:border-casino-primary/50 hover:shadow-2xl hover:shadow-casino-primary/20"
                )}
              >
                <img 
                  src={game.image} 
                  alt={game.name} 
                  className="w-full h-full object-cover group-hover:scale-125 transition-transform duration-700"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
                
                <div className="absolute inset-x-0 bottom-0 p-3">
                  <p className="text-xs font-black text-white uppercase tracking-tighter truncate mb-2 group-hover:text-casino-primary transition-colors">
                    {game.name}
                  </p>
                  {game.isMaintenance ? (
                    <div className="flex items-center justify-center w-full bg-red-500 py-2 rounded-lg text-[10px] font-black uppercase text-white shadow-lg shadow-red-500/40">
                      <Settings size={12} className="mr-1 animate-spin-slow" />
                      Manutenção
                    </div>
                  ) : (
                    <div className="flex items-center justify-center w-full bg-casino-primary py-2 rounded-lg text-[10px] font-black uppercase text-white transform translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 shadow-lg shadow-casino-primary/40">
                      <Play size={12} className="mr-1 fill-current" />
                      Jogar Agora
                    </div>
                  )}
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Chat Toggle Button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsChatOpen(true)}
        className="fixed right-6 bottom-24 md:bottom-6 z-[60] flex flex-col items-center gap-1"
      >
        <div className="w-14 h-14 bg-casino-primary rounded-2xl shadow-lg shadow-casino-primary/40 flex items-center justify-center text-white border border-white/20">
          <MessageSquare size={28} />
          {chatMessages.length > 0 && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full border-2 border-[#0a0e17] flex items-center justify-center text-[10px] font-black">
              {chatMessages.length}
            </div>
          )}
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest text-white/60 bg-black/40 px-2 py-0.5 rounded-full backdrop-blur-sm">Chat</span>
      </motion.button>

      {/* Chat Drawer */}
      <AnimatePresence>
        {isChatOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsChatOpen(false)}
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
                  <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                  <h3 className="text-xl font-black italic tracking-tighter uppercase">Chat <span className="text-casino-primary">Ao Vivo</span></h3>
                </div>
                <button onClick={() => setIsChatOpen(false)} className="text-white/40 hover:text-white">
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {chatMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-20">
                    <MessageSquare size={48} className="mb-4" />
                    <p className="text-xs font-black uppercase tracking-widest">Nenhuma mensagem ainda</p>
                    <p className="text-[10px] mt-1">Seja o primeiro a falar!</p>
                  </div>
                ) : (
                  [...chatMessages].sort((a, b) => (a.isPinned === b.isPinned ? 0 : a.isPinned ? -1 : 1)).map((msg) => (
                    <motion.div 
                      key={msg.id} 
                      layout
                      initial={msg.role === 'admin' ? { scale: 0.9, opacity: 0 } : { x: 20, opacity: 0 }}
                      animate={msg.role === 'admin' ? { scale: 1, opacity: 1 } : { x: 0, opacity: 1 }}
                      className={cn(
                        "flex flex-col gap-1 relative group",
                        msg.userId === userData?.uid ? "items-end" : "items-start",
                        msg.isPinned && "bg-casino-primary/10 p-3 rounded-2xl border border-casino-primary/20"
                      )}
                    >
                      {msg.isPinned && (
                        <div className="flex items-center gap-1 text-[10px] font-black text-casino-primary uppercase tracking-widest mb-1">
                          <Zap size={10} fill="currentColor" /> Mensagem Fixada
                        </div>
                      )}
                      <div className={cn(
                        "flex items-center gap-2",
                        msg.userId === userData?.uid && "flex-row-reverse"
                      )}>
                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-[10px] font-bold border border-white/10">
                          {msg.userName?.substring(0, 2).toUpperCase() || '??'}
                        </div>
                        <span className={cn(
                          "text-[10px] font-black uppercase tracking-widest",
                          msg.role === 'admin' ? "text-casino-primary" : "text-white/40"
                        )}>
                          {msg.userName} {msg.role === 'admin' && '👑'}
                        </span>
                      </div>
                      <div 
                        className={cn(
                          "px-4 py-2 rounded-2xl text-sm max-w-[85%] break-words shadow-lg",
                          msg.userId === userData?.uid 
                            ? "bg-casino-primary text-white rounded-tr-none" 
                            : "bg-white/5 text-white/80 rounded-tl-none border border-white/5"
                        )}
                        style={msg.role === 'admin' && msg.color ? { backgroundColor: msg.color, color: '#fff' } : {}}
                      >
                        {msg.text}
                      </div>
                         {(isAdmin || msg.userId === userData?.uid) && (
                        <div className="flex gap-3 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => deleteMessage(msg.id, msg.userId)} className="p-1 hover:text-red-500 transition-colors" title="Apagar">
                            <Trash2 size={14} />
                          </button>
                          {isAdmin && (
                            <>
                              <button onClick={() => pinMessage(msg.id, msg.isPinned)} className={cn("p-1 transition-colors", msg.isPinned ? "text-casino-primary" : "hover:text-casino-primary")} title={msg.isPinned ? "Desafixar" : "Fixar"}>
                                <Pin size={14} className={msg.isPinned ? "fill-current" : ""} />
                              </button>
                              {msg.role !== 'admin' && (
                                <button onClick={() => setModeratingUser({ id: msg.userId, name: msg.userName })} className="text-[10px] font-black uppercase tracking-widest text-orange-500 hover:text-orange-400 transition-colors" title="Moderar Usuário">
                                  Moderar
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </motion.div>
                  ))
                )}
              </div>

              <form onSubmit={handleSendMessage} className="p-6 bg-[#161d2b] border-t border-white/10 space-y-4">
                {isAdmin && (
                  <div className="flex items-center gap-3 overflow-x-auto pb-2">
                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest whitespace-nowrap">Cor:</span>
                    {['#8b5cf6', '#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'].map(c => (
                      <button 
                        key={c}
                        type="button"
                        onClick={() => setAdminColor(c)}
                        className={cn(
                          "w-6 h-6 rounded-full border-2 transition-all",
                          adminColor === c ? "border-white scale-110" : "border-transparent"
                        )}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                )}
                <div className="relative">
                  <input
                    type="text"
                    placeholder={
                      settings?.isChatEnabled === false ? "Chat desativado pelo administrador" :
                      userData?.isChatBanned ? "Você está banido permanentemente" :
                      (userData?.chatMuteUntil && new Date(userData.chatMuteUntil) > new Date()) ? 
                      `Mutado até ${new Date(userData.chatMuteUntil).toLocaleTimeString()}` :
                      "Digite sua mensagem..."
                    }
                    className="input-field pr-12 disabled:opacity-50"
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    disabled={
                      settings?.isChatEnabled === false ||
                      (userData?.isChatBanned && !isAdmin) || 
                      (userData?.chatMuteUntil && new Date(userData.chatMuteUntil) > new Date() && !isAdmin)
                    }
                  />
                  <button 
                    type="submit"
                    disabled={
                      settings?.isChatEnabled === false ||
                      (userData?.isChatBanned && !isAdmin) || 
                      (userData?.chatMuteUntil && new Date(userData.chatMuteUntil) > new Date() && !isAdmin)
                    }
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-casino-primary hover:text-white transition-colors disabled:opacity-50"
                  >
                    <Send size={20} />
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Moderation Modal */}
      <AnimatePresence>
        {moderatingUser && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass p-8 rounded-[32px] max-w-sm w-full space-y-6 border border-white/10"
            >
              <div className="text-center space-y-2">
                <h3 className="text-xl font-black uppercase italic tracking-tighter">Moderar Usuário</h3>
                <p className="text-white/40 text-xs font-bold uppercase tracking-widest">{moderatingUser.name}</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">Mutar por:</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[1, 5, 10, 30, 60, 1440].map(m => (
                      <button 
                        key={m}
                        onClick={() => moderateUser(moderatingUser.id, 'mute', m)}
                        className="glass py-2 rounded-xl text-[10px] font-black hover:bg-white/10 transition-all"
                      >
                        {m >= 60 ? `${m/60}h` : `${m}m`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <button 
                    onClick={() => moderateUser(moderatingUser.id, 'ban', 'permanent')}
                    className="flex-1 py-3 bg-red-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-500/20"
                  >
                    Banir Permanente
                  </button>
                  <button 
                    onClick={() => setModeratingUser(null)}
                    className="flex-1 py-3 glass text-white/40 rounded-xl text-[10px] font-black uppercase tracking-widest"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Global Ranking */}
      <Ranking />
    </div>
  );
};

export default Home;
