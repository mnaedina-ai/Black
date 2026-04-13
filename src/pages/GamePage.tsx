import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Coins, Trophy, XCircle, Loader2, Zap, Timer, History, Volume2, VolumeX, Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { doc, updateDoc, increment, addDoc, collection, onSnapshot, getDoc, setDoc, serverTimestamp, limit, deleteDoc } from 'firebase/firestore';
import { formatCurrency, cn } from '../lib/utils';

// --- GAMES ---

const DoubleGame = ({ onResult, balance, user }: { onResult: (win: boolean, multiplier: number, bet: number, skipBalance?: boolean) => void, balance: number, user: any }) => {
  const [gameState, setGameState] = useState<any>(null);
  const [localTimer, setLocalTimer] = useState(0);
  const [myBet, setMyBet] = useState<{ amount: number, color: 'red' | 'black' | 'white' } | null>(null);
  const [betAmount, setBetAmount] = useState(1);
  const [history, setHistory] = useState<any[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [lastProcessedSpin, setLastProcessedSpin] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const [winColor, setWinColor] = useState<'red' | 'black' | 'white' | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [processingBet, setProcessingBet] = useState(false);
  const rouletteRef = React.useRef<HTMLDivElement>(null);
  const bgMusicRef = React.useRef<HTMLAudioElement | null>(null);

  // 0 = White, Odd = Red, Even = Black
  const numbers = [0, 11, 5, 10, 6, 9, 7, 8, 1, 14, 2, 13, 3, 12, 4];

  // Persist bet across refreshes
  useEffect(() => {
    const savedBet = localStorage.getItem('double_bet');
    if (savedBet && gameState?.status === 'betting') {
      const bet = JSON.parse(savedBet);
      // Only restore if it's for the current round (approximate check)
      const betTime = new Date(bet.timestamp).getTime();
      if (Date.now() - betTime < 15000) {
        setMyBet(bet);
      } else {
        localStorage.removeItem('double_bet');
      }
    }
  }, [gameState?.status]);

  useEffect(() => {
    if (myBet) {
      localStorage.setItem('double_bet', JSON.stringify({ ...myBet, timestamp: new Date().toISOString() }));
    } else {
      localStorage.removeItem('double_bet');
    }
  }, [myBet]);

  useEffect(() => {
    // Background music setup
    bgMusicRef.current = new Audio('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'); // Better background music
    bgMusicRef.current.loop = true;
    bgMusicRef.current.volume = 0.05;
    
    return () => {
      bgMusicRef.current?.pause();
    };
  }, []);

  useEffect(() => {
    if (bgMusicRef.current) {
      if (!isMuted) {
        bgMusicRef.current.play().catch(() => {});
      } else {
        bgMusicRef.current.pause();
      }
    }
  }, [isMuted]);
  const getColor = (n: number) => {
    if (n === 0) return 'white';
    return n % 2 !== 0 ? 'red' : 'black';
  };

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'games', 'double'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setGameState(data);
        setHistory(data.history || []);
        
        // Trigger spin only if it's a new spin event
        const spinId = data.updatedAt?.seconds?.toString() || data.nextPhaseTime;
        if (data.status === 'spinning' && lastProcessedSpin !== spinId) {
          setLastProcessedSpin(spinId);
          startSpin(data.lastResult);
        }

        // If we are in betting phase, reset local states
        if (data.status === 'betting') {
          setSpinning(false);
          setMyBet(null);
          setWinColor(null);
        }
      } else {
        setDoc(doc(db, 'games', 'double'), {
          status: 'betting',
          timer: 10,
          history: [],
          nextPhaseTime: new Date(Date.now() + 10000).toISOString(),
          updatedAt: serverTimestamp()
        });
      }
    });
    return () => unsub();
  }, [spinning, lastProcessedSpin]);

  useEffect(() => {
    if (!gameState) return;
    const interval = setInterval(() => {
      const now = Date.now();
      const nextPhase = new Date(gameState.nextPhaseTime).getTime();
      
      if (isNaN(nextPhase)) {
        setLocalTimer(0);
        return;
      }

      const diff = Math.max(0, (nextPhase - now) / 1000);
      setLocalTimer(diff);
      
      // Only the "active" tab should handle phase transitions
      if (diff <= 0.1 && document.visibilityState === 'visible') {
        handlePhaseChange();
      }

      // If stuck in spinning phase for too long (e.g. 10s), force reset
      if (gameState.status === 'spinning' && now > nextPhase + 8000 && document.visibilityState === 'visible') {
        handlePhaseChange(true);
      }
    }, 100); // Update every 100ms for sub-second precision
    return () => clearInterval(interval);
  }, [gameState, spinning]);

  const handlePhaseChange = async (force = false) => {
    if (!gameState || (spinning && !force)) return;
    
    // Reduced delay for faster transition
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 500));
    
    const snap = await getDoc(doc(db, 'games', 'double'));
    const current = snap.data();
    if (!current) return;

    const now = Date.now();
    const nextPhase = new Date(current.nextPhaseTime).getTime();
    
    // Only update if the phase has actually ended
    if (now < nextPhase - 100) return; // Reduced buffer

    // Check if someone else updated it very recently
    if (current.updatedAt) {
      const lastUpdate = current.updatedAt.toDate().getTime();
      if (now - lastUpdate < 1000) return;
    }

    try {
      if (current.status === 'betting') {
        const result = Math.floor(Math.random() * 15);
        await updateDoc(doc(db, 'games', 'double'), {
          status: 'spinning',
          lastResult: result,
          nextPhaseTime: new Date(Date.now() + 5000).toISOString(), // 5s for spin
          updatedAt: serverTimestamp()
        });
      } else if (current.status === 'spinning') {
        await updateDoc(doc(db, 'games', 'double'), {
          status: 'result',
          nextPhaseTime: new Date(Date.now() + 2000).toISOString(), // 2s for result display
          updatedAt: serverTimestamp()
        });
      } else {
        const newHistory = [{ val: current.lastResult, color: getColor(current.lastResult) }, ...(current.history || [])].slice(0, 10);
        await updateDoc(doc(db, 'games', 'double'), {
          status: 'betting',
          history: newHistory,
          nextPhaseTime: new Date(Date.now() + 6000).toISOString(), // 6s for betting
          updatedAt: serverTimestamp()
        });
        setMyBet(null);
        setWinColor(null);
      }
    } catch (err) {
      console.error('Phase change error:', err);
    }
  };

  // Process pending bets from Firestore
  useEffect(() => {
    if (!user || !gameState) return;
    
    const checkBets = async () => {
      if (processingBet) return;
      
      const betRef = doc(db, 'games', 'double', 'bets', user.uid);
      const betSnap = await getDoc(betRef);
      
      if (betSnap.exists()) {
        const betData = betSnap.data();
        const now = Date.now();
        const roundTime = new Date(betData.roundId).getTime();
        
        // If the round has passed (game is in result or next betting phase)
        if (gameState.status === 'result' || gameState.status === 'betting' || now > roundTime + 8000) {
          setProcessingBet(true);
          try {
            // Check if we have a result
            if (gameState.lastResult !== undefined) {
              const resultColor = getColor(gameState.lastResult);
              if (betData.color === resultColor) {
                const multiplier = resultColor === 'white' ? 14 : 2;
                // Add win amount (bet * multiplier)
                await updateDoc(doc(db, 'users', user.uid), {
                  balance: increment(betData.amount * multiplier)
                });
              }
              await deleteDoc(betRef);
            }
          } catch (err) {
            console.error('Error processing persistent bet:', err);
          } finally {
            setProcessingBet(false);
          }
        }
      }
    };

    checkBets();
  }, [user, gameState?.status, gameState?.lastResult]);

  // Remove localStorage logic as we now use Firestore
  useEffect(() => {
    localStorage.removeItem('double_bet');
  }, []);

  const startSpin = (result: number) => {
    if (spinning) return;
    setSpinning(true);
    
    // Sound effects
    const playSound = (url: string, volume = 0.4) => {
      if (isMuted) return;
      const audio = new Audio(url);
      audio.volume = volume;
      audio.play().catch(() => {});
    };

    playSound('https://assets.mixkit.co/active_storage/sfx/2012/2012-preview.mp3');
    
    const itemWidth = 88; // Corrected: 80px width + 8px margins
    const index = numbers.indexOf(result);
    const totalItems = numbers.length;
    
    // Reset rotation to a safe starting point without animation
    const currentPos = Math.abs(rotation);
    const basePos = currentPos % (totalItems * itemWidth);
    setRotation(-basePos);

    setTimeout(() => {
      const fullSpins = 15; // More spins to ensure we are deep in the array
      const targetPos = (fullSpins * totalItems + index) * itemWidth;
      const offset = Math.floor(Math.random() * (itemWidth - 20)) + 10;
      const finalPos = targetPos + offset - (rouletteRef.current?.clientWidth || 0) / 2 + itemWidth / 2;

      setRotation(-finalPos);
      setWinColor(null);

      setTimeout(() => {
        setSpinning(false);
        const resultColor = getColor(result);
        setWinColor(resultColor);
        
        if (myBet) {
          if (myBet.color === resultColor) {
            const multiplier = resultColor === 'white' ? 14 : 2;
            // UI only result, balance handled by useEffect
            onResult(true, multiplier, myBet.amount, true);
            playSound('https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3', 0.6);
          } else {
            onResult(false, 0, 0, true); 
          }
        }
      }, 4000); // Normal spin animation (4s)
    }, 50);
  };

  const placeBet = async (color: 'red' | 'black' | 'white') => {
    if (!user || gameState?.status !== 'betting' || myBet || balance < betAmount || betAmount <= 0) return;
    
    const betInfo = { 
      amount: betAmount, 
      color, 
      roundId: gameState.nextPhaseTime,
      userId: user.uid,
      createdAt: serverTimestamp()
    };
    
    setMyBet(betInfo as any);
    
    try {
      // Save bet to Firestore
      await setDoc(doc(db, 'games', 'double', 'bets', user.uid), betInfo);
      // Deduct balance immediately
      onResult(false, 0, betAmount);
    } catch (err) {
      console.error('Error placing bet:', err);
      setMyBet(null);
    }
  };

  const extendedNumbers = Array(30).fill(numbers).flat();

  return (
    <div className="space-y-8 w-full max-w-4xl mx-auto">
      <div className="flex items-center justify-between glass p-4 rounded-2xl border-white/5">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 glass rounded-xl text-white/40 hover:text-white transition-all"
          >
            {isMuted ? <VolumeX size={18} className="opacity-20" /> : <Volume2 size={18} className="text-casino-primary" />}
          </button>
          <div className={cn(
            "w-3 h-3 rounded-full animate-pulse",
            gameState?.status === 'betting' ? "bg-green-500" : 
            gameState?.status === 'spinning' ? "bg-yellow-500" : "bg-blue-500"
          )} />
          <span className="text-xs font-black uppercase tracking-widest text-white/60">
            {gameState?.status === 'betting' ? 'Apostando' : 
             gameState?.status === 'spinning' ? 'Girando' : 'Resultado'}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">Próxima Rodada</p>
            <p className="text-casino-primary font-black text-xl tabular-nums">{gameState ? `${localTimer.toFixed(1)}s` : '--'}</p>
          </div>
          <div className="w-12 h-12 rounded-xl glass flex items-center justify-center text-casino-primary border border-white/10">
            <Timer size={24} className={cn(localTimer <= 3 && localTimer > 0 && gameState?.status === 'betting' && "animate-bounce text-red-500")} />
          </div>
        </div>
      </div>

      {gameState?.status === 'betting' && (
        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: '100%' }}
            animate={{ width: `${(localTimer / 6) * 100}%` }}
            transition={{ duration: 0.1, ease: "linear" }}
            className="h-full bg-casino-primary shadow-[0_0_10px_rgba(139,92,246,0.5)]"
          />
        </div>
      )}

      <div className="relative h-32 glass rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
        <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-casino-primary z-20 shadow-[0_0_15px_rgba(139,92,246,0.8)]" />
        <div className="absolute left-1/2 top-0 -translate-x-1/2 z-20 w-4 h-4 bg-casino-primary rotate-45 -translate-y-1/2" />
        <div className="absolute left-1/2 bottom-0 -translate-x-1/2 z-20 w-4 h-4 bg-casino-primary rotate-45 translate-y-1/2" />

        <motion.div 
          ref={rouletteRef}
          animate={{ x: rotation }}
          transition={spinning ? { duration: 4, ease: [0.12, 0, 0.39, 0] } : { duration: 0 }}
          className="flex h-full items-center"
          style={{ width: 'fit-content' }}
        >
          {extendedNumbers.map((n, i) => (
            <div 
              key={i} 
              className={cn(
                "flex-shrink-0 w-20 h-20 mx-1 rounded-xl flex items-center justify-center text-2xl font-black shadow-lg transition-transform",
                n === 0 ? "bg-white text-black" : 
                n % 2 !== 0 ? "bg-red-500 text-white" : "bg-[#1a1a1a] text-white border border-white/5"
              )}
            >
              {n}
            </div>
          ))}
        </motion.div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
        <History size={14} className="text-white/20 flex-shrink-0" />
        {history.map((h, i) => (
          <div 
            key={i} 
            className={cn(
              "w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-black",
              h.color === 'white' ? "bg-white text-black" : 
              h.color === 'red' ? "bg-red-500 text-white" : "bg-[#1a1a1a] text-white border border-white/10"
            )}
          >
            {h.val}
          </div>
        ))}
      </div>

      <div className="space-y-6">
        <div className="w-full max-w-xs mx-auto space-y-2">
          <label className="text-xs font-bold text-white/40 uppercase tracking-widest text-center block">Valor da Aposta</label>
          <div className="flex gap-2">
            {[1, 5, 10, balance].map(amt => (
              <button
                key={amt}
                onClick={() => setBetAmount(prev => amt === balance ? balance : Math.min(balance, prev + amt))}
                disabled={!!myBet}
                className={cn(
                  "flex-1 py-3 rounded-xl font-black transition-all active:scale-90 text-[10px]",
                  (amt !== balance && betAmount === amt) ? "bg-casino-primary text-white shadow-lg shadow-casino-primary/20" : "glass text-white/40 hover:bg-white/10",
                  myBet && "opacity-50 cursor-not-allowed"
                )}
              >
                {amt === balance ? 'ALL IN' : `+${amt}`}
              </button>
            ))}
          </div>
          <input
            type="number"
            value={betAmount}
            onChange={(e) => setBetAmount(Number(e.target.value))}
            disabled={!!myBet}
            className="input-field text-center font-black text-2xl text-casino-primary"
            min={1}
            max={balance}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <button 
            onClick={() => placeBet('red')}
            disabled={gameState?.status !== 'betting' || !!myBet || balance < betAmount}
            className={cn(
              "flex flex-col items-center gap-2 p-6 rounded-3xl transition-all relative overflow-hidden group",
              "bg-red-500 text-white shadow-xl shadow-red-500/20",
              (gameState?.status !== 'betting' || myBet || balance < betAmount) && "opacity-50 grayscale cursor-not-allowed",
              winColor === 'red' && "ring-4 ring-white ring-offset-4 ring-offset-[#0a0e17] animate-glow"
            )}
          >
            <span className="text-2xl font-black">2x</span>
            <span className="text-[10px] font-bold uppercase tracking-widest">Vermelho</span>
            {myBet?.color === 'red' && (
              <div className="absolute inset-0 bg-white/20 flex items-center justify-center backdrop-blur-sm">
                <span className="font-black text-xs">APOSTADO: {formatCurrency(myBet.amount)}</span>
              </div>
            )}
          </button>

          <button 
            onClick={() => placeBet('white')}
            disabled={gameState?.status !== 'betting' || !!myBet || balance < betAmount}
            className={cn(
              "flex flex-col items-center gap-2 p-6 rounded-3xl transition-all relative overflow-hidden",
              "bg-white text-black shadow-xl shadow-white/20",
              (gameState?.status !== 'betting' || myBet || balance < betAmount) && "opacity-50 grayscale cursor-not-allowed",
              winColor === 'white' && "ring-4 ring-casino-primary ring-offset-4 ring-offset-[#0a0e17] animate-glow"
            )}
          >
            <span className="text-2xl font-black">14x</span>
            <span className="text-[10px] font-bold uppercase tracking-widest">Branco</span>
            {myBet?.color === 'white' && (
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center backdrop-blur-sm">
                <span className="font-black text-xs">APOSTADO: {formatCurrency(myBet.amount)}</span>
              </div>
            )}
          </button>

          <button 
            onClick={() => placeBet('black')}
            disabled={gameState?.status !== 'betting' || !!myBet || balance < betAmount}
            className={cn(
              "flex flex-col items-center gap-2 p-6 rounded-3xl transition-all relative overflow-hidden",
              "bg-[#1a1a1a] text-white border border-white/10 shadow-xl",
              (gameState?.status !== 'betting' || myBet || balance < betAmount) && "opacity-50 grayscale cursor-not-allowed",
              winColor === 'black' && "ring-4 ring-white ring-offset-4 ring-offset-[#0a0e17] animate-glow"
            )}
          >
            <span className="text-2xl font-black">2x</span>
            <span className="text-[10px] font-bold uppercase tracking-widest">Preto</span>
            {myBet?.color === 'black' && (
              <div className="absolute inset-0 bg-white/10 flex items-center justify-center backdrop-blur-sm">
                <span className="font-black text-xs">APOSTADO: {formatCurrency(myBet.amount)}</span>
              </div>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

const SlotGame = ({ bet, onResult, balance }: { bet: number, onResult: (win: boolean, multiplier: number) => void, balance: number }) => {
  const symbols = ['🍒', '🍋', '🔔', '💎', '7️⃣'];
  const [spinning, setSpinning] = useState(false);
  const [reels, setReels] = useState(['7️⃣', '7️⃣', '7️⃣']);
  const intervalRef = React.useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const spin = () => {
    if (spinning || balance < bet) return;
    setSpinning(true);
    
    if (window.navigator.vibrate) window.navigator.vibrate(50);
    
    // Rapidly change symbols
    intervalRef.current = setInterval(() => {
      setReels([
        symbols[Math.floor(Math.random() * symbols.length)],
        symbols[Math.floor(Math.random() * symbols.length)],
        symbols[Math.floor(Math.random() * symbols.length)],
      ]);
    }, 80);

    setTimeout(() => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      const newReels = [
        symbols[Math.floor(Math.random() * symbols.length)],
        symbols[Math.floor(Math.random() * symbols.length)],
        symbols[Math.floor(Math.random() * symbols.length)],
      ];
      
      setReels(newReels);
      setSpinning(false);

      // Determine result
      if (newReels[0] === newReels[1] && newReels[1] === newReels[2]) {
        onResult(true, 10);
      } else if (newReels[0] === newReels[1] || newReels[1] === newReels[2] || newReels[0] === newReels[2]) {
        onResult(true, 2);
      } else {
        onResult(false, 0);
      }
    }, 2000);
  };

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="flex gap-3 sm:gap-4">
        {reels.map((symbol, i) => (
          <div key={i} className="w-20 h-28 sm:w-24 sm:h-32 glass rounded-2xl flex items-center justify-center text-4xl sm:text-5xl relative overflow-hidden shadow-inner border border-white/5">
            <AnimatePresence mode="popLayout">
              <motion.div
                key={spinning ? `spin-${i}-${reels[i]}` : symbol}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -20, opacity: 0 }}
                transition={{ duration: spinning ? 0.05 : 0.3 }}
                className={cn(
                  "flex items-center justify-center",
                  spinning && "blur-[2px]"
                )}
              >
                {symbol}
              </motion.div>
            </AnimatePresence>
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/60 pointer-events-none" />
          </div>
        ))}
      </div>
      <button 
        onClick={spin} 
        disabled={spinning || balance < bet} 
        className={cn(
          "btn-primary w-full max-w-xs animate-glow py-4 text-lg font-black uppercase tracking-widest shadow-xl shadow-casino-primary/20",
          balance < bet && "opacity-50 cursor-not-allowed grayscale"
        )}
      >
        {spinning ? (
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="animate-spin" size={20} />
            Girando...
          </div>
        ) : balance < bet ? 'Saldo Insuficiente' : 'Girar Agora'}
      </button>
    </div>
  );
};

