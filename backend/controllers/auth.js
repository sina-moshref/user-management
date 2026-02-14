import User from "../models/User.js";
import bcrypt from "bcrypt";

export async function registerHandler(request, reply) {
  const { email, password, role = "user" } = request.body;

  const existing = await User.findOne({ where: { email } });
  if (existing) return reply.code(409).send({ error: "User exists" });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ email, passwordHash, role });

  return { id: user.id, email: user.email, role: user.role };
}

export async function loginHandler(request, reply) {
  const { email, password } = request.body;
  const user = await User.findOne({ where: { email } });

  if (!user) return reply.code(401).send({ error: "Invalid credentials" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return reply.code(401).send({ error: "Invalid credentials" });


  // try {
  //   await User.update(
  //     { lastSeen: new Date() },
  //     { where: { id: user.id } }
  //   );
  // } catch (error) {
  //   console.error("Failed to update lastSeen on login:", error.message);
  // }

  const payload = { id: user.id, email, role: user.role };

  const token = request.server.jwt.sign(payload, {
    expiresIn: "1h",
  });
  return { token };
}
