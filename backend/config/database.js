import { Sequelize } from "sequelize";

const sequelize = new Sequelize(
  process.env.DB_NAME || "fastify_db",
  process.env.DB_USER || "postgres",
  process.env.DB_PASSWORD || "00181818",
  {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 5432,
    dialect: "postgres",
    logging: process.env.NODE_ENV === "development" ? console.log : false,
  },
);

export async function syncModels() {
  try {
    await sequelize.sync({ alter: false });
    console.log("Models synced");
  } catch (error) {
    console.error("Error syncing models:", error);
    throw error;
  }
}

export default sequelize;
