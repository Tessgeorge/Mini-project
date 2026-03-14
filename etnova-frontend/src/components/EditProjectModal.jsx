import { useEffect, useState } from "react";
import Modal from "./Modal";
import { apiRequest } from "../config/apiClient";

const EMPTY_FORM = {
  title: "",
  domain: "",
  technologyStacks: "",
  description: "",
  abstract: "",
};

function stacksToInput(stacks) {
  if (!stacks) return "";
  if (Array.isArray(stacks)) return stacks.filter(Boolean).join(", ");
  return String(stacks);
}

function parseTechnologyStacks(input) {
  return [...new Set(
    String(input || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  )];
}

function buildProjectUpdatePayload(formData) {
  const payload = {
    title: formData.title,
    technology_stacks: parseTechnologyStacks(formData.technologyStacks),
    description: formData.description,
    abstract: formData.abstract,
  };

  const normalizedDomain = String(formData.domain || "").trim();
  if (normalizedDomain) {
    payload.domain = normalizedDomain;
  }

  return payload;
}

export default function EditProjectModal({ isOpen, onClose, project, onSaved }) {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen || !project) return;
    setError("");
    setFormData({
      title: project.title || "",
      domain: project.domain || "",
      technologyStacks: stacksToInput(project.technology_stacks),
      description: project.description || "",
      abstract: project.abstract || "",
    });
  }, [isOpen, project]);

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!project?.id) return;

    const normalizedTitle = String(formData.title || "").trim();
    const normalizedDescription = String(formData.description || "").trim();
    if (!normalizedTitle) {
      setError("Project title is required");
      return;
    }
    if (!normalizedDescription) {
      setError("Project description is required");
      return;
    }

    setError("");
    setSaving(true);
    try {
      const payload = buildProjectUpdatePayload(formData);

      const updatedProject = await apiRequest(`/projects/${project.id}`, {
        method: "PUT",
        body: payload,
      });
      onSaved?.({
        ...project,
        ...payload,
        ...(updatedProject && typeof updatedProject === "object" ? updatedProject : {}),
      });
      onClose?.();
    } catch (err) {
      setError(err.message || "Failed to update project");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Project Details">
      <form onSubmit={handleSubmit} noValidate className="p-6 space-y-5">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="project-title" className="block text-sm font-bold text-slate-900 mb-2">
            Project Title *
          </label>
          <input
            id="project-title"
            name="title"
            type="text"
            value={formData.title}
            onChange={handleChange}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all text-slate-900 placeholder:text-slate-400"
            placeholder="Enter your project title"
          />
        </div>

        <div>
          <label htmlFor="project-domain" className="block text-sm font-bold text-slate-900 mb-2">
            Domain / Category *
          </label>
          <input
            id="project-domain"
            name="domain"
            type="text"
            value={formData.domain}
            onChange={handleChange}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all text-slate-900 placeholder:text-slate-400"
            placeholder="e.g., AI & ML, Web Development, Cyber Security"
          />
        </div>

        <div>
          <label htmlFor="project-stacks" className="block text-sm font-bold text-slate-900 mb-2">
            Technology Stacks
          </label>
          <input
            id="project-stacks"
            name="technologyStacks"
            type="text"
            value={formData.technologyStacks}
            onChange={handleChange}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all text-slate-900 placeholder:text-slate-400"
            placeholder="React, Node.js, Supabase (comma separated)"
          />
        </div>

        <div>
          <label htmlFor="project-description" className="block text-sm font-bold text-slate-900 mb-2">
            Description *
          </label>
          <textarea
            id="project-description"
            name="description"
            rows={3}
            value={formData.description}
            onChange={handleChange}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all text-slate-900 placeholder:text-slate-400 resize-none"
            placeholder="Brief description of your project"
          />
        </div>

        <div>
          <label htmlFor="project-abstract" className="block text-sm font-bold text-slate-900 mb-2">
            Abstract
          </label>
          <textarea
            id="project-abstract"
            name="abstract"
            rows={4}
            value={formData.abstract}
            onChange={handleChange}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all text-slate-900 placeholder:text-slate-400 resize-none"
            placeholder="Detailed academic abstract"
          />
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 px-4 py-3 rounded-xl bg-slate-100 text-slate-700 font-bold text-sm hover:bg-slate-200 transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 px-4 py-3 rounded-xl text-black font-bold text-sm hover:opacity-90 transition-all shadow-md"
            style={{ backgroundColor: "#00D2C4" }}
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
