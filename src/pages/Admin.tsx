import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { auth, db } from '../lib/firebase';
import { collection, query, onSnapshot, doc, updateDoc, getDocs, getDoc, setDoc, increment, orderBy, addDoc, deleteDoc, limit, serverTimestamp } from 'firebase/firestore';
import { formatCurrency, cn } from '../lib/utils';
import { Users, Wallet, ArrowUpCircle, ArrowDownCircle, Settings, ShieldAlert, Check, X, Loader2, Clock, Image as ImageIcon, Trash2 } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../lib/firebase';
import { DEFAULT_GAMES } from '../constants';

const Admin: React.FC = () => {
  const { isAdmin, settings } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalUsers: 0, totalBalance: 0, pendingWithdrawals: 0, pendingDeposits: 0 });
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasLoadedSettings, setHasLoadedSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<'users' | 'withdrawals' | 'deposits' | 'settings' | 'banners' | 'games' | 'ranking' | 'notifications' | 'chat'>('users');
  const [banners, setBanners] = useState<any[]>([]);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newBanner, setNewBanner] = useState({ imageUrl: '', link: '', title: '', isActive: true, order: 0 });
  const [editingBannerId, setEditingBannerId] = useState<string | null>(null);
  const [editingBalance, setEditingBalance] = useState<{ userId: string, balance: number } | null>(null);
  
  const [generatingPayment, setGeneratingPayment] = useState<any>(null);
  const [paymentInfo, setPaymentInfo] = useState({ pixKey: '', pixQrCode: '' });
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  const [notification, setNotification] = useState({ title: '', message: '', targetUserId: 'all' });

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const [editSettings, setEditSettings] = useState({
    registrationBonus: 10,
    inviteBonus: 5,
    minWithdrawal: 1,
    minDeposit: 1,
    carouselInterval: 4,
    pixKey: '',
    pixQrCode: '',
    logoUrl: '',
    isChatEnabled: true,
    games: [] as any[]
  });

  useEffect(() => {
    if (!isAdmin) return;

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const usersList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setUsers(usersList);
      setStats(prev => ({ 
        ...prev, 
        totalUsers: usersList.length,
        totalBalance: usersList.reduce((acc, u) => acc + (u.balance || 0), 0)
      }));
    }, (error) => {
      if (auth.currentUser) {
        handleFirestoreError(error, OperationType.GET, 'users');
      }
    });

    const unsubWithdrawals = onSnapshot(query(collection(db, 'withdrawals'), orderBy('createdAt', 'desc')), (snap) => {
      const wList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setWithdrawals(wList);
      setStats(prev => ({
        ...prev,
        pendingWithdrawals: wList.filter(w => w.status === 'pending').length
      }));
    }, (error) => {
      if (auth.currentUser) {
        handleFirestoreError(error, OperationType.GET, 'withdrawals');
      }
    });

    const unsubDeposits = onSnapshot(query(collection(db, 'deposits'), orderBy('createdAt', 'desc')), (snap) => {
      const dList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setDeposits(dList);
      setStats(prev => ({
        ...prev,
        pendingDeposits: dList.filter(d => d.status === 'pending' || d.status === 'waiting_payment').length
      }));
    }, (error) => {
      if (auth.currentUser) {
        handleFirestoreError(error, OperationType.GET, 'deposits');
      }
    });

    const unsubBanners = onSnapshot(query(collection(db, 'banners'), orderBy('order', 'asc')), (snap) => {
      setBanners(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
    }, (error) => {
      if (auth.currentUser) {
        handleFirestoreError(error, OperationType.GET, 'banners');
      }
    });

    const unsubChat = onSnapshot(query(collection(db, 'chat'), orderBy('createdAt', 'desc'), limit(50)), (snap) => {
      setChatMessages(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
    });

    if (settings && !hasLoadedSettings) {
      setEditSettings({
        registrationBonus: settings.registrationBonus || 10,
        inviteBonus: settings.inviteBonus || 5,
        minWithdrawal: settings.minWithdrawal || 1,
        minDeposit: settings.minDeposit || 1,
        carouselInterval: settings.carouselInterval || 4,
        pixKey: (settings as any).pixKey || '',
        pixQrCode: (settings as any).pixQrCode || '',
        logoUrl: settings.logoUrl || '',
        isChatEnabled: (settings as any).isChatEnabled !== false,
        games: DEFAULT_GAMES.map(defaultGame => {
          const customGame = settings.games?.find((g: any) => g.id === defaultGame.id);
          return customGame ? { ...defaultGame, ...customGame } : defaultGame;
        })
      });
      setHasLoadedSettings(true);
    }

    if (settings && !isSaving) {
      // Keep editSettings in sync if they change in DB and we are not editing
      // But only if we haven't changed anything locally
    }

    return () => {
      unsubUsers();
      unsubWithdrawals();
      unsubDeposits();
      unsubBanners();
      unsubChat();
    };
  }, [isAdmin, settings, editingBalance, editingBannerId, generatingPayment, isSaving]);

  const handleClearChat = async () => {
    if (!window.confirm('Tem certeza que deseja apagar TODO o chat?')) return;
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'chat'));
      const batch = snap.docs.map(d => deleteDoc(d.ref));
      await Promise.all(batch);
      setMessage({ text: 'Chat limpo com sucesso!', type: 'success' });
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Erro ao limpar chat.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleMuteUser = async (userId: string, minutes: number) => {
    const muteUntil = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    await updateDoc(doc(db, 'users', userId), { chatMuteUntil: muteUntil });
    setMessage({ text: 'Usuário mutado!', type: 'success' });
  };

  const handleUpdateBalance = async (userId: string, currentBalance: number) => {
    setEditingBalance({ userId, balance: currentBalance });
  };

  const confirmBalanceUpdate = async () => {
    if (!editingBalance) return;
    try {
      await updateDoc(doc(db, 'users', editingBalance.userId), { balance: editingBalance.balance });
      setEditingBalance(null);
      setMessage({ text: 'Saldo atualizado com sucesso!', type: 'success' });
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Erro ao atualizar saldo.', type: 'error' });
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, callback: (base64: string) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 300 * 1024) { // 300KB limit
        setMessage({ text: 'A imagem é muito grande! Use uma imagem menor que 300KB ou use um link.', type: 'error' });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        callback(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleWithdrawalStatus = async (id: string, userId: string, amount: number, status: 'approved' | 'refused') => {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'withdrawals', id), { 
        status, 
        updatedAt: new Date().toISOString() 
      });

      if (status === 'refused') {
        // Refund user
        await updateDoc(doc(db, 'users', userId), { balance: increment(amount) });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePayment = async () => {
    if (!generatingPayment) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'deposits', generatingPayment.id), {
        status: 'waiting_payment',
        pixKey: paymentInfo.pixKey,
        pixQrCode: paymentInfo.pixQrCode,
        updatedAt: new Date().toISOString()
      });
      setGeneratingPayment(null);
      setPaymentInfo({ pixKey: '', pixQrCode: '' });
      setMessage({ text: 'Dados de pagamento enviados para o usuário!', type: 'success' });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveDeposit = async (deposit: any) => {
    setLoading(true);
    try {
      // Update user balance
      const userUpdates: any = {
        balance: increment(deposit.amount)
      };
      
      if (deposit.amount >= 20.99) {
        userUpdates.hasDepositedRequirement = true;
      }

      await updateDoc(doc(db, 'users', deposit.userId), userUpdates);

      // Update deposit status
      await updateDoc(doc(db, 'deposits', deposit.id), {
        status: 'approved',
        updatedAt: new Date().toISOString()
      });

      // Log transaction
      await addDoc(collection(db, 'transactions'), {
        userId: deposit.userId,
        type: 'deposit',
        amount: deposit.amount,
        description: 'Depósito via PIX Confirmado',
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefuseDeposit = async (id: string) => {
    try {
      await updateDoc(doc(db, 'deposits', id), {
        status: 'refused',
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleResetGame = async (gameId: string) => {
    if (!window.confirm(`Deseja resetar o estado do jogo ${gameId}?`)) return;
    setLoading(true);
    try {
      await setDoc(doc(db, 'games', gameId), {
        status: 'betting',
        history: [],
        nextPhaseTime: new Date(Date.now() + 10000).toISOString(),
        updatedAt: serverTimestamp()
      });
      setMessage({ text: 'Jogo resetado com sucesso!', type: 'success' });
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Erro ao resetar jogo.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setLoading(true);
    setIsSaving(true);
    try {
      const settingsSize = JSON.stringify(editSettings).length;
      if (settingsSize > 800 * 1024) {
        setMessage({ text: 'Erro: Configurações muito pesadas! Use links de imagens (URL) em vez de fazer upload de arquivos base64.', type: 'error' });
        setIsSaving(false);
        setLoading(false);
        return;
      }
      console.log('Saving settings:', editSettings);
      
      // Strip non-serializable properties (like Lucide icons) before saving
      const settingsToSave = {
        ...editSettings,
        games: editSettings.games.map(({ icon, ...rest }: any) => rest)
      };

      await setDoc(doc(db, 'settings', 'global'), settingsToSave);
      setMessage({ text: 'Configurações salvas com sucesso!', type: 'success' });
      // Wait a bit for the onSnapshot to propagate
      setTimeout(() => setIsSaving(false), 2000);
    } catch (err: any) {
      console.error('Error saving settings:', err);
      let errorMsg = 'Erro ao salvar configurações.';
      if (err.code === 'resource-exhausted') {
        errorMsg = 'Erro: Configurações muito grandes (tente usar links de imagens em vez de upload).';
      }
      setMessage({ text: errorMsg, type: 'error' });
      setIsSaving(false);
    } finally {
      setLoading(false);
    }
  };

  const handleBanUser = async (userId: string, isBanned: boolean) => {
    const userToBan = users.find(u => u.id === userId);
    if (userToBan?.role === 'admin' || userToBan?.email === 'mnaedina@gmail.com') {
      setMessage({ text: 'Não é possível banir um administrador.', type: 'error' });
      return;
    }
    await updateDoc(doc(db, 'users', userId), { isBanned: !isBanned });
  };

  const handleSendNotification = async () => {
    if (!notification.title || !notification.message) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'notifications'), {
        userId: notification.targetUserId,
        title: notification.title,
        message: notification.message,
        isRead: false,
        createdAt: new Date().toISOString()
      });
      setNotification({ title: '', message: '', targetUserId: 'all' });
      setMessage({ text: 'Notificação enviada!', type: 'success' });
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Erro ao enviar notificação.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleResetRanking = async () => {
    if (!window.confirm('ATENÇÃO: Isso irá zerar o total apostado de TODOS os usuários. Deseja continuar?')) return;
    setLoading(true);
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const batch = usersSnap.docs.map(uDoc => 
        updateDoc(doc(db, 'users', uDoc.id), { totalWagered: 0 })
      );
      await Promise.all(batch);
      setMessage({ text: 'Ranking resetado com sucesso!', type: 'success' });
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Erro ao resetar ranking.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) return <div className="p-12 text-center font-bold text-red-500">Acesso Negado</div>;

  return (
    <div className="space-y-8">
      <h2 className="text-3xl font-black italic tracking-tighter">PAINEL <span className="text-casino-primary">ADMIN</span></h2>

      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={cn(
              "fixed top-24 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-2xl font-bold shadow-xl flex items-center gap-2",
              message.type === 'success' ? "bg-green-500 text-white" : "bg-red-500 text-white"
            )}
          >
            {message.type === 'success' ? <Check size={20} /> : <X size={20} />}
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass p-6 rounded-3xl border-l-4 border-casino-primary">
          <div className="flex items-center gap-3 text-white/40 mb-2">
            <Users size={16} />
            <span className="text-xs font-bold uppercase tracking-widest">Total Usuários</span>
          </div>
          <p className="text-3xl font-black">{stats.totalUsers}</p>
        </div>
        <div className="glass p-6 rounded-3xl border-l-4 border-casino-accent">
          <div className="flex items-center gap-3 text-white/40 mb-2">
            <Wallet size={16} />
            <span className="text-xs font-bold uppercase tracking-widest">Saldo em Custódia</span>
          </div>
          <p className="text-3xl font-black">{formatCurrency(stats.totalBalance)}</p>
        </div>
        <div className="glass p-6 rounded-3xl border-l-4 border-orange-500">
          <div className="flex items-center gap-3 text-white/40 mb-2">
            <Clock size={16} />
            <span className="text-xs font-bold uppercase tracking-widest">Saques Pendentes</span>
          </div>
          <p className="text-3xl font-black">{stats.pendingWithdrawals}</p>
        </div>
        <div className="glass p-6 rounded-3xl border-l-4 border-green-500">
          <div className="flex items-center gap-3 text-white/40 mb-2">
            <ArrowUpCircle size={16} />
            <span className="text-xs font-bold uppercase tracking-widest">Depósitos Pendentes</span>
          </div>
          <p className="text-3xl font-black">{stats.pendingDeposits}</p>
        </div>
      </div>

      <div className="flex glass p-1 rounded-2xl overflow-x-auto">
        <button onClick={() => setActiveTab('users')} className={cn("flex-1 py-3 px-6 rounded-xl font-bold transition-all whitespace-nowrap", activeTab === 'users' ? "bg-casino-primary text-white" : "text-white/40")}>Usuários</button>
        <button onClick={() => setActiveTab('deposits')} className={cn("flex-1 py-3 px-6 rounded-xl font-bold transition-all whitespace-nowrap", activeTab === 'deposits' ? "bg-casino-primary text-white" : "text-white/40")}>Depósitos</button>
        <button onClick={() => setActiveTab('withdrawals')} className={cn("flex-1 py-3 px-6 rounded-xl font-bold transition-all whitespace-nowrap", activeTab === 'withdrawals' ? "bg-casino-primary text-white" : "text-white/40")}>Saques</button>
        <button onClick={() => setActiveTab('banners')} className={cn("flex-1 py-3 px-6 rounded-xl font-bold transition-all whitespace-nowrap", activeTab === 'banners' ? "bg-casino-primary text-white" : "text-white/40")}>Banners</button>
        <button onClick={() => setActiveTab('games')} className={cn("flex-1 py-3 px-6 rounded-xl font-bold transition-all whitespace-nowrap", activeTab === 'games' ? "bg-casino-primary text-white" : "text-white/40")}>Jogos</button>
        <button onClick={() => setActiveTab('chat')} className={cn("flex-1 py-3 px-6 rounded-xl font-bold transition-all whitespace-nowrap", activeTab === 'chat' ? "bg-casino-primary text-white" : "text-white/40")}>Chat</button>
        <button onClick={() => setActiveTab('ranking')} className={cn("flex-1 py-3 px-6 rounded-xl font-bold transition-all whitespace-nowrap", activeTab === 'ranking' ? "bg-casino-primary text-white" : "text-white/40")}>Ranking</button>
        <button onClick={() => setActiveTab('notifications')} className={cn("flex-1 py-3 px-6 rounded-xl font-bold transition-all whitespace-nowrap", activeTab === 'notifications' ? "bg-casino-primary text-white" : "text-white/40")}>Notificações</button>
        <button onClick={() => setActiveTab('settings')} className={cn("flex-1 py-3 px-6 rounded-xl font-bold transition-all whitespace-nowrap", activeTab === 'settings' ? "bg-casino-primary text-white" : "text-white/40")}>Configurações</button>
      </div>

      {activeTab === 'deposits' && (
        <div className="space-y-4">
          {deposits.map(d => (
            <div key={d.id} className="glass rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <p className="font-bold">{d.userName}</p>
                <p className="text-xl font-black text-green-500">{formatCurrency(d.amount)}</p>
                <p className="text-[10px] text-white/30 font-bold uppercase">{new Date(d.createdAt).toLocaleString()}</p>
                <div className="mt-1">
                  <span className={cn(
                    "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest",
                    d.status === 'pending' ? "bg-yellow-500/20 text-yellow-500" :
                    d.status === 'waiting_payment' ? "bg-blue-500/20 text-blue-500" :
                    d.status === 'approved' ? "bg-green-500/20 text-green-500" :
                    "bg-red-500/20 text-red-500"
                  )}>
                    {d.status === 'pending' ? 'Aguardando Geração' : 
                     d.status === 'waiting_payment' ? 'Aguardando Pagamento' : 
                     d.status === 'approved' ? 'Aprovado' : 'Recusado'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {d.status === 'pending' && (
                  <button 
                    onClick={() => {
                      setGeneratingPayment(d);
                      setPaymentInfo({ pixKey: settings?.pixKey || '', pixQrCode: (settings as any)?.pixQrCode || '' });
                    }}
                    className="btn-primary py-2 px-4 text-xs"
                  >
                    Gerar Pagamento
                  </button>
                )}
                {d.status === 'waiting_payment' && (
                  <>
                    <button onClick={() => handleApproveDeposit(d)} className="p-3 bg-green-500/20 text-green-500 rounded-xl hover:bg-green-500/30"><Check size={20} /></button>
                    <button onClick={() => handleRefuseDeposit(d.id)} className="p-3 bg-red-500/20 text-red-500 rounded-xl hover:bg-red-500/30"><X size={20} /></button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {generatingPayment && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="glass p-8 rounded-[40px] max-w-md w-full border border-casino-primary/30 space-y-6">
            <h3 className="text-xl font-black uppercase italic tracking-tighter">Gerar Pagamento</h3>
            <p className="text-sm text-white/60">Insira os dados do PIX para o depósito de {formatCurrency(generatingPayment.amount)} de {generatingPayment.userName}</p>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-white/40 uppercase tracking-widest">Chave PIX</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={paymentInfo.pixKey} 
                  onChange={e => setPaymentInfo({...paymentInfo, pixKey: e.target.value})} 
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-white/40 uppercase tracking-widest">QR Code PIX</label>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <input 
                      type="text" 
                      placeholder="URL da Imagem"
                      className="input-field mb-2" 
                      value={paymentInfo.pixQrCode} 
                      onChange={e => setPaymentInfo({...paymentInfo, pixQrCode: e.target.value})} 
                    />
                    <label className="flex items-center justify-center gap-2 p-3 bg-white/5 border border-dashed border-white/20 rounded-xl cursor-pointer hover:bg-white/10 transition-all">
                      <ImageIcon size={18} className="text-casino-primary" />
                      <span className="text-xs font-bold text-white/60">Escolher da Galeria</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={e => handleImageUpload(e, (base64) => setPaymentInfo({...paymentInfo, pixQrCode: base64}))} 
                      />
                    </label>
                  </div>
                  {paymentInfo.pixQrCode && (
                    <div className="w-24 h-24 bg-white p-2 rounded-xl">
                      <img src={paymentInfo.pixQrCode} alt="Preview" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={handleGeneratePayment}
                disabled={loading}
                className="btn-primary flex-1 py-4"
              >
                {loading ? <Loader2 className="animate-spin mx-auto" /> : 'Confirmar e Enviar'}
              </button>
              <button 
                onClick={() => setGeneratingPayment(null)}
                className="btn-secondary px-6"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {editingBalance && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="glass p-8 rounded-[40px] max-w-sm w-full border border-casino-primary/30 space-y-6">
            <h3 className="text-xl font-black uppercase italic tracking-tighter">Editar Saldo</h3>
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/40 uppercase tracking-widest">Novo Valor (R$)</label>
              <input 
                type="number" 
                className="input-field text-2xl font-bold" 
                value={editingBalance.balance} 
                onChange={e => setEditingBalance({...editingBalance, balance: Number(e.target.value)})} 
              />
            </div>
            <div className="flex gap-3">
              <button onClick={confirmBalanceUpdate} className="btn-primary flex-1 py-4">Salvar</button>
              <button onClick={() => setEditingBalance(null)} className="btn-secondary px-6">Cancelar</button>
            </div>
          </div>
        </div>
      )}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {users.map(u => (
            <div key={u.id} className="glass rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={cn("w-10 h-10 rounded-full flex items-center justify-center font-bold", u.isBanned ? "bg-red-500/20 text-red-500" : "bg-casino-primary/20 text-casino-primary")}>
                  {u.name[0]}
                </div>
                <div>
                  <p className="font-bold flex items-center gap-2">
                    {u.name} {u.isBanned && <ShieldAlert size={14} className="text-red-500" />}
                  </p>
                  <p className="text-xs text-white/40">{u.email} • ID: {u.numericId || '---'}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 justify-between md:justify-end">
                <div className="text-right">
                  <p className="text-xs font-bold text-white/30 uppercase">Saldo</p>
                  <p className="font-black text-casino-accent">{formatCurrency(u.balance)}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleUpdateBalance(u.id, u.balance)} className="p-2 glass rounded-lg hover:bg-white/10"><Wallet size={16} /></button>
                  <button 
                    onClick={() => handleBanUser(u.id, u.isBanned)} 
                    disabled={u.role === 'admin' || u.email === 'mnaedina@gmail.com'}
                    className={cn(
                      "p-2 rounded-lg transition-all", 
                      u.isBanned ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500",
                      (u.role === 'admin' || u.email === 'mnaedina@gmail.com') && "opacity-20 cursor-not-allowed"
                    )}
                  >
                    <ShieldAlert size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'withdrawals' && (
        <div className="space-y-4">
          {withdrawals.map(w => (
            <div key={w.id} className="glass rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="font-bold">{w.userName}</p>
                <p className="text-xl font-black text-casino-accent">{formatCurrency(w.amount)}</p>
                <p className="text-[10px] text-white/30 font-bold uppercase">{new Date(w.createdAt).toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-2">
                {w.status === 'pending' ? (
                  <>
                    <button onClick={() => handleWithdrawalStatus(w.id, w.userId, w.amount, 'approved')} className="p-3 bg-green-500/20 text-green-500 rounded-xl hover:bg-green-500/30"><Check size={20} /></button>
                    <button onClick={() => handleWithdrawalStatus(w.id, w.userId, w.amount, 'refused')} className="p-3 bg-red-500/20 text-red-500 rounded-xl hover:bg-red-500/30"><X size={20} /></button>
                  </>
                ) : (
                  <span className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest", w.status === 'approved' ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500")}>
                    {w.status}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'banners' && (
        <div className="space-y-6">
          <div className="glass rounded-3xl p-6 space-y-4">
            <h3 className="text-lg font-bold uppercase tracking-widest">{editingBannerId ? 'Editar Banner' : 'Novo Banner'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-white/40 uppercase tracking-widest">URL da Imagem</label>
                <div className="flex gap-2">
                  <input type="text" placeholder="URL da Imagem" className="input-field flex-1" value={newBanner.imageUrl} onChange={e => setNewBanner({...newBanner, imageUrl: e.target.value})} />
                  <label className="p-3 bg-white/5 border border-dashed border-white/20 rounded-xl cursor-pointer hover:bg-white/10 transition-all">
                    <ImageIcon size={18} className="text-casino-primary" />
                    <input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, (base64) => setNewBanner({...newBanner, imageUrl: base64}))} />
                  </label>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-white/40 uppercase tracking-widest">Link (opcional)</label>
                <input type="text" placeholder="Link (opcional)" className="input-field" value={newBanner.link} onChange={e => setNewBanner({...newBanner, link: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-white/40 uppercase tracking-widest">Título (opcional)</label>
                <input type="text" placeholder="Título (opcional)" className="input-field" value={newBanner.title} onChange={e => setNewBanner({...newBanner, title: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-white/40 uppercase tracking-widest">Ordem</label>
                <input type="number" placeholder="Ordem" className="input-field" value={newBanner.order} onChange={e => setNewBanner({...newBanner, order: Number(e.target.value)})} />
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={async () => {
                  setLoading(true);
                  try {
                    if (editingBannerId) {
                      await updateDoc(doc(db, 'banners', editingBannerId), newBanner);
                    } else {
                      await addDoc(collection(db, 'banners'), { ...newBanner, createdAt: new Date().toISOString() });
                    }
                    setNewBanner({ imageUrl: '', link: '', title: '', isActive: true, order: 0 });
                    setEditingBannerId(null);
                  } catch (err) { console.error(err); }
                  finally { setLoading(false); }
                }}
                disabled={loading || !newBanner.imageUrl} 
                className="btn-primary flex-1 py-3"
              >
                {loading ? <Loader2 className="animate-spin" /> : (editingBannerId ? 'Atualizar' : 'Adicionar')}
              </button>
              {editingBannerId && (
                <button onClick={() => { setEditingBannerId(null); setNewBanner({ imageUrl: '', link: '', title: '', isActive: true, order: 0 }); }} className="btn-secondary px-6">Cancelar</button>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {banners.map(b => (
              <div key={b.id} className="glass rounded-2xl p-4 flex items-center gap-4">
                <img src={b.imageUrl} className="w-20 h-12 object-cover rounded-lg" alt="" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate">{b.title || 'Sem título'}</p>
                  <p className="text-[10px] text-white/40 truncate">{b.link || 'Sem link'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => updateDoc(doc(db, 'banners', b.id), { isActive: !b.isActive })}
                    className={cn("p-2 rounded-lg", b.isActive ? "bg-green-500/20 text-green-500" : "bg-white/10 text-white/40")}
                  >
                    <Check size={16} />
                  </button>
                  <button onClick={() => { setEditingBannerId(b.id); setNewBanner({ imageUrl: b.imageUrl, link: b.link || '', title: b.title || '', isActive: b.isActive, order: b.order }); }} className="p-2 glass rounded-lg text-blue-400"><Settings size={16} /></button>
                  <button onClick={async () => { await deleteDoc(doc(db, 'banners', b.id)); }} className="p-2 glass rounded-lg text-red-500"><X size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'games' && (
        <div className="glass rounded-3xl p-8 space-y-8">
          <h3 className="text-xl font-black uppercase italic tracking-tighter">Gerenciar Fotos dos Jogos</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {editSettings.games.map((game, index) => (
              <div key={game.id} className="space-y-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white/40 uppercase tracking-widest">Configurações do Jogo</label>
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => {
                        const newGames = [...editSettings.games];
                        newGames[index].isMaintenance = !newGames[index].isMaintenance;
                        setEditSettings({...editSettings, games: newGames});
                      }}
                      className={cn(
                        "text-[10px] font-black px-2 py-1 rounded uppercase tracking-widest transition-all",
                        game.isMaintenance ? "bg-red-500 text-white" : "bg-green-500/20 text-green-500"
                      )}
                    >
                      {game.isMaintenance ? 'Em Manutenção' : 'Ativo'}
                    </button>
                    <button 
                      onClick={() => handleResetGame(game.id)}
                      className="text-[10px] font-black text-red-500 hover:text-red-400 uppercase tracking-widest"
                    >
                      Resetar Estado
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-white/40 uppercase tracking-widest">Nome do Jogo</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={game.name} 
                    onChange={e => {
                      const newGames = [...editSettings.games];
                      newGames[index].name = e.target.value;
                      setEditSettings({...editSettings, games: newGames});
                    }} 
                  />
                </div>
                <div className="flex gap-4">
                  <div className="flex-1 space-y-2">
                    <label className="text-xs font-bold text-white/40 uppercase tracking-widest">URL da Imagem</label>
                    <input 
                      type="text" 
                      placeholder="URL da Imagem" 
                      className="input-field text-xs" 
                      value={game.image} 
                      onChange={e => {
                        const newGames = [...editSettings.games];
                        newGames[index].image = e.target.value;
                        setEditSettings({...editSettings, games: newGames});
                      }} 
                    />
                    <label className="flex items-center justify-center gap-2 p-2 bg-white/5 border border-dashed border-white/20 rounded-xl cursor-pointer hover:bg-white/10 transition-all">
                      <ImageIcon size={14} className="text-casino-primary" />
                      <span className="text-[10px] font-bold text-white/60">Trocar Foto</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={e => handleImageUpload(e, (base64) => {
                          const newGames = [...editSettings.games];
                          newGames[index].image = base64;
                          setEditSettings({...editSettings, games: newGames});
                        })} 
                      />
                    </label>
                  </div>
                  <div className="w-20 h-20 rounded-xl overflow-hidden bg-black/20">
                    <img src={game.image} alt={game.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button onClick={handleSaveSettings} disabled={loading} className="btn-primary w-full py-4">
            Salvar Fotos dos Jogos
          </button>
        </div>
      )}

      {activeTab === 'chat' && (
        <div className="glass rounded-3xl p-8 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black uppercase italic tracking-tighter">Gerenciar Chat</h3>
            <button 
              onClick={handleClearChat}
              className="px-4 py-2 bg-red-500/20 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500/30 transition-all"
            >
              Limpar Todo o Chat
            </button>
          </div>

          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
            {chatMessages.map(msg => (
              <div key={msg.id} className="glass p-4 rounded-2xl flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm">{msg.userName}</span>
                    <span className="text-[10px] text-white/20 uppercase font-bold">{msg.role}</span>
                  </div>
                  <p className="text-sm text-white/70 break-words">{msg.text}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => deleteDoc(doc(db, 'chat', msg.id))}
                    className="p-2 glass rounded-lg text-red-500 hover:bg-red-500/10"
                    title="Apagar Mensagem"
                  >
                    <Trash2 size={16} />
                  </button>
                  {msg.role !== 'admin' && (
                    <div className="flex gap-1">
                      <button 
                        onClick={() => handleMuteUser(msg.userId, 60)}
                        className="px-2 py-1 glass rounded-lg text-[8px] font-black uppercase hover:bg-white/10"
                      >
                        Mute 1h
                      </button>
                      <button 
                        onClick={() => handleBanUser(msg.userId, false)}
                        className="px-2 py-1 glass rounded-lg text-[8px] font-black uppercase text-orange-500 hover:bg-orange-500/10"
                      >
                        Banir
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'ranking' && (
        <div className="glass rounded-3xl p-8 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black uppercase italic tracking-tighter">Ranking Global (Top 10 Apostadores)</h3>
            <button 
              onClick={handleResetRanking}
              disabled={loading}
              className="px-4 py-2 bg-red-500/20 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500/30 transition-all flex items-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />}
              Resetar Ranking
            </button>
          </div>
          <div className="space-y-4">
            {users
              .sort((a, b) => (b.totalWagered || 0) - (a.totalWagered || 0))
              .slice(0, 10)
              .map((u, i) => (
                <div key={u.id} className="glass rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center font-black text-sm",
                      i === 0 ? "bg-yellow-500 text-black" : 
                      i === 1 ? "bg-gray-300 text-black" : 
                      i === 2 ? "bg-orange-600 text-white" : "bg-white/10 text-white/40"
                    )}>
                      {i + 1}
                    </div>
                    <div>
                      <p className="font-bold">{u.name}</p>
                      <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest">ID: {u.numericId || '---'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-casino-primary font-black">{formatCurrency(u.totalWagered || 0)}</p>
                    <p className="text-[10px] text-white/40 uppercase font-bold">Total Apostado</p>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className="glass rounded-3xl p-8 space-y-6">
          <h3 className="text-xl font-black uppercase italic tracking-tighter">Enviar Notificação</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/40 uppercase tracking-widest">Destinatário</label>
              <select 
                className="input-field" 
                value={notification.targetUserId} 
                onChange={e => setNotification({...notification, targetUserId: e.target.value})}
              >
                <option value="all">Todos os Usuários</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/40 uppercase tracking-widest">Título</label>
              <input 
                type="text" 
                className="input-field" 
                placeholder="Título da Notificação"
                value={notification.title}
                onChange={e => setNotification({...notification, title: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/40 uppercase tracking-widest">Mensagem</label>
              <textarea 
                className="input-field min-h-[100px] py-3" 
                placeholder="Conteúdo da notificação..."
                value={notification.message}
                onChange={e => setNotification({...notification, message: e.target.value})}
              />
            </div>
            <button 
              onClick={handleSendNotification}
              disabled={loading || !notification.title || !notification.message}
              className="btn-primary w-full py-4"
            >
              {loading ? <Loader2 className="animate-spin mx-auto" /> : 'Enviar Notificação'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="glass rounded-3xl p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/40 uppercase tracking-widest">Logo do Site</label>
              <div className="flex gap-4">
                <div className="flex-1">
                  <input 
                    type="text" 
                    placeholder="URL da Logo" 
                    className="input-field mb-2" 
                    value={editSettings.logoUrl} 
                    onChange={e => setEditSettings({...editSettings, logoUrl: e.target.value})} 
                  />
                  <label className="flex items-center justify-center gap-2 p-3 bg-white/5 border border-dashed border-white/20 rounded-xl cursor-pointer hover:bg-white/10 transition-all">
                    <ImageIcon size={18} className="text-casino-primary" />
                    <span className="text-xs font-bold text-white/60">Escolher da Galeria</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={e => handleImageUpload(e, (base64) => setEditSettings({...editSettings, logoUrl: base64}))} 
                    />
                  </label>
                </div>
                {editSettings.logoUrl && (
                  <div className="w-24 h-24 bg-white/5 rounded-xl flex items-center justify-center p-2">
                    <img src={editSettings.logoUrl} alt="Logo Preview" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/40 uppercase tracking-widest">Bônus de Cadastro (R$)</label>
              <input type="number" className="input-field" value={editSettings.registrationBonus} onChange={e => setEditSettings({...editSettings, registrationBonus: Number(e.target.value)})} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/40 uppercase tracking-widest">Bônus de Convite (R$)</label>
              <input type="number" className="input-field" value={editSettings.inviteBonus} onChange={e => setEditSettings({...editSettings, inviteBonus: Number(e.target.value)})} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/40 uppercase tracking-widest">Saque Mínimo (R$)</label>
              <input type="number" className="input-field" value={editSettings.minWithdrawal} onChange={e => setEditSettings({...editSettings, minWithdrawal: Number(e.target.value)})} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/40 uppercase tracking-widest">Depósito Mínimo (R$)</label>
              <input type="number" className="input-field" value={editSettings.minDeposit} onChange={e => setEditSettings({...editSettings, minDeposit: Number(e.target.value)})} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/40 uppercase tracking-widest">Tempo do Carrossel (segundos)</label>
              <input type="number" className="input-field" value={editSettings.carouselInterval} onChange={e => setEditSettings({...editSettings, carouselInterval: Number(e.target.value)})} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/40 uppercase tracking-widest">Chat Global</label>
              <button 
                onClick={() => setEditSettings({...editSettings, isChatEnabled: !editSettings.isChatEnabled})}
                className={cn(
                  "w-full py-3 rounded-xl font-bold transition-all",
                  editSettings.isChatEnabled ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500"
                )}
              >
                {editSettings.isChatEnabled ? 'CHAT ATIVADO' : 'CHAT DESATIVADO'}
              </button>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/40 uppercase tracking-widest">Chave PIX para Depósito</label>
              <input type="text" className="input-field" value={editSettings.pixKey} onChange={e => setEditSettings({...editSettings, pixKey: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/40 uppercase tracking-widest">QR Code PIX Padrão</label>
              <div className="flex gap-4">
                <div className="flex-1">
                  <input 
                    type="text" 
                    placeholder="URL da Imagem"
                    className="input-field mb-2" 
                    value={editSettings.pixQrCode} 
                    onChange={e => setEditSettings({...editSettings, pixQrCode: e.target.value})} 
                  />
                  <label className="flex items-center justify-center gap-2 p-3 bg-white/5 border border-dashed border-white/20 rounded-xl cursor-pointer hover:bg-white/10 transition-all">
                    <ImageIcon size={18} className="text-casino-primary" />
                    <span className="text-xs font-bold text-white/60">Escolher da Galeria</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={e => handleImageUpload(e, (base64) => setEditSettings({...editSettings, pixQrCode: base64}))} 
                    />
                  </label>
                </div>
                {editSettings.pixQrCode && (
                  <div className="w-24 h-24 bg-white p-2 rounded-xl">
                    <img src={editSettings.pixQrCode} alt="Preview" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleSaveSettings} disabled={loading} className="btn-primary flex-1 py-4 flex items-center justify-center gap-2">
              {loading ? <Loader2 className="animate-spin" /> : <><Settings size={20} /> Salvar Alterações</>}
            </button>
            <button 
              onClick={() => setHasLoadedSettings(false)} 
              className="px-6 glass rounded-xl text-white/40 hover:text-white transition-all flex items-center gap-2"
              title="Recarregar do Banco"
            >
              <Clock size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
