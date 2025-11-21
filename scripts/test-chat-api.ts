import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function testChatAPI() {
  console.log("🧪 Testing Chat API endpoints...");

  try {
    // Test 1: Check if we can find existing appointments
    const appointments = await prisma.appointment.findMany({
      include: {
        patient: true,
        doctor: { include: { user: true } },
        chatRoom: true,
      },
      take: 1,
    });

    if (appointments.length === 0) {
      console.log("❌ No appointments found. Run seed script first.");
      return;
    }

    const appointment = appointments[0];
    console.log(`✅ Found appointment: ${appointment.id}`);

    // Test 2: Try to create a chat room
    let chatRoom;
    if (appointment.chatRoom) {
      chatRoom = appointment.chatRoom;
      console.log(`✅ Chat room already exists: ${chatRoom.id}`);
    } else {
      chatRoom = await prisma.chatRoom.create({
        data: {
          appointmentId: appointment.id,
          patientId: appointment.patientId,
          doctorId: appointment.doctorId,
          isActive: true,
        },
      });
      console.log(`✅ Created chat room: ${chatRoom.id}`);
    }

    // Test 3: Create a test message
    const message = await prisma.chatMessage.create({
      data: {
        chatRoomId: chatRoom.id,
        senderId: appointment.patientId,
        content: "Test message from API test",
        messageType: "TEXT",
        isRead: false,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    });

    console.log(`✅ Created test message: ${message.id}`);

    // Test 4: Query messages
    const messages = await prisma.chatMessage.findMany({
      where: { chatRoomId: chatRoom.id },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
      orderBy: { sentAt: "desc" },
      take: 5,
    });

    console.log(`✅ Found ${messages.length} messages in chat room`);

    // Test 5: Update chat room
    const updatedRoom = await prisma.chatRoom.update({
      where: { id: chatRoom.id },
      data: { updatedAt: new Date() },
      include: {
        _count: {
          select: { messages: true },
        },
      },
    });

    console.log(
      `✅ Updated chat room. Message count: ${updatedRoom._count.messages}`
    );

    console.log("🎉 All chat API tests passed!");
  } catch (error) {
    console.error("❌ Chat API test failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

testChatAPI();
