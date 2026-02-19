// Quick DB inspection script - uses raw SQL to avoid schema issues
// Run with: node scripts/db-inspect.mjs
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function safeCount(table) {
    try {
        const res = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM "${table}"`);
        return Number(res[0].count);
    } catch { return 'ERROR'; }
}

async function safeQuery(sql) {
    try {
        return await prisma.$queryRawUnsafe(sql);
    } catch (e) { return [{ error: e.message }]; }
}

async function main() {
    // Table row counts
    console.log('\n=== DATABASE SUMMARY ===');
    const tables = ['GovernmentRecord', 'User', 'Election', 'Candidate', 'Vote'];
    for (const t of tables) {
        console.log(`${t.padEnd(20)}: ${await safeCount(t)}`);
    }

    // Elections
    console.log('\n=== ELECTIONS ===');
    const elections = await safeQuery(`SELECT * FROM "Election" LIMIT 20`);
    if (elections.length === 0) console.log('(none)');
    else console.table(elections);

    // Candidates
    console.log('\n=== CANDIDATES ===');
    const candidates = await safeQuery(`SELECT id, name, party, "electionId" FROM "Candidate" LIMIT 20`);
    if (candidates.length === 0) console.log('(none)');
    else console.table(candidates);

    // Sample gov records
    console.log('\n=== SAMPLE GOVERNMENT RECORDS (first 10) ===');
    const govRecords = await safeQuery(`SELECT id, "fullName", "documentNumber", "dateOfBirth" FROM "GovernmentRecord" LIMIT 10`);
    console.table(govRecords);

    // Users
    console.log('\n=== REGISTERED USERS ===');
    const users = await safeQuery(`SELECT id, name, email, role, "hasVoted", "createdAt" FROM "User" LIMIT 20`);
    if (users.length === 0) console.log('(none)');
    else console.table(users);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
