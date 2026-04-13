import { LayoutGrid, Target, Dices, Coins, FerrisWheel, Flame } from 'lucide-react';

export const DEFAULT_GAMES = [
  { 
    id: 'double', 
    name: 'Double', 
    icon: Flame, 
    image: 'https://images.unsplash.com/photo-1518133835878-5a93cc3f89e5?auto=format&fit=crop&q=80&w=800', 
    description: 'O clássico da Blaze. Vermelho, Preto ou Branco?' 
  },
  { 
    id: 'slot', 
    name: 'Slot Machine', 
    icon: LayoutGrid, 
    image: 'https://images.unsplash.com/photo-1596838132731-3301c3fd4317?auto=format&fit=crop&q=80&w=800', 
    description: 'Gire e ganhe prêmios incríveis!' 
  },
  { 
    id: 'guess', 
    name: 'Adivinhar Número', 
    icon: Target, 
    image: 'https://images.unsplash.com/photo-1518133835878-5a93cc3f89e5?auto=format&fit=crop&q=80&w=800', 
    description: 'Acerte o número e multiplique seu saldo.' 
  },
  { 
    id: 'dice', 
    name: 'Dados (Maior/Menor)', 
    icon: Dices, 
    image: 'https://images.unsplash.com/photo-1553481187-be93c21490a9?auto=format&fit=crop&q=80&w=800', 
    description: 'Maior ou menor? Você decide o risco.' 
  },
  { 
    id: 'coin', 
    name: 'Cara ou Coroa', 
    icon: Coins, 
    image: 'https://images.unsplash.com/photo-1621504450181-5d356f63d3ee?auto=format&fit=crop&q=80&w=800', 
    description: '50/50 de chance. Simples e rápido.' 
  },
  { 
    id: 'wheel', 
    name: 'Roda da Sorte', 
    icon: FerrisWheel, 
    image: 'https://images.unsplash.com/photo-1595113316349-9fa4eb24f884?auto=format&fit=crop&q=80&w=800', 
    description: 'Gire a roda e veja onde a sorte para.' 
  },
];
