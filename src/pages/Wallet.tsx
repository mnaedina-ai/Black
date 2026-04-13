import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Wallet as WalletIcon, ArrowUpCircle, ArrowDownCircle, Clock, CheckCircle2, XCircle, Loader2, Copy, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { collection, addDoc, query, where, orderBy, onSnapshot, doc, updateDoc, increment } from 'firebase/firestore';
import { formatCurrency, cn } from '../lib/utils';
import { handleFirestoreError, OperationType } from '../lib/firebase';

const Wallet: React.FC = () => {
  const { userData, settings } = useAuth();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'deposit' | 'withdraw' | 'history'>('deposit');
  const [history, setHistory] = useState<any[]>([]);
  const [pendingDeposit, setPendingDeposit] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  const [showWithdrawRequirement, setShowWithdrawRequirement] = useState(false);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  useEffect(() => {
    if (!userData) return;
    
    // Transactions history
    const qTx = query(
      collection(db, 'transactions'),
      where('userId', '==', userData.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubTx = onSnapshot(qTx, (snap) => {
      setHistory(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'transactions');
    });

    // Pending deposit
    const qDep = query(
      collection(db, 'deposits'),
      where('userId', '==', userData.uid),
      where('status', 'in', ['pending', 'waiting_payment']),
      orderBy('createdAt', 'desc')
    );
    const unsubDep = onSnapshot(qDep, (snap) => {
      if (!snap.empty) {
        setPendingDeposit({ id: snap.docs[0].id, ...snap.docs[0].data() });
      } else {
        setPendingDeposit(null);
      }
    });

    return () => {
      unsubTx();
      unsubDep();
    };
  }, [userData]);

  const copyPixKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDeposit = async () => {
    if (!userData || !amount || Number(amount) < (settings?.minDeposit || 1)) return;
    if (pendingDeposit) {
      setMessage({ text: 'Você já possui um depósito pendente.', type: 'error' });
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'deposits'), {
        userId: userData.uid,
        userName: userData.name,
        amount: Number(amount),
        status: 'pending', // Waiting for admin to provide payment info
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      setAmount('');
      setMessage({ text: 'Solicitação de depósito enviada! Aguarde o administrador gerar o pagamento.', type: 'success' });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!userData || !amount || Number(amount) < (settings?.minWithdrawal || 1)) return;
    if (Number(amount) > userData.balance) {
      setMessage({ text: 'Saldo insuficiente', type: 'error' });
      return;
    }
    
    // Show requirement modal as requested
    setShowWithdrawRequirement(true);
  };

  const confirmWithdraw = async () => {
    if (!userData || !amount) return;
    setLoading(true);
    setShowWithdrawRequirement(false);
    try {
      await addDoc(collection(db, 'withdrawals'), {
        userId: userData.uid,
        userName: userData.name,
        amount: Number(amount),
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      // Deduct balance immediately
      await updateDoc(doc(db, 'users', userData.uid), {
        balance: increment(-Number(amount))
      });

      await addDoc(collection(db, 'transactions'), {
        userId: userData.uid,
        userName: userData.name,
        type: 'withdraw',
        amount: Number(amount),
        description: 'Solicitação de Saque',
        createdAt: new Date().toISOString()
      });

      setAmount('');
      setMessage({ text: 'Solicitação de saque enviada!', type: 'success' });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
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
            {message.type === 'success' ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      <section className="glass rounded-3xl p-8 text-center bg-gradient-to-br from-casino-primary/20 to-transparent relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 4 }}
        >
          <WalletIcon size={48} className="mx-auto mb-4 text-casino-primary drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]" />
        </motion.div>
        <h2 className="text-sm font-black text-white/40 uppercase tracking-[0.2em] mb-1">Saldo Disponível</h2>
        <p className="text-5xl font-black text-casino-accent italic tracking-tighter drop-shadow-lg">
          {userData ? formatCurrency(userData.balance) : 'R$ 0,00'}
        </p>
      </section>

      <div className="flex glass p-1 rounded-2xl">
        <button onClick={() => setTab('deposit')} className={cn("flex-1 py-3 rounded-xl font-bold transition-all", tab === 'deposit' ? "bg-casino-primary text-white" : "text-white/40")}>Depósito</button>
        <button onClick={() => setTab('withdraw')} className={cn("flex-1 py-3 rounded-xl font-bold transition-all", tab === 'withdraw' ? "bg-casino-primary text-white" : "text-white/40")}>Saque</button>
        <button onClick={() => setTab('history')} className={cn("flex-1 py-3 rounded-xl font-bold transition-all", tab === 'history' ? "bg-casino-primary text-white" : "text-white/40")}>Histórico</button>
      </div>

      {tab !== 'history' ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-3xl p-8 space-y-6">
          {tab === 'deposit' && pendingDeposit && (
            <div className="space-y-6 p-6 bg-casino-primary/10 rounded-[32px] border border-casino-primary/20 text-center animate-glow">
              <div className="flex items-center justify-center gap-2 text-casino-primary mb-2">
                <Clock size={20} className="animate-spin-slow" />
                <span className="text-xs font-black uppercase tracking-widest">Depósito em Processamento</span>
              </div>
              
              <p className="text-2xl font-black text-white italic tracking-tighter">
                {formatCurrency(pendingDeposit.amount)}
              </p>

              {pendingDeposit.status === 'pending' ? (
                <div className="space-y-2">
                  <p className="text-xs text-white/60 font-medium">Aguardando o administrador gerar os dados de pagamento...</p>
                  <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-casino-primary"
                      animate={{ x: [-100, 100] }}
                      transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs font-black uppercase tracking-widest text-casino-primary">Escaneie o QR Code ou copie a chave</p>
                  {pendingDeposit.pixQrCode && (
                    <div className="bg-white p-4 rounded-2xl mx-auto w-48 h-48 flex items-center justify-center shadow-lg shadow-white/5">
                      <img src={pendingDeposit.pixQrCode} alt="PIX QR Code" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                    </div>
                  )}
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Chave PIX</p>
                    <div className="flex gap-2">
                      <div className="flex-1 bg-[#0a0e17] border border-white/5 rounded-xl py-3 px-4 text-sm font-bold text-white truncate">
                        {pendingDeposit.pixKey}
                      </div>
                      <button 
                        onClick={() => copyPixKey(pendingDeposit.pixKey)}
                        className="p-3 bg-casino-primary text-white rounded-xl hover:bg-casino-primary/80 transition-all active:scale-95"
                      >
                        {copied ? <Check size={20} /> : <Copy size={20} />}
                      </button>
                    </div>
                  </div>
                  <p className="text-[10px] text-white/40 font-medium">Após o pagamento, o saldo será creditado automaticamente assim que confirmado pelo administrador.</p>
                </div>
              )}
              
              <div className="h-px bg-white/5 w-full my-4" />
            </div>
          )}

          {tab === 'deposit' && !pendingDeposit && (
            <div className="space-y-4">
              <div className="bg-white/5 p-4 rounded-2xl border border-white/5 flex items-center gap-4">
                <div className="w-12 h-12 bg-casino-primary/20 rounded-xl flex items-center justify-center text-casino-primary">
                  <ArrowUpCircle size={24} />
                </div>
                <div>
                  <h4 className="text-sm font-black uppercase tracking-widest text-white">Novo Depósito</h4>
                  <p className="text-[10px] text-white/40 font-medium">Insira o valor e aguarde a geração do PIX</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-white/40 uppercase tracking-widest">Valor (R$)</label>
                  <input
                    type="number"
                    placeholder="0,00"
                    className="input-field text-2xl font-bold"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                  <p className="text-xs text-white/30">
                    Mínimo: {formatCurrency(settings?.minDeposit || 1)}
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[20.99, 10.99, 5.99, 1.99].map((val) => (
                    <motion.button
                      key={val}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setAmount(val.toString())}
                      className={cn(
                        "py-3 rounded-xl font-black text-sm transition-all border border-white/5 shadow-sm",
                        amount === val.toString() ? "bg-casino-primary text-white border-casino-primary shadow-casino-primary/20" : "glass text-white/60 hover:bg-white/5"
                      )}
                    >
                      R$ {val.toFixed(2).replace('.', ',')}
                    </motion.button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleDeposit}
                disabled={loading}
                className="btn-primary w-full py-4 text-lg"
              >
                {loading ? <Loader2 className="animate-spin mx-auto" /> : 'Solicitar Depósito'}
              </button>
            </div>
          )}

          {tab === 'withdraw' && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-white/40 uppercase tracking-widest">Valor (R$)</label>
                  <input
                    type="number"
                    placeholder="0,00"
                    className="input-field text-2xl font-bold"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                  <p className="text-xs text-white/30">
                    Mínimo: {formatCurrency(settings?.minWithdrawal || 1)}
                  </p>
                </div>
              </div>

              <button
                onClick={handleWithdraw}
                disabled={loading}
                className="btn-primary w-full py-4 text-lg"
              >
                {loading ? <Loader2 className="animate-spin mx-auto" /> : 'Solicitar Saque'}
              </button>
            </div>
          )}
        </motion.div>
      ) : (
        <div className="space-y-4">
          {history.length === 0 && <p className="text-center text-white/30 py-12">Nenhuma transação encontrada.</p>}
          {history.map((tx) => (
            <div key={tx.id} className="glass rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", 
                  tx.type === 'win' || tx.type === 'deposit' || tx.type === 'bonus' ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500"
                )}>
                  {tx.type === 'win' || tx.type === 'deposit' || tx.type === 'bonus' ? <ArrowUpCircle size={20} /> : <ArrowDownCircle size={20} />}
                </div>
                <div>
                  <p className="font-bold capitalize">{tx.type}</p>
                  <p className="text-xs text-white/40">{tx.description}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={cn("font-black", tx.type === 'win' || tx.type === 'deposit' || tx.type === 'bonus' ? "text-green-500" : "text-red-500")}>
                  {tx.type === 'win' || tx.type === 'deposit' || tx.type === 'bonus' ? '+' : '-'} {formatCurrency(tx.amount)}
                </p>
                <p className="text-[10px] text-white/30 uppercase font-bold">{new Date(tx.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      <AnimatePresence>
        {showWithdrawRequirement && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          >
            <div className="glass p-10 rounded-[40px] text-center max-w-sm w-full border border-casino-primary/30">
              <div className="w-20 h-20 bg-casino-primary/20 rounded-full mx-auto mb-6 flex items-center justify-center text-casino-primary">
                <Clock size={40} className="animate-pulse" />
              </div>
              <h3 className="text-2xl font-black mb-2 uppercase italic tracking-tighter">AÇÃO NECESSÁRIA</h3>
              <p className="text-white/60 mb-8 font-medium">Para continuar com o saque, faça um depósito de <span className="text-casino-primary font-black">R$ 20,99</span> para validar sua conta.</p>
              <div className="space-y-3">
                <button 
                  onClick={() => {
                    setShowWithdrawRequirement(false);
                    setTab('deposit');
                    setAmount('20.99');
                  }} 
                  className="btn-primary w-full py-4 flex items-center justify-center gap-2"
                >
                  IR PARA DEPÓSITO
                </button>
                <button 
                  onClick={() => setShowWithdrawRequirement(false)} 
                  className="w-full py-4 text-white/40 text-xs font-bold uppercase tracking-widest hover:text-white transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Wallet;
