"""
Authentic Indian Sign Language (ISL) Alphabet Specification (A-Z).

Unlike American Sign Language (ASL), which is strictly one-handed,
authentic ISL fingerspelling combines unimanual (one-handed),
bimanual (two-handed), and dynamic motion gestures.
"""

ISL_STATIC_CLASSES = [
    "A", "B", "C", "D", "E", "F", "G", "H", "I",
    "K", "L", "M", "N", "O", "P", "Q", "R", "S",
    "T", "U", "V", "W", "X", "Y"
]

ISL_DYNAMIC_CLASSES = ["J", "Z"]

ISL_ALL_CLASSES = [chr(c) for c in range(ord("A"), ord("Z") + 1)]

# Authentic handedness classification for standard Indian Sign Language
ISL_HAND_MODE = {
    "A": "two-handed",
    "B": "two-handed",
    "C": "one-handed",
    "D": "two-handed",
    "E": "two-handed",
    "F": "two-handed",
    "G": "two-handed",
    "H": "two-handed",
    "I": "one-handed",
    "J": "dynamic",
    "K": "two-handed",
    "L": "one-handed",
    "M": "two-handed",
    "N": "two-handed",
    "O": "one-handed",
    "P": "two-handed",
    "Q": "two-handed",
    "R": "two-handed",
    "S": "two-handed",
    "T": "two-handed",
    "U": "one-handed",
    "V": "one-handed",
    "W": "two-handed",
    "X": "two-handed",
    "Y": "two-handed",
    "Z": "dynamic",
}
