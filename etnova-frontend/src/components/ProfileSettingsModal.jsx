import { useState } from 'react';
import Modal from './Modal';
import supabase from '../config/supabaseClient';

export default function ProfileSettingsModal({ isOpen, onClose, profile, onSuccess }) {
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

    const handleChange = (e) => {
        const value = e.target.name === 'semester' ? parseInt(e.target.value) || '' : e.target.value;
        setFormData({ ...formData, [e.target.name]: value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const { error: updateError } = await supabase
                .from('profiles')
                .update({
                    full_name: formData.full_name,
                    roll_number: formData.roll_number,
                    department: formData.department,
                    semester: formData.semester,
                    class_section: formData.class_section,
                    phone: formData.phone,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', user.id);

            if (updateError) throw updateError;

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
        <Modal isOpen={isOpen} onClose={onClose} title="Profile Settings" maxWidth="max-w-2xl">
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
                {error && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                        {success}
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
                        className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 cursor-not-allowed"
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
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all text-slate-900"
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
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all text-slate-900"
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
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all text-slate-900"
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
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all text-slate-900"
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
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all text-slate-900"
                            placeholder="e.g., A"
                        />
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
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all text-slate-900"
                        placeholder="e.g., +91 9876543210"
                    />
                </div>

                {/* Buttons */}
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
                        {loading ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
