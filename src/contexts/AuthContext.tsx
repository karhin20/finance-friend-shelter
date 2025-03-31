import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import { useToast } from '@/hooks/use-toast';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string) => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;
      toast({
        title: "Success!",
        description: "Check your email for the confirmation link.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      toast({
        title: "Welcome back!",
        description: "You've successfully signed in.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    console.log("signOut function called");
    let signOutAttempted = false;
    try {
      setLoading(true);
      console.log("Attempting supabase.auth.signOut()");
      const { error } = await supabase.auth.signOut();
      signOutAttempted = true;
      console.log("supabase.auth.signOut() completed");

      if (error) {
        console.error("Sign out error (API failure), attempting fallback:", error);
        localStorage.removeItem('sb-hqgkctyvbbaxjyjhvchy-auth-token');
        setSession(null);
        setUser(null);
      } else {
        console.log("Successful supabase.auth.signOut() - state cleared");
        setSession(null);
        setUser(null);
      }
    } catch (error: any) {
      console.error("signOut catch block - Sign out process failed (likely offline):", error);
      localStorage.removeItem('sb-hqgkctyvbbaxjyjhvchy-auth-token');
      setSession(null);
      setUser(null);
      if (!signOutAttempted) {
        toast({
          title: "Offline Sign Out",
          description: "Signed out locally, but couldn't reach the server to confirm. You're now logged out.",
          variant: "default",
        });
      } else {
        toast({
          title: "Sign Out Issue",
          description: "Problem communicating with the server during sign out. You have been logged out locally.",
          variant: "destructive",
        });
      }

    } finally {
      setLoading(false);
      console.log("signOut finally block - Navigating to /");
      navigate('/', { replace: true });
      console.log("Navigation to / completed");
    }
  };

  return (
    <AuthContext.Provider value={{ session, user, signUp, signIn, signOut, loading }}>
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
