import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUser } from '@/contexts/UserContext';
import { mockUsers } from '@/contexts/UserContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const { setUser } = useUser();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Use mock authentication only for now to avoid Supabase auth issues
      if (email === 'admin@kotu.com' && password === 'test123') {
        console.log('Using mock authentication');
        setUser(mockUsers.admin);
        navigate('/dashboard');
      } else if (email === 'support@kotu.com' && password === 'test123') {
        console.log('Using mock authentication for support');
        setUser(mockUsers.support);
        navigate('/dashboard');
      } else if (email === 'warehouse@kotu.com' && password === 'test123') {
        console.log('Using mock authentication for warehouse');
        setUser(mockUsers.warehouse);
        navigate('/dashboard');
      } else if (email === 'accounts@kotu.com' && password === 'test123') {
        console.log('Using mock authentication for accounts');
        setUser(mockUsers.accounts);
        navigate('/dashboard');
      } else {
        setError('Invalid credentials. Use admin@kotu.com / test123 for admin');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError('Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Test with mock user for development
  const handleTestLogin = () => {
    setEmail('admin@kotu.com');
    setPassword('test123');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img 
            src="/favicon.png" 
            alt="KOTU Logo" 
            className="w-16 h-16 mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold">KOTU Exchange Portal</h1>
          <p className="text-muted-foreground">Sign in to your account</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>
              Enter your email and password to access the portal
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>

            <div className="mt-6 space-y-4">
              <Button 
                type="button" 
                variant="outline" 
                className="w-full"
                onClick={handleTestLogin}
              >
                Fill Test Credentials
              </Button>
              
              <div className="text-center text-sm text-muted-foreground">
                <p>Available test credentials:</p>
                <p><strong>Admin:</strong> admin@kotu.com / test123</p>
                <p><strong>Support:</strong> support@kotu.com / test123</p>
                <p><strong>Warehouse:</strong> warehouse@kotu.com / test123</p>
                <p><strong>Accounts:</strong> accounts@kotu.com / test123</p>
                <p className="text-xs mt-2">Note: Using mock authentication only</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
