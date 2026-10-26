"""Criterios de aceite: limpeza de HTML, tokenizacao e extracao da lista de criterios. Puro (sem I/O).
"""
import re
import unicodedata


def strip_html(raw_input):
    text = str(raw_input or "")
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<li[^>]*>", "\n- ", text, flags=re.IGNORECASE)
    text = re.sub(r"</li>", "", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"&nbsp;", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"&amp;", "&", text, flags=re.IGNORECASE)
    text = re.sub(r"&lt;", "<", text, flags=re.IGNORECASE)
    text = re.sub(r"&gt;", ">", text, flags=re.IGNORECASE)
    text = text.replace("\r", "")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def tokenize_basic(text):
    normalized = unicodedata.normalize("NFD", str(text or "").lower())
    normalized = "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")
    normalized = re.sub(r"[^a-z0-9\s]", " ", normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return normalized


RTM_STOPWORDS = {
    "para", "com", "sem", "dos", "das", "que", "uma", "como", "deve", "dever", "quando",
    "entao", "dado", "este", "esta", "pelo", "pela", "sobre", "entre", "apos", "antes",
}


def tokenize_for_rtm(text):
    clean = tokenize_basic(text)
    return [word for word in clean.split(" ") if len(word) >= 4 and word not in RTM_STOPWORDS]


def parse_criteria_lines(text, min_length):
    plain = strip_html(text)
    lines = [line.strip() for line in plain.split("\n") if line.strip()]
    lines = [re.sub(r"^[-*]\s*", "", line) for line in lines]

    criteria = []
    for line in lines:
        numbered = re.match(r"^\d+[.)]\s+", line)
        if numbered:
            criteria.append(re.sub(r"^\d+[.)]\s+", "", line).strip())
            continue
        if len(line) > min_length:
            criteria.append(line)

    seen = set()
    unique = []
    for item in criteria:
        if item not in seen:
            seen.add(item)
            unique.append(item)
    return unique[:40]


def parse_acceptance_criteria(acceptance_criteria):
    return parse_criteria_lines(acceptance_criteria, min_length=14)
