import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('class_changes')
      .select('id, moki_name, old_class, new_class, changed_at')
      .order('changed_at', { ascending: false })
      .limit(1000);

    if (error) {
      console.error('Error fetching changelog:', error);
      return NextResponse.json(
        { error: 'Failed to load changelog' },
        { status: 500 }
      );
    }

    return NextResponse.json(data || []);
  } catch (err) {
    console.error('Changelog API error:', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
