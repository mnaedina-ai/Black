import React, { useState, useEffect } from 'react';
import { auth, db } from '../lib/firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { formatCurrency, cn } from '../lib/utils';
import { Trophy, Medal, Star } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';

interface RankingUser {
  id: string;
  name: string;
  numericId: number;
  totalWagered: number;
}

const Ranking: React.FC = () => {
  const { userData } = useAuth();
  const [topUsers, setTopUsers] = useState<RankingUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userData) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'users'),
      orderBy('totalWagered', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const users = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as RankingUser[];
      setTopUsers(users);
      setLoading(false);
    }, (error) => {
      if (auth.currentUser) {
        console.error('Ranking error:', error);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userData]);

  if (loading || !userData) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Trophy className="text-yellow-500" size={20} />
        <h3 className="text-lg font-black italic uppercase tracking-tighter">Top 10 Apostadores</h3>
      </div>

      <div className="glass rounded-3xl overflow-hidden border border-white/5">
        <div className="divide-y divide-white/5">
          {topUsers.map((user, index) => (
            <motion.div
              key={user.id}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
              className={cn(
                "flex items-center justify-between p-4 hover:bg-white/5 transition-colors relative overflow-hidden",
                index === 0 && "bg-red-500/10 border-l-4 border-red-500"
              )}
            >
              {index === 0 && (
                <motion.div 
                  animate={{ opacity: [0.1, 0.3, 0.1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="absolute inset-0 bg-red-500 blur-2xl -z-0 pointer-events-none"
                />
              )}
              <div className="flex items-center gap-4 relative z-10">
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center font-black text-sm relative",
                  index === 0 ? "bg-red-600 text-white shadow-lg shadow-red-600/40 animate-pulse" : 
                  index === 1 ? "bg-gray-300 text-black shadow-lg shadow-gray-300/20" : 
                  index === 2 ? "bg-orange-600 text-white shadow-lg shadow-orange-600/20" : "bg-white/10 text-white/40"
                )}>
                  {index === 0 ? (
                    <div className="relative">
                      <Trophy size={20} className="text-white" />
                      <motion.div 
                        initial={{ y: -10, opacity: 0 }}
                        animate={{ y: -18, opacity: 1 }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                        className="absolute left-1/2 -translate-x-1/2 text-yellow-400 text-xs"
                      >
                        👑
                      </motion.div>
                    </div>
                  ) : index === 1 ? (
                    <div className="relative">
                      <Medal size={18} />
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-xs">🥈</div>
                    </div>
                  ) : index === 2 ? (
                    <div className="relative">
                      <Medal size={18} />
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-xs">🥉</div>
                    </div>
                  ) : index + 1}
                </div>
                <div>
                  <p className={cn(
                    "font-bold text-sm flex items-center gap-2",
                    index === 0 ? "text-red-500 text-base" : "text-white"
                  )}>
                    {user.name}
                    {index === 0 && <Star size={12} className="text-red-500 fill-red-500 animate-spin" />}
                  </p>
                  <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest">ID: {user.numericId || '--------'}</p>
                </div>
              </div>
              <div className="text-right relative z-10">
                <p className={cn(
                  "font-black text-sm",
                  index === 0 ? "text-red-500 text-lg" : "text-casino-primary"
                )}>{formatCurrency(user.totalWagered || 0)}</p>
                <p className="text-[10px] text-white/40 uppercase font-bold">Apostado</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Ranking;
