import React from 'react';
import { Switch } from 'react-native';

export default function SettingsToggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Switch
      value={value}
      onValueChange={onChange}
      trackColor={{ false: '#d9e0e8', true: '#0aa99d' }}
      thumbColor="#fff"
      ios_backgroundColor="#d9e0e8"
    />
  );
}
