let notificationIdCounter = Date.now() % 2147483000;

async function getLocalNotificationsModule() {
  if (typeof window === "undefined") return null;

  const [{ Capacitor }, { LocalNotifications }] = await Promise.all([
    import("@capacitor/core"),
    import("@capacitor/local-notifications"),
  ]);

  if (!Capacitor.isNativePlatform()) {
    return null;
  }

  return LocalNotifications;
}

export async function ensureLocalNotificationPermission(): Promise<boolean> {
  try {
    const localNotifications = await getLocalNotificationsModule();
    if (!localNotifications) return false;

    const permission = await localNotifications.checkPermissions();
    if (permission.display === "granted") return true;

    const requested = await localNotifications.requestPermissions();
    return requested.display === "granted";
  } catch (error) {
    console.error("ローカル通知権限の確認に失敗:", error);
    return false;
  }
}

export async function sendLocalNotification(args: {
  title: string;
  body: string;
}): Promise<void> {
  try {
    const localNotifications = await getLocalNotificationsModule();
    if (!localNotifications) return;

    const granted = await ensureLocalNotificationPermission();
    if (!granted) return;

    notificationIdCounter += 1;
    await localNotifications.schedule({
      notifications: [
        {
          id: notificationIdCounter,
          title: args.title,
          body: args.body,
          schedule: {
            at: new Date(Date.now() + 500),
          },
          sound: undefined,
        },
      ],
    });
  } catch (error) {
    console.error("ローカル通知の送信に失敗:", error);
  }
}
