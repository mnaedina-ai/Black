import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Calendar, Hash, Shield, LogOut, Crown, Edit2, Check, X, Loader2 } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { useNavigate } from 'react-router-dom';
import { formatCurrency, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { doc, updateDoc } from 'firebase/firestore';

const Profile: React.FC = () => {
  const { userData, refreshUserData } = useAuth();
  const navigate = useNavigate();
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState(userData?.name || '');
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/auth');
  };

  const handleSaveName = async () => {
    if (!userData || !newName.trim() || newName === userData.name) {
      setIsEditingName(false);
      return;
    }
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', userData.uid), { name: newName });
      await refreshUserData();
      setIsEditingName(false);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!userData) return null;

  return (
    <div className="space-y-8">
      <section className="text-center relative">
        <div className="relative inline-block">
          <motion.div 
            animate={{ 
              rotate: [0, -5, 5, 0],
              scale: [1, 1.05, 1]
            }}
            transition={{ repeat: Infinity, duration: 4 }}
            className="w-24 h-24 bg-gradient-to-br from-casino-primary to-casino-secondary rounded-[40px] flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-casino-primary/20 relative z-10"
          >
            <User size={48} className="text-white" />
          </motion.div>
          <motion.div
            animate={{ 
              y: [-5, 5, -5],
              rotate: [-10, 10, -10]
            }}
            transition={{ repeat: Infinity, duration: 3 }}
            className="absolute -top-6 left-1/2 -translate-x-1/2 z-20 text-yellow-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.8)]"
          >
            <Crown size={40} fill="currentColor" />
          </motion.div>
        </div>

        <div className="flex items-center justify-center gap-2">
          {isEditingName ? (
            <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
              <input 
                type="text" 
                className="bg-transparent border-none outline-none px-3 py-1 text-xl font-black italic uppercase tracking-tighter w-48"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                autoFocus
              />
              <button onClick={handleSaveName} disabled={loading} className="p-2 bg-green-500 text-white rounded-lg">
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              </button>
              <button onClick={() => setIsEditingName(false)} className="p-2 bg-white/10 text-white/40 rounded-lg">
                <X size={16} />
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-3xl font-black italic tracking-tighter uppercase">{userData.name}</h2>
              <button onClick={() => setIsEditingName(true)} className="p-2 text-white/20 hover:text-casino-primary transition-colors">
                <Edit2 size={18} />
              </button>
            </>
          )}
        </div>
        <p className="text-white/40 font-bold uppercase tracking-widest text-xs mt-1">
          {userData.role === 'admin' ? 'Administrador Supremo' : 'Jogador Royale'}
        </p>
        <p className="text-[10px] text-casino-primary font-black uppercase tracking-[0.3em] mt-2">ID: {userData.numericId || '---'}</p>
      </section>

      <div className="grid gap-4">
        <div className="glass rounded-3xl p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-white/40">
            <Mail size={24} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Email</p>
            <p className="font-bold">{userData.email}</p>
          </div>
        </div>

        <div className="glass rounded-3xl p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-white/40">
            <Hash size={24} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Código de Convite</p>
            <p className="font-bold text-casino-accent">{userData.inviteCode}</p>
          </div>
        </div>

        <div className="glass rounded-3xl p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-white/40">
            <Calendar size={24} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Membro desde</p>
            <p className="font-bold">{new Date(userData.createdAt).toLocaleDateString()}</p>
          </div>
        </div>

        <div className="glass rounded-3xl p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-white/40">
            <Shield size={24} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Status da Conta</p>
            <p className="font-bold text-green-500">Ativa e Verificada</p>
          </div>
        </div>
      </div>

      <button 
        onClick={handleLogout}
        className="w-full py-4 rounded-2xl bg-red-500/10 text-red-500 font-bold flex items-center justify-center gap-2 hover:bg-red-500/20 transition-all"
      >
        <LogOut size={20} />
        Encerrar Sessão
      </button>

      <p className="text-center text-[10px] text-white/20 font-bold uppercase tracking-[0.2em]">
        Casino Royale v1.0.0
      </p>
    </div>
  );
};

export default Profile;
