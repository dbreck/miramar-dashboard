import { NextResponse } from 'next/server';
import { SparkAPIClient } from '@/lib/spark-client';

export async function GET() {
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