const GuessGame = ({ bet, onResult, balance }: { bet: number, onResult: (win: boolean, multiplier: number) => void, balance: number }) => {
  const [guess, setGuess] = useState<number | null>(null);
  const [target, setTarget] = useState<number | null>(null);

  const play = (num: number) => {
    if (balance < bet) return;
    const t = Math.floor(Math.random() * 10) + 1;
    setTarget(t);
    setGuess(num);
    setTimeout(() => {
      if (num === t) onResult(true, 8);
      else onResult(false, 0);
      setGuess(null);
      setTarget(null);
    }, 1000);
  };

  return (
    <div className="grid grid-cols-5 gap-3 max-w-md mx-auto">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
        <button
          key={n}
          onClick={() => play(n)}
          disabled={balance < bet}
          className={cn(
            "h-16 rounded-xl font-bold text-xl transition-all",
            guess === n ? (n === target ? 'bg-green-500' : 'bg-red-500') : 'glass hover:bg-white/10',
            balance < bet && "opacity-50 cursor-not-allowed"
          )}
        >
          {n}
        </button>
      ))}
    </div>
  );
};

const DiceGame = ({ bet, onResult, balance }: { bet: number, onResult: (win: boolean, multiplier: number) => void, balance: number }) => {
  const [rolling, setRolling] = useState(false);
  const [value, setValue] = useState(1);

  const roll = (isHigh: boolean) => {
    if (rolling || balance < bet) return;
    setRolling(true);
    setTimeout(() => {
      const v = Math.floor(Math.random() * 6) + 1;
      setValue(v);
      setRolling(false);
      if ((isHigh && v > 3) || (!isHigh && v <= 3)) onResult(true, 1.9);
      else onResult(false, 0);
    }, 1000);
  };

  return (
    <div className="flex flex-col items-center gap-8">
      <motion.div
        animate={rolling ? { rotate: [0, 90, 180, 270, 360], scale: [1, 1.2, 1] } : {}}
        transition={{ repeat: rolling ? Infinity : 0, duration: 0.4 }}
        className="w-32 h-32 bg-white rounded-3xl flex items-center justify-center text-6xl text-black shadow-2xl"
      >
        {value}
      </motion.div>
      <div className="flex gap-4 w-full max-w-xs">
        <button onClick={() => roll(false)} disabled={rolling || balance < bet} className={cn("btn-secondary flex-1", balance < bet && "opacity-50 cursor-not-allowed")}>1-3 (Baixo)</button>
        <button onClick={() => roll(true)} disabled={rolling || balance < bet} className={cn("btn-primary flex-1", balance < bet && "opacity-50 cursor-not-allowed")}>4-6 (Alto)</button>
      </div>
    </div>
  );
};

