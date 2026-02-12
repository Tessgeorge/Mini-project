import { useEffect, useRef } from 'react';

export default function NotificationPanel({ isOpen, onClose, notifications, onMarkAsRead }) {
    const panelRef = useRef(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target)) {
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

    if (!isOpen) return null;

    const getNotificationIcon = (type) => {
        switch (type) {
            case 'document_approved':
                return 'check_circle';
            case 'document_rejected':
                return 'cancel';
            case 'evaluation':
                return 'star';
            case 'team_member':
                return 'group_add';
            default:
                return 'notifications';
        }
    };

    const getNotificationColor = (type) => {
        switch (type) {
            case 'document_approved':
                return '#10b981'; // green
            case 'document_rejected':
                return '#ef4444'; // red
            case 'evaluation':
                return '#f59e0b'; // amber
            case 'team_member':
                return '#3b82f6'; // blue
            default:
                return '#64748b'; // slate
        }
    };

    return (
        <div
            ref={panelRef}
            className="absolute right-0 top-full mt-2 w-96 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-scaleIn z-50"
        >
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-black text-slate-900">Notifications</h3>
                {notifications?.length > 0 && (
                    <button
                        onClick={onMarkAsRead}
                        className="text-xs font-bold hover:underline"
                        style={{ color: '#00D2C4' }}
                    >
                        Mark all as read
                    </button>
                )}
            </div>

            {/* Notifications List */}
            <div className="max-h-96 overflow-y-auto">
                {!notifications || notifications.length === 0 ? (
                    <div className="py-12 text-center">
                        <span className="material-symbols-outlined text-6xl text-slate-300 mb-3">
                            notifications_off
                        </span>
                        <p className="text-slate-600 font-medium">No new notifications</p>
                        <p className="text-sm text-slate-500 mt-1">You're all caught up!</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {notifications.map((notification) => (
                            <div
                                key={notification.id}
                                className={`px-5 py-4 hover:bg-slate-50 transition-colors cursor-pointer ${!notification.read ? 'bg-teal-50/30' : ''
                                    }`}
                            >
                                <div className="flex gap-3">
                                    <div
                                        className="size-10 rounded-full flex items-center justify-center flex-shrink-0"
                                        style={{ backgroundColor: `${getNotificationColor(notification.type)}15` }}
                                    >
                                        <span
                                            className="material-symbols-outlined text-lg"
                                            style={{ color: getNotificationColor(notification.type) }}
                                        >
                                            {getNotificationIcon(notification.type)}
                                        </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-slate-900">
                                            {notification.title}
                                        </p>
                                        <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                                            {notification.message}
                                        </p>
                                        <p className="text-xs text-slate-400 mt-2">
                                            {new Date(notification.created_at).toLocaleString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                hour: 'numeric',
                                                minute: '2-digit',
                                            })}
                                        </p>
                                    </div>
                                    {!notification.read && (
                                        <div
                                            className="size-2 rounded-full flex-shrink-0 mt-2"
                                            style={{ backgroundColor: '#00D2C4' }}
                                        />
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer */}
            {notifications?.length > 0 && (
                <div className="px-5 py-3 border-t border-slate-200 bg-slate-50">
                    <button
                        className="w-full text-center text-sm font-bold hover:underline"
                        style={{ color: '#00D2C4' }}
                    >
                        View all notifications
                    </button>
                </div>
            )}
        </div>
    );
}
