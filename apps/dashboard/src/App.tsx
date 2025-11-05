import { AuthProvider } from './hooks/use-auth';
import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './AppRoutes';
import { Toaster } from '@/components/ui/sonner';
import { QueryClientProvider } from '@tanstack/react-query';
import queryClient from './lib/query-client';
import { DialogProvider } from './hooks/use-dialog';
import { SocketProvider } from '@/hooks/SocketContext';
import './App.css';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SocketProvider>
          <DialogProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
            <Toaster position="top-center" toastOptions={{ className: 'bg-primary' }} />
          </DialogProvider>
        </SocketProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
