.PHONY: up down logs clean

up:
	docker-compose up -d
	@echo "✅ Services running at http://localhost:5678 (n8n) and http://localhost:3000 (WAHA)"

down:
	docker-compose down

logs:
	docker-compose logs -f

clean:
	docker-compose down -v
	@echo "✅ All containers and volumes removed"

ps:
	docker-compose ps
