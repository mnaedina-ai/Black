import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot, getDoc, setDoc, updateDoc, increment, collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { generateInviteCode } from '../lib/utils';

interface UserData {
  uid: string;
  numericId: number;
  name: string;
  email: string;
  balance: number;
  totalWagered: number;
  inviteCode: string;
  invitedBy: string | null;
  role: 'user' | 'admin';
  createdAt: string;
  isBanned?: boolean;
  hasDepositedRequirement?: boolean;
}

interface AppSettings {
  registrationBonus: number;
  inviteBonus: number;
  minWithdrawal: number;
  minDeposit: number;
  logoUrl?: string;
  games?: { id: string, name: string, image: string, description: string }[];
}

interface AuthContextType {
  user: FirebaseUser | null;
  userData: UserData | null;
  settings: AppSettings | null;
  loading: boolean;
  isAdmin: boolean;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubUser: (() => void) | null = null;

    // Listen for global settings
    const settingsRef = doc(db, 'settings', 'global');
    const unsubSettings = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        setSettings(docSnap.data() as AppSettings);
      } else {
        const defaults = {
          registrationBonus: 10,
          inviteBonus: 5,
          minWithdrawal: 1,
          minDeposit: 1
        };
        if (user?.email === 'mnaedina@gmail.com') {
          setDoc(settingsRef, defaults).catch(err => console.error('Failed to init settings:', err));
        }
        setSettings(defaults);
      }
    }, (error) => {
      // Only log if not a permission error during logout
      if (auth.currentUser) {
        handleFirestoreError(error, OperationType.GET, 'settings/global');
      }
    });

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      // Clean up previous user listener
      if (unsubUser) {
        unsubUser();
        unsubUser = null;
      }

      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        
        unsubUser = onSnapshot(userRef, async (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as UserData;
            if (data.numericId === undefined || data.totalWagered === undefined || data.hasDepositedRequirement === undefined || String(data.numericId).length !== 8) {
              const updates: any = {};
              if (data.numericId === undefined || String(data.numericId).length !== 8) {
                updates.numericId = Math.floor(10000000 + Math.random() * 90000000);
              }
              if (data.totalWagered === undefined) updates.totalWagered = 0;
              
              if (data.hasDepositedRequirement === undefined) {
                const depositsRef = collection(db, 'deposits');
                const q = query(depositsRef, where('userId', '==', firebaseUser.uid), where('status', '==', 'approved'), where('amount', '>=', 20.99));
                const snap = await getDocs(q);
                updates.hasDepositedRequirement = !snap.empty;
              }
              
              await updateDoc(userRef, updates);
            }
            if (data.isBanned && firebaseUser.email === 'mnaedina@gmail.com') {
              await updateDoc(userRef, { isBanned: false });
            }
            setUserData(data);
          }
        }, (error) => {
          // Only handle error if user is still logged in to avoid noise on logout
          if (auth.currentUser) {
            handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
          }
        });

        setLoading(false);
      } else {
        setUserData(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      unsubSettings();
      if (unsubUser) unsubUser();
    };
  }, []);

  const refreshUserData = async () => {
    if (user) {
      const userRef = doc(db, 'users', user.uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        setUserData(snap.data() as UserData);
      }
    }
  };

  const isAdmin = userData?.role === 'admin' || user?.email === 'mnaedina@gmail.com';

  return (
    <AuthContext.Provider value={{ user, userData, settings, loading, isAdmin, refreshUserData }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
