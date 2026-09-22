import { Tab, useApp } from "@/store/AppContext";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import {
  IconCompass,
  IconDownload,
  IconHome,
  IconQr,
  IconSettings,
} from "./Icons";

const TABS: {
  id: Tab;
  label: string;
  Icon: React.ComponentType<{
    size?: number;
    color?: string;
    className?: string;
  }>;
}[] = [
  { id: "home", label: "Trang chủ", Icon: IconHome },
  { id: "explore", label: "Khám phá", Icon: IconCompass },
  { id: "scan", label: "Quét QR", Icon: IconQr },
  { id: "download", label: "Tải về", Icon: IconDownload },
  { id: "settings", label: "Cài đặt", Icon: IconSettings },
];

export default function BottomNav() {
  const { activeTab, setActiveTab } = useApp();

  return (
    <View className="flex-row bg-white border-t border-gray-200">
      {TABS.map(({ id, label, Icon }) => {
        const active = activeTab === id;
        const isCenter = id === "scan";

        return (
          <TouchableOpacity
            key={id}
            onPress={() => setActiveTab(id)}
            activeOpacity={0.7}
            className="flex-1 items-center justify-start pt-2.5 pb-2 min-h-[60px] relative"
          >
            {/* Thanh gạch indicator active ở trên cùng */}
            {active && !isCenter && (
              <View className="absolute top-0 w-5 h-0.5 rounded-full bg-teal-600" />
            )}

            {isCenter ? (
              <View
                className="w-12 h-12 rounded-2xl bg-teal-600 items-center justify-center -mt-[18px] mb-1 shadow-md shadow-teal-600/40"
                style={{ elevation: 6 }}
              >
                <Icon size={22} color="#FFFFFF" />
              </View>
            ) : (
              <View className="mb-1">
                <Icon size={22} color={active ? "#0d9488" : "#9ca3af"} />
              </View>
            )}

            <Text
              className={`text-[10px] font-medium leading-3 ${
                isCenter
                  ? active
                    ? "text-teal-600"
                    : "text-gray-500"
                  : active
                    ? "text-teal-600"
                    : "text-gray-400"
              }`}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
