import { createContext, useContext, ReactNode, useState, useEffect } from "react";
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

  // When the server confirms the session is gone, drop the local override
  // so the DashboardLayout redirects to /login instead of showing stale state.
  useEffect(() => {
    if (!isLoading && serverUser == null && localUser != null) {
      setLocalUser(null);
    }
  }, [isLoading, serverUser, localUser]);

  // While the /me request is in-flight, show localUser to avoid flash.
  // Once the server responds, always trust the server.
  const user = isLoading ? (localUser || null) : (serverUser || null);

  return (
    <AuthContext.Provider value={{ user, isLoading, refetch, setUser: setLocalUser }}>
      {children}
    </AuthContext.Provider>
  );
}