import { prisma } from "@/lib/db";
import { NotificationType } from "@prisma/client";

export interface NotificationData {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
}

export interface BulkNotificationData {
  userIds: string[];
  type: NotificationType;
  title: string;
  message: string;
}

/**
 * Create a single notification
 */
export async function createNotification(data: NotificationData) {
  try {
    const notification = await prisma.notification.create({
      data: {
        ...data,
        sentAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    // Here you would integrate with actual notification services
    // For example: send email, SMS, or WhatsApp message
    await sendNotificationToChannel(notification);

    return notification;
  } catch (error) {
    console.error("Error creating notification:", error);
    throw error;
  }
}

/**
 * Create multiple notifications for different users
 */
export async function createBulkNotifications(data: BulkNotificationData) {
  try {
    const { userIds, type, title, message } = data;

    // Verify all users exist
    const existingUsers = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true, phone: true },
    });

    if (existingUsers.length !== userIds.length) {
      throw new Error("One or more users not found");
    }

    // Create notifications
    const notifications = await prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        type,
        title,
        message,
        sentAt: new Date(),
      })),
    });

    // Send notifications to channels
    for (const user of existingUsers) {
      await sendNotificationToChannel({
        id: "", // Not needed for sending
        userId: user.id,
        type,
        title,
        message,
        isRead: false,
        sentAt: new Date(),
        createdAt: new Date(),
        user,
      });
    }

    return notifications;
  } catch (error) {
    console.error("Error creating bulk notifications:", error);
    throw error;
  }
}

/**
 * Send notification to the appropriate channel (email, SMS, WhatsApp)
 */
async function sendNotificationToChannel(notification: any) {
  try {
    switch (notification.type) {
      case "EMAIL":
        await sendEmailNotification(notification);
        break;
      case "SMS":
        await sendSMSNotification(notification);
        break;
      case "WHATSAPP":
        await sendWhatsAppNotification(notification);
        break;
      default:
        console.warn(`Unknown notification type: ${notification.type}`);
    }
  } catch (error) {
    console.error(`Error sending ${notification.type} notification:`, error);
    // Don't throw error here to avoid breaking the notification creation
  }
}

/**
 * Send email notification
 */
async function sendEmailNotification(notification: any) {
  // Placeholder for email service integration
  // You would integrate with services like SendGrid, AWS SES, etc.
  console.log(`Sending email notification to ${notification.user.email}:`, {
    title: notification.title,
    message: notification.message,
  });

  // Example integration:
  // await emailService.send({
  //   to: notification.user.email,
  //   subject: notification.title,
  //   html: notification.message,
  // });
}

/**
 * Send SMS notification
 */
async function sendSMSNotification(notification: any) {
  // Placeholder for SMS service integration
  // You would integrate with services like Twilio, AWS SNS, etc.
  console.log(`Sending SMS notification to ${notification.user.phone}:`, {
    title: notification.title,
    message: notification.message,
  });

  // Example integration:
  // await smsService.send({
  //   to: notification.user.phone,
  //   message: `${notification.title}: ${notification.message}`,
  // });
}

/**
 * Send WhatsApp notification
 */
async function sendWhatsAppNotification(notification: any) {
  // Placeholder for WhatsApp service integration
  // You would integrate with WhatsApp Business API
  console.log(`Sending WhatsApp notification to ${notification.user.phone}:`, {
    title: notification.title,
    message: notification.message,
  });

  // Example integration:
  // await whatsappService.send({
  //   to: notification.user.phone,
  //   message: `${notification.title}: ${notification.message}`,
  // });
}

/**
 * Create appointment-related notifications
 */
