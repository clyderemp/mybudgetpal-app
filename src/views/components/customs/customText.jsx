const CustomText = ({
  children,
  container = '',
  content = '',
  align = 'text-center',
}) => {
  const className = [container, content, align, 'leading-none', 'w-full']
    .filter(Boolean) // remove empty or falsy values
    .join(' ');

  return <p className={className}>{children}</p>;
};

export default CustomText;
