import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import supabase from "../lib/supabase";

export default function useAdminAuth() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      setLoading(true);
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;

        const currentUser = authData?.user || null;
        if (!currentUser) {
          if (mounted) {
            setIsAdmin(false);
            setUser(null);
            setProfile(null);
            navigate("/signin", { replace: true });
          }
          return;
        }

        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("id, full_name, role, email")
          .eq("id", currentUser.id)
          .single();
        if (profileError) throw profileError;

        const admin = profileData?.role === "admin";
        if (mounted) {
          setUser(currentUser);
          setProfile(profileData || null);
          setIsAdmin(admin);
          if (!admin) navigate("/signin", { replace: true });
        }
      } catch {
        if (mounted) {
          setIsAdmin(false);
          setUser(null);
          setProfile(null);
          navigate("/signin", { replace: true });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    run();
    return () => {
      mounted = false;
    };
  }, [navigate]);

  return { loading, isAdmin, user, profile };
}
