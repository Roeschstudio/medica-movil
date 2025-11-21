import { z } from "zod";

// Validation schemas from our API endpoints
const createRoomSchema = z.object({
  appointmentId: z.string().cuid("Invalid appointment ID format"),
});

const sendMessageSchema = z.object({
  chatRoomId: z.string().cuid("Invalid chat room ID format"),
  content: z
    .string()
    .min(1, "Message content is required")
    .max(5000, "Message too long"),
  messageType: z
    .enum(["TEXT", "FILE", "IMAGE", "VIDEO", "AUDIO"])
    .default("TEXT"),
  fileUrl: z.string().url("Invalid file URL").optional(),
  fileName: z.string().max(255, "File name too long").optional(),
  fileSize: z
    .number()
    .int()
    .positive()
    .max(50 * 1024 * 1024, "File too large (max 50MB)")
    .optional(),
});

const updateRoomSchema = z.object({
  isActive: z.boolean().optional(),
  endedAt: z.string().datetime().optional(),
});

function validateChatAPI() {
  console.log("🔍 Validating Chat API schemas...");

  // Test create room schema
  try {
    const validRoomData = {
      appointmentId: "clx1234567890abcdef",
    };
    createRoomSchema.parse(validRoomData);
    console.log("✅ Create room schema validation passed");
  } catch (error) {
    console.error("❌ Create room schema validation failed:", error);
  }

  // Test send message schema
  try {
    const validMessageData = {
      chatRoomId: "clx1234567890abcdef",
      content: "Hello, this is a test message",
      messageType: "TEXT" as const,
    };
    sendMessageSchema.parse(validMessageData);
    console.log("✅ Send message schema validation passed");
  } catch (error) {
    console.error("❌ Send message schema validation failed:", error);
  }

  // Test file message schema
  try {
    const validFileMessageData = {
      chatRoomId: "clx1234567890abcdef",
      content: "Sending a file",
      messageType: "FILE" as const,
      fileUrl: "https://example.com/file.pdf",
      fileName: "document.pdf",
      fileSize: 1024000,
    };
    sendMessageSchema.parse(validFileMessageData);
    console.log("✅ File message schema validation passed");
  } catch (error) {
    console.error("❌ File message schema validation failed:", error);
  }

  // Test update room schema
  try {
    const validUpdateData = {
      isActive: false,
      endedAt: new Date().toISOString(),
    };
    updateRoomSchema.parse(validUpdateData);
    console.log("✅ Update room schema validation passed");
  } catch (error) {
    console.error("❌ Update room schema validation failed:", error);
  }

  // Test invalid data
  console.log("\n🧪 Testing invalid data handling...");

  try {
    createRoomSchema.parse({ appointmentId: "invalid-id" });
    console.error("❌ Should have failed for invalid appointment ID");
  } catch (error) {
    console.log("✅ Correctly rejected invalid appointment ID");
  }

  try {
    sendMessageSchema.parse({
      chatRoomId: "clx1234567890abcdef",
      content: "",
      messageType: "TEXT",
    });
    console.error("❌ Should have failed for empty content");
  } catch (error) {
    console.log("✅ Correctly rejected empty message content");
  }

  try {
    sendMessageSchema.parse({
      chatRoomId: "clx1234567890abcdef",
      content: "Test message",
      messageType: "FILE",
      fileUrl: "invalid-url",
    });
    console.error("❌ Should have failed for invalid file URL");
  } catch (error) {
    console.log("✅ Correctly rejected invalid file URL");
  }

  console.log("\n🎉 Chat API schema validation completed!");
}

validateChatAPI();
