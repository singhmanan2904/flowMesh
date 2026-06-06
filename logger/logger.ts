import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

const transport = pino.transport({
    targets: [
        {
            level: process.env.LOG_LEVEL ?? "info",
            target: "pino-pretty",
            options: isDev
                ? {
                      colorize: true,
                      translateTime: "HH:MM:ss Z",
                      ignore: "pid,hostname",
                  }
                : undefined,
        },
    ],
});

const logger = pino({ level: process.env.LOG_LEVEL ?? "info" }, transport);

export function createLogger(context: string) {
    return logger.child({ context });
}

export default logger;
