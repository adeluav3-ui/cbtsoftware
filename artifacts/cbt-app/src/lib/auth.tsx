import { createContext, useContext, ReactNode, useState } from "react";
import { useCurrentUser, User } from "@workspace/api-client-react";

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  refetch: () => void;
  setUser: (user: User | null) => void;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  refetch: () => { },
  setUser: () => { },
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: serverUser, isLoading, refetch } = useCurrentUser();
  const [localUser, setLocalUser] = useState<User | null>(null);

  const user = localUser || serverUser || null;

  return (
    <AuthContext.Provider value={{ user, isLoading, refetch, setUser: setLocalUser }}>
      {children}
    </AuthContext.Provider>
  );
}