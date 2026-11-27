import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import POIDetailScreen from '@/components/POIDetailScreen';
import { useApp } from '@/store/AppContext';

export default function POIDetailRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const { language } = useApp();

  const poiId = Array.isArray(id) ? id[0] : id;

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  if (!poiId) {
    return null;
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <POIDetailScreen key={`${poiId}:${language}`} poiId={poiId} onBack={handleBack} />
    </SafeAreaView>
  );
}
