"""🧮 Apply reviewed retail-patch facts; stop on a changed patch or absent evidence."""
import datetime,hashlib,html,json,pathlib,re,unicodedata
root=pathlib.Path(__file__).resolve().parents[1]
facts=json.loads((root/'content/patch-facts.json').read_text(encoding='utf-8'))
content=json.loads((root/'src/data/content.json').read_text(encoding='utf-8'))
raw=pathlib.Path('/tmp/owguide-live-patch.html').read_text(encoding='utf-8')
text=' '.join(html.unescape(re.sub('<[^>]+>',' ',raw)).split())
if content['patch']!=facts['patch'] or facts['patch'] not in text: raise SystemExit('Patch identity changed; review facts first.')
heroes={h['id']:h for h in content['heroes']}
def normalize(value):
 return ''.join(c for c in unicodedata.normalize('NFKD',value) if not unicodedata.combining(c)).casefold()
def plain(value):return ' '.join(html.unescape(re.sub('<[^>]+>',' ',value)).split())
# Scope evidence to its hero and ability, excluding the later Stadium item changes.
retail=raw.split('>Hero Hit Volumes<',1)[0]
headers=list(re.finditer(r'<h5 class="PatchNotesHeroUpdate-name">(.*?)</h5>',retail,re.S))
blocks={}
for i,header in enumerate(headers):
 hero_name=normalize(plain(header[1]))
 section=retail[header.end():headers[i+1].start() if i+1<len(headers) else len(retail)]
 for chunk in section.split('<div class="PatchNotesAbilityUpdate">')[1:]:
  title=re.search(r'<div class="PatchNotesAbilityUpdate-name">(.*?)</div>',chunk,re.S)
  if title:blocks.setdefault(hero_name,[]).append((normalize(plain(title[1])),plain(chunk)))
def supported(hero_id,ability_name,excerpt):
 return any(title.startswith(normalize(ability_name)) and excerpt in body for title,body in blocks.get(normalize(heroes[hero_id]['name']),[]))

for row in facts['additionalAbilities']:
 if not supported(row['hero'],row['name'],row['evidence']): raise SystemExit('Missing scoped evidence for '+row['id'])
 hero=heroes[row['hero']]
 if not any(a['id']==row['id'] for a in hero['abilities']):
  hero['abilities'].append({k:row[k] for k in ['id','name','kind','description']}|{'stats':[]})
for row in facts['statistics']:
 ability=next(a for a in heroes[row['hero']]['abilities'] if a['id']==row['ability'])
 if not supported(row['hero'],ability['name'],row['evidence']): raise SystemExit('Missing scoped numeric evidence: '+row['hero']+':'+row['name'])
 stat={k:row[k] for k in ['name','value','unit']}|{'sourceId':'blizzard-live'}
 ability['stats']=[s for s in ability['stats'] if s['name']!=stat['name']]+[stat]
heroes['doctrine']['abilities'][-1]['kind']='ultimate'
# This value is explicitly stated for the newly listed passive in the same patch.
next(a for a in heroes['domina']['abilities'] if a['id']=='reconstruction')['stats']=[{'name':'Ability lifesteal','value':100,'unit':'%','sourceId':'blizzard-live'}]
deadeye=next(a for a in heroes['cassidy']['abilities'] if a['id']=='deadeye')
restriction='Deadeye prevents attaching to Jetpack Cat’s Lifeline on this patch.'
if restriction not in deadeye['description']:deadeye['description']+=' '+restriction
# Current availability of these four maps is explicitly established by this patch.
map_updates={'hollywood':['The current Halloween variant is available through November 3, 2026. Check current visuals before relying on older screenshots.'], 'lijiang-tower':['The current Halloween variant is available through November 3, 2026. Check current visuals before relying on older screenshots.'], 'chateau-guillard':['The current Halloween variant is available through November 3, 2026. Check current visuals before relying on older screenshots.'], 'eichenwalde':['The October 6 patch removed a sightline through a door near the first chokepoint.', 'Attack: do not base an opening on that old door sightline. Check the live doorway from cover before committing.', 'Defense: review the first chokepoint in a custom game. Older door-angle guides may no longer apply.']}
for m in content['maps']:
 if m['id'] in map_updates:
  m['currentVerified']=True
  for note in map_updates[m['id']]:
   if note not in m['notes']:m['notes'].append(note)
  # Availability and the door fix are sourced; a full tactical review is still pending.
  m['review']['sourceId']='blizzard-live'
content['version']=max([content['version'],'0.4.0'],key=lambda v:tuple(map(int,v.split('.'))))
content['generatedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00','Z')
for source in content['sources']:
 if source['id'] in ['blizzard-live','blizzard-roster-live']: source['license']='Factual metadata and original OWGuide summaries only; no game artwork or full source prose redistributed.'
(root/'src/data/content.json').write_text(json.dumps(content,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(root/'content/patch-evidence.json').write_text(json.dumps({'checkedAt':content['generatedAt'],'patch':content['patch'],'url':'https://overwatch.blizzard.com/en-us/news/patch-notes/live/','sha256':hashlib.sha256(raw.encode()).hexdigest(),'statistics':len(facts['statistics'])+1,'additionalAbilities':[a['id'] for a in facts['additionalAbilities']], 'note':'Curated factual values only. No old values or unspecified base values inferred; full guide and map review remains pending.'},indent=2)+'\n',encoding='utf-8')
print('Applied',len(facts['statistics'])+1,'sourced patch values and two additional passives')
