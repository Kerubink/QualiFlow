"""Escolha do site Jira Cloud acessivel apos o login Atlassian. Puro (sem I/O)."""


def pick_jira_site(resources, preferred_domain=None):
    """Escolhe o cloud site correspondente ao dominio configurado (ou o primeiro disponivel)."""
    jira_sites = [r for r in resources if "jira" in (r.get("scopes") or []) or True]

    if preferred_domain:
        normalized = preferred_domain.strip().lower().replace("https://", "").replace("http://", "").rstrip("/")
        for site in jira_sites:
            site_url = str(site.get("url") or "").lower().replace("https://", "").replace("http://", "").rstrip("/")
            if site_url == normalized or normalized in site_url:
                return site

    return jira_sites[0] if jira_sites else None
