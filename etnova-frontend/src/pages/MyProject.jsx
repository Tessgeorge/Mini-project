import { useEffect, useState } from 'react';
import supabase from '../config/supabaseClient';

export default function MyProject() {
    const [loading, setLoading] = useState(true);
    const [project, setProject] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        loadProjectData();
    }, []);

    const loadProjectData = async () => {
        setLoading(true);
        setError('');

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            // Get user's project via team_members
            const { data: tmRows } = await supabase
                .from('team_members')
                .select(`
                    role,
                    project:project_id (
                        id, title, abstract, description, status, created_at
                    )
                `)
                .eq('student_id', user.id)
                .limit(1);

            const tm = tmRows?.[0];
            const proj = tm?.project;

            if (!proj?.id) {
                // No project found
                setLoading(false);
                return;
            }

            setProject(proj);
        } catch (err) {
            console.error('Load project error:', err);
            setError(err.message || 'Failed to load project');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-block size-12 border-4 border-slate-200 border-t-teal-500 rounded-full animate-spin"></div>
                    <p className="mt-4 text-slate-600 font-medium">Loading project...</p>
                </div>
            </div>
        );
    }

    if (!project) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center max-w-md">
                    <span className="material-symbols-outlined text-6xl text-slate-300 mb-4">folder_off</span>
                    <h2 className="text-xl font-black text-slate-900 mb-2">No Project Found</h2>
                    <p className="text-slate-600">You haven't joined or created a project yet.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 px-6 py-4">
                <div className="max-w-7xl mx-auto">
                    <h1 className="text-2xl font-black text-slate-900">{project.title}</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Status: <span className="font-medium capitalize">{project.status}</span>
                    </p>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-6 py-8">
                {error && (
                    <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {error}
                    </div>
                )}

                {/* Project Overview */}
                <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6">
                    <h2 className="text-lg font-black text-slate-900 mb-4">Project Overview</h2>

                    {project.abstract && (
                        <div className="mb-4">
                            <h3 className="text-sm font-bold text-slate-700 mb-1">Abstract</h3>
                            <p className="text-slate-600">{project.abstract}</p>
                        </div>
                    )}

                    {project.description && (
                        <div>
                            <h3 className="text-sm font-bold text-slate-700 mb-1">Description</h3>
                            <p className="text-slate-600">{project.description}</p>
                        </div>
                    )}

                    <div className="mt-4 pt-4 border-t border-slate-200 text-xs text-slate-500">
                        Created: {new Date(project.created_at).toLocaleDateString()}
                    </div>
                </section>
            </main>
        </div>
    );
}
