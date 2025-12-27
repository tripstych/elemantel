import json

dc = json.load(open("elemental_dictionary.json"))

game_objects = {}
spell_objects = {}
for item in dc:
    if 'spell_effect' in dc[item]:
        print(item)
        spell_objects[item] = dc[item]
    if 'weight' in dc[item]:
        print(dc[item])
        game_objects[item] = dc[item]

print('spell_effect' in dc['fireball.n.01'])

json.dump(game_objects, open("language_objects.json","w"),indent=3)
json.dump(spell_objects, open("language_spells.json","w"),indent=3)
    