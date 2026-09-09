"""Validate modular binding and sample a deformed pose in the saved Blender file."""
import bpy,json,math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
rig=bpy.data.objects['RIN_RIG']
meshes=[o for o in bpy.data.objects if o.type=='MESH' and o.get('module')!='90_STAGE' and o.get('module')]
errors=[]
for o in meshes:
    mods=[m for m in o.modifiers if m.type=='ARMATURE']
    if len(mods)!=1 or mods[0].object!=rig:errors.append(o.name+': invalid shared armature')
    if o.parent!=rig:errors.append(o.name+': invalid rig parent')
    for v in o.data.vertices:
        total=sum(g.weight for g in v.groups)
        if abs(total-1)>1e-4:errors.append(o.name+': unnormalized weights');break
        if not all(math.isfinite(c) for c in v.co):errors.append(o.name+': nonfinite vertex');break
    for g in o.vertex_groups:
        if g.name not in rig.data.bones:errors.append(o.name+': unknown bone '+g.name)
    if o.data.shape_keys:
        for k in o.data.shape_keys.key_blocks[1:]:
            if k.value!=0:errors.append(o.name+': expression is enabled at rest')
academy=[o for o in meshes if o.get('outfit')=='academy']
base=[o for o in meshes if o.get('outfit')=='base']
assert academy and base
scene=bpy.context.scene
scene.frame_set(24)
deps=bpy.context.evaluated_depsgraph_get()
for o in meshes:
    ev=o.evaluated_get(deps); m=ev.to_mesh()
    if not all(math.isfinite(c) for v in m.vertices for c in v.co):errors.append(o.name+': invalid posed vertex')
    ev.to_mesh_clear()
scene.frame_set(1)
# Verify practical hand/forearm pose response in both body and separate sleeves.
def bbox(o):
    ev=o.evaluated_get(bpy.context.evaluated_depsgraph_get())
    return [list(ev.matrix_world@Vector(c)) for c in ev.bound_box]
before={n:bbox(bpy.data.objects[n]) for n in ['Body_Arm_L','Academy_Sleeve_L']}
rig.pose.bones['forearm.L'].rotation_mode='XYZ'
rig.pose.bones['forearm.L'].rotation_euler[0]=.35
bpy.context.view_layer.update()
for n in before:
    if before[n]==bbox(bpy.data.objects[n]):errors.append(n+': does not follow arm pose')
rig.pose.bones['forearm.L'].rotation_euler[0]=0
result={'passed':not errors,'errors':errors,'meshes':len(meshes),'academyMeshes':len(academy),'baseMeshes':len(base),'bones':len(rig.data.bones),'checks':['shared rig on all meshes','normalized weights and finite vertices','zero expressions at rest','finite vertices at animation frame 24','body and sleeve respond to forearm pose']}
(ROOT/'assets'/'rin'/'validation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf8')
print('VALIDATION',json.dumps(result))
if errors:raise RuntimeError('; '.join(errors))
