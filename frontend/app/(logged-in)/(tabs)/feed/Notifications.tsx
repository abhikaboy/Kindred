import { Dimensions, StyleSheet, View, ScrollView, TouchableOpacity } from "react-native";
import React, { ReactNode } from "react";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "@/hooks/useThemeColor";
import UserInfoFollowRequest from "@/components/UserInfo/UserInfoFollowRequest";
import UserInfoCommentNotification from "@/components/UserInfo/UserInfoCommentNotification";
import UserInfoEncouragementNotification from "@/components/UserInfo/UserInfoEncouragementNotification";
import { Icons } from "@/constants/Icons";

const ONE_DAY = 24 * 60 * 60 * 1000;
const ONE_WEEK = 7 * ONE_DAY;
const ONE_MONTH = 30 * ONE_DAY;

type CommentNotificationProps = {
  name: string;
  userId: string;
  comment: string;
  icon: string;
  time: number;
  image: string;
};

type EncouragementNotificationProps = {
  name: string;
  userId: string;
  taskName: string;
  icon: string;
  time: number;
};

type FollowRequestProps = {
  name: string;
  username: string;
  icon: string;
  userId: string;
};

type CombinedNotification = 
  | (CommentNotificationProps & { type: 'comment' })
  | (EncouragementNotificationProps & { type: 'encouragement' });

const Notifications = () => {
  const ThemedColor = useThemeColor();
  const styles = stylesheet(ThemedColor);
  const now = Date.now();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTimestamp = today.getTime();

  const isToday = (time: number) => time >= todayTimestamp;
  const isThisWeek = (time: number) => time >= now - ONE_WEEK && time < todayTimestamp;
  const isThisMonth = (time: number) => time >= now - ONE_MONTH && time < now - ONE_WEEK;
  const isOlder = (time: number) => time < now - ONE_MONTH;

  const follow_requests: FollowRequestProps[] = [
    {
      name: "Monkey D. Luffy",
      username: "kingofpirates",
      icon: Icons.luffy,
      userId: "user123",
    },
    {
      name: "Coffee Lover",
      username: "coffeecoder",
      icon: Icons.coffee,
      userId: "user456",
    },
    {
      name: "Latte Artist",
      username: "latteart",
      icon: Icons.latte,
      userId: "user789",
    },
  ];

  const comment_notifications: CommentNotificationProps[] = [
    {
      name: "Coffee Lover",
      userId: "user456",
      comment: "I love how you approached this problem!",
      icon: Icons.coffee,
      time: now - 45 * 60 * 1000, // 45 minutes ago
      image: Icons.coffee,
    },
    {
      name: "Tea Master",
      userId: "user101",
      comment: "This solution is elegant. I'm impressed!",
      icon: Icons.coffee,
      time: now - 2 * ONE_DAY, // 2 days ago
      image: Icons.latte,
    },
    {
      name: "Design Guru",
      userId: "user303",
      comment: "The UI looks clean and intuitive!",
      icon: Icons.latte,
      time: now - 14 * ONE_DAY, // 2 weeks ago
      image: Icons.luffy,
    },
  ];

  const encouragement_notifications: EncouragementNotificationProps[] = [
    {
      name: "Monkey D. Luffy",
      userId: "user123",
      taskName: "Complete Project Documentation",
      icon: Icons.luffy,
      time: now - 30 * 60 * 1000, // 30 minutes ago
    },
    {
      name: "Team Leader",
      userId: "user321",
      taskName: "Code Review Session",
      icon: Icons.coffee,
      time: now - ONE_DAY, // 1 day ago
    },
    {
      name: "Career Mentor",
      userId: "user246",
      taskName: "Resume Update",
      icon: Icons.coffee,
      time: now - 12 * ONE_DAY, // 12 days ago
    },
  ];

  // Helper functions
  const filterByTimePeriod = <T extends { time: number }>(notifications: T[], filterFn: (time: number) => boolean): T[] => {
    return notifications.filter((item) => filterFn(item.time));
  };

  const mergeAndSort = (commentsArray: CommentNotificationProps[], encouragementsArray: EncouragementNotificationProps[]): CombinedNotification[] => {
    const taggedComments = commentsArray.map(item => ({ ...item, type: 'comment' as const }));
    const taggedEncouragements = encouragementsArray.map(item => ({ ...item, type: 'encouragement' as const }));
    return [...taggedComments, ...taggedEncouragements].sort((a, b) => b.time - a.time);
  };

  // Organize notifications by time period
  const todayNotifications = mergeAndSort(
    filterByTimePeriod(comment_notifications, isToday),
    filterByTimePeriod(encouragement_notifications, isToday)
  );
  
  const thisWeekNotifications = mergeAndSort(
    filterByTimePeriod(comment_notifications, isThisWeek),
    filterByTimePeriod(encouragement_notifications, isThisWeek)
  );
  
  const thisMonthNotifications = mergeAndSort(
    filterByTimePeriod(comment_notifications, isThisMonth),
    filterByTimePeriod(encouragement_notifications, isThisMonth)
  );

  const renderNotification = (notification: CombinedNotification, index: number): ReactNode => {
    return (
      <View key={`${notification.type}-${index}`} style={styles.listItem}>
        {notification.type === 'comment' ? (
          <UserInfoCommentNotification 
            name={notification.name}
            userId={notification.userId}
            comment={notification.comment}
            icon={notification.icon}
            time={notification.time}
            image={notification.image}
          />
        ) : (
          <UserInfoEncouragementNotification 
            name={notification.name}
            userId={notification.userId}
            taskName={notification.taskName}
            icon={notification.icon}
            time={notification.time}
          />
        )}
      </View>
    );
  };

  const renderSection = (title: string, notifications: CombinedNotification[]): ReactNode => {
    if (notifications.length === 0) return null;
    
    return (
      <View style={styles.section}>
        <ThemedText type="subtitle">{title}</ThemedText>
        {notifications.map((notification, index) => 
          renderNotification(notification, index)
        )}
      </View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollViewContent}>
        <View style={styles.header}>
          <TouchableOpacity>
            <Ionicons name="chevron-back" size={24} color={ThemedColor.text} />
          </TouchableOpacity>
          <ThemedText type="subtitle">Notifications</ThemedText>
        </View>

        {follow_requests.length > 0 && (
          <View style={styles.section}>
            <ThemedText type="subtitle">Friend Requests</ThemedText>
            {follow_requests.map((request, index) => (
              <View style={styles.listItem} key={`follow-${index}`}>
                <UserInfoFollowRequest
                  name={request.name}
                  icon={request.icon}
                  username={request.username}
                  userId={request.userId}
                />
              </View>
            ))}
          </View>
        )}

        {renderSection("Today", todayNotifications)}
        {renderSection("This Week", thisWeekNotifications)}
        {renderSection("This Month", thisMonthNotifications)}
      </ScrollView>
    </ThemedView>
  );
};

const stylesheet = (ThemedColor: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    scrollViewContent: {
      padding: 24,
      paddingTop: Dimensions.get("window").height * 0.1,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
      marginBottom: 16,
    },
    section: {
      marginBottom: 16,
    },
    listItem: {
      marginVertical: 10,
    },
  });

export default Notifications;