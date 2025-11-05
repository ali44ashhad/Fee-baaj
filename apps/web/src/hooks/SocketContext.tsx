'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import { useAuth } from '@/hooks/use-auth';

const SocketContext = createContext<Socket | null>(null);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false)
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;                // wait until we know who we are
    const url = process.env.NEXT_PUBLIC_API_URL!;
    const socketInstance = io(url, {
      path: '/socket.io',
      withCredentials: true,
      autoConnect: true,
      
    });

    setSocket(socketInstance);

    socketInstance.on('connect',    () => setIsConnected(true));
    socketInstance.on('disconnect', () => setIsConnected(false));

    return () => {
      socketInstance.disconnect();
    };
  }, [user]);

  // Only render children when socket is ready
  if (!socket) return null;

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const socket = useContext(SocketContext);
  if (!socket) throw new Error('useSocket must be inside a SocketProvider');
  return socket;
};
