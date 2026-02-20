import { useState, useEffect } from 'react';
import Modal from './Modal';
import supabase from '../config/supabaseClient';

export default function JoinProjectModal({ isOpen, onClose, onSuccess }) {
    const [projects, setProjects] = useState([]);
    const [pendingProjectIds, setPendingProjectIds] = useState(new Set());
    const [loading, setLoading] = useState(false);
    const [joining, setJoining] = useState(null);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    useEffect(() => {
        if (isOpen) {
            loadAvailableProjects();
        }
    }, [isOpen]);

    const loadAvailableProjects = async () => {
        setLoading(true);
        setError('');
        setSuccessMsg('');

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            // Fetch projects and user's existing pending requests in parallel
            const [projectsRes, requestsRes] = await Promise.all([
                supabase
                    .from('projects')
                    .select('*, team_members(student_id)')
                    .eq('status', 'pending')
                    .order('created_at', { ascending: false }),
                supabase
                    .from('join_requests')
                    .select('project_id')
                    .eq('student_id', user.id)
                    .eq('status', 'pending'),
            ]);

            if (projectsRes.error) throw projectsRes.error;

            // Build set of project IDs where user already has a pending request
            const pendingIds = new Set(
                (requestsRes.data || []).map(r => r.project_id)
            );
            setPendingProjectIds(pendingIds);

            // Fetch creator profiles
            const uniqueProjectsMap = new Map();
            const creatorIds = new Set();
            (projectsRes.data || []).forEach(project => {
                if (!uniqueProjectsMap.has(project.id)) {
                    uniqueProjectsMap.set(project.id, project);
                    if (project.created_by) creatorIds.add(project.created_by);
                }
            });

            const { data: creators } = await supabase
                .from('profiles')
                .select('id, full_name')
                .in('id', Array.from(creatorIds));

            const creatorMap = new Map();
            (creators || []).forEach(c => creatorMap.set(c.id, c.full_name));

            const uniqueProjects = Array.from(uniqueProjectsMap.values()).map(p => ({
                ...p,
                creator_name: creatorMap.get(p.created_by) || 'Unknown',
            }));

            // Filter: not full, not already a member
            const available = uniqueProjects.filter(p => {
                const memberCount = p.team_members?.length || 0;
                const isAlreadyMember = p.team_members?.some(tm => tm.student_id === user.id);
                return memberCount < 4 && !isAlreadyMember;
            });

            setProjects(available);
        } catch (err) {
            setError(err.message || 'Failed to load projects');
        } finally {
            setLoading(false);
        }
    };

    const handleJoin = async (projectId) => {
        if (pendingProjectIds.has(projectId)) return; // already requested

        setJoining(projectId);
        setError('');

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const { error: requestError } = await supabase
                .from('join_requests')
                .insert({
                    project_id: projectId,
                    student_id: user.id,
                    status: 'pending',
                });

            if (requestError) {
                if (requestError.code === '23505') {
                    // Already exists — just update UI state
                    setPendingProjectIds(prev => new Set([...prev, projectId]));
                    return;
                }
                throw requestError;
            }

            // Mark as pending in UI
            setPendingProjectIds(prev => new Set([...prev, projectId]));
            setSuccessMsg('Join request sent! The team leader will review your request.');
            onSuccess?.();
        } catch (err) {
            setError(err.message || 'Failed to send join request');
        } finally {
            setJoining(null);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Join a Project" maxWidth="max-w-3xl">
            <div className="p-6">
                {error && (
                    <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
                        <span className="material-symbols-outlined text-base">error</span>
                        {error}
                    </div>
                )}
                {successMsg && (
                    <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 flex items-center gap-2">
                        <span className="material-symbols-outlined text-base">check_circle</span>
                        {successMsg}
                    </div>
                )}

                {loading ? (
                    <div className="text-center py-12">
                        <div className="inline-block size-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin"></div>
                        <p className="text-sm text-slate-500 mt-3">Loading available projects...</p>
                    </div>
                ) : projects.length === 0 ? (
                    <div className="text-center py-12">
                        <span className="material-symbols-outlined text-6xl text-slate-300 mb-3">folder_off</span>
                        <p className="text-slate-600 font-medium">No projects available to join</p>
                        <p className="text-sm text-slate-500 mt-1">All projects are either full or you're already a member</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {projects.map((project) => {
                            const isPending = pendingProjectIds.has(project.id);
                            const isSending = joining === project.id;
                            return (
                                <div
                                    key={project.id}
                                    className="border border-slate-200 rounded-xl p-4 hover:border-teal-300 hover:bg-teal-50/30 transition-all"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1">
                                            <h3 className="font-black text-slate-900 mb-1">{project.title}</h3>
                                            <p className="text-sm text-slate-600 mb-2 line-clamp-2">{project.description}</p>
                                            <div className="flex items-center gap-4 text-xs text-slate-500">
                                                <span className="flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-sm">person</span>
                                                    Created by {project.creator_name}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-sm">group</span>
                                                    {project.team_members?.length || 0}/4 members
                                                </span>
                                            </div>
                                        </div>

                                        {isPending ? (
                                            /* Already requested — show pending badge */
                                            <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
                                                <span className="material-symbols-outlined text-sm">hourglass_top</span>
                                                Request Sent
                                            </span>
                                        ) : (
                                            <button
                                                onClick={() => handleJoin(project.id)}
                                                disabled={isSending}
                                                className="px-4 py-2 rounded-lg text-black font-bold text-sm hover:opacity-90 transition-all whitespace-nowrap disabled:opacity-60"
                                                style={{ backgroundColor: '#00D2C4' }}
                                            >
                                                {isSending ? 'Sending...' : 'Request to Join'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                <div className="mt-6 pt-4 border-t border-slate-200">
                    <button
                        onClick={onClose}
                        className="w-full px-4 py-3 rounded-xl bg-slate-100 text-slate-700 font-bold text-sm hover:bg-slate-200 transition-all"
                    >
                        Close
                    </button>
                </div>
            </div>
        </Modal>
    );
}
