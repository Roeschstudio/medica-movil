import { createSupabaseServerClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET() {
  const startTime = Date.now();
  const services = {};
  let overallStatus = "healthy";

  try {
    const supabase = createSupabaseServerClient();

    // Test database connection
    const dbStartTime = Date.now();
    const { data, error } = await supabase.from("users").select("id").limit(1);
    const dbResponseTime = Date.now() - dbStartTime;

    if (error) {
      services.database = {
        status: "unhealthy",
        response_time: dbResponseTime,
        error: error.message,
      };
      overallStatus = "unhealthy";
    } else {
      services.database = {
        status: dbResponseTime > 1000 ? "degraded" : "healthy",
        response_time: dbResponseTime,
      };
      if (dbResponseTime > 1000 && overallStatus === "healthy") {
        overallStatus = "degraded";
      }
    }

    // Test storage connection
    const storageStartTime = Date.now();
    try {
      const { data: storageData, error: storageError } = await supabase.storage
        .from("medical-files")
        .list("", { limit: 1 });

      const storageResponseTime = Date.now() - storageStartTime;

      if (storageError) {
        services.storage = {
          status: "unhealthy",
          response_time: storageResponseTime,
          error: storageError.message,
        };
        overallStatus = "unhealthy";
      } else {
        services.storage = {
          status: storageResponseTime > 1500 ? "degraded" : "healthy",
          response_time: storageResponseTime,
        };
        if (storageResponseTime > 1500 && overallStatus === "healthy") {
          overallStatus = "degraded";
        }
      }
    } catch (storageError) {
      services.storage = {
        status: "unhealthy",
        response_time: Date.now() - storageStartTime,
        error:
          storageError instanceof Error
            ? storageError.message
            : "Storage connection failed",
      };
      overallStatus = "unhealthy";
    }

    // Test chat system (check active chat rooms)
    const chatStartTime = Date.now();
    try {
      const { count: activeChatRooms, error: chatError } = await supabase
        .from("chat_rooms")
        .select("*", { count: "exact", head: true })
        .eq("isActive", true);

      const chatResponseTime = Date.now() - chatStartTime;

      if (chatError) {
        services.chat = {
          status: "unhealthy",
          response_time: chatResponseTime,
          error: chatError.message,
        };
        overallStatus = "unhealthy";
      } else {
        services.chat = {
          status: chatResponseTime > 800 ? "degraded" : "healthy",
          response_time: chatResponseTime,
          active_rooms: activeChatRooms || 0,
        };
        if (chatResponseTime > 800 && overallStatus === "healthy") {
          overallStatus = "degraded";
        }
      }
    } catch (chatError) {
      services.chat = {
        status: "unhealthy",
        response_time: Date.now() - chatStartTime,
        error:
          chatError instanceof Error
            ? chatError.message
            : "Chat system check failed",
      };
      overallStatus = "unhealthy";
    }

    // API is operational if we got this far
    services.api = {
      status: "healthy",
      response_time: Date.now() - startTime,
    };

    // Store health check result
    try {
      await supabase.from("system_health").insert({
        overallStatus,
        services: Object.keys(services).map((serviceName) => ({
          service: serviceName,
          status: services[serviceName].status,
          response_time: services[serviceName].response_time,
          error_message: services[serviceName].error,
          timestamp: new Date().toISOString(),
          metadata: services[serviceName],
        })),
      });
    } catch (insertError) {
      console.warn("Failed to store health check result:", insertError);
    }

    const responseStatus = overallStatus === "unhealthy" ? 503 : 200;

    return NextResponse.json(
      {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        response_time: Date.now() - startTime,
        services,
      },
      { status: responseStatus }
    );
  } catch (error) {
    console.error("Health check failed:", error);

    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        response_time: Date.now() - startTime,
        error: error instanceof Error ? error.message : "Unknown error",
        services: {
          ...services,
          api: {
            status: "unhealthy",
            error: error instanceof Error ? error.message : "Unknown error",
          },
        },
      },
      { status: 503 }
    );
  }
}

export async function HEAD() {
  // Simple connectivity check for offline detection
  return new NextResponse(null, { status: 200 });
}
