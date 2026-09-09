import bpy,json,os
from pathlib import Path
root=Path(__file__).resolve().parents[1]
report={}
for name in ['idle','talk']:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=str(Path(os.environ.get('COMPANION_ACTIONS_DIR',str(root/'assets/companion/source-actions')))/(name+'.Fbx')),use_anim=True)
    rigs=[o for o in bpy.context.scene.objects if o.type=='ARMATURE']
    report[name]={'rigs':[{ 'name':r.name,'bones':[b.name for b in r.data.bones]} for r in rigs],'actions':[{'name':a.name,'range':list(a.frame_range)} for a in bpy.data.actions]}
    for o in list(bpy.context.scene.objects):
        if o.type!='ARMATURE':bpy.data.objects.remove(o,do_unlink=True)
    bpy.ops.export_scene.gltf(filepath=str(root/'assets/companion'/(name+'.glb')),export_format='GLB',export_animations=True)
(root/'assets/companion/actions-report.json').write_text(json.dumps(report,indent=2),encoding='utf8')
