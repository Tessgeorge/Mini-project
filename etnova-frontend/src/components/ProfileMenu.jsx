import { useEffect, useRef } from 'react';

export default function ProfileMenu({ profile, isOpen, onClose, onLogout, onEditProfile }) {
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
        };
        if (isOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose]);

    if (!isOpen || !profile) return null;

    const initial = profile.full_name?.charAt(0).toUpperCase() || 'U';

    const infoItems = [
        { label: 'Roll No.', value: profile.roll_number },
        { label: 'Semester', value: profile.semester ? `Sem ${profile.semester}` : null },
        { label: 'Section', value: profile.class_section },
        { label: 'Department', value: profile.department },
    ].filter(i => i.value);

    return (
        <div
            ref={menuRef}
            className="absolute right-0 top-full mt-3 w-80 rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50"
            style={{
                background: 'white',
                boxShadow: '0 20px 60px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.07)',
                animation: 'menuFadeIn 0.18s ease',
            }}
        >
            <style>{`
        @keyframes menuFadeIn {
          from { opacity: 0; transform: translateY(-6px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
      `}</style>

            {/* ── Header ── */}
            <div className="relative overflow-hidden">
                {/* Gradient bg */}
                <div
                    className="absolute inset-0"
                    style={{ background: 'linear-gradient(135deg, #00D2C4 0%, #00897B 100%)' }}
                />
                {/* Decorative circles */}
                <div className="absolute -top-6 -right-6 size-28 rounded-full opacity-10 bg-white" />
                <div className="absolute -bottom-4 -left-4 size-20 rounded-full opacity-10 bg-white" />

                <div className="relative z-10 px-5 pt-5 pb-4 flex items-center gap-4">
                    {/* Avatar */}
                    <div
                        className="size-14 rounded-2xl flex items-center justify-center font-black text-xl flex-shrink-0 shadow-md"
                        style={{ backgroundColor: 'rgba(255,255,255,0.25)', color: 'white', backdropFilter: 'blur(8px)' }}
                    >
                        {initial}
                    </div>
                    {/* Name + email */}
                    <div className="flex-1 min-w-0">
                        <p className="font-black text-white text-base leading-tight truncate">
                            {profile.full_name || 'User'}
                        </p>
                        <p className="text-white/70 text-xs mt-0.5 truncate">{profile.email}</p>
                        {/* Role badge */}
                        <span className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                            style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }}>
                            <span className="material-symbols-outlined text-xs">school</span>
                            Student
                        </span>
                    </div>
                </div>
            </div>

            {/* ── Info Grid ── */}
            {infoItems.length > 0 && (
                <div className="px-5 py-3 border-b border-slate-100 grid grid-cols-2 gap-y-3 gap-x-4">
                    {infoItems.map(item => (
                        <div key={item.label}>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{item.label}</p>
                            <p className="text-sm font-black text-slate-900 mt-0.5">{item.value}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Menu Actions ── */}
            <div className="py-1.5">
                <button
                    onClick={() => { onEditProfile?.(); onClose(); }}
                    className="w-full px-5 py-3 text-left flex items-center gap-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors group"
                >
                    <span
                        className="size-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors group-hover:bg-teal-50"
                        style={{ backgroundColor: 'rgba(0,210,196,0.08)' }}
                    >
                        <span className="material-symbols-outlined text-base" style={{ color: '#00897B' }}>
                            manage_accounts
                        </span>
                    </span>
                    <span className="flex-1">Account Settings</span>
                    <span className="material-symbols-outlined text-sm text-slate-300">chevron_right</span>
                </button>

                <button
                    className="w-full px-5 py-3 text-left flex items-center gap-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors group"
                >
                    <span
                        className="size-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors group-hover:bg-indigo-50"
                        style={{ backgroundColor: 'rgba(99,102,241,0.08)' }}
                    >
                        <span className="material-symbols-outlined text-base" style={{ color: '#6366f1' }}>
                            help
                        </span>
                    </span>
                    <span className="flex-1">Help &amp; Support</span>
                    <span className="material-symbols-outlined text-sm text-slate-300">chevron_right</span>
                </button>
            </div>

            {/* ── Logout ── */}
            <div className="px-4 pb-4 pt-1 border-t border-slate-100">
                <button
                    onClick={onLogout}
                    className="w-full py-3 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 hover:opacity-90 active:scale-95"
                    style={{
                        background: 'linear-gradient(135deg, #00D2C4 0%, #00897B 100%)',
                        color: 'white',
                        boxShadow: '0 4px 14px rgba(0,210,196,0.35)',
                    }}
                >
                    <span className="material-symbols-outlined text-base">logout</span>
                    Sign Out
                </button>
            </div>
        </div>
    );
}
