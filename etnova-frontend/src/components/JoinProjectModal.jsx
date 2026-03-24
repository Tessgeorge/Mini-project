import { useState, useEffect } from 'react';
import Modal from './Modal';
import { apiRequest } from '../config/apiClient';
import FeedbackBanner from './FeedbackBanner';
import EmptyStatePanel from './EmptyStatePanel';

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
            const [projectsData, myProjectsData, myRequests] = await Promise.all([
                apiRequest('/projects/public/pending'),
                apiRequest('/projects'),
                apiRequest('/join-requests/my'),
            ]);

            const myProjectIds = new Set((myProjectsData || []).map((p) => p.id));
            const pendingIds = new Set((myRequests || []).map((r) => r.project_id));
            setPendingProjectIds(pendingIds);

            const available = (projectsData || [])
                .map((p) => ({
                    ...p,
                    creator_name: p.creator?.full_name || 'Unknown',
                }))
                .filter((p) => {
                    const memberCount = p.team_members?.length || 0;
                    return memberCount < 4 && !myProjectIds.has(p.id);
                });

            setProjects(available);
        } catch (err) {
            setError(err.message || 'Failed to load projects');
        } finally {
            setLoading(false);
        }
    };

    const handleJoin = async (projectId) => {
        if (pendingProjectIds.has(projectId)) return;

        setJoining(projectId);
        setError('');

        try {
            await apiRequest(`/projects/${projectId}/join-requests`, {
                method: 'POST',
                body: {},
            });

            setPendingProjectIds((prev) => new Set([...prev, projectId]));
            setSuccessMsg('Join request sent! The team leader will review your request.');
            onSuccess?.();
        } catch (err) {
            setError(err.message || 'Failed to send join request');
        } finally {
            setJoining(null);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Join a Team" maxWidth="max-w-3xl">
            <div className="p-6">
                <p className="text-sm text-slate-500 mb-4">
                    Browse teams that still have open member slots. Your request goes to the team leader for approval.
                </p>
                {error && (
                    <FeedbackBanner tone="error" className="mb-4">
                        {error}
                    </FeedbackBanner>
                )}
                {successMsg && (
                    <FeedbackBanner tone="success" className="mb-4">
                        {successMsg}
                    </FeedbackBanner>
                )}

                {loading ? (
                    <div className="text-center py-12 rounded-2xl border border-slate-200 bg-slate-50/70">
                        <div className="inline-block size-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin"></div>
                        <p className="text-sm text-slate-500 mt-3">Loading available teams...</p>
                    </div>
                ) : projects.length === 0 ? (
                    <EmptyStatePanel
                        icon="group_off"
                        title="No teams available to join"
                        description="All visible teams are either full, already requested, or you are already a member."
                    />
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
                                            {project.team_name && project.team_name !== project.title && (
                                                <p className="text-xs font-semibold text-slate-500 mb-1">Team: {project.team_name}</p>
                                            )}
                                            <p className="text-sm text-slate-600 mb-2 line-clamp-2">{project.description || "No draft idea summary has been added yet."}</p>
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
