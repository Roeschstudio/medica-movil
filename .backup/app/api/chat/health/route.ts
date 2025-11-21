import { createSupabaseServerClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = createSupabaseServerClient();

    const startTime = Date.now();

    // Test database connectivity
    const { data, error } = await supabase
      .from("chat_rooms")
      .select("id")
      .limit(1);

    const responseTime = Date.now() - startTime;

    if (error) {
      return NextResponse.json(
        {
          status: "unhealthy",
          error: error.message,
          responseTime,
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      status: "healthy",
      responseTime,
      timestamp: new Date().toISOString(),
      services: {
        database: "healthy",
        chat_api: "healthy",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "unhealthy",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
