import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import POIDetailScreen from '@/components/POIDetailScreen';
import { useApp } from '@/store/AppContext';

export default function POIDetailRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { language } = useApp();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <POIDetailScreen key={`${id}:${language}`} poiId={id} onBack={handleBack} />
    </SafeAreaView>
  );
}
