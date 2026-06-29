SHELL := /bin/sh

.PHONY: setup infra dev web check validate

setup:
	@if [ ! -f .env ]; then cp .env.example .env; fi
	corepack pnpm install

infra:
	docker compose up -d postgres rabbitmq

dev:
	corepack pnpm dev

web:
	corepack pnpm dev:admin

check:
	corepack pnpm validate

validate:
	corepack pnpm format
	corepack pnpm validate
