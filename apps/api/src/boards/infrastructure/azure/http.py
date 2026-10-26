"""Headers HTTP comuns das chamadas REST ao Azure DevOps (Bearer OAuth ou Basic com PAT)."""
import base64


class PersonalAccessToken(str):
    """Marca um token como PAT do Azure DevOps: o header usa Basic em vez de Bearer."""


def _authorization(access_token):
    if isinstance(access_token, PersonalAccessToken):
        encoded = base64.b64encode(f':{access_token}'.encode('utf-8')).decode('ascii')
        return f'Basic {encoded}'
    return f'Bearer {access_token}'


def read_headers(access_token):
    return {
        'Authorization': _authorization(access_token),
        'Accept': 'application/json'
    }


def write_headers(access_token, content_type='application/json'):
    return {
        'Authorization': _authorization(access_token),
        'Content-Type': content_type
    }