export async function createAppointmentNotification(
  appointmentId: string,
  type: "CREATED" | "CONFIRMED" | "CANCELLED" | "REMINDER",
  notificationType: NotificationType = "EMAIL"
) {
  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: true,
        doctor: { include: { user: true } },
      },
    });

    if (!appointment) {
      throw new Error("Appointment not found");
    }

    const notifications = [];

    // Notification messages based on type
    const messages = {
      CREATED: {
        patient: {
          title: "Cita Médica Creada",
          message: `Su cita con Dr. ${appointment.doctor.user.name} ha sido creada para el ${appointment.scheduledAt.toLocaleDateString()}.`,
        },
        doctor: {
          title: "Nueva Cita Médica",
          message: `Tiene una nueva cita con ${appointment.patient.name} programada para el ${appointment.scheduledAt.toLocaleDateString()}.`,
        },
      },
      CONFIRMED: {
        patient: {
          title: "Cita Médica Confirmada",
          message: `Su cita con Dr. ${appointment.doctor.user.name} ha sido confirmada para el ${appointment.scheduledAt.toLocaleDateString()}.`,
        },
        doctor: {
          title: "Cita Médica Confirmada",
          message: `Su cita con ${appointment.patient.name} ha sido confirmada para el ${appointment.scheduledAt.toLocaleDateString()}.`,
        },
      },
      CANCELLED: {
        patient: {
          title: "Cita Médica Cancelada",
          message: `Su cita con Dr. ${appointment.doctor.user.name} programada para el ${appointment.scheduledAt.toLocaleDateString()} ha sido cancelada.`,
        },
        doctor: {
          title: "Cita Médica Cancelada",
          message: `Su cita con ${appointment.patient.name} programada para el ${appointment.scheduledAt.toLocaleDateString()} ha sido cancelada.`,
        },
      },
      REMINDER: {
        patient: {
          title: "Recordatorio de Cita Médica",
          message: `Recordatorio: Tiene una cita con Dr. ${appointment.doctor.user.name} mañana a las ${appointment.scheduledAt.toLocaleTimeString()}.`,
        },
        doctor: {
          title: "Recordatorio de Cita Médica",
          message: `Recordatorio: Tiene una cita con ${appointment.patient.name} mañana a las ${appointment.scheduledAt.toLocaleTimeString()}.`,
        },
      },
    };

    // Create notification for patient
    const patientNotification = await createNotification({
      userId: appointment.patientId,
      type: notificationType,
      title: messages[type].patient.title,
      message: messages[type].patient.message,
    });
    notifications.push(patientNotification);

    // Create notification for doctor
    const doctorNotification = await createNotification({
      userId: appointment.doctor.userId,
      type: notificationType,
      title: messages[type].doctor.title,
      message: messages[type].doctor.message,
    });
    notifications.push(doctorNotification);

    return notifications;
  } catch (error) {
    console.error("Error creating appointment notification:", error);
    throw error;
  }
}

/**
 * Create chat-related notifications
 */
export async function createChatNotification(
  chatRoomId: string,
  senderId: string,
  messageContent: string,
  notificationType: NotificationType = "EMAIL"
) {
  try {
    const chatRoom = await prisma.chatRoom.findUnique({
      where: { id: chatRoomId },
      include: {
        patient: true,
        doctor: { include: { user: true } },
        appointment: true,
      },
    });

    if (!chatRoom) {
      throw new Error("Chat room not found");
    }

    const sender = await prisma.user.findUnique({
      where: { id: senderId },
      select: { id: true, name: true, role: true },
    });

    if (!sender) {
      throw new Error("Sender not found");
    }

    // Determine recipient (the other participant in the chat)
    const recipientId =
      senderId === chatRoom.patientId
        ? chatRoom.doctor.userId
        : chatRoom.patientId;

    const recipient =
      senderId === chatRoom.patientId ? chatRoom.doctor.user : chatRoom.patient;

    // Create notification for the recipient
    const notification = await createNotification({
      userId: recipientId,
      type: notificationType,
      title: `Nuevo mensaje de ${sender.name}`,
      message: `${sender.name} le ha enviado un mensaje: "${messageContent.substring(0, 100)}${messageContent.length > 100 ? "..." : ""}"`,
    });

    return notification;
  } catch (error) {
    console.error("Error creating chat notification:", error);
    throw error;
  }
}

/**
 * Mark notifications as read
 */
export async function markNotificationsAsRead(
  userId: string,
  notificationIds?: string[]
) {
  try {
    const where = notificationIds
      ? { id: { in: notificationIds }, userId }
      : { userId, isRead: false };

    const result = await prisma.notification.updateMany({
      where,
      data: { isRead: true },
    });

    return result;
  } catch (error) {
    console.error("Error marking notifications as read:", error);
    throw error;
  }
}
