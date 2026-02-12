async function postgresPlugin(fastify) {
  fastify.register(require("@fastify/postgres"), {
    connectionString: "postgres://postgres:00181818@localhost:5432/fastify_db",
  });

  fastify.addHook("onReady", async () => {
    const res = await fastify.pg.query("SELECT 1");
    console.log("Postgres connected:", res.rows);
  });
}

module.exports = postgresPlugin;
