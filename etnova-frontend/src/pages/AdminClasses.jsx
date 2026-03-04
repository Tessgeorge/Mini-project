import { useEffect, useState } from "react";
import supabase from "../lib/supabase";
import useAdminAuth from "../hooks/useAdminAuth";
import { emitAdminDataUpdated } from "../utils/adminLiveSync";

export default function AdminClasses() {
  useAdminAuth();
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [newClass, setNewClass] = useState({ class_name: "", department: "" });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ class_name: "", department: "" });

  const fetchClasses = async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error: fetchError } = await supabase
        .from("classes")
        .select("id, class_name, department")
        .order("class_name", { ascending: true });
      if (fetchError) throw fetchError;
      setClasses(data || []);
    } catch (err) {
      setError(err.message || "Failed to fetch classes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  const createClass = async () => {
    if (!newClass.class_name.trim() || !newClass.department.trim()) return;
    setSaving(true);
    setError("");
    try {
      const { error: createError } = await supabase.from("classes").insert({
        class_name: newClass.class_name.trim(),
        department: newClass.department.trim(),
      });
      if (createError) throw createError;
      setNewClass({ class_name: "", department: "" });
      emitAdminDataUpdated();
      await fetchClasses();
    } catch (err) {
      setError(err.message || "Failed to create class.");
    } finally {
      setSaving(false);
    }
  };

  const updateClass = async () => {
    if (!editingId || !editForm.class_name.trim() || !editForm.department.trim()) return;
    setSaving(true);
    setError("");
    try {
      const { error: updateError } = await supabase
        .from("classes")
        .update({
          class_name: editForm.class_name.trim(),
          department: editForm.department.trim(),
        })
        .eq("id", editingId);
      if (updateError) throw updateError;
      setEditingId(null);
      setEditForm({ class_name: "", department: "" });
      emitAdminDataUpdated();
      await fetchClasses();
    } catch (err) {
      setError(err.message || "Failed to update class.");
    } finally {
      setSaving(false);
    }
  };

  const deleteClass = async (id) => {
    setSaving(true);
    setError("");
    try {
      const { count, error: checkError } = await supabase
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("class_id", id);
      if (checkError) throw checkError;
      if ((count || 0) > 0) throw new Error("Cannot delete class with linked projects.");

      const { error: deleteError } = await supabase.from("classes").delete().eq("id", id);
      if (deleteError) throw deleteError;
      emitAdminDataUpdated();
      await fetchClasses();
    } catch (err) {
      setError(err.message || "Failed to delete class.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-gray-50 min-h-screen p-6">
      <div className="max-w-5xl mx-auto bg-white rounded-xl shadow-md border border-gray-100 p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Classes</h1>
          <p className="text-sm text-gray-500 mt-1">Manage class and department records</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input value={newClass.class_name} onChange={(e) => setNewClass((p) => ({ ...p, class_name: e.target.value }))} placeholder="Class Name" className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm" />
          <input value={newClass.department} onChange={(e) => setNewClass((p) => ({ ...p, department: e.target.value }))} placeholder="Department" className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm" />
          <button type="button" onClick={createClass} disabled={saving} className="rounded-lg bg-teal-600 text-white px-4 py-2.5 text-sm font-semibold hover:bg-teal-700 disabled:opacity-60">Create New Class</button>
        </div>

        {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}

        <div className="overflow-x-auto rounded-lg border border-gray-100">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Class Name</th>
                <th className="text-left px-4 py-3 font-semibold">Department</th>
                <th className="text-left px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-500">Loading classes...</td></tr>
              ) : classes.length === 0 ? (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-500">No classes found.</td></tr>
              ) : (
                classes.map((row) => {
                  const editing = editingId === row.id;
                  return (
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        {editing
                          ? <input value={editForm.class_name} onChange={(e) => setEditForm((p) => ({ ...p, class_name: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                          : <span className="text-gray-800">{row.class_name}</span>}
                      </td>
                      <td className="px-4 py-3">
                        {editing
                          ? <input value={editForm.department} onChange={(e) => setEditForm((p) => ({ ...p, department: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                          : <span className="text-gray-700">{row.department}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {editing ? (
                            <>
                              <button type="button" onClick={updateClass} disabled={saving} className="px-3 py-1.5 rounded-lg bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 disabled:opacity-60">Save</button>
                              <button type="button" onClick={() => setEditingId(null)} className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-50">Cancel</button>
                            </>
                          ) : (
                            <>
                              <button type="button" onClick={() => { setEditingId(row.id); setEditForm({ class_name: row.class_name || "", department: row.department || "" }); }} className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-50">Edit</button>
                              <button type="button" onClick={() => deleteClass(row.id)} disabled={saving} className="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-700 text-xs font-semibold hover:bg-rose-50 disabled:opacity-60">Delete</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
