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
    let signOutAttempted = false;
    try {
      setLoading(true);
      // Try with local scope first (which is the default)
      const { error } = await supabase.auth.signOut();
      signOutAttempted = true; // Mark that we attempted the sign out

      if (error) {
        console.error("Sign out error, attempting fallback:", error);
        // Clear local storage as a fallback
        localStorage.removeItem('sb-hqgkctyvbbaxjyjhvchy-auth-token'); // Ensure this key matches exactly what Supabase uses

        // Reset application state immediately
        setSession(null);
        setUser(null);

        // Rethrow or handle specifically if needed, but navigation will happen in finally
        // For now, we log it, but don't show a toast here as navigation is the primary goal
      } else {
         // Successful sign out, ensure state is cleared (onAuthStateChange might handle this too, but explicit is safer)
         setSession(null);
         setUser(null);
      }
    } catch (error: any) {
      // Catch errors from the try block (including the re-thrown error or fetch errors)
      console.error("Sign out process failed:", error);
      // Potentially show a toast, but navigation is key
       toast({
         title: "Sign Out Issue",
         description: "Could not properly communicate sign-out with the server. You have been logged out locally.",
         variant: "destructive", // Or 'default' if it's just informational
       });
       // Ensure state is cleared even if API call fails catastrophically
       if (!signOutAttempted) { // If the API call itself failed before returning an error object
           localStorage.removeItem('sb-hqgkctyvbbaxjyjhvchy-auth-token');
           setSession(null);
           setUser(null);
       }
    } finally {
      setLoading(false);
      // Navigate to home route regardless of success or failure, after state is cleared
      console.log("Navigating to / after sign out attempt.");
      navigate('/', { replace: true });
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
