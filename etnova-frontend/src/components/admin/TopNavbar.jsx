import { useCallback, useEffect, useMemo, useState } from "react";
import TopBar from "../TopBar";
import NotificationPanel from "../NotificationPanel";
import { apiRequest } from "../../config/apiClient";
import supabase from "../../config/supabaseClient";

export default function TopNavbar({
  adminName,
  academicYearLabel,
  pageTitle = "Admin Dashboard",
  onProfileClick,
  onHomeClick,
}) {
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAllNotifications, setShowAllNotifications] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);

  const loadNotifications = useCallback(async () => {
    try {
      const data = await apiRequest("/notifications", { skipCache: true });
      setNotifications(data || []);
    } catch (error) {
      console.error("Failed to load admin notifications:", error);
    }
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications]
  );

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    const loadSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        setCurrentUserId(data?.session?.user?.id || null);
      } catch (error) {
        console.error("Failed to load admin auth session:", error);
      }
    };

    loadSession();
  }, []);

  useEffect(() => {
    if (!currentUserId) return undefined;

    const channel = supabase
      .channel(`admin-notifications-${currentUserId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${currentUserId}` },
        async () => {
          await loadNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, loadNotifications]);

  const handleMarkAllNotificationsRead = async () => {
    try {
      await apiRequest("/notifications/read-all", { method: "PUT" });
      setNotifications((prev) => prev.map((notification) => ({ ...notification, read: true })));
    } catch (error) {
      console.error("Failed to mark admin notifications as read:", error);
    }
  };

  const handleNotificationClick = async (notification) => {
    if (!notification?.id) return;
    try {
      if (!notification.read) {
        await apiRequest(`/notifications/${notification.id}/read`, { method: "PUT" });
        setNotifications((prev) =>
          prev.map((item) => (item.id === notification.id ? { ...item, read: true } : item))
        );
      }
    } catch (error) {
      console.error("Failed to mark admin notification as read:", error);
    }
    setShowNotifications(false);
  };

  return (
    <div className="relative">
      <TopBar
        title={pageTitle}
        subtitle="Home"
        onSubtitleClick={onHomeClick}
        profile={{ full_name: adminName || "Admin" }}
        onProfileClick={onProfileClick}
        badgeLabel={academicYearLabel}
        showSearch={false}
        notificationCount={unreadCount}
        onNotificationClick={() => setShowNotifications(true)}
      />
      <NotificationPanel
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
        notifications={notifications}
        showAll={showAllNotifications}
        onToggleViewAll={() => setShowAllNotifications((value) => !value)}
        onMarkAsRead={handleMarkAllNotificationsRead}
        onNotificationClick={handleNotificationClick}
      />
    </div>
  );
}
