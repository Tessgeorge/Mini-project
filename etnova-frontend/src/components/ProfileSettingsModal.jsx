import { useEffect, useState } from 'react';
import Modal from './Modal';
import { apiRequest } from '../config/apiClient';

export default function ProfileSettingsModal({ isOpen, onClose, profile, onSuccess, requireCompletion = false }) {
    const [formData, setFormData] = useState({
        full_name: profile?.full_name || '',
        roll_number: profile?.roll_number || '',
        department: profile?.department || '',
        semester: profile?.semester || '',
        class_section: profile?.class_section || '',
        phone: profile?.phone || '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        setFormData({
            full_name: profile?.full_name || '',
            roll_number: profile?.roll_number || '',
            department: profile?.department || '',
            semester: profile?.semester || '',
            class_section: profile?.class_section || '',
            phone: profile?.phone || '',
        });
    }, [isOpen, profile]);

    const handleChange = (e) => {
        let value = e.target.name === 'semester' ? parseInt(e.target.value) || '' : e.target.value;
        if (e.target.name === 'class_section') {
            value = String(value || '').toUpperCase();
        }
        setFormData({ ...formData, [e.target.name]: value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        try {
            await apiRequest('/profile', {
                method: 'PUT',
                body: {
                    full_name: formData.full_name,
                    roll_number: formData.roll_number,
                    department: formData.department,
                    semester: formData.semester,
                    class_section: formData.class_section,
                    phone: formData.phone,
                    updated_at: new Date().toISOString(),
                },
            });

            setSuccess('Profile updated successfully!');
            setTimeout(() => {
                onSuccess?.();
                onClose();
            }, 1500);
        } catch (err) {
            console.error('Update profile error:', err);
            setError(err.message || 'Failed to update profile');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Profile Settings"
            maxWidth="max-w-2xl"
            disableClose={requireCompletion}
        >
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
                {error && (
                    <div className="glass-alert flex items-center gap-2 px-4 py-3 text-sm font-medium"
                        style={{ background: 'rgba(244,63,94,0.07)', borderColor: 'rgba(244,63,94,0.25)', color: '#be123c' }}>
                        <span className="material-symbols-outlined text-base flex-shrink-0">error</span>
                        <span>{error}</span>
                    </div>
                )}

                {success && (
                    <div className="glass-alert flex items-center gap-2 px-4 py-3 text-sm font-medium"
                        style={{ background: 'rgba(16,185,129,0.07)', borderColor: 'rgba(16,185,129,0.25)', color: '#065f46' }}>
                        <span className="material-symbols-outlined text-base flex-shrink-0">check_circle</span>
                        <span>{success}</span>
                    </div>
                )}

                {/* Email (read-only) */}
                <div>
                    <label htmlFor="email" className="block text-sm font-bold text-slate-900 mb-2">
                        Email Address
                    </label>
                    <input
                        type="email"
                        id="email"
                        value={profile?.email || ''}
                        disabled
                        className="glass-input w-full px-4 py-3 text-slate-400 cursor-not-allowed opacity-70"
                    />
                    <p className="text-xs text-slate-500 mt-1">Email cannot be changed</p>
                </div>

                {/* Full Name */}
                <div>
                    <label htmlFor="full_name" className="block text-sm font-bold text-slate-900 mb-2">
                        Full Name *
                    </label>
                    <input
                        type="text"
                        id="full_name"
                        name="full_name"
                        value={formData.full_name}
                        onChange={handleChange}
                        required
                        className="glass-input w-full px-4 py-3 text-slate-900 placeholder:text-slate-400 outline-none"
                        placeholder="Enter your full name"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Roll Number */}
                    <div>
                        <label htmlFor="roll_number" className="block text-sm font-bold text-slate-900 mb-2">
                            Roll Number *
                        </label>
                        <input
                            type="text"
                            id="roll_number"
                            name="roll_number"
                            value={formData.roll_number}
                            onChange={handleChange}
                            required
                            className="glass-input w-full px-4 py-3 text-slate-900 placeholder:text-slate-400 outline-none"
                            placeholder="e.g., CS21B001"
                        />
                    </div>

                    {/* Semester */}
                    <div>
                        <label htmlFor="semester" className="block text-sm font-bold text-slate-900 mb-2">
                            Semester *
                        </label>
                        <input
                            type="number"
                            id="semester"
                            name="semester"
                            value={formData.semester}
                            onChange={handleChange}
                            required
                            min="1"
                            max="8"
                            className="glass-input w-full px-4 py-3 text-slate-900 placeholder:text-slate-400 outline-none"
                            placeholder="e.g., 6"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Department */}
                    <div>
                        <label htmlFor="department" className="block text-sm font-bold text-slate-900 mb-2">
                            Department
                        </label>
                        <input
                            type="text"
                            id="department"
                            name="department"
                            value={formData.department}
                            onChange={handleChange}
                            className="glass-input w-full px-4 py-3 text-slate-900 placeholder:text-slate-400 outline-none"
                            placeholder="e.g., Computer Science"
                        />
                    </div>

                    {/* Section */}
                    <div>
                        <label htmlFor="class_section" className="block text-sm font-bold text-slate-900 mb-2">
                            Section
                        </label>
                        <input
                            type="text"
                            id="class_section"
                            name="class_section"
                            value={formData.class_section}
                            onChange={handleChange}
                            className="glass-input w-full px-4 py-3 text-slate-900 placeholder:text-slate-400 outline-none"
                            placeholder="e.g., A"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                            Enter just <span className="font-semibold text-slate-700">A</span>, <span className="font-semibold text-slate-700">B</span>, or <span className="font-semibold text-slate-700">C</span>. We will map it to your full class automatically.
                        </p>
                    </div>
                </div>

                {/* Phone */}
                <div>
                    <label htmlFor="phone" className="block text-sm font-bold text-slate-900 mb-2">
                        Phone Number
                    </label>
                    <input
                        type="tel"
                        id="phone"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        className="glass-input w-full px-4 py-3 text-slate-900 placeholder:text-slate-400 outline-none"
                        placeholder="e.g., +91 9876543210"
                    />
                </div>

                {/* Buttons */}
                <div className="flex gap-3 pt-4">
                    {!requireCompletion && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 rounded-xl bg-white/60 border border-slate-200/70 text-slate-700 font-bold text-sm hover:bg-white/80 transition-all"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                    )}
                    <button
                        type="submit"
                        className={`btn-primary ${requireCompletion ? 'w-full' : 'flex-1'} py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed`}
                        disabled={loading}
                    >
                        {loading ? (
                            <><div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
                        ) : 'Save Changes'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
