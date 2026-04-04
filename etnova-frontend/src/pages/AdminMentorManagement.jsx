import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import supabase from "../lib/supabase";
import { apiRequest } from "../config/apiClient";
import useAdminAuth from "../hooks/useAdminAuth";
import useAdminProfilePanel from "../hooks/useAdminProfilePanel";
import AppFrame from "../components/AppFrame";
import Sidebar from "../components/admin/Sidebar";
import TopNavbar from "../components/admin/TopNavbar";
import MentorStatCard from "../components/admin/MentorStatCard";
import MentorTable from "../components/admin/MentorTable";
import EditRoleModal from "../components/admin/EditRoleModal";
import AdminProfileSettingsModal from "../components/admin/AdminProfileSettingsModal";
import ProfileMenu from "../components/ProfileMenu";
import { createNotifications, formatClassNotificationLabel } from "../utils/notificationHelpers";
import { subscribeWithDeferredCleanup } from "../utils/realtimeChannel";

const ADMIN_NAME = "Meenakshi";
const IMPORT_PREVIEW_STORAGE_KEY = "etnova_admin_mentor_import_preview";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (value) => typeof value === "string" && UUID_REGEX.test(value);
let mentorEvalColumnStrategy = null;

function projectClassName(project) {
  if (!project) return "Unknown Class";
  if (Array.isArray(project.classes)) return project.classes[0]?.class_section || project.classes[0]?.class_name || "Unknown Class";
  return project.classes?.class_section || project.classes?.class_name || "Unknown Class";
}

async function fetchMentorEvaluationsByMentorId(mentorId) {
  const evaluatorColumns = mentorEvalColumnStrategy ? [mentorEvalColumnStrategy] : ["evaluator_id", "guide_id"];

  for (const evaluatorColumn of evaluatorColumns) {
    const { data, error } = await supabase
      .from("evaluations")
      .select(`
        *,
        projects:project_id (
          id,
          title,
          class_id,
          classes:class_id (
            class_name:class_section
          )
        )
      `)
      .eq(evaluatorColumn, mentorId);

    if (error) continue;
    mentorEvalColumnStrategy = evaluatorColumn;
    return data || [];
  }

  return [];
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsText(file);
  });
}

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsArrayBuffer(file);
  });
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
}

