'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { fetchWithErrorToast } from '@/utils/api';

interface UserProfile {
  id: number;
  uid: string;
  email: string;
  displayName: string;
  username: string;
  createdAt?: string;
  updatedAt?: string;
  avatar?: string;
  isAdmin?: boolean;
}

interface AuthContextType {
  user: UserProfile | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signUp: (email: string, password: string, username: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  loginWithCode: (email: string, code: string) => Promise<{ mustSetPassword: boolean }>;
  logout: () => Promise<void>;
  updateUserProfile: (data: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Charger l'utilisateur depuis la session
  useEffect(() => {
    const loadUser = async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.user) {
            const u = data.user;
            const profile = { ...u, isAdmin: u.isAdmin === true || u.is_admin === 1 };
            setUser(profile);
            setUserProfile(profile);
          } else {
            setUser(null);
            setUserProfile(null);
          }
        } else {
          setUser(null);
          setUserProfile(null);
        }
      } catch {
        setUser(null);
        setUserProfile(null);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  const signUp = async (email: string, password: string, username: string) => {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, username }),
      });

      const data = await response.json();

      if (!response.ok) {
        const error = new Error(data.error || 'Erreur lors de l\'inscription');
        (error as any).code = data.error?.toLowerCase().includes('email') ? 'auth/email-already-in-use' : 'auth/error';
        throw error;
      }

      if (data.success && data.user) {
        setUser(data.user);
        setUserProfile(data.user);
      }
    } catch (error: any) {
      throw error;
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await fetchWithErrorToast('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        const error = new Error(data.error || 'Erreur lors de la connexion');
        (error as any).code = 'auth/invalid-credentials';
        throw error;
      }

      if (data.success && data.user) {
        console.log('Connexion réussie');
        setUser(data.user);
        setUserProfile(data.user);
      }
    } catch (error: any) {
      console.error('Erreur complète lors de la connexion:', {
        code: error.code,
        message: error.message,
        stack: error.stack,
      });
      throw error;
    }
  };

  const loginWithCode = async (email: string, code: string): Promise<{ mustSetPassword: boolean }> => {
    const response = await fetch('/api/auth/login-with-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    });
    const data = await response.json();
    if (!response.ok) {
      const err = new Error(data.error || 'Erreur lors de la connexion');
      (err as any).code = 'auth/code-login-failed';
      throw err;
    }
    if (data.success && data.user) {
      setUser(data.user);
      setUserProfile(data.user);
    }
    return { mustSetPassword: !!data.mustSetPassword };
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
      });
      setUser(null);
      setUserProfile(null);
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
      throw error;
    }
  };

  const updateUserProfile = async (data: Partial<UserProfile>) => {
    if (!user) throw new Error('Utilisateur non connecté');

    try {
      const body: Record<string, string | undefined> = {};
      if (data.avatar !== undefined) body.avatar = data.avatar;
      if (data.displayName !== undefined) body.displayName = data.displayName;
      if (data.username !== undefined) body.username = data.username;
      if (Object.keys(body).length === 0) {
        const updatedProfile = { ...userProfile, ...data } as UserProfile;
        setUserProfile(updatedProfile);
        setUser(updatedProfile);
        return;
      }

      // Mise à jour optimiste : afficher tout de suite la nouvelle photo
      const previousAvatar = userProfile?.avatar;
      if (body.avatar !== undefined) {
        const optimisticProfile = { ...userProfile, avatar: body.avatar } as UserProfile;
        setUserProfile(optimisticProfile);
        setUser(optimisticProfile);
      }

      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.json();

      if (!response.ok) {
        if (body.avatar !== undefined) {
          const revertedProfile = { ...userProfile, avatar: previousAvatar } as UserProfile;
          setUserProfile(revertedProfile);
          setUser(revertedProfile);
        }
        throw new Error(result.error || 'Erreur lors de la mise à jour du profil');
      }

      if (result.success && result.user) {
        const updatedProfile = result.user as UserProfile;
        setUserProfile(updatedProfile);
        setUser(updatedProfile);
      } else if (body.avatar !== undefined) {
        const updatedProfile = { ...userProfile, ...data } as UserProfile;
        setUserProfile(updatedProfile);
        setUser(updatedProfile);
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour du profil:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, signUp, login, loginWithCode, logout, updateUserProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

