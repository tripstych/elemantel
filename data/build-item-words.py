import sys
import subprocess


word = "broadsword"
arg = f"D:\Python\Python312\python.exe F:\glotblocks\conlang_build_one_word.py  --word {word} --language elemental --seed 42"
result = subprocess.run(arg, capture_output=True, text=True)
print(result.stdout)
