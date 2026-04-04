import { useCallback, useEffect, useState } from "react";
import supabase from "../lib/supabase";

const EMPTY_ADMIN_PROFILE = {
  full_name: "",
  email: "",
  department: "",
};

export default function useAdminProfilePanel() {
  const [adminProfile, setAdminProfile] = useState(EMPTY_ADMIN_PROFILE);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showProfileSettings, setShowProfileSettings] = useState(false);

  const refreshAdminProfile = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.id) {
        setAdminProfile(EMPTY_ADMIN_PROFILE);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, email, department")
        .eq("id", user.id)
        .single();

      if (error) throw error;

      setAdminProfile({
        full_name: data?.full_name || "",
        email: data?.email || "",
        department: data?.department || "",
      });
    } catch {
      setAdminProfile(EMPTY_ADMIN_PROFILE);
    }
  }, []);

  useEffect(() => {
    refreshAdminProfile();
  }, [refreshAdminProfile]);

  return {
    adminProfile,
    showProfileMenu,
    setShowProfileMenu,
    showProfileSettings,
    setShowProfileSettings,
    refreshAdminProfile,
  };
}
