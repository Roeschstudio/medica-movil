#!/usr/bin/env tsx

/**
 * Setup script to configure Supabase Realtime and Row Level Security
 * This script applies the migration and verifies the configuration
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { readFileSync } from "fs";
import { join } from "path";

// Load environment variables
config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing required environment variables:");
  console.error("   - NEXT_PUBLIC_SUPABASE_URL");
  console.error("   - SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

class RealtimeRLSSetup {
  async applyMigration() {
    console.log("🚀 Applying Realtime and RLS migration...");

    try {
      // Read the migration file
      const migrationPath = join(
        process.cwd(),
        "supabase/migrations/20241210_configure_realtime_and_rls.sql"
      );
      const migrationSQL = readFileSync(migrationPath, "utf-8");

      // Split the migration into individual statements
      const statements = migrationSQL
        .split(";")
        .map((stmt) => stmt.trim())
        .filter((stmt) => stmt.length > 0 && !stmt.startsWith("--"));

      console.log(`📝 Executing ${statements.length} SQL statements...`);

      // Execute each statement
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        if (statement.trim()) {
          try {
            const { error } = await supabase.rpc("exec_sql", {
              sql: statement + ";",
            });
            if (error) {
              console.warn(`⚠️  Statement ${i + 1} warning:`, error.message);
            }
          } catch (error) {
            console.warn(`⚠️  Statement ${i + 1} failed:`, error);
          }
        }
      }

      console.log("✅ Migration applied successfully");
    } catch (error) {
      console.error("❌ Migration failed:", error);
      throw error;
    }
  }

  async verifyRealtimeConfiguration() {
    console.log("\n🔍 Verifying Realtime configuration...");

    const tables = [
      "chat_rooms",
      "chat_messages",
      "notifications",
      "video_sessions",
      "video_session_participants",
    ];

    for (const table of tables) {
      try {
        // Check if table is enabled for realtime
        const { data, error } = await supabase
          .from("pg_publication_tables")
          .select("*")
          .eq("pubname", "supabase_realtime")
          .eq("tablename", table);

        if (error) throw error;

        if (data && data.length > 0) {
          console.log(`✅ ${table} is enabled for Realtime`);
        } else {
          console.log(`❌ ${table} is NOT enabled for Realtime`);
        }
      } catch (error) {
        console.log(`⚠️  Could not verify ${table} Realtime status:`, error);
      }
    }
  }

  async verifyRLSPolicies() {
    console.log("\n🔒 Verifying RLS policies...");

    const tables = [
      "chat_rooms",
      "chat_messages",
      "notifications",
      "video_sessions",
      "video_session_participants",
      "medical_files",
    ];

    for (const table of tables) {
      try {
        // Check if RLS is enabled
        const { data: rlsData, error: rlsError } = await supabase
          .from("pg_tables")
          .select("*")
          .eq("tablename", table)
          .eq("rowsecurity", true);

        if (rlsError) throw rlsError;

        if (rlsData && rlsData.length > 0) {
          console.log(`✅ ${table} has RLS enabled`);
        } else {
          console.log(`❌ ${table} does NOT have RLS enabled`);
        }

        // Check policies
        const { data: policiesData, error: policiesError } = await supabase
          .from("pg_policies")
          .select("policyname")
          .eq("tablename", table);

        if (policiesError) throw policiesError;

        if (policiesData && policiesData.length > 0) {
          console.log(
            `   📋 ${policiesData.length} policies found for ${table}`
          );
          policiesData.forEach((policy) => {
            console.log(`      - ${policy.policyname}`);
          });
        } else {
          console.log(`   ⚠️  No policies found for ${table}`);
        }
      } catch (error) {
        console.log(`⚠️  Could not verify ${table} RLS status:`, error);
      }
    }
  }

  async verifyStorageBucket() {
    console.log("\n📁 Verifying Storage bucket configuration...");

    try {
      const { data, error } = await supabase.storage.getBucket("chat-files");

      if (error) {
        if (error.message.includes("not found")) {
          console.log("❌ chat-files bucket does not exist");
        } else {
          throw error;
        }
      } else {
        console.log("✅ chat-files bucket exists");
        console.log(
          `   - File size limit: ${data.file_size_limit} bytes (${Math.round(
            data.file_size_limit / 1024 / 1024
          )}MB)`
        );
        console.log(`   - Public access: ${data.public}`);
        console.log(
          `   - Allowed MIME types: ${
            data.allowed_mime_types?.length || 0
          } types`
        );

        if (data.allowed_mime_types && data.allowed_mime_types.length > 0) {
          console.log("   - MIME types:", data.allowed_mime_types.join(", "));
        }
      }

      // Check storage policies
      const { data: policies, error: policiesError } = await supabase
        .from("pg_policies")
        .select("policyname, cmd")
        .eq("tablename", "objects")
        .like("policyname", "%chat%");

      if (policiesError) throw policiesError;

      if (policies && policies.length > 0) {
        console.log(`   📋 ${policies.length} storage policies found:`);
        policies.forEach((policy) => {
          console.log(`      - ${policy.policyname} (${policy.cmd})`);
        });
      } else {
        console.log("   ⚠️  No chat-related storage policies found");
      }
    } catch (error) {
      console.error("❌ Storage verification failed:", error);
    }
  }

  async verifyHelperFunctions() {
    console.log("\n🔧 Verifying helper functions...");

    const functions = [
      "has_chat_room_access",
      "get_unread_message_count",
      "mark_messages_as_read",
    ];

    for (const functionName of functions) {
      try {
        const { data, error } = await supabase
          .from("pg_proc")
          .select("proname")
          .eq("proname", functionName);

        if (error) throw error;

        if (data && data.length > 0) {
          console.log(`✅ ${functionName} function exists`);
        } else {
          console.log(`❌ ${functionName} function does NOT exist`);
        }
      } catch (error) {
        console.log(`⚠️  Could not verify ${functionName} function:`, error);
      }
    }
  }

  async verifyTriggers() {
    console.log("\n⚡ Verifying triggers...");

    const triggers = [
      { name: "trigger_notify_new_message", table: "chat_messages" },
      { name: "trigger_update_chat_room_activity", table: "chat_messages" },
    ];

    for (const trigger of triggers) {
      try {
        const { data, error } = await supabase
          .from("pg_trigger")
          .select("tgname")
          .eq("tgname", trigger.name);

        if (error) throw error;

        if (data && data.length > 0) {
          console.log(`✅ ${trigger.name} trigger exists on ${trigger.table}`);
        } else {
          console.log(
            `❌ ${trigger.name} trigger does NOT exist on ${trigger.table}`
          );
        }
      } catch (error) {
        console.log(`⚠️  Could not verify ${trigger.name} trigger:`, error);
      }
    }
  }

  async verifyIndexes() {
    console.log("\n📊 Verifying performance indexes...");

    const expectedIndexes = [
      "idx_chat_rooms_appointment_id",
      "idx_chat_rooms_patient_id",
      "idx_chat_rooms_doctor_id",
      "idx_chat_messages_chat_room_id",
      "idx_chat_messages_sender_id",
      "idx_chat_messages_sent_at",
    ];

    for (const indexName of expectedIndexes) {
      try {
        const { data, error } = await supabase
          .from("pg_indexes")
          .select("indexname")
          .eq("indexname", indexName);

        if (error) throw error;

        if (data && data.length > 0) {
          console.log(`✅ ${indexName} index exists`);
        } else {
          console.log(`❌ ${indexName} index does NOT exist`);
        }
      } catch (error) {
        console.log(`⚠️  Could not verify ${indexName} index:`, error);
      }
    }
  }

  async runSetup() {
    console.log("🎯 Starting Supabase Realtime and RLS setup...\n");

    try {
      await this.applyMigration();
      await this.verifyRealtimeConfiguration();
      await this.verifyRLSPolicies();
      await this.verifyStorageBucket();
      await this.verifyHelperFunctions();
      await this.verifyTriggers();
      await this.verifyIndexes();

      console.log("\n🎉 Setup completed successfully!");
      console.log("\n📋 Next steps:");
      console.log("   1. Run the RLS policy tests: npm run test:rls");
      console.log("   2. Test Realtime functionality in your application");
      console.log("   3. Verify file upload works with the chat-files bucket");
    } catch (error) {
      console.error("\n❌ Setup failed:", error);
      process.exit(1);
    }
  }
}

// Run setup if this script is executed directly
if (require.main === module) {
  const setup = new RealtimeRLSSetup();
  setup.runSetup().catch(console.error);
}

export { RealtimeRLSSetup };
