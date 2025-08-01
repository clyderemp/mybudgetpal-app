import { ClipLoader } from "react-spinners";

const Loader = ({text = "Loading"}) => {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white z-50">
      <div className="flex flex-col items-center space-y-4">
        <ClipLoader size={60} color="#3B82F6" />
        <p className="text-gray-500 text-lg font-medium">{`${text}...`}</p>
      </div>
    </div>
  );
};

export default Loader;
