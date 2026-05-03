import {
  ActivityIndicator,
  Pressable,
  Text,
  type PressableProps,
} from 'react-native';

type Variant = 'primary' | 'secondary';

type Props = Omit<PressableProps, 'children'> & {
  label: string;
  variant?: Variant;
  isLoading?: boolean;
};

export function Button({
  label,
  variant = 'primary',
  isLoading = false,
  disabled,
  ...rest
}: Props): React.JSX.Element {
  const isDisabled = disabled || isLoading;
  const base = 'h-12 items-center justify-center rounded-xl px-4';
  const variantClass =
    variant === 'primary'
      ? isDisabled
        ? 'bg-teal-300'
        : 'bg-teal-700 active:bg-teal-800'
      : isDisabled
        ? 'bg-gray-100'
        : 'bg-gray-100 active:bg-gray-200';
  const textClass =
    variant === 'primary'
      ? 'text-white font-semibold text-base'
      : 'text-gray-900 font-semibold text-base';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: isLoading }}
      disabled={isDisabled}
      className={`${base} ${variantClass}`}
      {...rest}
    >
      {isLoading ? (
        <ActivityIndicator color={variant === 'primary' ? '#fff' : '#111'} />
      ) : (
        <Text className={textClass}>{label}</Text>
      )}
    </Pressable>
  );
}
