"""📜 Collect installed third-party license text for release bundles."""
import json, pathlib, subprocess
root=pathlib.Path(__file__).resolve().parents[1]
texts=[]
lock=json.loads((root/'package-lock.json').read_text())
for path,pkg in lock['packages'].items():
 if not path.startswith('node_modules/'):continue
 folder=root/path
 for file in folder.iterdir() if folder.is_dir() else []:
  if file.is_file() and file.name.lower().startswith(('license','licence','copying','notice')):
   texts.append((path+' @ '+pkg.get('version',''),file.read_text(errors='replace')))
metadata=json.loads(subprocess.check_output(['cargo','metadata','--locked','--manifest-path',str(root/'src-tauri/Cargo.toml'),'--format-version','1'],text=True))
for pkg in metadata['packages']:
 if not pkg.get('source'):continue
 folder=pathlib.Path(pkg['manifest_path']).parent
 found=False
 for file in folder.iterdir():
  if file.is_file() and file.name.lower().startswith(('license','licence','copying','notice')):
   texts.append((pkg['name']+' @ '+pkg['version'],file.read_text(errors='replace')));found=True
 if not found:texts.append((pkg['name']+' @ '+pkg['version'],'Declared license: '+str(pkg.get('license'))+'\nSource: '+str(pkg.get('repository'))+'\nReview required if an attribution notice is not included upstream.'))
(root/'THIRD_PARTY_NOTICES.txt').write_text('\n\n'.join('===== '+name+' =====\n'+text for name,text in texts))
print(f'Collected {len(texts)} license and notice entries. Includes build-only dependencies.')
