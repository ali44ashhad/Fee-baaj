// src/hooks/SocketContext.ts
import { createContext, useContext, useEffect, useState, ReactNode, FC } from 'react';
import io, { Socket } from 'socket.io-client';
import { useAuth } from '@/hooks/use-auth';

// Explicitly type the context value
type SocketType = Socket | null;
const SocketContext = createContext<SocketType>(null);

interface SocketProviderProps {
  children: ReactNode;
}

export const SocketProvider: FC<SocketProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<SocketType>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    
    const url = import.meta.env.VITE_SOCKET_URL!;
    const socketInstance = io(url, {
      path: '/socket.io',
      withCredentials: true,
      autoConnect: true,
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [user]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};

// Add explicit return type annotation
export const useSocket = (): SocketType => {
  const socket = useContext(SocketContext);
  if (socket === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return socket;
};