import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "../components/TopBar";
import ProfileMenu from "../components/ProfileMenu";
import CreateProjectModal from "../components/CreateProjectModal";
import JoinProjectModal from "../components/JoinProjectModal";
import JoinRequestsModal from "../components/JoinRequestsModal";
import ProjectTracker from "../components/ProjectTracker";
import ProfileSettingsModal from "../components/ProfileSettingsModal";
import NotificationPanel from "../components/NotificationPanel";
import supabase from "../config/supabaseClient";

function Pill({ children, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-50 text-slate-700 border-slate-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    rose: "bg-rose-50 text-rose-700 border-rose-200",
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

function DocStatus({ status }) {
  const s = (status || "missing").toLowerCase();
  if (s === "approved") return <Pill tone="emerald">approved</Pill>;
  if (s === "needs_revision") return <Pill tone="amber">needs revision</Pill>;
  if (s === "submitted") return <Pill tone="blue">submitted</Pill>;
  return <Pill tone="slate">missing</Pill>;
}

function StatCard({ label, value, icon, hint }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{value}</p>
          {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
        </div>
        <div
          className="size-11 rounded-xl flex items-center justify-center text-black"
          style={{ backgroundColor: '#00D2C4' }}
        >
          <span className="material-symbols-outlined">{icon}</span>
        </div>
      </div>
    </div>
  );
}

const DOC_TYPES = ["abstract", "report", "presentation", "progress_update"];

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [profile, setProfile] = useState(null);
  const [project, setProject] = useState(null);
  const [myRole, setMyRole] = useState(null);
  const [team, setTeam] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [evaluations, setEvaluations] = useState([]);

  // Modal states
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showJoinRequests, setShowJoinRequests] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);

  const loadData = async () => {
    setLoading(true);
    setError("");

    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;

      const user = userRes?.user;
      if (!user) throw new Error("Not signed in.");

      // Get profile
      const { data: p, error: pErr } = await supabase
        .from("profiles")
        .select("id, full_name, email, role, roll_number, semester, class_section, department")
        .eq("id", user.id)
        .single();
      if (pErr) throw pErr;

      setProfile(p);

      // Find project via team_members
      const { data: tmRows, error: tmErr } = await supabase
        .from("team_members")
        .select(`
          role,
          project:project_id (
            id, title, abstract, status, created_at, updated_at, mentor_id, coordinator_id
          )
        `)
        .eq("student_id", user.id)
        .limit(1);

      if (tmErr) throw tmErr;

      const tm = tmRows?.[0];
      const proj = tm?.project;

      if (!proj?.id) {
        // No project found - this is OK, show create/join options
        setLoading(false);
        return;
      }

      setProject(proj);
      setMyRole(tm?.role || "member");

      // Get team members
      const { data: teamRows, error: teamErr } = await supabase
        .from("team_members")
        .select(`
          id,
          role,
          joined_at,
          profiles:student_id ( id, full_name, email, roll_number )
        `)
        .eq("project_id", proj.id)
        .order("role", { ascending: true });

      console.log('🔍 Team members query for project:', proj.id);
      console.log('👤 Current user role:', tm?.role);
      console.log('📋 Team members fetched:', teamRows);
      console.log('❌ Team error:', teamErr);

      if (teamErr) throw teamErr;
      setTeam(teamRows || []);

      // Get documents
      const { data: docs, error: docsErr } = await supabase
        .from("documents")
        .select("id, project_id, document_type, file_name, file_url, status, version, uploaded_at, uploaded_by")
        .eq("project_id", proj.id)
        .order("uploaded_at", { ascending: false });

      if (docsErr) throw docsErr;
      setDocuments(docs || []);

      // Get evaluations
      const { data: evals, error: evalErr } = await supabase
        .from("evaluations")
        .select("id, project_id, evaluation_type, obtained_marks, max_marks, feedback, created_at")
        .eq("project_id", proj.id)
        .order("created_at", { ascending: false });

      if (evalErr) throw evalErr;
      setEvaluations(evals || []);
    } catch (e) {
      setError(e?.message || "Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/signin');
  };

  const handleProjectCreated = () => {
    loadData(); // Refresh data
  };

  const handleProjectJoined = () => {
    loadData(); // Refresh data
  };

  const handleProfileUpdated = () => {
    loadData(); // Refresh to get updated profile
  };

  const handleJoinRequestHandled = () => {
    loadData(); // Refresh to update team members
  };

  // Generate notifications from documents, evaluations, and join requests
  useEffect(() => {
    const loadNotifications = async () => {
      const newNotifications = [];

      // Document status notifications
      documents.forEach((doc) => {
        if (doc.status === 'approved') {
          newNotifications.push({
            id: `doc-${doc.id}`,
            type: 'document_approved',
            title: 'Document Approved',
            message: `Your ${doc.document_type.replace('_', ' ')} has been approved by your mentor.`,
            created_at: doc.updated_at || doc.uploaded_at,
            read: false,
          });
        } else if (doc.status === 'needs_revision') {
          newNotifications.push({
            id: `doc-${doc.id}`,
            type: 'document_rejected',
            title: 'Revision Required',
            message: `Your ${doc.document_type.replace('_', ' ')} needs revision. ${doc.feedback || ''}`,
            created_at: doc.updated_at || doc.uploaded_at,
            read: false,
          });
        }
      });

      // Evaluation notifications
      evaluations.forEach((evaluation) => {
        newNotifications.push({
          id: `eval-${evaluation.id}`,
          type: 'evaluation',
          title: 'New Evaluation',
          message: `You received ${evaluation.obtained_marks}/${evaluation.max_marks} marks for ${evaluation.evaluation_type}.`,
          created_at: evaluation.created_at,
          read: false,
        });
      });

      // Join request notifications (for leaders only)
      if (myRole === 'leader') {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            // Get projects where user is leader
            const { data: leaderProjects } = await supabase
              .from('team_members')
              .select('project_id')
              .eq('student_id', user.id)
              .eq('role', 'leader');

            if (leaderProjects && leaderProjects.length > 0) {
              const projectIds = leaderProjects.map(p => p.project_id);

              // Get pending join requests
              const { data: requests } = await supabase
                .from('join_requests')
                .select(`
                  *,
                  project:projects(title),
                  student:profiles!student_id(full_name)
                `)
                .in('project_id', projectIds)
                .eq('status', 'pending');

              requests?.forEach((req) => {
                newNotifications.push({
                  id: `join-req-${req.id}`,
                  type: 'join_request',
                  title: 'New Join Request',
                  message: `${req.student?.full_name || 'A student'} wants to join "${req.project?.title || 'your project'}"`,
                  created_at: req.created_at,
                  read: false,
                  metadata: { requestId: req.id },
                });
              });
            }
          }
        } catch (err) {
          console.error('Failed to load join request notifications:', err);
        }
      }

      // Sort by date (newest first)
      newNotifications.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setNotifications(newNotifications);
    };

    loadNotifications();
  }, [documents, evaluations, myRole]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleNotificationClick = (notification) => {
    // Open JoinRequestsModal for join request notifications
    if (notification.type === 'join_request') {
      setShowJoinRequests(true);
      setShowNotifications(false);
    }
    // Add more handlers for other notification types as needed
  };

  // Latest doc per type
  const latestDocByType = useMemo(() => {
    const map = {};
    for (const t of DOC_TYPES) map[t] = null;
    for (const doc of documents) {
      if (!map[doc.document_type]) map[doc.document_type] = doc;
    }
    return map;
  }, [documents]);

  const docSummary = useMemo(() => {
    const latestDocs = DOC_TYPES.map((t) => latestDocByType[t]).filter(Boolean);
    const submitted = latestDocs.filter((d) => (d.status || "").toLowerCase() === "submitted").length;
    const approved = latestDocs.filter((d) => (d.status || "").toLowerCase() === "approved").length;
    const needsRevision = latestDocs.filter((d) => (d.status || "").toLowerCase() === "needs_revision").length;
    const missing = DOC_TYPES.length - latestDocs.length;
    return { submitted, approved, needsRevision, missing };
  }, [latestDocByType]);

  const latestEvaluation = evaluations[0];
  const latestScore =
    latestEvaluation && latestEvaluation.obtained_marks != null && latestEvaluation.max_marks != null
      ? `${latestEvaluation.obtained_marks}/${latestEvaluation.max_marks}`
      : "—";

  // LOADING STATE
  if (loading) {
    return (
      <div className="min-h-full bg-background-light flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block size-12 border-4 border-slate-200 border-t-[#00D2C4] rounded-full animate-spin"></div>
          <p className="mt-4 text-slate-600 font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // NO PROJECT STATE
  if (!project) {
    return (
      <div className="min-h-full bg-background-light">
        <TopBar
          title="Student Dashboard"
          subtitle="Home"
          profile={profile}
          onProfileClick={() => setShowProfileMenu(!showProfileMenu)}
          notificationCount={unreadCount}
          onNotificationClick={() => setShowNotifications(!showNotifications)}
        />

        {showNotifications && (
          <div className="fixed top-16 right-32 z-50">
            <NotificationPanel
              isOpen={showNotifications}
              onClose={() => setShowNotifications(false)}
              notifications={notifications}
              onMarkAsRead={handleMarkAllAsRead}
              onNotificationClick={handleNotificationClick}
            />
          </div>
        )}

        {showProfileMenu && (
          <div className="fixed top-16 right-8 z-50">
            <ProfileMenu
              profile={profile}
              isOpen={showProfileMenu}
              onClose={() => setShowProfileMenu(false)}
              onLogout={handleLogout}
              onEditProfile={() => setShowSettingsModal(true)}
            />
          </div>
        )}

        <ProfileSettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          profile={profile}
          onSuccess={handleProfileUpdated}
        />

        <CreateProjectModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleProjectCreated}
        />

        <JoinProjectModal
          isOpen={showJoinModal}
          onClose={() => setShowJoinModal(false)}
          onSuccess={handleProjectJoined}
        />

        <JoinRequestsModal
          isOpen={showJoinRequests}
          onClose={() => setShowJoinRequests(false)}
          onRequestHandled={handleJoinRequestHandled}
        />

        <div className="px-6 md:px-8 py-6">
          {error && (
            <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          {/* Welcome Header */}
          <div className="mb-8">
            <h1 className="text-2xl md:text-3xl font-black text-slate-900">
              Welcome!{profile?.full_name ? `, ${profile.full_name}` : ""}
            </h1>
            <p className="text-slate-500 mt-1">
              You haven't joined or created a project yet. Get started below!
            </p>
          </div>

          {/* CTA Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
            {/* Create Project Card */}
            <div className="rounded-2xl border-2 border-slate-200 bg-white p-8 hover:border-teal-300 hover:shadow-md transition-all">
              <div
                className="size-16 rounded-2xl flex items-center justify-center text-black mb-4"
                style={{ backgroundColor: '#00D2C4' }}
              >
                <span className="material-symbols-outlined text-4xl">add_circle</span>
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">Create New Project</h3>
              <p className="text-sm text-slate-600 mb-4">
                Start your own project and invite team members to collaborate
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="w-full py-3 rounded-xl text-black font-bold text-sm hover:opacity-90 transition-all shadow-md"
                style={{ backgroundColor: '#00D2C4' }}
              >
                Create Project
              </button>
            </div>

            {/* Join Project Card */}
            <div className="rounded-2xl border-2 border-slate-200 bg-white p-8 hover:border-teal-300 hover:shadow-md transition-all">
              <div
                className="size-16 rounded-2xl flex items-center justify-center text-black mb-4"
                style={{ backgroundColor: '#00D2C4' }}
              >
                <span className="material-symbols-outlined text-4xl">group_add</span>
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">Join Existing Project</h3>
              <p className="text-sm text-slate-600 mb-4">
                Browse available projects and join a team that matches your interests
              </p>
              <button
                onClick={() => setShowJoinModal(true)}
                className="w-full py-3 rounded-xl bg-slate-900 text-white font-bold text-sm hover:opacity-95 transition-all"
              >
                Browse Projects
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // HAS PROJECT STATE
  return (
    <div className="min-h-full bg-background-light">
      <TopBar
        title="Student Dashboard"
        subtitle="Home"
        profile={profile}
        onProfileClick={() => setShowProfileMenu(!showProfileMenu)}
        notificationCount={unreadCount}
        onNotificationClick={() => setShowNotifications(!showNotifications)}
      />

      {showNotifications && (
        <div className="fixed top-16 right-32 z-50">
          <NotificationPanel
            isOpen={showNotifications}
            onClose={() => setShowNotifications(false)}
            notifications={notifications}
            onMarkAsRead={handleMarkAllAsRead}
            onNotificationClick={handleNotificationClick}
          />
        </div>
      )}

      {showProfileMenu && (
        <div className="fixed top-16 right-8 z-50">
          <ProfileMenu
            profile={profile}
            isOpen={showProfileMenu}
            onClose={() => setShowProfileMenu(false)}
            onLogout={handleLogout}
            onEditProfile={() => setShowSettingsModal(true)}
          />
        </div>
      )}

      <ProfileSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        profile={profile}
        onSuccess={handleProfileUpdated}
      />

      <JoinRequestsModal
        isOpen={showJoinRequests}
        onClose={() => setShowJoinRequests(false)}
        onRequestHandled={handleJoinRequestHandled}
      />

      <div className="px-6 md:px-8 py-6">
        {error && (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900">
              {loading ? "Loading..." : `Welcome${profile?.full_name ? `, ${profile.full_name}` : ""}`}
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Role: <span className="font-bold text-slate-700">{myRole || "member"}</span>
              {" • "}
              Roll No: <span className="font-bold text-slate-700">{profile?.roll_number || "—"}</span>
              {" • "}
              Semester: <span className="font-bold text-slate-700">{profile?.semester ?? "—"}</span>
            </p>
          </div>


        </div>

        {/* Project overview card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm mb-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">My Project</p>
              <h2 className="mt-2 text-xl md:text-2xl font-black text-slate-900">
                {project?.title || "—"}
              </h2>
              {project?.abstract ? (
                <p className="mt-2 text-sm text-slate-600 max-w-3xl line-clamp-2">
                  {project.abstract}
                </p>
              ) : (
                <p className="mt-2 text-sm text-slate-500">Abstract not added yet.</p>
              )}
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <span className="material-symbols-outlined text-base">event</span>
                  Created: {project?.created_at ? new Date(project.created_at).toLocaleDateString() : "—"}
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="material-symbols-outlined text-base">schedule</span>
                  Updated: {project?.updated_at ? new Date(project.updated_at).toLocaleDateString() : "—"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <ProjectStatus status={project?.status} />
              <Pill tone="slate">{team.length || 0}/4 members</Pill>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <StatCard label="Docs Approved" value={docSummary.approved} icon="task_alt" hint="Checklist items done" />
          <StatCard label="Pending Review" value={docSummary.submitted} icon="hourglass_top" hint="Waiting mentor action" />
          <StatCard label="Needs Revision" value={docSummary.needsRevision} icon="edit_document" hint="Fix & resubmit" />
          <StatCard label="Latest Score" value={latestScore} icon="emoji_events" hint={latestEvaluation?.evaluation_type || "No evaluation yet"} />
        </div>

        {/* Project Tracker - Horizontal Timeline */}
        <ProjectTracker project={project} documents={documents} />

        {/* Main grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Document checklist */}
          <section className="xl:col-span-2 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-black text-slate-900">Submission Checklist</h3>
              <span className="text-xs font-bold text-slate-500">latest per type</span>
            </div>

            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
              {DOC_TYPES.map((t) => {
                const d = latestDocByType[t];
                return (
                  <div key={t} className="rounded-xl border border-slate-200 p-4 hover:border-slate-300 transition-all">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-black text-slate-900 capitalize">
                            {t.replaceAll("_", " ")}
                          </p>
                          <DocStatus status={d?.status || "missing"} />
                        </div>
                        <p className="text-xs text-slate-500 truncate">
                          {d ? d.file_name : "No file uploaded yet"}
                        </p>
                        {d?.uploaded_at && (
                          <p className="text-[11px] text-slate-400 mt-1">
                            v{d.version ?? 1} • {new Date(d.uploaded_at).toLocaleString()}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {d?.file_url && (
                          <a
                            href={d.file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="size-8 rounded-lg border border-slate-200 flex items-center justify-center hover:border-teal-500 hover:bg-teal-50 transition-all group"
                            title="View file"
                          >
                            <span className="material-symbols-outlined text-lg text-slate-600 group-hover:text-teal-600">
                              visibility
                            </span>
                          </a>
                        )}

                        <button
                          className="size-8 rounded-lg flex items-center justify-center transition-all"
                          style={{
                            backgroundColor: d?.file_url ? '#f1f5f9' : '#00D2C4',
                            border: d?.file_url ? '1px solid #e2e8f0' : 'none'
                          }}
                          title={d?.file_url ? 'Re-upload file' : 'Upload file'}
                        >
                          <span
                            className="material-symbols-outlined text-lg"
                            style={{ color: d?.file_url ? '#475569' : '#000' }}
                          >
                            {d?.file_url ? 'sync' : 'upload'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Team card */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="px-5 py-4 border-b border-slate-200">
              <h3 className="font-black text-slate-900">My Team</h3>
              <p className="text-xs text-slate-500 mt-1">4 members</p>
            </div>

            <div className="p-5 space-y-3">
              {loading ? (
                <p className="text-sm text-slate-500">Loading team...</p>
              ) : team.length === 0 ? (
                <p className="text-sm text-slate-500">No team members found.</p>
              ) : (
                team.map((m) => (
                  <div key={m.id} className="rounded-xl border border-slate-200 p-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-slate-900">
                        {m.profiles?.full_name || "Unnamed"}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {m.profiles?.roll_number ? `Roll: ${m.profiles.roll_number}` : m.profiles?.email}
                      </p>
                    </div>
                    <Pill tone={m.role === "leader" ? "emerald" : "slate"}>
                      {m.role}
                    </Pill>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Evaluations */}
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-black text-slate-900">Evaluations</h3>
            <span className="text-xs font-bold text-slate-500">{evaluations.length} records</span>
          </div>

          <div className="p-5">
            {loading ? (
              <p className="text-sm text-slate-500">Loading evaluations...</p>
            ) : evaluations.length === 0 ? (
              <p className="text-sm text-slate-500">No evaluations yet.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {evaluations.slice(0, 4).map((e) => (
                  <div key={e.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-slate-900 capitalize">
                          {e.evaluation_type.replaceAll("_", " ")}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {e.created_at ? new Date(e.created_at).toLocaleString() : "—"}
                        </p>
                      </div>
                      <Pill tone="blue">
                        {e.obtained_marks}/{e.max_marks}
                      </Pill>
                    </div>
                    {e.feedback && (
                      <p className="mt-2 text-xs text-slate-600 line-clamp-2">
                        Feedback: <span className="text-slate-500">{e.feedback}</span>
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
