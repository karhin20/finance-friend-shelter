
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

const Index = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();

  // Redirect if user is already logged in
  if (user) {
    navigate('/dashboard', { replace: true });
    return null;
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    
    try {
      setIsSubmitting(true);
      await signIn(email, password);
      navigate('/dashboard');
    } catch (error) {
      console.error('Sign in error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    
    try {
      setIsSubmitting(true);
      await signUp(email, password);
      // Stay on the page as user needs to verify email
    } catch (error) {
      console.error('Sign up error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero section */}
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Left column: App info */}
        <div className="flex-1 flex flex-col justify-center p-8 md:p-12 animate-fade-up">
          <div className="max-w-xl mx-auto md:mx-0">
            <div className="flex items-center gap-2 mb-8">
              <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-semibold text-lg">F</span>
              </div>
              <h1 className="text-2xl font-bold">Finance</h1>
            </div>
            
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              Take control of your financial life
            </h2>
            
            <p className="text-lg text-muted-foreground mb-8">
              Track expenses, manage income, and gain insights into your spending habits with our intuitive finance management app.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start">
                <div className="mr-4 mt-1 bg-primary/10 p-2 rounded-full">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M13.3334 4L6.00002 11.3333L2.66669 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div>
                  <h3 className="font-medium mb-1">Expense Tracking</h3>
                  <p className="text-muted-foreground text-sm">Log and categorize expenses for better visibility</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="mr-4 mt-1 bg-primary/10 p-2 rounded-full">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M13.3334 4L6.00002 11.3333L2.66669 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div>
                  <h3 className="font-medium mb-1">Income Management</h3>
                  <p className="text-muted-foreground text-sm">Record and track all sources of income</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="mr-4 mt-1 bg-primary/10 p-2 rounded-full">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M13.3334 4L6.00002 11.3333L2.66669 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div>
                  <h3 className="font-medium mb-1">Insightful Reports</h3>
                  <p className="text-muted-foreground text-sm">Visualize spending patterns with charts and reports</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="mr-4 mt-1 bg-primary/10 p-2 rounded-full">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M13.3334 4L6.00002 11.3333L2.66669 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div>
                  <h3 className="font-medium mb-1">Financial Overview</h3>
                  <p className="text-muted-foreground text-sm">Get a complete picture of your financial health</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Right column: Auth form */}
        <div className="flex-1 flex items-center justify-center p-8 md:p-12 animate-fade-in">
          <div className="w-full max-w-md">
            <Card className="mx-auto">
              <CardHeader>
                <CardTitle>Get Started</CardTitle>
                <CardDescription>Sign in or create an account to continue</CardDescription>
              </CardHeader>
              
              <Tabs defaultValue="signin" className="w-full">
                <TabsList className="grid grid-cols-2 mx-6">
                  <TabsTrigger value="signin">Sign In</TabsTrigger>
                  <TabsTrigger value="signup">Sign Up</TabsTrigger>
                </TabsList>
                
                <TabsContent value="signin">
                  <form onSubmit={handleSignIn}>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="name@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="password">Password</Label>
                          <a href="#" className="text-xs text-primary hover:underline">
                            Forgot password?
                          </a>
                        </div>
                        <Input
                          id="password"
                          type="password"
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                        />
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button type="submit" className="w-full" disabled={isSubmitting}>
                        {isSubmitting ? "Signing in..." : "Sign In"}
                      </Button>
                    </CardFooter>
                  </form>
                </TabsContent>
                
                <TabsContent value="signup">
                  <form onSubmit={handleSignUp}>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="email-signup">Email</Label>
                        <Input
                          id="email-signup"
                          type="email"
                          placeholder="name@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="password-signup">Password</Label>
                        <Input
                          id="password-signup"
                          type="password"
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Password must be at least 6 characters long
                        </p>
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button type="submit" className="w-full" disabled={isSubmitting}>
                        {isSubmitting ? "Creating account..." : "Create Account"}
                      </Button>
                    </CardFooter>
                  </form>
                </TabsContent>
              </Tabs>
            </Card>
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <footer className="py-6 md:py-0 border-t">
        <div className="container flex flex-col items-center justify-between gap-4 md:h-16 md:flex-row">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Finance App. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
