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

  // When the server confirms the session is gone (e.g. Render restart, expiry),
  // drop the local override so DashboardLayout redirects to /login.
  // This only fires when serverUser is genuinely null after a completed fetch —
  // not during login, because login.tsx writes the user into the query cache
  // synchronously (setQueryData) before this effect can see serverUser === null.
  useEffect(() => {
    if (!isLoading && serverUser == null && localUser != null) {
      setLocalUser(null);
    }
  }, [isLoading, serverUser, localUser]);

  const user = localUser || serverUser || null;

  return (
    <AuthContext.Provider value={{ user, isLoading, refetch, setUser: setLocalUser }}>
      {children}
    </AuthContext.Provider>
  );
}