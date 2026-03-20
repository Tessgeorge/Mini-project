import TopBar from "../TopBar";

export default function TopNavbar({ adminName, academicYearLabel, pageTitle = "Admin Dashboard", onProfileClick }) {
  return (
    <TopBar
      title={pageTitle}
      subtitle="Home"
      profile={{ full_name: adminName || "Admin" }}
      onProfileClick={onProfileClick}
      badgeLabel={academicYearLabel}
      showSearch={false}
      notificationCount={0}
    />
  );
}
