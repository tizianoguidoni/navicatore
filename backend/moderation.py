import re
from typing import Tuple, List

# Lista nera di esempio (espandibile)
BANNED_WORDS = [
    "bestemmia1", "bestemmia2", "offesa1", "scam", "clickbait",
    "inappropriato", "volgare"
]

# Regex per Email e Numeri di Telefono
EMAIL_REGEX = r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+'
PHONE_REGEX = r'(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4,}'

def validate_message(text: str) -> Tuple[bool, str]:
    """
    Analizza il testo del messaggio e restituisce (is_valid, error_message).
    """
    clean_text = text.lower().strip()

    # 1. Controllo Dati Personali (Email)
    if re.search(EMAIL_REGEX, clean_text):
        return False, "REGOLA_VIOLATA: Dati personali (Email) non consentiti."

    # 2. Controllo Dati Personali (Telefono)
    if re.search(PHONE_REGEX, clean_text):
        return False, "REGOLA_VIOLATA: Dati personali (Telefono) non consentiti."

    # 3. Controllo Linguaggio Offensivo / Bestemmie
    for word in BANNED_WORDS:
        if word in clean_text:
            return False, f"REGOLA_VIOLATA: Linguaggio non consentito."

    # 4. Controllo Lunghezza Minima
    if len(clean_text) < 1:
        return False, "Messaggio troppo corto."

    return True, ""

def sanitize_username(username: str) -> str:
    """Previene injection o nomi offensivi"""
    for word in BANNED_WORDS:
        if word in username.lower():
            return "Driver_Vyro"
    return username
