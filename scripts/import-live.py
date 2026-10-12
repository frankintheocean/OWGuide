"""🧾 Import only factual roster and ability names; keep unavailable details explicit."""
import pathlib,json,re,html,hashlib,datetime
root=pathlib.Path(__file__).resolve().parents[1]
roster_page=pathlib.Path('/tmp/owguide-live-heroes.html').read_text()
patch_page=pathlib.Path('/tmp/owguide-live-patch.html').read_text()
content=json.loads((root/'src/data/content.json').read_text())
stamp=datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00','Z')
patch=next(html.unescape(re.sub('<[^>]+>','',v)).strip() for v in re.findall(r'<h[1-5][^>]*>(.*?)</h[1-5]>',patch_page,re.S) if 'Overwatch Retail Patch Notes' in v)
existing={h['id']:h for h in content['heroes']}; heroes=[];evidence=[]
source={'id':'blizzard-roster-live','url':'https://overwatch.blizzard.com/en-us/heroes/','label':'Official roster and linked hero kit pages; coaching is OWGuide editorial','retrievedAt':stamp,'kind':'official','license':'Names, roles, and ability names only. No images or page prose redistributed.'}
content['sources']=[s for s in content['sources'] if s['id']!='blizzard-roster-live']+[source]
for tag in re.findall(r'<a[^>]*class="hero-card"[^>]*>',roster_page):
 attrs=dict(re.findall(r'([\w-]+)="([^"]*)"',tag));key=attrs['id'];role=attrs['data-role']
 page=pathlib.Path(f'/tmp/owguide-live-heroes/{key}.html').read_text()
 name=html.unescape(re.search(r'<title>Overwatch - Heroes - (.*?)</title>',page).group(1))
 segment=page.split('class="abilities-container"',1)[1].split('</blz-carousel-section>',1)[0]
 h=existing.get(key,{'id':key,'biography':None,'difficulty':None,'playstyle':[],'strengths':[],'weaknesses':[],'attributes':{},'abilities':[],'guides':[]})
 previous_role=h.get('role');old={a['id']:a for a in h['abilities']};abilities=[]
 for a in re.findall(r'<blz-tab-control\s[^>]*>',segment):
  at=dict(re.findall(r'([\w-]+)="([^"]*)"',a));aid=at['id'];prior=old.get(aid,{})
  abilities.append({'id':aid,'name':html.unescape(at['label']).strip(),'description':prior.get('description'),'kind':prior.get('kind','unknown'),'stats':[]})
 h.update(name=name,role=role,abilities=abilities,review={'sourceId':source['id'],'patch':patch,'reviewedAt':None,'confidence':'medium','stale':True})
 # A role rework invalidates old coaching, even if the hero ID is unchanged.
 if key in existing and previous_role!=role:h.update(playstyle=[],strengths=[],weaknesses=[],attributes={},guides=[])
 heroes.append(h);evidence.append({'id':key,'url':f'https://overwatch.blizzard.com/en-us/heroes/{key}/','retrievedAt':stamp,'sha256':hashlib.sha256(page.encode()).hexdigest(),'abilityIds':[a['id'] for a in abilities],'role':role})
content.update(version=content['version'],patch=patch,generatedAt=stamp,liveVerifiedAt=stamp,rosterVerified=True,heroes=sorted(heroes,key=lambda h:h['name']))
# Existing tactical advice remains stale; source capture is not editorial approval.
for collection in ['matchups','synergies','mapFit']:
 for edge in content[collection]:edge['review']['stale']=True
(root/'src/data/content.json').write_text(json.dumps(content,ensure_ascii=False,indent=2)+'\n')
(root/'content/source-evidence.json').write_text(json.dumps({'capturedAt':stamp,'patchTitle':patch,'rosterSha256':hashlib.sha256(roster_page.encode()).hexdigest(),'patchSha256':hashlib.sha256(patch_page.encode()).hexdigest(),'heroPages':evidence,'note':'Official metadata captured. Live balance review of coaching and map rotation remain separate.'},ensure_ascii=False,indent=2)+'\n')
print(f'Imported {len(heroes)} official roster entries for {patch}')
