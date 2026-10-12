"""🧑‍🏫 Add original qualitative profiles; these are coaching estimates, not official ratings."""
import json,pathlib
root=pathlib.Path(__file__).resolve().parents[1]
content=json.loads((root/'src/data/content.json').read_text(encoding='utf-8'))
profiles=json.loads((root/'content/hero-profiles.json').read_text(encoding='utf-8'))
if set(profiles)!=set(h['id'] for h in content['heroes']):raise SystemExit('Profile roster mismatch; review new heroes first.')
for hero in content['heroes']:
 difficulty,styles,range_,mobility,survival,strengths,weaknesses=profiles[hero['id']]
 if difficulty not in ['approachable','moderate','demanding']:raise SystemExit('Invalid editorial difficulty')
 hero.update(difficulty=difficulty,playstyle=styles.split(','),strengths=strengths.split('; '),weaknesses=weaknesses.split('; '),attributes={'Engagement range':range_,'Mobility':mobility,'Survivability':survival,'Skill floor':{'approachable':'Start with covered positions and one reliable contribution.','moderate':'Practice aim, resource timing and safe repositioning together.','demanding':'Practice the kit’s timing and movement before combining full engagements.'}[difficulty], 'Skill ceiling':hero['guides'][-1]['body']})
 # This adds editorial estimates; it does not grant balance review or matchup approval.
 hero['review']['stale']=True
(root/'src/data/content.json').write_text(json.dumps(content,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Applied 54 original qualitative profiles; tactical review remains pending')
