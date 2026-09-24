"""Registro central de prompts.

Ponto unico de entrada para renderizar os prompts enviados a modelos de IA. O conteudo dos
prompts (instrucoes, regras de formatacao, exemplos) vive em arquivos versionados no git em
vez de strings hardcoded em Python:

- prompts/system/*.j2      -> um template Jinja2 por prompt (o "system prompt" completo).
- prompts/fragments/*.j2   -> blocos de instrucao reutilizados por mais de um prompt
                               (ex.: "responda so JSON", regras de Gherkin), incluidos via
                               `{% include %}` nos templates de prompts/system.
- prompts/schemas/*.json   -> um JSON Schema por formato de saida esperado do modelo. Cada
                               schema traz um bloco "examples" que e a MESMA fonte usada para
                               ilustrar o formato dentro do prompt (schema_example) e para
                               validar a resposta do modelo (validate_against_schema) -- assim
                               o exemplo mostrado ao modelo nunca diverge do que de fato e
                               validado.

Alterar o texto/regras de um prompt e portanto uma mudanca de conteudo (editar um .j2), nao
uma mudanca de codigo Python.
"""
import json
from pathlib import Path
from threading import Lock

from jinja2 import Environment, FileSystemLoader, StrictUndefined, TemplateNotFound
from jsonschema import ValidationError
from jsonschema import validate as _jsonschema_validate

_PROMPTS_DIR = Path(__file__).resolve().parent.parent.parent / "prompts"
_SCHEMAS_DIR = _PROMPTS_DIR / "schemas"

_env = Environment(
    loader=FileSystemLoader(str(_PROMPTS_DIR)),
    undefined=StrictUndefined,
    trim_blocks=True,
    lstrip_blocks=True,
    keep_trailing_newline=True,
)
_env.filters["tojson"] = lambda value, indent=2: json.dumps(value, ensure_ascii=False, indent=indent)

_schema_cache = {}
_schema_cache_lock = Lock()


def render(template_name, **variables):
    """Renderiza prompts/<template_name> (ex.: 'system/qa_generator.j2') com as variaveis dadas.

    Levanta RuntimeError se o template nao existir ou se faltar alguma variavel que o template
    espera (StrictUndefined) -- preferimos falhar cedo a mandar um prompt com buraco pro modelo.
    """
    try:
        template = _env.get_template(template_name)
    except TemplateNotFound as error:
        raise RuntimeError(f"Prompt template nao encontrado: {template_name}") from error

    return template.render(**variables).strip()


def load_schema(schema_name):
    """Carrega (com cache em memoria) prompts/schemas/<schema_name>."""
    if schema_name in _schema_cache:
        return _schema_cache[schema_name]

    with _schema_cache_lock:
        if schema_name in _schema_cache:
            return _schema_cache[schema_name]

        schema_path = _SCHEMAS_DIR / schema_name
        schema = json.loads(schema_path.read_text(encoding="utf-8"))
        _schema_cache[schema_name] = schema
        return schema


def schema_example(schema_name, index=0):
    """Retorna o N-esimo exemplo declarado em 'examples' do schema.

    Usado para montar a secao "formato esperado" dentro do prompt sem duplicar a estrutura
    manualmente -- o schema e a unica fonte de verdade do formato.
    """
    schema = load_schema(schema_name)
    examples = schema.get("examples") or []
    if not examples:
        raise RuntimeError(f"Schema '{schema_name}' nao possui 'examples' para ilustrar o prompt.")
    if index >= len(examples):
        raise RuntimeError(f"Schema '{schema_name}' nao possui example de indice {index}.")
    return examples[index]


def validate_against_schema(schema_name, data):
    """Valida `data` (normalmente a resposta ja parseada do modelo) contra o schema nomeado.

    Levanta RuntimeError com prefixo 'invalid_json_response' em caso de falha -- esse prefixo e
    reconhecido por classify_copilot_error, que ja mapeia esse texto pro codigo de erro
    COPILOT_INVALID_JSON_RESPONSE (HTTP 502) usado pelas rotas.
    """
    schema = load_schema(schema_name)
    try:
        _jsonschema_validate(instance=data, schema=schema)
    except ValidationError as error:
        location = "/".join(str(part) for part in error.absolute_path) or "<raiz>"
        raise RuntimeError(f"invalid_json_response: campo '{location}': {error.message}") from error
