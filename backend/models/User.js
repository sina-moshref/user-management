import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    role: {
      type: DataTypes.ENUM("user", "admin", "moderator"), // fixed set
      defaultValue: "user",
      allowNull: false,
    },
    passwordHash: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "password_hash", // maps to DB column
    },
    lastSeen: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "last_seen", // maps to DB column
      
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: "created_at",
    },
  },
  {
    tableName: "usersTa",
    timestamps: false, // we manually manage createdAt
  },
);

export default User;
