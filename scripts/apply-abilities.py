"""📖 Apply original mechanic summaries only when captured official ability names still match."""
import datetime, hashlib, html, json, pathlib, re
root=pathlib.Path(__file__).resolve().parents[1]
content=json.loads((root/'src/data/content.json').read_text())
summaries=json.loads((root/'content/ability-summaries.json').read_text())
records=[]
for hero in content['heroes']:
 page=pathlib.Path('/tmp/owguide-live-heroes')/(hero['id']+'.html')
 raw=page.read_text()
 section=raw.split('class="abilities-container"',1)[1].split('</blz-carousel-section>',1)[0]
 names=[html.unescape(dict(re.findall(r'([\w-]+)="([^"]*)"',tag))['label']).strip() for tag in re.findall(r'<blz-tab-control\s[^>]*>',section)]
 if names != [a['name'] for a in hero['abilities']]: raise SystemExit('Official ability names changed: '+hero['id'])
 rows=summaries[hero['id']]
 if len(rows)!=len(names): raise SystemExit('Incomplete original summary: '+hero['id'])
 for ability,row in zip(hero['abilities'],rows):
  kind,description=row.split('|',1)
  if kind not in ['weapon','ability','passive','ultimate','unknown']: raise SystemExit('Invalid kind')
  ability.update(kind=kind,description=description)
 records.append({'heroId':hero['id'],'url':f"https://overwatch.blizzard.com/en-us/heroes/{hero['id']}/",'sha256':hashlib.sha256(raw.encode()).hexdigest(),'abilities':[a['id'] for a in hero['abilities']]})
content['version']='0.3.0'
content['generatedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00','Z')
(root/'src/data/content.json').write_text(json.dumps(content,ensure_ascii=False,indent=2)+'\n')
(root/'content/ability-evidence.json').write_text(json.dumps({'checkedAt':content['generatedAt'],'patch':content['patch'],'review':'OWGuide source-based editorial summary; no numeric balance claims; unknown classifications remain explicit. Coaching and matchups require separate review.','heroPages':records},indent=2)+'\n')
print('Applied original mechanic summaries to',sum(len(h['abilities']) for h in content['heroes']),'abilities')
