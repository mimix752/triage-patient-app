import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL manquant");
  process.exit(1);
}

const connection = await mysql.createConnection(databaseUrl);

try {
  const [tables] = await connection.query("SHOW TABLES");
  console.log("TABLES:");
  console.log(JSON.stringify(tables, null, 2));

  for (const tableName of ["patientFormLinks", "staffingSnapshots", "triageCases", "patients"]) {
    try {
      const [columns] = await connection.query(`SHOW COLUMNS FROM \`${tableName}\``);
      console.log(`\nCOLUMNS ${tableName}:`);
      console.log(JSON.stringify(columns, null, 2));
    } catch (error) {
      console.log(`\nMISSING_OR_INVALID ${tableName}:`);
      console.log(error instanceof Error ? error.message : String(error));
    }
  }
} finally {
  await connection.end();
}
