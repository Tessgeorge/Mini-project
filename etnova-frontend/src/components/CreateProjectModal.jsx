import { useState } from 'react';
import Modal from './Modal';
import supabase from '../config/supabaseClient';

export default function CreateProjectModal({ isOpen, onClose, onSuccess }) {
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        abstract: '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            // Get current user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            // Create project via API would be better, but for now use direct Supabase
            const { data: project, error: projectError } = await supabase
                .from('projects')
                .insert({
                    title: formData.title,
                    description: formData.description,
                    abstract: formData.abstract,
                    created_by: user.id,
                    status: 'pending',
                })
                .select()
                .single();

            if (projectError) throw projectError;

            // Note: DB trigger handle_new_project() auto-adds creator as team leader
            // No need to manually insert into team_members here

            // Success!
            setFormData({ title: '', description: '', abstract: '' });
            onSuccess?.();
            onClose();
        } catch (err) {
            console.error('Create project error:', err);
            setError(err.message || 'Failed to create project');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Create New Project">
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
                {error && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {error}
                    </div>
                )}

                <div>
                    <label htmlFor="title" className="block text-sm font-bold text-slate-900 mb-2">
                        Project Title *
                    </label>
                    <input
                        type="text"
                        id="title"
                        name="title"
                        value={formData.title}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all text-slate-900 placeholder:text-slate-400"
                        placeholder="Enter your project title"
                    />
                </div>

                <div>
                    <label htmlFor="description" className="block text-sm font-bold text-slate-900 mb-2">
                        Description *
                    </label>
                    <textarea
                        id="description"
                        name="description"
                        value={formData.description}
                        onChange={handleChange}
                        required
                        rows={3}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all text-slate-900 placeholder:text-slate-400 resize-none"
                        placeholder="Brief description of your project"
                    />
                </div>

                <div>
                    <label htmlFor="abstract" className="block text-sm font-bold text-slate-900 mb-2">
                        Abstract
                    </label>
                    <textarea
                        id="abstract"
                        name="abstract"
                        value={formData.abstract}
                        onChange={handleChange}
                        rows={4}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all text-slate-900 placeholder:text-slate-400 resize-none"
                        placeholder="Detailed abstract of your project (optional for now)"
                    />
                    <p className="text-xs text-slate-500 mt-1">You can add or update this later</p>
                </div>

                <div className="flex gap-3 pt-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-4 py-3 rounded-xl bg-slate-100 text-slate-700 font-bold text-sm hover:bg-slate-200 transition-all"
                        disabled={loading}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="flex-1 px-4 py-3 rounded-xl text-black font-bold text-sm hover:opacity-90 transition-all shadow-md"
                        style={{ backgroundColor: '#00D2C4' }}
                        disabled={loading}
                    >
                        {loading ? 'Creating...' : 'Create Project'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
