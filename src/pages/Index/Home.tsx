import { Navigate } from 'react-router-dom';

const Index = () => {
  // Simply redirect to dashboard for now
  // Auth will be checked by ProtectedRoute in App.tsx
  return <Navigate to="/dashboard" replace />;
};

export default Index;
