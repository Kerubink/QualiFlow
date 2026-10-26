"""Regras de Issues do Jira usadas pela integracao de test cases. Puro (sem I/O)."""


def is_likely_test_issue(issue, test_issue_type):
    """Verifica se issue provavelmente eh um test case."""
    expected_type = (test_issue_type or 'Task').lower()
    issue_type = str(issue.get('fields', {}).get('issuetype', {}).get('name', '')).lower()
    labels = [str(l).lower() for l in issue.get('fields', {}).get('labels', [])]

    return issue_type == expected_type or 'qualiflow' in labels or 'automated-test' in labels


def build_test_case_description(scenario):
    """Monta o texto da descricao de um test case: BDD + passos numerados (acao | esperado)."""
    steps = scenario.get('steps', [])
    step_lines = [
        f'{idx + 1}. Acao: {s.get("action", "")} | Esperado: {s.get("expected", "")}'
        for idx, s in enumerate(steps)
    ]
    return f'{scenario.get("bdd_description", "")}\n\nPassos do Teste:\n{chr(10).join(step_lines)}'.strip()