const CoinGame = ({ bet, onResult, balance }: { bet: number, onResult: (win: boolean, multiplier: number) => void, balance: number }) => {
  const [flipping, setFlipping] = useState(false);
  const [side, setSide] = useState<'cara' | 'coroa'>('cara');

  const flip = (choice: 'cara' | 'coroa') => {
    if (flipping || balance < bet) return;
    setFlipping(true);
    setTimeout(() => {
      const result = Math.random() > 0.5 ? 'cara' : 'coroa';
      setSide(result);
      setFlipping(false);
      if (choice === result) onResult(true, 1.9);
      else onResult(false, 0);
    }, 1000);
  };

  return (
    <div className="flex flex-col items-center gap-8">
      <motion.div
        animate={flipping ? { rotateY: [0, 720], scale: [1, 1.5, 1] } : {}}
        transition={{ duration: 1 }}
        className="w-32 h-32 bg-casino-accent rounded-full flex items-center justify-center text-4xl font-black text-black shadow-2xl border-4 border-yellow-600"
      >
        {side === 'cara' ? '🪙' : '👑'}
      </motion.div>
      <div className="flex gap-4 w-full max-w-xs">
        <button onClick={() => flip('cara')} disabled={flipping || balance < bet} className={cn("btn-secondary flex-1", balance < bet && "opacity-50 cursor-not-allowed")}>Cara</button>
        <button onClick={() => flip('coroa')} disabled={flipping || balance < bet} className={cn("btn-primary flex-1", balance < bet && "opacity-50 cursor-not-allowed")}>Coroa</button>
      </div>
    </div>
  );
};

