import React from "react";
import CustomHeaderBanner from "@/views/components/customs/customHeaderBanner";
import CustomBlogCards from "@/views/components/customs/customBlogCards";
import { useAuth } from "@/context/auth.provider";
import AnalyticsSection from "./sections/analytics.section";

const HomePage = () => {
    const { user, users, blogs } = useAuth();
    const date = new Date().toDateString();

    return (
        <div className="flex h-screen bg-dashboard-background">
        {/* Main Content */}
        <div className="flex-1 overflow-auto">
            <div className="p-8">
            {/* Header Section */}
            <CustomHeaderBanner date={date} title={`Welcome ${user?.fname}!`}/>

            {/* News Articles Section */}
            <CustomBlogCards title="Blogs & Articles" data={blogs} />

            {/* Analytics Section */}
            <AnalyticsSection />
            </div>
        </div>
        </div>
    );
};

export default HomePage;
