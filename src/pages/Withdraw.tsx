import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, updateDoc, increment, addDoc, collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { formatCurrency, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Wallet, ArrowUpRight, Loader2, AlertCircle, CheckCircle2, Clock, XCircle, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Withdraw: React.FC = () => {
  const { userData } = useAuth();
  const navigate = useNavigate();
  const [amount, setAmount] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [showRequirement, setShowRequirement] = useState(false);

  useEffect(() => {
    if (!userData) return;
    const q = query(
      collection(db, 'withdrawals'),
      where('userId', '==', userData.uid),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setWithdrawals(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'withdrawals');
    });
    return () => unsub();
  }, [userData]);

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData) return;

    const withdrawAmount = parseFloat(amount);
    if (isNaN(withdrawAmount) || withdrawAmount < 20) {
      setError('O valor mínimo para saque é R$ 20,00');
      return;
    }

    if (withdrawAmount > userData.balance) {
      setError('Saldo insuficiente');
      return;
    }

    if (!pixKey) {
      setError('Informe sua chave PIX');
      return;
    }

    // Check for 20.99 deposit requirement
    if (userData.hasDepositedRequirement) {
      confirmWithdraw();
    } else {
      setShowRequirement(true);
    }
  };

  const confirmWithdraw = async () => {
    if (!userData) return;
    const withdrawAmount = parseFloat(amount);
    
    setLoading(true);
    setError('');
    setSuccess('');
    setShowRequirement(false);

    try {
      // Deduct balance
      await updateDoc(doc(db, 'users', userData.uid), {
        balance: increment(-withdrawAmount)
      });

      // Create withdrawal request
      await addDoc(collection(db, 'withdrawals'), {
        userId: userData.uid,
        userName: userData.name,
        amount: withdrawAmount,
        pixKey,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // Log transaction
      await addDoc(collection(db, 'transactions'), {
        userId: userData.uid,
        userName: userData.name,
        type: 'withdraw',
        amount: withdrawAmount,
        description: 'Solicitação de saque PIX',
        createdAt: new Date().toISOString()
      });

      setSuccess('Solicitação de saque enviada com sucesso!');
      setAmount('');
      setPixKey('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'withdrawals');
      setError('Erro ao processar saque. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      <header className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-casino-primary/20 flex items-center justify-center text-casino-primary">
          <Wallet size={24} />
        </div>
        <h2 className="text-2xl font-black italic uppercase tracking-tighter">Saque <span className="text-white/20 ml-1 font-normal">PIX</span></h2>
      </header>

      <div className="bg-[#161d2b] rounded-3xl p-6 border border-white/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-casino-primary/10 blur-3xl -z-10" />
        <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-1">Saldo Disponível</p>
        <p className="text-3xl font-black text-casino-accent">
          {userData ? formatCurrency(userData.balance) : 'R$ 0,00'}
        </p>
      </div>

      <form onSubmit={handleWithdraw} className="space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-black uppercase tracking-widest text-white/40 ml-1">Valor do Saque</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 font-bold">R$</span>
            <input
              type="number"
              placeholder="0,00"
              required
              min="20"
              step="0.01"
              className="w-full bg-[#0a0e17] border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white font-bold placeholder:text-white/10 focus:outline-none focus:border-casino-primary/50 transition-all"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <p className="text-[10px] text-white/30 ml-1 italic">* Mínimo R$ 20,00</p>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-black uppercase tracking-widest text-white/40 ml-1">Chave PIX</label>
          <input
            type="text"
            placeholder="CPF, Email ou Telefone"
            required
            className="w-full bg-[#0a0e17] border border-white/5 rounded-2xl py-4 px-4 text-white font-bold placeholder:text-white/10 focus:outline-none focus:border-casino-primary/50 transition-all"
            value={pixKey}
            onChange={(e) => setPixKey(e.target.value)}
          />
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center gap-3 text-red-500 text-sm font-bold"
          >
            <AlertCircle size={20} />
            {error}
          </motion.div>
        )}

        {success && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 flex items-center gap-3 text-green-500 text-sm font-bold"
          >
            <CheckCircle2 size={20} />
            {success}
          </motion.div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-casino-primary hover:bg-casino-primary/80 disabled:opacity-50 text-white font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-casino-primary/20 uppercase tracking-widest"
        >
          {loading ? <Loader2 className="animate-spin" /> : (
            <>
              Solicitar Saque
              <ArrowUpRight size={20} />
            </>
          )}
        </button>
      </form>

      <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
        <h4 className="text-xs font-black uppercase tracking-widest text-white/60 mb-2">Informações Importantes</h4>
        <ul className="text-[10px] text-white/40 space-y-1 list-disc pl-4">
          <li>O prazo para processamento é de até 24 horas úteis.</li>
          <li>Certifique-se de que a chave PIX está correta.</li>
          <li>Saques só podem ser realizados para contas de mesma titularidade.</li>
        </ul>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-black italic uppercase tracking-tighter flex items-center gap-2">
          <Clock size={20} className="text-casino-primary" />
          Histórico de Saques
        </h3>
        
        <div className="space-y-3">
          {withdrawals.length === 0 ? (
            <p className="text-center text-white/20 py-8 text-sm font-medium">Nenhum saque solicitado ainda.</p>
          ) : (
            withdrawals.map((w) => (
              <div key={w.id} className="glass rounded-2xl p-4 border border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center",
                    w.status === 'approved' ? "bg-green-500/20 text-green-500" : 
                    w.status === 'refused' ? "bg-red-500/20 text-red-500" : 
                    "bg-yellow-500/20 text-yellow-500"
                  )}>
                    {w.status === 'approved' ? <CheckCircle2 size={20} /> : 
                     w.status === 'refused' ? <XCircle size={20} /> : 
                     <Clock size={20} />}
                  </div>
                  <div>
                    <p className="font-bold text-white">{formatCurrency(w.amount)}</p>
                    <p className="text-[10px] text-white/40 uppercase font-black tracking-widest">
                      {new Date(w.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={cn(
                    "text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full",
                    w.status === 'approved' ? "bg-green-500/20 text-green-500" : 
                    w.status === 'refused' ? "bg-red-500/20 text-red-500" : 
                    "bg-yellow-500/20 text-yellow-500"
                  )}>
                    {w.status === 'approved' ? 'Sucesso' : 
                     w.status === 'refused' ? 'Recusado' : 
                     'Pendente'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <AnimatePresence>
        {showRequirement && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          >
            <div className="glass p-10 rounded-[40px] text-center max-w-sm w-full border border-casino-primary/30">
              <div className="w-20 h-20 bg-casino-primary/20 rounded-full mx-auto mb-6 flex items-center justify-center text-casino-primary">
                <AlertCircle size={40} />
              </div>
              <h3 className="text-2xl font-black mb-2 uppercase italic tracking-tighter">AÇÃO NECESSÁRIA</h3>
              <p className="text-white/60 mb-8 font-medium">Para continuar com o saque, faça um depósito de <span className="text-casino-primary font-black">R$ 20,99</span> para validar sua conta.</p>
              <div className="space-y-3">
                <button 
                  onClick={() => navigate('/wallet')} 
                  className="btn-primary w-full py-4 flex items-center justify-center gap-2"
                >
                  IR PARA DEPÓSITO
                  <ChevronRight size={20} />
                </button>
                <button 
                  onClick={() => setShowRequirement(false)} 
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

export default Withdraw;
