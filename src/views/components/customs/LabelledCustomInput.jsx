import CustomInput from './customInput';
import CustomText from './customText';

export default function LabelledCustomInput({
    label,
    labelPosition = 'top', // only 'top' is tested. use 'left', 'right', or 'bottom' at your own risk
    type = 'text',
    value,
    onChange,
    placeholder,
    shape = '',
    border = '',
    text = '',
    children,
    error = false,
    options = [], // for dropdown
    autoCapitalize = false,
    isDisabled = false,
    container = '',
    content = '',
    align = 'text-center',
}) {
    return (
        <div
            className={['left', 'right'].includes(labelPosition) ? 'flex' : ''}
        >
            {['left', 'top'].includes(labelPosition) && (
                <CustomText
                    content={content}
                    align={align}
                    container={container}
                >
                    {label}
                </CustomText>
            )}
            <CustomInput
                type={type}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                shape={shape}
                border={border}
                text={text}
                options={options}
                autoCapitalize={autoCapitalize}
                isDisabled={isDisabled}
                error={error}
            >
                {children}
            </CustomInput>
            {['right', 'bottom'].includes(labelPosition) && (
                <CustomText
                    content={content}
                    align={align}
                    container={container}
                >
                    {label}
                </CustomText>
            )}
        </div>
    );
}