const WheelGame = ({ bet, onResult, balance }: { bet: number, onResult: (win: boolean, multiplier: number) => void, balance: number }) => {
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);

  const spin = () => {
    if (spinning || balance < bet) return;
    setSpinning(true);
    const extra = 1800 + Math.random() * 360;
    setRotation(prev => prev + extra);
    
    setTimeout(() => {
      setSpinning(false);
      const finalAngle = (rotation + extra) % 360;
      // Simple logic: 0-90 (0x), 90-180 (2x), 180-270 (0x), 270-360 (5x)
      if (finalAngle > 90 && finalAngle <= 180) onResult(true, 2);
      else if (finalAngle > 270 && finalAngle <= 360) onResult(true, 5);
      else onResult(false, 0);
    }, 3000);
  };

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="relative">
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10 w-4 h-8 bg-red-500 rounded-full shadow-lg" />
        <motion.div
          animate={{ rotate: rotation }}
          transition={{ duration: 3, ease: "easeOut" }}
          className="w-64 h-64 rounded-full border-8 border-white/10 relative overflow-hidden"
          style={{ background: 'conic-gradient(#8b5cf6 0deg 90deg, #16161e 90deg 180deg, #ec4899 180deg 270deg, #16161e 270deg 360deg)' }}
        >
          <div className="absolute inset-0 flex items-center justify-center font-bold text-xs">
            <span className="absolute top-12">0x</span>
            <span className="absolute right-12">2x</span>
            <span className="absolute bottom-12">0x</span>
            <span className="absolute left-12">5x</span>
          </div>
        </motion.div>
      </div>
      <button onClick={spin} disabled={spinning || balance < bet} className={cn("btn-primary w-full max-w-xs", balance < bet && "opacity-50 cursor-not-allowed")}>
        {balance < bet ? 'Saldo Insuficiente' : 'Girar Roda'}
      </button>
    </div>
  );
};

