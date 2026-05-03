import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form';
import { Text, TextInput, View, type TextInputProps } from 'react-native';

type Props<TForm extends FieldValues> = {
  control: Control<TForm>;
  name: FieldPath<TForm>;
  label: string;
  errorMessage?: string;
} & Omit<TextInputProps, 'value' | 'onChangeText' | 'onBlur'>;

export function TextField<TForm extends FieldValues>({
  control,
  name,
  label,
  errorMessage,
  ...inputProps
}: Props<TForm>): React.JSX.Element {
  const hasError = Boolean(errorMessage);
  return (
    <View className="gap-1.5">
      <Text className="text-sm font-medium text-gray-700">{label}</Text>
      <Controller
        control={control}
        name={name}
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            value={value ?? ''}
            onChangeText={onChange}
            onBlur={onBlur}
            placeholderTextColor="#9ca3af"
            accessibilityLabel={label}
            className={`h-12 rounded-xl border px-3.5 text-base text-gray-900 ${
              hasError ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'
            }`}
            {...inputProps}
          />
        )}
      />
      {hasError ? (
        <Text className="text-sm text-red-600">{errorMessage}</Text>
      ) : null}
    </View>
  );
}
