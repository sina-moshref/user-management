import {
  listUsersHandler,
  updateUserHandler,
  deleteUserHandler,
} from "../controllers/users.js";

const listOptions = {
  schema: {
    security: [{ bearerAuth: [] }],
    response: {
      200: {
        type: "object",
        properties: {
          users: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                email: { type: "string" },
                role: { type: "string" },
                createdAt: { type: "string", format: "date-time" },
                lastSeen: { type: ["string", "null"], format: "date-time" },
              },
            },
          },
        },
      },
    },
  },
  handler: listUsersHandler,
};

const updateOptions = {
  schema: {
    security: [{ bearerAuth: [] }],
    params: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
    body: {
      type: "object",
      properties: {
        email: { type: "string", format: "email" },
        role: { type: "string", enum: ["user", "admin", "moderator"] },
        password: { type: "string", minLength: 6 },
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
      400: { type: "object", properties: { error: { type: "string" } } },
      404: { type: "object", properties: { error: { type: "string" } } },
      409: { type: "object", properties: { error: { type: "string" } } },
    },
  },
  handler: updateUserHandler,
};

const deleteOptions = {
  schema: {
    security: [{ bearerAuth: [] }],
    params: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
    response: {
      200: { type: "object", properties: { ok: { type: "boolean" } } },
      400: { type: "object", properties: { error: { type: "string" } } },
      404: { type: "object", properties: { error: { type: "string" } } },
    },
  },
  handler: deleteUserHandler,
};

export async function usersRoutes(fastify) {
  fastify.get("/users", {
    ...listOptions,
    preHandler: [fastify.authenticate, fastify.requireRoles(["admin"])],
  });
  fastify.patch("/users/:id", {
    ...updateOptions,
    preHandler: [fastify.authenticate, fastify.requireRoles(["admin"])],
  });
  fastify.delete("/users/:id", {
    ...deleteOptions,
    preHandler: [fastify.authenticate, fastify.requireRoles(["admin"])],
  });
}
