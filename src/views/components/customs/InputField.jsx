export default function InputField({
    type = 'text',
    value,
    onChange,
    placeholder,
    shape = '',
    border = '',
    text = '',
}) {
    return (
        <input
            type={type}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className={
                shape + ' ' + border + ' ' + text + ' leading-none w-full'
            }
        />
    );
}
