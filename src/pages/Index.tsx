import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SocialAuthButtons } from '@/components/SocialAuthButtons';

const Index = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();

  // Redirect if user is already logged in
  if (user) {
    navigate('/dashboard', { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setIsSubmitting(true);
    try {
      if (isSignUp) {
        await signUp(email, password);
      } else {
        await signIn(email, password);
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Auth error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Left column: Brand story and value proposition */}
        <div
          className="flex-1 flex flex-col justify-center p-8 md:p-12 lg:p-16 animate-fade-up bg-muted border-r relative overflow-hidden"
          style={{
            backgroundImage: `url(/auth-background.jpg)`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        >
          {/* Overlay for better text readability */}
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm"></div>

          <div className="max-w-md mx-auto md:mx-0 relative z-10">
            <div className="flex items-center gap-2 mb-8">
              <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shadow-lg">
                <span className="text-primary-foreground font-bold text-2xl">D</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Diligence Finance</h1>
            </div>

            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 leading-tight">
              Start your journey to financial freedom.
            </h2>

            <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
              Take control of your finances with powerful expense tracking and smart money management designed for you.
            </p>

            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="font-medium">Free to use</span>
              </div>
              <div className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="font-medium">Easy to track</span>
              </div>
              <div className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="font-medium">Made for you</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Auth form */}
        <div className="flex-1 flex items-center justify-center p-8 md:p-12 animate-fade-in bg-background">
          <div className="w-full max-w-sm space-y-8">
            <div className="space-y-2">
              <h3 className="text-3xl font-bold tracking-tight">
                {isSignUp ? "Create an account" : "Welcome back"}
              </h3>
              <p className="text-muted-foreground">
                {isSignUp ? "Get started on your financial journey" : "Sign in to continue your journey"}
              </p>
            </div>

            <div className="space-y-6">
              {/* Social Auth Buttons */}
              <SocialAuthButtons />

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="bg-background h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Password</Label>
                      {!isSignUp && (
                        <a href="#" className="text-sm text-primary hover:underline font-medium" tabIndex={-1}>
                          Forgot password?
                        </a>
                      )}
                    </div>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="bg-background h-11"
                    />
                    {isSignUp && (
                      <p className="text-xs text-muted-foreground">
                        Must be at least 6 characters
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <Button
                    type="submit"
                    className="w-full h-11 font-semibold text-base transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
                    disabled={isSubmitting}
                  >
                    {isSubmitting
                      ? (isSignUp ? "Creating account..." : "Signing in...")
                      : (isSignUp ? "Create Account" : "Sign In")}
                  </Button>

                  <div className="text-center text-base">
                    <span className="text-muted-foreground">
                      {isSignUp ? "Already have an account? " : "Don't have an account? "}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsSignUp(!isSignUp);
                        setEmail('');
                        setPassword('');
                      }}
                      className="text-primary hover:underline font-semibold transition-all duration-200 hover:scale-105 inline-block"
                    >
                      {isSignUp ? "Sign in" : "Sign up"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
