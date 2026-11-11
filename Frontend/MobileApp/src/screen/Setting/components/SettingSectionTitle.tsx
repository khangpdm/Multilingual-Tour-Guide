import React from 'react';
import { Text } from 'react-native';

export default function SettingSectionTitle({
  children,
  withTopSpacing = false,
}: {
  children: string;
  withTopSpacing?: boolean;
}) {
  return (
    <Text
      className={`mb-2 text-[11px] font-semibold tracking-wide text-[#8796ad] ${
        withTopSpacing ? 'mt-4' : ''
      }`}
    >
      {children}
    </Text>
  );
}
