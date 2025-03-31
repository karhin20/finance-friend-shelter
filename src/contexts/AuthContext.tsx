import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle } from 'lucide-react'; // Might be needed if using Alert component

type AuthContextType = {
  session: Session | null;
  user: User | null;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>; // Add deleteAccount type
  loading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    let isMounted = true; // Flag to track mounting status

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (isMounted) { // Check if component is still mounted
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) { // Check if component is still mounted
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false); // Also ensure setLoading is checked here
      }
    });

    return () => {
      isMounted = false; // Set flag to false when component unmounts
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
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error("Sign out error:", error);
        // Clear local storage as a fallback - No change needed here, but ensure state updates below are handled if they were async
        localStorage.removeItem('sb-hqgkctyvbbaxjyjhvchy-auth-token'); // Consider if this key is correct/dynamic

        // Reset application state directly (synchronous, less likely to cause issues)
        setSession(null);
        setUser(null);

        // Still throw the error to show it to the user
        throw error;
      }
      // No need to explicitly set session/user to null here on successful signout,
      // the onAuthStateChange listener should handle this automatically.
      // If the listener doesn't fire reliably or quickly enough, you might reconsider,
      // but usually, it's best practice to rely on the listener.
    } catch (error: any) {
      console.error("Sign out failed:", error);
      toast({
        title: "Error signing out",
        description: "Please try refreshing the page and signing out again.",
        variant: "destructive",
      });
    } finally {
      // setLoading(false) is synchronous relative to the try/catch,
      // but if signOut itself caused an unmount *before* finally,
      // it could theoretically error. However, this is much less likely
      // than the async callbacks in useEffect. Adding a mounted check
      // here would be overly defensive unless proven necessary.
      setLoading(false);
    }
  };

  // Add the deleteAccount function
  const deleteAccount = async () => {
    setLoading(true);
    try {
      // !!! IMPORTANT !!!
      // This is a placeholder. Actual user deletion should typically be handled
      // by a secure backend function (e.g., Supabase Edge Function)
      // that verifies ownership and performs necessary cleanup (e.g., deleting related data).
      // Directly deleting from the client might have security implications
      // or leave orphaned data.
      console.error("deleteAccount function needs a proper backend implementation.");
      throw new Error("Account deletion functionality is not fully implemented. Please contact support or implement a secure backend function.");

      // Example of what might be called (if using an Edge Function):
      // const { error } = await supabase.functions.invoke('delete-user');
      // if (error) throw error;

      // If deletion were successful client-side (less common/secure):
      // setSession(null); // Clear session/user state if needed,
      // setUser(null);   // though onAuthStateChange might handle it.
      // toast({ title: "Account Deleted", description: "Your account has been permanently deleted." });

    } catch (error: any) {
      console.error("Error deleting account:", error);
      toast({
        title: "Error Deleting Account",
        description: error.message || "Could not delete account. Please try again.",
        variant: "destructive",
      });
      // Re-throw the error so the calling component knows it failed
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ session, user, signUp, signIn, signOut, deleteAccount, loading }}>
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
