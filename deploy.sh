#!/usr/bin/env bash
# Common Docker Compose deployment helpers for flowMesh.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

COMPOSE=(docker compose)
APP_SERVICES=(flowmesh-api flowmesh-payment-worker flowmesh-shipment-worker)

DO_PULL=false
DO_BUILD=true
DO_UP=true
DO_RESTART=false
DO_RECREATE=false
DO_MIGRATE=false
DO_SEED=false
DO_DOWN=false
DO_LOGS=false
DO_STATUS=false
MIGRATE_ONLY=false
BUILD_ONLY=false

usage() {
    cat <<'EOF'
Usage: ./deploy.sh [options]

Default (no flags): rebuild app images and start/update the full stack.

Options:
  --pull           git pull latest code before deploying
  --build          rebuild app service images (default)
  --no-build       skip image rebuild
  --up             start/update containers (default)
  --no-up          skip docker compose up
  --restart        restart app containers without rebuilding
  --recreate       force-recreate containers (use after port/env/compose changes)
  --migrate        run `prisma migrate deploy` after the API is up
  --migrate-only   run migrations only (no build/up)
  --seed           seed the product catalog after migrate/up
  --down           stop and remove containers (keeps volumes)
  --logs           follow logs for app services
  --status         show container status
  --build-only     build app images and exit
  -h, --help       show this help

Examples:
  ./deploy.sh                          # redeploy after a code push
  ./deploy.sh --pull --migrate         # pull, rebuild, up, migrate
  ./deploy.sh --recreate               # apply compose/port/env changes
  ./deploy.sh --restart                # quick restart, no rebuild
  ./deploy.sh --migrate-only           # run pending migrations only
  ./deploy.sh --down                   # stop the stack
EOF
}

log() {
    printf '==> %s\n' "$*"
}

die() {
    printf 'Error: %s\n' "$*" >&2
    exit 1
}

compose() {
    "${COMPOSE[@]}" "$@"
}

service_is_running() {
    local service="$1"
    compose ps --status running --services "$service" 2>/dev/null | grep -qx "$service"
}

wait_for_postgres() {
    local attempt=1
    local max_attempts=30

    log "Waiting for postgres..."
    until compose exec -T postgres pg_isready -U postgres -d flowmesh >/dev/null 2>&1; do
        if (( attempt >= max_attempts )); then
            die "postgres did not become ready in time"
        fi
        sleep 2
        attempt=$((attempt + 1))
    done
}

wait_for_api_ready() {
    local attempt=1
    local max_attempts=30

    log "Waiting for API readiness..."
    until compose exec -T flowmesh-api node -e \
        "fetch('http://127.0.0.1:5555/ready').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))" \
        >/dev/null 2>&1; do
        if (( attempt >= max_attempts )); then
            die "flowmesh-api did not become ready in time"
        fi
        sleep 2
        attempt=$((attempt + 1))
    done
}

run_migrate() {
    if ! service_is_running flowmesh-api; then
        die "flowmesh-api is not running; start the stack first or omit --migrate-only"
    fi

    wait_for_postgres
    wait_for_api_ready
    log "Running database migrations..."
    compose exec -T flowmesh-api npx prisma migrate deploy
}

run_seed() {
    if ! service_is_running flowmesh-api; then
        die "flowmesh-api is not running; start the stack first"
    fi

    wait_for_postgres
    log "Seeding product catalog..."
    compose exec -T flowmesh-api yarn db:seed
}

build_app_images() {
    log "Building app images..."
    compose build "${APP_SERVICES[@]}"
}

start_stack() {
    local up_args=(-d)

    if $DO_RECREATE; then
        up_args+=(--force-recreate)
    fi

    log "Starting/updating stack..."
    compose up "${up_args[@]}"
}

restart_app_services() {
    log "Restarting app services..."
    compose restart "${APP_SERVICES[@]}"
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --pull)
            DO_PULL=true
            ;;
        --build)
            DO_BUILD=true
            ;;
        --no-build)
            DO_BUILD=false
            ;;
        --up)
            DO_UP=true
            ;;
        --no-up)
            DO_UP=false
            ;;
        --restart)
            DO_RESTART=true
            DO_BUILD=false
            ;;
        --recreate)
            DO_RECREATE=true
            ;;
        --migrate)
            DO_MIGRATE=true
            ;;
        --migrate-only)
            MIGRATE_ONLY=true
            DO_BUILD=false
            DO_UP=false
            DO_MIGRATE=true
            ;;
        --seed)
            DO_SEED=true
            ;;
        --down)
            DO_DOWN=true
            DO_BUILD=false
            DO_UP=false
            ;;
        --logs)
            DO_LOGS=true
            DO_BUILD=false
            DO_UP=false
            ;;
        --status)
            DO_STATUS=true
            DO_BUILD=false
            DO_UP=false
            ;;
        --build-only)
            BUILD_ONLY=true
            DO_UP=false
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            die "unknown option: $1 (use --help)"
            ;;
    esac
    shift
done

if $DO_PULL; then
    if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
        log "Pulling latest code..."
        git pull --ff-only
    else
        die "--pull requires a git repository"
    fi
fi

if $DO_DOWN; then
    log "Stopping stack..."
    compose down
    exit 0
fi

if $DO_STATUS; then
    compose ps
    exit 0
fi

if $DO_LOGS; then
    compose logs -f "${APP_SERVICES[@]}"
    exit 0
fi

if $DO_BUILD; then
    build_app_images
fi

if $BUILD_ONLY; then
    exit 0
fi

if $DO_RESTART; then
    restart_app_services
elif $DO_UP; then
    start_stack
fi

if $DO_MIGRATE; then
    run_migrate
fi

if $DO_SEED; then
    run_seed
fi

if ! $MIGRATE_ONLY && ($DO_BUILD || $DO_UP || $DO_RESTART); then
    log "Deploy complete"
    compose ps "${APP_SERVICES[@]}"
fi
