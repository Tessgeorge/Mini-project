import { useEffect, useRef, useState } from 'react';
import supabase from '../config/supabaseClient';
import { apiRequest } from '../config/apiClient';
import { fetchStudentBootstrapData, invalidateStudentBootstrapCache } from '../services/studentData';
import { getStatusMeta } from '../constants/statusConfig';

const DOC_TYPES = [
    { value: 'abstract', label: 'Abstract' },
    { value: 'srs', label: 'SRS (Software Requirements Specification)' },
    { value: 'sdd', label: 'SDD (Software Design Document)' },
    { value: 'zeroth_review_ppt', label: 'Zeroth Review PPT / Presentation' },
    { value: 'first_review_ppt', label: '1st Review PPT / Presentation' },
    { value: 'final_review_ppt', label: 'Final Review PPT / Presentation' },
    { value: 'project_final_report', label: 'Project Final Report' },
];

const GUIDELINES = [
    'Submit PDF format only for reports and abstracts.',
    'PPT files accepted as .pptx or .pdf.',
    'File size must not exceed 20 MB.',
    'Version is auto-incremented on re-upload.',
    'Contact your mentor for feedback queries.',
];

const DOC_TYPE_LABELS = DOC_TYPES.reduce((acc, item) => { acc[item.value] = item.label; return acc; }, {});
const isRejectedStatus = (status) => ["rejected", "needs_revision"].includes(String(status || "").toLowerCase());

