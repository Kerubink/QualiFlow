"""Serializacao de Test Cases do Azure DevOps: XML de passos, parametros e data source local.

Pura (sem I/O). O escaping XML de steps_to_xml e parte do contrato com o Azure -- preserve-o.
"""
import re


def format_parameters_xml(parameters):
    """Formata parametros para XML de Test Case."""
    if not parameters or len(parameters) == 0:
        return ""
    xml = '<parameters>'
    for name in parameters.keys():
        clean_name = name[1:] if name.startswith('@') else name
        xml += f'<param name="{clean_name}" bind="default"/>'
    xml += '</parameters>'
    return xml


def format_local_data_source_xml(parameters):
    """Formata Data Source local para XML de Test Case."""
    if not parameters or len(parameters) == 0:
        return ""

    clean_params = {}
    for k, v in parameters.items():
        clean_name = k[1:] if k.startswith('@') else k
        clean_params[clean_name] = v or ''

    col_defs = ''.join(
        f'<xs:element name="{name}" type="xs:string" minOccurs="0" />'
        for name in clean_params.keys()
    )

    row_values = ''.join(
        f'<{name}>{val}</{name}>'
        for name, val in clean_params.items()
    )

    return (
        '<NewDataSet>' +
        '<xs:schema id="NewDataSet" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:msdata="urn:schemas-microsoft-com:xml-msdata">' +
        '<xs:element name="NewDataSet" msdata:IsDataSet="true" msdata:Locale="">' +
        '<xs:complexType><xs:choice minOccurs="0" maxOccurs="unbounded">' +
        '<xs:element name="Table1"><xs:complexType><xs:sequence>' +
        col_defs +
        '</xs:sequence></xs:complexType></xs:element>' +
        '</xs:choice></xs:complexType></xs:element>' +
        '</xs:schema>' +
        '<diffgr:diffgram xmlns:msdata="urn:schemas-microsoft-com:xml-msdata" xmlns:diffgr="urn:schemas-microsoft-com:xml-diffgram-v1">' +
        '<NewDataSet><Table1 diffgr:id="Table11" msdata:rowOrder="0">' +
        row_values +
        '</Table1></NewDataSet>' +
        '</diffgr:diffgram>' +
        '</NewDataSet>'
    )


def steps_to_xml(steps_array):
    """Converte array de passos em XML de Test Case do Azure."""
    def escape_xml(unsafe):
        if not unsafe:
            return ''
        unsafe = str(unsafe)
        unsafe = unsafe.replace('&', '&amp;')
        unsafe = unsafe.replace('<', '&lt;')
        unsafe = unsafe.replace('>', '&gt;')
        unsafe = unsafe.replace("'", '&apos;')
        unsafe = unsafe.replace('"', '&quot;')
        return unsafe

    xml = f'<steps id="0" last="{len(steps_array)}">'
    for idx, step in enumerate(steps_array):
        action_text = step.get('action', '')
        if step.get('needs_evidence'):
            action_text = f'📸 [EVIDÊNCIA OBRIGATÓRIA] {action_text}'

        xml += (
            f'\n  <step id="{idx + 1}" type="ValidateStep">'
            f'\n    <parameterizedString isformatted="true">{escape_xml(action_text)}</parameterizedString>'
            f'\n    <parameterizedString isformatted="true">{escape_xml(step.get("expected", ""))}</parameterizedString>'
            f'\n    <description/>'
            f'\n  </step>'
        )
    xml += '</steps>'
    return xml


def parse_test_steps_xml(xml):
    """Parse XML de passos de Test Case extraindo acoes e resultados esperados."""
    if not xml:
        return []

    try:
        steps = []
        step_pattern = r'<step([^>]*?)>([\s\S]*?)<\/step>'
        order = 1

        for step_match in re.finditer(step_pattern, xml, re.IGNORECASE):
            step_attr = step_match.group(1)
            step_content = step_match.group(2)

            id_match = re.search(r'id="([^"]+)"', step_attr, re.IGNORECASE)
            step_id = id_match.group(1) if id_match else str(order)

            strings = []
            string_pattern = r'<parameterizedString[^>]*>([\s\S]*?)<\/parameterizedString>'
            for str_match in re.finditer(string_pattern, step_content, re.IGNORECASE):
                text = re.sub(r'<[^>]+>', '', str_match.group(1)).strip()
                strings.append(text)

            action = strings[0] if len(strings) > 0 else ''
            expected = strings[1] if len(strings) > 1 else ''

            if action:
                steps.append({'order': order, 'stepId': step_id, 'action': action, 'expected': expected})
                order += 1

        return steps
    except Exception:
        return []
