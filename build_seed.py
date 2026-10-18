import json
c=json.load(open('data/catalog.json'))
open('data/catalog.js','w').write('window.DASTREA_SEED='+json.dumps(c,ensure_ascii=False,separators=(',',':'))+';\n')
ic=json.load(open('assets/iconos.json'))
open('assets/iconos.js','w').write('window.DASTREA_ICONS='+json.dumps(ic,ensure_ascii=False,separators=(',',':'))+';\n')
print('seed ok')
