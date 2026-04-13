import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Users, Copy, Check, Gift, Share2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { formatCurrency } from '../lib/utils';

const Referral: React.FC = () => {
  const { userData, settings } = useAuth();
  const [copied, setCopied] = useState(false);
  const [referrals, setReferrals] = useState<any[]>([]);

  useEffect(() => {
    if (!userData) return;
    const q = query(collection(db, 'users'), where('invitedBy', '==', userData.uid));
    const unsub = onSnapshot(q, (snap) => {
      setReferrals(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error('Error fetching referrals:', error);
    });
    return () => unsub();
  }, [userData]);

  const copyCode = () => {
    if (userData?.inviteCode) {
      navigator.clipboard.writeText(userData.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-8">
      <section className="text-center space-y-4">
        <div className="w-24 h-24 bg-gradient-to-br from-casino-primary to-orange-600 rounded-[32px] flex items-center justify-center mx-auto mb-6 shadow-lg shadow-casino-primary/20">
          <Gift size={48} className="text-white" />
        </div>
        <h2 className="text-4xl font-black italic tracking-tighter uppercase">Convide amigos <br /><span className="text-casino-primary">e ganhe bônus</span></h2>
        <p className="text-white/60 max-w-md mx-auto text-sm">
          Compartilhe seu código e ganhe <span className="text-casino-primary font-black">{formatCurrency(settings?.inviteBonus || 5)}</span> por cada amigo que se cadastrar e começar a jogar!
        </p>
      </section>

      <div className="glass rounded-[40px] p-10 space-y-6 text-center border border-white/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-casino-primary/10 blur-3xl rounded-full -mr-16 -mt-16" />
        <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Seu Código Exclusivo</p>
        <div className="flex flex-col gap-4">
          <div className="px-10 py-6 bg-[#0a0e17] rounded-[24px] border border-white/10 text-4xl font-black tracking-[0.3em] text-casino-accent shadow-inner">
            {userData?.inviteCode || '------'}
          </div>
          <button 
            onClick={copyCode}
            className="w-full py-4 bg-casino-primary text-white rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-casino-primary/90 transition-all active:scale-95 shadow-lg shadow-casino-primary/20"
          >
            {copied ? <><Check size={20} /> Copiado!</> : <><Copy size={20} /> Copiar Código</>}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <Users size={20} className="text-casino-primary" />
          Seus Convidados ({referrals.length})
        </h3>
        
        {referrals.length === 0 ? (
          <div className="glass rounded-3xl p-12 text-center space-y-4">
            <Share2 size={48} className="mx-auto text-white/10" />
            <p className="text-white/30 font-medium">Você ainda não convidou ninguém.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {referrals.map((ref) => (
              <div key={ref.id} className="glass rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-casino-primary/20 flex items-center justify-center font-bold text-casino-primary">
                    {ref.name[0]}
                  </div>
                  <div>
                    <p className="font-bold">{ref.name}</p>
                    <p className="text-[10px] text-white/30 uppercase font-bold">Entrou em {new Date(ref.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-green-500 uppercase">Completado</p>
                  <p className="text-sm font-black text-white/60">+{formatCurrency(settings?.inviteBonus || 5)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Referral;
