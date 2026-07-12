'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type AuthSession = {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  } | null;
} | null;

type AuthContextType = {
  session: AuthSession;
  status: 'authenticated' | 'unauthenticated' | 'loading';
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  status: 'loading',
});

/**
 * Calls the server-side sync-session endpoint to set the
 * HMAC-signed HttpOnly cookie that the middleware checks.
 * This replaces the old forgeable `document.cookie` approach.
 *
 * Returns true on success, false on failure.
 */
async function syncSessionToServer(accessToken: string): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/sync-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken }),
    });
    return res.ok;
  } catch (err) {
    console.error('Failed to sync session to server:', err);
    return false;
  }
}

/**
 * Clears the server-side HttpOnly auth cookie by calling
 * the sync-session DELETE endpoint.
 */
async function clearServerSession(): Promise<void> {
  try {
    await fetch('/api/auth/sync-session', { method: 'DELETE' });
  } catch (err) {
    console.error('Failed to clear server session:', err);
  }
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession>(null);
  const [status, setStatus] = useState<'authenticated' | 'unauthenticated' | 'loading'>('loading');

  useEffect(() => {
    // 1. Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (initialSession && initialSession.user) {
          const userMetadata = initialSession.user.user_metadata || {};

          // Sync the Supabase access token to the server FIRST, so the
          // HttpOnly auth cookie is set before we announce 'authenticated'.
          // The portfolio store waits for status='authenticated' before
          // calling GET /api/portfolio, which requires that cookie.
          if (initialSession.access_token) {
            await syncSessionToServer(initialSession.access_token);
          }

          setSession({
            user: {
              id: initialSession.user.id,
              email: initialSession.user.email || '',
              name: userMetadata.name || initialSession.user.email?.split('@')[0] || 'User',
              role: userMetadata.role || 'USER',
            },
          });
          setStatus('authenticated');
        } else {
          setSession(null);
          setStatus('unauthenticated');
          await clearServerSession();
        }
      } catch (err) {
        console.error('Failed to get initial Supabase session:', err);
        setSession(null);
        setStatus('unauthenticated');
        await clearServerSession();
      }
    };

    getInitialSession();

    // 2. Listen to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (currentSession && currentSession.user) {
        const userMetadata = currentSession.user.user_metadata || {};

        // Sync session to server FIRST, then set status
        if (currentSession.access_token) {
          await syncSessionToServer(currentSession.access_token);
        }

        setSession({
          user: {
            id: currentSession.user.id,
            email: currentSession.user.email || '',
            name: userMetadata.name || currentSession.user.email?.split('@')[0] || 'User',
            role: userMetadata.role || 'USER',
          },
        });
        setStatus('authenticated');
      } else {
        setSession(null);
        setStatus('unauthenticated');
        // Clear server-side cookie on sign-out
        if (event === 'SIGNED_OUT') {
          await clearServerSession();
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ session, status }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useSession() {
  const context = useContext(AuthContext);
  return {
    data: context.session,
    status: context.status,
  };
}

export async function signOut() {
  await supabase.auth.signOut();
  await clearServerSession();
  if (typeof window !== 'undefined') {
    window.location.href = '/login';
  }
}
