#!/bin/bash

# Quick Start Script for Commons Hub Brussels
# This script helps you set up and run the application quickly

set -e

echo "================================================"
echo "Commons Hub Brussels - Quick Start"
echo "================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠ .env file not found${NC}"
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo -e "${GREEN}✓ .env file created${NC}"
    echo ""
    echo -e "${YELLOW}Please edit .env and add your API keys before continuing!${NC}"
    echo "Press any key to continue once you've configured .env..."
    read -n 1 -s
    echo ""
fi

# Check if docker-compose.yml exists
if [ ! -f docker-compose.yml ]; then
    echo "Creating docker-compose.yml from example..."
    cp docker-compose.yml.example docker-compose.yml
    echo -e "${GREEN}✓ docker-compose.yml created${NC}"
    echo ""
fi

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}✗ Docker is not running${NC}"
    echo "Please start Docker and try again."
    exit 1
fi

echo -e "${GREEN}✓ Docker is running${NC}"
echo ""

# Ask what to do
echo "What would you like to do?"
echo "1) Build and start the application (fresh build)"
echo "2) Start existing container"
echo "3) Fetch recent data only (fast)"
echo "4) Fetch all historical data (slow)"
echo "5) Full setup (build + fetch recent data)"
echo "6) Stop and remove containers"
echo ""
read -p "Enter choice [1-6]: " choice

case $choice in
    1)
        echo ""
        echo "Building and starting the application..."
        docker compose -f docker-compose.yml up -d --build
        echo ""
        echo -e "${GREEN}✓ Application built and started${NC}"
        echo "Access the website at: http://localhost:3000"
        echo ""
        echo "Next step:"
        echo "Fetch data with: docker compose -f docker-compose.yml run --rm chbcli chb sync"
        ;;
    2)
        echo ""
        echo "Starting existing container..."
        docker compose -f docker-compose.yml up -d
        echo ""
        echo -e "${GREEN}✓ Application started${NC}"
        echo "Access the website at: http://localhost:3000"
        ;;
    3)
        echo ""
        echo "Fetching recent data (current and previous month)..."
        echo "This automatically generates all aggregated data files."
        docker compose -f docker-compose.yml run --rm chbcli chb sync
        echo ""
        echo -e "${GREEN}✓ Recent data fetched and processed${NC}"
        ;;
    4)
        echo ""
        echo -e "${YELLOW}⚠ This will take 15-60 minutes on first run${NC}"
        read -p "Continue? (y/n): " confirm
        if [ "$confirm" = "y" ]; then
            echo ""
            echo "Fetching all historical data..."
            echo "This automatically generates all aggregated data files."
            docker compose -f docker-compose.yml run --rm chbcli chb sync --history
            echo ""
            echo -e "${GREEN}✓ All historical data fetched and processed${NC}"
        fi
        ;;
    5)
        echo ""
        echo "Performing full setup..."
        echo "1/3 Building and starting..."
        docker compose -f docker-compose.yml up -d --build

        echo ""
        echo "2/3 Waiting for container to be ready..."
        sleep 10

        echo ""
        echo "3/3 Fetching recent data and generating views..."
        docker compose -f docker-compose.yml run --rm chbcli chb sync

        echo ""
        echo -e "${GREEN}✓ Full setup complete!${NC}"
        echo ""
        echo "================================================"
        echo "🎉 Your site is ready!"
        echo "================================================"
        echo ""
        echo "Access the website at: http://localhost:3000"
        echo ""
        echo "Useful commands:"
        echo "  - View logs:        docker compose -f docker-compose.yml logs -f web"
        echo "  - Enter web shell:  docker exec -it commonshub-web sh"
        echo "  - Stop:             docker compose -f docker-compose.yml down"
        echo "  - Fetch more data:  docker compose -f docker-compose.yml run --rm chbcli chb sync --history"
        ;;
    6)
        echo ""
        echo "Stopping and removing containers..."
        docker compose -f docker-compose.yml down
        echo ""
        echo -e "${GREEN}✓ Containers stopped and removed${NC}"
        ;;
    *)
        echo ""
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""
echo "================================================"
echo "For more information, see docs/deployment.md"
echo "================================================"
