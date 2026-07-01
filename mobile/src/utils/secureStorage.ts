import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

// `expo-secure-store` n'est pas pleinement supporté sur le web (voir doc Expo).
// On bascule sur AsyncStorage (qui utilise localStorage sous le capot sur web)
// pour cette plateforme, et on garde le stockage chiffré natif sur iOS/Android.
const isWeb = Platform.OS === 'web';

export async function getItemAsync(key: string): Promise<string | null> {
  return isWeb ? AsyncStorage.getItem(key) : SecureStore.getItemAsync(key);
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  if (isWeb) {
    await AsyncStorage.setItem(key, value);
  } else {
    await SecureStore.setItemAsync(key, value);
  }
}

export async function deleteItemAsync(key: string): Promise<void> {
  if (isWeb) {
    await AsyncStorage.removeItem(key);
  } else {
    await SecureStore.deleteItemAsync(key);
  }
}
