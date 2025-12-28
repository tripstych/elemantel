import os
import requests
import json

url =  "http://127.0.0.1:5000/translate?word=WORD"


def fetch_translation(word):
    response = requests.get(url.replace("WORD", word))
    return response.json()

files = {
    'armors':'64-armors.json',
    'weapons':'64-melee-weapons.json',
    'weapons':'64-ranged-weapons.json',
    'spells':'64-attack-spells.json',
    'spells':'64-defense-spells.json'
}

#{'griffon_riders_lance.n.01': {'alias': "Griffon Rider's Lance", 'definition': "Griffon Rider's Lance", 'derived': False, 'origin': {'earth': 20, 'fire': 15, 'metal': 6, 'water': 10, 'wood': 15}, 'word': 'lemwo'}}

dic = json.load(open("elemental_dictionary.json"))


dict = {}
for type in files:
    name = files[type]
    fp = open(name,'r')
    data = json.load(fp)
    for thing in data:
        word = thing['name']
        item = fetch_translation(word)
        key = list(item)[0]
        dict[key] = item[key]
        dict[key]['item'] = thing
        dict[key]['type'] = type
        print('key',key, item)

for key in dict:
    if not dict[key].get('type'):
        dict[key]['type'] = 'word'

json.dump(dict, open("built_items_dictionary.json","w"))