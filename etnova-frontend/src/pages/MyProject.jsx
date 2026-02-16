import { useEffect, useState } from "react";
import supabase from "../config/supabaseClient";

function Pill({ children, tone = "slate" }) {
    const tones = {
        slate: "bg-slate-50 text-slate-700 border-slate-200",
        blue: "bg-blue-50 text-blue-700 border-blue-200",
        amber: "bg-amber-50 text-amber-700 border-amber-200",
        emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
        rose: "bg-rose-50 text-rose-700 border-rose-200",
        cyan: "bg-cyan-50 text-cyan-700 border-cyan-200",
    };
    return (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${tones[tone]}`}>
            {children}
        </span>
    );
}

function ProjectStatus({ status }) {
    const s = (status || "pending").toLowerCase();
    if (s === "approved") return <Pill tone="emerald">approved</Pill>;
    if (s === "rejected") return <Pill tone="rose">rejected</Pill>;
    if (s === "completed") return <Pill tone="blue">completed</Pill>;
    return <Pill tone="amber">pending</Pill>;
}

export default function MyProject() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [project, setProject] = useState(null);
    const [team, setTeam] = useState([]);
    const [myRole, setMyRole] = useState(null);
    const [mentor, setMentor] = useState(null);
    const [coordinator, setCoordinator] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({ title: "", abstract: "", description: "" });
    const [saving, setSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    // Expandable sections state
    const [expandedSections, setExpandedSections] = useState({
        problemStatement: true,
        objectives: false,
        methodology: false,
    });

    const toggleSection = (section) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const loadProjectData = async () => {
        setLoading(true);
        setError("");

        try {
            const { data: userRes, error: userErr } = await supabase.auth.getUser();
            if (userErr) throw userErr;

            const user = userRes?.user;
            if (!user) throw new Error("Not signed in.");

            // Find project via team_members
            const { data: tmRows, error: tmErr } = await supabase
                .from("team_members")
                .select(`
          role,
          project:project_id (
            id, title, abstract, description, status, created_at, updated_at, mentor_id, coordinator_id
          )
        `)
                .eq("student_id", user.id)
                .limit(1);

            if (tmErr) throw tmErr;

            const tm = tmRows?.[0];
            const proj = tm?.project;

            if (!proj?.id) {
                setLoading(false);
                return;
            }

            setProject(proj);
            setMyRole(tm?.role || "member");
            setEditForm({
                title: proj.title || "",
                abstract: proj.abstract || "",
                description: proj.description || "",
            });

            // Get team members
            const { data: teamRows, error: teamErr } = await supabase
                .from("team_members")
                .select(`
          id,
          role,
          joined_at,
          profiles:student_id ( id, full_name, email, roll_number, semester, department, phone )
        `)
                .eq("project_id", proj.id)
                .order("role", { ascending: true });

            if (teamErr) throw teamErr;
            setTeam(teamRows || []);

            // Get mentor info
            if (proj.mentor_id) {
                const { data: mentorData } = await supabase
                    .from("profiles")
                    .select("id, full_name, email, phone, department, role")
                    .eq("id", proj.mentor_id)
                    .single();
                setMentor(mentorData);
            }

            // Get coordinator info
            if (proj.coordinator_id) {
                const { data: coordData } = await supabase
                    .from("profiles")
                    .select("id, full_name, email, phone, department, role")
                    .eq("id", proj.coordinator_id)
                    .single();
                setCoordinator(coordData);
            }
        } catch (e) {
            setError(e?.message || "Failed to load project data.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadProjectData();
    }, []);

    const handleSaveChanges = async () => {
        if (!project?.id) return;

        setSaving(true);
        setError("");

        try {
            const { error: updateErr } = await supabase
                .from("projects")
                .update({
                    title: editForm.title,
                    abstract: editForm.abstract,
                    description: editForm.description,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", project.id);

            if (updateErr) throw updateErr;

            await loadProjectData();
            setIsEditing(false);
        } catch (e) {
            setError(e?.message || "Failed to save changes.");
        } finally {
            setSaving(false);
        }
    };

    const handleCancelEdit = () => {
        setEditForm({
            title: project.title || "",
            abstract: project.abstract || "",
            description: project.description || "",
        });
        setIsEditing(false);
    };

    // LOADING STATE
    if (loading) {
        return (
            <div className="min-h-screen bg-background-light flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-block size-12 border-4 border-slate-200 border-t-[#00D2C4] rounded-full animate-spin"></div>
                    <p className="mt-4 text-slate-600 font-medium">Loading project...</p>
                </div>
            </div>
        );
    }

    // NO PROJECT STATE
    if (!project) {
        return (
            <div className="min-h-screen bg-background-light p-6 md:p-8">
                <div className="max-w-4xl mx-auto">
                    <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-12 text-center">
                        <div
                            className="size-20 rounded-2xl flex items-center justify-center text-black mx-auto mb-6"
                            style={{ backgroundColor: '#00D2C4' }}
                        >
                            <span className="material-symbols-outlined text-5xl">folder_off</span>
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 mb-2">No Project Found</h2>
                        <p className="text-slate-600 mb-6">
                            You haven't created or joined a project yet. Head back to the dashboard to get started.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // HAS PROJECT STATE
    return (
        <div className="min-h-screen bg-background-light">
            {/* Top Bar with Breadcrumb and Search */}
            <div className="bg-white border-b border-slate-200 px-6 md:px-8 py-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    {/* Breadcrumb */}
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                        <button className="hover:text-slate-900 font-medium">Home</button>
                        <span className="material-symbols-outlined text-slate-400 text-sm">chevron_right</span>
                        <span className="text-slate-900 font-bold">My Project</span>
                    </div>

                    {/* Search Bar */}
                    <div className="relative max-w-md w-full">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                            search
                        </span>
                        <input
                            type="text"
                            placeholder="Search files..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-50 border border-slate-200 focus:border-[#00D2C4] focus:ring-2 focus:ring-[#00D2C4]/20 outline-none text-sm"
                        />
                    </div>
                </div>
            </div>

            <div className="px-6 md:px-8 py-6">
                {error && (
                    <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 flex items-center gap-2">
                        <span className="material-symbols-outlined text-lg">error</span>
                        {error}
                    </div>
                )}

                {/* Project Header */}
                <div className="mb-6">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-3">
                        <div className="flex-1">
                            <h1 className="text-2xl md:text-3xl font-black text-slate-900 mb-2">
                                {project.title || "Untitled Project"}
                            </h1>
                            <div className="flex flex-wrap items-center gap-3">
                                <Pill tone="slate">Project ID: ET-2024-{project.id.slice(0, 6)}</Pill>
                                <Pill tone="amber">Phase 1: Implementation</Pill>
                                <ProjectStatus status={project?.status} />
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setIsEditing(!isEditing)}
                                className="px-4 py-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 font-bold text-sm transition-all flex items-center gap-2"
                            >
                                <span className="material-symbols-outlined text-lg">edit</span>
                                Edit Basic Info
                            </button>
                            <button
                                className="px-4 py-2.5 rounded-lg text-white font-bold text-sm hover:opacity-90 transition-all shadow-sm flex items-center gap-2"
                                style={{ backgroundColor: '#00D2C4' }}
                            >
                                <span className="material-symbols-outlined text-lg">share</span>
                                Share Repository
                            </button>
                        </div>
                    </div>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    {/* Left Column - Project Details */}
                    <div className="xl:col-span-2 space-y-6">
                        {/* Project Information Card */}
                        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                            <div className="px-5 py-4 border-b border-slate-200">
                                <h3 className="font-black text-slate-900">Project Information</h3>
                            </div>

                            <div className="p-5 space-y-5">
                                {/* Abstract */}
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                                        Abstract
                                    </label>
                                    {isEditing ? (
                                        <textarea
                                            value={editForm.abstract}
                                            onChange={(e) => setEditForm({ ...editForm, abstract: e.target.value })}
                                            rows={4}
                                            className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:border-[#00D2C4] focus:ring-2 focus:ring-[#00D2C4]/20 outline-none text-slate-700 resize-none text-sm"
                                            placeholder="Brief overview of your project..."
                                        />
                                    ) : (
                                        <p className="text-sm text-slate-700 leading-relaxed">
                                            {project.abstract || "No abstract provided yet."}
                                        </p>
                                    )}
                                </div>

                                {/* Assigned Mentor and Coordinator */}
                                {(mentor || coordinator) && !isEditing && (
                                    <div className="flex flex-wrap gap-3">
                                        {mentor && (
                                            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-cyan-50 border border-cyan-200">
                                                <div className="size-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: '#00D2C4' }}>
                                                    {mentor.full_name?.charAt(0) || 'M'}
                                                </div>
                                                <div>
                                                    <p className="text-[10px] uppercase tracking-wider text-cyan-600 font-bold">Assigned Mentor</p>
                                                    <p className="text-xs font-bold text-cyan-900">{mentor.full_name}</p>
                                                </div>
                                            </div>
                                        )}
                                        {coordinator && (
                                            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200">
                                                <div className="size-6 rounded-full flex items-center justify-center text-xs font-bold text-white bg-emerald-500">
                                                    {coordinator.full_name?.charAt(0) || 'C'}
                                                </div>
                                                <div>
                                                    <p className="text-[10px] uppercase tracking-wider text-emerald-600 font-bold">Coordinator</p>
                                                    <p className="text-xs font-bold text-emerald-900">{coordinator.full_name}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Edit Actions */}
                                {isEditing && (
                                    <div className="flex items-center gap-3 pt-2">
                                        <button
                                            onClick={handleSaveChanges}
                                            disabled={saving}
                                            className="px-5 py-2.5 rounded-lg text-black font-bold text-sm hover:opacity-90 transition-all shadow-sm disabled:opacity-50"
                                            style={{ backgroundColor: '#00D2C4' }}
                                        >
                                            {saving ? "Saving..." : "Save Changes"}
                                        </button>
                                        <button
                                            onClick={handleCancelEdit}
                                            disabled={saving}
                                            className="px-5 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-bold text-sm hover:bg-slate-50 transition-all disabled:opacity-50"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Detailed Description with Expandable Sections */}
                        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                            <div className="px-5 py-4 border-b border-slate-200">
                                <h3 className="font-black text-slate-900">Detailed Description</h3>
                            </div>

                            <div className="p-5 space-y-3">
                                {/* Problem Statement */}
                                <div className="rounded-xl border border-slate-200 overflow-hidden">
                                    <button
                                        onClick={() => toggleSection('problemStatement')}
                                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-all"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-rose-500">error</span>
                                            <span className="font-bold text-slate-900 text-sm">Problem Statement</span>
                                        </div>
                                        <span className={`material-symbols-outlined text-slate-400 transition-transform ${expandedSections.problemStatement ? 'rotate-180' : ''}`}>
                                            expand_more
                                        </span>
                                    </button>
                                    {expandedSections.problemStatement && (
                                        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200">
                                            <p className="text-sm text-slate-700 leading-relaxed">
                                                {project.description || "Academic institutions struggle with scaling personalized feedback in large cohorts. Current automated tools are limited to MCQ formats, failing to capture critical thinking and complex problem-solving abilities in written assignments. This results in delayed feedback cycles and inconsistent grading across different teaching assistants."}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Project Objectives */}
                                <div className="rounded-xl border border-slate-200 overflow-hidden">
                                    <button
                                        onClick={() => toggleSection('objectives')}
                                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-all"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-blue-500">target</span>
                                            <span className="font-bold text-slate-900 text-sm">Project Objectives</span>
                                        </div>
                                        <span className={`material-symbols-outlined text-slate-400 transition-transform ${expandedSections.objectives ? 'rotate-180' : ''}`}>
                                            expand_more
                                        </span>
                                    </button>
                                    {expandedSections.objectives && (
                                        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200">
                                            <ul className="text-sm text-slate-700 leading-relaxed space-y-2 list-disc list-inside">
                                                <li>Develop an AI-powered assessment system using Large Language Models</li>
                                                <li>Provide real-time, personalized feedback to students</li>
                                                <li>Maintain high rubric consistency across evaluations</li>
                                                <li>Minimize instructor bias through automated grading</li>
                                            </ul>
                                        </div>
                                    )}
                                </div>

                                {/* Methodology */}
                                <div className="rounded-xl border border-slate-200 overflow-hidden">
                                    <button
                                        onClick={() => toggleSection('methodology')}
                                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-all"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-purple-500">science</span>
                                            <span className="font-bold text-slate-900 text-sm">Methodology</span>
                                        </div>
                                        <span className={`material-symbols-outlined text-slate-400 transition-transform ${expandedSections.methodology ? 'rotate-180' : ''}`}>
                                            expand_more
                                        </span>
                                    </button>
                                    {expandedSections.methodology && (
                                        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200">
                                            <p className="text-sm text-slate-700 leading-relaxed">
                                                The project will utilize a multi-agent orchestration layer with LLM integration for automated assessment. The system architecture includes a rubric parser, answer evaluator, and feedback generator module.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Mentor Contact & Actions */}
                    <div className="space-y-6">
                        {/* Mentor Contact Card */}
                        {mentor && (
                            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                                    <h3 className="font-black text-slate-900">Mentor Contact</h3>
                                    <button className="size-8 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-lg text-slate-600">more_vert</span>
                                    </button>
                                </div>

                                <div className="p-5">
                                    {/* Avatar */}
                                    <div className="flex justify-center mb-4">
                                        <div className="size-24 rounded-full flex items-center justify-center text-3xl font-black text-white" style={{ backgroundColor: '#00D2C4' }}>
                                            {mentor.full_name?.split(' ').map(n => n[0]).join('') || 'M'}
                                        </div>
                                    </div>

                                    {/* Mentor Info */}
                                    <div className="text-center mb-4">
                                        <h4 className="text-lg font-black text-slate-900 mb-1">{mentor.full_name}</h4>
                                        <p className="text-sm font-bold" style={{ color: '#00D2C4' }}>
                                            Associate Professor, {mentor.department || 'CSE'} Dept.
                                        </p>
                                    </div>

                                    {/* Contact Details */}
                                    <div className="space-y-3 mb-5">
                                        {mentor.email && (
                                            <div className="flex items-center gap-3 text-sm text-slate-600">
                                                <span className="material-symbols-outlined text-slate-400">email</span>
                                                <span className="truncate">{mentor.email}</span>
                                            </div>
                                        )}
                                        {mentor.phone && (
                                            <div className="flex items-center gap-3 text-sm text-slate-600">
                                                <span className="material-symbols-outlined text-slate-400">call</span>
                                                <span>{mentor.phone}</span>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-3 text-sm text-slate-600">
                                            <span className="material-symbols-outlined text-slate-400">location_on</span>
                                            <span>Academic Block B, Room 402</span>
                                        </div>
                                    </div>

                                    {/* Book Consultation Button */}
                                    <button className="w-full px-4 py-3 rounded-lg bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 transition-all flex items-center justify-center gap-2">
                                        <span className="material-symbols-outlined">event</span>
                                        Book Consultation
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Need to Change Project */}
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 shadow-sm p-5">
                            <h3 className="font-black text-amber-900 mb-2">Need to change your project?</h3>
                            <p className="text-xs text-amber-700 mb-3 leading-relaxed">
                                Requests for project title changes are accepted until Phase 1: Approval from both Mentor and HoD is required.
                            </p>
                            <button className="text-xs font-bold hover:underline" style={{ color: '#00D2C4' }}>
                                Submit Change Request →
                            </button>
                        </div>

                        {/* Team Members */}
                        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                            <div className="px-5 py-4 border-b border-slate-200">
                                <h3 className="font-black text-slate-900">Team Members</h3>
                                <p className="text-xs text-slate-500 mt-1">{team.length}/4 members</p>
                            </div>

                            <div className="p-5 space-y-3">
                                {team.length === 0 ? (
                                    <p className="text-sm text-slate-500">No team members found.</p>
                                ) : (
                                    team.map((m) => (
                                        <div key={m.id} className="rounded-xl border border-slate-200 p-3">
                                            <div className="flex items-start justify-between gap-3 mb-2">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-black text-slate-900 truncate">
                                                        {m.profiles?.full_name || "Unnamed"}
                                                    </p>
                                                    <p className="text-xs text-slate-500 mt-0.5">
                                                        {m.profiles?.roll_number || m.profiles?.email || "—"}
                                                    </p>
                                                </div>
                                                <Pill tone={m.role === "leader" ? "emerald" : "slate"}>
                                                    {m.role}
                                                </Pill>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
