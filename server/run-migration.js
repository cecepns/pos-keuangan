const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

async function run() {
  const connectionConfig = {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "pos_keuangan",
    multipleStatements: true,
  };
  
  console.log("Connecting to database with config:", {
    ...connectionConfig,
    password: connectionConfig.password ? "****" : "",
  });
  
  let connection;
  try {
    connection = await mysql.createConnection(connectionConfig);
    console.log("Connected successfully. Running migration...");
    
    const migrationPath = path.join(__dirname, "../database/migrations/002_catalog_features.sql");
    const sql = fs.readFileSync(migrationPath, "utf8");
    
    await connection.query(sql);
    console.log("Migration executed successfully!");
  } catch (err) {
    console.error("Migration error:", err.message);
  } finally {
    if (connection) await connection.end();
  }
}

run();
