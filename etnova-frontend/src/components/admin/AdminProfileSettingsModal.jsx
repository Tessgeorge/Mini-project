import { useCallback, useEffect, useState } from "react";
import Modal from "../Modal";
import supabase from "../../config/supabaseClient";

const EMPTY_PROFILE = {
  id: "",
  email: "",
  full_name: "",
  department: "",
  designation: "",
  phone: "",
};

export default function AdminProfileSettingsModal({ isOpen, onClose, onSuccess }) {
  const [userId, setUserId] = useState("");
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchAdminProfile = useCallback(async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.id) {
        setProfile(EMPTY_PROFILE);
        setUserId("");
        return;
      }

      setUserId(user.id);

      const { data, error: profileError } = await supabase
        .from("profiles")
        .select("id,email,full_name,department,designation,phone")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;
      setProfile(data || EMPTY_PROFILE);
    } catch (err) {
      setError(err.message || "Failed to load profile.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    fetchAdminProfile();
  }, [fetchAdminProfile, isOpen]);

  const updateAdminProfile = async () => {
    if (!userId) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          full_name: profile.full_name,
          department: profile.department,
          designation: profile.designation,
          phone: profile.phone,
        })
        .eq("id", userId);

      if (updateError) throw updateError;
      setSuccess("Profile updated successfully!");
      await fetchAdminProfile();
      onSuccess?.();
    } catch (err) {
      setError(err.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Profile Settings" maxWidth="max-w-2xl">
      <div className="p-6 space-y-5">
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {success}
          </div>
        ) : null}

        <div>
          <label htmlFor="email" className="block text-sm font-bold text-slate-900 mb-2">
            Email Address
          </label>
          <input
            type="email"
            id="email"
            value={profile.email || ""}
            disabled
            className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 cursor-not-allowed"
          />
          <p className="text-xs text-slate-500 mt-1">Email cannot be changed</p>
        </div>

        <div>
          <label htmlFor="full_name" className="block text-sm font-bold text-slate-900 mb-2">
            Full Name *
          </label>
          <input
            type="text"
            id="full_name"
            name="full_name"
            value={profile.full_name || ""}
            onChange={handleChange}
            required
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all text-slate-900"
            placeholder="Enter your full name"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label htmlFor="department" className="block text-sm font-bold text-slate-900 mb-2">
              Department
            </label>
            <input
              type="text"
              id="department"
              name="department"
              value={profile.department || ""}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all text-slate-900"
              placeholder="e.g., Computer Science"
            />
          </div>

          <div>
            <label htmlFor="designation" className="block text-sm font-bold text-slate-900 mb-2">
              Designation
            </label>
            <input
              type="text"
              id="designation"
              name="designation"
              value={profile.designation || ""}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all text-slate-900"
              placeholder="e.g., Assistant Professor"
            />
          </div>
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-bold text-slate-900 mb-2">
            Phone Number
          </label>
          <input
            type="tel"
            id="phone"
            name="phone"
            value={profile.phone || ""}
            onChange={handleChange}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all text-slate-900"
            placeholder="e.g., +91 9876543210"
          />
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-xl bg-slate-100 text-slate-700 font-bold text-sm hover:bg-slate-200 transition-all"
            disabled={saving || loading}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={updateAdminProfile}
            className="flex-1 px-4 py-3 rounded-xl text-black font-bold text-sm hover:opacity-90 transition-all shadow-md"
            style={{ backgroundColor: "#00D2C4" }}
            disabled={saving || loading}
          >
            {saving ? "Saving..." : loading ? "Loading..." : "Save Changes"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
