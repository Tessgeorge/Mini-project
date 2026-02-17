import { useState, useEffect } from 'react';
import Modal from './Modal';
import supabase from '../config/supabaseClient';

export default function JoinRequestsModal({ isOpen, onClose, onRequestHandled }) {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(false);
    const [processing, setProcessing] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            loadJoinRequests();
        }
    }, [isOpen]);

    const loadJoinRequests = async () => {
        setLoading(true);
        setError('');

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            console.log('🔍 Loading join requests for user:', user.id);

            // Get projects where user is the leader
            const { data: leaderProjects } = await supabase
                .from('team_members')
                .select('project_id')
                .eq('student_id', user.id)
                .eq('role', 'leader');

            if (!leaderProjects || leaderProjects.length === 0) {
                console.log('User is not a leader of any projects');
                setRequests([]);
                setLoading(false);
                return;
            }

            const projectIds = leaderProjects.map(p => p.project_id);

            // Get pending join requests for those projects
            const { data: joinRequests, error: requestsError } = await supabase
                .from('join_requests')
                .select(`
                    *,
                    project:projects(id, title),
                    student:profiles!student_id(id, full_name, roll_number, department, semester)
                `)
                .in('project_id', projectIds)
                .eq('status', 'pending')
                .order('created_at', { ascending: false });

            if (requestsError) {
                console.error('❌ Error fetching join requests:', requestsError);
                throw requestsError;
            }

            console.log('📋 Pending join requests:', joinRequests?.length || 0);
            setRequests(joinRequests || []);
        } catch (err) {
            console.error('Load join requests error:', err);
            setError(err.message || 'Failed to load join requests');
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (request) => {
        setProcessing(request.id);
        setError('');

        try {
            // 1. Add student to team_members
            const { error: addError } = await supabase
                .from('team_members')
                .insert({
                    project_id: request.project_id,
                    student_id: request.student_id,
                    role: 'member',
                });

            if (addError) {
                if (addError.code === '23505') {
                    throw new Error('Student is already a member of this project');
                }
                throw addError;
            }

            // 2. Update request status to 'approved'
            const { error: updateError } = await supabase
                .from('join_requests')
                .update({ status: 'approved' })
                .eq('id', request.id);

            if (updateError) throw updateError;

            // Remove from local state
            setRequests(prev => prev.filter(r => r.id !== request.id));

            // Notify parent component
            onRequestHandled?.();

            alert(`Request approved! ${request.student.full_name} has been added to the team.`);
        } catch (err) {
            console.error('Approve request error:', err);
            setError(err.message || 'Failed to approve request');
        } finally {
            setProcessing(null);
        }
    };

    const handleReject = async (request) => {
        setProcessing(request.id);
        setError('');

        try {
            // Update request status to 'rejected'
            const { error: updateError } = await supabase
                .from('join_requests')
                .update({ status: 'rejected' })
                .eq('id', request.id);

            if (updateError) throw updateError;

            // Remove from local state
            setRequests(prev => prev.filter(r => r.id !== request.id));

            // Notify parent component
            onRequestHandled?.();

            alert(`Request rejected. ${request.student.full_name} will need to send a new request.`);
        } catch (err) {
            console.error('Reject request error:', err);
            setError(err.message || 'Failed to reject request');
        } finally {
            setProcessing(null);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Join Requests" maxWidth="max-w-3xl">
            <div className="p-6">
                {error && (
                    <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {error}
                    </div>
                )}

                {loading ? (
                    <div className="text-center py-12">
                        <div className="inline-block size-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin"></div>
                        <p className="text-sm text-slate-500 mt-3">Loading join requests...</p>
                    </div>
                ) : requests.length === 0 ? (
                    <div className="text-center py-12">
                        <span className="material-symbols-outlined text-6xl text-slate-300 mb-3">inbox</span>
                        <p className="text-slate-600 font-medium">No pending join requests</p>
                        <p className="text-sm text-slate-500 mt-1">Requests from students will appear here</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {requests.map((request) => (
                            <div
                                key={request.id}
                                className="border border-slate-200 rounded-xl p-4 hover:border-teal-300 hover:bg-teal-50/30 transition-all"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="material-symbols-outlined text-teal-600">person</span>
                                            <h3 className="font-black text-slate-900">{request.student.full_name}</h3>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 mb-2">
                                            <div className="text-xs text-slate-600">
                                                <span className="font-medium">Roll:</span> {request.student.roll_number || 'N/A'}
                                            </div>
                                            <div className="text-xs text-slate-600">
                                                <span className="font-medium">Department:</span> {request.student.department || 'N/A'}
                                            </div>
                                            <div className="text-xs text-slate-600">
                                                <span className="font-medium">Semester:</span> {request.student.semester || 'N/A'}
                                            </div>
                                            <div className="text-xs text-slate-600">
                                                <span className="font-medium">Requested:</span> {new Date(request.created_at).toLocaleDateString()}
                                            </div>
                                        </div>

                                        <div className="text-xs text-slate-500">
                                            <span className="material-symbols-outlined text-xs align-middle mr-1">folder</span>
                                            Project: <span className="font-medium">{request.project.title}</span>
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleApprove(request)}
                                            disabled={processing === request.id}
                                            className="px-4 py-2 rounded-lg bg-green-500 text-white font-bold text-sm hover:bg-green-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {processing === request.id ? 'Processing...' : 'Approve'}
                                        </button>
                                        <button
                                            onClick={() => handleReject(request)}
                                            disabled={processing === request.id}
                                            className="px-4 py-2 rounded-lg bg-red-500 text-white font-bold text-sm hover:bg-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Reject
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
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