/* ─── Status badge ──────────────────────────────────────────────────── */
function StatusBadge({ status }) {
    const meta = getStatusMeta(status, { context: 'submission' });
    return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${meta.pillClass}`}>
            <span className={`size-1.5 rounded-full inline-block ${meta.dotClass}`} /> {meta.label}
        </span>
    );
}

/* ─── Doc type label ────────────────────────────────────────────────── */
function DocTypeLabel({ type }) {
    const icons = {
        abstract: 'description',
        srs: 'list_alt',
        sdd: 'schema',
        zeroth_review_ppt: 'slideshow',
        first_review_ppt: 'slideshow',
        final_review_ppt: 'slideshow',
        project_final_report: 'task_alt',
    };
    const labels = {
        abstract: 'Abstract',
        srs: 'SRS',
        sdd: 'SDD',
        zeroth_review_ppt: 'Zeroth Review PPT / Presentation',
        first_review_ppt: '1st Review PPT / Presentation',
        final_review_ppt: 'Final Review PPT / Presentation',
        project_final_report: 'Project Final Report',
    };
    return (
        <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(0,196,180,0.10)' }}>
                <span className="material-symbols-outlined text-[18px]" style={{ color: '#00C4B4' }}>{icons[type] || 'insert_drive_file'}</span>
            </div>
            <span className="text-sm font-semibold text-slate-800">{labels[type] || type?.replaceAll('_', ' ')}</span>
        </div>
    );
}

/* ─── Sidebar section header ────────────────────────────────────────── */
function SectionHeader({ icon, iconColor = '#00C4B4', title, children }) {
    return (
        <div className="px-5 py-4 border-b border-white/70 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]" style={{ color: iconColor }}>{icon}</span>
                <h3 className="font-black text-slate-900 text-sm">{title}</h3>
            </div>
            {children}
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════════════ */
export default function Submissions() {
    const fileInputRef = useRef(null);
    const uploadFormRef = useRef(null);
    const hasInitializedRef = useRef(false);

    const [project, setProject] = useState(null);
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [docType, setDocType] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [isDragging, setIsDragging] = useState(false);

    useEffect(() => {
        if (hasInitializedRef.current) return;
        hasInitializedRef.current = true;
        loadData(false);
    }, []);

    useEffect(() => {
        if (!project?.id) return undefined;
        const channel = supabase
            .channel(`student-submissions-${project.id}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'documents', filter: `project_id=eq.${project.id}` },
                async () => {
                    invalidateStudentBootstrapCache();
                    await loadData(true);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [project?.id]);

    const loadData = async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        setError('');
        try {
            const { projects } = await fetchStudentBootstrapData({ force: isRefresh });
            const proj = projects?.[0];
            if (!proj?.id) { setLoading(false); return; }
            setProject(proj);
            let docs = proj.documents || [];
            try {
                const latestDocs = await apiRequest(`/projects/${proj.id}/documents`, { skipCache: true });
                if (Array.isArray(latestDocs)) docs = latestDocs;
            } catch {
                // Fallback to bootstrap payload when direct documents endpoint fails.
            }
            setDocuments(docs.sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at)));
        } catch (e) {
            setError(e.message || 'Failed to load submissions');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const getNextVersion = (type) => {
        const existing = documents.filter(d => d.document_type === type);
        if (existing.length === 0) return 1;
        return Math.max(...existing.map(d => d.version ?? 1)) + 1;
    };

    const getLatestDoc = (type) => {
        const existing = documents.filter(d => d.document_type === type);
        if (existing.length === 0) return null;
        return existing.reduce((a, b) => (a.version ?? 1) >= (b.version ?? 1) ? a : b);
    };

    const getNextDocType = (currentType) => {
        const idx = DOC_TYPES.findIndex(d => d.value === currentType);
        if (idx < 0 || idx >= DOC_TYPES.length - 1) return null;
        return DOC_TYPES[idx + 1];
    };

    const focusUploadForType = (type) => {
        setDocType(type);
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        uploadFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const latestByType = DOC_TYPES
        .map(t => getLatestDoc(t.value))
        .filter(Boolean)
        .sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at));
    const ideaApproved = Boolean(project?.approved_idea_id);
    const approvalFeedbackEntries = (project?.evaluations || [])
        .filter((entry) => entry.evaluation_type === 'approval_feedback')
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const handleDelete = async (doc) => {
        if (!window.confirm(`Delete "${doc.file_name}"? This cannot be undone.`)) return;
        setDocuments(prev => prev.filter(d => d.id !== doc.id));
        setError('');
        try {
            await apiRequest(`/documents/${doc.id}`, { method: 'DELETE' });
            invalidateStudentBootstrapCache();
            if (doc.file_url) {
                try {
                    const url = new URL(doc.file_url);
                    const m = url.pathname.match(/\/object\/public\/documents\/(.*)/) || url.pathname.match(/\/object\/documents\/(.*)/);
                    if (m?.[1]) await supabase.storage.from('documents').remove([decodeURIComponent(m[1])]);
                } catch { /* ignore */ }
            }
        } catch (e) {
            loadData();
            setError(e.message || 'Delete failed. Please try again.');
        }
    };

    const handleDrop = (e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files?.[0]; if (f) setSelectedFile(f); };
    const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
    const handleDragLeave = () => setIsDragging(false);
    const handleFileChange = (e) => { const f = e.target.files?.[0]; if (f) setSelectedFile(f); };

    const handleUpload = async () => {
        if (!ideaApproved) return setError('An idea must be approved before you can submit documents.');
        if (!docType) return setError('Please select a document type.');
        if (!selectedFile) return setError('Please select a file to upload.');
        if (!project?.id) return setError('No project found.');
        setUploading(true); setError(''); setSuccessMsg('');
        try {
            const existingDoc = getLatestDoc(docType);
            const version = existingDoc ? (existingDoc.version ?? 1) + 1 : 1;
            const ext = selectedFile.name.split('.').pop();
            const filePath = `${project.id}/${docType}_v${version}_${Date.now()}.${ext}`;
            let fileUrl = existingDoc?.file_url || null;

            const { error: storageErr } = await supabase.storage.from('documents').upload(filePath, selectedFile);
            if (storageErr) {
                console.warn('Storage upload failed:', storageErr.message);
            } else {
                const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath);
                fileUrl = urlData?.publicUrl || fileUrl;
            }

            if (existingDoc) {
                await apiRequest(`/documents/${existingDoc.id}`, {
                    method: 'PUT',
                    body: { file_name: selectedFile.name, file_url: fileUrl, status: 'submitted', version, uploaded_at: new Date().toISOString() },
                });
            } else {
                await apiRequest(`/projects/${project.id}/documents`, {
                    method: 'POST',
                    body: { document_type: docType, file_name: selectedFile.name, file_url: fileUrl, status: 'submitted', version },
                });
            }

            invalidateStudentBootstrapCache();
            setSuccessMsg(`${DOC_TYPES.find(d => d.value === docType)?.label} ${existingDoc ? `updated to v${version}` : 'submitted (v1)'}${!fileUrl ? ' - no file attached' : ''}`);
            setDocType(''); setSelectedFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            loadData();
        } catch (e) {
            setError(e.message || 'Upload failed. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    /* ── Loading states ── */
    if (loading) return (
        <div className="etnova-bg flex items-center justify-center py-24">
            <div className="text-center">
                <div className="inline-block size-12 border-4 border-slate-200 border-t-[#00C4B4] rounded-full animate-spin" />
                <p className="mt-4 text-slate-600 font-medium">Loading submissions...</p>
            </div>
        </div>
    );

    if (!project) return (
        <div className="etnova-bg flex items-center justify-center py-24">
            <div className="text-center max-w-md">
                <span className="material-symbols-outlined text-6xl text-slate-300 mb-4 block">upload_file</span>
                <h2 className="text-xl font-black text-slate-900 mb-2">No Team Found</h2>
                <p className="text-slate-600">Join or create a team to access submissions.</p>
            </div>
        </div>
    );

    /* ══ Main render ══════════════════════════════════════════════════════ */
    return (
        <div className="etnova-bg pb-20 md:pb-8">

            {/* ── Page Header ── */}
            <div className="glass-topbar px-4 sm:px-6 py-3.5 sm:py-4">
                <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-3">
                    <div className="size-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg,#00C4B4 0%,#00897B 100%)' }}>
                        <span className="material-symbols-outlined text-white text-[18px]">upload_file</span>
                    </div>
                    <div>
                        <h1 className="text-lg font-black text-slate-900 leading-none">Team Submissions</h1>
                        <p className="text-xs text-slate-500 mt-0.5">{project.team_name || project.title}</p>
                        {project.approved_idea_id && project.team_name && project.team_name !== project.title ? (
                            <p className="text-[11px] text-slate-400 mt-0.5">Approved idea: {project.title}</p>
                        ) : null}
                    </div>
                    {/* Doc count pill */}
                    <div className="ml-auto flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500 bg-white/60 border border-slate-200 px-3 py-1.5 rounded-full">
                            {documents.length} document{documents.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-6">

                {/* ── Alerts ── */}
                {error && (
                    <div className="mb-5 flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        <span className="material-symbols-outlined text-base flex-shrink-0">error</span>
                        <span className="flex-1">{error}</span>
                        <button onClick={() => setError('')}><span className="material-symbols-outlined text-base text-rose-400">close</span></button>
                    </div>
                )}
                {successMsg && (
                    <div className="mb-5 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                        <span className="material-symbols-outlined text-base flex-shrink-0">check_circle</span>
                        <span className="flex-1">{successMsg}</span>
                        <button onClick={() => setSuccessMsg('')}><span className="material-symbols-outlined text-base text-emerald-400">close</span></button>
                    </div>
                )}

                {/* ── Two-column grid ── */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

                    {/* ─── LEFT: Main content ─── */}
                    <div className="xl:col-span-2 space-y-5">

                        {/* Upload card */}
                        <div ref={uploadFormRef} className="glass-card-strong overflow-hidden">
                            <div className="px-5 py-4 border-b border-white/70 flex items-center gap-3">
                                <div className="size-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                    style={{ backgroundColor: 'rgba(0,196,180,0.12)' }}>
                                    <span className="material-symbols-outlined text-[17px]" style={{ color: '#00C4B4' }}>cloud_upload</span>
                                </div>
                                <div>
                                    <h2 className="font-black text-slate-900 text-sm leading-none">Upload New Submission</h2>
                                    <p className="text-[11px] text-slate-400 mt-0.5">Select document type and upload your file</p>
                                </div>
                            </div>

                            <div className="p-5 space-y-4">
                                {!ideaApproved && (
                                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                        Your team needs an approved idea before abstract and other submissions can start.
                                    </div>
                                )}
                                {/* Document type select */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">
                                        Document Type <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">description</span>
                                        <select
                                            value={docType}
                                            onChange={e => setDocType(e.target.value)}
                                            disabled={!ideaApproved}
                                            className="glass-input w-full pl-9 pr-9 py-2.5 text-sm text-slate-800 font-medium focus:outline-none appearance-none cursor-pointer"
                                        >
                                            <option value="">Select document type...</option>
                                            {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                        </select>
                                        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px] pointer-events-none">expand_more</span>
                                    </div>
                                    {docType && (
                                        <p className="mt-1.5 text-[11px] text-slate-400">
                                            Will be uploaded as: <span className="font-bold text-slate-600">v{getNextVersion(docType)}</span>
                                        </p>
                                    )}
                                </div>

                                {/* Drag & drop zone */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">
                                        File <span className="text-rose-500">*</span>
                                    </label>
                                    <div
                                        onDrop={handleDrop}
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onClick={() => ideaApproved && fileInputRef.current?.click()}
                                        className={`relative border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 py-8 px-6 text-center ${isDragging ? 'border-[#00C4B4] bg-[rgba(0,196,180,0.05)]'
                                            : selectedFile ? 'border-emerald-300 bg-emerald-50/60'
                                                : 'border-slate-200 bg-white/40 hover:border-[#00C4B4]/40 hover:bg-white/60'
                                            }`}
                                    >
                                        <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.pptx,.docx,.doc" onChange={handleFileChange} disabled={!ideaApproved} />
                                        {selectedFile ? (
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="size-11 rounded-xl bg-emerald-100 flex items-center justify-center">
                                                    <span className="material-symbols-outlined text-emerald-600">insert_drive_file</span>
                                                </div>
                                                <p className="text-sm font-bold text-emerald-700">{selectedFile.name}</p>
                                                <p className="text-xs text-slate-400">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                                                <button type="button" onClick={e => { e.stopPropagation(); setSelectedFile(null); }}
                                                    className="text-xs text-slate-400 hover:text-rose-600 font-medium flex items-center gap-1 transition-colors mt-1">
                                                    <span className="material-symbols-outlined text-sm">close</span> Remove
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center gap-2.5">
                                                <div className="size-11 rounded-xl bg-white border border-slate-100 flex items-center justify-center shadow-sm">
                                                    <span className="material-symbols-outlined text-slate-300">cloud_upload</span>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-600">Drag & drop your file here</p>
                                                    <p className="text-xs text-slate-400 mt-0.5">or <span style={{ color: '#00C4B4' }} className="font-bold">browse to upload</span></p>
                                                    <p className="text-[11px] text-slate-300 mt-1.5">PDF, DOCX, PPTX · Max 20 MB</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Submit button */}
                                <button
                                    type="button"
                                    onClick={handleUpload}
                                    disabled={uploading || !ideaApproved}
                                    className="btn-primary w-full py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {uploading ? (
                                        <><div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Uploading...</>
                                    ) : (
                                        <><span className="material-symbols-outlined text-base">upload</span> Submit Document</>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Submission History card */}
                        <div className="glass-card-strong overflow-hidden">
                            <div className="px-5 py-4 border-b border-white/70 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="size-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                        style={{ backgroundColor: 'rgba(0,196,180,0.10)' }}>
                                        <span className="material-symbols-outlined text-[17px]" style={{ color: '#00C4B4' }}>history</span>
                                    </div>
                                    <div>
                                        <h2 className="font-black text-slate-900 text-sm leading-none">Submission History</h2>
                                        <p className="text-[11px] text-slate-400 mt-0.5">{documents.length} document{documents.length !== 1 ? 's' : ''} submitted</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => loadData(true)}
                                    className="size-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:border-slate-300 transition-all"
                                    title="Refresh"
                                >
                                    <span className={`material-symbols-outlined text-base ${refreshing ? 'animate-spin' : ''}`}>refresh</span>
                                </button>
                            </div>

                            {documents.length === 0 ? (
                                <div className="py-14 flex flex-col items-center gap-3 text-center px-6">
                                    <div className="size-14 rounded-2xl bg-white/50 border border-slate-100 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-2xl text-slate-300">folder_open</span>
                                    </div>
                                    <p className="text-sm font-bold text-slate-700">No submissions yet</p>
                                    <p className="text-xs text-slate-400">Upload your first document using the form above.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-white/70 bg-white/20">
                                                <th className="px-5 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">Document</th>
                                                <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">Ver.</th>
                                                <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">Status</th>
                                                <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">Uploaded</th>
                                                <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/50">
                                            {documents.map(doc => {
                                                const latestDoc = getLatestDoc(doc.document_type);
                                                const isLatest = doc.id === latestDoc?.id;
                                                return (
                                                    <tr key={doc.id} className={`transition-colors ${isLatest ? 'hover:bg-white/30' : 'opacity-40 hover:opacity-60'}`}>
                                                        <td className="px-5 py-3.5">
                                                            <div className="flex items-center gap-2">
                                                                <DocTypeLabel type={doc.document_type} />
                                                                {!isLatest && <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">old</span>}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3.5">
                                                            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-md">v{doc.version ?? 1}</span>
                                                        </td>
                                                        <td className="px-4 py-3.5"><StatusBadge status={doc.status} /></td>
                                                        <td className="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                                                            {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '-'}
                                                        </td>
                                                        <td className="px-4 py-3.5">
                                                            <div className="flex items-center gap-1.5">
                                                                {doc.file_url && (
                                                                    <a href={doc.file_url} target="_blank" rel="noreferrer"
                                                                        className="size-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-[#00C4B4] hover:border-[#00C4B4] transition-all" title="View file">
                                                                        <span className="material-symbols-outlined text-sm">visibility</span>
                                                                    </a>
                                                                )}
                                                                <button
                                                                    onClick={() => focusUploadForType(doc.document_type)}
                                                                    className="size-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-[#00C4B4] hover:border-[#00C4B4] transition-all" title="Re-upload new version">
                                                                    <span className="material-symbols-outlined text-sm">sync</span>
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDelete(doc)}
                                                                    className="size-7 rounded-lg border border-rose-100 flex items-center justify-center text-rose-300 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-400 transition-all" title="Delete document">
                                                                    <span className="material-symbols-outlined text-sm">delete</span>
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ─── RIGHT: Sidebar panels ─── */}
                    <div className="space-y-5">

                        {/* Stats grid */}
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { label: 'Pending', value: documents.filter(d => d.status === 'submitted').length, style: 'bg-amber-50   text-amber-700   border-amber-100', icon: 'hourglass_top', iconColor: '#d97706' },
                                { label: 'Approved', value: documents.filter(d => d.status === 'approved').length, style: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: 'task_alt', iconColor: '#059669' },
                                { label: 'Rejected', value: documents.filter(d => isRejectedStatus(d.status)).length, style: 'bg-rose-50    text-rose-700    border-rose-100', icon: 'edit_note', iconColor: '#e11d48' },
                                { label: 'Total', value: documents.length, style: 'bg-slate-50   text-slate-700   border-slate-100', icon: 'folder_open', iconColor: '#64748b' },
                            ].map(stat => (
                                <div key={stat.label} className={`glass-card-strong rounded-xl border p-4 ${stat.style}`}>
                                    <span className="material-symbols-outlined text-xl" style={{ color: stat.iconColor }}>{stat.icon}</span>
                                    <p className="text-2xl font-black mt-1.5 leading-none">{stat.value}</p>
                                    <p className="text-xs font-semibold mt-1 opacity-80">{stat.label}</p>
                                </div>
                            ))}
                        </div>

                        {/* Mentor Review card */}
                        <div className="glass-card-strong overflow-hidden">
                            <SectionHeader icon="rate_review" title="Mentor Review">
                                {latestByType.length > 0 && (
                                    <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                                        {latestByType.length}
                                    </span>
                                )}
                            </SectionHeader>
                            <div className="p-4">
                                {latestByType.length === 0 && approvalFeedbackEntries.length === 0 ? (
                                    <p className="text-xs text-slate-400 text-center py-4">Submit documents to receive mentor feedback.</p>
                                ) : (
                                    <div className="space-y-2.5 max-h-72 overflow-y-auto pr-0.5">
                                        {approvalFeedbackEntries.map(entry => {
                                            const ideaStatus = String(project?.status || 'submitted').toLowerCase();
                                            const feedbackText = String(entry.feedback || '').trim();
                                            return (
                                                <div key={`approval-${entry.id}`}
                                                    className="rounded-xl border border-white/80 bg-white/50 p-3.5 space-y-2">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <p className="text-xs font-black text-slate-800">Idea Submission</p>
                                                        <StatusBadge status={ideaStatus} />
                                                    </div>
                                                    <p className="text-xs text-slate-500 leading-relaxed">
                                                        {feedbackText || (ideaStatus === 'approved'
                                                            ? 'Idea accepted by guide.'
                                                            : ideaStatus === 'rejected'
                                                                ? 'Idea rejected by guide.'
                                                                : 'Guide feedback available.')}
                                                    </p>
                                                    <p className="text-[10px] text-slate-300">
                                                        {entry.created_at ? new Date(entry.created_at).toLocaleString() : '-'}
                                                    </p>
                                                </div>
                                            );
                                        })}
                                        {latestByType.map(doc => {
                                            const status = (doc.status || 'submitted').toLowerCase();
                                            const nextStage = getNextDocType(doc.document_type);
                                            const typeLabel = DOC_TYPE_LABELS[doc.document_type] || doc.document_type?.replaceAll('_', ' ');
                                            const feedbackText = (doc.feedback || '').trim();
                                            return (
                                                <div key={`mentor-${doc.id}`}
                                                    className="rounded-xl border border-white/80 bg-white/50 p-3.5 space-y-2">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <p className="text-xs font-black text-slate-800">{typeLabel}</p>
                                                        <StatusBadge status={doc.status} />
                                                    </div>
                                                    <p className="text-xs text-slate-500 leading-relaxed">
                                                        {isRejectedStatus(status) && (feedbackText || 'Rejected by mentor. Re-upload with corrections.')}
                                                        {status === 'approved' && (feedbackText || 'Approved. Proceed to the next stage.')}
                                                        {status === 'submitted' && (feedbackText || 'Pending mentor review.')}
                                                    </p>
                                                    <p className="text-[10px] text-slate-300">
                                                        {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleString() : '-'}
                                                    </p>
                                                    {isRejectedStatus(status) && (
                                                        <button type="button" onClick={() => focusUploadForType(doc.document_type)}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-xs font-bold hover:bg-rose-100 transition-all">
                                                            <span className="material-symbols-outlined text-sm">upload</span> Re-upload
                                                        </button>
                                                    )}
                                                    {status === 'approved' && nextStage && (
                                                        <button type="button" onClick={() => focusUploadForType(nextStage.value)}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100 transition-all">
                                                            <span className="material-symbols-outlined text-sm">arrow_forward</span> {nextStage.label}
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Version History card */}
                        <div className="glass-card-strong overflow-hidden">
                            <SectionHeader icon="timeline" iconColor="#64748b" title="Version History" />
                            <div className="p-4">
                                {documents.length === 0 ? (
                                    <p className="text-xs text-slate-400 text-center py-4">No versions yet.</p>
                                ) : (
                                    <div className="space-y-3 max-h-52 overflow-y-auto pr-0.5">
                                        {documents.slice(0, 10).map(d => (
                                            <div key={d.id} className="flex items-start gap-2.5">
                                                <div className="mt-1.5 size-2 rounded-full flex-shrink-0" style={{ backgroundColor: '#00C4B4' }} />
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-xs font-bold text-slate-800 capitalize leading-none">
                                                        {d.document_type?.replaceAll('_', ' ')}
                                                        <span className="ml-1.5 text-[10px] font-black text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">v{d.version ?? 1}</span>
                                                    </p>
                                                    <p className="text-[11px] text-slate-500 truncate mt-0.5">{d.file_name}</p>
                                                    <p className="text-[10px] text-slate-400">{d.uploaded_at ? new Date(d.uploaded_at).toLocaleString() : '-'}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Submission Guidelines card */}
                        <div className="glass-card-strong overflow-hidden">
                            <SectionHeader icon="info" title="Submission Guidelines" />
                            <div className="p-4">
                                <ul className="space-y-2.5">
                                    {GUIDELINES.map((g, i) => (
                                        <li key={i} className="flex items-start gap-2.5 text-xs text-slate-600">
                                            <span className="size-4 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[9px] font-black text-slate-500 shrink-0 mt-0.5 shadow-sm">{i + 1}</span>
                                            {g}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}
