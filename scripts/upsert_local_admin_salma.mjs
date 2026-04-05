import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL manquant");
}

const email = "salma@gmail.com";
const openId = "local-admin:salma@gmail.com";
const now = new Date();

const connection = await mysql.createConnection(databaseUrl);

try {
  await connection.execute(
    `
      INSERT INTO users (openId, name, email, loginMethod, role, createdAt, updatedAt, lastSignedIn)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        email = VALUES(email),
        loginMethod = VALUES(loginMethod),
        role = VALUES(role),
        updatedAt = VALUES(updatedAt),
        lastSignedIn = VALUES(lastSignedIn)
    `,
    [openId, "salma", email, "local_admin", "admin", now, now, now],
  );

  const [rows] = await connection.execute(
    `SELECT id, openId, email, loginMethod, role FROM users WHERE openId = ? LIMIT 1`,
    [openId],
  );

  console.log(JSON.stringify(rows, null, 2));
} finally {
  await connection.end();
}
