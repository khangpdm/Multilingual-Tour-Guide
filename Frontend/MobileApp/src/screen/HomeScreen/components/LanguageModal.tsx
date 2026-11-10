import { LanguageItem } from '@/services/languageService';
import React from 'react';
import { Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';

interface LanguageModalProps {
  visible: boolean;
  onClose: () => void;
  supportedLanguages: LanguageItem[];
  currentLanguage: string;
  onSelectLanguage: (code: string) => void;
}

export default function LanguageModal({
  visible,
  onClose,
  supportedLanguages,
  currentLanguage,
  onSelectLanguage,
}: LanguageModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-center bg-black/40 px-6" onPress={onClose}>
        <View className="rounded-2xl bg-white p-4 shadow-xl">
          <Text className="mb-3 text-lg font-bold text-gray-800">
            Chọn ngôn ngữ / Select Language
          </Text>

          {supportedLanguages.map((item) => {
            const isSelected = currentLanguage === item.code;
            return (
              <TouchableOpacity
                key={item.code}
                activeOpacity={0.7}
                onPress={() => {
                  onSelectLanguage(item.code);
                  onClose();
                }}
                className={`my-1 flex-row items-center justify-between rounded-xl p-3 ${
                  isSelected ? 'border border-teal-500 bg-teal-50' : 'bg-gray-50'
                }`}
              >
                <View className="flex-row items-center gap-3">
                  <Text className="text-xl">{item.flag}</Text>
                  <Text
                    className={`font-semibold ${isSelected ? 'text-teal-700' : 'text-gray-700'}`}
                  >
                    {item.name}
                  </Text>
                </View>
                {isSelected && <View className="h-2.5 w-2.5 rounded-full bg-teal-600" />}
              </TouchableOpacity>
            );
          })}
        </View>
      </Pressable>
    </Modal>
  );
}
