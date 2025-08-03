import React from "react";
import CustomBlogCards from "@/views/components/customs/customBlogCards";
import { useAuth } from "@/context/auth.provider";

const BlogsPage = () => {
    const { blogs } = useAuth();
    const date = new Date().toDateString();

    return (
    <div className="flex h-screen bg-dashboard-background">
        {/* Main Content */}
        <div className="flex-1 overflow-auto">
            <div className="p-8">

            {/* Blog Articles Section */}
            <CustomBlogCards title="Blogs & Articles" data={blogs} showAddButton/>
            </div>
        </div>
    </div>
    );
};

export default BlogsPage;
