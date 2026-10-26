"""Composition root da API Flask: bootstrap, hooks HTTP e registro dos blueprints de cada contexto."""
import logging
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
from .auth.container import login_service
from .generation.container import copilot_service
from .shared.interface.http_hooks import register_http_hooks
from .shared.log import log
from .shared.runtime_metrics import start_runtime_metrics_logger, stop_runtime_metrics_logger


def create_app():
    flask_app = Flask(__name__)
    # O log de acesso proprio (shared/interface/http_hooks.py) ja registra cada requisicao com usuario e duracao.
    logging.getLogger("werkzeug").setLevel(logging.WARNING)
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

    oauth = login_service.github_oauth_config()
    log(
        "servidor",
        "QualiFlow API iniciada",
        oauth_github="configurado" if oauth.get("configured") else "NAO configurado (veja GITHUB_OAUTH_* no .env)",
        copilot=copilot_service.get_status().get("mode"),
        ambiente=os.environ.get("FLASK_ENV") or "production",
    )


app = create_app()
_bootstrap()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "3000"))
    # Uso local: escuta so em 127.0.0.1 por padrao (nao expoe a API/sessoes na rede). Defina HOST=0.0.0.0 para abrir.
    host = (os.environ.get("HOST") or "127.0.0.1").strip()
    try:
        app.run(host=host, port=port, threaded=True)
    finally:
        stop_runtime_metrics_logger()
