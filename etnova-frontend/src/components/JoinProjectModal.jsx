import { useState, useEffect } from 'react';
import Modal from './Modal';
import supabase from '../config/supabaseClient';

export default function JoinProjectModal({ isOpen, onClose, onSuccess }) {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(false);
    const [joining, setJoining] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            loadAvailableProjects();
        }
    }, [isOpen]);

    const loadAvailableProjects = async () => {
        setLoading(true);
        setError('');

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            console.log('🔍 Fetching projects for user:', user.id);

            // Step 1: Get all projects with team members count
            const { data: allProjects, error: projectsError } = await supabase
                .from('projects')
                .select('*, team_members(student_id)')
                .eq('status', 'pending')
                .order('created_at', { ascending: false });

            if (projectsError) {
                console.error('❌ Error fetching projects:', projectsError);
                throw projectsError;
            }

            console.log('📋 Total projects fetched:', allProjects?.length || 0);

            // Step 2: Get unique projects and fetch creator profiles
            const uniqueProjectsMap = new Map();
            const creatorIds = new Set();

            (allProjects || []).forEach(project => {
                if (!uniqueProjectsMap.has(project.id)) {
                    uniqueProjectsMap.set(project.id, project);
                    if (project.created_by) {
                        creatorIds.add(project.created_by);
                    }
                }
            });

            // Step 3: Fetch all creator profiles in one query
            const { data: creators } = await supabase
                .from('profiles')
                .select('id, full_name')
                .in('id', Array.from(creatorIds));

            // Create a map of creator ID to name
            const creatorMap = new Map();
            (creators || []).forEach(creator => {
                creatorMap.set(creator.id, creator.full_name);
            });

            // Step 4: Attach creator names to projects
            const uniqueProjects = Array.from(uniqueProjectsMap.values()).map(project => ({
                ...project,
                creator_name: creatorMap.get(project.created_by) || 'Unknown'
            }));

            console.log('📋 Unique projects with creators:', uniqueProjects);

            // Filter projects: not full (< 4 members) and user not already in
            const available = uniqueProjects.filter(p => {
                const memberCount = p.team_members?.length || 0;
                const isAlreadyMember = p.team_members?.some(tm => tm.student_id === user.id);

                console.log(`Project "${p.title}":`, {
                    creator: p.creator_name,
                    memberCount,
                    isAlreadyMember,
                    isFull: memberCount >= 4,
                    willShow: memberCount < 4 && !isAlreadyMember
                });

                return memberCount < 4 && !isAlreadyMember;
            });

            console.log('✅ Available projects to join:', available.length);
            setProjects(available);
        } catch (err) {
            console.error('Load projects error:', err);
            setError(err.message || 'Failed to load projects');
        } finally {
            setLoading(false);
        }
    };

    const handleJoin = async (projectId) => {
        setJoining(projectId);
        setError('');

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const { error: joinError } = await supabase
                .from('team_members')
                .insert({
                    project_id: projectId,
                    student_id: user.id,
                    role: 'member',
                });

            if (joinError) {
                if (joinError.code === '23505') {
                    throw new Error('You are already a member of this project');
                }
                throw joinError;
            }

            onSuccess?.();
            onClose();
        } catch (err) {
            console.error('Join project error:', err);
            setError(err.message || 'Failed to join project');
        } finally {
            setJoining(null);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Join a Project" maxWidth="max-w-3xl">
            <div className="p-6">
                {error && (
                    <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {error}
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
                        {projects.map((project) => (
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
                                    <button
                                        onClick={() => handleJoin(project.id)}
                                        disabled={joining === project.id}
                                        className="px-4 py-2 rounded-lg text-black font-bold text-sm hover:opacity-90 transition-all whitespace-nowrap"
                                        style={{ backgroundColor: '#00D2C4' }}
                                    >
                                        {joining === project.id ? 'Joining...' : 'Join Team'}
                                    </button>
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
