import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Home } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-12">
      <div className="flex max-w-md flex-col items-center text-center animate-fade-in">
        <img src="/Vector-Blue-KOTU-Logo.png" alt="KOTU" className="mb-8 size-10 rounded-full" />
        <p className="font-heading text-7xl font-semibold leading-none tracking-tight text-primary tabular sm:text-8xl">404</p>
        <h1 className="mt-5 text-xl font-semibold text-foreground sm:text-2xl">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved. Check the address, or head back to where you were.
        </p>
        <div className="mt-6 flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
          <Button variant="secondary" onClick={() => navigate(-1)}>
            <ArrowLeft />
            Go back
          </Button>
          <Button onClick={() => navigate('/dashboard')}>
            <Home />
            Go to dashboard
          </Button>
        </div>
      </div>
    </main>
  );
}
