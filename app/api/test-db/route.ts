import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Forzar renderizado dinámico
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Prueba simple de conexión
    const userCount = await prisma.user.count();
    
    return NextResponse.json({
      status: 'success',
      message: 'Database connection working',
      userCount
    });

  } catch (error) {
    console.error('Database test error:', error);
    return NextResponse.json(
      { 
        status: 'error',
        message: 'Database connection failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 