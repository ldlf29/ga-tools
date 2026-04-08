import time
import keyboard
import pyperclip
import pyautogui
from pathlib import Path

FILES_TXT = Path(__file__).parent / "files.txt"

# ─── CONFIGURACION ────────────────────────────────────────────────
# Tecla del menu contextual para "Copy link address":
#   Chrome  / Edge  (English): 'e'
#   Chrome  / Edge  (Spanish): 'o'  ("Copiar direccion del enlace")
#   Firefox (English): 'a'
COPY_LINK_KEY = 'e'
# ──────────────────────────────────────────────────────────────────

pyautogui.PAUSE = 0  # Sin pausas adicionales de pyautogui

print("Listener activo. Pone el mouse sobre un link y apreta ESPACIO.")
print(f"El link se guardara en: {FILES_TXT}")
print("ESC para salir.\n")

def capture_hovered_link():
    x, y = pyautogui.position()

    # Guardar clipboard actual para restaurarla despues
    old_clipboard = ""
    try:
        old_clipboard = pyperclip.paste()
    except Exception:
        pass

    # Limpiar clipboard para detectar si se copio algo nuevo
    try:
        pyperclip.copy("")
    except Exception:
        pass

    # Clic derecho en la posicion actual
    pyautogui.rightClick(x, y)
    time.sleep(0.25)

    # Presionar la tecla del menu (segun navegador/idioma)
    keyboard.send(COPY_LINK_KEY)
    time.sleep(0.15)

    # Cerrar cualquier menu contextual que haya quedado abierto
    keyboard.send('esc')
    time.sleep(0.1)

    # Leer el link copiado
    link = ""
    try:
        link = pyperclip.paste().strip()
    except Exception:
        pass

    if link.startswith("http"):
        with open(FILES_TXT, "a", encoding="utf-8") as f:
            f.write(link + "\n")
        print(f"  [OK] {link}")
    else:
        print(f"  [SKIP] No es un link (hover sobre un elemento sin href?): {repr(link[:80])}")
        # Restaurar clipboard original si no se consiguio nada
        try:
            pyperclip.copy(old_clipboard)
        except Exception:
            pass

# Registrar el hotkey — suprimir el espacio para que no tipee en la pantalla
keyboard.add_hotkey('space', capture_hovered_link, suppress=True)

try:
    keyboard.wait('esc')
except KeyboardInterrupt:
    pass

print("\nListener detenido.")