export default function AdminMentorManagement() {
  useAdminAuth();
  const navigate = useNavigate();
  const {
    adminProfile,
    showProfileMenu,
    setShowProfileMenu,
    showProfileSettings,
    setShowProfileSettings,
    refreshAdminProfile,
  } = useAdminProfilePanel();
  const [mentors, setMentors] = useState([]);
  const [projects, setProjects] = useState([]);
  const [mentorRows, setMentorRows] = useState([]);
  const [classes, setClasses] = useState([]);
  const [roleFilter, setRoleFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [editingMentor, setEditingMentor] = useState(null);
  const [editingRoles, setEditingRoles] = useState([]);
  const [editingClassId, setEditingClassId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [importFileName, setImportFileName] = useState("");
  const [importNotice, setImportNotice] = useState("");
  const [importSkipped, setImportSkipped] = useState([]);
  const [importPreview, setImportPreview] = useState([]);
  const [importMeta, setImportMeta] = useState({
    extractedCount: 0,
    mentorCount: 0,
    adminCount: 0,
    validMentorCount: 0,
    createCount: 0,
    updateCount: 0,
    skipCount: 0,
  });
  const [showImportPreview, setShowImportPreview] = useState(true);
  const [extractingImport, setExtractingImport] = useState(false);
  const [pendingImportRows, setPendingImportRows] = useState([]);
  const [confirmingImport, setConfirmingImport] = useState(false);
  const [selectedMentorId, setSelectedMentorId] = useState("");
  const [workloadOpen, setWorkloadOpen] = useState(true);
  const [workloadLoading, setWorkloadLoading] = useState(false);
  const [workload, setWorkload] = useState({
    guidance: [],
    coordination: [],
    evaluations: [],
    stageBreakdown: [],
    summary: {
      guidanceTeams: 0,
      coordinationAssignments: 0,
      totalEvaluations: 0,
      completedEvaluations: 0,
      pendingEvaluations: 0,
    },
  });

  const fetchData = useCallback(async (force = false) => {
    setLoading(true);
    setError("");
    try {
      const data = await apiRequest("/admin/mentor-management-data", force ? { skipCache: true } : {});
      setMentors(data?.mentors || []);
      setClasses(data?.classes || []);
      setProjects(data?.projects || []);
    } catch (err) {
      setMentors([]);
      setClasses([]);
      setProjects([]);
      setError(err.message || "Failed to load mentors.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(IMPORT_PREVIEW_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      setImportFileName(saved?.importFileName || "");
      setImportNotice(saved?.importNotice || "");
      setImportSkipped(Array.isArray(saved?.importSkipped) ? saved.importSkipped : []);
      setImportPreview(Array.isArray(saved?.importPreview) ? saved.importPreview : []);
      setPendingImportRows(Array.isArray(saved?.pendingImportRows) ? saved.pendingImportRows : []);
      setImportMeta(saved?.importMeta || {
        extractedCount: 0,
        mentorCount: 0,
        adminCount: 0,
        validMentorCount: 0,
        createCount: 0,
        updateCount: 0,
        skipCount: 0,
      });
      setShowImportPreview(saved?.showImportPreview !== false);
    } catch {
      window.localStorage.removeItem(IMPORT_PREVIEW_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    const payload = {
      importFileName,
      importNotice,
      importSkipped,
      importPreview,
      pendingImportRows,
      importMeta,
      showImportPreview,
    };
    window.localStorage.setItem(IMPORT_PREVIEW_STORAGE_KEY, JSON.stringify(payload));
  }, [importFileName, importNotice, importSkipped, importPreview, pendingImportRows, importMeta, showImportPreview]);

  useEffect(() => {
    const workload = new Map();
    (projects || []).forEach((row) => {
      if (!row.guide_id) return;
      workload.set(row.guide_id, (workload.get(row.guide_id) || 0) + 1);
    });

    const classNameById = new Map((classes || []).map((item) => [item.id, item.class_section || item.class_name]));
    const normalized = (mentors || []).map((mentor) => ({
      id: mentor.id,
      name: mentor.full_name || "Unnamed Mentor",
      email: mentor.email || "-",
      designation: mentor.designation || "",
      classId: mentor.class_id || null,
      className: classNameById.get(mentor.class_id) || "",
      isCoordinator: Boolean(mentor.is_coordinator),
      roles: [
        ...(mentor.designation === "guide" ? ["Guide"] : []),
        ...(mentor.is_coordinator ? ["Coordinator"] : []),
      ],
      assignedTeams: workload.get(mentor.id) || 0,
      status: "Active",
    }));

    setMentorRows(normalized);
  }, [classes, mentors, projects]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const onFocus = () => {
      fetchData(true);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchData(true);
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    const channel = supabase
      .channel("mentor-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => fetchData(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, () => fetchData(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "classes" }, () => fetchData(true));

    const cleanupRealtime = subscribeWithDeferredCleanup(supabase, channel);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      cleanupRealtime();
    };
  }, [fetchData]);

  const filteredMentors = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return mentorRows.filter((mentor) => {
      const filterPass = roleFilter === "All" || mentor.roles.includes(roleFilter);
      const searchPass = !q || mentor.name.toLowerCase().includes(q) || mentor.email.toLowerCase().includes(q);
      return filterPass && searchPass;
    });
  }, [mentorRows, roleFilter, searchTerm]);

  useEffect(() => {
    if (filteredMentors.length === 0) {
      setSelectedMentorId("");
      return;
    }
    const exists = filteredMentors.some((mentor) => mentor.id === selectedMentorId);
    if (!exists) {
      setSelectedMentorId(filteredMentors[0].id);
    }
  }, [filteredMentors, selectedMentorId]);

  const stats = useMemo(() => {
    const totalMentors = mentorRows.length;
    const totalGuides = mentorRows.filter((mentor) => mentor.roles.includes("Guide")).length;
    const totalCoordinators = mentorRows.filter((mentor) => mentor.roles.includes("Coordinator")).length;
    return { totalMentors, totalGuides, totalCoordinators };
  }, [mentorRows]);

  const fetchWorkload = useCallback(async () => {
      if (!selectedMentorId || !isUuid(selectedMentorId)) {
        setWorkload({
          guidance: [],
          coordination: [],
          evaluations: [],
          stageBreakdown: [],
          summary: {
            guidanceTeams: 0,
            coordinationAssignments: 0,
            totalEvaluations: 0,
            completedEvaluations: 0,
            pendingEvaluations: 0,
          },
        });
        return;
      }

      setWorkloadLoading(true);
      try {
        const selectedMentorProfile = (mentors || []).find((mentor) => mentor.id === selectedMentorId) || null;
        const coordinationAssignments =
          selectedMentorProfile?.is_coordinator && selectedMentorProfile?.class_id ? 1 : 0;

        const guidanceQuery = supabase
          .from("projects")
          .select(`
            id,
            title,
            status,
            class_id,
            classes:class_id (
              class_name:class_section
            )
          `)
          .eq("guide_id", selectedMentorId);

        const [guidanceRes, evaluationData] = await Promise.all([
          guidanceQuery,
          fetchMentorEvaluationsByMentorId(selectedMentorId),
        ]);

        if (guidanceRes.error) throw guidanceRes.error;

        const guidanceRows = (guidanceRes.data || []).map((row) => ({
          id: row.id,
          projectId: row.id,
          title: row.title || "Untitled Project",
          className: projectClassName(row),
          status: row.status || "active",
        }));

        const evaluationRows = (evaluationData || []).map((row) => ({
          id: row.id,
          stage: row.evaluation_type || row.phase || "Unknown Stage",
          title: row.projects?.title || "Untitled Project",
          className: projectClassName(row.projects),
          completed:
            row.score !== null
            || row.obtained_marks !== null
            || (typeof row.max_marks === "number" && row.max_marks > 0),
        }));

        const stageMap = new Map();
        evaluationRows.forEach((item) => {
          const key = item.stage;
          if (!stageMap.has(key)) {
            stageMap.set(key, { stage: key, total: 0, completed: 0, pending: 0 });
          }
          const bucket = stageMap.get(key);
          bucket.total += 1;
          if (item.completed) bucket.completed += 1;
        });
        stageMap.forEach((bucket) => {
          bucket.pending = Math.max(0, bucket.total - bucket.completed);
        });

        const completedEvaluations = evaluationRows.filter((item) => item.completed).length;

        setWorkload({
          guidance: guidanceRows,
          coordination: [],
          evaluations: evaluationRows,
          stageBreakdown: Array.from(stageMap.values()),
          summary: {
            guidanceTeams: guidanceRows.length,
            coordinationAssignments,
            totalEvaluations: evaluationRows.length,
            completedEvaluations,
            pendingEvaluations: Math.max(0, evaluationRows.length - completedEvaluations),
          },
        });
      } catch {
        setWorkload({
          guidance: [],
          coordination: [],
          evaluations: [],
          stageBreakdown: [],
          summary: {
            guidanceTeams: 0,
            coordinationAssignments: 0,
            totalEvaluations: 0,
            completedEvaluations: 0,
            pendingEvaluations: 0,
          },
        });
      } finally {
        setWorkloadLoading(false);
      }
  }, [mentors, selectedMentorId]);

  useEffect(() => {
    fetchWorkload();
  }, [fetchWorkload]);

  useEffect(() => {
    if (!selectedMentorId || !isUuid(selectedMentorId)) return undefined;

    const channel = supabase
      .channel("mentor-workload-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, fetchWorkload)
      .on("postgres_changes", { event: "*", schema: "public", table: "evaluations" }, fetchWorkload);

    return subscribeWithDeferredCleanup(supabase, channel);
  }, [fetchWorkload, selectedMentorId]);

  const handleDeleteMentor = async (mentorId) => {
    setError("");
    try {
      await apiRequest(`/admin/users/${mentorId}`, {
        method: "DELETE",
      });
      await fetchData(true);
    } catch (err) {
      setError(err.message || "Failed to delete mentor.");
    }
  };

  const handleImportFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError("");
    setImportNotice("");
    setImportSkipped([]);
    setPendingImportRows([]);
    setExtractingImport(true);

    try {
      const lowerFileName = file.name.toLowerCase();
      const isBinaryUpload =
        file.type.includes("pdf")
        || file.type.includes("spreadsheet")
        || file.type.includes("excel")
        || lowerFileName.endsWith(".pdf")
        || lowerFileName.endsWith(".xlsx")
        || lowerFileName.endsWith(".xls")
        || lowerFileName.endsWith(".csv");
      const payload = {
        fileName: file.name,
        mimeType: file.type,
      };

      if (isBinaryUpload) {
        const fileBuffer = await readFileAsArrayBuffer(file);
        payload.fileBase64 = arrayBufferToBase64(fileBuffer);
      } else {
        payload.text = await readFileAsText(file);
      }

      const data = await apiRequest("/admin/mentor-management-import/extract", {
        method: "POST",
        body: payload,
      });

      const extractedPeople = data?.people || [];
      const validMentors = extractedPeople.filter((person) => person.role === "mentor" && person.full_name && person.email);

      setImportPreview(extractedPeople);
      setPendingImportRows(extractedPeople);
      setImportMeta(data?.meta || {
        extractedCount: extractedPeople.length,
        mentorCount: extractedPeople.filter((person) => person.role === "mentor").length,
        adminCount: extractedPeople.filter((person) => person.role === "admin").length,
        validMentorCount: validMentors.length,
        createCount: extractedPeople.filter((person) => person.import_action === "create").length,
        updateCount: extractedPeople.filter((person) => person.import_action === "update").length,
        skipCount: extractedPeople.filter((person) => person.import_action === "skip").length,
      });
      setShowImportPreview(true);

      if (extractedPeople.length === 0) {
        setImportFileName(file.name);
        setImportNotice(`No people could be extracted from ${file.name}.`);
        return;
      }

      setImportFileName(file.name);
      setImportNotice(
        [
          `Preview ready for ${file.name}.`,
          `Extracted ${data?.meta?.extractedCount || 0} people.`,
          `Mapped ${validMentors.length} valid mentor row${validMentors.length === 1 ? "" : "s"} into Mentor Management.`,
          "Review the rows below and confirm import to apply changes.",
        ].join(" ")
      );
    } catch (err) {
      setImportFileName(file.name);
      setError(err.message || "Failed to process uploaded file.");
    } finally {
      setExtractingImport(false);
      event.target.value = "";
    }
  };

  const handleCancelImportPreview = () => {
    setImportFileName("");
    setImportNotice("");
    setImportSkipped([]);
    setImportPreview([]);
    setPendingImportRows([]);
    setImportMeta({
      extractedCount: 0,
      mentorCount: 0,
      adminCount: 0,
      validMentorCount: 0,
      createCount: 0,
      updateCount: 0,
      skipCount: 0,
    });
    setShowImportPreview(true);
  };

  const handleConfirmImport = async () => {
    if (pendingImportRows.length === 0) return;

    setError("");
    setImportSkipped([]);
    setConfirmingImport(true);

    try {
      const applyResult = await apiRequest("/admin/mentor-management-import/apply", {
        method: "POST",
        body: {
          people: pendingImportRows,
          fileName: importFileName,
        },
      });

      setImportNotice(
        [
          `Processed ${importFileName || "uploaded file"}.`,
          `Created ${applyResult?.summary?.created || 0}, updated ${applyResult?.summary?.updated || 0}, skipped ${applyResult?.summary?.skipped || 0}.`,
          applyResult?.summary?.invited
            ? `Password setup email sent for ${applyResult.summary.invited} new account${applyResult.summary.invited === 1 ? "" : "s"}.`
            : null,
        ].filter(Boolean).join(" ")
      );
      setImportSkipped(applyResult?.skipped || []);
      setPendingImportRows([]);
      await fetchData(true);
    } catch (err) {
      setError(err.message || "Failed to apply mentor import.");
    } finally {
      setConfirmingImport(false);
    }
  };

  const handleEditRoles = (mentor) => {
    setEditingMentor(mentor);
    setEditingRoles(mentor.roles || []);
    setEditingClassId(mentor.classId || "");
  };

  const handleToggleRole = (role) => {
    setEditingRoles((prev) =>
      prev.includes(role) ? prev.filter((item) => item !== role) : [...prev, role]
    );
  };

  const toggleGuideRole = useCallback(async (mentorId, isGuide, shouldRefresh = true) => {
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        designation: isGuide ? "guide" : null,
      })
      .eq("id", mentorId);

    if (updateError) {
      setError(updateError.message || "Failed to update guide role.");
      return false;
    }

    if (shouldRefresh) await fetchData(true);
    return true;
  }, [fetchData]);

  const toggleCoordinatorRole = useCallback(async (mentorId, isCoordinator, shouldRefresh = true) => {
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        is_coordinator: isCoordinator,
        class_id: isCoordinator ? null : null,
      })
      .eq("id", mentorId);

    if (updateError) {
      setError(updateError.message || "Failed to update coordinator role.");
      return false;
    }

    if (shouldRefresh) await fetchData(true);
    return true;
  }, [fetchData]);

  const assignCoordinatorClass = useCallback(async (mentorId, classId, shouldRefresh = true) => {
    const { data: coordinators, error: countError } = await supabase
      .from("profiles")
      .select("id")
      .eq("class_id", classId)
      .eq("is_coordinator", true);

    if (countError) {
      setError(countError.message || "Failed to validate coordinator capacity.");
      return false;
    }

    if ((coordinators || []).length >= 2) {
      alert("This class already has 2 coordinators allotted.");
      return false;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        is_coordinator: true,
        class_id: classId,
      })
      .eq("id", mentorId);

    if (updateError) {
      setError(updateError.message || "Failed to assign coordinator class.");
      return false;
    }

    if (shouldRefresh) await fetchData(true);
    return true;
  }, [fetchData]);

  const handleSaveRoles = async (mentorId, roles, selectedClassId) => {
    setError("");
    try {
      const previousMentor = editingMentor || mentorRows.find((mentor) => mentor.id === mentorId) || null;
      const hadGuide = previousMentor?.roles?.includes("Guide") || false;
      const hadCoordinator = previousMentor?.roles?.includes("Coordinator") || false;
      const previousClassId = previousMentor?.classId || "";
      const hasGuide = roles.includes("Guide");
      const isCoordinator = roles.includes("Coordinator");

      const guideOk = await toggleGuideRole(mentorId, hasGuide, false);
      if (!guideOk) return;

      if (isCoordinator) {
        if (!selectedClassId) {
          throw new Error("Coordinator must select a class.");
        }
        const coordOk = await toggleCoordinatorRole(mentorId, true, false);
        if (!coordOk) return;
        const success = await assignCoordinatorClass(mentorId, selectedClassId, false);
        if (!success) return;
      } else {
        const coordOk = await toggleCoordinatorRole(mentorId, false, false);
        if (!coordOk) return;
      }

      const selectedClass = classes.find((item) => item.id === selectedClassId);
      const previousClass = classes.find((item) => item.id === previousClassId);
      const notificationRows = [];

      if (hasGuide !== hadGuide) {
        notificationRows.push({
          user_id: mentorId,
          type: hasGuide ? "guide_role_assigned" : "guide_role_removed",
          title: hasGuide ? "Guide Role Assigned" : "Guide Role Removed",
          message: hasGuide
            ? "Administrator granted you guide access."
            : "Administrator removed your guide access.",
        });
      }

      if (isCoordinator) {
        if (!hadCoordinator || previousClassId !== selectedClassId) {
          notificationRows.push({
            user_id: mentorId,
            type: "coordinator_assignment",
            title: "Coordinator Assignment Updated",
            message: `Administrator assigned you as coordinator for ${formatClassNotificationLabel(selectedClass)}.`,
          });
        }
      } else if (hadCoordinator) {
        notificationRows.push({
          user_id: mentorId,
          type: "coordinator_role_removed",
          title: "Coordinator Role Removed",
          message: `Administrator removed your coordinator assignment${previousClass ? ` for ${formatClassNotificationLabel(previousClass)}` : ""}.`,
        });
      }

      await createNotifications(notificationRows);

      await fetchData(true);
    } catch (err) {
      setError(err.message || "Failed to update mentor role.");
    }
    setEditingMentor(null);
    setEditingRoles([]);
    setEditingClassId("");
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      navigate("/signin");
    }
  };

  const handleNavigate = (itemId) => {
    if (itemId === "dashboard") {
      navigate("/admin");
      return;
    }
    if (itemId === "guide-allocation") {
      navigate("/admin/guide-allocation");
      return;
    }
    if (itemId === "mentor-management") {
      navigate("/admin/mentor-management");
      return;
    }
    if (itemId === "review-management") {
      navigate("/admin/review-management");
      return;
    }
    if (itemId === "rubrics-management") {
      navigate("/admin/rubrics");
    }
  };

  const selectedMentor = mentorRows.find((mentor) => mentor.id === selectedMentorId) || null;
  const selectedMentorProfile = mentors.find((mentor) => mentor.id === selectedMentorId) || null;

  const getGuidanceTeams = () => {
    if (!selectedMentorProfile) return 0;
    return projects.filter((p) => p.guide_id === selectedMentorProfile.id).length;
  };

  const getCoordinatorAssignments = () => {
    if (!selectedMentorProfile) return 0;
    if (selectedMentorProfile.is_coordinator && selectedMentorProfile.class_id) {
      return 1;
    }
    return 0;
  };

  const getCoordinatorClassName = () => {
    if (!selectedMentorProfile || !selectedMentorProfile.class_id) return null;

    const cls = classes.find(
      (c) => c.id === selectedMentorProfile.class_id
    );

    return cls ? (cls.class_section || cls.class_name) : null;
  };

  const coordinatorClassName = getCoordinatorClassName();
  const coordinatorAssignments = getCoordinatorAssignments();
  const guidanceTeams = getGuidanceTeams();
  const guidancePercent = Math.min(100, Math.round((guidanceTeams / 2) * 100));

  return (
    <AppFrame
      sidebar={(
        <Sidebar
          activeItem="mentor-management"
          onSignOut={handleSignOut}
          onNavigate={handleNavigate}
        />
      )}
      header={(
        <TopNavbar
          adminName={adminProfile.full_name || ADMIN_NAME}
          academicYearLabel="2026 - S6 Mini Project"
          pageTitle="Mentor Management"
          onHomeClick={() => navigate("/admin")}
          onProfileClick={() => setShowProfileMenu((value) => !value)}
        />
      )}
      headerOverlay={showProfileMenu ? (
        <div className="fixed top-14 right-2 sm:right-6 md:right-8 z-50">
          <ProfileMenu
            profile={adminProfile}
            isOpen={showProfileMenu}
            onClose={() => setShowProfileMenu(false)}
            onLogout={handleSignOut}
            onEditProfile={() => {
              setShowProfileMenu(false);
              setShowProfileSettings(true);
            }}
            onHelpSupport={() => navigate("/admin/help")}
            roleLabel="Administrator"
            roleIcon="admin_panel_settings"
            infoItems={[
              { label: "Full Name", value: adminProfile.full_name || "-" },
              { label: "Email", value: adminProfile.email || "-" },
              { label: "Role", value: "Administrator" },
              { label: "Department", value: adminProfile.department || "-" },
            ]}
          />
        </div>
      ) : null}
    >
      <div className="p-4 md:p-6 lg:p-8 space-y-6">
          <section className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-slate-800">Mentor Management</h1>
              <p className="text-slate-500 mt-1">Manage Mentor Roles and Department Privileges</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              <select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
                className="glass-input rounded-xl px-3 py-2.5 text-sm text-slate-700"
              >
                <option value="All">All</option>
                <option value="Guide">Guide</option>
                <option value="Coordinator">Coordinator</option>
              </select>
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by name or email"
                className="glass-input rounded-xl px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 w-full sm:w-64"
              />
            </div>
          </section>

          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            <MentorStatCard title="Total Mentors" value={stats.totalMentors} icon="mentors" borderClass="border-t-teal-500" />
            <MentorStatCard title="Total Guides" value={stats.totalGuides} icon="guide" borderClass="border-t-cyan-500" />
            <MentorStatCard title="Total Coordinators" value={stats.totalCoordinators} icon="coordinator" borderClass="border-t-violet-500" />
          </section>

          <section className="bg-white/90 rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-200/70 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Import Mentor File</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Upload a mentor file to update the list automatically.
                </p>
              </div>
              <label className="inline-flex items-center justify-center rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 transition-colors cursor-pointer">
                <input
                  type="file"
                  accept=".txt,.json,.pdf,.md,.xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleImportFileChange}
                  disabled={extractingImport}
                />
                {extractingImport ? "Processing..." : "Upload File"}
              </label>
            </div>

            <div className="p-6 space-y-5">
              {importFileName ? (
                <p className="text-sm text-slate-600">
                  Source file: <span className="font-semibold text-slate-800">{importFileName}</span>
                </p>
              ) : null}

              {importNotice && importPreview.length === 0 ? (
                <div className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
                  {importNotice}
                </div>
              ) : null}

              {importSkipped.length > 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <h3 className="text-sm font-semibold text-amber-900">Skipped Rows</h3>
                  <div className="mt-2 space-y-2">
                    {importSkipped.map((item, index) => (
                      <p key={`${item.email || item.full_name || "skip"}-${index}`} className="text-xs text-amber-800">
                        {(item.full_name || item.email || "Unknown row")} - {item.reason}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          {importPreview.length > 0 ? (
            <section className="bg-white/90 rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-200/70 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">Uploaded File Preview</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Preview of the extracted rows from {importFileName || "the uploaded file"} after mapping.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowImportPreview((prev) => !prev)}
                  className="shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  {showImportPreview ? "Hide" : "Show"}
                </button>
              </div>

              {showImportPreview ? (
              <div className="p-6 space-y-5">
                {pendingImportRows.length > 0 ? (
                  <div className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-cyan-900">Preview ready</p>
                      <p className="text-sm text-cyan-800 mt-1">
                        Nothing has been imported yet. Confirm to create or update mentor accounts from these rows.
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleCancelImportPreview}
                        disabled={confirmingImport}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmImport}
                        disabled={confirmingImport || extractingImport}
                        className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {confirmingImport ? "Importing..." : "Confirm Import"}
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
                  {[
                    { label: "Extracted", value: importMeta.extractedCount },
                    { label: "Mentors", value: importMeta.mentorCount },
                    { label: "Admins", value: importMeta.adminCount },
                    { label: "Valid Mentor Imports", value: importMeta.validMentorCount },
                    { label: "Create", value: importMeta.createCount || 0 },
                    { label: "Update", value: importMeta.updateCount || 0 },
                    { label: "Skip", value: importMeta.skipCount || 0 },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-800">{item.value}</p>
                    </div>
                  ))}
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-[1080px] text-sm">
                    <thead className="bg-slate-100/80 text-slate-600">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold">Name</th>
                        <th className="px-4 py-3 text-left font-semibold">Email</th>
                        <th className="px-4 py-3 text-left font-semibold">Employee ID</th>
                        <th className="px-4 py-3 text-left font-semibold">Department</th>
                        <th className="px-4 py-3 text-left font-semibold">Specialization</th>
                        <th className="px-4 py-3 text-left font-semibold">Role</th>
                        <th className="px-4 py-3 text-left font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {importPreview.map((person, index) => (
                        <tr key={`${person.email || person.full_name || "preview"}-${index}`} className="bg-white">
                          <td className="px-4 py-3 text-slate-800 font-medium">{person.full_name || "-"}</td>
                          <td className="px-4 py-3 text-slate-600">{person.email || "-"}</td>
                          <td className="px-4 py-3 text-slate-600">{person.employee_id || "-"}</td>
                          <td className="px-4 py-3 text-slate-600">{person.department || "-"}</td>
                          <td className="px-4 py-3 text-slate-600">{person.specialization?.join(", ") || "-"}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                              person.role === "admin"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-emerald-100 text-emerald-700"
                            }`}>
                              {person.role}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              <span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${
                                person.import_action === "create"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : person.import_action === "update"
                                    ? "bg-sky-100 text-sky-700"
                                    : "bg-rose-100 text-rose-700"
                              }`}>
                                {(person.import_action || "skip").toUpperCase()}
                              </span>
                              <span className="text-xs text-slate-500">{person.import_reason || "-"}</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              ) : (
                <div className="px-6 py-4 text-sm text-slate-500">
                  Preview hidden. Click <span className="font-semibold text-slate-700">Show</span> to view the uploaded rows again.
                </div>
              )}
            </section>
          ) : null}

          {loading ? (
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <span className="inline-block h-4 w-4 rounded-full border-2 border-teal-600 border-t-transparent animate-spin" />
              Loading mentors...
            </div>
          ) : null}
          {error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <MentorTable
            mentors={filteredMentors}
            onEditRoles={handleEditRoles}
            onDeleteMentor={handleDeleteMentor}
            onSelectMentor={setSelectedMentorId}
            selectedMentorId={selectedMentorId}
          />

          <section className="bg-white/90 rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setWorkloadOpen((prev) => !prev)}
              className="w-full px-6 py-4 border-b border-slate-200/70 flex items-center justify-between"
            >
              <div className="text-left">
                <h2 className="text-base font-semibold text-slate-800">Mentor Workload Panel</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedMentor ? `Selected: ${selectedMentor.name}` : "Select a mentor to view workload"}
                </p>
              </div>
              <span className="text-sm font-semibold text-teal-700">{workloadOpen ? "Hide" : "Show"}</span>
            </button>

            {workloadOpen ? (
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  <MentorStatCard title="Total Guidance Teams" value={guidanceTeams} icon="guide" borderClass="border-t-teal-500" />
                  <div>
                    <MentorStatCard title="Coordination Assignments" value={coordinatorAssignments} icon="coordinator" borderClass="border-t-violet-500" />
                    <div className="text-sm text-slate-500 mt-2">
                      Class: {coordinatorClassName || "No class allocated"}
                    </div>
                  </div>
                  <MentorStatCard title="Total Evaluations" value={workload.summary.totalEvaluations} icon="evaluator" borderClass="border-t-cyan-500" />
                  <MentorStatCard title="Pending Evaluations" value={workload.summary.pendingEvaluations} icon="evaluator" borderClass="border-t-rose-500" />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <section className="rounded-xl border border-slate-200/70 bg-slate-50/70 p-4">
                    <h3 className="text-sm font-semibold text-slate-800">Guidance Load (Max 2)</h3>
                    <div className="mt-3 h-2.5 rounded-full bg-slate-200 overflow-hidden">
                      <div className={`h-full rounded-full ${
                        guidancePercent >= 100 ? "bg-rose-500" : guidancePercent >= 50 ? "bg-amber-500" : "bg-emerald-500"
                      }`} style={{ width: `${guidancePercent}%` }} />
                    </div>
                    <p className="mt-2 text-xs text-slate-600">{guidanceTeams}/2 teams</p>
                  </section>

                  <section className="rounded-xl border border-slate-200/70 bg-slate-50/70 p-4">
                    <h3 className="text-sm font-semibold text-slate-800">Coordinator Class</h3>
                    <p className="mt-3 text-base font-semibold text-slate-800">
                      {coordinatorClassName || "No class allocated"}
                    </p>
                    <p className="mt-2 text-xs text-slate-600">
                      {coordinatorClassName ? "Class allocated to the selected coordinator" : "No class allocated"}
                    </p>
                  </section>
                </div>

                {workloadLoading ? <p className="text-sm text-slate-500">Loading mentor workload...</p> : null}

              </div>
            ) : null}
          </section>
      </div>

      <EditRoleModal
        mentor={editingMentor}
        isOpen={Boolean(editingMentor)}
        selectedRoles={editingRoles}
        classes={classes}
        selectedClassId={editingClassId}
        onClassChange={setEditingClassId}
        onToggleRole={handleToggleRole}
        onClose={() => {
          setEditingMentor(null);
          setEditingRoles([]);
          setEditingClassId("");
        }}
        onSave={handleSaveRoles}
      />
      <AdminProfileSettingsModal
        isOpen={showProfileSettings}
        onClose={() => setShowProfileSettings(false)}
        onSuccess={refreshAdminProfile}
      />
    </AppFrame>
  );
}
