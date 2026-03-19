import { createContext, useContext, ReactNode } from "react";
import { useCurrentUser } from "@workspace/api-client-react";

type User = {
  id: number;
  username: string;
  role: string;
  schoolCode: string | null;
  schoolName: string | null;
  fullName: string | null;
  class: string | null;
};

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  refetch: () => void;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  refetch: () => { },
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: user, isLoading, refetch } = useCurrentUser();

  return (
    <AuthContext.Provider value={{ user: user || null, isLoading, refetch }}>
      {children}
    </AuthContext.Provider>
  );
}