// --- MAIN PAGE ---

const GamePage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userData, settings, loading, refreshUserData, isAdmin } = useAuth();
  const [betAmount, setBetAmount] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [result, setResult] = useState<{ win: boolean, amount: number } | null>(null);

  const [showNoBalance, setShowNoBalance] = useState(false);
  const [showAchievement, setShowAchievement] = useState(false);
  const [showWithdrawRequirement, setShowWithdrawRequirement] = useState(false);

  const handleGameResult = async (win: boolean, multiplier: number, customBet?: number, skipDeduction = false) => {
    if (!userData) return;
    
    const actualBet = customBet || betAmount;

    // If we are not skipping deduction, check balance
    if (!skipDeduction && userData.balance < actualBet) {
      setShowNoBalance(true);
      return;
    }

    const winAmount = win ? actualBet * multiplier : 0;
    // If skipDeduction is true, netChange is just the winAmount (since bet was already removed)
    const netChange = skipDeduction ? winAmount : (winAmount - actualBet);

    try {
      if (netChange !== 0) {
        await updateDoc(doc(db, 'users', userData.uid), {
          balance: increment(netChange),
          totalWagered: increment(skipDeduction ? 0 : actualBet) // Wagered already counted if pre-deducted? 
          // Actually, let's count wagered here if skipDeduction is false, 
          // but for Double we should count it when placing the bet.
        });
      }

      if (skipDeduction && actualBet > 0) {
        // For Double, we count wagered here if it wasn't counted at placeBet
        await updateDoc(doc(db, 'users', userData.uid), {
          totalWagered: increment(actualBet)
        });
      }

      const newBalance = userData.balance + netChange;
      // Check for 100 BRL achievement
      if (newBalance >= 100 && userData.balance < 100) {
        setShowAchievement(true);
      }

      await addDoc(collection(db, 'transactions'), {
        userId: userData.uid,
        userName: userData.name,
        type: win ? 'win' : 'loss',
        amount: win ? winAmount : actualBet,
        description: `Jogo: ${id}`,
        createdAt: new Date().toISOString()
      });

      setResult({ win, amount: winAmount });
      refreshUserData();
    } catch (err) {
      console.error(err);
    }
  };

  const renderGame = () => {
    if (currentGame?.isMaintenance && !isAdmin) {
      return (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-6 py-12 glass rounded-[40px] border-casino-primary/20 bg-casino-primary/5"
        >
          <div className="relative">
            <Settings size={80} className="mx-auto text-casino-primary animate-spin-slow" />
            <motion.div 
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="absolute inset-0 bg-casino-primary blur-2xl rounded-full -z-10"
            />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase">Jogo em Manutenção!</h3>
            <p className="text-white/40 font-bold uppercase tracking-widest text-xs">Estamos trabalhando para melhorar sua experiência. Volte em breve!</p>
          </div>
          <button 
            onClick={() => navigate('/')} 
            className="btn-primary px-12 py-4 text-lg shadow-lg shadow-casino-primary/40"
          >
            Voltar para o Início
          </button>
        </motion.div>
      );
    }

    const props = { bet: betAmount, onResult: handleGameResult, balance: userData?.balance || 0, user: userData };
    if (userData && userData.balance < 1) {
      return (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-6 py-12 glass rounded-[40px] border-red-500/20 bg-red-500/5"
        >
          <div className="relative">
            <XCircle size={80} className="mx-auto text-red-500 animate-pulse" />
            <motion.div 
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="absolute inset-0 bg-red-500 blur-2xl rounded-full -z-10"
            />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase">Você está sem saldo!</h3>
            <p className="text-white/40 font-bold uppercase tracking-widest text-xs">Faça um depósito para continuar jogando</p>
          </div>
          <button 
            onClick={() => navigate('/wallet')} 
            className="btn-primary px-12 py-4 text-lg shadow-lg shadow-casino-primary/40 animate-bounce-subtle"
          >
            Fazer Depósito Agora
          </button>
        </motion.div>
      );
    }
    switch (id) {
      case 'slot': return <SlotGame {...props} />;
      case 'guess': return <GuessGame {...props} />;
      case 'dice': return <DiceGame {...props} />;
      case 'coin': return <CoinGame {...props} />;
      case 'wheel': return <WheelGame {...props} />;
      case 'double': return <DoubleGame {...props} />;
      default: return <div>Jogo não encontrado</div>;
    }
  };

  const currentGame = settings?.games?.find(g => g.id === id);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="animate-spin text-casino-primary" size={40} />
        <p className="text-white/40 font-bold uppercase tracking-widest text-xs">Carregando Jogo...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <button onClick={() => navigate('/')} className="flex items-center gap-2 text-white/50 hover:text-white transition-colors font-bold uppercase tracking-wider text-xs">
        <ArrowLeft size={16} /> Voltar
      </button>

      <div className="glass rounded-3xl p-8 text-center relative overflow-hidden">
        <div className="flex flex-col items-center gap-6">
          <h2 className="text-3xl font-black uppercase italic tracking-tighter">
            {currentGame?.name || id?.toUpperCase()}
          </h2>

          {id !== 'double' && (
            <div className="w-full max-w-xs space-y-2">
              <label className="text-xs font-bold text-white/40 uppercase tracking-widest">Valor da Aposta</label>
              <div className="flex gap-2">
                {[1, 5, 10, 50].map(amt => (
                  <button
                    key={amt}
                    onClick={() => setBetAmount(amt)}
                    className={cn(
                      "flex-1 py-3 rounded-xl font-black transition-all active:scale-90",
                      betAmount === amt ? "bg-casino-primary text-white shadow-lg shadow-casino-primary/20" : "glass text-white/40 hover:bg-white/10"
                    )}
                  >
                    {amt}
                  </button>
                ))}
              </div>
              <input
                type="number"
                value={betAmount}
                onChange={(e) => setBetAmount(Number(e.target.value))}
                className="input-field text-center font-black text-2xl text-casino-primary"
                min={1}
                max={userData?.balance || 0}
              />
            </div>
          )}

          <div className="w-full py-12">
            {renderGame()}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <div className="glass p-12 rounded-[40px] text-center max-w-sm w-full relative overflow-hidden">
              <div className={`absolute inset-0 opacity-20 blur-3xl -z-10 ${result.win ? 'bg-green-500' : 'bg-red-500'}`} />
              
              <div className={`w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center ${result.win ? 'bg-green-500 shadow-lg shadow-green-500/50' : 'bg-red-500 shadow-lg shadow-red-500/50'}`}>
                {result.win ? <Trophy size={48} className="text-white" /> : <XCircle size={48} className="text-white" />}
              </div>

              <h3 className="text-4xl font-black mb-2 italic tracking-tighter">
                {result.win ? 'VOCÊ GANHOU!' : 'NÃO FOI DESSA VEZ'}
              </h3>
              <p className="text-xl font-bold text-white/60 mb-8">
                {result.win ? `+ ${formatCurrency(result.amount)}` : `- ${formatCurrency(betAmount)}`}
              </p>

              <button onClick={() => setResult(null)} className="btn-primary w-full">
                Continuar Jogando
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showNoBalance && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          >
            <div className="glass p-10 rounded-[40px] text-center max-w-sm w-full border border-red-500/20 relative overflow-hidden">
              <motion.div 
                animate={{ scale: [1, 1.5, 1], opacity: [0.1, 0.3, 0.1] }}
                transition={{ repeat: Infinity, duration: 3 }}
                className="absolute inset-0 bg-red-500 blur-3xl -z-10"
              />
              <div className="w-20 h-20 bg-red-500/20 rounded-full mx-auto mb-6 flex items-center justify-center text-red-500 shadow-lg shadow-red-500/20">
                <Coins size={40} className="animate-bounce" />
              </div>
              <h3 className="text-2xl font-black mb-2 uppercase italic tracking-tighter">
                {userData && userData.balance < 1 ? 'VOCÊ ESTÁ SEM SALDO' : 'SALDO INSUFICIENTE'}
              </h3>
              <p className="text-white/60 mb-8 font-medium">
                {userData && userData.balance < 1 
                  ? 'Faça um depósito agora para continuar jogando e ganhando!' 
                  : `Sua aposta de ${formatCurrency(betAmount)} é maior que seu saldo atual.`}
              </p>
              <button onClick={() => navigate('/wallet')} className="btn-primary w-full py-4 shadow-lg shadow-casino-primary/20 animate-glow">FAZER DEPÓSITO AGORA</button>
              <button onClick={() => setShowNoBalance(false)} className="mt-4 text-white/40 text-xs font-bold uppercase tracking-widest hover:text-white transition-colors">Fechar</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAchievement && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          >
            <div className="glass p-12 rounded-[50px] text-center max-w-md w-full border-2 border-casino-primary/50 relative overflow-hidden shadow-2xl shadow-casino-primary/20">
              <div className="absolute inset-0 bg-gradient-to-b from-casino-primary/20 to-transparent -z-10" />
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 10, ease: "linear" }}
                className="absolute -top-24 -left-24 w-48 h-48 bg-casino-primary/10 blur-3xl rounded-full"
              />
              
              <motion.div
                animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="w-24 h-24 bg-casino-primary rounded-full mx-auto mb-6 flex items-center justify-center text-white shadow-lg shadow-casino-primary/50"
              >
                <Trophy size={48} />
              </motion.div>
              
              <h3 className="text-4xl font-black mb-4 italic tracking-tighter uppercase">PARABÉNS!</h3>
              <p className="text-xl font-bold text-white mb-2">Você atingiu seus primeiros <span className="text-casino-accent">R$ 100,00</span>!</p>
              <p className="text-sm text-white/60 mb-8">Sua sorte está brilhando hoje. Que tal garantir esse lucro agora?</p>
              
              <div className="space-y-3">
                <button 
                  onClick={() => navigate('/withdraw')}
                  className="btn-primary w-full py-4 text-lg animate-glow shadow-xl shadow-casino-primary/40"
                >
                  FAZER SAQUE AGORA
                </button>
                <button 
                  onClick={() => setShowAchievement(false)}
                  className="text-white/40 font-bold uppercase tracking-widest text-xs hover:text-white transition-colors"
                >
                  Continuar Jogando
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GamePage;
