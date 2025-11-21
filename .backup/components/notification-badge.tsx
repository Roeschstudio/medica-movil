"use client";

import { Badge } from "@/components/ui/badge";
import { useNotifications } from "@/hooks/use-notifications";
import { Bell } from "lucide-react";
import { useUnifiedAuth } from "@/lib/unified-auth-context";

interface NotificationBadgeProps {
  className?: string;
  showIcon?: boolean;
  maxCount?: number;
}

export function NotificationBadge({
  className = "",
  showIcon = true,
  maxCount = 99,
}: NotificationBadgeProps) {
  const { user } = useUnifiedAuth();
  const { stats } = useNotifications();

  if (!user || stats.unread === 0) {
    return showIcon ? <Bell className={`h-4 w-4 ${className}`} /> : null;
  }

  const displayCount =
    stats.unread > maxCount ? `${maxCount}+` : stats.unread.toString();

  return (
    <div className={`relative ${className}`}>
      {showIcon && <Bell className="h-4 w-4" />}
      <Badge
        variant="destructive"
        className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
      >
        {displayCount}
      </Badge>
    </div>
  );
}

interface NotificationCounterProps {
  className?: string;
  variant?: "default" | "destructive" | "outline" | "secondary";
}

export function NotificationCounter({
  className = "",
  variant = "destructive",
}: NotificationCounterProps) {
  const { user } = useUnifiedAuth();
  const { stats } = useNotifications();

  if (!user || stats.unread === 0) {
    return null;
  }

  return (
    <Badge variant={variant} className={className}>
      {stats.unread > 99 ? "99+" : stats.unread}
    </Badge>
  );
}

interface NotificationIndicatorProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function NotificationIndicator({
  className = "",
  size = "md",
}: NotificationIndicatorProps) {
  const { user } = useUnifiedAuth();
  const { stats } = useNotifications();

  if (!user || stats.unread === 0) {
    return null;
  }

  const sizeClasses = {
    sm: "w-2 h-2",
    md: "w-3 h-3",
    lg: "w-4 h-4",
  };

  return (
    <div
      className={`${sizeClasses[size]} bg-red-500 rounded-full ${className}`}
      title={`${stats.unread} notificaciones sin leer`}
    />
  );
}
