const CustomButton = ({
  label,
  onClick,
  shape = "",
  text = "",
  color = "primary",
  outline = false,
  type = "button",
  useHoverBehaviour = false,
  isDisabled = false,
  className = ``,
}) => {
  const colorStyles = {
    primary: outline
      ? "border-primary text-primary bg-transparent"
      : "bg-primary text-white border-primary",
    secondary: outline
      ? "border-secondary text-secondary bg-transparent"
      : "bg-secondary text-white border-secondary",
    danger: outline
      ? "border-red-500 text-red-500 bg-transparent"
      : "bg-red-500 text-white border-red-500",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={`
        w-full ${shape} ${text} border-2 transition duration-300 font-default rounded-lg px-4 ${className} 
        ${colorStyles[color] || colorStyles.primary}
        ${useHoverBehaviour ? "hover:opacity-60 hover:font-bold1x" : ""}
        ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}
      `}
    >
      {label}
    </button>
  );
};

export default CustomButton;
