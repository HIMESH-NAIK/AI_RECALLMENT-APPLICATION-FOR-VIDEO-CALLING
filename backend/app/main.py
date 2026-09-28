"""
FastAPI Application Entry Point
================================
Connects the local AI Agent with self-hosted Hindsight Memory.
Mounts API routes and serves the frontend chat interface.
"""

import os
import logging
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles

from backend.app.config import settings
from backend.app.routes.api import router as api_router
from backend.app.routes.rooms import router as rooms_router

# Setup logging
logging.basicConfig(
    level=logging.INFO if settings.DEBUG else logging.WARNING,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("agent_backend")

# Initialize FastAPI application
app = FastAPI(
    title="Local AI Agent + Self-Hosted Hindsight Memory",
    description="Backend connecting a local LLM (Ollama) with self-hosted persistent memory (Hindsight)",
    version="1.0.0"
)

# Allow the configured frontend origins.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API endpoints under /api
app.include_router(api_router)
app.include_router(rooms_router)

# Resolve path to frontend assets
FRONTEND_DIR = Path(__file__).resolve().parent.parent.parent / "frontend"
DIST_DIR = FRONTEND_DIR / "dist"
DIST_INDEX = DIST_DIR / "index.html"
DEV_INDEX = FRONTEND_DIR / "index.html"

# Serve built production assets if available
if (DIST_DIR / "assets").exists():
    app.mount("/assets", StaticFiles(directory=str(DIST_DIR / "assets")), name="assets")

if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")


def _get_spa_index():
    if DIST_INDEX.exists():
        return FileResponse(DIST_INDEX)
    if DEV_INDEX.exists():
        return FileResponse(DEV_INDEX)
    return JSONResponse({"status": "Backend running. Frontend index.html not found."})


@app.get("/", include_in_schema=False)
async def serve_index():
    """Serves the frontend application directly from the root path."""
    return _get_spa_index()


@app.get("/{full_path:path}", include_in_schema=False)
async def serve_spa_route(full_path: str):
    """Enables client-side SPA routing for routes such as /meeting/{room_id}."""
    if full_path.startswith(("api/", "api", "docs", "openapi.json", "redoc")):
        return JSONResponse(status_code=404, content={"detail": "Not Found"})
    dist_file = DIST_DIR / full_path
    if dist_file.is_file():
        return FileResponse(dist_file)
    return _get_spa_index()


# Global Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception at {request.url}: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {str(exc)}"}
    )


@app.on_event("startup")
async def startup_event():
    logger.info("=" * 70)
    logger.info("🚀 Local AI Agent + Self-Hosted Hindsight Memory Backend Started")
    logger.info(f"API Docs: http://{settings.APP_HOST}:{settings.server_port}/docs")
    logger.info(f"🧠 Hindsight Memory URL: {settings.HINDSIGHT_URL}")
    logger.info(f"🤖 LLM Provider: {settings.LLM_PROVIDER} (Model: {settings.LLM_MODEL})")
    logger.info("=" * 70)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend.app.main:app",
        host="0.0.0.0",
        port=settings.server_port,
        reload=settings.DEBUG
    )
