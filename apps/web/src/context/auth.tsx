import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

interface Profile {
  role: "admin" | "student";
  status: "pending" | "approved" | "rejected";
  fullName: string | null;
  group: string | null;
}

interface SignInResult {
  error: string | null;
  profile: Profile | null;
}

interface AuthContext {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signUp: (
    email: string,
    password: string,
    metadata: { full_name: string; group: string },
  ) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContext | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("role, status, full_name, group")
      .eq("id", userId)
      .single();

    if (data) {
      setProfile({
        role: data.role,
        status: data.status,
        fullName: data.full_name,
        group: data.group,
      });
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<SignInResult> => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) return { error: error.message, profile: null };

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("role, status, full_name, group")
        .eq("id", data.user.id)
        .single();

      if (profileError || !profileData) {
        return { error: profileError?.message ?? "Failed to load profile", profile: null };
      }

      const userProfile: Profile = {
        role: profileData.role,
        status: profileData.status,
        fullName: profileData.full_name,
        group: profileData.group,
      };

      setProfile(userProfile);

      return { error: null, profile: userProfile };
    },
    [],
  );

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      metadata: { full_name: string; group: string },
    ) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: metadata },
      });
      return { error: error?.message ?? null };
    },
    [],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      session,
      profile,
      isLoading,
      signIn,
      signUp,
      signOut,
    }),
    [session, profile, isLoading, signIn, signUp, signOut],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContext {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
