import { NextResponse } from 'next/server';
import { SparkAPIClient } from '@/lib/spark-client';
import { currentProfile } from '@/lib/require-admin';

export async function GET() {
  if (!(await currentProfile())) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 });
  }
  try {
    const apiKey = process.env.SPARK_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'SPARK_API_KEY not configured' },
        { status: 500 }
      );
    }

    const client = new SparkAPIClient(apiKey);
    const projects = await client.listProjects();

    return NextResponse.json({
      success: true,
      projects,
      message: 'Spark API connection successful'
    });
  } catch (error: any) {
    console.error('API test failed:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to connect to Spark API',
        details: error
      },
      { status: error.status || 500 }
    );
  }
}
