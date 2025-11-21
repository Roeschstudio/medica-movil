import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Try to get existing preferences
    const existingPreferences = await prisma.notificationPreferences.findUnique(
      {
        where: { userId: session.user.id },
      }
    );

    if (existingPreferences) {
      return NextResponse.json({
        email: existingPreferences.email,
        sms: existingPreferences.sms,
        whatsapp: existingPreferences.whatsapp,
        browser: existingPreferences.browser,
        appointmentReminders: existingPreferences.appointmentReminders,
        chatMessages: existingPreferences.chatMessages,
        systemUpdates: existingPreferences.systemUpdates,
        marketingEmails: existingPreferences.marketingEmails,
        quietHours: {
          enabled: existingPreferences.quietHoursEnabled,
          startTime: existingPreferences.quietHoursStart || "22:00",
          endTime: existingPreferences.quietHoursEnd || "08:00",
        },
      });
    }

    // Return default preferences if none exist
    const defaultPreferences = {
      email: true,
      sms: true,
      whatsapp: false,
      browser: true,
      appointmentReminders: true,
      chatMessages: true,
      systemUpdates: true,
      marketingEmails: false,
      quietHours: {
        enabled: false,
        startTime: "22:00",
        endTime: "08:00",
      },
    };

    return NextResponse.json(defaultPreferences);
  } catch (error) {
    console.error("Error fetching notification preferences:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const preferences = await request.json();

    // Validate preferences structure
    const {
      email,
      sms,
      whatsapp,
      browser,
      appointmentReminders,
      chatMessages,
      systemUpdates,
      marketingEmails,
      quietHours,
    } = preferences;

    // Upsert preferences
    const updatedPreferences = await prisma.notificationPreferences.upsert({
      where: { userId: session.user.id },
      update: {
        email: email ?? true,
        sms: sms ?? true,
        whatsapp: whatsapp ?? false,
        browser: browser ?? true,
        appointmentReminders: appointmentReminders ?? true,
        chatMessages: chatMessages ?? true,
        systemUpdates: systemUpdates ?? true,
        marketingEmails: marketingEmails ?? false,
        quietHoursEnabled: quietHours?.enabled ?? false,
        quietHoursStart: quietHours?.startTime ?? "22:00",
        quietHoursEnd: quietHours?.endTime ?? "08:00",
        updatedAt: new Date(),
      },
      create: {
        userId: session.user.id,
        email: email ?? true,
        sms: sms ?? true,
        whatsapp: whatsapp ?? false,
        browser: browser ?? true,
        appointmentReminders: appointmentReminders ?? true,
        chatMessages: chatMessages ?? true,
        systemUpdates: systemUpdates ?? true,
        marketingEmails: marketingEmails ?? false,
        quietHoursEnabled: quietHours?.enabled ?? false,
        quietHoursStart: quietHours?.startTime ?? "22:00",
        quietHoursEnd: quietHours?.endTime ?? "08:00",
      },
    });

    return NextResponse.json({
      success: true,
      preferences: {
        email: updatedPreferences.email,
        sms: updatedPreferences.sms,
        whatsapp: updatedPreferences.whatsapp,
        browser: updatedPreferences.browser,
        appointmentReminders: updatedPreferences.appointmentReminders,
        chatMessages: updatedPreferences.chatMessages,
        systemUpdates: updatedPreferences.systemUpdates,
        marketingEmails: updatedPreferences.marketingEmails,
        quietHours: {
          enabled: updatedPreferences.quietHoursEnabled,
          startTime: updatedPreferences.quietHoursStart,
          endTime: updatedPreferences.quietHoursEnd,
        },
      },
    });
  } catch (error) {
    console.error("Error updating notification preferences:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
