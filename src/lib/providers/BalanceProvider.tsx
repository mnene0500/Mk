'use client'

import { createContext, useContext, useState, useEffect } from 'react';
import { useUser } from '@/firebase/auth/use-user';
import { supabase } from '@/lib/supabase';

const BalanceContext = createContext({ coins: 0, diamonds: 0 });

export const BalanceProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useUser();
  const [balances, setBalances] = useState({ coins: 0, diamonds: 0 });

  useEffect(() => {
    if (!user?.id) {
      setBalances({ coins: 0, diamonds: 0 });
      return;
    }

    let balanceChannel: any;

    const fetchAndSubscribe = async () => {
      const { data, error } = await supabase
        .from('balances')
        .select('coins, diamonds')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching balance:", error.message);
        setBalances({ coins: 0, diamonds: 0 });
      } else {
        setBalances({ coins: Number(data?.coins) || 0, diamonds: Number(data?.diamonds) || 0 });
      }

      balanceChannel = supabase
        .channel(`global-balance-sync:${user.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'balances', filter: `user_id=eq.${user.id}` },
          (payload) => {
            if (payload.eventType === 'DELETE') {
              setBalances({ coins: 0, diamonds: 0 });
              return;
            }
            
            if (payload.new) {
              setBalances(current => ({
                ...current,
                ...(payload.new.coins !== undefined && { coins: Number(payload.new.coins) || 0 }),
                ...(payload.new.diamonds !== undefined && { diamonds: Number(payload.new.diamonds) || 0 }),
              }));
            }
          }
        )
        .subscribe();
    };

    fetchAndSubscribe();

    return () => {
      if (balanceChannel) {
        supabase.removeChannel(balanceChannel);
      }
    };
  }, [user?.id]);

  return (
    <BalanceContext.Provider value={balances}>
      {children}
    </BalanceContext.Provider>
  );
};

export const useBalance = () => useContext(BalanceContext);
