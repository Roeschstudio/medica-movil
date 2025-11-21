#!/usr/bin/env tsx

/**
 * Test script to verify Row Level Security policies for chat system
 * This script tests RLS policies with different user roles to ensure proper access control
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

// Load environment variables
config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
  console.error("Missing required environment variables");
  process.exit(1);
}

// Create clients
const adminClient = createClient(supabaseUrl, supabaseServiceKey);
const anonClient = createClient(supabaseUrl, supabaseAnonKey);

interface TestUser {
  id: string;
  email: string;
  role: "PATIENT" | "DOCTOR" | "ADMIN";
  name: string;
}

interface TestDoctor {
  id: string;
  userId: string;
  specialty: string;
}

interface TestAppointment {
  id: string;
  patientId: string;
  doctorId: string;
}

interface TestChatRoom {
  id: string;
  appointmentId: string;
  patientId: string;
  doctorId: string;
}

class RLSPolicyTester {
  private testUsers: TestUser[] = [];
  private testDoctors: TestDoctor[] = [];
  private testAppointments: TestAppointment[] = [];
  private testChatRooms: TestChatRoom[] = [];

  async setup() {
    console.log("🚀 Setting up test data...");

    try {
      // Create test users
      await this.createTestUsers();
      await this.createTestDoctors();
      await this.createTestAppointments();
      await this.createTestChatRooms();

      console.log("✅ Test data setup completed");
    } catch (error) {
      console.error("❌ Setup failed:", error);
      throw error;
    }
  }

  async cleanup() {
    console.log("🧹 Cleaning up test data...");

    try {
      // Clean up in reverse order due to foreign key constraints
      if (this.testChatRooms.length > 0) {
        await adminClient
          .from("chat_rooms")
          .delete()
          .in(
            "id",
            this.testChatRooms.map((r) => r.id)
          );
      }

      if (this.testAppointments.length > 0) {
        await adminClient
          .from("appointments")
          .delete()
          .in(
            "id",
            this.testAppointments.map((a) => a.id)
          );
      }

      if (this.testDoctors.length > 0) {
        await adminClient
          .from("doctors")
          .delete()
          .in(
            "id",
            this.testDoctors.map((d) => d.id)
          );
      }

      if (this.testUsers.length > 0) {
        await adminClient
          .from("users")
          .delete()
          .in(
            "id",
            this.testUsers.map((u) => u.id)
          );
      }

      console.log("✅ Cleanup completed");
    } catch (error) {
      console.error("❌ Cleanup failed:", error);
    }
  }

  private async createTestUsers() {
    const users = [
      {
        email: "test-patient@example.com",
        role: "PATIENT" as const,
        name: "Test Patient",
      },
      {
        email: "test-doctor@example.com",
        role: "DOCTOR" as const,
        name: "Test Doctor",
      },
      {
        email: "test-admin@example.com",
        role: "ADMIN" as const,
        name: "Test Admin",
      },
      {
        email: "test-patient2@example.com",
        role: "PATIENT" as const,
        name: "Test Patient 2",
      },
    ];

    for (const userData of users) {
      const { data, error } = await adminClient
        .from("users")
        .insert({
          email: userData.email,
          name: userData.name,
          role: userData.role,
          password: "test-password-hash",
        })
        .select()
        .single();

      if (error) throw error;
      this.testUsers.push(data);
    }
  }

  private async createTestDoctors() {
    const doctorUser = this.testUsers.find((u) => u.role === "DOCTOR")!;

    const { data, error } = await adminClient
      .from("doctors")
      .insert({
        user_id: doctorUser.id,
        specialty: "Medicina General",
        city: "Ciudad de México",
        state: "CDMX",
      })
      .select()
      .single();

    if (error) throw error;
    this.testDoctors.push(data);
  }

  private async createTestAppointments() {
    const patient = this.testUsers.find((u) => u.role === "PATIENT")!;
    const doctor = this.testDoctors[0];

    const { data, error } = await adminClient
      .from("appointments")
      .insert({
        patient_id: patient.id,
        doctor_id: doctor.id,
        type: "VIRTUAL",
        scheduled_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        duration: 30,
        price: 500,
        patient_phone: "+525512345678",
        patient_email: patient.email,
      })
      .select()
      .single();

    if (error) throw error;
    this.testAppointments.push(data);
  }

  private async createTestChatRooms() {
    const appointment = this.testAppointments[0];
    const patient = this.testUsers.find((u) => u.role === "PATIENT")!;
    const doctor = this.testDoctors[0];

    const { data, error } = await adminClient
      .from("chat_rooms")
      .insert({
        appointment_id: appointment.id,
        patient_id: patient.id,
        doctor_id: doctor.id,
      })
      .select()
      .single();

    if (error) throw error;
    this.testChatRooms.push(data);
  }

  private async createAuthenticatedClient(userId: string) {
    // Create a JWT token for the user (simplified for testing)
    const { data, error } = await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email: this.testUsers.find((u) => u.id === userId)!.email,
    });

    if (error) throw error;

    const client = createClient(supabaseUrl, supabaseAnonKey);

    // Set the session manually (in real app, this would be handled by auth flow)
    const { error: sessionError } = await client.auth.setSession({
      access_token: data.properties?.access_token || "",
      refresh_token: data.properties?.refresh_token || "",
    });

    if (sessionError) throw sessionError;
    return client;
  }

  async testChatRoomAccess() {
    console.log("\n📋 Testing Chat Room Access Policies...");

    const patient = this.testUsers.find((u) => u.role === "PATIENT")!;
    const doctor = this.testUsers.find((u) => u.role === "DOCTOR")!;
    const admin = this.testUsers.find((u) => u.role === "ADMIN")!;
    const otherPatient = this.testUsers.find(
      (u) => u.role === "PATIENT" && u.id !== patient.id
    )!;

    const chatRoom = this.testChatRooms[0];

    // Test patient access
    try {
      const patientClient = await this.createAuthenticatedClient(patient.id);
      const { data, error } = await patientClient
        .from("chat_rooms")
        .select("*")
        .eq("id", chatRoom.id);

      if (error) throw error;
      console.log("✅ Patient can access their chat room:", data.length === 1);
    } catch (error) {
      console.log("❌ Patient access failed:", error);
    }

    // Test doctor access
    try {
      const doctorClient = await this.createAuthenticatedClient(doctor.id);
      const { data, error } = await doctorClient
        .from("chat_rooms")
        .select("*")
        .eq("id", chatRoom.id);

      if (error) throw error;
      console.log("✅ Doctor can access their chat room:", data.length === 1);
    } catch (error) {
      console.log("❌ Doctor access failed:", error);
    }

    // Test admin access
    try {
      const adminClient = await this.createAuthenticatedClient(admin.id);
      const { data, error } = await adminClient
        .from("chat_rooms")
        .select("*")
        .eq("id", chatRoom.id);

      if (error) throw error;
      console.log("✅ Admin can access any chat room:", data.length === 1);
    } catch (error) {
      console.log("❌ Admin access failed:", error);
    }

    // Test unauthorized access (other patient)
    try {
      const otherPatientClient = await this.createAuthenticatedClient(
        otherPatient.id
      );
      const { data, error } = await otherPatientClient
        .from("chat_rooms")
        .select("*")
        .eq("id", chatRoom.id);

      if (error) throw error;
      console.log(
        "✅ Other patient cannot access chat room:",
        data.length === 0
      );
    } catch (error) {
      console.log("❌ Unauthorized access test failed:", error);
    }
  }

  async testChatMessageAccess() {
    console.log("\n💬 Testing Chat Message Access Policies...");

    const patient = this.testUsers.find((u) => u.role === "PATIENT")!;
    const doctor = this.testUsers.find((u) => u.role === "DOCTOR")!;
    const chatRoom = this.testChatRooms[0];

    // Create test message as patient
    let messageId: string;
    try {
      const patientClient = await this.createAuthenticatedClient(patient.id);
      const { data, error } = await patientClient
        .from("chat_messages")
        .insert({
          chat_room_id: chatRoom.id,
          sender_id: patient.id,
          content: "Test message from patient",
          message_type: "TEXT",
        })
        .select()
        .single();

      if (error) throw error;
      messageId = data.id;
      console.log("✅ Patient can send messages to their chat room");
    } catch (error) {
      console.log("❌ Patient message sending failed:", error);
      return;
    }

    // Test doctor can read patient's message
    try {
      const doctorClient = await this.createAuthenticatedClient(doctor.id);
      const { data, error } = await doctorClient
        .from("chat_messages")
        .select("*")
        .eq("id", messageId);

      if (error) throw error;
      console.log(
        "✅ Doctor can read messages in their chat room:",
        data.length === 1
      );
    } catch (error) {
      console.log("❌ Doctor message reading failed:", error);
    }

    // Test doctor can send message
    try {
      const doctorClient = await this.createAuthenticatedClient(doctor.id);
      const { data, error } = await doctorClient
        .from("chat_messages")
        .insert({
          chat_room_id: chatRoom.id,
          sender_id: doctor.id,
          content: "Test message from doctor",
          message_type: "TEXT",
        })
        .select()
        .single();

      if (error) throw error;
      console.log("✅ Doctor can send messages to their chat room");
    } catch (error) {
      console.log("❌ Doctor message sending failed:", error);
    }

    // Clean up test message
    await adminClient.from("chat_messages").delete().eq("id", messageId);
  }

  async testHelperFunctions() {
    console.log("\n🔧 Testing Helper Functions...");

    const patient = this.testUsers.find((u) => u.role === "PATIENT")!;
    const chatRoom = this.testChatRooms[0];

    // Test has_chat_room_access function
    try {
      const { data, error } = await adminClient.rpc("has_chat_room_access", {
        room_id: chatRoom.id,
        user_id: patient.id,
      });

      if (error) throw error;
      console.log("✅ has_chat_room_access function works:", data === true);
    } catch (error) {
      console.log("❌ has_chat_room_access function failed:", error);
    }

    // Test get_unread_message_count function
    try {
      const { data, error } = await adminClient.rpc(
        "get_unread_message_count",
        {
          user_id: patient.id,
          room_id: chatRoom.id,
        }
      );

      if (error) throw error;
      console.log(
        "✅ get_unread_message_count function works:",
        typeof data === "number"
      );
    } catch (error) {
      console.log("❌ get_unread_message_count function failed:", error);
    }
  }

  async testStoragePolicies() {
    console.log("\n📁 Testing Storage Policies...");

    // Check if chat-files bucket exists
    try {
      const { data, error } = await adminClient.storage.getBucket("chat-files");

      if (error) throw error;
      console.log("✅ Chat-files bucket exists and is configured");
      console.log("   - File size limit:", data.file_size_limit, "bytes");
      console.log("   - Public access:", data.public);
      console.log(
        "   - Allowed MIME types:",
        data.allowed_mime_types?.length || 0,
        "types"
      );
    } catch (error) {
      console.log("❌ Storage bucket test failed:", error);
    }
  }

  async runAllTests() {
    try {
      await this.setup();

      await this.testChatRoomAccess();
      await this.testChatMessageAccess();
      await this.testHelperFunctions();
      await this.testStoragePolicies();

      console.log("\n🎉 All RLS policy tests completed!");
    } catch (error) {
      console.error("❌ Test suite failed:", error);
    } finally {
      await this.cleanup();
    }
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  const tester = new RLSPolicyTester();
  tester.runAllTests().catch(console.error);
}

export { RLSPolicyTester };
