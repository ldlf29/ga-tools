import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

export async function GET() {
  try {
    // Definir la ruta al CSV generado por Python
    // Estructura: GA-TOOLS-CLEAN/ml/data/upcoming_180_ranking.csv
    const csvPath = path.join(process.cwd(), 'ml', 'data', 'upcoming_180_ranking.csv');

    if (!fs.existsSync(csvPath)) {
      return NextResponse.json({ error: 'Ranking file not found. Please run 8_generate_rank.py first.' }, { status: 404 });
    }

    const fileContent = fs.readFileSync(csvPath, 'utf8');
    
    // Parsear CSV
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      cast: (value, context) => {
        if (context.header) return value;
        
        // Strict number validation: only cast if the string is purely a number
        // This prevents "1 of 1" from becoming 1 and "24K" from becoming 24
        if (/^-?\d+(\.\d+)?$/.test(value)) {
          return parseFloat(value);
        }
        
        return value;
      }
    });

    // Devolver los 180 registros mapeados
    return NextResponse.json({ 
        success: true, 
        data: records,
        timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error reading ranking CSV:', error);
    return NextResponse.json({ error: 'Failed to parse ranking data', details: error.message }, { status: 500 });
  }
}
