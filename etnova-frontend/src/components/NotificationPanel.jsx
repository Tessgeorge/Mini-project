import { useEffect, useRef } from 'react';

export default function NotificationPanel({
    isOpen,
    onClose,
    notifications,
    onMarkAsRead,
    onNotificationClick,
    showAll = false,
    onToggleViewAll,
}) {
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
    const list = notifications || [];
    const unread = list.filter((n) => !n.read);
    const visibleNotifications = showAll ? list : unread;

    const getNotificationIcon = (type) => {
        switch (type) {
            case 'document_approved':
                return 'check_circle';
            case 'document_rejected':
                return 'cancel';
            case 'document_comment':
                return 'chat';
            case 'evaluation':
                return 'star';
            case 'team_member':
                return 'group_add';
            case 'join_request':
                return 'person_add';
            case 'join_request_approved':
                return 'task_alt';
            case 'join_request_rejected':
                return 'person_cancel';
            case 'project_approved':
                return 'check_circle';
            case 'project_rejected':
                return 'cancel';
            case 'team_member_removed':
                return 'person_remove';
            case 'task_assigned':
                return 'assignment_ind';
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
            case 'document_comment':
                return '#3b82f6'; // blue
            case 'evaluation':
                return '#f59e0b'; // amber
            case 'team_member':
                return '#3b82f6'; // blue
            case 'join_request':
                return '#00D2C4'; // teal
            case 'join_request_approved':
                return '#10b981'; // green
            case 'join_request_rejected':
                return '#ef4444'; // red
            case 'project_approved':
                return '#10b981'; // green
            case 'project_rejected':
                return '#ef4444'; // red
            case 'team_member_removed':
                return '#f97316'; // orange
            case 'task_assigned':
                return '#0ea5e9'; // sky
            default:
                return '#64748b'; // slate
        }
    };

    return (
        <div
            ref={panelRef}
            className="absolute right-0 top-full mt-2 w-[calc(100vw-1rem)] max-w-sm sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-scaleIn z-50"
        >
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-black text-slate-900">Notifications</h3>
                {unread.length > 0 && (
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
                {visibleNotifications.length === 0 ? (
                    <div className="py-12 text-center">
                        <span className="material-symbols-outlined text-6xl text-slate-300 mb-3">
                            notifications_off
                        </span>
                        <p className="text-slate-600 font-medium">{showAll ? "No notifications" : "No unread notifications"}</p>
                        <p className="text-sm text-slate-500 mt-1">
                            {showAll ? "You're all caught up!" : "Click below to view read notifications."}
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {visibleNotifications.map((notification) => (
                            <div
                                key={notification.id}
                                className={`px-5 py-4 hover:bg-slate-50 transition-colors cursor-pointer ${!notification.read ? 'bg-teal-50/30' : ''
                                    }`}
                                onClick={() => onNotificationClick?.(notification)}
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
            {list.length > 0 && (
                <div className="px-5 py-3 border-t border-slate-200 bg-slate-50">
                    <button
                        onClick={onToggleViewAll}
                        className="w-full text-center text-sm font-bold hover:underline"
                        style={{ color: '#00D2C4' }}
                    >
                        {showAll ? 'Show unread only' : 'View all notifications'}
                    </button>
                </div>
            )}
        </div>
    );
}
