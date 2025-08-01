import BlogCards from "../../../components/customs/customBlogCards";
import DashboardWidgets from "../home/sections/analytics.section";
import Header from "../../../components/customs/customHeaderBanner";
import Sidebar from "../../../components/static/Sidebar";

const Overview = () => {
  return (
    <div className="flex h-screen bg-dashboard-background">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          {/* Header Section */}
          <Header />

          {/* Blog Cards Section */}
          <BlogCards />

          {/* Dashboard Widgets */}
          <DashboardWidgets />
        </div>
      </div>
    </div>
  );
};

export default Overview;
