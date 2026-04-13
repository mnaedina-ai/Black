import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, increment, collection, addDoc, query, where, getDocs, limit } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { generateInviteCode, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, User, ArrowRight, Loader2, Users, X, Eye, EyeOff, Key, CheckCircle2 } from 'lucide-react';

const Auth: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    inviteCode: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      if (isLogin) {
        // For login, we use email. If user entered a username, we'd need a lookup, 
        // but for now let's assume they enter email as per current setup.
        await signInWithEmailAndPassword(auth, formData.email, formData.password);
        navigate('/');
      } else {
        // Register
        const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        const user = userCredential.user;

        let invitedBy = null;
        let registrationBonus = 10;
        let inviteBonus = 5;

        // Get settings
        try {
          const settingsSnap = await getDoc(doc(db, 'settings', 'global'));
          if (settingsSnap.exists()) {
            registrationBonus = settingsSnap.data().registrationBonus;
            inviteBonus = settingsSnap.data().inviteBonus;
          }
        } catch (err) {
          console.warn('Could not fetch settings, using defaults');
        }

        // Check invite code
        if (formData.inviteCode) {
          try {
            const q = query(
              collection(db, 'users'), 
              where('inviteCode', '==', formData.inviteCode.toUpperCase()),
              limit(1)
            );
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
              const inviterDoc = querySnapshot.docs[0];
              invitedBy = inviterDoc.id;

              // Give bonus to inviter
              try {
                await updateDoc(doc(db, 'users', invitedBy), {
                  balance: increment(inviteBonus)
                });

                // Log transaction for inviter
                await addDoc(collection(db, 'transactions'), {
                  userId: invitedBy,
                  type: 'bonus',
                  amount: inviteBonus,
                  description: `Bônus por convidar ${formData.name}`,
                  createdAt: new Date().toISOString()
                });
              } catch (err) {
                console.error('Failed to reward inviter:', err);
              }
            }
          } catch (err) {
            handleFirestoreError(err, OperationType.LIST, 'users');
          }
        }

        // Create user doc
        try {
          const defaultName = formData.email.split('@')[0];
          const numericId = Math.floor(10000000 + Math.random() * 90000000); // Random 8-digit ID
          await setDoc(doc(db, 'users', user.uid), {
            uid: user.uid,
            numericId,
            name: formData.name || defaultName,
            email: formData.email,
            balance: registrationBonus,
            totalWagered: 0,
            inviteCode: generateInviteCode(),
            invitedBy: invitedBy,
            role: 'user',
            createdAt: new Date().toISOString(),
            isBanned: false
          });

          // Log registration bonus
          await addDoc(collection(db, 'transactions'), {
            userId: user.uid,
            type: 'bonus',
            amount: registrationBonus,
            description: 'Bônus de boas-vindas',
            createdAt: new Date().toISOString()
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
        }

        navigate('/');
      }
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError('Este email já está em uso. Tente fazer login.');
      } else if (err.code === 'auth/weak-password') {
        setError('A senha deve ter pelo menos 6 caracteres.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Email inválido.');
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Email ou senha incorretos.');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!formData.email) {
      setError('Digite seu email para recuperar a senha.');
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, formData.email);
      setMessage('Email de recuperação enviado!');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060b15] flex flex-col items-center justify-end sm:justify-center relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-casino-primary blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-casino-secondary blur-[120px] rounded-full"></div>
      </div>

      {/* Header Logo */}
      <motion.div 
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-md px-6 py-8 flex items-center justify-between relative z-10"
      >
        <div className="flex items-center gap-2">
          <Link to="/" className="text-3xl font-black italic tracking-tighter flex items-center gap-1 group">
            <span className="text-white group-hover:text-casino-primary transition-colors">234</span>
            <span className="text-casino-primary group-hover:text-white transition-colors">VIP</span>
            <span className="text-white group-hover:text-casino-primary transition-colors">.NET</span>
            <motion.div 
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="ml-1 w-8 h-8 bg-casino-primary rounded-lg flex items-center justify-center shadow-lg shadow-casino-primary/40"
            >
              <span className="text-xs">🎰</span>
            </motion.div>
          </Link>
        </div>
        <button 
          onClick={() => navigate('/')}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:bg-white/20 transition-all hover:rotate-90"
        >
          <X size={20} />
        </button>
      </motion.div>

      {/* Auth Card */}
      <motion.div 
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="w-full max-w-md bg-[#101726] rounded-t-[40px] sm:rounded-[40px] p-8 pb-20 sm:pb-8 relative z-10 shadow-2xl border-t border-white/5 overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-casino-primary/10 blur-3xl -z-10 animate-pulse" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-casino-secondary/10 blur-3xl -z-10 animate-pulse" />

        <div className="mb-8">
          <motion.h2 
            key={isLogin ? 'login-title' : 'register-title'}
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="text-2xl font-black text-white mb-1 uppercase italic tracking-tighter"
          >
            {isLogin ? 'Faça login na sua conta' : 'Crie sua conta'}
          </motion.h2>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-white/40 font-medium">
              {isLogin ? 'Não tem uma conta?' : 'Já tem uma conta?'}
            </span>
            <button 
              onClick={() => setIsLogin(!isLogin)}
              className="text-casino-primary font-black uppercase tracking-widest text-xs hover:text-white transition-colors"
            >
              {isLogin ? 'Registro' : 'Entrar'}
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <div className="relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-3 text-white/30 group-focus-within:text-casino-primary transition-colors">
                <Mail size={18} />
              </div>
              <input
                type="email"
                placeholder="Seu melhor e-mail"
                required
                className="w-full bg-[#0a0e17] border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-white/20 focus:outline-none focus:border-casino-primary/50 transition-all"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-casino-primary transition-colors">
                <Key size={18} />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Senha"
                required
                className="w-full bg-[#0a0e17] border border-white/5 rounded-2xl py-4 pl-12 pr-12 text-white placeholder:text-white/20 focus:outline-none focus:border-casino-primary/50 transition-all"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/40 transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {!isLogin && (
            <div className="space-y-1.5">
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-casino-primary transition-colors">
                  <Users size={18} />
                </div>
                <input
                  type="text"
                  placeholder="Código de Convite (Opcional)"
                  className="w-full bg-[#0a0e17] border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-white/20 focus:outline-none focus:border-casino-primary/50 transition-all"
                  value={formData.inviteCode}
                  onChange={(e) => setFormData({ ...formData, inviteCode: e.target.value })}
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between px-1">
            <label className="flex items-center gap-2 cursor-pointer group">
              <div className="relative">
                <input 
                  type="checkbox" 
                  className="sr-only" 
                  checked={rememberMe}
                  onChange={() => setRememberMe(!rememberMe)}
                />
                <div className={cn(
                  "w-5 h-5 rounded border transition-all flex items-center justify-center",
                  rememberMe ? "bg-casino-primary border-casino-primary" : "bg-transparent border-white/20"
                )}>
                  {rememberMe && <CheckCircle2 size={14} className="text-white" />}
                </div>
              </div>
              <span className="text-xs font-medium text-white/40 group-hover:text-white/60 transition-colors">Lembrar Senha</span>
            </label>
            <button 
              type="button"
              onClick={handleResetPassword}
              className="text-xs font-medium text-white/40 hover:text-white/60 transition-colors"
            >
              Esqueceu a senha?
            </button>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-500 text-xs font-bold text-center"
            >
              {error}
            </motion.div>
          )}

          {message && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-green-500 text-xs font-bold text-center"
            >
              {message}
            </motion.div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-casino-primary hover:bg-casino-primary/90 disabled:opacity-50 text-white font-black uppercase tracking-widest py-5 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-casino-primary/20"
          >
            {loading ? <Loader2 className="animate-spin" /> : (
              <>
                {isLogin ? 'Entrar Agora' : 'Criar Minha Conta'}
                <ArrowRight size={20} />
              </>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

export default Auth;
