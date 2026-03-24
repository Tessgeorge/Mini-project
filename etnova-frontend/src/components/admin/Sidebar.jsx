import Sidebar from "../Sidebar";

const ADMIN_NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard" },
  { id: "mentor-management", label: "Mentor Management", icon: "groups" },
  { id: "guide-allocation", label: "Mentor Allocation", icon: "shuffle" },
  { id: "review-management", label: "Review Management", icon: "grading" },
];

export default function AdminSidebar({ activeItem = "dashboard", onSignOut, onNavigate }) {
  return (
    <Sidebar
      navItems={ADMIN_NAV_ITEMS}
      activeItem={activeItem}
      onNavigate={onNavigate}
      onLogout={onSignOut}
      portalSubtitle="Academic Admin"
      showMobileNav={false}
    />
  );
}
