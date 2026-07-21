import { useEffect, useRef } from 'react';
import { Platform, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { router } from 'expo-router';
import { apiFetch } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'CampoFlow',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#14532D',
    });
  }

  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: 'campoflow',
  });
  return tokenData.data;
}

export async function sendPushTokenToServer(token: string) {
  try {
    await apiFetch('/auth/push-token', { method: 'POST', body: { token, platform: Platform.OS } });
  } catch {
    // Token registration is best-effort
  }
}

export function useNotificationListeners(onNotificationTap?: (farmId: string) => void) {
  const responseListener = useRef<Notifications.EventSubscription>();

  useEffect(() => {
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (!data?.farmId) return;

      const farmId = data.farmId as string;
      const screen = data.screen as string | undefined;
      const id = data.id as string | undefined;

      if (screen) {
        if (id && screen === 'animais') {
          router.push(`/(app)/fazendas/${farmId}/animais/${id}`);
        } else {
          router.push(`/(app)/fazendas/${farmId}/${screen}`);
        }
      } else if (onNotificationTap) {
        onNotificationTap(farmId);
      }
    });

    return () => {
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [onNotificationTap]);
}

export async function getBadgeCount(): Promise<number> {
  return Notifications.getBadgeCountAsync();
}

export async function setBadgeCount(count: number) {
  await Notifications.setBadgeCountAsync(count);
}
