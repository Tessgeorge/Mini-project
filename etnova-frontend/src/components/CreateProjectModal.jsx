import { useState } from 'react';
import Modal from './Modal';
import { apiRequest } from '../config/apiClient';

const INITIAL_FORM = {
    teamName: '',
    initialIdea: '',
    technologyStacks: '',
    description: '',
};

function parseTechnologyStacks(input) {
    return [...new Set(
        String(input || '')
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
    )];
}

export default function CreateProjectModal({ isOpen, onClose, onSuccess, leaderName }) {
    const [formData, setFormData] = useState(INITIAL_FORM);
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
            await apiRequest('/projects', {
                method: 'POST',
                body: {
                    team_name: formData.teamName,
                    title: formData.initialIdea,
                    technology_stacks: parseTechnologyStacks(formData.technologyStacks),
                    description: formData.description,
                },
            });

            // Success!
            setFormData(INITIAL_FORM);
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
        <Modal isOpen={isOpen} onClose={onClose} title="Create New Team">
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
                {error && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {error}
                    </div>
                )}

                <div>
                    <label htmlFor="teamName" className="block text-sm font-bold text-slate-900 mb-2">
                        Team Name *
                    </label>
                    <input
                        type="text"
                        id="teamName"
                        name="teamName"
                        value={formData.teamName}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all text-slate-900 placeholder:text-slate-400"
                        placeholder="Enter your team name"
                    />
                </div>

                <div>
                    <label className="block text-sm font-bold text-slate-900 mb-2">
                        Team Leader
                    </label>
                    <div className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-600 text-sm">
                        {leaderName || 'Current logged-in student'}
                    </div>
                </div>

                <div>
                    <label htmlFor="initialIdea" className="block text-sm font-bold text-slate-900 mb-2">
                        Initial Idea
                    </label>
                    <input
                        type="text"
                        id="initialIdea"
                        name="initialIdea"
                        value={formData.initialIdea}
                        onChange={handleChange}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all text-slate-900 placeholder:text-slate-400"
                        placeholder="Draft project idea title (optional)"
                    />
                </div>

                <div>
                    <label htmlFor="description" className="block text-sm font-bold text-slate-900 mb-2">
                        Short Description
                    </label>
                    <textarea
                        id="description"
                        name="description"
                        value={formData.description}
                        onChange={handleChange}
                        rows={3}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all text-slate-900 placeholder:text-slate-400 resize-none"
                        placeholder="Draft summary for your initial idea (optional)"
                    />
                </div>

                <div>
                    <label htmlFor="technologyStacks" className="block text-sm font-bold text-slate-900 mb-2">
                        Technologies
                    </label>
                    <input
                        type="text"
                        id="technologyStacks"
                        name="technologyStacks"
                        value={formData.technologyStacks}
                        onChange={handleChange}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all text-slate-900 placeholder:text-slate-400"
                        placeholder="React, Node.js, Python (optional)"
                    />
                    <p className="text-xs text-slate-500 mt-1">This creates a draft idea that can be refined later in Idea Workspace.</p>
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
                        {loading ? 'Creating...' : 'Create Team'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
