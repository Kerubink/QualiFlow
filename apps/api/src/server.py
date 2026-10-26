"""Composition root da API Flask: bootstrap, hooks HTTP e registro dos blueprints de cada contexto."""
import os

from dotenv import load_dotenv
from flask import Flask

load_dotenv()

from .auth.interface.board_login_routes import board_auth_routes
from .auth.interface.github_routes import auth_routes
from .boards.interface.azure_routes import azure_routes
from .boards.interface.jira_routes import jira_routes
from .generation.interface.copilot_routes import copilot_routes
from .generation.interface.routes import scenario_routes
from .observability.interface.routes import ops_routes
from .shared.interface.http_hooks import register_http_hooks
from .shared.runtime_metrics import start_runtime_metrics_logger, stop_runtime_metrics_logger


def create_app():
    flask_app = Flask(__name__)
    register_http_hooks(flask_app)

    for blueprint in (
        auth_routes,
        board_auth_routes,
        azure_routes,
        jira_routes,
        scenario_routes,
        copilot_routes,
        ops_routes,
    ):
        flask_app.register_blueprint(blueprint)

    return flask_app


def _bootstrap():
    metrics_enabled = (os.environ.get("RUNTIME_METRICS_LOG_ENABLED") or "true").strip().lower() != "false"
    try:
        metrics_interval_ms = int(os.environ.get("RUNTIME_METRICS_LOG_INTERVAL_MS", "60000"))
    except ValueError:
        metrics_interval_ms = 60000

    start_runtime_metrics_logger(enabled=metrics_enabled, interval_ms=metrics_interval_ms)


app = create_app()
_bootstrap()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "3000"))
    try:
        app.run(host="0.0.0.0", port=port, threaded=True)
    finally:
        stop_runtime_metrics_logger()
