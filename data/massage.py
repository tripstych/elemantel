import random
from nltk.corpus import wordnet as wn
import json

def lowerkey(data):
    fix = {}
    for k in data:
        fix[k.lower()] = data[k]
    return fix

def org():
    o = {}
    d = ['earth','air','fire','water']
    for s in d:
        o[s] = random.randint(10,52)
    return o


dc = json.load(open("elemental_dictionary.json"))

game_objects = json.load( open("language_objects.json","r"))
spell_objects = json.load( open("language_spells.json","r"))

for object in game_objects:
    if dc.get(object['synset']):
        dc[object['synset']]['weight'] = object['weight']
        dc[object['synset']]['type'] = object['type']
        dc[object['synset']]['material'] = object['material']
        dc[object['synset']]['definition'] = object['definition']
        # print(dc[object['synset']])

for spell in spell_objects:
    obj = spell_objects[spell]
    if dc.get(spell):
        dc[spell]['spell_effect'] = obj['spell_effect']
        dc[spell]['description'] = obj['spell_effect']['description']
        # print(spell)


game_objects = {}
spell_objects = {}
types = {}
for item in dc:
    if 'spell_effect' in dc[item]:
        spell_objects[item] = dc[item]
    if 'type' in dc[item]:
        type =  dc[item]['type']
        types[type] = types[type] if type in types else []
        types[type].append(item)


for type in types.keys():
    f = open(f"item_{type}_synsets.json","w")
    json.dump(types[type],f)
    # print(type,types[type][:6])



melee = json.load(open("json/simpleMeleeWeapons.json"))
martial = json.load(open("json/martialMeleeWeapons.json"))

found = []
for weap in melee:
    name = weap['Name']
    sn = wn.synsets(name)
    if sn == []:
        ss = f"{name.lower()}.n.01"
    else:
        ss = sn[0].name()
    if dc.get(ss):
        weight = float(weap['Weight'].split(' ')[0])*453.5
        del weap['Weight']
        weap['properties'] = [w.lower() for w in weap['Properties']]
        dc[ss]['weight'] = weight
        dc[ss]['weapon_effect'] = lowerkey(weap)
        dc[ss]['origin'] = org()
            # print(dc[hm])

for weap in martial:
    name = weap['Name']
    sn = wn.synsets(name)
    if sn == []:
        ss = f"{name.lower()}.n.01"
    else:
        ss = sn[0].name()
    if dc.get(ss):
        weight = float(weap['Weight'].split(' ')[0])*453.5
        del weap['Weight']
        weap['properties'] = [w.lower() for w in weap['Properties']]
        dc[ss]['weight'] = weight
        dc[ss]['weapon_effect'] = lowerkey(weap)
        dc[ss]['origin'] = org()



# print(f"{len(found)}/{len(melee)+len(martial)}")
json.dump(dc, open("rebuild_dictionary.json","w"),indent=3)