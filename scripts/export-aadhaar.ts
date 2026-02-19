
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

// Explicitly load .env for the script
import * as dotenv from 'dotenv';
dotenv.config();

// Workaround for connection issues: try removing strict ssl params if needed
const envUrl = process.env.DATABASE_URL || '';
const connectionUrl = envUrl.replace('&channel_binding=require', '');

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: connectionUrl,
        },
    },
});

async function main() {
    console.log('🔄 Connecting to database...');

    try {
        const records = await prisma.governmentRecord.findMany();
        console.log(`✅ Found ${records.length} Aadhaar records.`);

        if (records.length === 0) {
            console.log('⚠️ No records found to export.');
            return;
        }

        const outputPath = path.join(process.cwd(), 'aadhaar_records.json');

        fs.writeFileSync(outputPath, JSON.stringify(records, null, 2));
        console.log(`📂 Data exported successfully to: ${outputPath}`);

    } catch (error) {
        console.error('❌ Error exporting records:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
