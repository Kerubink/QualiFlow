"""Regras de validacao de responsavel (assignee) de Work Items do Azure DevOps.
"""
import re


def is_valid_assignee(value):
    """Valida se value e um identificador valido de assignee no Azure."""
    if not value:
        return False
    trimmed = str(value).strip()
    if not trimmed:
        return False

    email_pattern = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
    domain_user_pattern = r'^[^\\s]+\\[^\\s]+$'

    return bool(re.match(email_pattern, trimmed)) or bool(re.match(domain_user_pattern, trimmed))
