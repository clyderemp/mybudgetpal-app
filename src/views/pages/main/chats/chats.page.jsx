import Sidebar from "../../../components/static/Sidebar";
import { PageHeader } from "../../../components/customs";

const Chats = () => {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          <PageHeader title="Chats" subtitle="Monitor user conversations" />
          <div className="bg-white rounded-2xl p-8 shadow-sm">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Chats</h2>
            <p className="text-gray-600">
              This page is under construction. Chat monitoring features will be
              implemented here.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chats;
