import { useState, useCallback, useEffect } from 'react';
import { IAdminResponse } from '@elearning/types';
import { createContext, useContext } from 'react';
import { useMutation } from '@tanstack/react-query';
import authServices from '@/features/auth/services';

interface IAuthContext {
    user: IAdminResponse | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (user: IAdminResponse) => void;
    logout: () => void;
    mutate: () => void;
}

const AuthContext = createContext<IAuthContext | undefined>(undefined);
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<IAdminResponse | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [initialCheckDone, setInitialCheckDone] = useState(false);
    const { mutate, isPending } = useMutation<IAdminResponse>({
        mutationFn: authServices.check,
        onSuccess: (data) => {
            console.log("session debug", data)
            if (data) {
                login(data);
            } else {
                logout();
            }
            setInitialCheckDone(true);
        },
        onError: (_) => {
            logout();
            setInitialCheckDone(true);
        },
    });
    const login = useCallback((user: IAdminResponse) => {
        setUser(user);
        setIsAuthenticated(true);
    }, []);
    const logout = useCallback(() => {
        setUser(null);
        setIsAuthenticated(false);
    }, []);
    useEffect(() => {
        mutate();
    }, [mutate]);
    return (
        <AuthContext.Provider
            value={{
                user,
                isAuthenticated,
                isLoading: isPending || !initialCheckDone,
                login,
                logout,
                mutate,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
