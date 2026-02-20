import { useEffect, useRef, useState } from 'react';
import supabase from '../config/supabaseClient';

const DOC_TYPES = [
    { value: 'abstract', label: 'Abstract' },
    { value: 'srs', label: 'SRS (Software Requirements Specification)' },
    { value: 'proposal', label: 'Project Proposal' },
    { value: 'report', label: 'Progress Report' },
    { value: 'final_report', label: 'Final Report' },
    { value: 'presentation', label: 'Presentation / PPT' },
];

const DEADLINES = [
    { type: 'Abstract', date: '2026-03-01', label: 'Mar 1' },
    { type: 'Proposal', date: '2026-03-15', label: 'Mar 15' },
    { type: 'Report', date: '2026-04-10', label: 'Apr 10' },
    { type: 'Final Report', date: '2026-05-01', label: 'May 1' },
    { type: 'Presentation', date: '2026-05-15', label: 'May 15' },
];

const GUIDELINES = [
    'Submit PDF format only for reports and abstracts.',
    'PPT files accepted as .pptx or .pdf.',
    'File size must not exceed 20 MB.',
    'Version is auto-incremented on re-upload.',
    'Contact your mentor for feedback queries.',
];

function StatusBadge({ status }) {
    const s = (status || 'submitted').toLowerCase();
    if (s === 'approved') return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="size-1.5 rounded-full bg-emerald-500 inline-block" />
            Approved
        </span>
    );
    if (s === 'needs_revision') return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <span className="size-1.5 rounded-full bg-rose-500 inline-block" />
            Needs Revision
        </span>
    );
    if (s === 'submitted') return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="size-1.5 rounded-full bg-amber-400 inline-block" />
            Pending
        </span>
    );
    return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-50 text-slate-500 border border-slate-200">
            <span className="size-1.5 rounded-full bg-slate-400 inline-block" />
            {status || 'Unknown'}
        </span>
    );
}

function DocTypeLabel({ type }) {
    const icons = {
        abstract: 'description',
        proposal: 'assignment',
        report: 'article',
        final_report: 'task_alt',
        presentation: 'slideshow',
        progress_update: 'trending_up',
    };
    const labels = {
        abstract: 'Abstract',
        proposal: 'Proposal',
        report: 'Progress Report',
        final_report: 'Final Report',
        presentation: 'Presentation',
        progress_update: 'Progress Update',
    };
    return (
        <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(0,210,196,0.1)' }}>
                <span className="material-symbols-outlined text-base" style={{ color: '#00D2C4' }}>
                    {icons[type] || 'insert_drive_file'}
                </span>
            </div>
            <span className="text-sm font-bold text-slate-800 capitalize">
                {labels[type] || type?.replaceAll('_', ' ')}
            </span>
        </div>
    );
}

