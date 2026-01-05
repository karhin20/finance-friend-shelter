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
  signInWithGoogle: () => Promise<void>;
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

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) throw error;
      // Note: The redirect happens automatically, so the user won't see this toast
      // unless there's an error
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to sign in with Google",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    let isMounted = true; // Local mount check for this specific async operation

    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error("Sign out error:", error);
        // Clear local storage as a fallback
        localStorage.removeItem('sb-hqgkctyvbbaxjyjhvchy-auth-token'); // Ensure this key is correct

        // Reset application state directly on error (if appropriate for your UX)
        // Consider if you want to clear state even if sign-out technically failed on the server
        if (isMounted) {
          setSession(null);
          setUser(null);
        }

        // Still throw the error to show it to the user / allow component handling
        throw error;
      }

      // Explicitly clear session/user state on successful sign-out
      // This makes the state change immediate and less dependent on the listener
      if (isMounted) {
        setSession(null);
        setUser(null);
      }
      // The onAuthStateChange listener will still fire, but it will just be setting
      // the state to null again, which is harmless.

    } catch (error: any) {
      console.error("Sign out failed:", error);
      // Display toast on failure
      toast({
        title: "Error signing out",
        description: error.message || "Please try refreshing the page and signing out again.", // Updated error message slightly
        variant: "destructive",
      });
      // Optionally re-throw if components need to react to the error beyond the toast
      // throw error; // Decide if re-throwing is necessary here
    } finally {
      // Ensure loading is always set to false eventually
      if (isMounted) {
        setLoading(false);
      }
    }
  };

  // Add the deleteAccount function
  const deleteAccount = async () => {
    let isMounted = true; // Add mount check
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
      if (isMounted) { // Check before setting state
        setLoading(false);
      }
    }
  };

  return (
    <AuthContext.Provider value={{ session, user, signUp, signIn, signInWithGoogle, signOut, deleteAccount, loading }}>
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
