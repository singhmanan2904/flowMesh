import bcrypt from "bcryptjs";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import { prisma } from "../../../lib/prismaClient.js";
import { authRegisterSchema } from "../../schema/auth.schema.js";

function authRouter(fastify: FastifyInstance) {
    fastify.addSchema(authRegisterSchema);

    fastify.post("/register", {
        schema: {
            body: { $ref: "authRegisterSchema" },
        },
        handler: async (
            request: FastifyRequest<{
                Body: {
                    username: string;
                    password: string;
                    email: string;
                };
            }>,
            reply: FastifyReply
        ) => {
            const { username, email } = request.body;
            try {
                const { password } = request.body;
                const hashedPassword = bcrypt.hashSync(password, 10);
                const user = await prisma.users.create({
                    data: {
                        username,
                        password: hashedPassword,
                        email: email,
                    },
                });
                const token = await jwt.sign({ id: user.id }, process.env.SECRET_JWT || "", { expiresIn: "24h" });
                request.log.info({ userId: user.id, username }, "User registered");
                return reply.setCookie("flowmesh_token", token, {
                    httpOnly: true,
                    path: "/",
                    maxAge: 24 * 60 * 60 * 1000,
                    sameSite: "lax",
                    secure: !process.env.IS_PRODUCTION!,
                }).code(201).send({ message: "User registered successfully" });
            } catch (err) {
                request.log.error({ err, username }, "Failed to register user");
                return reply.code(403).send({ message: "Error while registering the user", err });
            }
        },
    });

    fastify.post("/login", {
        schema: {
            body: { $ref: "authRegisterSchema" },
        },
        handler: async (
            request: FastifyRequest<{
                Body: {
                    username: string;
                    password: string;
                };
            }>,
            reply: FastifyReply
        ) => {
            const { username } = request.body;
            try {
                const { password } = request.body;
                const user = await prisma.users.findUnique({
                    where: {
                        username,
                    },
                });
                if (!user) {
                    request.log.warn({ username }, "Login failed: user not found");
                    return reply.code(401).send({ message: "User not found!" });
                }
                const isMatched = bcrypt.compareSync(password, user.password);
                if (!isMatched) {
                    request.log.warn({ username, userId: user.id }, "Login failed: incorrect password");
                    return { message: "Incorrect username or password!" };
                }
                const token = jwt.sign({ id: user.id }, process.env.SECRET_JWT || "", { expiresIn: "24h" });
                request.log.info({ userId: user.id, username }, "User logged in");
                return reply.setCookie("flowmesh_token", token, {
                    httpOnly: true,
                    path: "/",
                    maxAge: 24 * 60 * 60 * 1000,
                    sameSite: "lax",
                    secure: !process.env.IS_PRODUCTION!,
                }).code(201).send({ message: "User logged in successfully" });
            } catch (err) {
                request.log.error({ err, username }, "Failed to log in user");
                return reply.code(403).send({ message: "Error while logging in the user", err });
            }
        },
    });
}

export default authRouter;
