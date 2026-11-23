#!/bin/bash
# Deploys one version of CloudOps Hub on the dev server (task A4).
#
# Run by .github/workflows/deploy.yml through SSM Run Command, as root:
#   bash infra/scripts/deploy.sh <new-image-tag> <previous-git-commit>
# The caller has already checked out the new commit in /opt/cloudopshub.
#
# Pulls the new images from ECR, restarts, and waits until both containers are healthy.
# If they aren't, it puts the previous version back, so a failed deploy never leaves the site down.
set -uo pipefail
export PATH="$PATH:/snap/bin" # aws CLI is a snap on Ubuntu

NEW_TAG="$1"
PREV_COMMIT="$2"
APP_DIR=/opt/cloudopshub
ENV_FILE="$APP_DIR/infra/.env"
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

REGISTRY="$(grep '^REGISTRY=' "$ENV_FILE" | cut -d= -f2)"
PREV_TAG="$(grep '^IMAGE_TAG=' "$ENV_FILE" | cut -d= -f2)"
REGION="$(echo "$REGISTRY" | cut -d. -f4)" # <account>.dkr.ecr.<region>.amazonaws.com

set_tag() { sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=$1/" "$ENV_FILE"; }

healthy() {
  # Up to 2 minutes: backend health check passes and nginx serves the site
  local backend frontend
  for _ in $(seq 1 24); do
    backend="$(docker inspect -f '{{.State.Health.Status}}' cloudops-backend 2>/dev/null)"
    frontend="$(curl -s -o /dev/null -w '%{http_code}' http://localhost/)"
    [ "$backend" = "healthy" ] && [ "$frontend" = "200" ] && return 0
    sleep 5
  done
  echo "health check failed (backend=$backend, frontend=$frontend)"
  return 1
}

cd "$APP_DIR/infra" || exit 1
echo "Deploying $NEW_TAG (previous: $PREV_TAG)"

aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$REGISTRY"

set_tag "$NEW_TAG"
if $COMPOSE pull backend frontend && $COMPOSE up -d --no-build && healthy; then
  docker image prune -af >/dev/null # old images stay in ECR for rollbacks; free the server's disk
  echo "DEPLOYED $NEW_TAG"
  exit 0
fi

echo "Deploy of $NEW_TAG failed: rolling back to $PREV_TAG ($PREV_COMMIT)"
cd "$APP_DIR" && git checkout -q --force "$PREV_COMMIT"
cd "$APP_DIR/infra" || exit 1
set_tag "$PREV_TAG"
if [ "$PREV_TAG" = "local" ]; then
  $COMPOSE up -d --build
else
  $COMPOSE pull backend frontend && $COMPOSE up -d --no-build
fi

if healthy; then
  echo "ROLLED BACK to $PREV_TAG"
else
  echo "ROLLBACK ALSO UNHEALTHY: check the server (docker compose logs)"
fi
exit 1
