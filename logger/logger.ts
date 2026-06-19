import pino, { type TransportTargetOptions } from "pino";

const isDev = process.env.NODE_ENV === "development";
const logLevel = process.env.LOG_LEVEL ?? "info";
const lokiHost = process.env.LOKI_HOST ?? "http://localhost:3100";
const enableLoki = process.env.ENABLE_LOKI !== "false";

const targets: TransportTargetOptions[] = [];

if (isDev) {
    targets.push({
        level: logLevel,
        target: "pino-pretty",
        options: {
            colorize: true,
            translateTime: "HH:MM:ss Z",
            ignore: "pid,hostname",
        },
    });
}

if (enableLoki) {
    targets.push({
        level: logLevel,
        target: "pino-loki",
        options: {
            host: lokiHost,
            labels: {
                app: "flowmesh",
                env: process.env.NODE_ENV ?? "development",
            },
            silenceErrors: true,
        },
    });
}

const transport = targets.length > 0 ? pino.transport({ targets }) : undefined;
const logger = transport ? pino({ level: logLevel }, transport) : pino({ level: logLevel });

export function createLogger(context: string) {
    return logger.child({ context });
}

export default logger;
