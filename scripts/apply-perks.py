"""🪄 Add attributed perk facts from hash-verified official hero captures."""
import argparse, datetime, hashlib, html, json, pathlib, re
parser=argparse.ArgumentParser()
parser.add_argument('--captures', type=pathlib.Path, required=True)
args=parser.parse_args()
root=pathlib.Path(__file__).resolve().parents[1]
content=json.loads((root/'src/data/content.json').read_text())
verified=json.loads((root/'content/ability-evidence.json').read_text())
records={r['heroId']:r for r in verified['heroPages']}
checked_at=verified['checkedAt']
evidence=[]
for hero in content['heroes']:
    raw=(args.captures/(hero['id']+'.html')).read_bytes()
    digest=hashlib.sha256(raw).hexdigest()
    if digest != records[hero['id']]['rawSha256']:
        raise SystemExit('Capture changed; verify the source before importing: '+hero['id'])
    text=raw.decode('utf-8')
    rows=re.findall(r'<div class="perk-details [^"]+ (minor|major) \d+">.*?<h3 slot="subheading">(.*?)</h3><div slot="description">(.*?)</div>',text,re.S)
    if len(rows)!=4 or sorted(r[0] for r in rows)!=['major','major','minor','minor']:
        raise SystemExit('Unexpected official perk layout: '+hero['id'])
    source_id='official-perks-'+hero['id']
    source={'id':source_id,'url':records[hero['id']]['url'],'label':hero['name']+' official perk mechanics','retrievedAt':checked_at,'kind':'official','license':'Attributed factual perk names and brief mechanic quotations; no media copied.'}
    content['sources']=[s for s in content['sources'] if s['id']!=source_id]+[source]
    def plain(value):
        return ' '.join(html.unescape(re.sub('<[^>]+>',' ',value)).split())
    hero['perks']=[]
    for tier,name,description in rows:
        name=plain(name); description=plain(description)
        identifier=re.sub('[^a-z0-9]+','-',name.lower()).strip('-')
        if not identifier or not description: raise SystemExit('Incomplete official perk')
        hero['perks'].append({'id':identifier,'name':name,'tier':tier,'description':description,'review':{'sourceId':source_id,'patch':content['patch'],'reviewedAt':checked_at,'confidence':'high','stale':False}})
    evidence.append({'heroId':hero['id'],'sourceId':source_id,'url':source['url'],'rawSha256':digest,'perks':hero['perks']})
content['version']='0.7.0'
content['generatedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00','Z')
(root/'src/data/content.json').write_text(json.dumps(content,ensure_ascii=False,indent=2)+'\n')
(root/'content/perk-evidence.json').write_text(json.dumps({'checkedAt':checked_at,'patch':content['patch'],'scope':'Official perk mechanic facts only; does not approve tactical guides or matchups. No image assets imported.','heroes':evidence},ensure_ascii=False,indent=2)+'\n')
print('Imported',sum(len(h['perks']) for h in content['heroes']),'official perk entries')
