import { registerHandler, loginHandler } from "../controllers/auth.js";

const registerOptions = {
  schema: {
    body: {
      type: "object",
      required: ["email", "password"],
      properties: {
        email: {
          type: "string",
          format: "email",
          minLength: 1,
          maxLength: 255,
        },
        password: {
          type: "string",
          minLength: 6,
          maxLength: 128,
        },
        role: {
          type: "string",
          enum: ["user", "admin", "moderator"],
          default: "user",
        },
      },
    },
    response: {
      200: {
        type: "object",
        properties: {
          id: { type: "string" },
          email: { type: "string" },
          role: { type: "string" },
        },
      },
      400: {
        type: "object",
        properties: {
          statusCode: { type: "number" },
          error: { type: "string" },
          message: { type: "string" },
        },
      },
      409: {
        type: "object",
        properties: {
          error: { type: "string" },
        },
      },
    },
  },
  handler: registerHandler,
};

const loginOptions = {
  schema: {
    body: {
      type: "object",
      required: ["email", "password"],
      properties: {
        email: {
          type: "string",
          format: "email",
          minLength: 1,
          maxLength: 255,
        },
        password: {
          type: "string",
          minLength: 1,
          maxLength: 128,
        },
      },
    },
    response: {
      200: {
        type: "object",
        properties: {
          token: { type: "string" },
        },
      },
      400: {
        type: "object",
        properties: {
          statusCode: { type: "number" },
          error: { type: "string" },
          message: { type: "string" },
        },
      },
      401: {
        type: "object",
        properties: {
          error: { type: "string" },
        },
      },
    },
  },
  handler: loginHandler,
};

export async function authRoutes(fastify) {
  fastify.post("/register", registerOptions);

  fastify.post("/login", loginOptions);
}
