import { ArrowRight } from "lucide-react";

const CustomHeaderBanner = ({
  date = "Today",
  title = "Welcome!",
  description = "This is your custom header banner. Pass in your own content.",
  buttonText = "Learn More",
  onButtonClick = () => {},
  gradient = "from-purple-600 via-purple-500 to-purple-400",
}) => {
  return (
    <div
      className={`bg-gradient-to-r ${gradient} rounded-2xl p-8 text-white mb-8 relative overflow-hidden`}
    >
      {/* Decorative Elements */}
      <div className="absolute top-4 right-8 opacity-20">
        <div className="w-32 h-32 bg-white rounded-full blur-3xl"></div>
      </div>
      <div className="absolute bottom-4 right-4 opacity-10">
        <div className="w-24 h-24 bg-white rounded-full blur-2xl"></div>
      </div>

      <div className="relative z-10">
        <div className="text-sm font-medium opacity-90 mb-2">{date}</div>

        <h1 className="text-4xl font-bold mb-4">{title}</h1>

        <p className="text-lg opacity-90 mb-6 max-w-2xl">{description}</p>

        <button
          onClick={onButtonClick}
          className="bg-black bg-opacity-20 hover:bg-opacity-30 transition-all duration-200 px-6 py-3 rounded-lg flex items-center space-x-2 font-medium"
        >
          <span>{buttonText}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default CustomHeaderBanner;
