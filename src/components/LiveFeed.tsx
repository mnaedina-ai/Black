import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, TrendingUp, Wallet, Zap } from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { db } from '../lib/firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';

interface FeedItem {
  id: string;
  name: string;
  action: string;
  amount: number;
}

const LiveFeed: React.FC = () => {
  const [feed, setFeed] = useState<FeedItem[]>([]);

  useEffect(() => {
    // Listen to real transactions for the live feed
    const q = query(
      collection(db, 'transactions'),
      orderBy('createdAt', 'desc'),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => {
        const data = doc.data();
        let action = 'apostou';
        if (data.type === 'win') action = 'ganhou';
        if (data.type === 'withdraw') action = 'sacou';
        if (data.type === 'deposit') action = 'depositou';

        return {
          id: doc.id,
          name: data.userName ? (data.userName.split(' ')[0].charAt(0) + '***' + data.userName.split(' ')[0].slice(-1)) : 'Jogador',
          action,
          amount: data.amount
        };
      });
      
      if (items.length > 0) {
        setFeed(items);
      }
    });

    return () => unsubscribe();
  }, []);

  if (feed.length === 0) {
    return (
      <div className="h-14 flex items-center justify-center">
        <div className="flex items-center gap-2 text-white/20">
          <Zap size={14} />
          <span className="text-[10px] font-black uppercase tracking-[0.3em]">Aguardando Jogadas...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-14 flex items-center justify-center relative overflow-hidden">
      <AnimatePresence mode="wait">
        {feed.map((item) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.9 }}
            transition={{ 
              type: "spring",
              stiffness: 300,
              damping: 20
            }}
            className="absolute flex items-center justify-center w-full"
          >
            <div className="flex items-center gap-3 bg-[#161d2b]/80 px-6 py-2.5 rounded-full border border-casino-primary/30 shadow-[0_0_20px_rgba(251,191,36,0.15)] backdrop-blur-md">
              <div className="w-8 h-8 rounded-full bg-casino-primary/20 flex items-center justify-center border border-casino-primary/30 relative">
                <User size={14} className="text-casino-primary" />
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full border border-[#161d2b] animate-pulse" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1 mb-0.5">
                  <Zap size={10} className="text-casino-primary animate-pulse" />
                  <p className="text-[8px] font-black text-white/40 uppercase tracking-[0.2em] leading-none">Tempo Real</p>
                </div>
                <p className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <span className="text-casino-primary">{item.name}</span>
                  <span className="text-white/60">{item.action}</span>
                  <span className={cn(
                    "font-black italic text-sm",
                    item.action === 'sacou' ? "text-green-500" : 
                    item.action === 'ganhou' ? "text-casino-accent" : "text-casino-primary"
                  )}>
                    {formatCurrency(item.amount)}
                  </span>
                </p>
              </div>
              <div className="ml-2">
                {item.action === 'ganhou' && <TrendingUp size={16} className="text-casino-accent animate-bounce" />}
                {item.action === 'sacou' && <Wallet size={16} className="text-green-500 animate-pulse" />}
                {item.action === 'apostou' && <div className="w-2 h-2 rounded-full bg-casino-primary animate-ping" />}
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default LiveFeed;