export default function Submissions() {
    const fileInputRef = useRef(null);
    const [project, setProject] = useState(null);
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    // Upload form state
    const [docType, setDocType] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [isDragging, setIsDragging] = useState(false);

    // Feedback modal state
    const [feedbackDoc, setFeedbackDoc] = useState(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        setError('');
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            // Get user's project
            const { data: tmRows } = await supabase
                .from('team_members')
                .select('project:project_id (id, title, status)')
                .eq('student_id', user.id)
                .limit(1);

            const proj = tmRows?.[0]?.project;
            if (!proj?.id) {
                setLoading(false);
                return;
            }
            setProject(proj);

            // Get all documents for the project
            const { data: docs, error: docsErr } = await supabase
                .from('documents')
                .select('id, document_type, file_name, file_url, status, version, uploaded_at')
                .eq('project_id', proj.id)
                .order('uploaded_at', { ascending: false });

            if (docsErr) throw docsErr;
            setDocuments(docs || []);
        } catch (e) {
            setError(e.message || 'Failed to load submissions');
        } finally {
            setLoading(false);
        }
    };

    // Compute next version for a given doc type
    const getNextVersion = (type) => {
        const existing = documents.filter(d => d.document_type === type);
        return existing.length + 1;
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) setSelectedFile(file);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => setIsDragging(false);

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file) setSelectedFile(file);
    };

    const handleUpload = async () => {
        if (!docType) return setError('Please select a document type.');
        if (!selectedFile) return setError('Please select a file to upload.');
        if (!project?.id) return setError('No project found.');

        setUploading(true);
        setError('');
        setSuccessMsg('');

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const version = getNextVersion(docType);
            const ext = selectedFile.name.split('.').pop();
            const filePath = `${project.id}/${docType}_v${version}_${Date.now()}.${ext}`;

            // Try to upload file to storage (optional — won't block if bucket missing)
            let fileUrl = null;
            const { data: storageData, error: storageErr } = await supabase.storage
                .from('documents')
                .upload(filePath, selectedFile);

            if (storageErr) {
                console.warn('Storage upload failed (bucket may not exist):', storageErr.message);
                // Continue without file URL
            } else {
                const { data: urlData } = supabase.storage
                    .from('documents')
                    .getPublicUrl(filePath);
                fileUrl = urlData?.publicUrl || '';
            }

            // Insert document record into table
            const { error: insertErr } = await supabase
                .from('documents')
                .insert({
                    project_id: project.id,
                    document_type: docType,
                    file_name: selectedFile.name,
                    file_url: fileUrl,
                    status: 'submitted',
                    version,
                    uploaded_by: user.id,
                });

            if (insertErr) {
                console.error('Insert error:', insertErr);
                throw new Error(insertErr.message || 'Failed to save document record.');
            }

            setSuccessMsg(`✓ ${DOC_TYPES.find(d => d.value === docType)?.label} submitted successfully (v${version})${!fileUrl ? ' — file metadata saved (storage not configured)' : ''}`);
            setDocType('');
            setSelectedFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            loadData();
        } catch (e) {
            console.error('Upload error:', e);
            setError(e.message || 'Upload failed. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    // Upcoming deadline: find nearest
    const nearestDeadline = DEADLINES.find(d => new Date(d.date) >= new Date());

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-block size-12 border-4 border-slate-200 border-t-[#00D2C4] rounded-full animate-spin" />
                    <p className="mt-4 text-slate-600 font-medium">Loading submissions...</p>
                </div>
            </div>
        );
    }

    if (!project) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center max-w-md">
                    <span className="material-symbols-outlined text-6xl text-slate-300 mb-4 block">upload_file</span>
                    <h2 className="text-xl font-black text-slate-900 mb-2">No Project Found</h2>
                    <p className="text-slate-600">Join or create a project to access submissions.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Page Header */}
            <div className="bg-white border-b border-slate-200 px-6 py-5">
                <div className="max-w-7xl mx-auto">
                    <div className="flex items-center gap-3">
                        <div className="size-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#00D2C4' }}>
                            <span className="material-symbols-outlined text-black">upload_file</span>
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-slate-900">Project Submissions</h1>
                            <p className="text-sm text-slate-500">{project.title}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Alerts */}
                {error && (
                    <div className="mb-5 flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        <span className="material-symbols-outlined text-base">error</span>
                        {error}
                        <button onClick={() => setError('')} className="ml-auto">
                            <span className="material-symbols-outlined text-base">close</span>
                        </button>
                    </div>
                )}
                {successMsg && (
                    <div className="mb-5 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                        <span className="material-symbols-outlined text-base">check_circle</span>
                        {successMsg}
                        <button onClick={() => setSuccessMsg('')} className="ml-auto">
                            <span className="material-symbols-outlined text-base">close</span>
                        </button>
                    </div>
                )}

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    {/* LEFT: Main Content */}
                    <div className="xl:col-span-2 space-y-6">

                        {/* Upload Card */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                                <div>
                                    <h2 className="font-black text-slate-900">Upload New Submission</h2>
                                    <p className="text-xs text-slate-500 mt-0.5">Select document type and upload your file</p>
                                </div>
                                {nearestDeadline && (
                                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200">
                                        <span className="material-symbols-outlined text-sm text-amber-600">schedule</span>
                                        <span className="text-xs font-bold text-amber-700">
                                            {nearestDeadline.type}: {nearestDeadline.label}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <form className="p-6 space-y-5">
                                {/* Document Type Select */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">
                                        Document Type <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-base">description</span>
                                        <select
                                            value={docType}
                                            onChange={e => setDocType(e.target.value)}
                                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:border-[#00D2C4] appearance-none cursor-pointer"
                                            style={{ '--tw-ring-color': '#00D2C4' }}
                                        >
                                            <option value="">Select document type...</option>
                                            {DOC_TYPES.map(t => (
                                                <option key={t.value} value={t.value}>{t.label}</option>
                                            ))}
                                        </select>
                                        <span className="material-symbols-outlined absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-base pointer-events-none">expand_more</span>
                                    </div>
                                    {docType && (
                                        <p className="mt-1.5 text-xs text-slate-500">
                                            Auto version: <span className="font-bold text-slate-700">v{getNextVersion(docType)}</span>
                                        </p>
                                    )}
                                </div>

                                {/* Drag & Drop Upload Area */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">
                                        File <span className="text-rose-500">*</span>
                                    </label>
                                    <div
                                        onDrop={handleDrop}
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onClick={() => fileInputRef.current?.click()}
                                        className={`relative border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 p-8 text-center
                      ${isDragging
                                                ? 'border-[#00D2C4] bg-[rgba(0,210,196,0.05)]'
                                                : selectedFile
                                                    ? 'border-emerald-300 bg-emerald-50'
                                                    : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100'
                                            }`}
                                    >
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            className="hidden"
                                            accept=".pdf,.pptx,.docx,.doc"
                                            onChange={handleFileChange}
                                        />
                                        {selectedFile ? (
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="size-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                                                    <span className="material-symbols-outlined text-emerald-600">insert_drive_file</span>
                                                </div>
                                                <p className="text-sm font-bold text-emerald-700">{selectedFile.name}</p>
                                                <p className="text-xs text-slate-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                                                    className="text-xs text-slate-500 hover:text-rose-600 font-medium flex items-center gap-1"
                                                >
                                                    <span className="material-symbols-outlined text-sm">close</span>
                                                    Remove
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="size-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center">
                                                    <span className="material-symbols-outlined text-slate-400">cloud_upload</span>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-700">
                                                        Drag & drop your file here
                                                    </p>
                                                    <p className="text-xs text-slate-500 mt-1">or <span className="text-[#00D2C4] font-bold">browse to upload</span></p>
                                                    <p className="text-xs text-slate-400 mt-2">PDF, DOCX, PPTX • Max 20 MB</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Submit */}
                                <button
                                    type="button"
                                    onClick={handleUpload}
                                    disabled={uploading}
                                    className="w-full py-3 rounded-xl font-bold text-sm text-black flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    style={{ backgroundColor: '#00D2C4' }}
                                >
                                    {uploading ? (
                                        <>
                                            <div className="size-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                                            Uploading...
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined text-base">upload</span>
                                            Submit Document
                                        </>
                                    )}
                                </button>
                            </form>
                        </div>

                        {/* Submission History */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                                <div>
                                    <h2 className="font-black text-slate-900">Submission History</h2>
                                    <p className="text-xs text-slate-500 mt-0.5">{documents.length} document{documents.length !== 1 ? 's' : ''} submitted</p>
                                </div>
                                <button
                                    onClick={loadData}
                                    className="size-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:border-slate-300 transition-all"
                                    title="Refresh"
                                >
                                    <span className="material-symbols-outlined text-base">refresh</span>
                                </button>
                            </div>

                            {documents.length === 0 ? (
                                <div className="py-16 flex flex-col items-center gap-3 text-center px-6">
                                    <div className="size-14 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-2xl text-slate-300">folder_open</span>
                                    </div>
                                    <p className="text-sm font-bold text-slate-700">No submissions yet</p>
                                    <p className="text-xs text-slate-500">Upload your first document using the form above.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-slate-100">
                                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Document</th>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Ver.</th>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Uploaded</th>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Feedback</th>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {documents.map((doc) => (
                                                <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <DocTypeLabel type={doc.document_type} />
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-md">
                                                            v{doc.version ?? 1}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <StatusBadge status={doc.status} />
                                                    </td>
                                                    <td className="px-4 py-4 text-xs text-slate-500">
                                                        {doc.uploaded_at
                                                            ? new Date(doc.uploaded_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
                                                            : '—'}
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        {doc.feedback ? (
                                                            <button
                                                                onClick={() => setFeedbackDoc(doc)}
                                                                className="text-xs font-bold text-[#00D2C4] hover:underline flex items-center gap-1"
                                                            >
                                                                <span className="material-symbols-outlined text-sm">chat_bubble</span>
                                                                View
                                                            </button>
                                                        ) : (
                                                            <span className="text-xs text-slate-400">—</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <div className="flex items-center gap-2">
                                                            {doc.file_url && (
                                                                <a
                                                                    href={doc.file_url}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="size-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-[#00D2C4] hover:border-[#00D2C4] transition-all"
                                                                    title="View file"
                                                                >
                                                                    <span className="material-symbols-outlined text-sm">visibility</span>
                                                                </a>
                                                            )}
                                                            <button
                                                                onClick={() => {
                                                                    setDocType(doc.document_type);
                                                                    fileInputRef.current?.scrollIntoView({ behavior: 'smooth' });
                                                                }}
                                                                className="size-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-[#00D2C4] hover:border-[#00D2C4] transition-all"
                                                                title="Re-upload"
                                                            >
                                                                <span className="material-symbols-outlined text-sm">sync</span>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT: Sidebar Panels */}
                    <div className="space-y-5">

                        {/* Stats */}
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { label: 'Submitted', value: documents.filter(d => d.status === 'submitted').length, color: 'bg-amber-50 text-amber-700 border-amber-200', icon: 'hourglass_top' },
                                { label: 'Approved', value: documents.filter(d => d.status === 'approved').length, color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'task_alt' },
                                { label: 'Revision', value: documents.filter(d => d.status === 'needs_revision').length, color: 'bg-rose-50 text-rose-700 border-rose-200', icon: 'edit_note' },
                                { label: 'Total', value: documents.length, color: 'bg-slate-50 text-slate-700 border-slate-200', icon: 'folder_open' },
                            ].map(stat => (
                                <div key={stat.label} className={`rounded-xl border p-3 ${stat.color}`}>
                                    <span className="material-symbols-outlined text-lg">{stat.icon}</span>
                                    <p className="text-2xl font-black mt-1">{stat.value}</p>
                                    <p className="text-xs font-bold mt-0.5">{stat.label}</p>
                                </div>
                            ))}
                        </div>

                        {/* Upcoming Deadlines */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <span className="material-symbols-outlined text-base text-amber-500">event</span>
                                <h3 className="font-black text-slate-900 text-sm">Upcoming Deadlines</h3>
                            </div>
                            <div className="space-y-3">
                                {DEADLINES.map((d, i) => {
                                    const isPast = new Date(d.date) < new Date();
                                    return (
                                        <div key={i} className={`flex items-center justify-between py-2 border-b border-slate-50 last:border-0 ${isPast ? 'opacity-40' : ''}`}>
                                            <div className="flex items-center gap-2">
                                                <div className={`size-2 rounded-full ${isPast ? 'bg-slate-300' : 'bg-amber-400'}`} />
                                                <span className="text-xs font-bold text-slate-700">{d.type}</span>
                                            </div>
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${isPast ? 'bg-slate-100 text-slate-400' : 'bg-amber-50 text-amber-700'}`}>
                                                {d.label}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Quick Guidelines */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <span className="material-symbols-outlined text-base" style={{ color: '#00D2C4' }}>info</span>
                                <h3 className="font-black text-slate-900 text-sm">Submission Guidelines</h3>
                            </div>
                            <ul className="space-y-2.5">
                                {GUIDELINES.map((g, i) => (
                                    <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                                        <span className="size-4 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500 shrink-0 mt-0.5">
                                            {i + 1}
                                        </span>
                                        {g}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            {/* Feedback Modal */}
            {feedbackDoc && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="font-black text-slate-900">Mentor Feedback</h3>
                                <p className="text-xs text-slate-500 mt-0.5 capitalize">
                                    {feedbackDoc.document_type?.replaceAll('_', ' ')} · v{feedbackDoc.version ?? 1}
                                </p>
                            </div>
                            <button onClick={() => setFeedbackDoc(null)} className="size-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700">
                                <span className="material-symbols-outlined text-base">close</span>
                            </button>
                        </div>
                        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                            <p className="text-sm text-slate-700 leading-relaxed">{feedbackDoc.feedback || 'No feedback provided yet.'}</p>
                        </div>
                        <div className="mt-4 flex items-center justify-between">
                            <StatusBadge status={feedbackDoc.status} />
                            <button
                                onClick={() => setFeedbackDoc(null)}
                                className="px-4 py-2 rounded-xl text-sm font-bold text-black transition-all"
                                style={{ backgroundColor: '#00D2C4' }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
