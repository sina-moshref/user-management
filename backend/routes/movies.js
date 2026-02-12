const moviesOptions = {
  schema: {
    security: [{ bearerAuth: [] }],
    response: {
      200: {
        type: "object",
        properties: {
          movies: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
  handler: async (request) => {
    return { movies: ["Movie 1", "Movie 2", "Movie 3"] };
  },
};
export async function moviesRoutes(fastify) {
  fastify.get("/movies", {
    ...moviesOptions,
    preHandler: [
      fastify.authenticate,
      fastify.requireRoles(["admin", "moderator"]),
    ],
  });
}
