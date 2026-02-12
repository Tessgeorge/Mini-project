import { useEffect, useRef } from 'react';

export default function ProfileMenu({ profile, isOpen, onClose, onLogout, onEditProfile }) {
    const menuRef = useRef(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose]);

    if (!isOpen || !profile) return null;

    return (
        <div
            ref={menuRef}
            className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-scaleIn z-50"
        >
            {/* Profile Header */}
            <div
                className="px-5 py-4 border-b border-slate-200"
                style={{ backgroundColor: 'rgba(0, 210, 196, 0.05)' }}
            >
                <div className="flex items-center gap-3">
                    <div
                        className="size-12 rounded-full flex items-center justify-center text-black font-black text-lg"
                        style={{ backgroundColor: '#00D2C4' }}
                    >
                        {profile.full_name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div className="flex-1">
                        <p className="font-black text-slate-900">{profile.full_name || 'User'}</p>
                        <p className="text-xs text-slate-500">{profile.email}</p>
                    </div>
                </div>
            </div>

            {/* Profile Info */}
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
                <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                        <p className="text-slate-500 font-medium">Roll Number</p>
                        <p className="text-slate-900 font-bold">{profile.roll_number || '—'}</p>
                    </div>
                    <div>
                        <p className="text-slate-500 font-medium">Semester</p>
                        <p className="text-slate-900 font-bold">{profile.semester || '—'}</p>
                    </div>
                    {profile.class_section && (
                        <div>
                            <p className="text-slate-500 font-medium">Section</p>
                            <p className="text-slate-900 font-bold">{profile.class_section}</p>
                        </div>
                    )}
                    {profile.department && (
                        <div>
                            <p className="text-slate-500 font-medium">Department</p>
                            <p className="text-slate-900 font-bold">{profile.department}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Menu Actions */}
            <div className="py-2">
                <button
                    onClick={() => {
                        onEditProfile?.();
                        onClose();
                    }}
                    className="w-full px-5 py-2.5 text-left hover:bg-slate-50 transition-colors flex items-center gap-3 text-sm font-medium text-slate-700"
                >
                    <span className="material-symbols-outlined text-lg">settings</span>
                    Account Settings
                </button>
                <button className="w-full px-5 py-2.5 text-left hover:bg-slate-50 transition-colors flex items-center gap-3 text-sm font-medium text-slate-700">
                    <span className="material-symbols-outlined text-lg">help</span>
                    Help & Support
                </button>
            </div>

            {/* Logout */}
            <div className="px-5 py-3 border-t border-slate-200">
                <button
                    onClick={onLogout}
                    className="w-full py-2.5 rounded-lg text-black font-bold text-sm transition-all shadow-sm flex items-center justify-center gap-2 hover:opacity-90"
                    style={{ backgroundColor: '#00D2C4' }}
                >
                    <span className="material-symbols-outlined text-sm">logout</span>
                    Logout
                </button>
            </div>
        </div>
    );
}
