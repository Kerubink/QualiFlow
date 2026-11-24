from src.boards.infrastructure.azure.test_runs import build_result_update_body


def test_body_sem_duracao_mantem_formato_anterior():
    body = build_result_update_body(7, 'Passed', 'ok', [{'stepId': 2, 'outcome': 'Passed', 'comment': ''}])
    assert body == [{
        'id': 7,
        'outcome': 'Passed',
        'comment': 'ok',
        'state': 'Completed',
        'iterationDetails': [{
            'id': 1,
            'actionResults': [{
                'stepIdentifier': '2',
                'actionPath': '00000002',
                'iterationId': 1,
                'outcome': 'Passed',
                'errorMessage': ''
            }],
            'outcome': 'Passed'
        }]
    }]


def test_duracao_total_e_por_passo_sao_enviadas():
    body = build_result_update_body(
        7, 'Failed', None,
        [{'stepId': 1, 'outcome': 'Failed', 'comment': 'x', 'durationMs': 1500}],
        duration_ms=42000,
    )
    entry = body[0]
    assert entry['durationInMs'] == 42000
    assert entry['iterationDetails'][0]['durationInMs'] == 42000
    assert entry['iterationDetails'][0]['actionResults'][0]['durationInMs'] == 1500


def test_duracao_invalida_e_ignorada():
    for bad in (None, -1, 'abc', True, float('nan')):
        body = build_result_update_body(1, 'Passed', None, None, duration_ms=bad)
        assert 'durationInMs' not in body[0]


def test_duracao_sem_passos_vai_so_no_resultado():
    body = build_result_update_body(1, 'Passed', None, None, duration_ms=900)
    assert body[0]['durationInMs'] == 900
    assert 'iterationDetails' not in body[0]
