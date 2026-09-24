"""Garante que 'src' seja importavel independente do diretorio de onde o pytest e chamado."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
