"""🔬 Apply only numeric facts explicitly present in the captured hero's ability section."""
import datetime,hashlib,html,json,pathlib,re
root=pathlib.Path(__file__).resolve().parents[1]
content=json.loads((root/'src/data/content.json').read_text(encoding='utf-8'))
facts=json.loads((root/'content/hero-page-facts.json').read_text(encoding='utf-8'))
capture=json.loads(pathlib.Path('/tmp/owguide-capture.json').read_text(encoding='utf-8'))
heroes={h['id']:h for h in content['heroes']}
records=[]
for hero_id in sorted(set(f['hero'] for f in facts)):
 raw=pathlib.Path(f'/tmp/owguide-live-heroes/{hero_id}.html').read_text(encoding='utf-8')
 section=raw.split('class="abilities-container"',1)[1].split('</blz-carousel-section>',1)[0]
 abilities={}
 for chunk in section.split('<blz-feature slot="slide"')[1:]:
  title=re.search(r'<h3[^>]*>(.*?)</h3>',chunk,re.S)
  description=re.search(r'<p slot="description">(.*?)</p>',chunk,re.S)
  if title and description:abilities[html.unescape(re.sub('<[^>]+>',' ',title[1])).strip()]=' '.join(html.unescape(re.sub('<[^>]+>',' ',description[1])).split())
 source_id=f'blizzard-{hero_id}-kit'
 source={'id':source_id,'url':f'https://overwatch.blizzard.com/en-us/heroes/{hero_id}/','label':heroes[hero_id]['name']+' official kit page','retrievedAt':capture['capturedAt'],'kind':'official','license':'Factual values and original summaries only; no game images or full source prose redistributed.'}
 content['sources']=[s for s in content['sources'] if s['id']!=source_id]+[source]
 for fact in (f for f in facts if f['hero']==hero_id):
  ability=next(a for a in heroes[hero_id]['abilities'] if a['id']==fact['ability'])
  if fact['evidence'] not in abilities.get(ability['name'],''):raise SystemExit('Missing scoped numeric evidence: '+hero_id+':'+ability['name'])
  stat={k:fact[k] for k in ['name','value','unit']}|{'sourceId':source_id}
  ability['stats']=[s for s in ability['stats'] if s['name']!=stat['name']]+[stat]
 records.append({'heroId':hero_id,'sourceId':source_id,'sha256':hashlib.sha256(raw.encode()).hexdigest(),'rawSha256':hashlib.sha256(pathlib.Path(f'/tmp/owguide-live-heroes/{hero_id}.html').read_bytes()).hexdigest()})
content['version']=max([content['version'],'0.5.0'],key=lambda v:tuple(map(int,v.split('.'))))
content['generatedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00','Z')
(root/'src/data/content.json').write_text(json.dumps(content,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(root/'content/hero-fact-evidence.json').write_text(json.dumps({'checkedAt':content['generatedAt'],'patch':content['patch'],'statistics':len(facts),'records':records,'note':'Only explicitly listed values copied; no missing damage, cooldown or baseline values inferred.'},indent=2)+'\n',encoding='utf-8')
print('Applied',len(facts),'explicit hero-page numeric facts')
