import { ArrowRight } from "lucide-react";
import bannerImage from "@/assets/images/budgetpAL.png";

const CustomHeaderBanner = ({
  date = "Today",
  title = "Welcome!",
  message = "This is your custom header banner. Pass in your own content.",
  buttonText = null,
  onButtonClick = null,
  gradient = "from-secondary via-secondary to-secondary",
  showImage = false,
}) => {
  return (
    <div
      className={`bg-gradient-to-r ${gradient} rounded-2xl p-8 text-white mb-8 relative overflow-hidden flex flex-wrap md:flex-nowrap items-start justify-between gap-6`}
    >
      {/* Decorative Background Elements */}
      <div className="absolute top-4 right-8 opacity-20">
        <div className="w-32 h-32 bg-white rounded-full blur-3xl"></div>
      </div>
      <div className="absolute bottom-4 right-4 opacity-10">
        <div className="w-24 h-24 bg-white rounded-full blur-2xl"></div>
      </div>

      {/* Left Content */}
      <div className="relative z-10 flex flex-col justify-between flex-1 min-w-[250px]">
        <div>
          <div className="text-sm font-medium opacity-90 mb-2">{date}</div>
          <h1 className="text-4xl font-bold mb-4">{title}</h1>
          <p className="text-lg opacity-90 mb-6">{message}</p>
        </div>

        {onButtonClick && buttonText && (
          <button
            onClick={onButtonClick}
            className="mt-4 bg-black bg-opacity-20 hover:bg-opacity-30 transition-all duration-200 px-6 py-3 rounded-lg flex items-center space-x-2 font-medium w-fit"
          >
            <span>{buttonText}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Right Image */}
      {showImage && (
        <div className="w-full md:w-60 h-40 rounded-xl overflow-hidden relative z-10 shrink-0 my-10">
          <img
            src={bannerImage}
            alt="Banner visual"
            className="w-full h-full object-cover transform scale-x-[-1]"
          />
        </div>
      )}
    </div>
  );
};

export default CustomHeaderBanner;
